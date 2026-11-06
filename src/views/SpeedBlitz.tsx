import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Timer, Trophy, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { ALL_ITEMS } from '../data';
import { BLITZ_SECONDS, blitzPool, comboMultiplier } from '../lib/blitz';
import { itemText, type LearningItem } from '../data/types';
import { PolishSyllables } from '../components/PolishSyllables';
import { useLang } from '../i18n/LangContext';
import { haptic } from '../lib/haptics';
import { pick, shuffle } from '../lib/random';
import { speak, stopSpeaking } from '../lib/tts';
import { playCue } from '../lib/sfx';
import { useProgress } from '../state/ProgressContext';

/**
 * Speed Blitz: 60 seconds to match as many Polish words as possible with their meaning.
 * Correct answers build a combo (x2 from 5 in a row, x3 from 10); a mistake resets it.
 * The personal record is stored with the progress (LocalStorage) and every point is also XP.
 */

interface Question {
  item: LearningItem;
  options: LearningItem[];
}

function makeQuestion(pool: LearningItem[], lang: 'he' | 'en', previous?: string): Question {
  const candidates = pool.length > 1 ? pool.filter((i) => i.id !== previous) : pool;
  const item = pick(candidates);
  const meaning = (i: LearningItem) => itemText(i, lang).meaning;
  // Distractors with different meanings; widen to the whole course if the pool is small.
  const others = shuffle([...pool, ...ALL_ITEMS]).filter((i) => i.id !== item.id && meaning(i) !== meaning(item));
  const distinct: LearningItem[] = [];
  for (const o of others) {
    if (distinct.length === 3) break;
    if (!distinct.some((d) => meaning(d) === meaning(o))) distinct.push(o);
  }
  return { item, options: shuffle([item, ...distinct]) };
}

export function SpeedBlitz({ onExit }: { onExit: () => void }) {
  const { tr, lang } = useLang();
  const { state, recordBlitz } = useProgress();
  const pool = useMemo(
    () =>
      blitzPool(
        Object.entries(state.items)
          .filter(([, p]) => p.learned)
          .map(([id]) => id),
      ),
    // Fixed for the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [timeLeft, setTimeLeft] = useState(BLITZ_SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [answered, setAnswered] = useState({ right: 0, wrong: 0 });
  const [question, setQuestion] = useState<Question>(() => makeQuestion(pool, lang));
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null);
  const [sound, setSound] = useState(true);
  const [prevBest, setPrevBest] = useState(state.blitz.best);
  const endAtRef = useRef(0);
  const scoreRef = useRef(0);
  const lockRef = useRef(false);

  const say = useCallback((text: string) => sound && speak(text, 1), [sound]);

  const start = () => {
    setPrevBest(state.blitz.best);
    scoreRef.current = 0;
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setAnswered({ right: 0, wrong: 0 });
    const q = makeQuestion(pool, lang);
    setQuestion(q);
    setTimeLeft(BLITZ_SECONDS);
    endAtRef.current = Date.now() + BLITZ_SECONDS * 1000;
    setPhase('playing');
    say(q.item.polish);
  };

  // Countdown driven by wall-clock time so it stays exact even if the tab stutters.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 5 && left > 0) void playCue('tick', 0.08);
      if (left === 0) {
        window.clearInterval(id);
        stopSpeaking();
        setPhase('over');
        recordBlitz(scoreRef.current);
        haptic('success');
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, recordBlitz]);

  useEffect(() => () => stopSpeaking(), []);

  const answer = (opt: LearningItem) => {
    if (phase !== 'playing' || lockRef.current) return;
    lockRef.current = true;
    const ok = opt.id === question.item.id;
    setFlash({ id: opt.id, ok });
    if (ok) {
      const nextCombo = combo + 1;
      const gained = comboMultiplier(nextCombo);
      scoreRef.current += gained;
      setScore(scoreRef.current);
      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));
      setAnswered((a) => ({ ...a, right: a.right + 1 }));
      haptic('success');
    } else {
      setCombo(0);
      setAnswered((a) => ({ ...a, wrong: a.wrong + 1 }));
      haptic('error');
    }
    window.setTimeout(
      () => {
        const q = makeQuestion(pool, lang, question.item.id);
        setQuestion(q);
        setFlash(null);
        lockRef.current = false;
        say(q.item.polish);
      },
      ok ? 250 : 650,
    );
  };

  const mult = comboMultiplier(combo);
  const newRecord = phase === 'over' && score > prevBest;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50" data-testid="speed-blitz">
      <header className="pt-safe flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={onExit} className="grid size-10 place-items-center rounded-full hover:bg-amber-100" aria-label={tr('יציאה', 'Exit')}>
          <X className="size-5" />
        </button>
        <p className="flex-1 text-center text-lg font-black">
          <Zap className="inline size-5 fill-amber-400 text-amber-500" /> {tr('אתגר מהירות 60 שניות', '60-second Speed Blitz')}
        </p>
        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          className="grid size-10 place-items-center rounded-full hover:bg-amber-100"
          aria-label={sound ? tr('השתק הקראה', 'Mute voice') : tr('הפעל הקראה', 'Unmute voice')}
          aria-pressed={sound}
        >
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
      </header>

      {phase === 'ready' && (
        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <Timer className="size-16 text-amber-500" />
          <p className="max-w-sm text-slate-600">
            {tr(
              'מילה בפולנית מופיעה ונשמעת – בחרו את הפירוש הנכון כמה שיותר מהר. 5 ברצף = כפול נקודות, 10 ברצף = משולש.',
              'A Polish word appears and is spoken – pick the right meaning as fast as you can. 5 in a row = double points, 10 in a row = triple.',
            )}
          </p>
          <p className="flex items-center gap-1.5 font-bold text-amber-700" data-testid="blitz-best">
            <Trophy className="size-5" /> {tr('השיא שלכם', 'Your record')}: {state.blitz.best}
          </p>
          <button type="button" onClick={start} className="rounded-3xl bg-amber-500 px-10 py-4 text-xl font-black text-white shadow-lg active:scale-95">
            {tr('התחל!', 'Start!')}
          </button>
        </main>
      )}

      {phase === 'playing' && (
        <main className="flex flex-1 flex-col gap-4 px-4 pb-8">
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-black tabular-nums ${timeLeft <= 10 ? 'text-rose-600' : 'text-slate-900'}`} data-testid="blitz-time">
              {timeLeft}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-amber-100">
              <div className="h-full rounded-full bg-amber-500 transition-[width] duration-200" style={{ width: `${(timeLeft / BLITZ_SECONDS) * 100}%` }} />
            </div>
            <span className="text-2xl font-black text-amber-700 tabular-nums" data-testid="blitz-score">
              {score}
            </span>
          </div>
          <p className={`flex h-7 items-center justify-center gap-1 text-sm font-bold ${combo >= 5 ? 'text-orange-600' : 'text-slate-400'}`}>
            <Flame className={`size-4 ${combo >= 5 ? 'fill-orange-400' : ''}`} />
            {tr('רצף', 'Combo')} {combo}
            {mult > 1 && <span className="animate-pop-in rounded-full bg-orange-500 px-2 text-white">x{mult}</span>}
          </p>
          <button type="button" onClick={() => say(question.item.polish)} className="mx-auto flex items-center gap-2 rounded-3xl bg-white px-6 py-5 shadow-sm ring-1 ring-amber-200" data-testid="blitz-word">
            <PolishSyllables notation={question.item.syllablesPolish} size="xl" />
            <Volume2 className="size-5 shrink-0 text-slate-400" />
          </button>
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((opt) => {
              const f = flash && (flash.id === opt.id || (!flash.ok && opt.id === question.item.id));
              const cls = !f ? 'bg-white ring-slate-200 hover:ring-amber-300' : opt.id === question.item.id ? 'bg-emerald-100 ring-emerald-500' : 'animate-shake bg-rose-100 ring-rose-500';
              return (
                <button key={opt.id} type="button" onClick={() => answer(opt)} className={`min-h-14 rounded-2xl px-4 py-3 text-base font-bold ring-2 transition active:scale-[0.98] ${cls}`}>
                  {itemText(opt, lang).meaning}
                </button>
              );
            })}
          </div>
        </main>
      )}

      {phase === 'over' && (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" data-testid="blitz-over">
          <Trophy className={`size-16 ${newRecord ? 'animate-bounce text-amber-500' : 'text-slate-400'}`} />
          <p className="text-2xl font-black">{newRecord ? tr('שיא אישי חדש!', 'New personal record!') : tr('הזמן נגמר!', "Time's up!")}</p>
          <p className="text-5xl font-black text-amber-600 tabular-nums">{score}</p>
          <p className="text-sm text-slate-600">
            {tr(`${answered.right} נכונות · ${answered.wrong} שגויות · רצף שיא ${bestCombo}`, `${answered.right} right · ${answered.wrong} wrong · best combo ${bestCombo}`)}
          </p>
          <p className="text-sm font-bold text-amber-700">
            {tr('השיא', 'Record')}: {Math.max(prevBest, score)} · +{score} XP
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={start} className="rounded-2xl bg-amber-500 px-6 py-3 font-bold text-white">
              {tr('שוב!', 'Again!')}
            </button>
            <button type="button" onClick={onExit} className="rounded-2xl bg-slate-100 px-6 py-3 font-bold">
              {tr('סיום', 'Done')}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
