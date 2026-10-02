import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{shared,server,web}/src/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      include: ['{shared,server,web}/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}'],
      reporter: ['text', 'html'],
    },
  },
});
