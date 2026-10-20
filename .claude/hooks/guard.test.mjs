// Tests for the Hogwarts guard. Run: node --test .claude/hooks/guard.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkFileWrite, checkShell, decide, normPath } from './guard.mjs';

const PROJECT = 'C:\\Users\\scast\\Desktop\\SCP\\Marauders Map\\Hogwarts';
const MM = 'C:\\Users\\scast\\Desktop\\SCP\\Marauders Map\\Marauders-Map';
const MARKER = 'marauders-map';
const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guard.mjs');

test('paths normalise across Windows, Git Bash and quotes', () => {
  assert.equal(normPath('C:\\Users\\X\\a\\'), 'c:/users/x/a');
  assert.equal(normPath('/c/Users/X/a'), 'c:/users/x/a');
  assert.equal(normPath('"C:\\a\\..\\b"'), 'c:/b');
});

const allowedWrites = [
  'docs/SPEC.md',
  `${PROJECT}\\server\\src\\hogwarts\\rooms.ts`,
  '/c/Users/scast/Desktop/SCP/Marauders Map/Hogwarts/CLAUDE.md',
  '.env.example',
];
for (const p of allowedWrites) {
  test(`write allowed: ${p}`, () => assert.equal(checkFileWrite(p, PROJECT, PROJECT), null));
}

const blockedWrites = [
  `${MM}\\docs\\STATUS.md`,
  '/c/Users/scast/Desktop/SCP/Marauders Map/Marauders-Map/CLAUDE.md',
  '../Marauders-Map/docs/STATUS.md',
  'C:\\Users\\scast\\.claude\\settings.json',
  '..\\App\\CLAUDE.md',
  '.env',
  'server/.env.local',
  '.git/config',
];
for (const p of blockedWrites) {
  test(`write blocked: ${p}`, () => assert.notEqual(checkFileWrite(p, PROJECT, PROJECT), null));
}

const allowedShell = [
  'npm run build',
  'npm test',
  'node --test .claude/hooks/',
  'git status',
  'git commit -m "say push in a message"',
  'git switch -c architecture-note',
  'claude --help',
  'npx playwright test e2e/tests/standalone',
  `git --no-optional-locks -C "${MM}" log --oneline -8`,
  `git --no-optional-locks -C "${MM}" status --porcelain`,
  'node -e "console.log(process.env.HOME)"',
];
for (const c of allowedShell) {
  test(`shell allowed: ${c}`, () => assert.equal(checkShell(c, MARKER), null));
}

const blockedShell = [
  'git push',
  'git -c x=y push origin main',
  'git status && git push',
  'gh pr merge 3',
  'git reset --hard HEAD~1',
  'git clean -fd',
  'npm publish',
  'npx vsce publish',
  'claude --dangerously-skip-permissions',
  'claude --permission-mode bypassPermissions',
  'node dist/cli.js --host 0.0.0.0',
  'node dist/cli.js --allowed-host example.com',
  'cat .env',
  'Get-Content .env',
  'npm run e2e',
  'npx playwright test e2e/tests/claude/launch.spec.ts',
  `cd "${MM}" && ./.roomofreq/Scripts/python.exe -m pytest -q`,
  `Remove-Item "${MM}\\docs\\STATUS.md"`,
  `git -C "${MM}" status`,
  `git --no-optional-locks -C "${MM}" log > out.txt`,
  `git --no-optional-locks -C "${MM}" diff --output=x.patch`,
  `git --no-optional-locks -C "${MM}" log; rm -rf "${MM}"`,
  'cp notes.md /c/Users/scast/Desktop/SCP/Marauders\\ Map/Marauders-Map/docs/',
];
for (const c of blockedShell) {
  test(`shell blocked: ${c}`, () => assert.notEqual(checkShell(c, MARKER), null));
}

// Run from inside this repository, the name in prose is not a path.
const allowedInProject = [
  'git commit -m "chore: setup (read-only Marauders-Map, loopback only)"',
  "git commit -q -F - <<'EOF'\nKeep Marauders-Map read-only.\nEOF",
  'grep -rn "read-only Marauders-Map" docs',
];
for (const c of allowedInProject) {
  test(`shell allowed in project: ${c}`, () => assert.equal(checkShell(c, MARKER, true), null));
}

// ...but a path, a bare quoted name, or climbing out with `..` still counts.
const blockedInProject = [
  `cp notes.md "${MM}\\docs"`,
  'cat > ../Marauders-Map/docs/x.md',
  'cd .. && rm Marauders-Map/docs/STATUS.md',
  "Set-Location (Join-Path (Split-Path $PWD) 'Marauders-Map'); Remove-Item x",
  ...blockedShell.filter((c) => c.toLowerCase().includes(MARKER)),
];
for (const c of blockedInProject) {
  test(`shell blocked in project: ${c}`, () => assert.notEqual(checkShell(c, MARKER, true), null));
}

test('outside the repository any mention counts', () => {
  assert.notEqual(checkShell('git commit -m "Marauders-Map notes"', MARKER), null);
  const env = { CLAUDE_PROJECT_DIR: PROJECT };
  const commit = { tool_name: 'Bash', tool_input: { command: 'git commit -m "Marauders-Map notes"' } };
  assert.equal(decide({ ...commit, cwd: PROJECT }, env), null);
  assert.notEqual(decide({ ...commit, cwd: 'C:\\Users\\scast\\Desktop' }, env), null);
  assert.notEqual(decide(commit, env), null);
});

test('tools other than shell and file writes pass', () => {
  const env = { CLAUDE_PROJECT_DIR: PROJECT };
  assert.equal(decide({ tool_name: 'Read', tool_input: { file_path: `${MM}\\docs\\STATUS.md` } }, env), null);
  assert.equal(decide({ tool_name: 'Grep', tool_input: { pattern: 'x', path: MM } }, env), null);
});

test('decide routes file tools and shell tools', () => {
  const env = { CLAUDE_PROJECT_DIR: PROJECT };
  assert.notEqual(decide({ tool_name: 'Edit', tool_input: { file_path: `${MM}\\a.md` } }, env), null);
  assert.notEqual(decide({ tool_name: 'NotebookEdit', tool_input: { notebook_path: `${MM}\\a.ipynb` } }, env), null);
  assert.notEqual(decide({ tool_name: 'PowerShell', tool_input: { command: 'git push' } }, env), null);
  assert.equal(decide({ tool_name: 'Write', tool_input: { file_path: 'docs/ARCHITECTURE.md' }, cwd: PROJECT }, env), null);
});

function runGuard(stdin) {
  return spawnSync(process.execPath, [GUARD], {
    input: stdin,
    env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT },
    encoding: 'utf8',
  });
}

test('end to end: exit 2 on a blocked call, 0 on an allowed one', () => {
  assert.equal(runGuard(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' } })).status, 2);
  assert.equal(runGuard(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test' } })).status, 0);
});

test('end to end: unreadable input is blocked (fails closed)', () => {
  const r = runGuard('not json');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /blocked/i);
});
