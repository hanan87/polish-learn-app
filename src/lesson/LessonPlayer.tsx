import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Dumbbell, Info, Star, Target, Trophy, X, XCircle } from 'lucide-react';
import { getUnit } from '../data';
import { getLesson } from '../data/lessons';
import { StandaloneDownload } from '../components/StandaloneDownload';
import { useLang } from '../i18n/LangContext';
import { stopSpeaking } from '../lib/tts';
import { useMic } from '../state/MicContext';
import { XP, useProgress } from '../state/ProgressContext';
import { STAGE_LABELS, buildLesson, buildReinforcementLesson, type LessonStep } from './buildLesson';
import { LearnStep } from './steps/LearnStep';
import { ListenMeaningStep, ListenPairStep } from './steps/ListenSteps';
import { AssembleStep, ChooseSpellingStep, FillBlankStep } from './steps/ReadingSteps';
import { RecallStep } from './steps/RecallStep';
import { WritingStep } from './steps/WritingStep';
import type { StepResult } from './types';

export const PRACTICE_LESSON_ID = 'practice';

interface Props {
  /** A course lesson id (e.g. "u1-L1") or "practice" for the personalized reinforcement lesson. */
  lessonId: string;
  onClose: () => void;
}

/** Full-screen lesson runner with a top progress bar and a feedback footer. */
export function LessonPlayer({ lessonId, onClose }: Props) {
  const isPractice = lessonId === PRACTICE_LESSON_ID;
  const lesson = isPractice ? undefined : getLesson(lessonId);
  const progress = useProgress();
  const { tr, lang } = useLang();
  const mic = useMic();
  // Steps are built once when the lesson opens, so new results do not reshuffle a running lesson.
  const [queue, setQueue] = useState<LessonStep[]>(() => (isPractice ? buildReinforcementLesson(progress.state) : lesson ? buildLesson(lesson) : []));
  const [baseLength] = useState(queue.length || 1);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<StepResult | null>(null);
  const [graded, setGraded] = useState<Record<string, boolean>>({});
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [confirmExit, setConfirmExit] = useState(false);
  const [done, setDone] = useState(false);
  const startXp = useRef(progress.state.xp);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      stopSpeaking();
    };
  }, []);

  const step = queue[index];

  const accuracyOf = (g: Record<string, boolean>) => {
    const values = Object.values(g);
    return values.length ? Math.round((values.filter(Boolean).length / values.length) * 100) : 100;
  };

  const finish = () => {
    if (lesson) {
      lesson.itemIds.forEach((id) => progress.markLearned(id));
      progress.completeLesson(lesson.id, accuracyOf(graded));
    } else {
      progress.award(XP.lessonComplete);
    }
    setDone(true);
  };

  const next = () => {
    stopSpeaking();
    setResult(null);
    if (index + 1 >= queue.length) finish();
    else {
      setIndex((i) => i + 1);
      scrollRef.current?.scrollTo({ top: 0 });
    }
  };

  const advanceRef = useRef(next);
  advanceRef.current = next;

  const onAnswered = useCallback(
    (r: StepResult) => {
      if (!step) return;
      // Learn cards are ungraded: their own button already means "continue".
      if (step.kind === 'learn') {
        advanceRef.current();
        return;
      }
      setResult(r);
      const isRetry = step.key.endsWith('-retry');
      // Accuracy counts first attempts only.
      if (r.correct !== null && !isRetry && !(step.key in graded)) {
        setGraded((g) => ({ ...g, [step.key]: r.correct as boolean }));
      }
      // A wrong answer comes back exactly once at the end of the lesson.
      if (r.correct === false && !isRetry && !requeued.has(step.key)) {
        setRequeued((s) => new Set(s).add(step.key));
        setQueue((q) => [...q, { ...step, key: step.key + '-retry' } as LessonStep]);
      }
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
    },
    [step, graded, requeued],
  );

  if ((!lesson && !isPractice) || queue.length === 0) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-white p-6 text-center">
        <div className="space-y-3">
          <p>{isPractice ? tr('אין עדיין מספיק נתונים לאימון חיזוק.', 'Not enough history yet for a reinforcement session.') : tr('השיעור לא נמצא.', 'Lesson not found.')}</p>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-2 text-white">
            {tr('חזרה', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  const subtitle = lesson
    ? `${tr('יחידה', 'Unit')} ${getUnit(lesson.unitId).order} · ${tr('שיעור', 'Lesson')} ${lesson.number}`
    : tr('אימון חיזוק מותאם אישית', 'Personalized reinforcement');
  const pct = done ? 100 : Math.min(100, (index / Math.max(queue.length, baseLength)) * 100);

  if (done) {
    const earned = progress.state.xp - startXp.current;
    return (
      <div className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-amber-50 to-white p-6 text-center">
        {isPractice ? <Dumbbell className="size-20 text-indigo-500" /> : <Trophy className="size-20 text-amber-500" />}
        <div>
          <p className="text-3xl font-black text-slate-900">{isPractice ? tr('האימון הושלם!', 'Session complete!') : tr('השיעור הושלם!', 'Lesson complete!')}</p>
          <p className="mt-1 text-slate-600">{subtitle}</p>
        </div>
        <div className="grid w-full max-w-sm grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 ring-2 ring-amber-300">
            <Star className="mx-auto size-6 fill-amber-400 text-amber-500" />
            <p className="mt-1 text-2xl font-black">+{earned}</p>
            <p className="text-xs text-slate-500">XP</p>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-2 ring-emerald-300">
            <Target className="mx-auto size-6 text-emerald-600" />
            <p className="mt-1 text-2xl font-black">{accuracyOf(graded)}%</p>
            <p className="text-xs text-slate-500">{tr('דיוק', 'Accuracy')}</p>
          </div>
        </div>
        <p className="max-w-sm text-sm text-slate-600">
          {isPractice
            ? tr('התוצאות עודכנו בהיסטוריה האישית שלכם – המילים והצלילים החלשים יחזרו שוב בקרוב.', 'Your results updated your personal history – weak words and sounds will come back soon.')
            : tr('כל המילים מהשיעור נוספו למאגר החזרה המרווחת ויחזרו אליכם מחר.', 'All words from this lesson were added to your spaced-repetition deck and will return tomorrow.')}
        </p>
        <button type="button" onClick={onClose} className="w-full max-w-sm rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-md active:scale-[0.98]">
          {tr('המשך', 'Continue')}
        </button>
      </div>
    );
  }

  const footerTone = result
    ? { success: 'bg-emerald-100 text-emerald-900', warning: 'bg-amber-100 text-amber-900', error: 'bg-rose-100 text-rose-900', neutral: 'bg-slate-100 text-slate-900' }[result.tone]
    : '';
  const FooterIcon = result ? { success: CheckCircle2, warning: AlertTriangle, error: XCircle, neutral: Info }[result.tone] : Info;

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-slate-50" role="dialog" aria-modal="true" aria-label={subtitle}>
      {mic.blocked && mic.status !== 'no-device' && <StandaloneDownload />}
      <header className="pt-safe border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setConfirmExit(true)} className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label={tr('יציאה מהשיעור', 'Exit lesson')}>
            <X className="size-6" />
          </button>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }}>
              <div className="mx-2 mt-1 h-1 rounded-full bg-white/40" />
            </div>
          </div>
          <span className="text-xs font-bold whitespace-nowrap text-slate-500">
            {index + 1}/{queue.length}
          </span>
        </div>
        {step && (
          <p className="mx-auto max-w-2xl px-4 pb-2 text-xs font-bold tracking-wide text-rose-600">
            {isPractice && <span className="text-indigo-600">{tr('אימון חיזוק · ', 'Reinforcement · ')}</span>}
            {STAGE_LABELS[step.kind][lang]}
            {step.key.endsWith('-retry') && tr(' · חזרה על טעות', ' · retry')}
          </p>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div key={step?.key} className="animate-pop-in mx-auto max-w-2xl px-4 pt-4 pb-40">
          {step && renderStep(step, !!result, onAnswered)}
        </div>
      </div>

      {result && (
        <div className={`animate-pop-in pb-safe fixed inset-x-0 bottom-0 z-10 ${footerTone} shadow-[0_-8px_24px_rgba(15,23,42,0.12)]`}>
          <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
            <div className="flex items-start gap-2">
              <FooterIcon className="mt-0.5 size-6 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="text-lg font-black">{result.title}</p>
                {result.detail}
              </div>
            </div>
            <button
              type="button"
              onClick={next}
              autoFocus
              className={`w-full rounded-2xl py-4 text-base font-bold text-white shadow-md active:scale-[0.98] ${
                result.tone === 'error' ? 'bg-rose-600' : result.tone === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              {index + 1 >= queue.length ? tr(`סיום (+${XP.lessonComplete} XP)`, `Finish (+${XP.lessonComplete} XP)`) : tr('המשך', 'Continue')}
            </button>
          </div>
        </div>
      )}

      {confirmExit && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/40 p-6">
          <div className="animate-pop-in w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="text-lg font-bold">{tr('לצאת מהשיעור?', 'Leave the lesson?')}</p>
            <p className="text-sm text-slate-600">{tr('ההתקדמות בשיעור הנוכחי לא תישמר.', 'Progress in this lesson will not be saved.')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmExit(false)} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white">
                {tr('להמשיך ללמוד', 'Keep learning')}
              </button>
              <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 py-3 font-medium text-rose-600">
                {tr('יציאה', 'Leave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderStep(step: LessonStep, answered: boolean, onAnswered: (r: StepResult) => void) {
  switch (step.kind) {
    case 'learn':
      return <LearnStep step={step} answered={answered} onAnswered={onAnswered} />;
    case 'listen-meaning':
      return <ListenMeaningStep step={step} answered={answered} onAnswered={onAnswered} />;
    case 'listen-pair':
      return <ListenPairStep step={step} answered={answered} onAnswered={onAnswered} />;
    case 'assemble':
      return <AssembleStep step={step} answered={answered} onAnswered={onAnswered} />;
    case 'fill-blank':
      return <FillBlankStep step={step} answered={answered} onAnswered={onAnswered} />;
    case 'choose-spelling':
      return <ChooseSpellingStep step={step} answered={answered} onAnswered={onAnswered} />;
    case 'write':
      return <WritingStep step={step} answered={answered} onAnswered={onAnswered} />;
    case 'recall':
      return <RecallStep step={step} answered={answered} onAnswered={onAnswered} />;
  }
}
