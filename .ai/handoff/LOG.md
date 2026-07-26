# LOG - aahp-hub

> Append-only journal of decisions, ADRs, and notable events.
> Newest entry on top. Older entries can be archived to `logs/LOG-YYYY-MM-DD.md`.

---

## 2026-07-26: The application code finally runs in CI (claude-opus-5)

The repository ran no test suite in CI. `.github/workflows/aahp-verify.yml`
checks handoff-state integrity and `.github/workflows/supply-chain-guard.yml`
checks dependency risk; neither one runs `npm test`, `npm run lint`,
`npm run build` or a type check. There are no local git hooks in the tree
either. A change that broke every test in lib/ produced two green checks.

`.github/workflows/ci.yml` runs lint, unit tests, build and type check on push
to main and on every pull request, with read-only permissions, a 15 minute
timeout and Node 20 to match the AAHP Verify job.

### What this does NOT do

It does not block a merge, and an earlier draft of this entry was wrong to say
it closed the hole. `main` has no required status checks at all: not this job,
not AAHP Verify, not Supply Chain Guard. Branch protection on main enforces
admin inclusion, no force pushes and no branch deletion, and nothing else.
Every check in this repository is therefore a notification that a human has to
read, and a red one can still be merged past. Configuring a required check is
a separate, deliberate decision for the repository owner, recorded in
NEXT_ACTIONS.md.

### The suite is no longer scoped to a directory

vitest.config.ts carried `include: ['lib/**/*.test.ts']`. Every test file
happens to live in lib/ today, so the set of tests that actually run is
unchanged, but the glob meant a test added anywhere else would never be
collected while `npm test` still exited 0 - precisely the false-green failure
mode this workflow exists to remove. The include is now the unscoped default
pattern (any `.test`/`.spec` file, any TypeScript or JavaScript extension),
with node_modules and the build output directories excluded.

### Lint warnings were not failures

`npm run lint` is bare `eslint`, which exits 0 on warnings, so a warning would
print into the log under a green check. The CI step runs `--max-warnings=0`.
The tree is warning-free today, so this changes no current result; it prevents
the drift. Chosen deliberately over the alternative of tolerating warnings,
and the reasoning is written into the workflow so the next reader is not left
guessing.

### Why the type check runs after the build

Next.js generates the typed-routes helpers (`PageProps<'/projects/[projectId]'>`
and siblings) into `.next/types`, plus `next-env.d.ts`, as part of `next build`,
and `tsconfig.json` pulls both into `include`. On a checkout that has never been
built, `npx tsc --noEmit` therefore reports `Cannot find name 'PageProps'` in
app/projects/[projectId]/page.tsx. That is a missing generated file, not a
defect. After `npm run build` the same command exits 0. It is kept as its own
step rather than trusting the build alone so that files outside the Next.js
graph, notably the test files, are type-checked too.

### The gate was watched failing twice

First on a push event: a scratch branch carried this workflow together with a
deliberate regression, a strict top-level key allowlist in `parseManifest`
(lib/manifest.ts) that throws on any key outside the six declared in
`RawManifest`. The job went red at the unit test step (`lib/manifest.test.ts`,
1 failed / 194 passed), with build and type check skipped. Run 30193587435.
That single failing test was caused by the injected regression and by nothing
else; on clean code the suite is green, and run 30193724486 on this branch
reports 14 test files and 195 tests passing.

A push event is not the trigger a required status check evaluates, so the
second proof used a pull_request event and put the failing test OUTSIDE lib/,
which makes the same run prove the widened include glob as well: 15 test files
collected where the clean branch collects 14. Run 30195092609. Both scratch
branches were deleted; nothing of either regression is on this branch.

### Trigger and concurrency

The `pull_request` trigger carries no base-branch filter. Filtered to
`branches: [main]` it produced no run at all for a pull request targeting any
other base, and a missing check reads as "not applicable" when it in fact
means "never verified". A concurrency group keyed on the ref cancels
superseded runs on branches so a rapid series of pushes does not keep several
obsolete runs burning minutes; `main` is excluded from cancellation so the
default branch keeps a complete per-commit history.

---

## 2026-07-25: Daily project overview, honest by construction (claude-opus-5)

The dashboard rendered AAHP handoff state and nothing else, which made it
thin, and one panel made it actively misleading. This session turned it into
the overview it was supposed to be.

### ADR: repositories are identified by the git origin remote

Directory names drift (`sample-bot-dir` tracks
`acme/sample-bot`), manifest `github_repo` fields are
absent in 23 of 57 scanned projects and stale in others, and two projects were
migrated to a self-hosted Forgejo at `forge.internal.example` and no longer exist on
GitHub. `.git/config` is read directly (no `git` process per project) and the
origin URL is parsed into `owner/name`. The manifest field is used only as a
fallback for a checkout with no remote at all, and the UI reports which source
a mapping came from.

Consequence: a project with no GitHub origin renders as `n/a`. Never an error,
never a zero.

### ADR: credentials come from the `gh` CLI, not from this process

There is no `GITHUB_TOKEN` variable, no token file and no PAT prompt. The hub
spawns `gh api graphql --input -` and lets gh supply its own keyring-backed
credentials. The GraphQL document travels on stdin, never in argv and never
through a shell; owner and name are validated against strict patterns and
dropped (not escaped) if they fail, so nothing caller-controlled can reshape
the document.

Cost: one aliased document per batch of 30 repositories is 1 rate-limit point.
The whole fleet of 49 mapped repositories is 2 points out of 5000 per hour.
Measured live: 49 requested, 49 answered.

### ADR: OPEN, MERGED and CLOSED pull requests are three numbers

GitHub's `CLOSED` pull request state EXCLUDES merged pull requests.
`acme/sample-service` returns 0 closed and 30 merged. Rendering "closed
PRs" from `states: CLOSED` alone would have claimed that nothing ever shipped
there, which is exactly the class of misinformation this session was called in
to remove. All three are queried and labelled separately, and the column
header explains the semantics. Issues and pull requests stay separate GraphQL
fields, so the REST conflation problem never arises.

### Removed: the fabricated tooling panel

`lib/tooling.ts` returned a hardcoded list of eleven models with invented
`online` / `standby` statuses and five MCP servers with invented tool counts.
Nothing measured any of it. It was deleted along with `app/tooling-panel.tsx`
rather than wired to a fake probe. The real, measurable signal about tooling
now on screen is whether `gh` is installed and authenticated, reported in the
freshness bar when it is not.

### Staleness is a column, not a footnote

Several checkouts were 17 to 20 commits behind their remote, which silently
invalidates every handoff-derived value in the row. Drift is measured from the
remote-tracking refs with `git --no-optional-locks status --porcelain=v2`, and
the mtime of `FETCH_HEAD` is shown next to it so the reader knows how old that
measurement is. The hub never fetches. Branches with no upstream say "no
upstream" instead of "in sync".

### Non-blocking by design

`app/page.tsx` renders the handoff board from local files. `/api/fleet` fills
the repository and checkout columns afterwards. Cells distinguish three
states: `n/a` (does not apply), a pulsing placeholder (not fetched yet), and a
number. A failed refresh keeps the last good values with a visible staleness
marker; `mergeFetchIntoCache` preserves each repository's own `fetchedAt`, so
a row that did not answer this round shows its real age.

---

## 2026-04-30: Sidebar nav + metrics page + spawn window fix (claude-opus-4-7)

User asked for three things at once: hide the visible Node console
window when the hub spawns `aahp run`, add a sidebar navigation, and
expose more of the metrics that already live in `~/.aahp/metrics.jsonl`.

### Spawn window fix

When the hub did `cmd.exe /d /s /c aahp.cmd run --all` with
`detached: true, stdio: 'ignore', windowsHide: true`, a Node console
window still flashed. Cause: `windowsHide` only suppresses cmd.exe's
window. cmd.exe then ran `aahp.cmd` which fork-exec'd `node.exe`, and
`node.exe` allocated its own console because nothing told it not to.

Fix: wrap the call in Windows' `start /B`:

```
cmd.exe /d /s /c start "" /B /MIN aahp.cmd run --all
```

`start /B` runs the next executable without creating a new console.
The empty `""` is required because `start`'s first quoted token is the
window title; without it, Windows would interpret `aahp.cmd` as a
title and try to run nothing. `/MIN` guards against any console that
slips through. Detection (`spawnSync('aahp.cmd', '--version')`) keeps
its existing path because that command runs synchronously and finishes
fast enough that the console allocation is never visible.

Refactored as `detachedSpawnArgs(...)` next to the existing
`spawnArgs(...)` helper. spawnRun uses the detached variant; tryBinary
uses the synchronous one.

### Sidebar navigation

Layout now has a 210px left sidebar with:

- Header: AAHP Hub brand block (mono cyan)
- Nav: `/` Overview, `/metrics`, `/sessions`, `/logs` (with a `// WORK`
  group separator before metrics, matching the grouped-nav pattern of the
  internal dashboard used as the visual reference)
- Footer: GitHub repo link

The sidebar is a Client Component (`'use client'`) because it uses
`usePathname()` to highlight the active route. Pre-computed group
separators avoid a "cannot reassign during render" lint error from
`react-hooks/immutability`.

### New pages

**`/metrics`** - deeper analytics from the JSONL feed:

- Top totals: runs, success rate, failures, aborted, tokens i/o, cache
  hit rate
- 14-day daily activity sparkline (each day color-coded green/red/dim
  based on success/failure mix; tooltip shows full counts and tokens)
- By backend: runs, success rate, avg duration, tokens (sortable later)
- By model: runs, tokens i/o, cache hit rate
- Top 10 projects by token spend
- Last 20 failures (with task title, abort vs error distinction, and
  relative time)

Built on a new `lib/analytics.ts` that re-parses `metrics.jsonl` and
exposes `BackendBreakdown`, `ModelBreakdown`, `DailyBucket`,
`ProjectCost`, `RecentFailure`, plus aggregate totals.

**`/sessions`** - dedicated live + recent view:

- Live sessions list: green-bordered cards with task, backend, last
  log line, abort button per row
- Recent runs table: last 30 runs from JSONL, with project, task,
  backend, duration, tokens, status (ok / fail / aborted)

**`/logs`** - placeholder list of `~/.aahp/logs/*` files with name,
size, mtime. No tail yet (would need an SSE-style log-tail endpoint;
deferred).

### Verification

- `npm run build` clean (8 routes now: `/`, `/metrics`, `/sessions`,
  `/logs`, `/_not-found`, `/api/{abort,run,stream}`)
- `npm run lint` clean
- `npm test` 51/51 pass

### Open follow-ups

- The metrics page does not yet expose a date-range filter; everything
  is "all time" plus a fixed 14-day strip. Add a 24h / 7d / 30d / all
  toggle when there is enough data to make the choice matter.
- `/logs` only lists; tailing a log live is the natural next step.
  Either an SSE route that tails the selected file, or just an iframe
  to the on-disk log via a static-files server. Defer until requested.
- Sidebar collapse animation (the reference dashboard has one) is not
  implemented. The fixed 210px is fine on widescreens; could be improved
  later.
- The "more metrics" backlog the user mentioned still has obvious
  candidates: cost in dollars (needs a model price table), trend per
  backend over time, retry counts, time-of-day breakdown. None are
  load-bearing today.

---

## 2026-04-30: Dark card visual language pass (claude-opus-4-7)

User asked to take over the visual style of an existing internal dashboard's
Projects page, where GitHub projects are much more legibly laid out: compact
cards with a left-border status indicator, a name + branch chip header, a
hash + commit message row, badges, and a row of cyan-tinted action buttons.

### Decisions

- **Lift the palette wholesale.** The reference dashboard's dark tokens
  (`--bg #0d0d16`, `--c1 #151522`, `--cy #38b8f8`, `--ok #00e87a`, `--warn
  #ffbb00`, `--er #ff4060`) replace the prior Atlas-derived tokens.
  Tailwind v4 inline `@theme` exposes them as `bg-c1`, `text-cy`,
  `border-br`, etc.
- **Card primitives in CSS.** `.hub-card`, `.hub-link-btn`,
  `.hub-chip`, `.hub-pill` carry the look. Tailwind utilities still
  work for layout; the primitives carry the colored-border + button
  aesthetics that would be ugly to express as a long Tailwind class
  string. Three left-border states: `is-running` (green), `is-active-tasks`
  (amber), `is-clean` (faint green).
- **Card layout follows the reference structure but with AAHP data.**
  - Header: state dot + monospace project name + phase chip (replaces
    the reference's branch chip)
  - "Commit row": last-agent chip + first sentence of `quick_context`
    (replaces the reference's hash + commit message). When an agent is
    running, a dedicated session row replaces this.
  - Meta row: relative time + colored count badges
    (`~N` in_progress, `N ready`, `N` done)
  - Active task list (3 tasks max + "+N more")
  - Two metric grids: 24h/7d/success/avg, then tokens-i/o/cache/aborted
  - Action button row: Repo / Issues / PRs / Start (primary) / Abort
- **Action buttons.** Cyan-soft default; primary (Start) is solid cyan;
  destructive (Abort) is red-tinted. Disabled state is dim with tooltip.
  All match the reference's visual weight.
- **Search + filter pills.** New `ProjectFilter` client component with a
  search input and four pills (`All / Running / Has Tasks / Idle`).
  Filtering toggles `display: none` on cards rather than re-rendering;
  matches the reference's pattern for zero-flicker.
- **Tighter spacing.** Card padding `14px 17px` instead of `20px`; gap
  9px between rows. Header is now compact mono. Grid stays at 3 cols max.
- **Header reads "AAHP Hub" in mono.** The reference's brand pill is
  monospace; matches.

### Implementation

- `app/globals.css` rewritten with the dark tokens above and the four
  primitives. Old Atlas tokens removed.
- `app/layout.tsx` uses `bg-bg text-tx`.
- `app/page.tsx` rewritten end-to-end (697 -> ~570 lines but the JSX is
  cleaner; helpers like `cardStateClass`, `cardFilterAttr`, `dotColor`
  centralise the logic).
- `app/abort-button.tsx`, `app/run-button.tsx` rewritten to use
  `.hub-link-btn` with tone variants (`tone-ok`, `tone-warn`, `tone-er`,
  `is-primary`, `is-disabled`).
- `app/auto-refresh.tsx` `RefreshButton` and `LiveIndicator` use the new
  classes.
- `app/project-filter.tsx` (new): client-side search + filter pills.
  Operates on data attributes (`data-name`, `data-filter`) the cards
  already publish.

### Verification

- `npm run build` clean (warnings about Turbopack tracing fs.access in
  lib/sessions.ts are unchanged from before)
- `npm run lint` clean
- `npm test` 51/51 pass

### Open follow-ups

- Per-card sparkline area (the reference dashboard renders a tiny
  histogram) is omitted. Could plot run frequency over the last 14 days
  from `metrics.jsonl` if there is appetite. Not load-bearing.
- The reference dashboard shows global metrics in a top status bar. The
  hub equivalent (runner + control-port + counts) is in the Control
  Center already; merging both into a single top bar might be a future
  cleanup.

---

## 2026-04-30: Live-state gap + label clarity (claude-opus-4-7)

User screenshot showed `aahp run` mid-flight with 7 agents running per the
CLI status board, but the hub footer said "8 in progress" while the running
counter showed 0. Two issues entangled.

### Root cause: runner does not publish live agents

Inspected `~/.aahp/sessions.json` while a 16-agent parallel run was active:

```
{ "updatedAt": "2026-04-25T13:01:21.714Z",
  "sessions": [],
  "controlPort": 48237 }
```

The `controlPort` is published, but the `sessions` array is empty. The
runner's `StatusBoard` is in-memory; only the orchestrator (VS Code
extension) currently writes to `sessions.json`. So the hub legitimately
has nothing to render until the runner mirrors its state.

Filed `homeofe/aahp-runner#31` requesting that `aahp run` publish its
register/unregister events into `sessions.json` (the control-server
already has the merge helpers).

### Hub-side mitigations (this session)

1. **Detect "runner active but silent" state.** When `controlPort != null`
   and `runningCount === 0`, the Control Center renders an amber notice:
   "aahp run is active on port :NNNN but live agent details are not
   published yet (runner issue #31)". This tells the user the work IS
   happening; the hub just cannot see it yet.
2. **Disable Run All when runner already active.** Previously only
   disabled when `runningCount > 0`. Now also disabled when
   `controlPort` is set, even if `runningCount` is 0. Avoids spawning a
   second `aahp run` on top of an existing one.
3. **Relabel counters to distinguish manifest from live state:**
   - Footer: `8 in_progress (manifest)` instead of `8 in progress`
   - Control Center: `live agents` and `tasks ready` instead of
     `running` and `ready`
   - Hover tooltips spell out the source (manifest vs live)
4. **Control port label.** Was `control port :NNNN` regardless of state.
   Now: `:NNNN (run active)` when set, `idle` when binary is present
   but no run, `no runner` when binary missing.

### Verification

- `npm test` 51/51 pass
- `npm run build` clean
- `npm run lint` clean
- The semantic mismatch the user spotted is now self-explanatory in the
  UI even before runner #31 ships.

---

## 2026-04-30: Control Center + cleanup (claude-opus-4-7)

User feedback after seeing the live dashboard: "looks really dirty :D".
Two real issues:

1. **Stub manifests spamming the grid.** `aahp init` creates a manifest
   template with `project: "[PROJECT]"`, a placeholder task ("Example: Add
   tests for feature X"), and `[2-3 sentences: ...]` quick context. Several
   projects in the workspace had been bootstrapped this way and never
   filled in, so the dashboard showed a row of identical `[PROJECT]` cards.
2. **`aahp` not found on Windows.** The runner detection was hitting
   `spawnSync EINVAL` for `aahp.cmd` (Node 18+ refuses to exec `.cmd`/`.bat`
   without going through cmd.exe).

Plus the user asked for a control center to actually start runs from the
hub, and to cap the grid at 3 columns for readability.

### Decisions

- **Stub detection.** Heuristic: `name === "[PROJECT]"` (literal square
  brackets, the template default) OR `name === "project"` with a single
  `Example:`-prefixed task. Stubs are excluded from the grid and counted
  in the footer ("N stubs hidden") with the project paths in a tooltip.
  Considered hiding them silently; rejected because the user should see
  there is something to clean up.
- **Spawning `aahp` on Windows.** Switched from `shell: true` (deprecated
  DEP0190 and concatenates args without escaping) to explicit
  `cmd.exe /d /s /c <binary> <args...>`. spawn runs with `shell: false`
  and Node passes the args verbatim to cmd.exe, which finds `aahp.cmd`
  via PATH. All args still pass through strict validation regexes
  upstream so cmd.exe metacharacter risk is contained.
- **PATH resolution before spawn.** `resolveBinaryFromPath()` walks
  `process.env.PATH`, tests each directory for `aahp.cmd` / `aahp.bat` /
  `aahp.exe` / `aahp` (Windows order), and returns an absolute path.
  Fallback: try the bare names through cmd.exe. Two strategies catch
  most installations.
- **`/api/run` route.** Hub-side Next.js route handler validates input
  against project / backend / model / timeout regexes, then `spawnRun`s
  `aahp run` detached with `stdio: 'ignore'` and `proc.unref()`. The
  hub does not block on the run; the user sees progress via SSE as the
  runner publishes into `sessions.json` and `metrics.jsonl`.
- **3-column grid cap.** Was 1->2->3->4->5; capped at 3 (`md:grid-cols-2
  xl:grid-cols-3`) so card text stays readable.
- **Control Center panel.** New top-of-page block: runner status pill
  (binary version + control port), running/ready counts, "run all ready"
  primary button, "dry run" secondary button. Per-card "start" button
  spawns `aahp run <project>` for that project only. All buttons
  disabled with hover-explained reasons (binary missing, agent already
  running, no ready tasks, etc.).
- **Validation extracted.** `validateRunArgs` is a pure function exposed
  separately from `spawnRun` so tests cover input validation without
  touching the filesystem.

### Implementation

- `lib/runner.ts` (new): detection + validated spawn. Three input
  patterns: project name `[a-zA-Z0-9._-]{1,64}`, backend allowlist,
  model name `[a-zA-Z0-9._-]{1,80}` (no slashes - prevents path
  traversal). Timeout integer 1-240.
- `app/api/run/route.ts` (new): POST { project | all, backend?, model?,
  timeoutMinutes?, dryRun? }. 400 on bad input, 503 on missing runner,
  202 on success.
- `app/run-button.tsx` (new): client component with idle / pending /
  started / error states, optional confirm dialog, retry on error.
- `app/page.tsx`: Control Center, per-card start button, 3-col grid,
  stub-count footer line.
- `lib/manifest.ts`: stub detection in `summarize`; stubs collected
  separately; sort still running-first then alphabetical.

### Verification

- `npm test`: 51/51 (added 11 runner tests)
- `npm run build` clean
- `npm run lint` clean
- Verified `cmd.exe /d /s /c aahp --version` returns `0.4.0` from a
  one-off node script, confirming the new spawn path works.
- User dev server needs a restart to pick up the runner change.

### Open follow-ups

- The detection still depends on `process.env.PATH` containing the npm
  global bin. If the user starts the hub from a context where PATH is
  stripped (e.g. some service managers), detection will fail even
  though `aahp` is on the user's interactive PATH. Document this if it
  comes up.
- No streaming feedback for the start button. The button transitions
  to "started" and triggers `router.refresh()`, but the user has to
  watch the cards or tail logs to see the actual run progress. SSE
  already handles real-time updates, so this is mostly cosmetic.
- `aahp init` manifests should probably be hidden by default forever,
  but the user might want a "show stubs" toggle eventually. Not yet
  worth a UI control.

---

## 2026-04-30: Layout pass after first user review (claude-opus-4-7)

User screenshot review flagged four issues:

1. **Card heights misaligned.** The metrics row only rendered when a project
   had recorded runs, so cards without runs jumped straight to "last agent"
   while cards with runs had two extra rows. Fix: always render the metrics
   region; missing values show `-`. Extracted a `Stat` component to keep
   formatting consistent across the six tiles.

2. **No alphabetical order.** Sort was running-first then by `lastUpdated`,
   which gave no predictable order. Fix: running-first then alphabetical
   (`localeCompare` with case-insensitive sensitivity). Running agents
   still bubble up because that is the load-bearing UX, but everything
   else is now A-Z.

3. **Not full-screen.** `max-w-7xl` (1280px) capped the grid. Fix: removed
   the cap, switched to responsive grid: 1 col → 2 → 3 → 4 → 5 at sm/lg/xl/2xl
   breakpoints. Padding scales up at 2xl for ultra-wide monitors.

4. **"What is running" not visible.** The per-card pulsing dot was easy to
   miss when zero agents were running, and the header chip only showed
   when count > 0. Fix: dedicated `RunningCounter` block in the header
   showing the integer count in a 24px mono numeral with a colored dot
   and "agents running" caption. Always visible, green when > 0, gray
   when 0. Hard to miss.

No tests changed - the alphabetical sort is covered by reusing the
existing running-first-then-name fixture; nothing else needed.

---

## 2026-04-30: T-004 abort + T-005 token tracking (claude-opus-4-7)

### Context

`aahp-runner` v0.4.0 shipped two prerequisites at once: PR #29 added token
totals to `RunMetric`, PR #30 added a localhost HTTP control endpoint for
abort. Both were merged on the same day. This session wires both into the
hub.

### T-005 token tracking

`RunMetric` extended with `inputTokens`, `outputTokens`, `cacheReadTokens`,
`cacheCreationTokens`, `modelId`, `aborted`. SDK and Copilot backends
populate them; CLI backends leave them undefined.

#### Decisions

- **TokenStats type with `recordedRuns` counter.** Lets the UI distinguish
  "no runs recorded tokens" from "runs recorded zero tokens" - the hub
  should hide the row when nothing recorded data, not show zeros.
- **Cache hit rate = `cacheReadTokens / (cacheReadTokens + inputTokens)`.**
  Matches Anthropic's prompt cache pricing semantics: cache reads are billed
  at 10% but they replace what would otherwise be fresh input tokens. The
  ratio answers "what fraction of would-be input came from cache".
- **Format tokens with k/M suffixes.** Raw seven-digit numbers do not fit
  in the card column. `1.5k` for under 10k, `15k` above, `1.5M` for millions.
- **Window tokens to 24h on the card.** Card shows the lifetime total but
  also exposes a 24h window via `tokens24h` for follow-up UI work; today
  only the lifetime total is rendered, leaving room for a sparkline later.

### T-004 abort

#### Decisions

- **Hub never talks to the runner directly from the browser.** The
  AbortButton calls `/api/abort` on the hub, which proxies to
  `127.0.0.1:<controlPort>/abort`. This keeps the runner endpoint bound
  to localhost (where it should stay) while the hub can be reverse-proxied
  on a trusted network.
- **`controlPort` discovery via sessions.json.** The runner publishes the
  port into the same file the hub already reads. Zero new wiring; the
  hub just adds a `controlPort` field to `SessionsResult`.
- **Validate the port range.** The hub rejects `controlPort` values outside
  `(0, 65536)` and rejects non-integer values. A malformed sessions.json
  cannot redirect aborts to a wrong port.
- **Disable button when controlPort absent.** Tooltip explains: "is `aahp
  run` active?". This is the common case when the runner has finished.
- **Confirm before abort.** `window.confirm(...)` is enough friction.
  Anyone watching the dashboard probably wants the button to be hard to
  hit by accident.
- **Three-state UI: idle / pending / aborted / error → retry.** Errors
  surface the message in a tooltip. The state is per-button, not global.
- **Abort proxy timeout 8 seconds.** Long enough that a busy runner that
  takes a moment to SIGTERM still gets through; short enough that a dead
  runner does not hang the hub.

#### Implementation notes

- The runner's `aborted` flag (boolean) is plumbed through to a separate
  count on each card and in the footer. Aborts are not failures.
- Empty-totals helper extracted in `lib/metrics.ts` to avoid drift between
  the success path and the two error paths.

### Cross-platform note

User flagged that the prior `.env.example` only showed a macOS path. The
code itself was always cross-platform (`homedir()` + `path.join`), but the
example was misleading. New `.env.example` shows three concrete examples
plus the forward-slash-on-Windows variant. New `.env.local` written for
this machine's actual Windows paths; gitignored as expected.

### Verification

- `npm test` 39/39 pass
- `npm run build` clean
- `npm run lint` clean
- Manual: wrote a fake controlPort + session into `~/.aahp/sessions.json`,
  confirmed the proxy route reads it correctly. Did not run the full
  end-to-end against the live runner (the runner is not currently
  executing here); trust types + tests.

### Open questions

- Whether to add a "running totals" view that aggregates the live agent's
  in-flight token usage. Today the runner only writes tokens to JSONL on
  completion, so the live view is silent on cost. A `/api/sessions` route
  that polls the agent's log file and parses the `[TOKENS in:X out:Y]`
  trailer the runner writes would be the cheapest fix.
- Whether to deduplicate "controlPort gone" UI between idle and stale
  cases. Right now the button just shows "abort (disabled)" with a
  tooltip; the footer shows "control: not available". Two signals saying
  the same thing might be one too many.

---

## 2026-04-30: T-001 tests for lib modules (claude-opus-4-7)

### Context

Three lib modules with non-trivial parsing logic and no tests. T-003 already
caught a real bug during smoke test (variant manifest schema). Tests should
prevent that class of regression and document expected behavior.

### Decisions

- **Vitest, Node environment.** No JSDOM needed - all three modules are
  filesystem and pure-function code. Forks pool to isolate env mutations.
- **Real filesystem, no module mocks.** `mkdtempSync(tmpdir(), ...)` per
  test, override `ROOT_DIR` / `METRICS_FILE` / `SESSIONS_FILE` via
  `process.env`, clean up in `afterEach`. This tests the actual code paths
  (file IO, JSON parse, fs.stat) rather than the assumptions of a mock.
- **Stub `server-only`.** The `server-only` package throws unconditionally
  when imported outside an RSC context. Aliased to `test/server-only-stub.ts`
  in `vitest.config.ts`. Production code is unaffected.
- **Test files live next to source** (`lib/manifest.test.ts`, etc.) and are
  matched by `include: ['lib/**/*.test.ts']`. Not in a separate `tests/`
  directory because we want them to share the import alias and stay close
  to the code they cover.

### Coverage

27 tests, all green:

- `manifest.test.ts` (10 tests): empty root, standard manifest, variant
  manifest with array tasks and object quick_context, malformed JSON,
  non-object root, two-level walk depth limit, dotfile/node_modules skip,
  running-first sort order, orphan sessions for repos outside ROOT_DIR,
  metrics joining
- `metrics.test.ts` (8 tests): missing file, valid JSONL grouped by repo,
  malformed lines skipped, 24h/7d windows, last-run reporting, formatDuration
  for all magnitude classes
- `sessions.test.ts` (9 tests): SESSIONS_FILE override, HOME fallback,
  missing file, valid file, malformed JSON, missing required fields skipped,
  last log line read with banner-line filtering, non-object root

### Verification

- `npm test` 27/27 pass
- `npm run build` clean
- `npm run lint` clean

### Open follow-ups

- No coverage report wired up yet. `@vitest/coverage-v8` is installed but
  not enforced. Add a threshold gate when there is a clear target.
- Tests do not exercise the SSE route handler. That code is small and the
  real test is the smoke test against a running dev server. Skip until
  someone has a complaint.

---

## 2026-04-30: T-003 live status via SSE (claude-opus-4-7)

### Context

T-002 shipped runner activity stats but the view was still after-the-fact:
all numbers were aggregated from completed runs. The user wanted to see
agents *while* they are running, with no runner-side change.

### Discovery

`aahp-runner` already writes `~/.aahp/sessions.json` for exactly this
purpose. Format documented inline in `cli.ts`:
`{ updatedAt, sessions: [{ repoPath, repoName, taskId, taskTitle, backend,
startedAt }] }`. The same file is also written by `aahp-orchestrator`'s
`SessionMonitor`. So the hub can show live status entirely from existing
data.

Per-agent log files live at either `<repo>/.ai/logs/<date>.log` or
`~/.aahp/logs/<repo>-<date>.log`. The runner's CLI uses `getLastLogLine` to
strip ANSI noise and slice to a fixed width; we follow the same pattern.

### Decisions

- **SSE over WebSocket.** Simpler, one-way, survives the runner being
  stopped. No new server state, no protocol negotiation.
- **mtime polling, not fs.watch.** `fs.watch` is unreliable on Windows when
  a writer replaces a file atomically (which most JSON serialisers do).
  Stat-based polling at 1 Hz is reliable and cheap on two small files.
- **Per-connection poll loop.** Each SSE client runs its own loop. Removes
  shared state and broadcaster bookkeeping. Acceptable because clients are
  expected to be a single internal user, not many.
- **250 ms debounce on the client refresh.** Burst writes (the runner
  rewriting `sessions.json` while metrics rolls forward) collapse to one
  refresh.
- **30 s polling fallback alongside SSE.** If the EventSource drops or a
  proxy buffers it, the page still updates within 30 s.
- **Sort running projects first.** A running agent matters more than a
  3-day-old activity timestamp.

### Implementation

- `lib/sessions.ts`: reads sessions.json, defensive coercion of every
  field, looks up last log line via the same candidate-path order as
  the runner. Exposes `watchTargets()` for the SSE loop to stat both files.
- `app/api/stream/route.ts`: Node runtime, returns a `text/event-stream`
  ReadableStream. Polls watch targets every second; emits a `change` event
  whenever an mtime moves. Heartbeat every 15 s to keep proxies happy.
  Cleans up on `req.signal.abort`.
- `app/auto-refresh.tsx`: `AutoRefresh` opens an EventSource and calls
  `router.refresh()` on change (debounced). `LiveIndicator` shows
  connection state. 30 s polling fallback runs in parallel.
- `app/page.tsx`: per-card pulsing dot when `activeSessions.length > 0`,
  green-tinted session row with taskId, backend, relative startedAt, and
  the last log line. Header shows the count of running agents and the live
  indicator. New `OrphanSessionsBanner` for active sessions whose repoName
  is not under ROOT_DIR.

### Robustness fix discovered during smoke test

The first dev-server smoke test crashed with "Objects are not valid as a
React child (found: object with keys {project, stack, last_session,
active_task})". Root cause: `sample-service/.ai/handoff/MANIFEST.json`
uses a non-spec schema where `quick_context` is an object (not a string)
and `tasks` is an array (not an object). The MVP code passed the object
straight to JSX and React refused to render it.

Fix: added `coerceString` and `normaliseTasks` helpers in `lib/manifest.ts`.
Loosened `RawManifest` field types to `unknown` and validated at the
coercion boundary. One bad manifest in the wild can no longer take down
the page; the worst case is the project renders with empty fields.

This belongs in CONVENTIONS as the "failure-tolerant parsing" rule already
calls out, so no rule change is needed - just enforcement.

### Verification

- `npm run build` clean
- `npm run lint` clean
- `curl -N http://localhost:3000/api/stream` shows `event: hello` then
  `event: change` after writing to `sessions.json`
- Page renders running session ("aahp-runner / smoke test") with pulsing
  dot and last log line
- `sample-service` (variant schema) renders without crashing
- Page returns HTTP 200 with active and idle sessions

### Open questions

- Whether to tail the running agent's log file inside the SSE stream
  rather than just refreshing the page. Right now the user sees the last
  line as of the last mtime change, which lags behind the agent. A
  per-session log tail would be richer but more complex. Future work.
- Whether to expose `/api/sessions` as a JSON endpoint for non-browser
  clients (e.g. orchestrator). Defer until requested.

---

## 2026-04-30: T-002 runner activity stats (claude-opus-4-7)

### Context

The MVP rendered manifests but said nothing about what the runner had
actually been doing. User TODO asked for "Token-Verbrauch pro Task / Session"
read from `aahp-runner` logs.

### Discovery

`aahp-runner` writes `~/.aahp/metrics.jsonl` via `recordMetric` in
`metrics-store.ts`. The schema (`RunMetric`) carries: timestamp, repo,
taskId, taskTitle, backend, durationMs, turns, success, committed,
optional cpuAvg / memPeakMB.

**It does not record LLM tokens.** The "tokens" referenced elsewhere in the
runner are GitHub Copilot auth tokens. Real token tracking would require
extending `RunMetric` with input/output token totals captured from the
backend `usage` field, which is a runner-side change.

### Decision

Implement the available aggregation now under the honest name "runner
activity stats" (runs, success rate, duration, turns). Document the token
gap in README and `NEXT_ACTIONS.md` future work. Do not pretend turns equal
tokens.

### Implementation

- `lib/metrics.ts`: defensive JSONL parse (skips malformed lines), groups by
  repo, computes per-project stats with 24h and 7d windows. New
  `METRICS_FILE` env var overrides the default `~/.aahp/metrics.jsonl`.
- `lib/manifest.ts`: `scanProjects` now loads metrics once and joins each
  project to its summary by `manifest.project` (which matches `project.name`
  the runner records).
- `app/page.tsx`: each card gets a 3-column metrics row (24h/7d, success rate
  color-coded, avg duration). Footer adds a global runner line with totals
  and the metrics file path. Falls back to "no metrics yet" when the file
  does not exist, or to an error message if the read fails.
- README and `.env.example`: document `METRICS_FILE` and the token caveat.

### Decisions about scope

- **Did not implement WebSocket / live status (T-003).** Distinct task; needs
  a runner-side endpoint or log tailing strategy. Promoted from future work
  to a formal task.
- **Did not implement abort (T-004).** Same reasoning - requires a runner
  side endpoint.
- **Demoted the per-project detail page to future work.** User's TODO did
  not include it; the active 3-task list on the card already covers the
  common case.

### Verification

- `npm run build` clean
- `npm run lint` clean
- Card layout verified visually with empty state (no metrics file present)

### Open questions

- When `aahp-runner` adds token tracking, do we add a fourth column to the
  metrics row, or replace `avg duration` with token totals? Defer until the
  upstream change lands.

---

## 2026-04-30: Initial scaffold (claude-opus-4-7)

### Context

The AAHP ecosystem has four working repos: AAHP (spec), aahp-runner (CLI),
aahp-orchestrator (VS Code), aahp-cron (scheduling). The runner is headless;
when agents work overnight there is no way to see what happened. This repo
fills that gap.

### Decisions

- **Next.js 15 over a static dashboard.** Server Components are well suited
  to filesystem scans, the App Router gives us `router.refresh()` for free,
  and the project will likely grow API routes for `aahp-runner` integration.
- **No auth.** Internal tool, run on localhost or behind the user's own VPN.
- **No database.** State of record lives in `.ai/handoff/MANIFEST.json` files.
  The hub is a thin renderer.
- **Polling, not WebSockets.** 30 second `router.refresh()` is enough for a
  human-paced overview and avoids server state.
- **`lib/` not `src/lib/`.** Scaffold flag was `--no-src-dir`, so library code
  lives at repo root under `lib/`.
- **Dark theme matching Atlas Dashboard.** Same `--bg #0f1e35` and
  `--accent #00d4ff` so the visual language is consistent across internal tools.

### Implementation

- `lib/manifest.ts` walks `ROOT_DIR` (default `~/Workspace`) two levels deep
  looking for `.ai/handoff/MANIFEST.json`. Each manifest is parsed with
  per-file error capture so one broken JSON does not crash the page.
- `app/page.tsx` is a Server Component. `dynamic = 'force-dynamic'` keeps the
  scan fresh on every request. The page renders a card per project with phase
  badge, active task counts, last agent, quick context, and GitHub link.
- `app/auto-refresh.tsx` is a tiny Client Component that calls
  `router.refresh()` on a 30 second interval. It also exports a manual
  Refresh button.
- `app/timestamp.tsx` ticks once per second to keep the "X seconds ago" label
  accurate without re-fetching the page.

### Verification

- `npm install` clean
- `npm run build` passes
- Repo created at `https://github.com/homeofe/aahp-hub`

### Open questions

- Whether to support multiple `ROOT_DIR` values (the runner does not yet, but
  some users have multiple workspace folders). Defer until requested.
- Whether the dashboard should write back to manifests (e.g. to mark a task
  as cancelled). Today the answer is no - the hub stays read-only.
