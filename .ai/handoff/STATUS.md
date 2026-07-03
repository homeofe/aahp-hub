# aahp-hub: Current State of the Nation

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
<!-- /SECTION: summary -->

---

<!-- SECTION: build_health -->
## Build Health

| Check | Result | Notes |
|-------|--------|-------|
| `npm install` | (Verified) | next 16.2.4, vitest 4.1.5 |
| `npm run build` | (Verified) | Clean - 2026-04-30 |
| `npm run lint` | (Verified) | Clean - 2026-04-30 |
| `npm run test` | (Verified) | 39 tests across 3 suites pass - 2026-04-30 |
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
| Tests | `lib/*.test.ts` | (Verified) | 39 tests covering tokens, controlPort, aborted flag, schema variants |
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
| Detail page | LOW | Cards are concise enough for now |
<!-- /SECTION: what_is_missing -->

---

<!-- SECTION: resolved_this_session -->
## Resolved This Session (2026-04-30)

| Item | Resolution |
|------|-----------|
| T-005 token tracking | `lib/metrics.ts` extended with `TokenStats`, 24h windowing, cache hit rate; cards + footer render the new fields |
| T-004 abort | `app/api/abort/route.ts` proxies to runner's `/abort`; `lib/sessions.ts` exposes `controlPort`; `AbortButton` client component handles confirm + state machine |
| Aborted-run distinction | `RunMetric.aborted` plumbed through; counted separately on cards and in the footer |
| Cross-platform `.env.example` | Replaced macOS-only example with explicit macOS/Linux/Windows examples plus a forward-slash variant note |
| Local `.env.local` | Created for the user's Windows setup (`C:\Users\root\Workspace` etc.); gitignored |
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
