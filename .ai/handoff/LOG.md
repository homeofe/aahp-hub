# LOG - aahp-hub

> Append-only journal of decisions, ADRs, and notable events.
> Newest entry on top. Older entries can be archived to `logs/LOG-YYYY-MM-DD.md`.

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
active_task})". Root cause: `elvatis-defense/.ai/handoff/MANIFEST.json`
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
- `elvatis-defense` (variant schema) renders without crashing
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
