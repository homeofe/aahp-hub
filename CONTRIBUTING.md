# Contributing to AAHP Hub

Thanks for your interest in contributing. AAHP Hub is the web dashboard for the
AAHP toolchain. It scans a workspace for projects with `.ai/handoff/MANIFEST.json`
and renders live agent status, active tasks, and runner metrics in one place. The
hub is a thin, read-only renderer: it never writes to the manifests it reads.

## Getting started

1. Fork the repository and create a feature branch from `main`.
2. Install and run locally:

   ```bash
   npm install
   cp .env.example .env.local
   # point ROOT_DIR at the directory aahp-runner scans
   npm run dev
   ```

3. Open http://localhost:3000 and keep changes focused and small.

## Repository layout

- `app/` Next.js App Router pages plus the `app/api/` routes (`abort`, `run`, `stream`).
- `lib/` server-side scanners and helpers that read the manifests and metrics.
- `public/` static assets.
- `test/` Vitest unit tests; `vitest.config.ts` lives at the repo root.
- `scripts/` maintenance and build helpers.
- `.ai/handoff/` AAHP handoff state (STATUS.md, MANIFEST.json, and so on).

## Contribution rules

- **Stay read-only.** The hub must never mutate the manifests, sessions, or
  metrics files it reads. It only renders state produced by `aahp-runner`.
- **Keep the runner local-only.** API routes proxy to the runner's control
  endpoint on `127.0.0.1`; do not expose the runner over the network.
- **TypeScript strict.** Keep the build clean under strict mode and `eslint`.
- **Add tests.** Cover scanner and aggregation logic with Vitest; run
  `npm run test` before opening a PR.
- **No em dashes** in code, comments, or documentation. Use a regular hyphen or
  restructure the sentence.

## Pull request process

1. Open a Pull Request against `main` with a clear description.
2. Link any relevant issues and label the area you touched.
3. Run `npm run lint` and `npm run test`, and make sure the build passes.
4. Confirm no secrets are in the commit history (the hub reads `.env.local`,
   which is gitignored).

For major changes (new dashboard views, API routes, or data contracts with the
runner), open an issue first to discuss design and scope.

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
