import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { isInIframe, mediaRecordingSupported, micAllowedByPolicy } from '../lib/env';

/**
 * Global microphone availability.
 *  - ready:         not yet known to be blocked
 *  - blocked-frame: an embedding iframe (e.g. Claude's preview pane) denies the microphone via Permissions Policy
 *  - denied:        the user or OS refused permission
 *  - insecure:      page is not served over HTTPS / localhost
 *  - unsupported:   no getUserMedia / MediaRecorder
 *  - no-device:     no microphone hardware found
 *  - busy:          another app holds the microphone (call, Zoom, another tab)
 * Speech-recognition errors never change this status: they only affect scoring.
 */
export type MicStatus = 'ready' | 'blocked-frame' | 'denied' | 'insecure' | 'unsupported' | 'no-device' | 'busy';

/** Statuses the learner can fix and retry from the UI. */
export const RETRYABLE: MicStatus[] = ['denied', 'no-device', 'busy'];

interface MicApi {
  status: MicStatus;
  blocked: boolean;
  /** Simulation panel forced on (auto-opened when blocked, or toggled manually for testing). */
  simulation: boolean;
  setSimulation: (on: boolean) => void;
  reportMediaError: (err: unknown) => void;
  /** A successful getUserMedia clears any earlier blocked state (e.g. permission granted later). */
  reportMediaOk: () => void;
  /** Let the learner try again after fixing permissions or closing the app that held the mic. */
  retry: () => void;
}

const MicContext = createContext<MicApi | null>(null);

function initialStatus(): MicStatus {
  if (!window.isSecureContext && location.protocol !== 'file:') return 'insecure';
  if (!mediaRecordingSupported) return 'unsupported';
  if (micAllowedByPolicy() === false) return 'blocked-frame';
  return 'ready';
}

export function MicProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MicStatus>(initialStatus);
  const [simulationManual, setSimulation] = useState(false);

  const reportMediaError = useCallback((err: unknown) => {
    const name = err instanceof DOMException || err instanceof Error ? err.name : String(err);
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
      setStatus('no-device');
    } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      // Inside an iframe a NotAllowedError without a prompt is almost always the frame's Permissions Policy.
      setStatus(isInIframe || micAllowedByPolicy() === false ? 'blocked-frame' : 'denied');
    } else if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
      setStatus('busy');
    } else {
      setStatus('unsupported');
    }
  }, []);

  const reportMediaOk = useCallback(() => setStatus((s) => (s === 'ready' ? s : 'ready')), []);
  const retry = useCallback(() => setStatus((s) => (RETRYABLE.includes(s) ? 'ready' : s)), []);

  const api = useMemo<MicApi>(() => {
    const blocked = status !== 'ready';
    return {
      status,
      blocked,
      simulation: blocked || simulationManual,
      setSimulation,
      reportMediaError,
      reportMediaOk,
      retry,
    };
  }, [status, simulationManual, reportMediaError, reportMediaOk, retry]);

  return <MicContext.Provider value={api}>{children}</MicContext.Provider>;
}

export function useMic(): MicApi {
  const ctx = useContext(MicContext);
  if (!ctx) throw new Error('useMic must be used inside MicProvider');
  return ctx;
}

export const MIC_STATUS_MESSAGES: Record<MicStatus, { he: string; en: string }> = {
  ready: { he: '', en: '' },
  'blocked-frame': {
    he: 'המיקרופון חסום על ידי חלון התצוגה המוטמע (iframe) שבו האפליקציה רצה כרגע – למשל חלון התצוגה של Claude. זו מגבלה של המסגרת, לא של האפליקציה. פתחנו עבורכם פאנל סימולציה לבדיקה, ולהפעלה מלאה עם מיקרופון הורידו את הגרסה העצמאית.',
    en: "The microphone is blocked by the embedding frame (iframe) the app is running in – for example Claude's preview pane. This is a limit of the frame, not the app. A simulation panel is open for testing; for full microphone support, download the standalone version.",
  },
  denied: {
    he: 'הגישה למיקרופון נדחתה. אפשרו מיקרופון בהגדרות האתר בדפדפן (סמל המנעול ליד שורת הכתובת) ורעננו את הדף. ב-iPhone: הגדרות ← Safari ← מיקרופון. בינתיים אפשר להשתמש בפאנל הסימולציה.',
    en: 'Microphone access was denied. Allow the microphone in the site settings (the lock icon next to the address bar) and reload. On iPhone: Settings → Safari → Microphone. Meanwhile you can use the simulation panel.',
  },
  insecure: {
    he: 'הקלטה דורשת חיבור מאובטח (https). פתחו את האפליקציה בכתובת https או הורידו את הגרסה העצמאית.',
    en: 'Recording requires a secure (https) connection. Open the app over https or download the standalone version.',
  },
  unsupported: {
    he: 'הדפדפן הזה לא תומך בהקלטת שמע. נסו Chrome או Safari עדכניים. בינתיים אפשר להשתמש בפאנל הסימולציה.',
    en: 'This browser cannot record audio. Try an up-to-date Chrome or Safari. Meanwhile you can use the simulation panel.',
  },
  busy: {
    he: 'המיקרופון תפוס על ידי אפליקציה אחרת (שיחה, Zoom, לשונית אחרת). סגרו אותה ולחצו "נסו שוב".',
    en: 'Another app is using the microphone (a call, Zoom, another tab). Close it and tap "Try again".',
  },
  'no-device': {
    he: 'לא נמצא מיקרופון במכשיר. חברו מיקרופון או אוזניות ונסו שוב.',
    en: 'No microphone was found. Connect a microphone or headset and try again.',
  },
};
