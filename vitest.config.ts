import { defineConfig } from 'vitest/config';

// Unit and data-integrity tests run in Node; the E2E suite (tests/e2e) runs under Playwright.
export default defineConfig({
  define: { __APP_SEMVER__: JSON.stringify('test'), __APP_VERSION__: JSON.stringify('test'), __BUILD_TIME__: JSON.stringify('') },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
