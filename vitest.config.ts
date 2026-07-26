import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    // Deliberately NOT scoped to a directory. A glob like `lib/**/*.test.ts`
    // makes `vitest run` exit 0 while a failing test sits anywhere else in
    // the tree, and CI then reports a green check that proved nothing. Every
    // test file in the repository runs, wherever it lives, and any suffix
    // vitest recognises counts so a new test cannot be silently skipped.
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // configDefaults.exclude already covers node_modules, dist and .git.
    // The build outputs are added on top: they can contain copied sources,
    // and a stale .next from a previous build must never be collected.
    exclude: [
      ...configDefaults.exclude,
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
    ],
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': resolve(here, '.'),
      'server-only': resolve(here, 'test/server-only-stub.ts'),
    },
  },
});
