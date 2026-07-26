> Note (2026-07-26, claude-opus-5): Added .github/workflows/ci.yml, the first CI job in this repository that runs the application's own checks: `npm run lint --max-warnings=0`, `npm test`, `npm run build` and `tsc --noEmit`, on push to main and on every pull request. Until now the only two workflows were AAHP Verify (handoff-state integrity) and Supply Chain Guard (dependency risk); neither compiles, type-checks or executes lib/ or app/, so a change that broke the Vitest suite still reported two green checks. IMPORTANT AND OFTEN MISSTATED: this job REPORTS, it does not block. `main` has no required status checks at all, not this one and not the other two; branch protection there covers admin enforcement, force pushes and deletion only. Making any check required is a separate decision for the repository owner and is listed in NEXT_ACTIONS.md. vitest.config.ts no longer scopes the suite to `lib/**/*.test.ts`: the run set is identical today because every test file lives in lib/, but a test added elsewhere would have been skipped under a green check. The type check runs after the build on purpose: Next.js generates the route helper types (PageProps and friends) into .next/types and next-env.d.ts during the build, and tsconfig.json includes those generated files, so a bare `tsc --noEmit` on a fresh checkout fails with "Cannot find name 'PageProps'" for a reason that has nothing to do with the code. All steps are green on this branch (run 30193724486: 14 test files, 195 tests). The gate was proven to bite twice: once on a push event with a regression in the manifest parser (run 30193587435), and once on a pull_request event with the failing test placed outside lib/, which also proves the widened include glob (run 30195092609). Both scratch branches were deleted.

> Note (2026-07-25, claude-opus-5): Pinned the forward compatibility of every record ingest path in `lib/forward-compat.test.ts`. AAHP v3.8.0 added two additive top-level fields to its CLI records (`command` on the check record, `mode` on the governance doctor record, both still `schemaVersion: 1`) and it was unverified whether this hub rejects a record carrying an unknown top-level key. It does not, and it cannot: the hub has no reader for either record (the AAHP Verify workflow runs `aahp doctor . --json` as a gate step and consumes only the exit code), and all four readers it does have (`lib/manifest.ts`, `lib/metrics.ts`, `lib/sessions.ts`, `lib/posture.ts`) read records structurally with no JSON Schema and no `additionalProperties: false` in the path. Five new tests run each ingest twice, baseline versus baseline-plus-additive-keys, and assert the result is unchanged; the manifest case was verified to go red when a strict allowlist was temporarily added to the parser. Test only, no behaviour change: 200 tests pass, build and lint clean.
> Note (2026-07-25, claude-opus-4-8): Renamed the design-token CSS class prefix from a legacy prefix to `hub-` so the stylesheet vocabulary matches this project. `.hub-card`, `.hub-link-btn`, `.hub-chip`, `.hub-pill` and `.hub-section-title` in app/globals.css and every consuming component under app/ were updated together; the change is a pure identifier rename with byte-for-byte identical rendered styling (64 lines changed, 64 in each direction). The optional MCP tooling passages in .claude/commands/review-cycle.md, .claude/commands/route.md, .claude/rules/multi-model.md, .llm/PROVIDERS.md and .llm/ROUTING.md now describe the capability generically ("the configured MCP provider") instead of naming one specific implementation, and the historical LOG.md design entries describe the visual reference on its own terms. All 195 tests still pass.
> Note (2026-07-25, claude-opus-5): Turned the dashboard into a daily project overview. The card grid is now a compact fleet board (app/fleet-board.tsx) with per-project open/closed issues, open/merged/closed-without-merge pull requests, open Dependabot alerts and local checkout drift. Repository data comes from the `gh` CLI through one aliased GraphQL document per batch (lib/github-stats.ts), TTL cached and persisted (lib/github-cache.ts); no GITHUB_TOKEN variable exists anywhere in the repo. Projects are mapped to repositories by their git origin remote (lib/git-remote.ts, lib/checkout.ts), so directory-name drift and the forge.internal.example Forgejo migrations resolve correctly and render as not-applicable instead of zeros. REMOVED lib/tooling.ts and app/tooling-panel.tsx: they rendered a hardcoded list of eleven models with invented online/standby statuses on a dashboard used for decisions. app/project-filter.tsx and app/project-overview-card.tsx were folded into the fleet board.
> Note (2026-07-25, claude-opus-4-8): Test fixtures, the multi-model rule doc and the routing doc now use neutral placeholder identifiers (acme/sample-service style) instead of environment-specific names, so the public tree carries no deployment-specific vocabulary. Behaviour is unchanged; all 195 tests still pass.

> Note (2026-07-19, claude-opus-4-8): Aligned the AAHP v3.8.0 conformance PR (#13) with its code review. Corrected the false "GitHub Actions is OFF org-wide (cost sweep)" claim in aahp-verify.yml and the PR body (homeofe Actions is ON). Restored the MANIFEST "project" field to "aahp-hub" (the CLI regen had rewritten it to the temp working-directory name). Rejected the two Gemini inline suggestions (GROUNDING.md Section 5 schema wording, WORKFLOW.md install-hooks command) because they target canonical AAHP v3.8.0 template files that are copied verbatim from @elvatis_com/aahp; editing them per-repo would fork the canonical and churn on the next tooling run. Re-ran the CLI manifest regen and verify (Layer 1 checksums refreshed).

> Note (2026-07-18, claude-opus-4-8): Adopted CLI-based AAHP v3.8.0 conformance. Removed the vendored gate scripts (scripts/_aahp-lib.sh, aahp-manifest.sh, lint-handoff.sh, verify-handoff.sh, install-hooks.sh, verify-hooks.sh, scripts/hooks/pre-commit, scripts/hooks/pre-push) in favor of the pinned @elvatis_com/aahp CLI (exact 3.8.0 in devDependencies). Added the Grounded Reflection Layer (GROUNDING.md + a TRUST.md Provenance column), aahp.config.json (pinned-dep gate + em-dash forbidden pattern), and rewired .github/workflows/aahp-verify.yml to run `npx --no-install aahp verify/doctor` instead of the vendored verify-handoff.sh. scripts/validate-pii-allowlist.py (repo-specific) kept.

> Note (2026-07-14, claude-opus-4-8): Synced the canonical AAHP gate scripts from homeofe/improvements (v3.5.0 fixes: aahp-manifest.sh --phase documentation + cross_repo_ref preservation, lint-handoff.sh SC2034), AAHP_HANDOFF_FILES preserved, and refreshed the local hook tooling (scripts/hooks/, install-hooks.sh, verify-hooks.sh). Fleet re-sync.

> Note (2026-07-14, claude-opus-4-8): Synced the canonical Layer 3 tolerance fix from homeofe/improvements. verify-handoff.sh now downgrades a non-ancestor MANIFEST.last_session.commit from FAIL to WARN so a squash-merge or rebase-merge no longer trips AAHP Verify Layer 3 on main; Layers 1-2 still gate real staleness.

﻿# aahp-hub: Current State of the Nation

> Note (2026-07-12, claude-opus-4-8): synced canonical AAHP gate scripts from homeofe/improvements (adds the realpath-relative PII validator invocation that fixes the Windows/MSYS artifact; AAHP_HANDOFF_FILES preserved).

> Last updated: 2026-06-28 by claude-opus-4-8
> Commit: T-004 + T-005 done; access-control hardening (this session)
>
> Security hardening (2026-06-28, found by an aahp-swarm review): the mutating
> routes /api/run (spawns `aahp run`) and /api/abort were unauthenticated, and
> /api/stream leaked absolute home paths. Added lib/guard.ts `guardMutation`
> (same-origin/CSRF check + an optional AAHP_HUB_TOKEN shared secret compared via
> hashed timingSafeEqual) on both POST routes, lib/redact.ts `redactHome` applied
> to the SSE stream and the /api/run command echo, and bound `next dev`/`next
> start` to 127.0.0.1. AAHP_HUB_TOKEN is off by default so the bundled UI works
> token-free locally; set it for headless API clients or shared hosts. The
> server-rendered pages (app/sessions/page.tsx, app/page.tsx) now also apply
> redactHome at every absolute-path render site (sessionsFile, repoPath, rootDir,
> metricsFile, error paths, stub-path titles), so the UI no longer prints the home
> directory or OS username; React keys keep the real path (never emitted to HTML).
>
> **Rule:** This file is rewritten (not appended) at the end of every session.
> It reflects the *current* reality, not history. History lives in LOG.md.

---

<!-- SECTION: summary -->
## Summary

aahp-hub v0.1.0 - web dashboard for the AAHP runner ecosystem. All five
formal tasks done. The hub now consumes everything the runner v0.4.0
exposes: token totals, cache hit rate, aborted-run flag, and the
`controlPort` for abort. The Abort button proxies through `app/api/abort`
to the runner's localhost endpoint. The hub stays a thin renderer: no DB,
no direct cross-host networking. Mutating routes are now gated by a
same-origin check plus an optional shared-secret token, and the server
binds loopback only.

The overview is a per-project fleet board. Local handoff state renders
immediately; repository counts (issues, pull requests split into
open/merged/closed-without-merge, open Dependabot alerts) and local
checkout drift arrive asynchronously from `/api/fleet`. Repository access
runs through the `gh` CLI, which supplies its own credentials, so the hub
holds no token and defines no token environment variable. Every value
distinguishes not-applicable, not-yet-fetched and a real zero, and a failed
refresh keeps the last good values with a staleness marker instead of
falling back to zeros.
<!-- /SECTION: summary -->

---

<!-- SECTION: build_health -->
## Build Health

| Check | Result | Notes |
|-------|--------|-------|
| `npm install` | (Verified) | next 16.2.11, vitest 4.1.5 |
| `npm run build` | (Verified) | Clean - 2026-07-25 (no NFT trace warning) |
| `npm run lint` | (Verified) | Clean - 2026-07-25 |
| `npm run test` | (Verified) | 195 tests across 14 suites pass - 2026-07-25 |
| `/api/fleet` live smoke | (Verified) | 2026-07-25 on port 3457: 49/49 repositories answered, 2 rate-limit points, 34 active / 15 archived / 4 not-applicable |
| `/api/stream` smoke test | (Verified) | hello + change events fire on sessions.json mtime |
| Cross-platform paths | (Verified) | Code uses `homedir()` and `path.join`; `.env.example` documents macOS/Linux/Windows examples |
<!-- /SECTION: build_health -->

---

<!-- SECTION: components -->
## Components

| Component | Path | State | Notes |
|-----------|------|-------|-------|
| Manifest scanner | `lib/manifest.ts` | (Verified) | Defensive coercion; sorts running projects first |
| Metrics loader | `lib/metrics.ts` | (Verified) | JSONL parse, 24h/7d windows, token aggregation, cache hit rate, formatTokens helper |
| Sessions loader | `lib/sessions.ts` | (Verified) | Reads sessions.json incl. controlPort; readControlPort() helper |
| SSE endpoint | `app/api/stream/route.ts` | (Verified) | mtime poll on sessions.json + metrics.jsonl |
| Abort proxy | `app/api/abort/route.ts` | (Verified) | Forwards POST to 127.0.0.1:<controlPort>/abort with timeout, error mapping |
| Dashboard page | `app/page.tsx` | (Verified) | Force-dynamic; token row, abort button per session, control footer chip |
| Abort button | `app/abort-button.tsx` | (Verified) | Confirm dialog, pending/aborted/error states, retry |
| Auto-refresh / Live indicator | `app/auto-refresh.tsx` | (Verified) | EventSource + 30s polling fallback |
| Remote mapping | `lib/git-remote.ts` | (Verified) | Pure parsers for origin URLs and .git/config; strict owner/name validation before any GraphQL use |
| Checkout state | `lib/checkout.ts` | (Verified) | Reads .git/config off disk, `git --no-optional-locks status --porcelain=v2`, FETCH_HEAD mtime; never fetches or writes |
| Process runner | `lib/exec.ts` | (Verified) | argv-array spawn, no shell, stdin + timeout + output cap |
| GitHub data layer | `lib/github-stats.ts` | (Verified) | One aliased GraphQL document per batch through `gh api graphql --input -`; OPEN/CLOSED/MERGED PRs queried separately; injectable runner for offline tests |
| GitHub cache | `lib/github-cache.ts` | (Verified) | TTL + disk persistence + in-flight dedup; keeps last good values on failure |
| Fleet join | `lib/fleet.ts` | (Verified) | Joins handoff, checkout and GitHub into one row per project with attention ranking |
| Fleet API | `app/api/fleet/route.ts` | (Verified) | GET, `?refresh=1` forces a live query |
| Fleet board | `app/fleet-board.tsx` | (Verified) | Client component; segments, filters, sorting, freshness bar, three-state cells |
| Project repository panel | `app/project-repository-panel.tsx` | (Verified) | Same data on the project page |
| Tests | `lib/*.test.ts` | (Verified) | 195 tests: remote mapping, merged-vs-closed handling, cache/TTL, gh degradation, partial GraphQL errors |
<!-- /SECTION: components -->

---

<!-- SECTION: dependencies -->
## Dependencies (current)

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 16.2.4 | App Router |
| `react` | 19.2.4 | |
| `react-dom` | 19.2.4 | |
| `tailwindcss` | ^4 | CSS-first config |
| `@tailwindcss/postcss` | ^4 | |
| `typescript` | ^5 | strict mode |
| `server-only` | ^0.0.1 | Aliased to stub in vitest |
| `vitest` | ^4.1.5 | Test runner |
| `@vitest/coverage-v8` | ^4.1.5 | Coverage reporter (not enforced yet) |
<!-- /SECTION: dependencies -->

---

<!-- SECTION: what_is_missing -->
## What is Missing

| Gap | Severity | Description |
|-----|----------|-------------|
| Auth | (deferred) | Internal tool only, intentionally none |
| Multi-host runners | LOW | Abort proxy is localhost-only by design |
| Token cost in $ | LOW | Tokens are tracked; pricing table is a separate concern |
| Non-GitHub forges | LOW | Projects on the self-hosted Forgejo (forge.internal.example) render as not-applicable. Wiring the Forgejo API would need its own credential story; deliberately out of scope here. |
| CI status per project | LOW | The board covers issues, pull requests, alerts and drift; workflow run status is a natural next column |
<!-- /SECTION: what_is_missing -->

---

<!-- SECTION: resolved_this_session -->
## Resolved This Session (2026-07-25)

| Item | Resolution |
|------|-----------|
| Thin overview | Card grid replaced by a compact fleet board with repository and checkout columns, sorted by what needs attention |
| Fabricated tooling panel | `lib/tooling.ts` and `app/tooling-panel.tsx` deleted. They rendered eleven hardcoded models with invented online/standby statuses; nothing measured them |
| Repository mapping | Derived from the git origin remote, not the directory name. Forgejo-migrated and remote-less projects render as not-applicable |
| Merged vs closed pull requests | OPEN, MERGED and CLOSED queried and shown as three separate numbers, with the semantics stated in the UI |
| Credentials | `gh` CLI only. No token env var, no PAT prompt, no token in memory |
| Staleness | Local checkout drift, GitHub fetch time and handoff mtime are all first-class columns |

### Earlier session (2026-04-30)

| Item | Resolution |
|------|-----------|
| T-005 token tracking | `lib/metrics.ts` extended with `TokenStats`, 24h windowing, cache hit rate; cards + footer render the new fields |
| T-004 abort | `app/api/abort/route.ts` proxies to runner's `/abort`; `lib/sessions.ts` exposes `controlPort`; `AbortButton` client component handles confirm + state machine |
| Aborted-run distinction | `RunMetric.aborted` plumbed through; counted separately on cards and in the footer |
| Cross-platform `.env.example` | Replaced macOS-only example with explicit macOS/Linux/Windows examples plus a forward-slash variant note |
| Local `.env.local` | Created for the user's Windows setup (`C:\Users\dev\Workspace` etc.); gitignored |
| Test coverage | +12 tests for token aggregation, format helpers, controlPort parsing, aborted runs |
<!-- /SECTION: resolved_this_session -->

<!-- aahp-gate -->
_AAHP verify gate: v3.0.2 synced 2026-06-20._

> 2026-06-21 install-hooks.sh: Windows drive-letter path fix propagated from AAHP.

> 2026-06-21 ci: add supply-chain-guard v5.2.35 Action workflow (fail-on critical).

> 2026-06-21 ci(aahp): fix unquoted next_task_id + lint-handoff noreply@ PII exclusion.

> 2026-06-27 ci: re-pin supply-chain-guard to v5.2.37 (be1d718b17cc38e4bce7fa48579b7112e557943b) and enable Dependabot github-actions weekly updates.

> 2026-06-27 docs(readme): add AAHP Verify + Supply Chain Guard status badges near the top of README.md (only workflows that exist in .github/workflows/).

> 2026-06-28 docs: add community health files (LICENSE Apache-2.0, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, .github issue/PR templates) to align with the other AAHP repos; declare "license": "Apache-2.0" in package.json.

> 2026-06-30 feat(verify): added reviewed expiring PII allowlist, rolled out from AAHP v3.2.0.

> 2026-06-30 ci: exempt Dependabot from the aahp-verify handoff gate (keep supply-chain-guard/codeql/build).
- 2026-07-03: ci: supply-chain-guard now tracks the moving @v5 release branch instead of a stale SHA pin (owner rule: consumers pin @v5, the release workflow moves it - currently v5.6.1). Ends the recurring stale/broken-pin churn (v5.2.35 crash wave). Config change only.
- 2026-07-03: security: cleared all open GitHub Dependabot alerts for this repo (dependency range raises + exact-range lockfile overrides for transitives; no forced majors beyond what the advisories require). Verified locally: package-manager audit reports 0 open advisories, build and tests green. Estate-wide burn-down, executed by a per-repo agent + centrally reviewed and committed.
- 2026-07-24: security & ui: resolved security advisories (sharp ^0.35.3, js-yaml ^4.3.0, brace-expansion ^2.1.2 overrides, next ^16.2.11 bump; 0 open advisories), merged Dependabot PR #12 (actions/setup-node@v7), enabled main branch protection on GitHub repo, implemented Issue #8 (estate dependency posture & update cadence with lib/posture.ts, fixture tests lib/posture.test.ts, and /posture dashboard page), redesigned WebUI with Navy design system (#070c1e, #00b4d8 cyan, #6d47f0 indigo, #0ea97d emerald), added Executive Morning Briefing component with interactive clickable tickers (app/morning-briefing.tsx), added Intelligence & Tooling Panel for LLMs and MCP servers (lib/tooling.ts, app/tooling-panel.tsx), added project sorting and URL filter query param integration (app/project-filter.tsx), added expandable project tree view in navigation sidebar (app/sidebar.tsx, app/api/projects/route.ts), fixed Supply Chain Guard false missing status in lib/posture.ts, created GitHub Issues #15 and #16, and verified 68/68 tests pass and 0 build errors.

> Note (2026-07-19): Re-pinned @elvatis_com/aahp from 3.8.0 to 3.8.1 (picks up the v3.8.1 Windows/MSYS manifest-regen fix so tasks, next_task_id and cross_repo_ref survive regeneration). No runtime behavior change on Linux or CI. Handoff refreshed and MANIFEST regenerated.
