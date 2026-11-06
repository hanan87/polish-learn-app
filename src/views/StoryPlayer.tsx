import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Eye, EyeOff, Play, Square, Trophy, Volume2, X, XCircle } from 'lucide-react';
import { lookupWord, splitEnding, wordKey, type Story } from '../data/stories';
import { Phonetic } from '../components/Phonetic';
import { PolishSyllables } from '../components/PolishSyllables';
import { useLang } from '../i18n/LangContext';
import { haptic } from '../lib/haptics';
import { toEnglishPhonetic, toHebrewPhonetic, toSyllableNotation } from '../lib/polishPhonetics';
import { shuffle } from '../lib/random';
import { RATE_CHAIN, speak, speakSequence, stopSpeaking } from '../lib/tts';
import { useProgress, XP } from '../state/ProgressContext';

interface Inspect {
  line: number;
  word: number;
  token: string;
}

/** Tap-to-inspect bubble: meaning, syllables, audio and the ending decoder. */
function WordBubble({ story, token, onClose }: { story: Story; token: string; onClose: () => void }) {
  const { tr, lang } = useLang();
  const clean = token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
  const entry = lookupWord(story, token);
  const ending = entry?.base && wordKey(entry.base) !== wordKey(clean) ? splitEnding(entry.base, clean) : null;

  useEffect(() => {
    speak(clean, 0.8);
  }, [clean]);

  return (
    <div className="animate-pop-in relative mt-2 space-y-2 rounded-2xl bg-[#0f172a] p-4 text-white shadow-xl" role="dialog" aria-label={clean} data-testid="word-bubble">
      <button type="button" onClick={onClose} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-[#cbd5e1] hover:bg-white/10" aria-label={tr('סגור', 'Close')}>
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-2 pr-9" dir="ltr">
        <button type="button" onClick={() => speak(clean, 0.8)} className="grid size-9 place-items-center rounded-full bg-white/15" aria-label={tr('השמע מילה', 'Play word')}>
          <Volume2 className="size-4" />
        </button>
        <PolishSyllables notation={toSyllableNotation(clean)} size="lg" className="!text-white" />
      </div>
      <Phonetic he={toHebrewPhonetic(clean)} en={toEnglishPhonetic(clean)} size="sm" className="!text-[#e2e8f0]" />
      <p className="text-lg font-bold text-[#fcd34d]">{entry ? entry.t[lang] : '—'}</p>
      {ending && (
        <div className="rounded-xl bg-white/10 p-2.5 text-sm" data-testid="ending-decoder">
          <p className="mb-1 text-xs font-bold text-[#cbd5e1]">{tr('מפענח סיומות', 'Ending decoder')}</p>
          <p dir="ltr" className="polish flex flex-wrap items-center gap-2 text-base">
            <span>
              {ending.stem}
              <span className="rounded bg-[#64748b] px-0.5 line-through decoration-[#fb7185]">{ending.baseEnd || '∅'}</span>
            </span>
            <span className="text-[#94a3b8]">→</span>
            <span className="font-bold">
              {ending.stem}
              <span className="rounded bg-[#10b981] px-0.5 text-white">{ending.formEnd || '∅'}</span>
            </span>
          </p>
        </div>
      )}
      {entry?.note && <p className="text-sm leading-relaxed text-[#e2e8f0]">{entry.note[lang]}</p>}
    </div>
  );
}

export function StoryPlayer({ story, onExit }: { story: Story; onExit: () => void }) {
  const { tr, lang, dir } = useLang();
  const { completeStory, state } = useProgress();
  const [shown, setShown] = useState(1);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [showTr, setShowTr] = useState(true);
  const [playingLine, setPlayingLine] = useState<number | null>(null);
  const [quiz, setQuiz] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(boolean | null)[]>([null, null]);
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Captured on open, so the summary compares with the record from before this run.
  const [prevBest] = useState(() => state.stories[story.id]?.bestCorrect);
  const bottomRef = useRef<HTMLDivElement>(null);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const allShown = shown >= story.lines.length;
  const question = story.questions[qIndex];
  const options = useMemo(() => shuffle(question.options), [question]);
  const correctCount = answers.filter(Boolean).length;

  useEffect(() => () => stopSpeaking(), []);

  // Each newly revealed line is read aloud.
  useEffect(() => {
    if (quiz) return;
    const i = shown - 1;
    setPlayingLine(i);
    speak(story.lines[i].polish, 0.9).then(() => setPlayingLine((p) => (p === i ? null : p)));
  }, [shown, story, quiz]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [shown, quiz, qIndex, done, picked]);

  const playAll = async () => {
    if (playingLine !== null) {
      stopSpeaking();
      setPlayingLine(null);
      return;
    }
    await speakSequence(
      story.lines.slice(0, shown).map((l) => l.polish),
      RATE_CHAIN,
      (i) => setPlayingLine(i),
      500,
    );
    setPlayingLine(null);
  };

  const answer = (opt: (typeof options)[number]) => {
    if (picked) return;
    setPicked(opt.polish);
    haptic(opt.correct ? 'success' : 'error');
    setAnswers((a) => a.map((v, i) => (i === qIndex ? opt.correct : v)));
  };

  const nextQuestion = () => {
    setPicked(null);
    if (qIndex + 1 < story.questions.length) setQIndex(qIndex + 1);
    else {
      completeStory(story.id, correctCount, story.questions.length);
      setDone(true);
    }
  };

  const earned = XP.storyComplete + correctCount * XP.storyQuestion;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-3 pb-10">
      <header className="pt-safe sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
        <button type="button" onClick={onExit} className="grid size-10 place-items-center rounded-full hover:bg-slate-100" aria-label={tr('חזרה', 'Back')}>
          <BackIcon className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black">
            {story.emoji} {story.title[lang]}
          </p>
          <p className="polish truncate text-xs text-slate-500" dir="ltr">
            {story.titlePl}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTr((v) => !v)}
          className="grid size-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
          aria-label={showTr ? tr('הסתר תרגום', 'Hide translation') : tr('הצג תרגום', 'Show translation')}
          aria-pressed={showTr}
        >
          {showTr ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
        </button>
        <button
          type="button"
          onClick={playAll}
          className="grid size-10 place-items-center rounded-full bg-rose-600 text-white"
          aria-label={playingLine !== null ? tr('עצור', 'Stop') : tr('השמע את הסיפור', 'Play the story')}
        >
          {playingLine !== null ? <Square className="size-4" /> : <Play className="size-4 fill-white" />}
        </button>
      </header>

      <p className="mb-3 flex items-center gap-1.5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
        <BookOpen className="size-4 shrink-0" />
        {tr('הקישו על כל מילה כדי לראות תרגום, הברות, השמעה – ולמה הסיומת שלה השתנתה.', 'Tap any word for its meaning, syllables and audio – and why its ending changed.')}
      </p>

      <ol className="space-y-3">
        {story.lines.slice(0, shown).map((line, li) => {
          const tokens = line.polish.split(/\s+/);
          const left = li % 2 === 0;
          return (
            <li key={li} className={`animate-pop-in flex flex-col ${left ? 'items-start' : 'items-end'}`} dir="ltr">
              <span className="mb-0.5 px-2 text-[11px] font-bold text-slate-500">{line.speaker}</span>
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-2.5 shadow-sm ring-1 ${left ? 'rounded-ss-sm bg-white ring-slate-200' : 'rounded-se-sm bg-rose-50 ring-rose-200'} ${
                  playingLine === li ? 'ring-2 ring-amber-400' : ''
                }`}
              >
                <p className="polish flex flex-wrap gap-x-1.5 gap-y-1 text-lg leading-snug">
                  {tokens.map((tok, wi) => {
                    const active = inspect?.line === li && inspect.word === wi;
                    const known = !!lookupWord(story, tok);
                    return (
                      <button
                        key={wi}
                        type="button"
                        onClick={() => setInspect(active ? null : { line: li, word: wi, token: tok })}
                        className={`rounded-md px-0.5 transition ${active ? 'bg-amber-300 text-slate-900' : known ? 'underline decoration-slate-300 decoration-dotted underline-offset-4 hover:bg-amber-100' : ''}`}
                      >
                        {tok}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => speak(line.polish, 0.9)} className="text-slate-400" aria-label={tr('השמע שורה', 'Play line')}>
                    <Volume2 className="size-4" />
                  </button>
                </p>
                {showTr && (
                  <p className="mt-1 text-sm text-slate-500" dir={lang === 'he' ? 'rtl' : 'ltr'}>
                    {line.t[lang]}
                  </p>
                )}
              </div>
              {inspect?.line === li && (
                <div className="w-full" dir={lang === 'he' ? 'rtl' : 'ltr'}>
                  <WordBubble story={story} token={inspect.token} onClose={() => setInspect(null)} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!allShown && (
        <button
          type="button"
          onClick={() => {
            setInspect(null);
            setShown((n) => n + 1);
          }}
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 font-bold text-white active:scale-[0.98]"
        >
          <ChevronDown className="size-5" /> {tr('השורה הבאה', 'Next line')} ({shown}/{story.lines.length})
        </button>
      )}

      {allShown && !quiz && (
        <button type="button" onClick={() => setQuiz(true)} className="mt-4 rounded-2xl bg-rose-600 py-3.5 font-bold text-white shadow-md active:scale-[0.98]">
          {tr('לשאלות ההבנה', 'To the comprehension questions')}
        </button>
      )}

      {quiz && !done && (
        <section className="animate-pop-in mt-5 space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold text-slate-500">
            {tr('שאלה', 'Question')} {qIndex + 1}/{story.questions.length}
          </p>
          <button type="button" onClick={() => speak(question.q)} className="polish flex items-center gap-2 text-xl font-black" dir="ltr">
            {question.q} <Volume2 className="size-4 text-slate-400" />
          </button>
          <p className="text-sm text-slate-500">{question.t[lang]}</p>
          <div className="grid gap-2">
            {options.map((opt) => {
              const isPicked = picked === opt.polish;
              const reveal = picked !== null;
              const cls = !reveal
                ? 'bg-slate-50 ring-slate-200 hover:ring-slate-300'
                : opt.correct
                  ? 'bg-emerald-50 ring-emerald-400'
                  : isPicked
                    ? 'bg-rose-50 ring-rose-400'
                    : 'bg-slate-50 ring-slate-200 opacity-60';
              return (
                <button key={opt.polish} type="button" disabled={reveal} onClick={() => answer(opt)} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-start ring-2 transition ${cls}`}>
                  <span className="min-w-0 flex-1">
                    <span className="polish block font-bold" dir="ltr">
                      {opt.polish}
                    </span>
                    <span className="block text-xs text-slate-500">{opt.t[lang]}</span>
                  </span>
                  {reveal && opt.correct && <CheckCircle2 className="size-5 text-emerald-600" />}
                  {reveal && isPicked && !opt.correct && <XCircle className="size-5 text-rose-600" />}
                </button>
              );
            })}
          </div>
          {picked && (
            <button type="button" onClick={nextQuestion} className="w-full rounded-2xl bg-slate-900 py-3.5 font-bold text-white">
              {qIndex + 1 < story.questions.length ? tr('לשאלה הבאה', 'Next question') : tr('סיום הסיפור', 'Finish the story')}
            </button>
          )}
        </section>
      )}

      {done && (
        <section className="animate-pop-in mt-5 space-y-3 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <Trophy className="mx-auto size-12 text-amber-500" />
          <p className="text-xl font-black">{tr('הסיפור הושלם!', 'Story complete!')}</p>
          <p className="text-slate-600">
            {tr(`${correctCount} מתוך ${story.questions.length} תשובות נכונות`, `${correctCount} of ${story.questions.length} answers right`)} · +{earned} XP
          </p>
          {prevBest !== undefined && <p className="text-xs text-slate-400">{tr(`שיא קודם: ${prevBest}`, `Previous best: ${prevBest}`)}</p>}
          <button type="button" onClick={onExit} className="rounded-2xl bg-slate-900 px-6 py-3 font-bold text-white">
            {tr('לסיפורים נוספים', 'More stories')}
          </button>
        </section>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
