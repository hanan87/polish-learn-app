import { useCallback, useEffect, useRef, useState } from 'react';
import {
  closeCapture,
  getAudioContext,
  getFreshStream,
  killRecognizer,
  measureBlobPeak,
  openCapture,
  rebuildAudioContext,
  stopRecorder,
  type Capture,
} from '../lib/audioEngine';
import { getCapturePreference, learnMode, resolveCaptureMode, type CaptureMode } from '../lib/captureMode';
import { getRecognizerCtor, isAndroid, ttsSupported, type Recognizer } from '../lib/env';
import { micLog, sttSession } from '../lib/micLog';
import { normalize, similarity } from '../lib/text';
import { stopSpeaking } from '../lib/tts';
import { useMic } from '../state/MicContext';

/**
 * Pronunciation capture engine.
 *
 * Capture modes (see lib/captureMode): 'both' runs MediaRecorder + AnalyserNode (own-voice playback,
 * level meter, voice-activity detection) in parallel with SpeechRecognition (score); 'stt' uses
 * speech recognition only; 'record' uses the recorder only.
 *
 * Lifecycle guarantees – each one fixes a failure seen on real devices:
 *   - Before every attempt: pending TTS is cancelled (it can hold the audio session), the previous
 *     recognizer is aborted with all listeners removed, and the previous stream, nodes and recorder
 *     are fully released. A fresh MediaStream is requested and checked to be live and unmuted, and
 *     the shared AudioContext is resumed after the stream exists.
 *   - Zero-signal watchdog: if the analyser returns exact digital silence for 1.5 s, the context
 *     and stream are rebuilt once; if that does not help, VAD is disabled for this attempt and the
 *     learner finishes with the manual stop button (scoring still works through recognition).
 *   - Recording stops on: the manual stop button, ~1.5 s of silence after speech, recognition
 *     returning a phrase close to the target, or a hard time limit – never on a partial result.
 *   - Every callback is tied to a session id, so late events from an older attempt are ignored.
 *   - After stopping, the recording is decoded offline to measure its real level, so a frozen
 *     analyser can never turn a good recording into "no sound captured".
 */

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'processing' | 'done';

export interface RecorderResult {
  audioUrl: string | null;
  transcript: string;
  /** True when speech recognition produced a non-empty transcript. */
  recognized: boolean;
  /** Recognition error code, if any (network, not-allowed, audio-capture, language-not-supported, unsupported…). */
  sttError: string | null;
  /** Highest input level seen (0–1 RMS), live or measured from the recording. */
  peakLevel: number;
  /** Voice was detected (by the analyser, the decoded recording, or speech recognition). */
  heardVoice: boolean;
  /** The microphone track ended before the learner stopped (another capture took the mic). */
  audioLost: boolean;
  durationMs: number;
  mode: CaptureMode;
}

interface Options {
  target: string;
  maxDurationMs?: number;
}

const SPEECH_RMS = 0.025;
const SILENCE_AFTER_SPEECH_MS = 1500;
const NO_VOICE_TIMEOUT_MS = 8000;
const ZERO_SIGNAL_MS = 1500;
// Android Chrome beeps on every recognition start, so restart at most once there.
const MAX_RECOG_RESTARTS = isAndroid ? 1 : 3;
const FATAL_STT = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'network']);

interface Attempt {
  mode: CaptureMode;
  startedAt: number;
  captureStartedAt: number;
  audioUrl: string | null;
  audioReady: boolean;
  recogDone: boolean;
  segments: string[];
  lastAlternatives: string[];
  sttError: string | null;
  sttSound: boolean;
  restarts: number;
  peak: number;
  decodedPeak: number | null;
  heard: boolean;
  lastVoiceAt: number;
  audioLost: boolean;
  everNonZero: boolean;
  watchdogRestarts: number;
  watchdogBusy: boolean;
  analyserDead: boolean;
}

const newAttempt = (mode: CaptureMode): Attempt => ({
  mode,
  startedAt: Date.now(),
  captureStartedAt: Date.now(),
  audioUrl: null,
  audioReady: mode === 'stt',
  recogDone: mode === 'record',
  segments: [],
  lastAlternatives: [],
  sttError: null,
  sttSound: false,
  restarts: 0,
  peak: 0,
  decodedPeak: null,
  heard: false,
  lastVoiceAt: 0,
  audioLost: false,
  everNonZero: false,
  watchdogRestarts: 0,
  watchdogBusy: false,
  analyserDead: false,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useSpeechRecorder({ target, maxDurationMs }: Options) {
  const mic = useMic();
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState<RecorderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [heardVoice, setHeardVoice] = useState(false);
  const [analyserDead, setAnalyserDead] = useState(false);
  const [mode, setMode] = useState<CaptureMode>('both');

  const analyserRef = useRef<AnalyserNode | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const statusRef = useRef<RecorderStatus>('idle');
  const sessionRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const vadTimerRef = useRef<number | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const attemptRef = useRef<Attempt>(newAttempt('both'));

  const updateStatus = (s: RecorderStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
  };

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  /** Release every resource of the current/previous attempt. */
  const teardown = () => {
    clearTimers();
    killRecognizer(recognizerRef.current);
    recognizerRef.current = null;
    closeCapture(captureRef.current);
    captureRef.current = null;
    analyserRef.current = null;
  };

  /** Candidate transcripts: all final segments joined, with each alternative of the last segment. */
  const bestTranscript = () => {
    const a = attemptRef.current;
    const head = a.segments.slice(0, -1).join(' ');
    const lasts = a.lastAlternatives.length ? a.lastAlternatives : a.segments.slice(-1);
    const candidates = lasts.map((l) => `${head} ${l}`.trim()).filter(Boolean);
    if (!candidates.length) return '';
    const t = normalize(targetRef.current);
    return candidates.reduce((best, c) => (similarity(t, normalize(c)) > similarity(t, normalize(best)) ? c : best));
  };

  const finalize = (session: number) => {
    if (session !== sessionRef.current) return;
    const a = attemptRef.current;
    if (!a.audioReady || !a.recogDone || statusRef.current !== 'processing') return;
    teardown();
    const transcript = bestTranscript();
    const peak = Math.max(a.peak, a.decodedPeak ?? 0);
    const heard = a.heard || a.sttSound || (a.decodedPeak ?? 0) > SPEECH_RMS * 0.8;
    const res: RecorderResult = {
      audioUrl: a.audioUrl,
      transcript,
      recognized: transcript.length > 0,
      sttError: a.sttError,
      peakLevel: Math.round(peak * 1000) / 1000,
      heardVoice: heard,
      audioLost: a.audioLost,
      durationMs: Date.now() - a.startedAt,
      mode: a.mode,
    };
    // In automatic mode, remember what does not work on this device.
    if (getCapturePreference() === 'auto') {
      if (a.mode !== 'record' && sttSession.disabled) learnMode('record');
      else if (a.mode === 'both' && a.analyserDead && res.recognized) learnMode('stt');
    }
    micLog(
      'result',
      `mode=${a.mode} transcript="${transcript}" peak=${res.peakLevel} decoded=${a.decodedPeak?.toFixed(3) ?? '-'} voice=${heard} stt=${a.sttError ?? 'ok'} audio=${!!a.audioUrl}`,
    );
    setResult(res);
    setInterim('');
    setLevel(0);
    updateStatus('done');
  };

  const stop = useCallback((reason = 'user') => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'starting') return;
    const session = sessionRef.current;
    const a = attemptRef.current;
    micLog('stop', reason);
    updateStatus('processing');
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }

    // Recognition: ask for the final result, then hard-abort after a grace period.
    const recog = recognizerRef.current;
    if (recog && !a.recogDone) {
      try {
        recog.stop();
      } catch {
        a.recogDone = true;
      }
      later(() => {
        if (session !== sessionRef.current || a.recogDone) return;
        micLog('stt-abort', 'no onend after stop');
        a.recogDone = true;
        killRecognizer(recog);
        finalize(session);
      }, 1500);
    } else {
      a.recogDone = true;
    }

    // Recorder: collect the blob, release the microphone, then measure the real level offline.
    const cap = captureRef.current;
    if (cap && !a.audioReady) {
      stopRecorder(cap).then(async (blob) => {
        if (session !== sessionRef.current) return;
        closeCapture(cap);
        if (captureRef.current === cap) captureRef.current = null;
        analyserRef.current = null;
        a.audioUrl = blob ? URL.createObjectURL(blob) : null;
        micLog('recorder-stop', blob ? `${blob.size} bytes ${blob.type}` : 'empty');
        a.decodedPeak = await measureBlobPeak(blob);
        if (session !== sessionRef.current) return;
        a.audioReady = true;
        finalize(session);
      });
    } else {
      a.audioReady = true;
    }

    // Never hang the UI if an engine fails to report back.
    later(() => {
      if (session !== sessionRef.current) return;
      a.recogDone = true;
      a.audioReady = true;
      finalize(session);
    }, 5000);
    finalize(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecognition = (session: number) => {
    const a = attemptRef.current;
    const Ctor = getRecognizerCtor();
    if (!Ctor || sttSession.disabled) {
      a.sttError = Ctor ? sttSession.reason : 'unsupported';
      a.recogDone = true;
      return;
    }
    a.recogDone = false;
    const recog = new Ctor();
    recog.lang = 'pl-PL';
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 5;
    const ext = recog as Recognizer & { onsoundstart?: (() => void) | null; onspeechstart?: (() => void) | null };
    const onSound = () => {
      if (session !== sessionRef.current) return;
      a.sttSound = true;
      if (a.mode === 'stt') setHeardVoice(true);
    };
    ext.onsoundstart = onSound;
    ext.onspeechstart = onSound;
    recog.onresult = (e) => {
      if (session !== sessionRef.current) return;
      a.sttSound = true;
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const alts: string[] = [];
          for (let k = 0; k < res.length; k++) alts.push(res[k].transcript.trim());
          a.segments.push(alts[0]);
          a.lastAlternatives = alts;
          micLog('stt-final', alts.join(' | '));
        } else {
          interimText += res[0].transcript;
        }
      }
      setInterim((a.segments.join(' ') + ' ' + interimText).trim());
      // Stop early only when the phrase is (nearly) complete – not on the first partial result.
      const sim = similarity(normalize(targetRef.current), normalize(bestTranscript()));
      if (a.segments.length && sim >= 0.75 && statusRef.current === 'recording') later(() => stop('phrase-complete'), 600);
    };
    recog.onerror = (e) => {
      if (session !== sessionRef.current) return;
      micLog('stt-error', e.error);
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      a.sttError = e.error;
      if (FATAL_STT.has(e.error)) {
        sttSession.disabled = true;
        sttSession.reason = e.error;
      }
      if (e.error === 'audio-capture') setError('stt-audio-capture');
    };
    recog.onend = () => {
      if (session !== sessionRef.current) return;
      const fatal = a.sttError && (FATAL_STT.has(a.sttError) || a.sttError === 'audio-capture');
      if (statusRef.current === 'recording') {
        // In speech-only mode a finished utterance ends the attempt.
        if (a.mode === 'stt' && a.segments.length) {
          a.recogDone = true;
          stop('stt-end');
          return;
        }
        // Chrome ends recognition after a pause; keep listening while the learner is still recording.
        if (!fatal && a.restarts < MAX_RECOG_RESTARTS) {
          a.restarts++;
          micLog('stt-restart', String(a.restarts));
          try {
            recog.start();
            return;
          } catch {
            // fall through: treat as finished
          }
        }
        if (a.mode === 'stt') {
          a.recogDone = true;
          stop('stt-end');
          return;
        }
      }
      a.recogDone = true;
      finalize(session);
    };
    try {
      recog.start();
      recognizerRef.current = recog;
      micLog('stt-start');
    } catch (err) {
      a.sttError = 'start-failed';
      a.recogDone = true;
      micLog('stt-start-failed', String(err));
    }
  };

  /** Zero-signal watchdog: rebuild the audio context and stream once; then give up on VAD for this attempt. */
  const recoverDeadChannel = async (session: number) => {
    const a = attemptRef.current;
    if (a.watchdogBusy) return;
    a.watchdogBusy = true;
    if (a.watchdogRestarts >= 1) {
      a.analyserDead = true;
      setAnalyserDead(true);
      micLog('analyser-dead', 'continuing without level meter');
      a.watchdogBusy = false;
      return;
    }
    a.watchdogRestarts++;
    micLog('watchdog-restart', 'analyser returned digital silence');
    closeCapture(captureRef.current);
    captureRef.current = null;
    analyserRef.current = null;
    try {
      await rebuildAudioContext();
      const stream = await getFreshStream();
      if (session !== sessionRef.current || statusRef.current !== 'recording') {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const cap = await openCapture(stream, a.mode !== 'stt');
      captureRef.current = cap;
      analyserRef.current = cap.analyser;
      a.captureStartedAt = Date.now();
      a.everNonZero = false;
    } catch (err) {
      micLog('watchdog-failed', String(err));
      a.analyserDead = true;
      setAnalyserDead(true);
    } finally {
      a.watchdogBusy = false;
    }
  };

  const start = useCallback(async () => {
    if (statusRef.current === 'recording' || statusRef.current === 'starting' || statusRef.current === 'processing') return;

    // An active or stuck TTS utterance can hold the audio session – cancel it and give it a moment.
    const wasSpeaking = ttsSupported && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    stopSpeaking();
    if (ttsSupported) window.speechSynthesis.cancel();

    // Release everything from the previous attempt before touching the microphone again.
    teardown();
    if (attemptRef.current.audioUrl) URL.revokeObjectURL(attemptRef.current.audioUrl);
    const session = ++sessionRef.current;
    const captureMode = resolveCaptureMode();
    attemptRef.current = newAttempt(captureMode);
    const a = attemptRef.current;
    setMode(captureMode);
    setError(null);
    setResult(null);
    setInterim('');
    setLevel(0);
    setHeardVoice(false);
    setAnalyserDead(false);
    updateStatus('starting');
    micLog('start', `#${session} mode=${captureMode} target="${targetRef.current}"`);

    // Unlock the shared AudioContext inside the user's tap (iOS).
    getAudioContext()?.resume().catch(() => undefined);
    if (wasSpeaking) await sleep(200);

    if (captureMode !== 'stt') {
      let stream: MediaStream;
      try {
        stream = await getFreshStream();
      } catch (err) {
        const name = err instanceof Error ? err.name : String(err);
        micLog('getUserMedia-error', name);
        mic.reportMediaError(err);
        setError(name);
        updateStatus('idle');
        return;
      }
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mic.reportMediaOk();
      const track = stream.getAudioTracks()[0];
      if (track) {
        track.onended = () => {
          if (session !== sessionRef.current) return;
          a.audioLost = true;
          micLog('track-ended');
        };
      }
      const cap = await openCapture(stream, true);
      if (session !== sessionRef.current) {
        closeCapture(cap);
        return;
      }
      captureRef.current = cap;
      analyserRef.current = cap.analyser;
      a.captureStartedAt = Date.now();
    }

    updateStatus('recording');
    if (captureMode !== 'record') startRecognition(session);

    // VAD loop: level meter, zero-signal watchdog, auto-stop after speech + silence or when nothing is heard.
    const buf = new Float32Array(1024);
    const hardLimit = maxDurationMs ?? Math.min(15000, 5000 + targetRef.current.length * 200);
    let lastUiUpdate = 0;
    vadTimerRef.current = window.setInterval(() => {
      if (session !== sessionRef.current || statusRef.current !== 'recording') return;
      const now = Date.now();
      const elapsed = now - a.startedAt;
      if (elapsed > hardLimit) {
        stop('time-limit');
        return;
      }

      if (a.mode === 'stt') {
        // No analyser in speech-only mode: show recognition activity instead.
        if (now - lastUiUpdate > 120) {
          lastUiUpdate = now;
          setLevel(a.sttSound ? 0.35 + Math.random() * 0.4 : 0.03);
        }
        if (!a.sttSound && elapsed > NO_VOICE_TIMEOUT_MS) stop('no-voice');
        return;
      }

      const analyser = analyserRef.current;
      if (!analyser || a.audioLost || a.analyserDead || a.watchdogBusy) return;
      const n = Math.min(buf.length, analyser.fftSize);
      analyser.getFloatTimeDomainData(buf.subarray(0, n));
      let sum = 0;
      let maxAbs = 0;
      for (let i = 0; i < n; i++) {
        const v = buf[i];
        sum += v * v;
        if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
      }
      if (maxAbs > 0) a.everNonZero = true;
      else if (!a.everNonZero && now - a.captureStartedAt > ZERO_SIGNAL_MS) {
        // Exact digital silence: a real microphone always has a noise floor, so the channel is dead.
        void recoverDeadChannel(session);
        return;
      }
      const rms = Math.sqrt(sum / n);
      a.peak = Math.max(a.peak, rms);
      if (rms > SPEECH_RMS) {
        if (!a.heard) {
          a.heard = true;
          setHeardVoice(true);
          micLog('voice-detected', rms.toFixed(3));
        }
        a.lastVoiceAt = now;
      }
      if (now - lastUiUpdate > 90) {
        lastUiUpdate = now;
        setLevel(Math.min(1, rms * 6));
      }
      if (a.heard && now - a.lastVoiceAt > SILENCE_AFTER_SPEECH_MS && elapsed > 1200) stop('silence');
      else if (!a.heard && a.everNonZero && elapsed > NO_VOICE_TIMEOUT_MS) stop('no-voice');
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic, maxDurationMs, stop]);

  const reset = useCallback(() => {
    if (statusRef.current === 'recording' || statusRef.current === 'starting') return;
    setResult(null);
    setInterim('');
    setError(null);
    updateStatus('idle');
  }, []);

  useEffect(
    () => () => {
      sessionRef.current++;
      teardown();
      if (attemptRef.current.audioUrl) URL.revokeObjectURL(attemptRef.current.audioUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { status, interim, result, error, level, heardVoice, analyserDead, mode, analyserRef, start, stop, reset };
}
