/**
 * A tiny generative music box / angelic harp built on the Web Audio API (no audio files).
 * Plays a gentle I–vi–IV–V arpeggio in D major with a soft echo, plus a bright "happy chord"
 * on demand. Uses its own AudioContext so muting or closing it never touches the microphone engine.
 */

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// D, Bm, G, A – one octave up for the music-box sparkle.
const PROGRESSION = [
  [74, 78, 81, 86],
  [71, 74, 78, 83],
  [67, 71, 74, 79],
  [69, 73, 76, 81],
];
const PATTERN = [0, 1, 2, 3, 2, 1, 2, 3];
const STEP = 0.34; // seconds per arpeggio note

type Ctor = typeof AudioContext;

export class MusicBox {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private muted = false;

  constructor() {
    const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!C) return;
    try {
      this.ctx = new C();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);
    // Dry bus + a filtered feedback echo that gives the notes a soft, "angelic" tail.
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = STEP * 1.5;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    this.bus.connect(delay);
    delay.connect(tone);
    tone.connect(feedback);
    feedback.connect(delay);
    tone.connect(this.master);
  }

  get available(): boolean {
    return this.ctx !== null;
  }

  private pluck(midi: number, at: number, length: number, volume: number) {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(volume, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    env.connect(this.bus);
    // Sine fundamental + a quiet triangle octave: a soft bell / harp timbre.
    for (const [type, mult, vol] of [
      ['sine', 1, 1],
      ['triangle', 2, 0.18],
    ] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = midiToHz(midi) * mult;
      g.gain.value = vol;
      osc.connect(g).connect(env);
      osc.start(at);
      osc.stop(at + length + 0.05);
    }
  }

  private schedule = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.4) {
      const bar = Math.floor(this.step / PATTERN.length) % PROGRESSION.length;
      const chord = PROGRESSION[bar];
      const pos = this.step % PATTERN.length;
      this.pluck(chord[PATTERN[pos]], this.nextTime, 1.6, 0.11);
      // A soft bass note at the start of every bar.
      if (pos === 0) this.pluck(chord[0] - 24, this.nextTime, 2.6, 0.07);
      this.nextTime += STEP;
      this.step++;
    }
  };

  start(): void {
    const ctx = this.ctx;
    if (!ctx || this.timer !== null) return;
    ctx.resume().catch(() => undefined);
    this.nextTime = ctx.currentTime + 0.1;
    this.fadeTo(this.muted ? 0.0001 : 0.8, 1.5);
    this.timer = window.setInterval(this.schedule, 120);
    this.schedule();
  }

  /** Bright rising major chord with a sparkle on top – played on every "more magic" tap. */
  happyChord(): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    ctx.resume().catch(() => undefined);
    const t = ctx.currentTime + 0.02;
    [74, 78, 81, 86, 90, 93].forEach((m, i) => this.pluck(m, t + i * 0.05, 2.2, 0.13));
    this.pluck(98, t + 0.35, 1.4, 0.08);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.fadeTo(muted ? 0.0001 : 0.8, 0.4);
  }

  private fadeTo(value: number, seconds: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const g = this.master.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(Math.max(0.0001, g.value), ctx.currentTime);
    g.exponentialRampToValueAtTime(Math.max(0.0001, value), ctx.currentTime + seconds);
  }

  close(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => undefined);
  }
}
