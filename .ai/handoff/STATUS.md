# aahp-hub: Current State of the Nation

> Last updated: 2026-04-30 by claude-opus-4-7
> Commit: T-001 done
>
> **Rule:** This file is rewritten (not appended) at the end of every session.
> It reflects the *current* reality, not history. History lives in LOG.md.

---

<!-- SECTION: summary -->
## Summary

aahp-hub v0.1.0 - web dashboard for the AAHP runner ecosystem. Four tasks
done: scaffold, T-002 metrics aggregation, T-003 live status via SSE,
T-001 tests. Vitest now covers all three lib modules with 27 tests
including the variant-schema regression. The dashboard shows running
agents in real time and aggregates runner activity per project.
<!-- /SECTION: summary -->

---

<!-- SECTION: build_health -->
## Build Health

| Check | Result | Notes |
|-------|--------|-------|
| `npm install` | (Verified) | next 16.2.4, react 19.2, tailwindcss 4, vitest 4.1 |
| `npm run build` | (Verified) | Clean - 2026-04-30 |
| `npm run lint` | (Verified) | Clean - 2026-04-30 |
| `npm run test` | (Verified) | 27 tests across 3 suites pass - 2026-04-30 |
| SSE smoke test | (Verified) | `/api/stream` emits hello + change on `sessions.json` write |
| Page render with live session | (Verified) | Card shows running badge and session row |
| Schema-variant manifest | (Verified) | Covered by `manifest.test.ts` |
<!-- /SECTION: build_health -->

---

<!-- SECTION: components -->
## Components

| Component | Path | State | Notes |
|-----------|------|-------|-------|
| Manifest scanner | `lib/manifest.ts` | (Verified) | Defensive coercion; sorts running projects first |
| Metrics loader | `lib/metrics.ts` | (Verified) | JSONL parse, 24h/7d windows |
| Sessions loader | `lib/sessions.ts` | (Verified) | Reads sessions.json, looks up last log line |
| SSE endpoint | `app/api/stream/route.ts` | (Verified) | mtime poll on sessions.json + metrics.jsonl |
| Dashboard page | `app/page.tsx` | (Verified) | Force-dynamic; running cards pulsing |
| Auto-refresh / Live indicator | `app/auto-refresh.tsx` | (Verified) | EventSource + 30s polling fallback |
| Test suites | `lib/*.test.ts` | (Verified) | 27 tests; uses tmpdir fixtures and env overrides |
| Vitest config | `vitest.config.ts` | (Verified) | Aliases `server-only` to stub for Node tests |
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
| `server-only` | ^0.0.1 | Marks server-side modules; aliased to stub in vitest |
| `vitest` | ^4.1.5 | Test runner |
| `@vitest/coverage-v8` | ^4.1.5 | Coverage reporter |
<!-- /SECTION: dependencies -->

---

<!-- SECTION: what_is_missing -->
## What is Missing

| Gap | Severity | Description |
|-----|----------|-------------|
| Abort | MEDIUM | No way to abort a running agent (T-004, needs runner endpoint) |
| Token tracking | LOW | Blocked on runner-side change to `RunMetric` (T-005) |
| Auth | (deferred) | Internal tool only, intentionally none |
<!-- /SECTION: what_is_missing -->

---

<!-- SECTION: resolved_this_session -->
## Resolved This Session (2026-04-30)

| Item | Resolution |
|------|-----------|
| T-001 tests | Vitest added with 27 tests across `manifest.test.ts`, `metrics.test.ts`, `sessions.test.ts` |
| `server-only` test issue | Aliased to `test/server-only-stub.ts` in `vitest.config.ts` |
| Test conventions | Documented in `CONVENTIONS.md`: tmpdir fixtures, env var overrides, no module mocking |
<!-- /SECTION: resolved_this_session -->
