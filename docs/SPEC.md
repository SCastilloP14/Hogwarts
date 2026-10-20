# SPEC — Hogwarts

*Written 2026-10-19 from the design conversation; approved in scope by the
operator. Authoritative for what gets built. Amend it with the operator when
the code shows a part does not hold up — never drift from it silently.*

## 1. What it is

A browser app, forked from **Pixel Agents**, that shows the Claude Code agents
of the **Marauder's Map** trading project as pixel characters in a Hogwarts
castle. Each agent lives in its own room; the operator watches them work,
**chats with them in the app**, and clicks any room to read its records
(specs, results, reviews, the state of the gauntlet).

It only ever **reads** Marauders-Map (CLAUDE.md §2). The chat launches real
`claude` sessions in that repository, so every guardrail of that repository
applies to them unchanged.

## 2. Who lives in the castle

Five **residents**, always present, even when nothing is running:

| Resident | What it is in Marauders-Map | Works in | Rests in |
|---|---|---|---|
| **Headmaster** | the main Claude Code session — talks with the operator, plans, sends work to the agents, files their reports | **Great Hall** | Gryffindor Common Room |
| **Researcher** | agent `researcher` — drafts blind candidate specs | **Library** | Common Room |
| **Coder** | agent `coder` — implements approved specs and roadmap steps | **Potions Classroom** | Common Room |
| **Auditor** | agent `auditor` — independent read-only review | **Defence Against the Dark Arts** | Common Room |
| **Tester** | agent `tester` — runs the authorised gauntlet step, records the verdict | **Spells Classroom** | Common Room |

- The four agents and their descriptions are read from
  `Marauders-Map/.claude/agents/*.md` (name, description, lane). A new agent
  file there shows up as a new resident with a default room until it is mapped
  in config. The mapping agent → room lives in `hogwarts.config.json`.
- *Dependency:* the agent names above arrive with the Marauders-Map task
  `docs/tasks/2026-10-19_agent-roster.md` (renames `spec-writer`, `builder`,
  `clerk`). Until it is merged, map the old names in config.

### How residents move

| What is happening | Where the character is | What it shows |
|---|---|---|
| no session for it | resting in the **Common Room** (wanders, sits) | — |
| it is working (its session or sub-agent is active) | walks to **its room**, works at its desk | activity label ("Reading docs/STATUS.md") |
| it needs the operator (permission request, or waiting for input) | **stays in its room** | a raised flag over its head + the chime; clicking it opens its chat |
| it finished | walks back to the Common Room | the checkmark bubble, fading |

- **Several of one kind at once** (e.g. two coders in parallel): extra
  characters appear beside the resident as apprentices (same robe, shifted
  colour) and leave when their task ends.
- **Sub-agents** spawned by the Headmaster *are* the residents: a `coder`
  sub-agent drives the Coder character, not a nameless figure next to the
  Headmaster. How the app learns a sub-agent's type is checked in the
  architecture note (task 01).

## 3. Which sessions appear

Only sessions whose working directory is the Marauders-Map repository (path
from config). Every other Claude Code session on the machine is ignored —
not drawn, not adopted. The inherited "Watch All Sessions" option is off and
removed from settings.

## 4. Chat

The point of the app: talk to the agents **in the app**, never in a separate
terminal.

**v1 — the real Claude Code, inside the castle.** The fork already contains a
browser terminal (xterm in the page, connected to a real `claude` process on
the PC). v1 uses it, restyled as a parchment pane:

- **Clicking the Headmaster** opens the Headmaster's chat: the running
  Marauders-Map session if there is one, otherwise it launches `claude` in
  Marauders-Map. This is where work is planned and agents are sent.
- **Clicking an agent** opens a **direct chat** with it: a separate session
  launched as that agent (`claude --agent <name>` in Marauders-Map — the flag
  is verified in task 01). For questions inside the agent's lane, e.g. asking
  the Auditor about a finding. Its lane and guard still apply.
- **Approvals happen in the chat**, exactly as Claude Code asks them (the
  numbered permission prompt). The character's flag tells the operator a
  prompt is waiting; clicking it brings that chat to the front.
- Why the real CLI: it runs on the operator's existing Claude login, keeps
  every permission rule and hook of Marauders-Map, and needs no new code for
  approvals.
- A sub-agent working inside the Headmaster's task cannot be chatted to
  mid-task (Claude Code's design): its report comes back through the
  Headmaster.

**v2 — a themed chat (own go, later).** A parchment chat with speech bubbles
and **Approve / Deny buttons**, built on the Claude Agent SDK (`canUseTool`
turns each permission request into buttons). Only if task 01 confirms the SDK
can run on the operator's Claude login without an API key — or the operator
accepts API billing. Until then, v1 is the chat.

## 5. Rooms and what they show

Clicking a room opens a **parchment panel** with that room's records, read
from Marauders-Map. Each panel says when it was read and refreshes on its own.

| Room | Who / what | Panel shows | Read from (Marauders-Map) |
|---|---|---|---|
| **Great Hall** | Headmaster | **The gauntlet board** (below) and the current STATUS, rendered | `docs/STATUS.md`; each spec's `Gauntlet stage` row |
| **Library** | Researcher | Every candidate spec — ID, version, gauntlet stage; click one to read it as a scroll | `docs/candidates/*.md` |
| **Restricted Section** | the reports, chained (the Researcher works next door and may not enter) | Latest report per candidate and kind: **file name and date only, never opened** | names under `reports/<strategy>/<kind>/` |
| **Potions Classroom** | Coder | Current branch, last commits, number of uncommitted files | `git --no-optional-locks` (log, status, branch) |
| **Defence Against the Dark Arts** | Auditor | Every saved review, newest first, with its verdict line; click to read | `docs/reviews/*.md` |
| **Spells Classroom** | Tester | Each candidate's results log, newest row first (step, date, verdict) | each spec's results-log section |
| **Gryffindor Common Room** | where residents rest | Who is resting, who is working, who is waiting for the operator and why | live state |
| **Chamber of Secrets** | the holdout, sealed | "Sealed — never opened", or one line per opening (date, candidate) and the count | `data/holdout_openings.csv` (absent = never opened) |
| **Forbidden Forest** | retired candidates | A gravestone per killed candidate with its reason | specs whose stage is `killed_*` |

**The gauntlet board** (Great Hall): one row per candidate, one column per
gate — spec · built · reviewed · merged · K1 · walk-forward · holdout ·
admitted · paper · live — each cell passed / current / failed / not reached,
from the spec's `Gauntlet stage` token (vocabulary in
`Marauders-Map/docs/candidates/README.md`). A candidate without the token
shows "stage unknown", never a guess.

**Reserved** (space kept in the layout, nothing built in v1): **Entrance
Hallway** (a banner per admitted strategy, from `config/roster.yaml`),
**Hospital Wing** (an agent whose task failed), **Whomping Willow** (thrashes
when the guard blocks something), **Owlery** (alerts), **Astronomy Tower**
(paper and live trading), **Clock Tower** (the daily run).

Every reader is read-only, tolerant of a missing file ("nothing yet") and of a
malformed one (shows the error in the panel), and has tests on fixture copies.

## 6. The castle (layout and art)

- The castle is a **layout** in the inherited format (JSON: tile grid up to
  64 × 64, floors, walls, furniture, **areas**). Each room is a named area.
  The default castle ships in the repo; the operator can rearrange it with the
  inherited layout editor and export it as the new default.
- **Rooms are linked to residents by area name** in `hogwarts.config.json`,
  so moving or renaming a room is a config change, not a code change.
- **Art:** a Hogwarts furniture pack (house tables, bookshelves, cauldrons,
  lecterns, banners, a sorting stool, gravestones, a sealed door…) as custom
  assets in the inherited asset format, and **five original character
  sprites** in robes (one per resident, house colours allowed, no film
  likeness). Until the art exists, inherited furniture and characters stand
  in, recoloured. Where the art comes from (operator-supplied, drawn by
  Claude as simple 16-px sprites, or an MIT/CC0 pack) is decided at that step.

## 7. Inherited features: keep, change, remove

| Feature | Decision |
|---|---|
| Standalone browser server, tokened URL | **keep**, bound to `127.0.0.1` only |
| Hooks into `~/.claude/settings.json` (consent-gated) | **keep** — the source of live activity. Already installed by the Marketplace extension; the fork's server reuses them |
| Transcript fallback | keep |
| Browser terminal | **keep** — it is the v1 chat (§4) |
| Layout editor | keep |
| Skip-permissions launch option | **remove** (setting, message, UI and launch flag), with a test that no launch command can contain it |
| Watch All Sessions | **remove** — Marauders-Map only (§3) |
| Launching into arbitrary directories | **restrict** to the Marauders-Map path from config |
| Remote access (`--host`, `--allowed-host`, mobile shell over the LAN) | leave the code, never enable; document as off |
| VS Code extension | leave it compiling; do not build for it. Disable the **Marketplace** Pixel Agents extension once the fork runs, so the two do not compete for the same hooks and `~/.pixel-agents` state |

## 8. Configuration

`hogwarts.config.json` at the repo root (committed; no secrets):

```json
{
  "repoPath": "C:\\Users\\scast\\Desktop\\SCP\\Marauders Map\\Marauders-Map",
  "headmaster": { "room": "great_hall" },
  "agents": {
    "researcher": { "room": "library" },
    "coder": { "room": "potions" },
    "auditor": { "room": "dada" },
    "tester": { "room": "spells" }
  },
  "restRoom": "common_room",
  "refreshSeconds": 15
}
```

Exact shape settled in task 01 / step 2; the principle — Marauders-Map facts
in config, not code — is fixed.

## 9. Build steps (small, visible — the operator tries each one)

0. **Architecture note** (`docs/tasks/01_architecture-note.md`): read the
   inherited code; write `docs/ARCHITECTURE.md`; no code changes.
1. **Run the fork from source** in the browser, unchanged. Disable the
   Marketplace extension. *See:* a Marauders-Map session appears as a
   character.
2. **Lock it down:** loopback only; remove skip-permissions and Watch All;
   launches restricted to Marauders-Map; tests. *See:* the options are gone;
   a session in another folder does not appear.
3. **Config + session typing:** `hogwarts.config.json`; each Marauders-Map
   session and sub-agent tagged Headmaster / researcher / coder / auditor /
   tester; tests on recorded hook events and transcripts. *See:* the type in
   each character's label.
4. **The castle layout:** rooms as named areas, placeholder furniture.
   *See:* the castle with every room of §5 and the reserved ones.
5. **Residents:** five permanent characters, resting in the Common Room,
   moving by the rules of §2, flag when waiting. *See:* ask the Headmaster to
   send the auditor on a review; the Auditor walks to DADA, works, returns.
6. **Chat:** click the Headmaster → its session; click an agent → direct
   chat; the parchment terminal pane. *See:* a whole conversation and an
   approval without leaving the browser.
7. **Room panels, one per step:** Great Hall (STATUS) → gauntlet board →
   Library → Spells → DADA → Potions → Restricted Section → Chamber → Forest.
   *See:* each panel shows today's real records.
8. **Art:** the Hogwarts furniture pack and the five character sprites.
9. **Polish:** sounds, flavour text, opening ritual ("I solemnly swear…").

## 10. Acceptance (v1 done when)

- The five residents are always on the map and move by §2's rules during a
  real Headmaster → agent run.
- The operator can hold a full conversation with the Headmaster, and a direct
  one with any agent, and answer every permission prompt, without leaving the
  browser.
- Every room panel of §5 shows the real state of Marauders-Map; changing
  `docs/STATUS.md` there shows in the Great Hall within one refresh.
- **Read-only test:** the panel readers run against a temporary copy of a
  Marauders-Map-like folder and the test asserts nothing in it was created,
  modified or deleted.
- No code path can launch `claude` with a permission-bypassing flag, or
  outside the configured repository (tested).
- `npm run build`, `npm test` and the guard's tests (`node --test .claude/hooks/guard.test.mjs`) pass.

## 11. To verify before building (task 01)

- `claude --agent <name>`: does it exist in the installed Claude Code
  (v2.1.302), and does such a session carry the agent's name in its hooks or
  transcript?
- How a sub-agent's type (`researcher`, `coder`…) reaches the app: hook
  payload, the Agent tool call's input, the background-agent sidecar.
- Whether the Claude Agent SDK runs on the operator's Claude login or needs an
  API key (decides v2 chat).
- How the fork's server and the Marketplace extension share
  `~/.pixel-agents/` and the global hooks, and what disabling the extension
  leaves behind.
