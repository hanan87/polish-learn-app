/** Runtime environment detection: platform, iframe embedding and API support. */

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const isIOS =
  /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isAndroid = /Android/i.test(ua);

export const isStandaloneBuild = import.meta.env.MODE === 'standalone';

export const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent access throws, which itself proves we are framed.
    return true;
  }
})();

interface PolicyLike {
  allowsFeature?: (feature: string) => boolean;
}

/**
 * Whether the Permissions Policy of this document allows the microphone.
 * Returns null when the browser does not expose the policy API (Safari, Firefox).
 */
export function micAllowedByPolicy(): boolean | null {
  const doc = document as Document & { permissionsPolicy?: PolicyLike; featurePolicy?: PolicyLike };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  if (!policy?.allowsFeature) return null;
  try {
    return policy.allowsFeature('microphone');
  } catch {
    return null;
  }
}

export const mediaRecordingSupported =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Minimal SpeechRecognition typing (the API is still prefixed in WebKit/Blink). */
export interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
export interface RecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
}
export interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
export interface RecognitionErrorEvent {
  error: string;
  message?: string;
}
export interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognizerCtor = new () => Recognizer;

export function getRecognizerCtor(): RecognizerCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechRecognitionSupported = typeof window !== 'undefined' && getRecognizerCtor() !== null;

/** Pick a MediaRecorder container the current browser can produce (iOS Safari only does audio/mp4). */
export function pickRecorderMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function createAudioContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}
