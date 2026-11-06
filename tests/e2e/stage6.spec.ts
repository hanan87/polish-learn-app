import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, openApp, progress } from './helpers';

/** Stage 6 (Pro): personalization, hands-free mode, mini stories, Speed Blitz, haptics – and "Dla Kasi". */

/** Records navigator.vibrate calls in window.__vibrations (desktop Chrome has no vibration motor). */
async function recordVibrations(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vibrations: unknown[] };
    w.__vibrations = [];
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: unknown) => {
        w.__vibrations.push(pattern);
        return true;
      },
    });
  });
}
const vibrations = (page: Page) => page.evaluate(() => (window as unknown as { __vibrations: unknown[] }).__vibrations.length);

test.describe('speaker gender and name', () => {
  test('welcome → female + name; phrases, notes and roleplay follow the profile', async ({ page }) => {
    const errors = await openApp(page);
    await page.getByRole('button', { name: /Polish for English speakers/ }).click();
    await page.getByRole('radio', { name: /^Female/ }).click();
    await page.getByPlaceholder('Anna').fill('kasia');
    await page.getByRole('button', { name: "Let's start" }).click();
    await expect(page.getByRole('heading', { name: 'Course map' })).toBeAttached();
    expect((await progress(page)).profile).toEqual({ gender: 'f', name: 'kasia' });

    // A gendered item shows her form, with a note on how a man says it.
    await page.goto('/#/map/item/u7-07');
    await expect(page.getByRole('dialog').getByText('Zgubiłam').first()).toBeVisible();
    await expect(page.getByTestId('gender-note')).toContainText('A man says:');
    await expect(page.getByTestId('gender-note')).toContainText('Zgubiłem paszport');

    // Her name goes into "Mam na imię…".
    await page.goto('/#/map/item/u2-11');
    await expect(page.getByRole('dialog')).toContainText('My name is Kasia');

    // The roleplay offers the reply with her name.
    await page.goto('/#/talk');
    await page.getByRole('button', { name: /Getting acquainted/ }).click();
    await expect(page.getByText('(Kasia from Israel)', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /My name is Kasia/ })).toBeVisible();

    // Switching to male in Settings updates the same phrases.
    await page.goto('/#/map/settings');
    await page.getByRole('radio', { name: /^Male/ }).click();
    await page.goto('/#/map/item/u7-07');
    await expect(page.getByTestId('gender-note')).toContainText('A woman says:');
    await expect(page.getByTestId('gender-note')).toContainText('Zgubiłam paszport');
    expectNoErrors(errors);
  });

  test('existing learners get a one-time profile prompt on the map', async ({ page }) => {
    const errors = await openApp(page, { lang: 'he' });
    const prompt = page.getByTestId('profile-prompt');
    await expect(prompt).toBeVisible();
    await prompt.getByRole('radio', { name: /נקבה/ }).click();
    await prompt.getByRole('button', { name: 'שמור' }).click();
    await expect(prompt).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('profile-prompt')).toBeHidden();
    expectNoErrors(errors);
  });
});

test.describe('mini stories', () => {
  test('tap-to-inspect explains endings, the quiz awards XP and haptics fire', async ({ page }) => {
    await recordVibrations(page);
    const errors = await openApp(page, { lang: 'en' });
    await page.goto('/#/talk');
    await expect(page.getByTestId('stories').getByRole('button')).toHaveCount(4);
    await page.getByRole('button', { name: /Coffee for the cat/ }).click();

    for (let i = 1; i < 8; i++) await page.getByRole('button', { name: /^Next line/ }).click();
    await expect(page.getByRole('button', { name: /^Next line/ })).toBeHidden();

    await page.getByRole('button', { name: 'kawę', exact: true }).first().click();
    const bubble = page.getByTestId('word-bubble');
    await expect(bubble).toContainText('coffee');
    await expect(bubble.getByTestId('ending-decoder')).toContainText('kawa');
    await expect(bubble).toContainText('accusative');
    await page.getByRole('button', { name: 'mlekiem.', exact: true }).click();
    await expect(page.getByTestId('word-bubble')).toContainText('instrumental');

    await page.getByRole('button', { name: 'To the comprehension questions' }).click();
    await page.getByRole('button', { name: /^Mleko\./ }).click();
    await page.getByRole('button', { name: 'Next question' }).click();
    await page.getByRole('button', { name: /^Małą, z mlekiem\./ }).click();
    await page.getByRole('button', { name: 'Finish the story' }).click();
    await expect(page.getByText('Story complete!')).toBeVisible();
    await expect(page.getByText(/2 of 2 answers right · \+35 XP/)).toBeVisible();
    const p = await progress(page);
    expect(p.stories['kawa-dla-kota'].bestCorrect).toBe(2);
    expect(p.xp).toBeGreaterThanOrEqual(35);
    expect(await vibrations(page)).toBeGreaterThanOrEqual(2);
    expectNoErrors(errors);
  });
});

test.describe('Speed Blitz', () => {
  test('60-second round ends, saves the high score and awards XP', async ({ page }) => {
    await page.clock.install();
    const errors = await openApp(page, { lang: 'en' });
    await page.goto('/#/vocab');
    await page.getByRole('button', { name: /60-second Speed Blitz/ }).click();
    await expect(page.getByTestId('blitz-best')).toContainText('0');
    await page.getByRole('button', { name: 'Start!' }).click();
    await expect(page.getByTestId('blitz-time')).toHaveText('60');

    // Answer a few questions (some right, some wrong).
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('speed-blitz').locator('main .grid button').first().click();
      await page.clock.runFor(700);
    }
    await page.clock.runFor(61_000);
    await expect(page.getByTestId('blitz-over')).toBeVisible();
    const score = Number(await page.getByTestId('blitz-over').locator('p.text-5xl').textContent());
    const p = await progress(page);
    expect(p.blitz.plays).toBe(1);
    expect(p.blitz.best).toBe(score);
    expect(p.xp).toBe(score);
    expectNoErrors(errors);
  });
});

test.describe('hands-free audio mode', () => {
  test('runs the meaning → slow → normal → your turn loop by itself, pauses and resumes', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-speech', 'One run is enough – the mic pipeline is covered on desktop.');
    const errors = await openApp(page, { lang: 'en' });
    await page.getByRole('button', { name: /Driving & walking mode/ }).click();
    const phase = page.getByTestId('hf-phase');
    await expect(page.getByTestId('hf-counter')).toContainText('Word 1/16');
    await expect(phase).toContainText(/Polish – slowly/, { timeout: 20_000 });
    await expect(phase).toContainText(/Your turn – say it aloud!/, { timeout: 30_000 });
    // No taps: the loop records, gives feedback and moves on to the next word by itself.
    await expect(page.getByTestId('hf-counter')).toContainText('Word 2/16', { timeout: 60_000 });

    await page.getByTestId('hf-toggle').click();
    await expect(phase).toContainText('Paused');
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('hf-counter')).toContainText('Word 2/16');
    await page.getByTestId('hf-toggle').click();
    await expect(phase).not.toContainText('Paused');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByTestId('hf-counter')).toContainText('Word 3/16');
    await page.getByRole('button', { name: 'Exit' }).click();
    await expect(page.getByRole('heading', { name: 'Course map' })).toBeAttached();
    expectNoErrors(errors);
  });

  test('is also offered on the review tab', async ({ page }) => {
    const errors = await openApp(page, { lang: 'he' });
    await page.goto('/#/vocab');
    await page.getByRole('button', { name: /מצב נהיגה והליכה/ }).click();
    await expect(page.getByTestId('hands-free')).toBeVisible();
    await expect(page.getByTestId('hf-phase')).toBeVisible();
    await page.getByRole('button', { name: 'יציאה' }).click();
    await expect(page).toHaveURL(/#\/vocab$/);
    expectNoErrors(errors);
  });
});

test.describe('haptics switch', () => {
  test('turning vibration off in Settings stops all vibration', async ({ page }) => {
    await recordVibrations(page);
    const errors = await openApp(page, { lang: 'en', hash: '#/map/settings' });
    const sw = page.getByRole('switch', { name: 'Vibration' });
    await expect(sw).toBeChecked();
    await sw.uncheck();
    expect((await progress(page)).prefs.haptics).toBe(false);
    const before = await vibrations(page);
    await page.goto('/#/story/parasol');
    for (let i = 1; i < 8; i++) await page.getByRole('button', { name: /^Next line/ }).click();
    await page.getByRole('button', { name: 'To the comprehension questions' }).click();
    await page.getByRole('button', { name: /^Kawę\./ }).click();
    expect(await vibrations(page)).toBe(before);
    expectNoErrors(errors);
  });
});

test.describe('Dla Kasi', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`opens the angel screen, plays music, bursts magic and closes (${theme})`, async ({ page }) => {
      const errors = await openApp(page, { lang: 'he', theme, progress: { version: 2, xp: 123, items: { 'u1-01': { learned: true } }, lessons: { 'u1-L1': { completedAt: '2026-11-06', bestAccuracy: 90 } }, dialogues: {} } });
      const btn = page.getByTestId('kasia-button');
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText('Dla Kasi');
      await btn.click();

      const modal = page.getByTestId('kasia-modal');
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('heading', { name: 'Kasiu, jesteś moim małym aniołkiem' })).toBeVisible();
      await expect(modal).toContainText('קאשה, את המלאכית הקטנה שלי');
      await expect(modal).toContainText('Stworzyłem tę aplikację specjalnie dla Ciebie.');
      await expect(modal.locator('canvas')).toHaveCount(2);
      await expect(modal.locator('svg[aria-label="Kasia"]')).toBeVisible();

      // The live learning meter shows the real progress.
      const meter = page.getByTestId('kasia-meter');
      await expect(meter).toContainText('123');
      await expect(meter).toContainText('מילים');

      // Translation switch: Polish only, then English.
      await modal.getByRole('button', { name: 'PL', exact: true }).click();
      await expect(modal).not.toContainText('קאשה, את המלאכית הקטנה שלי');
      await modal.getByRole('button', { name: 'EN', exact: true }).click();
      await expect(modal).toContainText('Kasia, you are my little angel');

      // More magic: a new compliment card every tap.
      const magic = page.getByTestId('kasia-magic');
      await magic.click();
      const card = page.getByTestId('kasia-compliment');
      await expect(card).toBeVisible();
      const first = await card.locator('p').first().textContent();
      await magic.click();
      await expect(card.locator('p').first()).not.toHaveText(first ?? '');

      // The canvas really draws (non-transparent pixels on the burst layer right after a tap).
      await magic.click();
      await page.waitForTimeout(200);
      const painted = await page.evaluate(() => {
        const c = document.querySelectorAll<HTMLCanvasElement>('[data-testid="kasia-modal"] canvas')[1];
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4 * 50) if (d[i] > 0) n++;
        return n;
      });
      expect(painted).toBeGreaterThan(0);

      const mute = page.getByTestId('kasia-mute');
      await mute.click();
      await expect(mute).toHaveAttribute('aria-pressed', 'true');

      await page.screenshot({ path: `tests/e2e/screens/kasia-${theme}-${test.info().project.name}.png` });
      await modal.getByRole('button', { name: /Close/ }).click();
      await expect(modal).toBeHidden();
      await expect(page).toHaveURL(/#\/map$/);

      // Escape closes it too.
      await btn.click();
      await expect(modal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();
      expectNoErrors(errors);
    });
  }
});

test('Settings shows the current release', async ({ page }) => {
  const errors = await openApp(page, { lang: 'en', hash: '#/map/settings' });
  await expect(page.getByTestId('app-version')).toContainText(/v1\.\d+\.\d+/);
  expectNoErrors(errors);
});
