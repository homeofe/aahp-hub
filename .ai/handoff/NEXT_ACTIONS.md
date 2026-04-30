# NEXT_ACTIONS - aahp-hub

> Priority order. Work top-down.
> Each item is self-contained - agent can start without asking questions.

---

## Active Tasks

### T-004: Abort function for running agents
- **Priority:** medium
- **Status:** ready
- **Depends on:** runner-side endpoint
- **Why:** When an agent is burning tokens on the wrong path there is no way
  to stop it from the hub.
- **Done when:** Each running-agent row has an Abort button. Pressing it sends
  a signal to the runner (HTTP endpoint or named pipe), which the runner
  handles by terminating the agent's child process and recording an aborted
  metric. Requires a small runner-side endpoint; document it in
  `homeofe/aahp-runner` first.

### T-005: Token tracking (runner-side prerequisite)
- **Priority:** medium
- **Status:** ready
- **Depends on:** `homeofe/aahp-runner` change
- **Why:** Today the hub shows `turns` and `durationMs`; users want token
  spend per task. The runner does not capture token totals from the backends.
- **Done when:** `aahp-runner`'s `RunMetric` carries `inputTokens` /
  `outputTokens` populated from the backend `usage` field. Hub adds a token
  column to the per-card metrics row and a token total to the global footer.
  Track the runner-side change as an issue on `homeofe/aahp-runner`, not
  here.

---

## Potential Future Work (not yet formal tasks)

| Area | Suggestion | Why |
|------|-----------|-----|
| Filtering | UI to filter by phase or hide done projects | Useful once project count grows |
| Sorting | Sort cards by project name, last activity, or task count | Currently sort puts running agents first, then by last timestamp |
| Detail page | `/projects/[name]` with full STATUS.md and recent LOG entries | Card truncates to 3 active tasks |
| GitHub integration | Show open PRs from each project's repo | Closes the loop with `aahp-runner` PR creation |
| Per-session log tail | Stream the running agent's full log, not just the last line | Higher fidelity than a single line; needs a log-tailing route handler |
| API endpoint | `/api/sessions` JSON for non-browser clients | Defer until requested |

---

## Recently Completed

| ID | Task | Resolution |
|----|------|-----------|
| T-001 | Tests for scanProjects, loadMetrics, loadSessions | Vitest added, 27 tests across 3 suites covering schema-variant manifests, JSONL malformed lines, log line lookup, missing files. `server-only` aliased to a stub. |
| T-003 | Live status of running agents | SSE route at `/api/stream` watches `sessions.json` and `metrics.jsonl` mtime; client subscribes and triggers `router.refresh()` on change. Cards get a pulsing dot and a session row when an agent is running. Live / offline indicator in header. |
| T-002 | Aggregate runner activity stats | `lib/metrics.ts` reads `~/.aahp/metrics.jsonl` and renders 24h/7d/success/avg-duration per card. |
| - | Initial scaffold | Next.js 15, Tailwind v4, dark theme, scanner, dashboard MVP |
