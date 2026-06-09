import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'] // Usually exclude bootstrap index
    }
  },
});
