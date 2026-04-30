# aahp-hub: Current State of the Nation

> Last updated: 2026-04-30 by claude-opus-4-7
> Commit: T-003 done
>
> **Rule:** This file is rewritten (not appended) at the end of every session.
> It reflects the *current* reality, not history. History lives in LOG.md.

---

<!-- SECTION: summary -->
## Summary

aahp-hub v0.1.0 - web dashboard for the AAHP runner ecosystem. Three tasks
done: scaffold, T-002 metrics aggregation, T-003 live status via SSE. The
dashboard now shows running agents in real time (pulsing dot, task ID,
backend, last log line), with an SSE-driven refresh that fires within 250 ms
of any change to `sessions.json` or `metrics.jsonl`. Defensive manifest
parsing handles the variant schemas seen in `elvatis-defense` and similar.
<!-- /SECTION: summary -->

---

<!-- SECTION: build_health -->
## Build Health

| Check | Result | Notes |
|-------|--------|-------|
| `npm install` | (Verified) | next 16.2.4, react 19.2, tailwindcss 4 |
| `npm run build` | (Verified) | Clean after T-003 - 2026-04-30 |
| `npm run lint` | (Verified) | Clean - 2026-04-30 |
| SSE smoke test | (Verified) | `/api/stream` emits hello + change on `sessions.json` write |
| Page render with live session | (Verified) | Card shows running badge and session row |
| Schema-variant manifest | (Verified) | `elvatis-defense` (array tasks, object quick_context) renders without crashing |
| Tests | (Missing) | No tests yet (T-001) |
<!-- /SECTION: build_health -->

---

<!-- SECTION: components -->
## Components

| Component | Path | State | Notes |
|-----------|------|-------|-------|
| Manifest scanner | `lib/manifest.ts` | (Verified) | Defensive coercion for variant schemas; sorts running projects first |
| Metrics loader | `lib/metrics.ts` | (Verified) | JSONL parse, 24h/7d windows |
| Sessions loader | `lib/sessions.ts` | (Verified) | Reads `~/.aahp/sessions.json`, looks up last log line per repo |
| SSE endpoint | `app/api/stream/route.ts` | (Verified) | mtime poll on sessions.json + metrics.jsonl, heartbeat every 15s |
| Dashboard page | `app/page.tsx` | (Verified) | Force-dynamic; running cards pulsing, orphan-session banner, dual footer |
| Auto-refresh / Live indicator | `app/auto-refresh.tsx` | (Verified) | EventSource + 30s polling fallback; live / connecting / offline state |
| Relative time | `app/timestamp.tsx` | (Verified) | Ticks every 1s |
| Theme | `app/globals.css` | (Verified) | Tailwind v4 CSS-first config |
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
| `server-only` | latest | Marks server-side modules |
<!-- /SECTION: dependencies -->

---

<!-- SECTION: what_is_missing -->
## What is Missing

| Gap | Severity | Description |
|-----|----------|-------------|
| Tests | MEDIUM | No unit tests yet (T-001) |
| Abort | MEDIUM | No way to abort a running agent (T-004, needs runner endpoint) |
| Token tracking | LOW | Blocked on runner-side change to `RunMetric` (T-005) |
| Auth | (deferred) | Internal tool only, intentionally none |
<!-- /SECTION: what_is_missing -->

---

<!-- SECTION: resolved_this_session -->
## Resolved This Session (2026-04-30)

| Item | Resolution |
|------|-----------|
| T-003 SSE endpoint | `/api/stream` watches sessions.json + metrics.jsonl mtime, sends hello + change + heartbeat events |
| Live indicator | Header shows live / connecting / offline based on EventSource state |
| Per-card running view | Pulsing green dot, session row with taskId, backend, started-at, last log line |
| Sort order | Projects with running agents bubble to the top |
| Orphan sessions | Banner when an active session is for a project outside `ROOT_DIR` |
| Variant manifest parsing | `coerceString` and `normaliseTasks` handle array-shaped tasks and object-shaped quick_context (seen in `elvatis-defense`) |
<!-- /SECTION: resolved_this_session -->
