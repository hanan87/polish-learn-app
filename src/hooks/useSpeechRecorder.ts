import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAudioContext,
  getRecognizerCtor,
  isAndroid,
  pickRecorderMimeType,
  type Recognizer,
} from '../lib/env';
import { normalize, similarity } from '../lib/text';
import { stopSpeaking } from '../lib/tts';
import { useMic } from '../state/MicContext';

/**
 * Dual capture engine: when recording starts, two mechanisms run in parallel:
 *   A. getUserMedia -> MediaRecorder (real audio -> Blob/object URL) + Web Audio AnalyserNode for a live waveform.
 *   B. SpeechRecognition (pl-PL) transcribing what the learner said.
 *
 * Platform notes:
 *   - iOS Safari: MediaRecorder only produces audio/mp4; AudioContext must be created/resumed inside the tap.
 *   - Android Chrome: SpeechRecognition and getUserMedia may compete for the mic. If recognition fails with
 *     "audio-capture" we keep the recording and fall back to self-assessment.
 */

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'processing' | 'done';

export interface RecorderResult {
  audioUrl: string | null;
  transcript: string;
  /** False when speech recognition was unavailable or failed; the UI then offers self-assessment. */
  recognized: boolean;
}

interface Options {
  target: string;
  maxDurationMs?: number;
}

export function useSpeechRecorder({ target, maxDurationMs }: Options) {
  const mic = useMic();
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState<RecorderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const alternativesRef = useRef<string[]>([]);
  const recognitionDoneRef = useRef(true);
  const recognitionFailedRef = useRef(false);
  const audioUrlRef = useRef<string | null>(null);
  const audioReadyRef = useRef(false);
  const stopTimerRef = useRef<number | null>(null);
  const statusRef = useRef<RecorderStatus>('idle');
  const sessionRef = useRef(0);

  const updateStatus = (s: RecorderStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const pickBestTranscript = useCallback(() => {
    const alts = alternativesRef.current.filter(Boolean);
    if (!alts.length) return '';
    const t = normalize(target);
    return alts.reduce((best, cur) => (similarity(t, normalize(cur)) > similarity(t, normalize(best)) ? cur : best));
  }, [target]);

  /** Called whenever one of the two engines finishes; finalizes when both are done. */
  const tryFinalize = useCallback(() => {
    if (!audioReadyRef.current || !recognitionDoneRef.current) return;
    if (statusRef.current === 'done' || statusRef.current === 'idle') return;
    const transcript = pickBestTranscript();
    setResult({
      audioUrl: audioUrlRef.current,
      transcript,
      recognized: !recognitionFailedRef.current && getRecognizerCtor() !== null,
    });
    setInterim('');
    updateStatus('done');
  }, [pickBestTranscript]);

  const releaseMedia = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  };

  const stop = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (statusRef.current !== 'recording' && statusRef.current !== 'starting') return;
    updateStatus('processing');
    try {
      recognizerRef.current?.stop();
    } catch {
      recognitionDoneRef.current = true;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    else {
      audioReadyRef.current = true;
      releaseMedia();
    }
    // Recognition sometimes never fires onend (seen on iOS). Do not hang the UI.
    const session = sessionRef.current;
    window.setTimeout(() => {
      if (session !== sessionRef.current) return;
      recognitionDoneRef.current = true;
      tryFinalize();
    }, 2500);
  }, [tryFinalize]);

  const start = useCallback(async () => {
    if (statusRef.current === 'recording' || statusRef.current === 'starting') return;
    stopSpeaking();
    sessionRef.current++;
    setError(null);
    setResult(null);
    setInterim('');
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    audioReadyRef.current = false;
    chunksRef.current = [];
    alternativesRef.current = [];
    recognitionFailedRef.current = false;
    updateStatus('starting');

    // The AudioContext must be created synchronously inside the user gesture for iOS.
    const audioCtx = createAudioContext();
    audioCtxRef.current = audioCtx;
    audioCtx?.resume().catch(() => undefined);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      mic.reportMediaError(err);
      setError(err instanceof Error ? err.name : 'error');
      releaseMedia();
      updateStatus('idle');
      return;
    }
    streamRef.current = stream;

    // A. Waveform analyser.
    if (audioCtx) {
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;
    }

    // A. MediaRecorder.
    const mimeType = pickRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
      audioUrlRef.current = blob.size > 0 ? URL.createObjectURL(blob) : null;
      audioReadyRef.current = true;
      releaseMedia();
      tryFinalize();
    };
    recorderRef.current = recorder;
    recorder.start();

    // B. Speech recognition, in parallel.
    const Ctor = getRecognizerCtor();
    if (Ctor) {
      recognitionDoneRef.current = false;
      const recog = new Ctor();
      recog.lang = 'pl-PL';
      recog.continuous = false;
      recog.interimResults = true;
      recog.maxAlternatives = 5;
      recog.onresult = (e) => {
        let interimText = '';
        const finals: string[] = [];
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) {
            for (let a = 0; a < res.length; a++) finals.push(res[a].transcript);
          } else {
            interimText += res[0].transcript;
          }
        }
        if (finals.length) alternativesRef.current = finals;
        setInterim(interimText || finals[0] || '');
        if (finals.length && statusRef.current === 'recording') {
          // A final result means the learner finished the phrase; give a short tail and stop.
          window.setTimeout(() => stop(), 350);
        }
      };
      recog.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        recognitionFailedRef.current = true;
        mic.reportRecognitionError(e.error);
        if (e.error === 'audio-capture' && isAndroid) {
          setError('android-audio-capture');
        }
      };
      recog.onend = () => {
        recognitionDoneRef.current = true;
        tryFinalize();
      };
      try {
        recog.start();
        recognizerRef.current = recog;
      } catch {
        recognitionFailedRef.current = true;
        recognitionDoneRef.current = true;
      }
    } else {
      recognitionDoneRef.current = true;
      recognitionFailedRef.current = true;
    }

    updateStatus('recording');
    const limit = maxDurationMs ?? Math.min(12000, 3500 + target.length * 150);
    stopTimerRef.current = window.setTimeout(() => stop(), limit);
  }, [mic, maxDurationMs, target, stop, tryFinalize]);

  const reset = useCallback(() => {
    setResult(null);
    setInterim('');
    setError(null);
    updateStatus('idle');
  }, []);

  useEffect(
    () => () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      try {
        recognizerRef.current?.abort();
      } catch {
        // already stopped
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => undefined);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  return { status, interim, result, error, analyserRef, start, stop, reset };
}
