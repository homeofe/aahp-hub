# AAHP Hub

[![AAHP Verify](https://github.com/homeofe/aahp-hub/actions/workflows/aahp-verify.yml/badge.svg)](https://github.com/homeofe/aahp-hub/actions/workflows/aahp-verify.yml)
[![Supply Chain Guard](https://github.com/homeofe/aahp-hub/actions/workflows/supply-chain-guard.yml/badge.svg)](https://github.com/homeofe/aahp-hub/actions/workflows/supply-chain-guard.yml)

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

The overview is one compact row per project, sorted so the projects that need
something rise to the top.

Local handoff state (read from disk, rendered immediately):

- Project name and phase (`research`, `architect`, `implement`, `review`, `done`)
- A pulsing green dot when an agent is currently running, with the live task
  ID, backend, started-at, the last log line being streamed, and an Abort
  button that signals the runner's control endpoint
- Task counts (ready, in progress, done) and a completion percentage
- Health score and grade
- When `.ai/handoff/MANIFEST.json` was last modified
- Runner activity on the project page: runs in the last 24h and 7d, success
  rate, average duration (from the `aahp-runner` JSONL metrics)
- LLM token spend per project: input / output totals, prompt-cache hit rate,
  number of aborted runs (when the runner records token data; the SDK and
  Copilot backends populate it, CLI backends do not)

Repository state (fetched separately, see below):

- Open and closed issues
- Open, merged and closed-without-merge pull requests, counted separately
- Open Dependabot alerts
- Whether the local checkout has drifted from its remote

### Repository columns

Each project is mapped to a repository through its **git origin remote**, not
its directory name. Several workspace directories differ from the repository
they track, and some projects were migrated to a self-hosted forge and no
longer exist on GitHub at all. A project with no GitHub origin renders as
`n/a`, never as an error and never as a zero.

Counts come from a single aliased GraphQL query per batch of repositories,
executed through the **`gh` CLI**, which supplies its own stored credentials.
The hub reads no token, defines no token environment variable, and never
prompts you to create a personal access token. If `gh` is missing or not
signed in, the repository columns say so and the rest of the dashboard keeps
working.

Three pull request states are queried and shown separately, because GitHub's
`CLOSED` state **excludes** merged pull requests. A repository with thirty
merged pull requests and none rejected legitimately reports zero closed, and
showing only "closed" would claim that nothing ever shipped.

Results are cached with a TTL (5 minutes by default) and persisted to disk, so
a page refresh does not re-run the query. When a refresh fails, the previous
values stay on screen with a visible staleness marker rather than collapsing
to zeros.

### Checkout drift

Every handoff-derived number describes a local working copy. If that copy is
twenty commits behind its remote, the whole row describes yesterday's
repository, so drift is a first-class column.

Drift is measured against the remote-tracking branch as of the last `git
fetch`. **The hub never fetches, never writes and never modifies the projects
it scans**; the age of the last fetch is shown alongside the counts so you can
tell how much to trust them. Branches without an upstream report "no upstream"
rather than pretending to be in sync.

### Active, archived and not applicable

The board defaults to live GitHub repositories. Archived repositories and
projects without a GitHub origin are moved to their own tabs, with counts, so
nothing is hidden.

### Aborting a running agent

Each running-session row carries an Abort button. It POSTs to the hub's
`/api/abort` route, which proxies to `aahp-runner`'s control endpoint at
`127.0.0.1:<controlPort>/abort`. The port is published by the runner into
`~/.aahp/sessions.json` while `aahp run` is active and removed on shutdown.
When the port is not advertised, the button is disabled.

The hub never talks to the runner over the network. The proxy keeps the
runner bound to localhost only.

Live updates use Server-Sent Events. The hub watches `~/.aahp/sessions.json`
and `~/.aahp/metrics.jsonl` for mtime changes; whenever either file changes,
all connected clients refresh within ~250 ms. A 30 second polling fallback
runs in parallel so the page stays current even if SSE drops. The header
shows a connection indicator: live / connecting / offline.

### Token tracking

As of `aahp-runner` v0.4.0, `RunMetric` carries `inputTokens`, `outputTokens`,
`cacheReadTokens`, `cacheCreationTokens`, and `modelId`. The SDK (Anthropic)
and Copilot backends populate them; CLI backends (`claude-cli`, `gemini`,
`codex`) do not currently expose token counts and leave the fields undefined.

The hub aggregates whatever is recorded. Cards show input / output totals
and a cache hit rate (cache reads divided by cache reads plus fresh input
tokens). The footer shows totals across all projects.

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
| `ROOT_DIR` | `<home>/Workspace` | Directory the hub scans for `.ai/handoff/MANIFEST.json` files. Should match the root directory configured in `aahp-runner`. Path is platform-native: `/Users/you/Workspace` on macOS, `/home/you/Workspace` on Linux, `C:\Users\you\Workspace` on Windows. |
| `METRICS_FILE` | `<home>/.aahp/metrics.jsonl` | Path to the `aahp-runner` JSONL metrics file. Override only if you point `aahp-runner` at a non-default location. |
| `SESSIONS_FILE` | `<home>/.aahp/sessions.json` | Path to the live sessions file written by `aahp-runner` and `aahp-orchestrator`. The hub reads this for the running-agent view, the SSE stream, and the `controlPort` used by the Abort button. |
| `HUB_GITHUB_TTL_SECONDS` | `300` | How long fetched repository counts stay fresh before the next `gh` query. |
| `HUB_GITHUB_CACHE_FILE` | `<home>/.aahp/hub-github-cache.json` | Where the repository cache is persisted, so a restart does not lose the last good values. |

There is deliberately **no token variable**. Repository access goes through
the `gh` CLI:

```bash
gh auth login   # once, if you have not already
gh auth status  # should report a logged-in account
```

Without `gh`, the dashboard still renders every local handoff signal and
labels the repository columns as unavailable.

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
