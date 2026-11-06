import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ear, Headphones, Mic, Pause, Play, SkipForward, Volume2, X } from 'lucide-react';
import { itemText } from '../data/types';
import { handsFreeQueue } from '../lib/handsFreeQueue';
import { Phonetic } from '../components/Phonetic';
import { PolishSyllables } from '../components/PolishSyllables';
import { useSpeechRecorder, type RecorderResult } from '../hooks/useSpeechRecorder';
import { useLang } from '../i18n/LangContext';
import { haptic } from '../lib/haptics';
import { scorePronunciation } from '../lib/text';
import { RATE_NORMAL, RATE_SLOW, loadVoices, speak, speakNative, stopSpeaking } from '../lib/tts';
import { playCue } from '../lib/sfx';
import { mediaRecordingSupported } from '../lib/env';
import { itemWeakness, useProgress } from '../state/ProgressContext';
import { useMic } from '../state/MicContext';

/**
 * Hands-free audio trainer (Pimsleur style) for driving or walking.
 * Loop per word, with no taps needed:
 *   1. the meaning is spoken in Hebrew / English (when the device has such a voice) and shown large
 *   2. the Polish phrase is spoken slowly, then at normal speed
 *   3. a short cue, then the microphone opens; the attempt is scored
 *   4. success chime – or the Polish is repeated once more when the score is low
 *   5. after 2 seconds the next word starts
 * A Wake Lock keeps the screen on. Without a usable microphone the step becomes "repeat aloud"
 * with a timed pause, so the loop keeps going.
 */

export const HANDS_FREE_PASS = 70;
const NEXT_DELAY_MS = 2000;

type Phase = 'meaning' | 'slow' | 'normal' | 'listen' | 'repeat' | 'feedback';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Keeps the screen awake while `active`; re-acquired when the page becomes visible again. */
function useWakeLock(active: boolean) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void>; addEventListener?: (t: string, f: () => void) => void } | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } };
    const request = async () => {
      if (!nav.wakeLock || document.visibilityState !== 'visible') return;
      try {
        const l = await nav.wakeLock.request('screen');
        if (cancelled) {
          l?.release().catch(() => undefined);
          return;
        }
        lock = l;
        setHeld(true);
        l?.addEventListener?.('release', () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => undefined);
      setHeld(false);
    };
  }, [active]);
  return held;
}

export function HandsFree({ source, onExit }: { source: 'map' | 'vocab'; onExit: () => void }) {
  const { tr, lang } = useLang();
  const { state, recordPronunciation } = useProgress();
  const mic = useMic();

  const queue = useMemo(
    () =>
      handsFreeQueue(
        source,
        Object.entries(state.items)
          .filter(([, p]) => p.learned)
          .map(([id]) => id),
        (id) => itemWeakness(state.items[id]),
        new Set(Object.keys(state.lessons)),
      ),
    // The queue is fixed for the session; progress updates during it must not reshuffle it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source],
  );

  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('meaning');
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [heard, setHeard] = useState<boolean | null>(null);
  const [nativeVoice, setNativeVoice] = useState(true);
  const [stats, setStats] = useState({ done: 0, passed: 0 });
  // Bumped to restart the loop on another word (skip).
  const [runKey, setRunKey] = useState(0);

  const item = queue[index % Math.max(1, queue.length)];
  const recorder = useSpeechRecorder({ target: item?.polish ?? '', maxDurationMs: 7000 });
  const wakeLock = useWakeLock(!paused);

  const tokenRef = useRef(0);
  const indexRef = useRef(0);
  const micOkRef = useRef(mediaRecordingSupported && !mic.blocked);
  const pendingRef = useRef<((r: RecorderResult | null) => void) | null>(null);
  const startRef = useRef(recorder.start);
  startRef.current = recorder.start;
  const stopRef = useRef(recorder.stop);
  stopRef.current = recorder.stop;

  // Deliver recorder outcomes to the awaiting loop.
  useEffect(() => {
    if (recorder.result && pendingRef.current) {
      pendingRef.current(recorder.result);
      pendingRef.current = null;
    }
  }, [recorder.result]);
  useEffect(() => {
    if (recorder.error && pendingRef.current) {
      micOkRef.current = false;
      pendingRef.current(null);
      pendingRef.current = null;
    }
  }, [recorder.error]);

  const recordOnce = useCallback(
    () =>
      new Promise<RecorderResult | null>((resolve) => {
        pendingRef.current = resolve;
        startRef.current();
        // Safety net: never let the loop hang on a recorder that does not answer.
        setTimeout(() => {
          if (pendingRef.current === resolve) {
            pendingRef.current = null;
            stopRef.current();
            resolve(null);
          }
        }, 15000);
      }),
    [],
  );

  const runLoop = useCallback(
    async (token: number) => {
      const alive = () => token === tokenRef.current;
      await loadVoices(1500);
      while (alive() && queue.length) {
        const current = queue[indexRef.current % queue.length];
        const text = itemText(current, lang);
        setScore(null);
        setHeard(null);

        setPhase('meaning');
        const spoke = await speakNative(text.meaning, lang);
        if (!alive()) return;
        setNativeVoice(spoke);
        await sleep(spoke ? 500 : 1800);
        if (!alive()) return;

        setPhase('slow');
        await speak(current.polish, RATE_SLOW);
        if (!alive()) return;
        await sleep(600);

        setPhase('normal');
        await speak(current.polish, RATE_NORMAL);
        if (!alive()) return;
        await sleep(250);

        let s: number | null = null;
        if (micOkRef.current) {
          setPhase('listen');
          await playCue('listen');
          haptic('start');
          if (!alive()) return;
          const res = await recordOnce();
          if (!alive()) return;
          if (res) {
            setHeard(res.heardVoice);
            if (res.recognized) {
              s = scorePronunciation(current.polish, res.transcript).score;
              recordPronunciation(current.id, current.polish, s, []);
            }
          }
        } else {
          // No microphone: classic "repeat after the speaker" pause, long enough for the phrase.
          setPhase('repeat');
          await sleep(Math.max(2500, current.polish.length * 140));
          if (!alive()) return;
        }

        setPhase('feedback');
        setScore(s);
        if (s !== null && s < HANDS_FREE_PASS) {
          haptic('error');
          await playCue('retry');
          if (!alive()) return;
          await speak(current.polish, RATE_SLOW);
        } else {
          haptic('success');
          await playCue('success');
        }
        if (!alive()) return;
        setStats((st) => ({ done: st.done + 1, passed: st.passed + (s === null || s >= HANDS_FREE_PASS ? 1 : 0) }));
        await sleep(NEXT_DELAY_MS);
        if (!alive()) return;

        indexRef.current += 1;
        if (indexRef.current % queue.length === 0) setRound((r) => r + 1);
        setIndex(indexRef.current);
      }
    },
    [queue, lang, recordOnce, recordPronunciation],
  );

  // Start (and restart after resume) the loop; any state change of `paused` cancels the previous run.
  useEffect(() => {
    if (paused) return;
    const token = ++tokenRef.current;
    void runLoop(token);
    return () => {
      tokenRef.current++;
      stopSpeaking();
      if (pendingRef.current) {
        const p = pendingRef.current;
        pendingRef.current = null;
        stopRef.current();
        p(null);
      }
    };
  }, [paused, runLoop, runKey]);

  const skip = () => {
    indexRef.current += 1;
    setIndex(indexRef.current);
    setRunKey((k) => k + 1);
  };

  if (!item) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <p>{tr('אין מילים לתרגול עדיין.', 'No words to practise yet.')}</p>
        <button type="button" onClick={onExit} className="rounded-2xl bg-slate-900 px-6 py-3 font-bold text-white">
          {tr('חזרה', 'Back')}
        </button>
      </div>
    );
  }

  const text = itemText(item, lang);
  const phaseLabel: Record<Phase, string> = {
    meaning: tr('המשמעות', 'Meaning'),
    slow: tr('בפולנית – לאט', 'Polish – slowly'),
    normal: tr('בפולנית – בקצב רגיל', 'Polish – normal speed'),
    listen: tr('תורכם – אמרו בקול!', 'Your turn – say it aloud!'),
    repeat: tr('חזרו אחרי הדובר בקול', 'Repeat aloud after the speaker'),
    feedback: score === null ? tr('יפה! ממשיכים…', 'Nice! Moving on…') : score >= HANDS_FREE_PASS ? tr(`מצוין – ${score}%`, `Great – ${score}%`) : tr(`${score}% – הקשיבו שוב`, `${score}% – listen once more`),
  };
  const PhaseIcon = phase === 'listen' ? Mic : phase === 'repeat' ? Ear : phase === 'meaning' ? Headphones : Volume2;

  return (
    <div className="flex min-h-dvh flex-col bg-[linear-gradient(180deg,#1e1b4b,#312e81_55%,#0c4a6e)] text-white" data-testid="hands-free">
      <header className="pt-safe flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={onExit} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label={tr('יציאה', 'Exit')}>
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-bold">{tr('מצב נהיגה והליכה', 'Driving & walking mode')}</p>
          <p className="text-xs text-white/70" data-testid="hf-counter">
            {tr('מילה', 'Word')} {(index % queue.length) + 1}/{queue.length} · {tr('סבב', 'Round')} {round}
          </p>
        </div>
        <button type="button" onClick={skip} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label={tr('דלג', 'Skip')}>
          <SkipForward className="size-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold" aria-live="polite" data-testid="hf-phase">
          <PhaseIcon className={`size-4 ${phase === 'listen' ? 'animate-pulse text-[#fda4af]' : ''}`} /> {paused ? tr('מושהה', 'Paused') : phaseLabel[phase]}
        </p>

        <p className="text-4xl leading-tight font-black sm:text-5xl" dir={lang === 'he' ? 'rtl' : 'ltr'}>
          {text.meaning}
        </p>
        {!nativeVoice && phase === 'meaning' && (
          <p className="text-xs text-white/60">{tr('(אין במכשיר קול עברי – המשמעות מוצגת על המסך)', '(No English voice on this device – the meaning is shown on screen)')}</p>
        )}

        <div className={`transition-opacity ${phase === 'meaning' ? 'opacity-30' : 'opacity-100'}`}>
          <PolishSyllables notation={item.syllablesPolish} size="xl" className="!text-white" />
          <Phonetic he={item.phoneticHebrew} en={item.phoneticEnglish} className="!text-[#bae6fd]" />
        </div>

        {phase === 'listen' && (
          <div className="h-3 w-56 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#fb7185] transition-[width] duration-75" style={{ width: `${Math.max(4, recorder.level * 100)}%` }} />
          </div>
        )}
        {phase === 'feedback' && heard === false && (
          <p className="text-sm text-[#fde68a]">{tr('לא נקלט קול – נסו לדבר קרוב יותר למיקרופון.', 'No voice captured – try speaking closer to the microphone.')}</p>
        )}

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="grid size-32 place-items-center rounded-full bg-[#ffffff] text-[#312e81] shadow-2xl ring-8 ring-white/20 transition active:scale-95"
          aria-label={paused ? tr('המשך', 'Resume') : tr('השהה', 'Pause')}
          data-testid="hf-toggle"
        >
          {paused ? <Play className="size-14 fill-[#312e81]" /> : <Pause className="size-14 fill-[#312e81]" />}
        </button>

        <p className="text-xs text-white/60">
          {tr(`${stats.done} מילים · ${stats.passed} הצלחות`, `${stats.done} words · ${stats.passed} passed`)}
          {wakeLock && ` · ${tr('המסך יישאר דלוק', 'Screen stays on')}`}
        </p>
      </main>
    </div>
  );
}
