# NEXT_ACTIONS - aahp-hub

> Priority order. Work top-down.
> Each item is self-contained - agent can start without asking questions.

---

## Active Tasks

### T-001: Add unit tests for scanProjects
- **Priority:** medium
- **Status:** ready
- **Why:** Scanner is the only non-trivial logic in the MVP. Walking, parsing,
  and error capture should be covered before the surface area grows.
- **Done when:** Vitest suite covers root resolution, two-level walk, valid
  manifest parsing, malformed JSON, and missing ROOT_DIR.

### T-002: Aggregate runner activity stats per project
- **Priority:** high
- **Status:** ready
- **Why:** The hub exists to show what the headless runner has been spending.
  `aahp-runner` writes a JSONL to `~/.aahp/metrics.jsonl` via `recordMetric`
  (`metrics-store.ts`). One line per agent run with repo, taskId, backend,
  durationMs, turns, success, committed.
- **Note on tokens:** the runner does NOT currently record LLM token counts.
  `RunMetric` has `turns` but no input/output token totals. Showing real
  token usage requires a runner-side change first (extend `RunMetric` and
  capture `usage` from each backend response). Until then, the hub aggregates
  what is actually available: runs, success rate, duration, turns.
- **Done when:** Each card shows runs in the last 24h and 7d, success rate,
  average duration, and last run timestamp. Footer shows totals across all
  projects.

### T-003: Live status of running agents (WebSocket or SSE)
- **Priority:** medium
- **Status:** ready
- **Why:** 30s polling is fine for the post-mortem view but blind to the
  current run. The runner already streams to a `StatusBoard` (`status-board.ts`)
  and writes per-agent log files. The hub should subscribe to those updates
  rather than re-reading manifests.
- **Done when:** Card highlights running agents in real time (sub-second).
  Mechanism is either SSE from a Next.js route handler that tails the runner's
  log files, or a small WebSocket bridge in `aahp-runner`. Choose SSE first;
  it is simpler and survives the runner being stopped.

### T-004: Abort function for running agents
- **Priority:** medium
- **Status:** ready
- **Why:** When an agent is burning tokens on the wrong path there is currently
  no way to stop it from the hub. Users SSH to the runner and kill the process.
- **Done when:** Each running-agent row has an Abort button. Pressing it sends
  a signal to the runner (HTTP endpoint or named pipe), which the runner
  handles by terminating the agent's child process and recording an aborted
  metric. Requires a small runner-side endpoint; document it in the runner
  repo.

---

## Potential Future Work (not yet formal tasks)

| Area | Suggestion | Why |
|------|-----------|-----|
| Filtering | UI to filter by phase or hide done projects | Useful once project count grows |
| Sorting | Sort cards by project name, last activity, or task count | Currently sorted by last timestamp only |
| Detail page | `/projects/[name]` with full STATUS.md and recent LOG entries | Card truncates to 3 active tasks |
| GitHub integration | Show open PRs from each project's repo | Closes the loop with `aahp-runner` PR creation |
| Token tracking (runner-side) | Extend `RunMetric` with input/output tokens captured from backend `usage` | Prerequisite for real token cost view |

---

## Recently Completed

| ID | Task | Resolution |
|----|------|-----------|
| - | Initial scaffold | Next.js 15, Tailwind v4, dark theme, scanner, dashboard MVP |
