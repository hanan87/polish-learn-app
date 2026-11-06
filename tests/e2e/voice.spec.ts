import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectNoErrors, openApp } from './helpers';

/**
 * Natural-voice playback: a manifest maps phrases to recorded clips; speak() must play the clip
 * instead of the device voice, honour the "natural voice" switch, and fall back when no clip exists.
 * The manifest and clip are served by the test, so this runs without the real Azure recordings.
 */
test.use({ serviceWorkers: 'block' });

const WAV = readFileSync('tests/e2e/fixtures/speech.wav');
const MANIFEST = {
  version: 1,
  voices: { 'pl-f': 'pl-PL-ZofiaNeural', 'pl-m': 'pl-PL-MarekNeural', he: 'he-IL-HilaNeural', en: 'en-US-JennyNeural' },
  clips: {
    'pl-f|n|szkoła': 'test-normal.mp3',
    'pl-f|s|szkoła': 'test-slow.mp3',
  },
};

test.describe('natural teacher voice', () => {
  test('plays recorded clips, normal and slow, and honours the switch', async ({ page }) => {
    const requested: string[] = [];
    await page.route('**/audio/manifest.json', (r) => r.fulfill({ json: MANIFEST }));
    await page.route('**/audio/*.mp3', (r) => {
      requested.push(new URL(r.request().url()).pathname.split('/').pop()!);
      return r.fulfill({ body: WAV, contentType: 'audio/wav' });
    });
    const errors = await openApp(page, { lang: 'en', hash: '#/map/item/u1-01' });

    await page.getByRole('button', { name: 'Play at normal speed' }).first().click();
    await expect.poll(() => requested).toContain('test-normal.mp3');
    await page.getByRole('button', { name: 'Play extra slow' }).first().click();
    await expect.poll(() => requested).toContain('test-slow.mp3');

    // Settings: the switch is on and shows the number of recordings.
    await page.goto('/#/map/settings');
    const natural = page.getByTestId('natural-voice');
    await expect(natural).toBeEnabled();
    await expect(natural).toBeChecked();
    await expect(page.getByText(/2 high-quality neural recordings/)).toBeVisible();
    await natural.uncheck();

    // With the switch off, the same button uses the device voice – no clip is requested.
    requested.length = 0;
    await page.goto('/#/map/item/u1-01');
    await page.getByRole('button', { name: 'Play at normal speed' }).first().click();
    await page.waitForTimeout(800);
    expect(requested).toEqual([]);
    expectNoErrors(errors);
  });

  test('without recordings the app falls back to the device voice and explains it', async ({ page }) => {
    await page.route('**/audio/manifest.json', (r) => r.fulfill({ status: 404, body: 'not found' }));
    const errors = await openApp(page, { lang: 'en', hash: '#/map/settings' });
    await expect(page.getByText('Teacher voice')).toBeVisible();
    await expect(page.getByTestId('natural-voice')).toBeDisabled();
    await expect(page.getByText(/Recordings are not available yet/)).toBeVisible();
    // The device-voice list always offers "Automatic", or explains how to install a Polish voice.
    await expect(page.getByRole('radio', { name: /Automatic/ }).or(page.getByText(/No Polish device voice found/))).toBeVisible();
    // Playing still works (device voice) without errors.
    await page.goto('/#/map/item/u1-01');
    await page.getByRole('button', { name: 'Play at normal speed' }).first().click();
    expectNoErrors(errors.filter((e) => !/404|manifest/.test(e)));
  });
});
