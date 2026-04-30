# LOG - aahp-hub

> Append-only journal of decisions, ADRs, and notable events.
> Newest entry on top. Older entries can be archived to `logs/LOG-YYYY-MM-DD.md`.

---

## 2026-04-30: Initial scaffold (claude-opus-4-7)

### Context

The AAHP ecosystem has four working repos: AAHP (spec), aahp-runner (CLI),
aahp-orchestrator (VS Code), aahp-cron (scheduling). The runner is headless;
when agents work overnight there is no way to see what happened. This repo
fills that gap.

### Decisions

- **Next.js 15 over a static dashboard.** Server Components are well suited
  to filesystem scans, the App Router gives us `router.refresh()` for free,
  and the project will likely grow API routes for `aahp-runner` integration.
- **No auth.** Internal tool, run on localhost or behind the user's own VPN.
- **No database.** State of record lives in `.ai/handoff/MANIFEST.json` files.
  The hub is a thin renderer.
- **Polling, not WebSockets.** 30 second `router.refresh()` is enough for a
  human-paced overview and avoids server state.
- **`lib/` not `src/lib/`.** Scaffold flag was `--no-src-dir`, so library code
  lives at repo root under `lib/`.
- **Dark theme matching Atlas Dashboard.** Same `--bg #0f1e35` and
  `--accent #00d4ff` so the visual language is consistent across internal tools.

### Implementation

- `lib/manifest.ts` walks `ROOT_DIR` (default `~/Workspace`) two levels deep
  looking for `.ai/handoff/MANIFEST.json`. Each manifest is parsed with
  per-file error capture so one broken JSON does not crash the page.
- `app/page.tsx` is a Server Component. `dynamic = 'force-dynamic'` keeps the
  scan fresh on every request. The page renders a card per project with phase
  badge, active task counts, last agent, quick context, and GitHub link.
- `app/auto-refresh.tsx` is a tiny Client Component that calls
  `router.refresh()` on a 30 second interval. It also exports a manual
  Refresh button.
- `app/timestamp.tsx` ticks once per second to keep the "X seconds ago" label
  accurate without re-fetching the page.

### Verification

- `npm install` clean
- `npm run build` passes
- Repo created at `https://github.com/homeofe/aahp-hub`

### Open questions

- Whether to support multiple `ROOT_DIR` values (the runner does not yet, but
  some users have multiple workspace folders). Defer until requested.
- Whether the dashboard should write back to manifests (e.g. to mark a task
  as cancelled). Today the answer is no - the hub stays read-only.
