/**
 * Canvas animation for the "Dla Kasi" screen: a night sky with twinkling stars, soft white
 * feathers drifting down and glowing hearts floating up, plus a burst of hearts and golden
 * stars on demand. Respects prefers-reduced-motion by drawing far fewer moving particles.
 */

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

interface Floater {
  kind: 'feather' | 'heart';
  x: number;
  y: number;
  vy: number;
  sway: number;
  phase: number;
  size: number;
  rot: number;
  vr: number;
  alpha: number;
}

interface Spark {
  kind: 'heart' | 'star';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  max: number;
  hue: number;
  rot: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function heartPath(ctx: CanvasRenderingContext2D, size: number) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.6);
  ctx.bezierCurveTo(-s * 1.4, -s * 0.3, -s * 0.6, -s * 1.3, 0, -s * 0.5);
  ctx.bezierCurveTo(s * 0.6, -s * 1.3, s * 1.4, -s * 0.3, 0, s * 0.6);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function featherPath(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.45, -size * 0.5, size * 0.4, size * 0.5, 0, size);
  ctx.bezierCurveTo(-size * 0.4, size * 0.5, -size * 0.45, -size * 0.5, 0, -size);
  ctx.closePath();
}

export class AngelSky {
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private floaters: Floater[] = [];
  private sparks: Spark[] = [];
  private raf = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private last = 0;
  private readonly calm: boolean;

  /** `ambient: false` draws only burst particles – used for an overlay canvas above the content. */
  constructor(
    private canvas: HTMLCanvasElement,
    private ambient = true,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }

  resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.ambient) return;
    const starCount = Math.round((this.w * this.h) / 5200);
    this.stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: rand(0.4, 1.7),
      phase: Math.random() * Math.PI * 2,
      speed: rand(0.6, 2.2),
    }));
    const floaterCount = this.calm ? 6 : Math.max(14, Math.round(this.w / 26));
    this.floaters = Array.from({ length: floaterCount }, () => this.newFloater(true));
  };

  private newFloater(anywhere: boolean): Floater {
    const kind: Floater['kind'] = Math.random() < 0.55 ? 'feather' : 'heart';
    const down = kind === 'feather';
    return {
      kind,
      x: Math.random() * this.w,
      y: anywhere ? Math.random() * this.h : down ? -30 : this.h + 30,
      vy: down ? rand(14, 32) : -rand(10, 26),
      sway: rand(10, 34),
      phase: Math.random() * Math.PI * 2,
      size: kind === 'feather' ? rand(7, 15) : rand(6, 13),
      rot: Math.random() * Math.PI,
      vr: rand(-0.6, 0.6),
      alpha: rand(0.35, 0.85),
    };
  }

  /** Explosion of hearts and golden stars from a point (CSS pixels relative to the canvas). */
  burst(x: number, y: number, count = 46) {
    const n = this.calm ? Math.round(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(140, 420);
      const heart = Math.random() < 0.55;
      this.sparks.push({
        kind: heart ? 'heart' : 'star',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 160,
        size: heart ? rand(8, 16) : rand(5, 10),
        life: 0,
        max: rand(1.2, 2.2),
        hue: heart ? rand(330, 355) : rand(42, 52),
        rot: Math.random() * Math.PI,
      });
    }
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(now / 1000, dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private frame(t: number, dt: number) {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    // Twinkling stars.
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.4) {
        ctx.globalAlpha = a * 0.35;
        ctx.fillRect(s.x - s.r * 3, s.y - 0.4, s.r * 6, 0.8);
        ctx.fillRect(s.x - 0.4, s.y - s.r * 3, 0.8, s.r * 6);
      }
    }

    // Drifting feathers (down) and glowing hearts (up).
    for (let i = 0; i < this.floaters.length; i++) {
      const f = this.floaters[i];
      f.y += f.vy * dt;
      f.phase += dt * 0.9;
      f.rot += f.vr * dt;
      const x = f.x + Math.sin(f.phase) * f.sway;
      if (f.y > h + 40 || f.y < -40) {
        this.floaters[i] = this.newFloater(false);
        continue;
      }
      ctx.save();
      ctx.translate(x, f.y);
      ctx.rotate(f.kind === 'feather' ? Math.sin(f.phase) * 0.7 + f.rot * 0.2 : Math.sin(f.phase) * 0.15);
      ctx.globalAlpha = f.alpha;
      if (f.kind === 'feather') {
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 8;
        featherPath(ctx, f.size);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(203,213,225,0.9)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -f.size);
        ctx.lineTo(0, f.size * 1.2);
        ctx.stroke();
      } else {
        ctx.shadowColor = 'rgba(244,114,182,0.95)';
        ctx.shadowBlur = 16;
        heartPath(ctx, f.size * 2);
        ctx.fillStyle = 'rgba(251,113,133,0.9)';
        ctx.fill();
      }
      ctx.restore();
    }

    // Burst particles with a little gravity.
    this.sparks = this.sparks.filter((p) => p.life < p.max);
    for (const p of this.sparks) {
      p.life += dt;
      p.vy += 260 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 3;
      const k = 1 - p.life / p.max;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, k);
      ctx.shadowBlur = 14;
      ctx.shadowColor = `hsl(${p.hue} 95% 65%)`;
      ctx.fillStyle = `hsl(${p.hue} 95% ${p.kind === 'star' ? 62 : 68}%)`;
      if (p.kind === 'heart') heartPath(ctx, p.size * 2);
      else starPath(ctx, p.size);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}
