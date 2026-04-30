# aahp-hub: Current State of the Nation

> Last updated: 2026-04-30 by claude-opus-4-7
> Commit: T-002 done
>
> **Rule:** This file is rewritten (not appended) at the end of every session.
> It reflects the *current* reality, not history. History lives in LOG.md.

---

<!-- SECTION: summary -->
## Summary

aahp-hub v0.1.0 - web dashboard for the AAHP runner ecosystem. Initial
scaffold plus T-002: the dashboard now reads `~/.aahp/metrics.jsonl` and
shows per-project runner activity (runs 24h / 7d, success rate, average
duration) and a global footer summary. Token tracking is deferred until
`aahp-runner` records token counts in its `RunMetric` schema.
<!-- /SECTION: summary -->

---

<!-- SECTION: build_health -->
## Build Health

| Check | Result | Notes |
|-------|--------|-------|
| `npm install` | (Verified) | next 16.2.4, react 19.2, tailwindcss 4 - 2026-04-30 |
| `npm run build` | (Verified) | Clean after T-002 - 2026-04-30 |
| `npm run lint` | (Verified) | Clean - 2026-04-30 |
| Tests | (Missing) | No tests yet (T-001) |
<!-- /SECTION: build_health -->

---

<!-- SECTION: components -->
## Components

| Component | Path | State | Notes |
|-----------|------|-------|-------|
| Manifest scanner | `lib/manifest.ts` | (Verified) | Walks ROOT_DIR, parses with error capture, joins metrics |
| Metrics loader | `lib/metrics.ts` | (Verified) | Reads JSONL, defensive parse, 24h/7d windows |
| Dashboard page | `app/page.tsx` | (Verified) | Server Component, force-dynamic, metrics row per card + global footer |
| Auto-refresh | `app/auto-refresh.tsx` | (Verified) | Client component, 30s interval |
| Relative time | `app/timestamp.tsx` | (Verified) | Client component, ticks every 1s |
| Theme | `app/globals.css` | (Verified) | Tailwind v4 CSS-first config |
| Layout | `app/layout.tsx` | (Verified) | Sets dark bg / text classes |
<!-- /SECTION: components -->

---

<!-- SECTION: dependencies -->
## Dependencies (current)

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 16.2.4 | Latest at scaffold time, App Router |
| `react` | 19.2.4 | |
| `react-dom` | 19.2.4 | |
| `tailwindcss` | ^4 | CSS-first config, no JS config file |
| `@tailwindcss/postcss` | ^4 | |
| `typescript` | ^5 | strict mode |
| `server-only` | latest | Marks server-side modules |
<!-- /SECTION: dependencies -->

---

<!-- SECTION: what_is_missing -->
## What is Missing

| Gap | Severity | Description |
|-----|----------|-------------|
| Tests | MEDIUM | No unit tests for `scanProjects` or `loadMetrics` yet (T-001) |
| Live status | MEDIUM | Polling-based; no real-time view of running agents (T-003) |
| Abort | MEDIUM | No way to abort a running agent from the hub (T-004) |
| Token tracking | LOW | Blocked on runner-side change (`RunMetric` schema) |
| Auth | (deferred) | Internal tool only, intentionally none |
<!-- /SECTION: what_is_missing -->

---

<!-- SECTION: resolved_this_session -->
## Resolved This Session (2026-04-30)

| Item | Resolution |
|------|-----------|
| T-002 metrics aggregation | `lib/metrics.ts` reads `~/.aahp/metrics.jsonl` (override via `METRICS_FILE`), groups by repo, computes 24h/7d/success/avg-duration |
| Per-card metrics row | Cards show 24h/7d run counts, success rate (color-coded), avg duration |
| Global metrics footer | Total runs, 24h, 7d, success rate; falls back to "no metrics yet" or shows error |
| NEXT_ACTIONS realigned | Tasks now: T-001 tests, T-002 done, T-003 live status, T-004 abort. Detail page demoted to future work. |
| Token caveat documented | README + LOG explain runner does not yet record tokens; tracked as future work |
<!-- /SECTION: resolved_this_session -->
