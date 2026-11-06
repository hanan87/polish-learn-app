/**
 * Polish speech output.
 *
 * Order of preference for every phrase:
 *   1. a pre-recorded neural clip (lib/voiceClips – Azure Zofia / Marek), unless the learner turned it off
 *   2. the device voice the learner picked in Settings
 *   3. the best Polish device voice we can find (Edge "Natural", Google, iOS Enhanced…)
 *
 * Device-voice notes:
 * Cross-browser notes:
 *  - Voices load asynchronously (Chrome fires `voiceschanged`; iOS often returns them only after first use).
 *  - Chrome may garbage-collect an utterance mid-speech so `onend` never fires: keep a module-level reference.
 *  - iOS / some Android builds occasionally never fire `onend`: a length-based timeout resolves the promise.
 *  - Chrome on Android can get stuck in a paused state: call resume() before speaking.
 */

import { ttsSupported } from './env';
import { clipPlaying, findClip, playClip, stopClip, type ClipVoice } from './voiceClips';

export const RATE_NORMAL = 1.0;
export const RATE_SLOW = 0.6;
export const RATE_CHAIN = 0.85;

let cachedVoice: SpeechSynthesisVoice | null | undefined;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let cancelToken = 0;

const VOICE_PREF_KEY = 'polish-learn:device-voice';

/** Quality rank of a device voice: neural "Natural" voices first, robotic legacy voices last. */
export function voiceRank(v: { name: string; localService?: boolean }): number {
  const n = v.name;
  if (/natural|neural/i.test(n)) return 0;
  if (/premium|enhanced|siri/i.test(n)) return 1;
  if (/online/i.test(n)) return 2;
  if (/google/i.test(n)) return 3;
  return v.localService === false ? 4 : 5;
}

export function polishVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('pl'))
    .sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name));
}

export function getPreferredVoiceURI(): string | null {
  try {
    return localStorage.getItem(VOICE_PREF_KEY);
  } catch {
    return null;
  }
}

export function setPreferredVoiceURI(uri: string | null): void {
  try {
    if (uri) localStorage.setItem(VOICE_PREF_KEY, uri);
    else localStorage.removeItem(VOICE_PREF_KEY);
  } catch {
    // Storage disabled: keep the in-memory choice only.
  }
  cachedVoice = undefined;
}

function findPolishVoice(): SpeechSynthesisVoice | null {
  const polish = polishVoices();
  if (!polish.length) return null;
  const preferred = getPreferredVoiceURI();
  return (preferred && polish.find((v) => v.voiceURI === preferred)) || polish[0];
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
  stopClip();
  if (ttsSupported) window.speechSynthesis.cancel();
  activeUtterance = null;
}

/** True while a clip or the device voice is talking (the microphone engine waits for silence). */
export function isSpeaking(): boolean {
  return clipPlaying() || (ttsSupported && (window.speechSynthesis.speaking || window.speechSynthesis.pending));
}

/** Who says the phrase in stories / conversations: female (Zofia, default teacher) or male (Marek). */
export type Speaker = 'f' | 'm';

/**
 * Speak Polish text. Resolves when speech ends (or is cancelled).
 * Slow rates use the clip synthesized slowly; other rates play the normal clip at that speed.
 */
export async function speak(text: string, rate: number = RATE_NORMAL, speaker: Speaker = 'f'): Promise<void> {
  if (!text.trim()) return;
  const slow = rate <= 0.7;
  const voice: ClipVoice = speaker === 'm' ? 'pl-m' : 'pl-f';
  const clip = findClip(text, slow ? 's' : 'n', voice);
  if (clip) {
    if (ttsSupported) window.speechSynthesis.cancel();
    const played = await playClip(clip, slow ? 1 : Math.max(0.7, Math.min(1.2, rate)));
    if (played) return;
  }
  return speakDevice(text, rate);
}

/** Device-voice speech (window.speechSynthesis). */
function speakDevice(text: string, rate: number): Promise<void> {
  if (!ttsSupported || !text.trim()) return Promise.resolve();
  stopClip();
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

/** Best installed voice for a language prefix ('he', 'en'), or null. */
export function findVoiceFor(prefix: string): SpeechSynthesisVoice | null {
  if (!ttsSupported) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith(prefix));
  if (!voices.length) return null;
  return voices.find((v) => /google|natural|online|enhanced|premium/i.test(v.name)) ?? voices[0];
}

/**
 * Speak a translation in the learner's language (Hebrew or English).
 * Resolves false without speaking when the device has no voice for that language.
 */
export async function speakNative(text: string, lang: 'he' | 'en', rate = 1): Promise<boolean> {
  const clip = findClip(text, 'n', lang);
  if (clip && (await playClip(clip, rate))) return true;
  return speakNativeDevice(text, lang, rate);
}

function speakNativeDevice(text: string, lang: 'he' | 'en', rate: number): Promise<boolean> {
  const voice = findVoiceFor(lang === 'he' ? 'he' : 'en');
  // Older engines report Hebrew as "iw".
  const fallback = lang === 'he' ? findVoiceFor('iw') : null;
  const v = voice ?? fallback;
  if (!v || !text.trim()) return Promise.resolve(false);
  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = v.lang;
  utterance.voice = v;
  utterance.rate = rate;
  activeUtterance = utterance;
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (activeUtterance === utterance) activeUtterance = null;
      resolve(true);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    setTimeout(finish, (900 + text.length * 110) / rate + 2500);
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
  speakers?: Speaker[],
): Promise<boolean> {
  const token = ++cancelToken;
  for (let i = 0; i < texts.length; i++) {
    if (token !== cancelToken) return false;
    onStep?.(i);
    await speak(texts[i], rate, speakers?.[i] ?? 'f');
    if (token !== cancelToken) return false;
    if (i < texts.length - 1) await wait(gapMs);
  }
  return token === cancelToken;
}
