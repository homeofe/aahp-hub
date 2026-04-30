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

### T-002: Aggregate token usage from aahp-runner metrics
- **Priority:** medium
- **Status:** ready
- **Why:** The whole point of the hub is visibility into what the headless
  runner has been spending. The runner already writes JSONL metrics via
  `metrics-store.ts`.
- **Done when:** Hub reads the runner's metrics file, sums tokens by project,
  and shows a "today / 7d" summary in each card.

### T-003: Per-project detail page
- **Priority:** low
- **Status:** ready
- **Why:** The card lists three active tasks but truncates the rest. Drill-down
  should render the full STATUS.md and recent LOG.md entries.
- **Done when:** `/projects/[name]` route exists, fetches the project's handoff
  files, and renders STATUS plus the last 5 LOG entries.

---

## Potential Future Work (not yet formal tasks)

| Area | Suggestion | Why |
|------|-----------|-----|
| Filtering | UI to filter by phase or hide done projects | Useful once project count grows |
| Sorting | Sort cards by project name, last activity, or task count | Currently sorted by last timestamp only |
| WebSocket | Replace polling with file-watcher push | Polling is fine for MVP, not for >50 projects |
| GitHub integration | Show open PRs from each project's repo | Closes the loop with `aahp-runner` PR creation |

---

## Recently Completed

| ID | Task | Resolution |
|----|------|-----------|
| - | Initial scaffold | Next.js 15, Tailwind v4, dark theme, scanner, dashboard MVP |
