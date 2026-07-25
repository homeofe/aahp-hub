# CLAUDE.md - aahp-hub

> Agent entry point. Read this first when joining this project.

## What this project is

`aahp-hub` is the web dashboard for the AAHP runner ecosystem. It scans a
configured root directory for projects with `.ai/handoff/MANIFEST.json` files
and renders a live overview of agent activity.

It is part of the five-repo AAHP toolchain: AAHP (spec), aahp-runner (CLI),
aahp-orchestrator (VS Code extension), aahp-cron (scheduling), and this repo
(dashboard). See `README.md` for the full picture.

## Stack

- Next.js 15 App Router, React Server Components by default
- TypeScript strict mode, no `any`
- Tailwind CSS v4 (CSS-first config in `app/globals.css`, no `tailwind.config.js`)
- npm package manager
- No database, no auth, no WebSocket - state lives in scanned manifests on disk

## Where to look

| Topic | File |
|-------|------|
| Current state | `.ai/handoff/STATUS.md` |
| Open work | `.ai/handoff/NEXT_ACTIONS.md` |
| Decisions and ADRs | `.ai/handoff/LOG.md` |
| Coding rules | `.ai/handoff/CONVENTIONS.md` |
| Manifest index | `.ai/handoff/MANIFEST.json` |
| AAHP framework | `.claude/`, `.llm/` |
| Filesystem scanner | `lib/manifest.ts` |
| Dashboard page | `app/page.tsx` |
| Fleet board (main view) | `app/fleet-board.tsx`, `app/api/fleet/route.ts` |
| Repository mapping | `lib/git-remote.ts` |
| Local checkout drift | `lib/checkout.ts` |
| GitHub data via `gh` | `lib/github-stats.ts`, `lib/github-cache.ts` |

## Session start

1. Read `.ai/handoff/MANIFEST.json` for `quick_context` and task list.
2. Pick a task with `status: "ready"` and unblocked dependencies.
3. Read `CONVENTIONS.md` before writing any code.
4. Run `npm run build` to verify the baseline before changing anything.
5. Implement, then update STATUS, NEXT_ACTIONS, LOG, and regenerate MANIFEST
   checksums in a single commit.

## Hard rules

- No em dashes anywhere in code, commits, or docs
- `npm run build` must pass before committing
- Never write secrets into source files
- Never introduce a GitHub token environment variable. Repository access goes
  through the `gh` CLI, which supplies its own credentials
- The hub is read-only: never modify manifests in scanned projects, never run
  `git fetch`, `git pull` or any writing git command against them
- Never render a fabricated value. "Not applicable", "not fetched yet" and a
  real zero are three different states and must stay distinguishable
- Use `process.env['KEY']` not `process.env.KEY`
- Server-only modules import `'server-only'` at the top

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
