# AAHP Hub

Web dashboard for the AAHP runner. Scans your workspace for projects with
`.ai/handoff/MANIFEST.json` and shows live agent status, active tasks, and
recent activity in one place.

## The AAHP Toolchain (use all five together)

| Repo | What it does | When to use it |
|------|--------------|----------------|
| [homeofe/AAHP](https://github.com/homeofe/AAHP) | The protocol specification. Defines the v3 handoff file format (`MANIFEST.json`, `STATUS.md`, `LOG.md`, etc.), the token-efficient compression scheme, and the safety rules every agent must follow. Spec only, no code. | Read this first to understand how agents share state across sessions. |
| [homeofe/aahp-runner](https://github.com/homeofe/aahp-runner) | Autonomous CLI. Scans a root directory for projects with `MANIFEST.json`, syncs GitHub Issues into tasks, and spawns Claude, Gemini, or Codex to implement them, run tests, and commit. Headless and unattended. | Run it nightly to let agents work through your backlog while you sleep. |
| [homeofe/aahp-orchestrator](https://github.com/homeofe/aahp-orchestrator) | VS Code extension. Injects AAHP context automatically into GitHub Copilot and Claude Code while you code. Provides a status bar entry, an `@aahp` chat command, and a sidebar dashboard. | Install it in your editor so live coding sessions stay in sync with the handoff state. |
| [homeofe/aahp-cron](https://github.com/homeofe/aahp-cron) | Scheduling wrapper for `aahp-runner`. Manages cron jobs on Linux and macOS and Task Scheduler entries on Windows. | Use it to schedule the runner to fire nightly or at intervals without writing your own cron syntax. |
| [homeofe/aahp-hub](https://github.com/homeofe/aahp-hub) | Web dashboard (this repo). Renders the manifests `aahp-runner` produces into a single live overview. | Open it in a browser when you want to see what the headless runner has been doing without grepping log files. |

The runner is headless. When agents work overnight, there is no visible
overview. Tokens get spent, tasks fail, and nobody sees it. The hub closes
that gap.

## What the dashboard shows

For each project found under `ROOT_DIR`:

- Project name and phase (`research`, `architect`, `implement`, `review`, `done`)
- Active task counts (in progress, ready, done)
- Up to three active task titles with their IDs
- The last agent that touched the project and its `quick_context` summary
- A relative timestamp ("3m ago") of the last session
- A link to the project's GitHub repo when the manifest carries one

The page polls itself every 30 seconds via `router.refresh()` so values stay
current. There is no auth, no database, and no WebSocket. State lives in the
`MANIFEST.json` files on disk.

## Getting started

```bash
git clone https://github.com/homeofe/aahp-hub.git
cd aahp-hub
npm install
cp .env.example .env.local
# edit .env.local and point ROOT_DIR at the directory aahp-runner scans
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ROOT_DIR` | `~/Workspace` | Directory the hub scans for `.ai/handoff/MANIFEST.json` files. Should match the root directory configured in `aahp-runner`. |

The scanner walks two levels deep, skips dotfiles and `node_modules`, and
expects each project to have a `.ai/handoff/MANIFEST.json` at its root. If a
manifest fails to parse, the project is rendered as a parse error card rather
than crashing the page.

## Stack

- Next.js 15 App Router
- TypeScript strict mode
- Tailwind CSS v4
- Server Components for the scan, a small client component for polling

## Production

```bash
npm run build
npm run start
```

The hub is a thin renderer. It does not write to the manifests it reads. Run
it as an internal tool behind your own network. There is no built-in auth.
