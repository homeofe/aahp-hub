# LOG - aahp-hub

> Append-only journal of decisions, ADRs, and notable events.
> Newest entry on top. Older entries can be archived to `logs/LOG-YYYY-MM-DD.md`.

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
