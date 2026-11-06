import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { BookOpen, GraduationCap, Heart, Languages, Music, Square, Star, Volume2, VolumeX, X } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { AngelSky } from '../lib/angelSky';
import { haptic } from '../lib/haptics';
import { MusicBox } from '../lib/musicBox';
import { speakSequence, stopSpeaking } from '../lib/tts';
import { useProgress } from '../state/ProgressContext';
import { KASIA_COMPLIMENTS, KASIA_DEDICATION, KASIA_TITLE, type KasiaLine as Line } from '../data/kasia';

export { KASIA_COMPLIMENTS, KASIA_DEDICATION, KASIA_TITLE };

/** "Dla Kasi" – a personal dedication screen: night sky, angel wings, music box and love notes. */

type TrMode = 'pl' | 'he' | 'en';

/** Angel wings that unfold, a shimmering golden halo and a beating heart with her name. */
function AngelEmblem() {
  return (
    <svg viewBox="0 0 320 220" className="kasia-emblem mx-auto w-full max-w-[22rem]" role="img" aria-label="Kasia">
      <defs>
        <radialGradient id="k-wing" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f1f5ff" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </radialGradient>
        <linearGradient id="k-halo" x1="0" x2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <radialGradient id="k-heart" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="60%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </radialGradient>
        <filter id="k-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Left and right wings: layered feather rows, unfolding from the heart. */}
      {(['left', 'right'] as const).map((side) => (
        <g key={side} className={`kasia-wing kasia-wing-${side}`} filter="url(#k-glow)">
          <g transform={side === 'right' ? 'translate(320 0) scale(-1 1)' : undefined}>
            <path d="M150 128 C120 70 70 40 18 52 C40 70 44 84 30 96 C60 100 66 110 46 124 C78 126 88 136 70 150 C104 150 124 146 150 136 Z" fill="url(#k-wing)" />
            <path d="M150 132 C118 96 86 84 52 92 C76 104 78 116 62 126 C92 128 104 134 92 148 C116 146 134 142 150 136 Z" fill="#ffffff" opacity="0.9" />
            <path d="M146 130 C110 80 72 62 34 62" stroke="#c7d2fe" strokeWidth="1.2" fill="none" opacity="0.8" />
            <path d="M146 134 C116 108 90 100 60 104" stroke="#c7d2fe" strokeWidth="1" fill="none" opacity="0.7" />
          </g>
        </g>
      ))}

      {/* Golden halo. */}
      <g className="kasia-halo" filter="url(#k-glow)">
        <ellipse cx="160" cy="44" rx="46" ry="12" fill="none" stroke="url(#k-halo)" strokeWidth="6" />
        <ellipse cx="160" cy="44" rx="46" ry="12" fill="none" stroke="#fffbeb" strokeWidth="1.5" opacity="0.9" />
      </g>

      {/* Beating heart with her name. */}
      <g className="kasia-heart" filter="url(#k-glow)">
        <path d="M160 196 C100 160 96 116 124 100 C142 90 156 100 160 112 C164 100 178 90 196 100 C224 116 220 160 160 196 Z" fill="url(#k-heart)" />
        <text x="160" y="146" textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff" style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.5px' }}>
          Kasia
        </text>
      </g>
    </svg>
  );
}

export function KasiaAngel({ onClose }: { onClose: () => void }) {
  const { lang } = useLang();
  const { state, activeStreak } = useProgress();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<AngelSky | null>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<AngelSky | null>(null);
  const musicRef = useRef<MusicBox | null>(null);
  const [muted, setMuted] = useState(false);
  const [trMode, setTrMode] = useState<TrMode>(lang);
  const [reading, setReading] = useState(false);
  const [card, setCard] = useState<number | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const cardRef = useRef<number | null>(null);
  // The parent passes a new callback on every render; the effects below must not restart because of it.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Live stats: what has been learned "for Kasia".
  const learnedWords = Object.values(state.items).filter((p) => p.learned).length;
  const lessonsDone = Object.keys(state.lessons).length;
  const storiesDone = Object.keys(state.stories).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    let sky: AngelSky | null = null;
    if (canvas) {
      try {
        sky = new AngelSky(canvas);
        sky.start();
        skyRef.current = sky;
        window.addEventListener('resize', sky.resize);
      } catch {
        sky = null;
      }
    }
    // Bursts are drawn on a second canvas above the cards, so hearts fly over the text.
    let fx: AngelSky | null = null;
    if (fxCanvasRef.current) {
      try {
        fx = new AngelSky(fxCanvasRef.current, false);
        fx.start();
        fxRef.current = fx;
        window.addEventListener('resize', fx.resize);
      } catch {
        fx = null;
      }
    }
    const music = new MusicBox();
    musicRef.current = music;
    music.start();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      if (sky) {
        sky.stop();
        window.removeEventListener('resize', sky.resize);
      }
      if (fx) {
        fx.stop();
        window.removeEventListener('resize', fx.resize);
      }
      music.close();
      stopSpeaking();
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const toggleMute = () => {
    setMuted((m) => {
      musicRef.current?.setMuted(!m);
      return !m;
    });
  };

  const read = async (lines: string[]) => {
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    setReading(true);
    // The dedication is written by a man (Stworzyłem…), so Marek reads it.
    await speakSequence(lines, 0.9, undefined, 450, lines.map(() => 'm' as const));
    setReading(false);
  };

  const moreMagic = (e: MouseEvent<HTMLButtonElement>) => {
    const canvas = fxCanvasRef.current;
    const fxSky = fxRef.current;
    if (canvas && fxSky) {
      const c = canvas.getBoundingClientRect();
      const b = e.currentTarget.getBoundingClientRect();
      fxSky.burst(b.left + b.width / 2 - c.left, b.top + b.height / 2 - c.top);
      fxSky.burst(c.width / 2, c.height * 0.25, 24);
    }
    musicRef.current?.happyChord();
    haptic('success');
    let next = Math.floor(Math.random() * KASIA_COMPLIMENTS.length);
    if (next === cardRef.current) next = (next + 1) % KASIA_COMPLIMENTS.length;
    cardRef.current = next;
    setCard(next);
    setCardKey((k) => k + 1);
    setReading(true);
    speakSequence([KASIA_COMPLIMENTS[next].pl], 0.9, undefined, 0, ['m']).then(() => setReading(false));
  };

  const t = (l: Line) => (trMode === 'pl' ? null : l[trMode]);
  const trDir = trMode === 'he' ? 'rtl' : 'ltr';
  const compliment = card === null ? null : KASIA_COMPLIMENTS[card];

  return (
    <div className="kasia-screen fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Dla Kasi" data-testid="kasia-modal">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden />

      <div className="relative mx-auto flex min-h-full max-w-xl flex-col items-center gap-5 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex w-full items-center justify-between gap-2" dir="ltr">
          <button type="button" onClick={toggleMute} className="kasia-chip" aria-label={muted ? 'Włącz muzykę' : 'Wycisz muzykę'} aria-pressed={muted} data-testid="kasia-mute">
            {muted ? <VolumeX className="size-5" /> : <Music className="size-5" />}
          </button>
          <div className="kasia-chip-group" role="group" aria-label="Tłumaczenie / Translation">
            <Languages className="size-4 opacity-70" />
            {(['pl', 'he', 'en'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setTrMode(m)} aria-pressed={trMode === m} className={trMode === m ? 'is-on' : ''}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="kasia-chip" aria-label="Zamknij / Close">
            <X className="size-5" />
          </button>
        </div>

        <AngelEmblem />

        <div className="space-y-2 text-center">
          <h2 className="kasia-title" lang="pl">
            {KASIA_TITLE.pl}
          </h2>
          {t(KASIA_TITLE) && (
            <p className="kasia-sub" dir={trDir}>
              {t(KASIA_TITLE)}
            </p>
          )}
        </div>

        <section className="kasia-card w-full space-y-3">
          <p className="kasia-body" lang="pl">
            {KASIA_DEDICATION.pl}
          </p>
          {t(KASIA_DEDICATION) && (
            <p className="kasia-body-tr" dir={trDir}>
              {t(KASIA_DEDICATION)}
            </p>
          )}
          <button type="button" onClick={() => read([KASIA_TITLE.pl, KASIA_DEDICATION.pl])} className="kasia-btn-soft" data-testid="kasia-read">
            {reading ? <Square className="size-4" /> : <Volume2 className="size-4" />}
            {reading ? 'Stop' : 'Przeczytaj na głos'}
            {trMode !== 'pl' && <span className="opacity-75">· {trMode === 'he' ? 'הקראה בקול' : 'Read aloud'}</span>}
          </button>
        </section>

        <section className="kasia-card w-full" data-testid="kasia-meter">
          <p className="mb-3 flex items-center justify-center gap-1.5 text-sm font-bold text-[#fde68a]">
            <Heart className="size-4 fill-[#fb7185] text-[#fb7185]" /> Nauka dla Kasi
            {trMode !== 'pl' && <span className="font-normal opacity-80">· {trMode === 'he' ? 'מד הלמידה למען קאשה' : 'Learning for Kasia'}</span>}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: BookOpen, value: learnedWords, pl: 'słów', he: 'מילים', en: 'words' },
              { icon: GraduationCap, value: lessonsDone, pl: 'lekcji', he: 'שיעורים', en: 'lessons' },
              { icon: Star, value: state.xp, pl: 'XP', he: 'XP', en: 'XP' },
              { icon: Heart, value: activeStreak + storiesDone, pl: 'dni i historii', he: 'ימים וסיפורים', en: 'days & stories' },
            ].map((s) => (
              <div key={s.pl} className="kasia-stat">
                <s.icon className="mx-auto size-5 text-[#fbbf24]" />
                <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
                <p className="text-[11px] text-[#e9d5ff]">{trMode === 'pl' ? s.pl : s[trMode]}</p>
              </div>
            ))}
          </div>
        </section>

        <button type="button" onClick={moreMagic} className="kasia-magic" data-testid="kasia-magic">
          <Heart className="size-5 fill-white" /> Kliknij po więcej miłości, Kasiu
        </button>

        {compliment && (
          <section key={cardKey} className="kasia-card kasia-pop w-full text-center" data-testid="kasia-compliment">
            <p className="kasia-compliment" lang="pl">
              {compliment.pl}
            </p>
            {t(compliment) && (
              <p className="kasia-body-tr mt-1" dir={trDir}>
                {t(compliment)}
              </p>
            )}
            <button type="button" onClick={() => read([compliment.pl])} className="kasia-btn-soft mx-auto mt-3">
              <Volume2 className="size-4" /> Posłuchaj
            </button>
          </section>
        )}
      </div>
      <canvas ref={fxCanvasRef} className="pointer-events-none fixed inset-0 z-10 h-full w-full" aria-hidden />
    </div>
  );
}

/** Golden "Dla Kasi" button with angel wings and a halo glow for the top bar. */
export function KasiaButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="kasia-top-btn" aria-label="Dla Kasi" data-testid="kasia-button">
      <svg viewBox="0 0 40 24" className="h-4 w-7 shrink-0" aria-hidden>
        <path d="M17 15 C13 8 8 5 2 6 C5 8 5 10 3 11 C7 12 7 13 5 15 C9 16 13 16 17 15 Z" fill="#fff" stroke="#f59e0b" strokeWidth="0.8" />
        <path d="M23 15 C27 8 32 5 38 6 C35 8 35 10 37 11 C33 12 33 13 35 15 C31 16 27 16 23 15 Z" fill="#fff" stroke="#f59e0b" strokeWidth="0.8" />
        <path d="M20 21 C14 17 14 12 17 11 C18.5 10.5 19.6 11.4 20 12.4 C20.4 11.4 21.5 10.5 23 11 C26 12 26 17 20 21 Z" fill="#e11d48" />
        <ellipse cx="20" cy="4" rx="5" ry="1.6" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
      </svg>
      <span className="whitespace-nowrap">Dla Kasi</span>
    </button>
  );
}
