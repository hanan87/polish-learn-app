import { expect, test } from '@playwright/test';
import { expectNoErrors, openApp, progress } from './helpers';

test.describe('microphone pipeline (fake device playing speech)', () => {
  test('records real audio, shows a live level, and produces a scored or self-rated attempt', async ({ page }) => {
    const errors = await openApp(page, { lang: 'en', hash: '#/map/item/u2-01' });
    await page.getByRole('button', { name: 'Start recording' }).click();

    // Live meter turns green once voice is detected.
    await expect(page.getByText('We hear you')).toBeVisible({ timeout: 10_000 });
    // VAD stops the recording by itself after the phrase + silence.
    const outcome = page.getByText(/Heard:|rate yourself honestly/).first();
    await expect(outcome).toBeVisible({ timeout: 30_000 });

    // Never the "no sound" failure with a working microphone.
    await expect(page.getByText('No sound was captured.')).toHaveCount(0);
    // The learner's own recording is available for the voice comparison.
    await expect(page.getByRole('button', { name: /Compare voices/ })).toBeVisible();

    // Mic must still be usable afterwards (speech-recognition errors never lock it).
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible();

    const p = await progress(page);
    const self = page.getByRole('button', { name: 'Sounds like the speaker' });
    if (await self.isVisible()) {
      await self.click();
    }
    const after = await progress(page);
    expect(after.items['u2-01'].pronScores.length).toBeGreaterThan(0);
    expect(Object.keys(after.sounds).length).toBeGreaterThan(0);
    void p;
    expectNoErrors(errors);
  });

  test('microphone test in settings shows every pipeline stage', async ({ page }) => {
    const errors = await openApp(page, { lang: 'en', hash: '#/map/settings' });
    await page.getByRole('button', { name: 'Start test' }).click();
    await expect(page.getByText('Voice detected')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Voice captured:')).toBeVisible({ timeout: 30_000 });
    const list = page.locator('ul').filter({ hasText: 'Voice captured' });
    await expect(list).toContainText('Recording saved:');
    await expect(list).toContainText('yes');
    await page.getByText('Event log').click();
    await expect(page.locator('details ol')).toContainText('getUserMedia-ok');
    await expect(page.locator('details ol')).toContainText('voice-detected');
    await expect(page.locator('details ol')).toContainText('recorder-stop');
    await expect(page.getByRole('button', { name: 'Play recording' })).toBeVisible();
    expectNoErrors(errors);
  });
});
