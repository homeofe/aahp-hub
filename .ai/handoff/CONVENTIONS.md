# aahp-hub: Agent Conventions

> Every agent working on this project must read and follow these conventions.
> Update this file whenever a new standard is established.

---

## The Three Laws (Our Motto)

> **First Law:** A robot may not injure a human being or, through inaction, allow a human being to come to harm.
>
> **Second Law:** A robot must obey the orders given it by human beings except where such orders would conflict with the First Law.
>
> **Third Law:** A robot must protect its own existence as long as such protection does not conflict with the First or Second Laws.
>
> *- Isaac Asimov*

We are human beings and will remain human beings. Tasks are delegated to AI
only when we choose to delegate them. **Do no damage** is the highest rule.

---

## Language

- All code, comments, commits, and documentation in **English only**
- Use clear, direct language in handoff files (agents are the primary readers)

## Stack

- **Next.js 15** App Router. Server Components by default; mark client
  components with `'use client'` only when interactivity requires it.
- **TypeScript:** strict mode, no `any` unless unavoidable
- **Tailwind CSS v4:** CSS-first config in `app/globals.css`. No
  `tailwind.config.js`. Define theme tokens via `@theme inline { ... }`.
- **Package manager:** npm. Do not introduce pnpm or yarn lockfiles.
- **Env vars:** read with bracket notation: `process.env['ROOT_DIR']`. This
  satisfies `noUncheckedIndexedAccess` and survives `noPropertyAccessFromIndexSignature`.
- **Server-only modules:** anything that touches the filesystem or secrets
  must `import 'server-only'` at the top.
- **No em dashes (`-`)**: never use Unicode em dashes anywhere - use a regular hyphen (`-`).

## Branching & Commits

```
feat/<scope>-<short-name>    - new feature
fix/<scope>-<short-name>     - bug fix
docs/<scope>-<short-name>    - documentation only
refactor/<scope>-<name>      - no behaviour change

Commit format:
  feat(scope): description [AAHP-auto]
  fix(scope): description [AAHP-auto]
  docs(scope): description [AAHP-auto]
```

## File Organization

- `app/` - Next.js App Router routes and per-page components
  - `page.tsx` - dashboard
  - `layout.tsx` - root layout, fonts, theme classes
  - `globals.css` - Tailwind v4 entry and CSS variables
  - `auto-refresh.tsx` - client polling component
  - `timestamp.tsx` - client relative-time component
- `lib/` - server-side modules, no React imports
  - `manifest.ts` - filesystem scanner and types
- `.ai/handoff/` - aahp-hub's own handoff files (dogfooding)
- `.claude/`, `.llm/` - AAHP framework definitions

## Architecture Principles

- **Read-only renderer.** The hub never writes to manifests. State lives in
  the projects it scans.
- **Single root.** One `ROOT_DIR`. If we need multi-root support, add it as
  a new env var rather than overloading the existing one.
- **Failure-tolerant parsing.** A single broken manifest must not crash the
  page. Surface the error in a parse-error card.
- **No auth.** Internal tool. If it ever needs auth, deploy it behind a
  reverse proxy that handles auth - do not add auth to the app.

## Build & Compile

- `npm run dev` - dev server
- `npm run build` - production build, must pass before commit
- `npm run lint` - ESLint, must pass before commit
- `npm run start` - production server

## Testing

- No tests yet (T-001 ready). When added, use Vitest.
- Always run `npm run build` before committing.

## What Agents Must NOT Do

- **Violate the Three Laws** - never cause damage to data, systems, or people
- Push directly to `main` without human approval
- Write secrets, credentials, or API keys into any file
- Add a `tailwind.config.js` (Tailwind v4 is CSS-first)
- Introduce a database, an ORM, or an auth library without an ADR
- Use em dashes anywhere
- Modify manifests in scanned projects (the hub is read-only)

---

*This file is maintained by agents and humans together. Update it when conventions evolve.*
