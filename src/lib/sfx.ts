import { getAudioContext } from './audioEngine';

/**
 * Short synthesized cues (no audio files): a "your turn" ping before the microphone opens,
 * a bright success chime and a soft "try again" tone. Resolves when the sound has finished.
 */

export type Cue = 'listen' | 'success' | 'retry' | 'tick';

const NOTES: Record<Cue, [number, number][]> = {
  // [frequency Hz, start offset s]
  listen: [[880, 0]],
  success: [
    [659.25, 0],
    [830.61, 0.09],
    [987.77, 0.18],
  ],
  retry: [
    [392, 0],
    [329.63, 0.14],
  ],
  tick: [[1200, 0]],
};

export function playCue(cue: Cue, volume = 0.18): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve();
  ctx.resume().catch(() => undefined);
  const now = ctx.currentTime + 0.02;
  const len = cue === 'tick' ? 0.06 : 0.22;
  let end = now;
  for (const [freq, offset] of NOTES[cue]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cue === 'retry' ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    const t0 = now + offset;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + len + 0.02);
    end = Math.max(end, t0 + len);
  }
  return new Promise((r) => setTimeout(r, (end - ctx.currentTime) * 1000 + 30));
}
