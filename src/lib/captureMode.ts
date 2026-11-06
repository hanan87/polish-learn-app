import { getRecognizerCtor } from './env';
import { sttSession } from './micLog';

/**
 * How a pronunciation attempt captures the learner's voice.
 *  - both:   MediaRecorder (own-voice playback) + SpeechRecognition (score) in parallel. Reliable on desktop.
 *  - stt:    SpeechRecognition only. Phones often give the microphone to only one consumer, so this keeps scoring working.
 *  - record: MediaRecorder only (no score: self-assessment). Fallback when speech recognition is unavailable.
 *  - auto:   start with 'both' and switch when an attempt shows the device cannot share the microphone
 *            (dead analyser while recognition works -> 'stt'; recognition blocked -> 'record'). Stored per browser.
 */
export type CaptureMode = 'both' | 'stt' | 'record';
export type CapturePreference = CaptureMode | 'auto';

const PREF_KEY = 'polish-learn:capture-mode';
const LEARNED_KEY = 'polish-learn:capture-auto';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage disabled: the choice lasts for this page only.
  }
}

export function getCapturePreference(): CapturePreference {
  const v = read(PREF_KEY);
  return v === 'both' || v === 'stt' || v === 'record' ? v : 'auto';
}

export function setCapturePreference(p: CapturePreference) {
  write(PREF_KEY, p === 'auto' ? null : p);
}

export function getLearnedMode(): CaptureMode | null {
  const v = read(LEARNED_KEY);
  return v === 'both' || v === 'stt' || v === 'record' ? v : null;
}

/** Called by the recorder when an attempt shows that the current automatic mode does not work on this device. */
export function learnMode(mode: CaptureMode | null) {
  write(LEARNED_KEY, mode);
}

export function sttAvailable(): boolean {
  return !!getRecognizerCtor() && !sttSession.disabled;
}

/** The mode used for the next attempt. */
export function resolveCaptureMode(): CaptureMode {
  const pref = getCapturePreference();
  const stt = sttAvailable();
  if (pref === 'record') return 'record';
  if (pref === 'stt' || pref === 'both') return stt ? pref : 'record';
  const learned = getLearnedMode();
  if (learned) return learned === 'record' || stt ? learned : 'record';
  return stt ? 'both' : 'record';
}
