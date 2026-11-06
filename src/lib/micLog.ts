/**
 * Small in-memory diagnostic log for the recording pipeline. Shown in Settings → Microphone test,
 * so a learner can see (and report) exactly what the browser did on their device.
 */

export interface MicLogEntry {
  t: number;
  event: string;
  detail?: string;
}

const MAX = 40;
let entries: MicLogEntry[] = [];
const listeners = new Set<() => void>();

export function micLog(event: string, detail?: string): void {
  // Replace the array (never mutate) so useSyncExternalStore sees a stable snapshot between changes.
  entries = [...entries, { t: Date.now(), event, detail }].slice(-MAX);
  if (import.meta.env.DEV) console.info(`[mic] ${event}${detail ? ` – ${detail}` : ''}`);
  listeners.forEach((l) => l());
}

export function getMicLog(): MicLogEntry[] {
  return entries;
}

export function subscribeMicLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Speech-recognition problems that make further attempts pointless for this page session. */
export const sttSession = {
  disabled: false,
  reason: null as string | null,
};
