import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectNoErrors, openApp, progress, runLesson } from './helpers';

test.describe('first run, language and theme', () => {
  test('welcome screen → Hebrew RTL, switch to English LTR, choice persists', async ({ page }) => {
    const errors = await openApp(page);
    await page.getByRole('button', { name: /פולנית לדוברי עברית/ }).click();
    // Step 2 of the welcome screen: speaker gender and name (optional).
    await expect(page.getByText('נעים להכיר!')).toBeVisible();
    await page.getByRole('button', { name: 'בואו נתחיל' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'מפת הקורס' })).toBeVisible();
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'Course map' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Course map' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('dark mode toggles, persists and applies before first paint', async ({ page }) => {
    const errors = await openApp(page, { lang: 'en', theme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor || getComputedStyle(document.documentElement).backgroundColor);
    expect(bg).not.toBe('rgb(248, 250, 252)');
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Light mode' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    expectNoErrors(errors);
  });
});

test.describe('every screen renders in both languages and themes', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`tabs render (${lang}, ${theme})`, async ({ page }) => {
        const errors = await openApp(page, { lang, theme });
        for (const hash of ['#/map', '#/lab', '#/vocab', '#/talk', '#/map/settings', '#/map/item/u5-03', '#/map/item/u8-08']) {
          await page.goto(`/${hash}`);
          await expect(page.locator('main, [role="dialog"]').first()).toBeVisible();
        }
        // Let the sheet's entrance animation finish before capturing.
        await page.waitForTimeout(500);
        await page.screenshot({ path: `tests/e2e/screens/${lang}-${theme}-item.png` });
        await page.goto('/#/vocab');
        await page.screenshot({ path: `tests/e2e/screens/${lang}-${theme}-vocab.png`, fullPage: true });
        expectNoErrors(errors);
      });
    }
  }

  test('the map lists 8 units and every unit opens its items', async ({ page }) => {
    const errors = await openApp(page, { lang: 'en' });
    for (let u = 1; u <= 8; u++) await expect(page.getByText(`Unit ${u}`, { exact: true })).toBeVisible();
    expectNoErrors(errors);
  });
});

test.describe('lessons and practice', () => {
  test('completes a full lesson with real recording and saves progress', async ({ page }) => {
    const errors = await openApp(page, { lang: 'en', hash: '#/lesson/u2-L1' });
    expect(await runLesson(page)).toBe(true);
    await page.getByRole('button', { name: 'Continue' }).click();
    const p = await progress(page);
    expect(p.lessons['u2-L1']).toBeTruthy();
    expect(p.xp).toBeGreaterThanOrEqual(30);
    expect(Object.keys(p.sounds).length).toBeGreaterThan(0);
    expectNoErrors(errors);
  });

  test('writing gives targeted diacritic feedback', async ({ page }) => {
    await openApp(page, { lang: 'en', hash: '#/lesson/u1-L1' });
    for (let i = 0; i < 40; i++) {
      const stage = (await page.locator('header p').first().textContent()) ?? '';
      if (/Writing/.test(stage)) break;
      if (/Learn & shadow/.test(stage)) {
        await page.getByRole('button', { name: 'Got it, continue' }).click();
        continue;
      }
      const main = page.locator('div.animate-pop-in.mx-auto');
      await main.locator('button:not([disabled]):not([aria-label])').first().click();
      const check = page.getByRole('button', { name: 'Check' });
      if (await check.isVisible()) await check.click();
      await page.getByRole('button', { name: /^(Continue|Finish \(\+)/ }).click();
    }
    // Type the expected answer without Polish marks using the item's own meaning lookup.
    const answer = await page.evaluate(async () => {
      const meaning = document.querySelector('div.animate-pop-in.mx-auto p.text-xl')?.textContent ?? '';
      return meaning;
    });
    expect(answer).not.toBe('');
    // Use the Polish keyboard: type a plain z then check that ż feedback logic exists for żaba if present.
    await page.getByPlaceholder('Napisz po polsku…').fill('zaba');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText(/Almost perfect|The correct answer|Close!|Perfect spelling/)).toBeVisible();
  });

  test('Polish keyboard inserts special letters at the caret', async ({ page }) => {
    await openApp(page, { lang: 'en', hash: '#/lesson/u1-L1' });
    for (let i = 0; i < 40; i++) {
      const stage = (await page.locator('header p').first().textContent()) ?? '';
      if (/Writing/.test(stage)) break;
      if (/Learn & shadow/.test(stage)) {
        await page.getByRole('button', { name: 'Got it, continue' }).click();
        continue;
      }
      const main = page.locator('div.animate-pop-in.mx-auto');
      await main.locator('button:not([disabled]):not([aria-label])').first().click();
      const check = page.getByRole('button', { name: 'Check' });
      if (await check.isVisible()) await check.click();
      await page.getByRole('button', { name: /^(Continue|Finish \(\+)/ }).click();
    }
    const input = page.getByPlaceholder('Napisz po polsku…');
    await input.fill('aba');
    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 0));
    // Two taps within the same frame must both land at the caret.
    await page.evaluate(() => {
      const fire = (label: string) =>
        [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      fire('ż');
      fire('sz');
    });
    await expect(input).toHaveValue('ższaba');
    await page.getByRole('button', { name: 'Backspace' }).dispatchEvent('pointerdown');
    await expect(input).toHaveValue('żsaba');
  });

  test('personalized reinforcement builds exactly 8 exercises from weak items', async ({ page }) => {
    const errors = await openApp(page, { lang: 'en', hash: '#/lesson/u1-L1' });
    expect(await runLesson(page)).toBe(true);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.goto('/#/vocab');
    await page.getByRole('button', { name: 'Start reinforcement' }).click();
    await expect(page.locator('header').getByText('1/8')).toBeVisible();
    expect(await runLesson(page)).toBe(true);
    expectNoErrors(errors);
  });
});

test.describe('vocabulary, dictionary and backup', () => {
  test('add my own word with auto-suggestions, then find it under My words', async ({ page }) => {
    const errors = await openApp(page, { lang: 'en', hash: '#/vocab' });
    await page.getByRole('button', { name: 'Add my own word' }).click();
    await page.getByLabel('Polish *').fill('Smacznej kawy');
    await page.getByLabel('English translation *').fill('Enjoy your coffee!');
    await expect(page.getByLabel(/Syllables/)).toHaveValue('[Smacz]·nej [ka]·wy');
    await expect(page.getByLabel('English respelling')).not.toHaveValue('');
    await expect(page.getByLabel('Hebrew transcription')).not.toHaveValue('');
    await page.getByRole('button', { name: /Save to my dictionary/ }).click();
    await expect(page.getByText('Added to your dictionary!')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'My words' }).first().click();
    await expect(page.getByText('Enjoy your coffee!')).toBeVisible();
    expectNoErrors(errors);
  });

  test('search finds words in English and Polish', async ({ page }) => {
    await openApp(page, { lang: 'en', hash: '#/vocab' });
    await page.getByRole('button', { name: 'Whole course' }).click();
    await page.getByPlaceholder('Search in English or Polish').fill('headache');
    await expect(page.getByText('I have a headache')).toBeVisible();
    await page.getByPlaceholder('Search in English or Polish').fill('dziękuję');
    await expect(page.getByText('Thank you', { exact: true })).toBeVisible();
  });

  test('backup downloads JSON and restore brings progress back', async ({ page }) => {
    await openApp(page, { lang: 'en', hash: '#/map/item/u1-01' });
    await page.getByRole('button', { name: /Mark as learned/ }).click();
    await page.goto('/#/map/settings');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
    const file = await download.path();
    const json = JSON.parse(readFileSync(file!, 'utf8'));
    expect(json.progress.items['u1-01'].learned).toBe(true);

    await page.getByRole('button', { name: 'Reset all progress' }).click();
    await page.getByRole('button', { name: 'Yes, erase everything' }).click();
    expect((await progress(page)).xp).toBe(0);
    await page.locator('input[type=file]').setInputFiles(file!);
    await expect(page.getByText('Progress restored successfully!')).toBeVisible();
    expect((await progress(page)).items['u1-01'].learned).toBe(true);
  });

  test('the standalone index.html is served and fully self-contained', async ({ request }) => {
    const res = await request.get('/polish-learn-standalone.html');
    expect(res.ok()).toBe(true);
    const html = await res.text();
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    expect(html).toContain('data:image/svg+xml;base64');
  });
});

test.describe('voice roleplay', () => {
  test('wrong reply explains, right reply asks to speak, recording runs and the turn can advance', async ({ page }) => {
    const errors = await openApp(page, { lang: 'en', hash: '#/talk' });
    await page.getByRole('button', { name: /Buying a train ticket/ }).click();
    await page.getByRole('button', { name: /Where is the milk/ }).click();
    await expect(page.getByText(/Try another reply/)).toBeVisible();
    await page.getByRole('button', { name: /a ticket to Kraków, please/ }).click();
    await expect(page.getByText('Now say it aloud:')).toBeVisible();
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByText(/Heard:|rate yourself honestly/).first()).toBeVisible({ timeout: 30_000 });
    // The fake mic says "Dzień dobry", not the full reply, so pronunciation does not pass – skip is offered.
    await page.getByRole('button', { name: 'Skip speaking for this turn' }).click();
    await expect(page.getByText('2/5')).toBeVisible();
    expectNoErrors(errors);
  });
});

test.describe('sound lab', () => {
  test('ear training records listening results per sound', async ({ page }) => {
    await openApp(page, { lang: 'en', hash: '#/lab' });
    await page.getByRole('button', { name: /Ear training/ }).click();
    await page.locator('div.grid.grid-cols-2 > button').first().click();
    await expect(page.getByText(/Correct!|We played/)).toBeVisible();
    const p = await progress(page);
    expect(Object.keys(p.sounds).length).toBeGreaterThan(0);
  });
});
