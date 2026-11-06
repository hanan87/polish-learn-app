/**
 * Polish text-to-speech on top of window.speechSynthesis.
 *
 * Cross-browser notes:
 *  - Voices load asynchronously (Chrome fires `voiceschanged`; iOS often returns them only after first use).
 *  - Chrome may garbage-collect an utterance mid-speech so `onend` never fires: keep a module-level reference.
 *  - iOS / some Android builds occasionally never fire `onend`: a length-based timeout resolves the promise.
 *  - Chrome on Android can get stuck in a paused state: call resume() before speaking.
 */

import { ttsSupported } from './env';

export const RATE_NORMAL = 1.0;
export const RATE_SLOW = 0.6;
export const RATE_CHAIN = 0.85;

let cachedVoice: SpeechSynthesisVoice | null | undefined;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let cancelToken = 0;

function findPolishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const polish = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('pl'));
  if (!polish.length) return null;
  // Prefer high-quality network voices (e.g. "Google polski"), then local ones.
  return polish.find((v) => /google|natural|online|enhanced|premium/i.test(v.name)) ?? polish[0];
}

export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice | null> {
  if (!ttsSupported) return Promise.resolve(null);
  if (cachedVoice !== undefined && cachedVoice !== null) return Promise.resolve(cachedVoice);
  const now = findPolishVoice();
  if (now || window.speechSynthesis.getVoices().length > 0) {
    cachedVoice = now;
    return Promise.resolve(now);
  }
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      cachedVoice = findPolishVoice();
      resolve(cachedVoice);
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    setTimeout(done, timeoutMs);
  });
}

export function hasPolishVoice(): boolean {
  return ttsSupported && findPolishVoice() !== null;
}

export function stopSpeaking(): void {
  cancelToken++;
  if (ttsSupported) window.speechSynthesis.cancel();
  activeUtterance = null;
}

/** Speak Polish text. Resolves when speech ends (or is cancelled). */
export function speak(text: string, rate: number = RATE_NORMAL): Promise<void> {
  if (!ttsSupported || !text.trim()) return Promise.resolve();
  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pl-PL';
  const voice = cachedVoice ?? findPolishVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = rate;
  utterance.pitch = 1;
  activeUtterance = utterance;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (activeUtterance === utterance) activeUtterance = null;
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    const estimatedMs = (900 + text.length * 120) / rate;
    setTimeout(finish, estimatedMs + 2500);
    synth.speak(utterance);
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Speak several texts one after another with a pause between them.
 * `onStep` is called with the index about to be spoken. Stops early if stopSpeaking() is called.
 */
export async function speakSequence(
  texts: string[],
  rate: number,
  onStep?: (index: number) => void,
  gapMs = 650,
): Promise<boolean> {
  const token = ++cancelToken;
  for (let i = 0; i < texts.length; i++) {
    if (token !== cancelToken) return false;
    onStep?.(i);
    await speak(texts[i], rate);
    if (token !== cancelToken) return false;
    if (i < texts.length - 1) await wait(gapMs);
  }
  return token === cancelToken;
}
