import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Unit tests use *.test.ts; Playwright e2e specs (*.spec.ts under e2e/) run
    // via `pnpm test:e2e`, not Vitest. Without this, Vitest's default glob picks
    // up the Playwright specs and errors on their `test()` API.
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});