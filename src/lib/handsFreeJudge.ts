import type { RecorderResult } from '../hooks/useSpeechRecorder';
import { scorePronunciation } from './text';

/**
 * Verdict for one spoken attempt in the hands-free trainer.
 *
 * The rule that matters: an attempt is only ever "pass" with a real recognition score at or above
 * the threshold. Speech recognition returning nothing is exactly what happens with gibberish or a
 * different word, so "voice heard but nothing recognized" counts as a miss, never as success.
 *   pass       recognized and close enough to the target
 *   low        recognized, but not close enough (wrong word, mispronounced)
 *   unclear    a voice was heard but no Polish word was recognized
 *   silent     no voice reached the microphone
 *   unchecked  this device cannot verify speech (no recognition service) – the learner self-compares
 */
export type Outcome = 'pass' | 'low' | 'unclear' | 'silent' | 'unchecked';

/** Minimum recognition score that counts as saying the phrase correctly. */
export const HANDS_FREE_PASS = 70;

/** Recognition errors that mean "the service cannot check speech here", not "you said it wrong". */
const UNAVAILABLE_STT = new Set(['network', 'not-allowed', 'service-not-allowed', 'language-not-supported', 'audio-capture', 'unsupported']);

export interface Verdict {
  outcome: Outcome;
  score: number | null;
  /** What the recognizer heard (empty when nothing was recognized). */
  heard: string;
}

export function judgeAttempt(target: string, res: RecorderResult | null): Verdict {
  if (!res) return { outcome: 'unclear', score: null, heard: '' };
  if (res.recognized && res.transcript.trim()) {
    const score = scorePronunciation(target, res.transcript).score;
    return { outcome: score >= HANDS_FREE_PASS ? 'pass' : 'low', score, heard: res.transcript };
  }
  if (!res.heardVoice) return { outcome: 'silent', score: null, heard: '' };
  if (res.mode === 'record' || (res.sttError && UNAVAILABLE_STT.has(res.sttError))) return { outcome: 'unchecked', score: null, heard: '' };
  return { outcome: 'unclear', score: null, heard: '' };
}

/**
 * Help given after the n-th miss on the same word (n = 1, 2, …). The learner keeps trying until
 * the word passes; each round adds a different kind of help.
 *   replay  – the phrase slowly, then at normal speed
 *   chunks  – backchaining: the phrase built up from its end, then the whole phrase
 *   tip     – the articulation tip (tongue / lips), then the phrase slowly
 */
export type Help = 'replay' | 'chunks' | 'tip';

export function helpForMiss(n: number): Help {
  if (n <= 1) return 'replay';
  if (n === 2) return 'chunks';
  if (n === 3) return 'tip';
  return n % 2 === 0 ? 'chunks' : 'replay';
}

/** After this many misses on one word the trainer reminds the learner that skipping is possible. */
export const SKIP_HINT_AFTER = 5;
/** Consecutive silent attempts after which the trainer pauses instead of looping forever. */
export const SILENT_PAUSE_AFTER = 3;
