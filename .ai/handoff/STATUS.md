# aahp-hub: Current State of the Nation

> Last updated: 2026-04-30 by claude-opus-4-7
> Commit: initial scaffold
>
> **Rule:** This file is rewritten (not appended) at the end of every session.
> It reflects the *current* reality, not history. History lives in LOG.md.

---

<!-- SECTION: summary -->
## Summary

aahp-hub v0.1.0 - web dashboard for the AAHP runner ecosystem. Initial scaffold
complete: Next.js 15 App Router with Tailwind v4, dark theme matching Atlas
Dashboard. Server-side scanner reads `.ai/handoff/MANIFEST.json` files under
`ROOT_DIR` and renders a card per project. Auto-refresh every 30 seconds via
`router.refresh()`.
<!-- /SECTION: summary -->

---

<!-- SECTION: build_health -->
## Build Health

| Check | Result | Notes |
|-------|--------|-------|
| `npm install` | (Verified) | next 16.2.4, react 19.2, tailwindcss 4 - 2026-04-30 |
| `npm run build` | (Verified) | Initial scaffold builds clean - 2026-04-30 |
| `npm run lint` | (Unknown) | Not yet run |
| Tests | (Missing) | No tests yet |
<!-- /SECTION: build_health -->

---

<!-- SECTION: components -->
## Components

| Component | Path | State | Notes |
|-----------|------|-------|-------|
| Data layer | `lib/manifest.ts` | (Verified) | Server-only scanner with `'server-only'` import |
| Dashboard page | `app/page.tsx` | (Verified) | Server Component, force-dynamic |
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
<!-- /SECTION: dependencies -->

---

<!-- SECTION: what_is_missing -->
## What is Missing

| Gap | Severity | Description |
|-----|----------|-------------|
| Tests | MEDIUM | No unit tests for `scanProjects` yet |
| Token budget tracking | LOW | Hub does not yet aggregate `aahp-runner` metrics |
| Filtering and sorting | LOW | All projects shown, no UI controls yet |
| Per-project drill-down | LOW | No detail view; clicking a card does nothing |
| Auth | (deferred) | Internal tool only, intentionally none |
<!-- /SECTION: what_is_missing -->

---

<!-- SECTION: resolved_this_session -->
## Resolved This Session (2026-04-30)

| Item | Resolution |
|------|-----------|
| Repo creation | `homeofe/aahp-hub` created via `gh repo create` |
| Next.js scaffold | `create-next-app@latest` with --typescript --tailwind --app --no-src-dir |
| Manifest scanner | `lib/manifest.ts` walks 2 levels deep, parses with error capture |
| Dashboard MVP | Cards with phase, task counts, active task list, last agent, GH link |
| Auto-refresh | 30s `router.refresh()` interval; manual refresh button |
| Dark theme | Atlas-style palette (--bg #0f1e35, --accent #00d4ff) |
| AAHP framework | `.claude` and `.llm` copied from improvements/ |
<!-- /SECTION: resolved_this_session -->
