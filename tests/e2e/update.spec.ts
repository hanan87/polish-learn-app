import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { openApp } from './helpers';

/**
 * Regression test for "I refreshed but still got the old version": the service worker served the
 * cached build and nothing reloaded the page. A new deploy must now take over by itself.
 */
test.describe('app updates', () => {
  test('Settings shows the version that is actually running', async ({ page }) => {
    await openApp(page, { lang: 'en', hash: '#/map/settings' });
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    await expect(page.getByTestId('app-version')).toContainText('Version');
    // A locally built preview carries the commit it was built from.
    await expect(page.getByTestId('app-version')).toContainText(new RegExp(`${sha}|dev`));
  });

  test('a new deploy reloads the open app automatically', async ({ page }) => {
    await openApp(page, { lang: 'en' });
    // Wait until the service worker controls the page (first visit installs it).
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((r) => navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true }));
      }
    });
    await page.evaluate(() => ((window as unknown as { __oldPage: boolean }).__oldPage = true));

    // Simulate a deploy: the server now has a different service worker.
    const swPath = 'dist/sw.js';
    const original = readFileSync(swPath, 'utf8');
    writeFileSync(swPath, `${original}\n// deploy ${Date.now()}\n`);
    try {
      const reloaded = page.waitForEvent('load', { timeout: 30_000 });
      // Returning to the app triggers the update check.
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await reloaded;
      // The page was replaced without any user action.
      expect(await page.evaluate(() => (window as unknown as { __oldPage?: boolean }).__oldPage)).toBeUndefined();
      await expect(page.getByRole('heading', { name: 'Course map' })).toBeVisible();
    } finally {
      writeFileSync(swPath, original);
    }
  });
});
