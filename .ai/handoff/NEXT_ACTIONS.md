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
| Branch protection | Decide which checks become REQUIRED on `main`. Today there are none: `Lint, test and build`, `AAHP Verify` and `Supply Chain Guard` all merely report | Protection on `main` currently covers admin enforcement, force pushes and deletion only, so a red check does not stop a merge. Needs an owner decision, not a code change |
| Doc accuracy | Correct the header comment in `.github/workflows/aahp-verify.yml`, which calls that job "the intended REQUIRED status check" and says it "stays a REQUIRED check" | It is not required today, and this repository is public; a claim of enforcement that does not exist is worse than the gap |
| CI status | Add a workflow-run column (last conclusion per default branch) to the fleet board | The board covers issues, PRs, alerts and drift; a red pipeline is the remaining daily signal |
| Forgejo | Read issue and PR counts for projects on forge.internal.example | Today they render as not-applicable, which is honest but empty |
| Fetch prompt | Offer a one-click `git fetch` for checkouts flagged as behind | Drift is detected but the fix is still manual, and fetching must stay an explicit user action |
| Per-session log tail | Stream the running agent's full log, not just the last line | Higher fidelity than a single line; needs a log-tailing route handler |
| Token cost in dollars | Multiply tokens by per-model pricing | Modelled after the runner's `modelId`; needs a price table that ages well |
| API endpoint | `/api/sessions` JSON for non-browser clients | Defer until requested |
| Bulk abort | Abort all running agents in one click | Useful when something is misbehaving across the workspace |
| Cross-host runners | Hub talks to multiple runners on different machines | Today the abort proxy is hardcoded to 127.0.0.1 |

---

## Recently Completed

| ID | Task | Resolution |
|----|------|-----------|
| - | Verify the hub tolerates additive AAHP CLI record fields | It does, and it cannot do otherwise: the hub has no reader for the `aahp check --json` or `aahp doctor --json` record (the AAHP Verify workflow consumes the doctor exit code, not the payload), and its four real readers are structural with no JSON Schema in the path. `lib/forward-compat.test.ts` pins that property across all four ingests so a future strict validator cannot reintroduce the risk. |
| - | Daily project overview | Fleet board with issues, pull requests (open/merged/closed-without-merge), open Dependabot alerts and checkout drift per project. Repository mapping from the git origin remote; data via the `gh` CLI in one batched GraphQL query, TTL cached and persisted. |
| - | Filtering and sorting | Name search, phase filter, status pills, active/archived/not-on-GitHub segments and a "needs attention" sort, all in the fleet board. |
| - | Detail page | `/projects/[projectId]` exists and now carries a Repository section with the same honest counts. |
| - | Remove fabricated tooling panel | `lib/tooling.ts` returned eleven hardcoded models with invented statuses. Deleted rather than faked. |
| T-005 | Token tracking | aahp-runner v0.4.0 records `inputTokens`/`outputTokens`/`cacheReadTokens`/`cacheCreationTokens`/`modelId`. Hub renders per-card input/output totals and a cache hit rate; footer shows totals + cache rate across all projects. |
| T-004 | Abort function | aahp-runner v0.4.0 exposes `POST /abort` on `127.0.0.1:<controlPort>` with the port published in `~/.aahp/sessions.json`. Hub adds `app/api/abort` proxy and an Abort button per running-session row. Disabled when controlPort is absent. |
| T-001 | Tests | 39 vitest tests across the three lib modules |
| T-003 | Live status of running agents | SSE route at `/api/stream` watches `sessions.json` and `metrics.jsonl` mtime |
| T-002 | Aggregate runner activity stats | `lib/metrics.ts` reads `~/.aahp/metrics.jsonl` |
| - | Initial scaffold | Next.js 15, Tailwind v4, dark theme, scanner, dashboard MVP |
