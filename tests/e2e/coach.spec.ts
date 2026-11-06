import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, openApp } from './helpers';

/**
 * "It said Excellent even when I spoke gibberish": the trainer must say a miss is a miss, help,
 * and keep the learner on the same word until it is really said correctly.
 * A mock SpeechRecognition returns whatever window.__sttText holds ('' = nothing recognized);
 * Chrome's fake microphone supplies real audio so voice detection runs for real.
 */
async function mockRecognition(page: Page, initial: string) {
  await page.addInitScript((text) => {
    type Handler = ((e?: unknown) => void) | null;
    const w = window as unknown as Record<string, unknown> & { __sttText: string };
    w.__sttText = text;
    class MockRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: Handler = null;
      onsoundstart: Handler = null;
      onspeechstart: Handler = null;
      private timer: number | undefined;
      private live = false;
      start() {
        this.live = true;
        this.timer = window.setTimeout(() => {
          this.onsoundstart?.();
          if (w.__sttText) {
            const alt = Object.assign([{ transcript: w.__sttText, confidence: 0.9 }], { isFinal: true });
            this.onresult?.({ resultIndex: 0, results: [alt] });
          }
          this.finish();
        }, 1200);
      }
      stop() {
        window.clearTimeout(this.timer);
        this.finish();
      }
      abort() {
        window.clearTimeout(this.timer);
        this.finish();
      }
      private finish() {
        if (!this.live) return;
        this.live = false;
        window.setTimeout(() => this.onend?.(), 10);
      }
    }
    w.SpeechRecognition = MockRecognition;
    w.webkitSpeechRecognition = MockRecognition;
  }, initial);
}

const setHeard = (page: Page, text: string) => page.evaluate((t) => ((window as unknown as { __sttText: string }).__sttText = t), text);

test.describe('hands-free coaching', () => {
  test('gibberish is a miss: it says so, helps, stays on the word – and passes only when correct', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile-speech', 'Desktop run is enough for the timing-heavy loop.');
    test.setTimeout(240_000);
    await mockRecognition(page, 'bla bla bla');
    const errors = await openApp(page, { lang: 'en', hash: '#/handsfree/map' });
    const phase = page.getByTestId('hf-phase');
    const counter = page.getByTestId('hf-counter');
    await expect(counter).toContainText('Word 1/16');

    // First attempt with gibberish → told it is wrong, shown what was heard, never praised.
    await expect(phase).toContainText('Not quite', { timeout: 60_000 });
    await expect(page.getByTestId('hf-heard')).toContainText('bla bla bla');
    await expect(phase).not.toContainText('Excellent');
    // Help, then a second attempt on the SAME word.
    await expect(page.getByTestId('hf-attempt')).toContainText('Attempt 2', { timeout: 60_000 });
    await expect(counter).toContainText('Word 1/16');

    // Nothing recognized at all → "I didn't recognize the word" (still a miss, still the same word).
    await setHeard(page, '');
    await expect(phase).toContainText("I didn't recognize the word", { timeout: 60_000 });
    await expect(counter).toContainText('Word 1/16');

    // Now the learner says it right → praised, and only then the next word.
    await setHeard(page, 'szkoła');
    await expect(phase).toContainText(/Very good, you got it!|Excellent!/, { timeout: 90_000 });
    await expect(counter).toContainText('Word 2/16', { timeout: 30_000 });
    await expect(page.getByText(/1 passed · [1-9]\d* corrections/)).toBeVisible();
    expectNoErrors(errors);
  });
});

test.describe('lesson pronunciation check', () => {
  test('an unrecognized word is a miss with a clear message – no "sounds like the speaker" shortcut', async ({ page }) => {
    await mockRecognition(page, '');
    const errors = await openApp(page, { lang: 'en', hash: '#/map/item/u1-01' });
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByTestId('unrecognized')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('0%').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sounds like the speaker' })).toHaveCount(0);

    // Gibberish that is recognized as other words is scored low and shows the words in red.
    await setHeard(page, 'bla bla');
    await page.getByRole('button', { name: /Start recording|Try again/ }).first().click();
    await expect(page.getByText('Heard:')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Excellent! Clear pronunciation')).toHaveCount(0);
    expectNoErrors(errors);
  });
});
