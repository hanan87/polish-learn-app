import { defineConfig } from 'vitest/config';

// Unit and data-integrity tests run in Node; the E2E suite (tests/e2e) runs under Playwright.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
