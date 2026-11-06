import { createAudioContext, pickRecorderMimeType, type Recognizer } from './env';
import { micLog } from './micLog';

/**
 * Low-level audio resources for one recording attempt, and their complete teardown.
 *
 * A single AudioContext is shared by all attempts: iOS only allows audio contexts that were
 * started inside a user gesture, and browsers cap the number of live contexts. Every attempt
 * gets a fresh MediaStream, its own source/analyser nodes and its own MediaRecorder, and all of
 * them are fully released before the next attempt starts.
 */

let sharedCtx: AudioContext | null = null;

/** The shared context (re-created if it was closed). Call inside the user's tap. */
export function getAudioContext(): AudioContext | null {
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = createAudioContext();
  return sharedCtx;
}

/** Throw away the shared context and build a new one (used by the zero-signal watchdog). */
export async function rebuildAudioContext(): Promise<AudioContext | null> {
  const old = sharedCtx;
  sharedCtx = null;
  await old?.close().catch(() => undefined);
  const ctx = getAudioContext();
  await ctx?.resume().catch(() => undefined);
  micLog('audio-context-rebuilt', ctx?.state);
  return ctx;
}

export interface Capture {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  mimeType: string;
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

function waitForUnmute(track: MediaStreamTrack, ms: number): Promise<boolean> {
  if (!track.muted) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      track.removeEventListener('unmute', onUnmute);
      clearTimeout(timer);
      resolve(ok);
    };
    const onUnmute = () => done(true);
    const timer = window.setTimeout(() => done(!track.muted), ms);
    track.addEventListener('unmute', onUnmute);
  });
}

/**
 * Request a fresh microphone stream and verify the track is really live and not muted.
 * A muted/ended track usually means the previous capture or speech recognition still holds the
 * microphone; one retry after a short pause fixes it.
 */
export async function getFreshStream(): Promise<MediaStream> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
    const track = stream.getAudioTracks()[0];
    const live = !!track && track.readyState === 'live' && (await waitForUnmute(track, 700));
    micLog('stream', `attempt ${attempt}: ${track?.label || 'mic'} state=${track?.readyState} muted=${track?.muted}`);
    if (live || attempt === 2) return stream;
    stream.getTracks().forEach((t) => t.stop());
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('unreachable');
}

/** Connect analyser and recorder to a stream. Recorder chunks accumulate in capture.chunks. */
export async function openCapture(stream: MediaStream, withRecorder: boolean): Promise<Capture> {
  const capture: Capture = { stream, source: null, analyser: null, recorder: null, chunks: [], mimeType: '' };
  const ctx = getAudioContext();
  if (ctx) {
    // Must run after the stream exists: some browsers keep the context suspended until then.
    if (ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    try {
      capture.source = ctx.createMediaStreamSource(stream);
      capture.analyser = ctx.createAnalyser();
      capture.analyser.fftSize = 1024;
      capture.analyser.smoothingTimeConstant = 0.5;
      capture.source.connect(capture.analyser);
    } catch (err) {
      micLog('analyser-error', String(err));
    }
    micLog('audio-context', ctx.state);
  }
  if (withRecorder) {
    try {
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) capture.chunks.push(e.data);
      };
      capture.recorder = recorder;
      capture.mimeType = recorder.mimeType || mimeType || 'audio/webm';
      recorder.start(250);
      micLog('recorder-start', capture.mimeType);
    } catch (err) {
      micLog('recorder-unavailable', String(err));
    }
  }
  return capture;
}

/** Stop the recorder and resolve with the recorded Blob (or null). Safe to call more than once. */
export function stopRecorder(capture: Capture | null): Promise<Blob | null> {
  const rec = capture?.recorder;
  if (!capture || !rec) return Promise.resolve(null);
  const build = () => {
    const blob = new Blob(capture.chunks, { type: capture.mimeType });
    return blob.size > 0 ? blob : null;
  };
  if (rec.state === 'inactive') return Promise.resolve(build());
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(build()), 2000);
    rec.onstop = () => {
      clearTimeout(timer);
      resolve(build());
    };
    try {
      rec.stop();
    } catch {
      clearTimeout(timer);
      resolve(build());
    }
  });
}

/** Release everything a capture holds: recorder, audio nodes and every microphone track. */
export function closeCapture(capture: Capture | null): void {
  if (!capture) return;
  const rec = capture.recorder;
  if (rec) {
    rec.ondataavailable = null;
    rec.onstop = null;
    rec.onerror = null;
    if (rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    }
  }
  try {
    capture.source?.disconnect();
  } catch {
    // already disconnected
  }
  try {
    capture.analyser?.disconnect();
  } catch {
    // already disconnected
  }
  capture.stream.getTracks().forEach((t) => {
    t.onended = null;
    t.stop();
  });
  capture.recorder = null;
  capture.source = null;
  capture.analyser = null;
}

/** Detach all handlers and abort a recognizer so it cannot keep the microphone or fire late events. */
export function killRecognizer(r: Recognizer | null): void {
  if (!r) return;
  r.onresult = null;
  r.onerror = null;
  r.onend = null;
  const ext = r as Recognizer & { onstart?: unknown; onaudiostart?: unknown; onsoundstart?: unknown; onspeechstart?: unknown };
  ext.onstart = null;
  ext.onaudiostart = null;
  ext.onsoundstart = null;
  ext.onspeechstart = null;
  try {
    r.abort();
  } catch {
    // not started or already ended
  }
}

/** RMS level of a recorded blob, computed offline (independent of the live analyser). */
export async function measureBlobPeak(blob: Blob | null): Promise<number | null> {
  if (!blob) return null;
  try {
    const Offline = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Offline) return null;
    const ctx = new Offline(1, 44100, 44100);
    const audio = await Promise.race([
      ctx.decodeAudioData(await blob.arrayBuffer()),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    if (!audio) return null;
    const data = audio.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i += 1024) {
      let sum = 0;
      const end = Math.min(data.length, i + 1024);
      for (let k = i; k < end; k++) sum += data[k] * data[k];
      peak = Math.max(peak, Math.sqrt(sum / Math.max(1, end - i)));
    }
    return peak;
  } catch (err) {
    micLog('decode-failed', String(err));
    return null;
  }
}
