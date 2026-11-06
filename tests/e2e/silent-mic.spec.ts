import { expect, test } from '@playwright/test';
import { openApp, progress } from './helpers';

test.describe('silent microphone (fake device playing silence)', () => {
  test('a silent attempt is reported, not scored, and does not advance a speaking step', async ({ page }) => {
    await openApp(page, { lang: 'en', hash: '#/lesson/u1-L1' });
    // Skip learn cards until the first speaking step.
    for (let i = 0; i < 40; i++) {
      const stage = (await page.locator('header p').first().textContent()) ?? '';
      if (/Speak from memory/.test(stage)) break;
      if (/Learn & shadow/.test(stage)) {
        await page.getByRole('button', { name: 'Got it, continue' }).click();
        continue;
      }
      if (/Writing/.test(stage)) {
        await page.getByPlaceholder('Napisz po polsku…').fill('x');
        await page.getByRole('button', { name: 'Check' }).click();
      } else {
        const main = page.locator('div.animate-pop-in.mx-auto');
        await main.locator('button:not([disabled]):not([aria-label])').first().click();
        const check = page.getByRole('button', { name: 'Check' });
        if (await check.isVisible()) await check.click();
      }
      await page.getByRole('button', { name: /^(Continue|Finish \(\+)/ }).click();
    }

    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByText('Waiting for your voice')).toBeVisible();
    await expect(page.getByText('No sound was captured.')).toBeVisible({ timeout: 20_000 });
    // No score was recorded, so the step cannot be finished as if something happened.
    await expect(page.getByRole('button', { name: 'Record yourself to continue' })).toBeDisabled();
    const p = await progress(page);
    const scores = Object.values(p.items as Record<string, { pronScores: number[] }>).flatMap((i) => i.pronScores);
    expect(scores).toEqual([]);
    // Retry is offered.
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
