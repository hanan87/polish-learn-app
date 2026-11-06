import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Ear, Headphones, Lightbulb, Mic, Pause, Play, SkipForward, Volume2, X, XCircle } from 'lucide-react';
import { itemText } from '../data/types';
import { handsFreeQueue } from '../lib/handsFreeQueue';
import { Phonetic } from '../components/Phonetic';
import { PolishSyllables } from '../components/PolishSyllables';
import { useSpeechRecorder, type RecorderResult } from '../hooks/useSpeechRecorder';
import { useLang } from '../i18n/LangContext';
import { haptic } from '../lib/haptics';
import { scorePronunciation, type WordResult } from '../lib/text';
import { COACH, type CoachLine } from '../data/coach';
import { helpForMiss, judgeAttempt, SILENT_PAUSE_AFTER, SKIP_HINT_AFTER, type Help, type Outcome } from '../lib/handsFreeJudge';
import { RATE_CHAIN, RATE_NORMAL, RATE_SLOW, loadVoices, speak, speakNative, speakSequence, stopSpeaking } from '../lib/tts';
import { playCue } from '../lib/sfx';
import { mediaRecordingSupported } from '../lib/env';
import { itemWeakness, useProgress } from '../state/ProgressContext';
import { useMic } from '../state/MicContext';

/**
 * Hands-free audio trainer (Pimsleur style) for driving or walking.
 * Loop per word, with no taps needed:
 *   1. the meaning is spoken in Hebrew / English (when the device has such a voice) and shown large
 *   2. the Polish phrase is spoken slowly, then at normal speed
 *   3. a short cue, then the microphone opens; the attempt is judged (lib/handsFreeJudge)
 *   4. only a real recognition score ≥ 70 % passes. A miss is said out loud ("Not quite",
 *      "I didn't recognize the word", "I didn't hear you"), followed by help that grows with each
 *      miss – slow replay, the phrase built up in parts, the articulation tip – and another try,
 *      until the word passes (the skip button moves on manually)
 *   5. after 2 seconds the next word starts
 * A Wake Lock keeps the screen on. Without a usable microphone the step becomes "repeat aloud"
 * with a timed pause, so the loop keeps going.
 */

const NEXT_DELAY_MS = 2000;

type Phase = 'meaning' | 'slow' | 'normal' | 'listen' | 'repeat' | 'feedback' | 'help';

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
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [heardText, setHeardText] = useState('');
  const [words, setWords] = useState<WordResult[]>([]);
  const [attempt, setAttempt] = useState(1);
  const [help, setHelp] = useState<Help | null>(null);
  const [cantCheck, setCantCheck] = useState(false);
  const [nativeVoice, setNativeVoice] = useState(true);
  const [stats, setStats] = useState({ done: 0, passed: 0, misses: 0 });
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

        // Say a coaching line in the learner's language (shown on screen as well).
        const coach = async (line: CoachLine) => {
          await speakNative(COACH[line][lang], lang);
        };

        let misses = 0;
        let silentInRow = 0;
        let passed = false;
        setAttempt(1);
        setHelp(null);
        while (alive() && !passed) {
          setOutcome(null);
          setScore(null);
          setHeardText('');
          setWords([]);

          if (!micOkRef.current) {
            // No microphone: "repeat after the speaker", then the model again so the learner can compare.
            setPhase('repeat');
            await sleep(Math.max(2500, current.polish.length * 140));
            if (!alive()) return;
            setPhase('feedback');
            setOutcome('unchecked');
            setCantCheck(true);
            await speak(current.polish, RATE_NORMAL);
            break;
          }

          setPhase('listen');
          await playCue('listen');
          haptic('start');
          if (!alive()) return;
          const res = await recordOnce();
          if (!alive()) return;
          const verdict = judgeAttempt(current.polish, res);
          setPhase('feedback');
          setOutcome(verdict.outcome);
          setScore(verdict.score);
          setHeardText(verdict.heard);
          if (verdict.heard) setWords(scorePronunciation(current.polish, verdict.heard).words);
          if (verdict.score !== null) recordPronunciation(current.id, current.polish, verdict.score, []);

          if (verdict.outcome === 'pass') {
            passed = true;
            haptic('success');
            await playCue('success');
            if (!alive()) return;
            await coach(misses ? 'passAfterHelp' : 'pass');
            break;
          }
          if (verdict.outcome === 'unchecked') {
            // The device cannot verify speech: say so honestly, model the phrase again and move on.
            setCantCheck(true);
            await coach('unchecked');
            if (!alive()) return;
            await speak(current.polish, RATE_NORMAL);
            break;
          }

          // A miss: tell the learner, then help, then try again.
          misses++;
          silentInRow = verdict.outcome === 'silent' ? silentInRow + 1 : 0;
          setStats((st) => ({ ...st, misses: st.misses + 1 }));
          haptic('error');
          await playCue('retry');
          if (!alive()) return;
          await coach(verdict.outcome === 'silent' ? 'silent' : verdict.outcome === 'low' ? 'low' : 'unclear');
          if (!alive()) return;
          if (silentInRow >= SILENT_PAUSE_AFTER) {
            await coach('paused');
            setPaused(true);
            return;
          }

          const h = helpForMiss(misses);
          setHelp(h);
          setPhase('help');
          if (h === 'chunks') {
            await coach('chunks');
            if (!alive()) return;
            await speakSequence([...current.backchainingSteps], RATE_CHAIN, undefined, 700);
          } else if (h === 'tip') {
            await speakNative(`${COACH.tip[lang]} ${text.tip}`, lang);
            if (!alive()) return;
            await speak(current.polish, RATE_SLOW);
          } else {
            await speak(current.polish, RATE_SLOW);
            if (!alive()) return;
            await sleep(500);
            await speak(current.polish, RATE_NORMAL);
          }
          if (!alive()) return;
          if (misses === SKIP_HINT_AFTER) await coach('skipHint');
          if (!alive()) return;
          await sleep(300);
          setAttempt(misses + 1);
        }
        if (!alive()) return;
        setStats((st) => ({ ...st, done: st.done + 1, passed: st.passed + (passed ? 1 : 0) }));
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
    feedback:
      outcome === 'pass'
        ? `${COACH[attempt > 1 ? 'passAfterHelp' : 'pass'][lang]} ${score}%`
        : outcome === 'low'
          ? `${COACH.low[lang]} (${score}%)`
          : outcome === 'unclear'
            ? COACH.unclear[lang]
            : outcome === 'silent'
              ? COACH.silent[lang]
              : outcome === 'unchecked'
                ? tr('לא נבדק – השוו לדובר', 'Not checked – compare with the speaker')
                : '',
    help:
      help === 'chunks'
        ? COACH.chunks[lang]
        : help === 'tip'
          ? tr('טיפ להגייה', 'Pronunciation tip')
          : tr('הקשיבו שוב: לאט, ואז רגיל', 'Listen again: slowly, then normal'),
  };
  const miss = outcome === 'low' || outcome === 'unclear' || outcome === 'silent';
  const PhaseIcon =
    phase === 'listen' ? Mic : phase === 'repeat' ? Ear : phase === 'meaning' ? Headphones : phase === 'help' ? Lightbulb : outcome === 'pass' ? CheckCircle2 : miss ? XCircle : Volume2;
  const phaseTone = phase === 'feedback' && outcome === 'pass' ? 'bg-[#059669]' : (phase === 'feedback' && miss) || phase === 'help' ? 'bg-[#be123c]' : 'bg-white/10';

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
        <p className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${phaseTone}`} aria-live="polite" data-testid="hf-phase">
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
        {attempt > 1 && (phase === 'listen' || phase === 'feedback' || phase === 'help') && (
          <p className="text-xs font-bold text-[#fde68a]" data-testid="hf-attempt">
            {tr(`ניסיון ${attempt} – ממשיכים עד שמצליחים`, `Attempt ${attempt} – we keep going until you get it`)}
          </p>
        )}
        {(phase === 'feedback' || phase === 'help') && heardText && (
          <div className="space-y-1.5" data-testid="hf-heard">
            <p className="text-sm text-white/80">
              {tr('שמעתי:', 'I heard:')}{' '}
              <span dir="ltr" className="polish font-bold text-white">
                “{heardText}”
              </span>
            </p>
            {miss && words.length > 0 && (
              <p dir="ltr" className="polish flex flex-wrap justify-center gap-1.5 text-lg">
                {words.map((w, i) => (
                  <span key={i} className={`rounded-md px-1.5 ${w.matched ? 'bg-[#059669]/30 text-[#a7f3d0]' : 'bg-[#be123c]/40 text-[#fecdd3] line-through decoration-2'}`}>
                    {w.word}
                  </span>
                ))}
              </p>
            )}
          </div>
        )}
        {phase === 'help' && help === 'tip' && <p className="max-w-md rounded-xl bg-white/10 p-3 text-sm leading-relaxed text-white/90">{text.tip}</p>}
        {phase === 'help' && help === 'chunks' && (
          <p dir="ltr" className="polish flex flex-wrap justify-center gap-2 text-base text-[#bae6fd]">
            {item.backchainingSteps.map((step, i) => (
              <span key={i}>
                {i > 0 && <span className="text-white/40">→ </span>}
                {step}
              </span>
            ))}
          </p>
        )}
        {cantCheck && (
          <p className="max-w-sm text-xs text-[#fde68a]">
            {tr('זיהוי דיבור לא זמין כאן, ולכן ההגייה לא נבדקת. ב-Chrome באנדרואיד ובמחשב הבדיקה עובדת.', 'Speech recognition is not available here, so pronunciation is not checked. Checking works in Chrome on Android and desktop.')}
          </p>
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
          {tr(`${stats.done} מילים · ${stats.passed} הצלחות · ${stats.misses} תיקונים`, `${stats.done} words · ${stats.passed} passed · ${stats.misses} corrections`)}
          {wakeLock && ` · ${tr('המסך יישאר דלוק', 'Screen stays on')}`}
        </p>
      </main>
    </div>
  );
}
