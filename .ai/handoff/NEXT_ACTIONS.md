# NEXT_ACTIONS - aahp-hub

> Priority order. Work top-down.
> Each item is self-contained - agent can start without asking questions.

---

## Active Tasks

None. All five formal tasks (T-001 tests, T-002 metrics, T-003 live status,
T-004 abort, T-005 token tracking) are done. The hub-side roadmap from the
original user TODO is complete.

---

## Potential Future Work (not yet formal tasks)

| Area | Suggestion | Why |
|------|-----------|-----|
| Filtering | UI to filter by phase or hide done projects | Useful once project count grows |
| Sorting | Sort by project name, last activity, or token spend | Currently sort puts running agents first, then by last timestamp |
| Detail page | `/projects/[name]` with full STATUS.md and recent LOG entries | Card truncates to 3 active tasks |
| GitHub integration | Show open PRs from each project's repo | Closes the loop with `aahp-runner` PR creation |
| Per-session log tail | Stream the running agent's full log, not just the last line | Higher fidelity than a single line; needs a log-tailing route handler |
| Token cost in dollars | Multiply tokens by per-model pricing | Modelled after the runner's `modelId`; needs a price table that ages well |
| API endpoint | `/api/sessions` JSON for non-browser clients | Defer until requested |
| Bulk abort | Abort all running agents in one click | Useful when something is misbehaving across the workspace |
| Cross-host runners | Hub talks to multiple runners on different machines | Today the abort proxy is hardcoded to 127.0.0.1 |

---

## Recently Completed

| ID | Task | Resolution |
|----|------|-----------|
| T-005 | Token tracking | aahp-runner v0.4.0 records `inputTokens`/`outputTokens`/`cacheReadTokens`/`cacheCreationTokens`/`modelId`. Hub renders per-card input/output totals and a cache hit rate; footer shows totals + cache rate across all projects. |
| T-004 | Abort function | aahp-runner v0.4.0 exposes `POST /abort` on `127.0.0.1:<controlPort>` with the port published in `~/.aahp/sessions.json`. Hub adds `app/api/abort` proxy and an Abort button per running-session row. Disabled when controlPort is absent. |
| T-001 | Tests | 39 vitest tests across the three lib modules |
| T-003 | Live status of running agents | SSE route at `/api/stream` watches `sessions.json` and `metrics.jsonl` mtime |
| T-002 | Aggregate runner activity stats | `lib/metrics.ts` reads `~/.aahp/metrics.jsonl` |
| - | Initial scaffold | Next.js 15, Tailwind v4, dark theme, scanner, dashboard MVP |
