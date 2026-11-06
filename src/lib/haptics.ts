/**
 * Gentle vibration feedback for phones. Every call is safe: it is a no-op on desktops, on iOS
 * (no Vibration API), when the learner switched haptics off in Settings, or if the browser throws.
 */

export type HapticKind = 'tap' | 'start' | 'success' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  start: 25,
  success: [18, 40, 18],
  error: [50, 40, 50],
};

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function haptic(kind: HapticKind): void {
  if (!enabled || !hapticsSupported()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw when vibration is blocked (e.g. before the first user gesture).
  }
}
