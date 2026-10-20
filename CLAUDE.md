# CLAUDE.md — Hogwarts

Standing context for every session in this repository. **What to build:
`docs/SPEC.md`** — authoritative; amend it (with the operator) rather than
drifting from it. **How the inherited code works:
`docs/PIXEL_AGENTS_REFERENCE.md`** (the upstream project's own guide, kept
verbatim) and `CONTEXT.md` (its glossary — use its words: Agent, Sub-agent,
Character, Adopt, Launch, Area…). Read the parts a task touches; do not load
the whole reference by default, it is long.

## 1. What this is

A fork of **Pixel Agents** (MIT, `pixel-agents-hq/pixel-agents`) turned into
**Hogwarts**: a browser app that shows the Claude Code agents of one project —
the **Marauder's Map** trading system — as pixel characters living in a
Hogwarts castle, each in its own room, and lets the operator **chat with
them** and read each room's records.

It is for the operator's enjoyment and as his window into the agents' work.
It is **not** part of the trading system.

## 2. The hard rules

1. **Hogwarts only reads Marauders-Map** (`C:\Users\scast\Desktop\SCP\Marauders
   Map\Marauders-Map`, set in config, never hard-coded). The app never writes,
   moves or deletes anything there and never runs its scripts or tests. Git
   reads only, as `git --no-optional-locks …`. The one exception is by design:
   the chat **launches `claude` sessions in that folder** — those sessions run
   under Marauders-Map's own `CLAUDE.md`, permissions and guard, and the
   operator approves their actions himself.
2. **This binds you, Claude, while building.** Never edit a file outside this
   repository. Read Marauders-Map files with the Read/Grep/Glob tools to learn
   their formats; never touch them from a shell. Anything Marauders-Map needs
   is proposed to the operator and done in a session opened there. The guard
   (`.claude/hooks/guard.mjs`) enforces this.
3. **Never bypass permissions.** No `--dangerously-skip-permissions`, no
   `bypassPermissions` mode, in code, config, tests or commands. The inherited
   "skip permissions" launch option is removed (SPEC §7), not hidden.
4. **Loopback only.** The server binds to `127.0.0.1`. No `--host 0.0.0.0`,
   no `--allowed-host`, no tunnels. The office URL carries a token — treat it
   as a secret, never paste it into a commit, log or doc.
5. **Browser only.** The standalone adapter is the product. Leave the VS Code
   adapter compiling (upstream merges stay easy) but build nothing for it, and
   never launch VS Code end-to-end tests.
6. **Original characters.** Sprites are the app's own figures in robes — never
   portraits of film or book characters, never copied art. Room names may be
   the castle's; people may not.

## 3. The operator

Santiago: capital-markets background, strong Python, **new to TypeScript,
React and front-end tooling**. So:

- **Small, visible steps** (SPEC §9), one at a time, each ending with exactly
  what to run and what he should see in the browser. Do not batch steps.
- **Explain before changing files**, then wait for his go. Flag every new
  dependency, tool or divergence from the spec before it lands.
- **Explain web/TypeScript terms the first time** (component, hook, WebSocket,
  PTY, workspace, Vite…) in one or two plain sentences.
- **Push back** when the spec does not hold up in the real code; propose the
  amendment.
- For anything outgoing or destructive, show exactly what will happen and wait.

## 4. Commands (Windows, PowerShell; Node 22)

```
npm install                       # once, and after dependency changes (asks first)
npm run build                     # types, lint, bundles — must pass before a step is done
npm test                          # webview + server unit tests (Vitest)
node --test .claude/hooks/guard.test.mjs   # the guard's own tests
node dist/cli.js --port 3100      # run Hogwarts; open the printed URL (it holds the token)
```

Dev loop for the UI: `npm run watch` in one terminal, `cd webview-ui; npm run
dev` in another. Playwright: only the standalone specs
(`npx playwright test e2e/tests/standalone`), never `e2e/tests/claude/**`.

## 5. Git

Own repository (the fork). `origin` = the operator's fork; add `upstream` =
`pixel-agents-hq/pixel-agents` only when he decides to pull upstream changes.
One branch per step, small commits that say what and why. **Claude never
pushes and never merges** — the operator tries the step, then merges and pushes
from GitHub Desktop.

## 6. Conventions

- Keep the inherited layering (core → server → webview-ui; adapters on top)
  and its constants policy, lint rules and test style. New Hogwarts code goes
  in clearly named modules (`server/src/hogwarts/…`,
  `webview-ui/src/hogwarts/…`) so upstream merges stay readable.
- Code names stay literal (`roomPanels.ts`, `readCandidateSpecs()`); the theme
  lives in what the operator sees — room names, labels, sprites, flavour text.
- Everything Marauders-Map-specific lives in config (`hogwarts.config.json`):
  repo path, agent → room mapping, which files feed which room. No paths or
  agent names in code.
- Every reader of a Marauders-Map file is a small pure function tested on
  **fixture copies** of the real files (`server/__tests__/fixtures/hogwarts/`),
  never on the live repo. A reader that fails shows its error in its panel; the
  castle never crashes.
- Agent names, descriptions and lanes come from
  `Marauders-Map/.claude/agents/*.md`, never copied into this repo.

## 7. Current state

Fork cloned 2026-10-19; nothing changed yet. **Next: `docs/tasks/01_architecture-note.md`**
(read the inherited code, write `docs/ARCHITECTURE.md`, no code changes).
