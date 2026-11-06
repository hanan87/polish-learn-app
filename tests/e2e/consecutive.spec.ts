import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, openApp } from './helpers';

/**
 * Regression test for "the microphone only works on the first recording".
 * Three recordings in a row on the same screen, with TTS playback and the voice comparison in
 * between. Chrome's fake device supplies real audio; a mock SpeechRecognition returns the target
 * phrase so the scoring path runs, and counts how many recognizers are alive at the same time.
 */

async function installMockRecognition(page: Page, transcript: string) {
  await page.addInitScript((text) => {
    type Handler = ((e?: unknown) => void) | null;
    const state = { transcript: text, starts: 0, aborts: 0, active: new Set<unknown>(), maxActive: 0 };
    (window as unknown as { __stt: typeof state }).__stt = state;
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
      start() {
        if (state.active.has(this)) throw new DOMException('already started', 'InvalidStateError');
        state.starts++;
        state.active.add(this);
        state.maxActive = Math.max(state.maxActive, state.active.size);
        this.timer = window.setTimeout(() => {
          this.onsoundstart?.();
          const alt = Object.assign([{ transcript: state.transcript, confidence: 0.92 }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [alt] });
          this.finish();
        }, 1400);
      }
      stop() {
        window.clearTimeout(this.timer);
        this.finish();
      }
      abort() {
        state.aborts++;
        window.clearTimeout(this.timer);
        this.finish();
      }
      private finish() {
        if (!state.active.has(this)) return;
        state.active.delete(this);
        window.setTimeout(() => this.onend?.(), 10);
      }
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = MockRecognition;
    w.webkitSpeechRecognition = MockRecognition;
  }, transcript);
}

async function recordOnce(page: Page, n: number) {
  await page.getByRole('button', { name: 'Start recording' }).click();
  // The level meter must rise above zero and turn green: the analyser receives real samples.
  const meter = page.getByRole('meter', { name: 'Input level' });
  await expect(meter).toBeVisible();
  await expect(page.getByText('We hear you')).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => Number(await meter.getAttribute('aria-valuenow')), { message: `level on recording ${n}` }).toBeGreaterThan(0);
  // A valid score from the (mock) recognizer.
  await expect(page.getByText('Heard:')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Excellent! Clear pronunciation')).toBeVisible();
  await expect(page.getByText('100%').first()).toBeVisible();
  await expect(page.getByText('No sound was captured.')).toHaveCount(0);
}

/**
 * Models the failure seen on phones: the microphone is exclusive. While a speech recognizer is
 * still alive (stop() does not release it – only abort() or a long timeout does) or TTS is speaking,
 * getUserMedia returns a channel of digital silence. An engine that does not fully release the
 * previous recognizer and cancel TTS gets a dead channel from the second recording on.
 */
async function installExclusiveMicModel(page: Page, transcript: string) {
  await page.addInitScript((text) => {
    type Handler = ((e?: unknown) => void) | null;
    const state = { transcript: text, starts: 0, aborts: 0, active: new Set<unknown>(), maxActive: 0, silentStreams: 0 };
    (window as unknown as { __stt: typeof state }).__stt = state;

    const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c?: MediaStreamConstraints) => {
      if (state.active.size > 0 || window.speechSynthesis.speaking) {
        state.silentStreams++;
        const ctx = new AudioContext();
        const src = ctx.createConstantSource();
        src.offset.value = 0;
        const dest = ctx.createMediaStreamDestination();
        src.connect(dest);
        src.start();
        return dest.stream;
      }
      return realGUM(c);
    };

    class HoggingRecognition {
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
      private linger: number | undefined;
      start() {
        state.starts++;
        state.active.add(this);
        state.maxActive = Math.max(state.maxActive, state.active.size);
        this.timer = window.setTimeout(() => {
          this.onsoundstart?.();
          const alt = Object.assign([{ transcript: state.transcript, confidence: 0.92 }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [alt] });
        }, 1200);
      }
      stop() {
        // Like a busy recognizer service: keeps the microphone for a long time after stop().
        window.clearTimeout(this.timer);
        this.linger = window.setTimeout(() => this.release(), 15000);
      }
      abort() {
        state.aborts++;
        window.clearTimeout(this.timer);
        window.clearTimeout(this.linger);
        this.release();
      }
      private release() {
        if (!state.active.has(this)) return;
        state.active.delete(this);
        window.setTimeout(() => this.onend?.(), 10);
      }
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = HoggingRecognition;
    w.webkitSpeechRecognition = HoggingRecognition;
  }, transcript);
}

test.describe('exclusive microphone (phone-like) model', () => {
  test('3 recordings in a row still capture sound when the recognizer and TTS hold the mic', async ({ page }) => {
    await installExclusiveMicModel(page, 'Dzień dobry');
    await openApp(page, { lang: 'en', hash: '#/map/item/u2-01' });
    await recordOnce(page, 1);
    await page.getByRole('button', { name: 'Play at normal speed' }).click();
    await page.waitForTimeout(300);
    await recordOnce(page, 2);
    await page.getByRole('button', { name: /Compare voices/ }).click();
    await page.waitForTimeout(300);
    await recordOnce(page, 3);
    const s = await page.evaluate(() => (window as unknown as { __stt: { silentStreams: number; active: Set<unknown> } }).__stt);
    // The engine must have released the recognizer before asking for the mic again.
    expect(s.silentStreams).toBe(0);
  });
});

test.describe('zero-signal watchdog', () => {
  test('a dead (all-zero) channel on the second recording is rebuilt automatically', async ({ page }) => {
    // The 2nd getUserMedia call returns a live, unmuted track that carries only digital silence.
    await page.addInitScript(() => {
      let calls = 0;
      const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c?: MediaStreamConstraints) => {
        calls++;
        if (calls !== 2) return realGUM(c);
        const ctx = new AudioContext();
        const src = ctx.createConstantSource();
        src.offset.value = 0;
        const dest = ctx.createMediaStreamDestination();
        src.connect(dest);
        src.start();
        return dest.stream;
      };
    });
    await openApp(page, { lang: 'en', hash: '#/map/settings' });
    for (let i = 1; i <= 2; i++) {
      await page.getByRole('button', { name: 'Start test' }).click();
      await expect(page.getByText('Voice detected')).toBeVisible({ timeout: 12_000 });
      await expect(page.locator('ul').filter({ hasText: 'Voice captured' })).toContainText('Recording saved:yes', { timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Start test' })).toBeVisible({ timeout: 10_000 });
    }
    await page.getByText('Event log').click();
    const log = await page.locator('details ol').innerText();
    expect(log).toContain('watchdog-restart');
    expect(log).toContain('audio-context-rebuilt');
    expect((log.match(/voice-detected/g) ?? []).length).toBe(2);
  });
});

test.describe('consecutive recordings on the same screen', () => {
  test('3 recordings with TTS and voice comparison in between all capture real sound and score', async ({ page }) => {
    await installMockRecognition(page, 'Dzień dobry');
    const errors = await openApp(page, { lang: 'en', hash: '#/map/item/u2-01' });

    // Recording 1
    await recordOnce(page, 1);

    // TTS playback, then recording 2
    await page.getByRole('button', { name: 'Play at normal speed' }).click();
    await page.waitForTimeout(800);
    await recordOnce(page, 2);

    // Voice comparison (TTS + own recording), then recording 3
    const compare = page.getByRole('button', { name: /Compare voices/ });
    await compare.click();
    await expect(compare).toBeEnabled({ timeout: 20_000 });
    await recordOnce(page, 3);

    const stt = await page.evaluate(() => {
      const s = (window as unknown as { __stt: { starts: number; maxActive: number; active: Set<unknown> } }).__stt;
      return { starts: s.starts, maxActive: s.maxActive, stillActive: s.active.size };
    });
    // Never two recognizers holding the microphone at once, and none left running afterwards.
    expect(stt.maxActive).toBe(1);
    expect(stt.stillActive).toBe(0);
    expect(stt.starts).toBeGreaterThanOrEqual(3);

    expectNoErrors(errors);
  });

  test('the "I\'m done speaking" button always stops immediately', async ({ page }) => {
    await installMockRecognition(page, 'Dzień dobry');
    await openApp(page, { lang: 'en', hash: '#/map/item/u2-01' });
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Start recording' }).click();
      const done = page.getByRole('button', { name: /I'm done speaking/ });
      await expect(done).toBeVisible();
      await page.waitForTimeout(600);
      await done.click();
      await expect(done).toHaveCount(0, { timeout: 8_000 });
      await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('the microphone test can be run three times in a row', async ({ page }) => {
    await openApp(page, { lang: 'en', hash: '#/map/settings' });
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: 'Start test' }).click();
      await expect(page.getByText('Voice detected')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('ul').filter({ hasText: 'Voice captured' })).toContainText('Recording saved:yes', { timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Start test' })).toBeVisible({ timeout: 10_000 });
    }
    await page.getByText('Event log').click();
    const log = await page.locator('details ol').innerText();
    expect((log.match(/voice-detected/g) ?? []).length).toBe(3);
    expect(log).not.toContain('analyser-dead');
  });
});
