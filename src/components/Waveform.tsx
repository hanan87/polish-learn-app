import { useEffect, useRef, type RefObject } from 'react';

interface Props {
  analyserRef?: RefObject<AnalyserNode | null>;
  active: boolean;
  /** Draw a synthetic waveform (used by the simulation panel when no mic is available). */
  simulated?: boolean;
}

/** Live waveform drawn from a Web Audio AnalyserNode. */
export function Waveform({ analyserRef, active, simulated = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const buffer = new Uint8Array(1024);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const analyser = analyserRef?.current;
      if (active && (analyser || simulated)) {
        let samples: number[];
        if (analyser && !simulated) {
          const len = Math.min(buffer.length, analyser.fftSize);
          analyser.getByteTimeDomainData(buffer.subarray(0, len));
          samples = Array.from(buffer.subarray(0, len), (v) => (v - 128) / 128);
        } else {
          t += 0.08;
          samples = Array.from({ length: 256 }, (_, i) => {
            const env = 0.35 + 0.35 * Math.sin(t * 1.7) * Math.sin(t * 0.9);
            return env * Math.sin(i * 0.22 + t * 6) * Math.sin(i * 0.031 + t);
          });
        }
        // Amplify quiet input so speech is clearly visible.
        const peak = Math.max(0.08, ...samples.map(Math.abs));
        const gain = Math.min(4, 0.9 / peak);

        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        samples.forEach((s, i) => {
          const x = (i / (samples.length - 1)) * w;
          const y = h / 2 + s * gain * (h / 2) * 0.9;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, active, simulated]);

  return <canvas ref={canvasRef} className="h-16 w-full rounded-xl bg-rose-50/60" aria-hidden />;
}
