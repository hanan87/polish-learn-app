import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioContext, getRecognizerCtor, isAndroid, pickRecorderMimeType, type Recognizer } from '../lib/env';
import { micLog, sttSession } from '../lib/micLog';
import { normalize, similarity } from '../lib/text';
import { stopSpeaking } from '../lib/tts';
import { useMic } from '../state/MicContext';

/**
 * Dual capture engine. When recording starts, two mechanisms run in parallel:
 *   A. getUserMedia -> MediaRecorder (the learner's real audio as a Blob URL) + an AnalyserNode
 *      that drives the live waveform, a level meter and voice-activity detection (VAD).
 *   B. SpeechRecognition (pl-PL) transcribing what the learner said.
 *
 * Robustness rules (each fixes a failure seen on real devices):
 *   - Only a getUserMedia failure blocks the microphone. Speech-recognition errors never do;
 *     they only switch scoring to self-assessment.
 *   - Recording stops when the learner taps stop, when VAD detects ~1.5 s of silence after speech,
 *     when recognition returns a phrase close to the target, or at a hard time limit –
 *     never just because recognition produced its first (possibly partial) result.
 *   - Recognition that ends early (Chrome stops after a pause) is restarted while recording.
 *   - Every callback is tied to a session id, so late events from an old attempt cannot close a new one.
 *   - The result reports whether any voice was heard, so silent attempts are not scored as 0%.
 */

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'processing' | 'done';

export interface RecorderResult {
  audioUrl: string | null;
  transcript: string;
  /** True when speech recognition produced a non-empty transcript. */
  recognized: boolean;
  /** Recognition error code, if any (network, not-allowed, audio-capture, language-not-supported, unsupported…). */
  sttError: string | null;
  /** Highest input level seen (0–1 RMS). */
  peakLevel: number;
  /** VAD saw input above the speech threshold. */
  heardVoice: boolean;
  /** The microphone track ended before the learner stopped (another capture took the mic). */
  audioLost: boolean;
  durationMs: number;
}

interface Options {
  target: string;
  maxDurationMs?: number;
}

const SPEECH_RMS = 0.025;
const SILENCE_AFTER_SPEECH_MS = 1500;
const NO_VOICE_TIMEOUT_MS = 8000;
// Android Chrome beeps on every recognition start, so restart at most once there.
const MAX_RECOG_RESTARTS = isAndroid ? 1 : 3;
const FATAL_STT = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'network']);

export function useSpeechRecorder({ target, maxDurationMs }: Options) {
  const mic = useMic();
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState<RecorderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [heardVoice, setHeardVoice] = useState(false);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const statusRef = useRef<RecorderStatus>('idle');
  const sessionRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const vadTimerRef = useRef<number | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  // Per-attempt state kept in a ref so async callbacks always see the current attempt.
  const attemptRef = useRef({
    startedAt: 0,
    audioUrl: null as string | null,
    audioReady: false,
    recogDone: true,
    segments: [] as string[],
    lastAlternatives: [] as string[],
    sttError: null as string | null,
    restarts: 0,
    peak: 0,
    heard: false,
    lastVoiceAt: 0,
    audioLost: false,
  });

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

  const releaseMedia = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
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
    if (!a.audioReady || !a.recogDone) return;
    if (statusRef.current !== 'processing') return;
    clearTimers();
    const transcript = bestTranscript();
    const res: RecorderResult = {
      audioUrl: a.audioUrl,
      transcript,
      recognized: transcript.length > 0,
      sttError: a.sttError,
      peakLevel: Math.round(a.peak * 1000) / 1000,
      heardVoice: a.heard,
      audioLost: a.audioLost,
      durationMs: Date.now() - a.startedAt,
    };
    micLog('result', `transcript="${transcript}" peak=${res.peakLevel} voice=${res.heardVoice} stt=${res.sttError ?? 'ok'} audio=${!!res.audioUrl}`);
    setResult(res);
    setInterim('');
    setLevel(0);
    updateStatus('done');
  };

  const stop = useCallback((reason = 'user') => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'starting') return;
    const session = sessionRef.current;
    micLog('stop', reason);
    updateStatus('processing');
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    const a = attemptRef.current;
    try {
      recognizerRef.current?.stop();
    } catch {
      a.recogDone = true;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        a.audioReady = true;
        releaseMedia();
      }
    } else {
      a.audioReady = true;
      releaseMedia();
    }
    // Some engines never fire onend/onstop (seen on iOS). Never hang the UI.
    later(() => {
      if (session !== sessionRef.current) return;
      a.recogDone = true;
      a.audioReady = true;
      releaseMedia();
      finalize(session);
    }, 3000);
    finalize(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecognition = (session: number) => {
    const Ctor = getRecognizerCtor();
    const a = attemptRef.current;
    if (!Ctor) {
      a.sttError = 'unsupported';
      a.recogDone = true;
      return;
    }
    if (sttSession.disabled) {
      a.sttError = sttSession.reason;
      a.recogDone = true;
      return;
    }
    a.recogDone = false;
    const recog = new Ctor();
    recog.lang = 'pl-PL';
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 5;
    recog.onresult = (e) => {
      if (session !== sessionRef.current) return;
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
      // Chrome ends recognition after a pause; keep listening while the learner is still recording.
      const fatal = a.sttError && (FATAL_STT.has(a.sttError) || a.sttError === 'audio-capture');
      if (statusRef.current === 'recording' && !fatal && a.restarts < MAX_RECOG_RESTARTS) {
        a.restarts++;
        micLog('stt-restart', String(a.restarts));
        try {
          recog.start();
          return;
        } catch {
          // fall through: treat as finished
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

  const start = useCallback(async () => {
    if (statusRef.current === 'recording' || statusRef.current === 'starting' || statusRef.current === 'processing') return;
    stopSpeaking();
    clearTimers();
    const session = ++sessionRef.current;
    if (attemptRef.current.audioUrl) URL.revokeObjectURL(attemptRef.current.audioUrl);
    attemptRef.current = {
      startedAt: Date.now(),
      audioUrl: null,
      audioReady: false,
      recogDone: true,
      segments: [],
      lastAlternatives: [],
      sttError: null,
      restarts: 0,
      peak: 0,
      heard: false,
      lastVoiceAt: 0,
      audioLost: false,
    };
    const a = attemptRef.current;
    setError(null);
    setResult(null);
    setInterim('');
    setLevel(0);
    setHeardVoice(false);
    updateStatus('starting');
    micLog('start', `target="${targetRef.current}"`);

    // The AudioContext must be created synchronously inside the user gesture (iOS).
    const audioCtx = createAudioContext();
    audioCtxRef.current = audioCtx;
    audioCtx?.resume().catch(() => undefined);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : String(err);
      micLog('getUserMedia-error', name);
      mic.reportMediaError(err);
      setError(name);
      releaseMedia();
      updateStatus('idle');
      return;
    }
    if (session !== sessionRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    mic.reportMediaOk();
    const track = stream.getAudioTracks()[0];
    micLog('getUserMedia-ok', `${track?.label || 'microphone'} muted=${track?.muted}`);
    if (track) {
      track.onended = () => {
        if (session !== sessionRef.current) return;
        a.audioLost = true;
        micLog('track-ended');
      };
    }

    // A. Analyser for waveform, level meter and VAD.
    if (audioCtx) {
      try {
        if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => undefined);
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch (err) {
        micLog('analyser-error', String(err));
      }
    }

    // A. MediaRecorder (timeslice so data is captured even if stop() misbehaves).
    try {
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (session !== sessionRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        a.audioUrl = blob.size > 0 ? URL.createObjectURL(blob) : null;
        a.audioReady = true;
        micLog('recorder-stop', `${blob.size} bytes ${blob.type}`);
        releaseMedia();
        finalize(session);
      };
      recorder.onerror = (e) => micLog('recorder-error', String((e as unknown as { error?: Error }).error ?? e.type));
      recorderRef.current = recorder;
      recorder.start(250);
      micLog('recorder-start', recorder.mimeType);
    } catch (err) {
      micLog('recorder-unavailable', String(err));
      recorderRef.current = null;
      a.audioReady = true;
    }

    updateStatus('recording');

    // B. Speech recognition in parallel.
    startRecognition(session);

    // VAD loop: level meter + auto-stop after speech followed by silence, or when nothing is heard.
    const buf = new Float32Array(1024);
    const hardLimit = maxDurationMs ?? Math.min(15000, 5000 + targetRef.current.length * 200);
    let lastUiUpdate = 0;
    vadTimerRef.current = window.setInterval(() => {
      if (session !== sessionRef.current || statusRef.current !== 'recording') return;
      const now = Date.now();
      const elapsed = now - a.startedAt;
      const analyser = analyserRef.current;
      if (analyser && !a.audioLost) {
        const n = Math.min(buf.length, analyser.fftSize);
        analyser.getFloatTimeDomainData(buf.subarray(0, n));
        let sum = 0;
        for (let i = 0; i < n; i++) sum += buf[i] * buf[i];
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
        else if (!a.heard && elapsed > NO_VOICE_TIMEOUT_MS) stop('no-voice');
      }
      if (elapsed > hardLimit) stop('time-limit');
    }, 50);
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
      clearTimers();
      try {
        recognizerRef.current?.abort();
      } catch {
        // already stopped
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => undefined);
      if (attemptRef.current.audioUrl) URL.revokeObjectURL(attemptRef.current.audioUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { status, interim, result, error, level, heardVoice, analyserRef, start, stop, reset };
}
