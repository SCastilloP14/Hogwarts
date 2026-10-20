#!/usr/bin/env node
// Hogwarts guard — a Claude Code PreToolUse hook (see CLAUDE.md §2).
//
// Runs before every shell command and file write in this repository and
// blocks the actions that must never happen while building Hogwarts:
//   - writing any file outside this repository (Marauders-Map included);
//   - touching Marauders-Map from a shell, except read-only git with
//     --no-optional-locks (from inside this repository only a path to it
//     counts, not its name in a commit message or search);
//   - pushing, merging, publishing, destructive git;
//   - permission-bypassing flags;
//   - exposing the server beyond loopback;
//   - .env files (other than .env.example);
//   - the VS Code end-to-end suites (they take over the screen).
//
// Exit 0 = allow; exit 2 = block (the reason goes to stderr, which Claude
// reads). Unreadable input is blocked: the guard fails closed.
// Node standard library only.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

/** Normalise a Windows, Git Bash or POSIX path to lower-case forward slashes. */
export function normPath(p) {
  let s = String(p).trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/');
  const gitBash = /^\/([a-zA-Z])\//.exec(s);
  if (gitBash) s = `${gitBash[1]}:/${s.slice(3)}`;
  s = path.posix.normalize(s);
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s.toLowerCase();
}

function isAbsolute(p) {
  return /^[a-z]:\//.test(p) || p.startsWith('/');
}

/** Resolve `p` against `base` (both already normalised). */
export function resolveAgainst(p, base) {
  return isAbsolute(p) ? p : normPath(`${base}/${p}`);
}

export function isInside(child, parent) {
  return child === parent || child.startsWith(`${parent}/`);
}

const SHELL_BLOCKS = [
  [/\bgit(\s+(-c\s+\S+|--\S+|-\S+))*\s+push\b/, 'git push is the operator\'s, from GitHub Desktop'],
  [/\bgh\s+pr\s+merge\b/, 'merging is the operator\'s'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard discards work'],
  [/\bgit\s+clean\s+-\S*f/, 'git clean -f deletes files'],
  [/\b(npm|pnpm|yarn)\s+publish\b|\b(vsce|ovsx)\s+publish\b/, 'publishing is not part of this project'],
  [/dangerously-skip-permissions|bypasspermissions|permission-mode\s+bypass/, 'permission bypassing is forbidden (CLAUDE.md §2.3)'],
  [/--host\s+(0\.0\.0\.0|::)|--allowed-host/, 'the server stays on loopback (CLAUDE.md §2.4)'],
  [/(^|[\s'"/\\=])\.env(?!\.example)(\b|$)/, '.env files are never read or written'],
  [/e2e[/\\]tests[/\\]claude|\bnpm\s+run\s+e2e\b/, 'VS Code end-to-end tests take over the screen; run only e2e/tests/standalone'],
];

const READ_ONLY_GIT =
  /^\s*git\s+--no-optional-locks\s+(-C\s+("[^"]*"|'[^']*'|\S+)\s+)?(log|status|show|diff|branch\s+--show-current|rev-parse|ls-files)\b/i;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Does `text` (lower-cased, forward slashes) point at Marauders-Map?
 * From inside this repository the folder is only reachable by a path, so
 * only the marker as a path segment (`…/marauders-map`) or as a whole quoted
 * token (`'marauders-map'`) counts; the name in prose (a commit message,
 * a search pattern) does not. Anywhere else — or once `..` climbs out —
 * any mention counts.
 */
function makeMentions(repoMarker, inProject, wholeCommand) {
  const m = escapeRegExp(repoMarker);
  const climbs = /(^|[\s/"'=])\.\.([\s/"']|$)/.test(wholeCommand);
  if (!inProject || climbs) return (text) => text.includes(repoMarker);
  const asPath = new RegExp(`/${m}(?=$|[/\\s"'\`;|&)])|(["'])${m}\\1`);
  return (text) => asPath.test(text);
}

/**
 * Returns a block reason for a shell command, or null to allow it.
 * `inProject`: the command runs with its cwd inside this repository.
 */
export function checkShell(command, repoMarker, inProject = false) {
  const cmd = String(command);
  const lower = cmd.toLowerCase();
  for (const [re, why] of SHELL_BLOCKS) {
    if (re.test(lower)) return why;
  }
  const slashed = (s) => s.toLowerCase().replace(/\\/g, '/');
  const mentions = repoMarker && makeMentions(repoMarker, inProject, slashed(cmd));
  if (mentions && mentions(slashed(cmd))) {
    const parts = cmd.split(/&&|\|\||;|\|/);
    const allReadOnly = parts.every((part) => {
      const hits = mentions(slashed(part));
      return !hits || (READ_ONLY_GIT.test(part) && !/>|--output/.test(part));
    });
    if (!allReadOnly) {
      return 'Marauders-Map is read-only from here: use the Read/Grep/Glob tools, or `git --no-optional-locks -C <path> log|status|show|diff`';
    }
  }
  return null;
}

/** Returns a block reason for a file write, or null to allow it. */
export function checkFileWrite(filePath, projectDir, cwd) {
  if (!filePath) return 'file tool call without a path';
  const project = normPath(projectDir);
  const target = resolveAgainst(normPath(filePath), normPath(cwd || projectDir));
  if (!isInside(target, project)) {
    return `writes are allowed only inside this repository (${projectDir}); Marauders-Map changes are made in a session opened there`;
  }
  const rel = target.slice(project.length + 1);
  if (/(^|\/)\.env(?!\.example$)[^/]*$/.test(rel)) return '.env files are never read or written';
  if (rel === '.git' || rel.startsWith('.git/')) return 'the .git folder is git\'s, not ours';
  return null;
}

/** Decide on one hook payload. Returns a block reason, or null to allow. */
export function decide(payload, env) {
  const projectDir = env.CLAUDE_PROJECT_DIR || payload.cwd;
  if (!projectDir) return 'cannot tell which project this is (no CLAUDE_PROJECT_DIR)';
  const repoMarker = env.HOGWARTS_GUARD_REPO_MARKER ?? 'marauders-map';
  const tool = payload.tool_name;
  const input = payload.tool_input || {};
  if (SHELL_TOOLS.has(tool)) {
    const inProject = Boolean(payload.cwd) && isInside(normPath(payload.cwd), normPath(projectDir));
    return checkShell(input.command ?? '', repoMarker, inProject);
  }
  if (FILE_TOOLS.has(tool)) {
    return checkFileWrite(input.file_path ?? input.notebook_path, projectDir, payload.cwd);
  }
  return null;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch (err) {
    process.stderr.write(`guard: could not read the tool call (${err.message}); blocked\n`);
    process.exit(2);
  }
  let reason;
  try {
    reason = decide(payload, process.env);
  } catch (err) {
    reason = `guard error (${err.message}); blocked`;
  }
  if (reason) {
    process.stderr.write(`Blocked by the Hogwarts guard: ${reason}. If this looks legitimate, stop and tell the operator — do not work around it.\n`);
    process.exit(2);
  }
  process.exit(0);
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (invokedDirectly) main();
