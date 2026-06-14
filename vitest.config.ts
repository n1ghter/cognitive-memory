import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'], // Usually exclude bootstrap index
      // Tells Vitest to collect coverage for all files, even if they are not imported in tests
      // @ts-expect-error - suppress TS error if @vitest/coverage-v8 types are missing in the editor
      all: true,
    },
  },
});
