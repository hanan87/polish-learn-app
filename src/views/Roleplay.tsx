import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BedDouble, Coffee, Handshake, Mic, RotateCcw, TrainFront, Trophy, User, Volume2, XCircle, type LucideIcon } from 'lucide-react';
import { ROLEPLAYS, type Roleplay as RoleplayT, type RoleplayOption } from '../data/dialogues';
import { STORIES } from '../data/stories';
import { FormalityBadge } from '../components/FormalityBadge';
import { Phonetic } from '../components/Phonetic';
import { PolishSyllables } from '../components/PolishSyllables';
import { PronunciationPractice } from '../components/PronunciationPractice';
import { useLang } from '../i18n/LangContext';
import { usePersonal } from '../hooks/usePersonal';
import { toEnglishPhonetic, toHebrewPhonetic, toSyllableNotation } from '../lib/polishPhonetics';
import { shuffle } from '../lib/random';
import { speak } from '../lib/tts';
import { useProgress } from '../state/ProgressContext';

/** Score needed for the spoken reply to move the conversation forward. */
export const ROLEPLAY_PASS = 70;

const ICONS: Record<string, LucideIcon> = {
  'warsaw-cafe': Coffee,
  'train-ticket': TrainFront,
  'taxi-hotel': BedDouble,
  meeting: Handshake,
};

export function Roleplay({ onOpenStory }: { onOpenStory: (id: string) => void }) {
  const { state } = useProgress();
  const { tr, lang } = useLang();
  const { tx } = usePersonal();
  const [active, setActive] = useState<RoleplayT | null>(null);

  if (active) return <RoleplayRunner key={active.id} scenario={active} onExit={() => setActive(null)} />;

  return (
    <div className="space-y-4">
      <section className="space-y-3" data-testid="stories">
        <h2 className="text-lg font-black">{tr('סיפורים קצרים', 'Mini stories')}</h2>
        <p className="text-sm text-slate-600">
          {tr('דיאלוגים קצרים ומצחיקים. הקישו על כל מילה לתרגום ולפענוח הסיומת, וענו על 2 שאלות הבנה.', 'Short, funny dialogues. Tap any word for its meaning and ending decoder, then answer 2 questions.')}
        </p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STORIES.map((s) => {
            const done = state.stories[s.id];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onOpenStory(s.id)}
                  className="flex h-full w-full flex-col items-start gap-1 rounded-2xl bg-white p-3 text-start shadow-sm ring-1 ring-slate-200 transition hover:ring-amber-300 active:scale-[0.98]"
                >
                  <span className="text-2xl" aria-hidden>
                    {s.emoji}
                  </span>
                  <span className="text-sm leading-tight font-bold text-slate-900">{s.title[lang]}</span>
                  <span className="polish text-xs text-slate-500" dir="ltr">
                    {s.titlePl}
                  </span>
                  {done && (
                    <span className="mt-auto flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <Trophy className="size-3.5" /> {done.bestCorrect}/{s.questions.length}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <h2 className="text-lg font-black">{tr('סימולציות שיחה', 'Conversations')}</h2>
      <p className="text-sm leading-relaxed text-slate-600">
        {tr(
          'סימולציית שיחה קולית: הדובר הפולני מדבר, אתם בוחרים תגובה – ואז אומרים אותה בקול. השיחה מתקדמת רק כשההגייה תקינה.',
          'Voice roleplay: the Polish speaker talks, you choose a reply – then say it aloud. The conversation moves on only when your pronunciation passes.',
        )}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ROLEPLAYS.map((r) => {
          const done = state.dialogues[r.id];
          const Icon = ICONS[r.id] ?? User;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setActive(r)}
                className="flex h-full w-full flex-col gap-2 rounded-3xl bg-white p-4 text-start shadow-sm ring-1 ring-slate-200 transition hover:ring-rose-300 active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <span className="grid size-10 place-items-center rounded-2xl bg-rose-100 text-rose-600">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1 text-base font-bold text-slate-900">{r.title[lang]}</span>
                  {done && (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600">
                      <Trophy className="size-4" /> {done.bestScore}%
                    </span>
                  )}
                </span>
                <span className="text-sm text-slate-600">{tx(r.setting)}</span>
                <span className="mt-auto flex items-center gap-2 text-xs text-slate-500">
                  <FormalityBadge formality={r.register} />
                  {tr(`${r.turns.length} תורות`, `${r.turns.length} turns`)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface Turn {
  speaker: 'partner' | 'me';
  polish: string;
  he: string;
  en: string;
  score?: number;
}

/** "A woman says: …" / "To a woman: …" – how the phrase changes for the other gender. */
function AltNote({ template, me }: { template: string; me: boolean }) {
  const { tr } = useLang();
  const { alt } = usePersonal();
  const a = alt(template);
  if (!a) return null;
  const label = me
    ? a.gender === 'f' ? tr('אישה אומרת:', 'A woman says:') : tr('גבר אומר:', 'A man says:')
    : a.gender === 'f' ? tr('לאישה:', 'To a woman:') : tr('לגבר:', 'To a man:');
  return (
    <p className="text-[11px] text-violet-700" data-testid="gender-alt">
      {label}{' '}
      <button type="button" onClick={() => speak(a.polish)} className="polish font-bold underline decoration-violet-300" dir="ltr">
        {a.polish}
      </button>
    </p>
  );
}

function Bubble({ entry, partnerName }: { entry: Turn; partnerName: string }) {
  const { tr } = useLang();
  const { pl, tx } = usePersonal();
  const me = entry.speaker === 'me';
  const polish = pl(entry.polish);
  return (
    <div className={`animate-pop-in flex gap-2 ${me ? 'flex-row-reverse' : ''}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${me ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
        <User className="size-4" />
      </span>
      <div className={`max-w-[85%] space-y-1 rounded-2xl px-4 py-2.5 shadow-sm ${me ? 'rounded-se-sm bg-rose-50 ring-1 ring-rose-200' : 'rounded-ss-sm bg-white ring-1 ring-slate-200'}`}>
        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          {me ? tr('אתם', 'You') : partnerName}
          {entry.score !== undefined && <span className="rounded-full bg-emerald-100 px-1.5 font-bold text-emerald-700">{entry.score}%</span>}
        </p>
        <button type="button" onClick={() => speak(polish)} className="flex items-start gap-1.5 text-start">
          <PolishSyllables notation={toSyllableNotation(polish)} size="sm" showDots={false} />
          <Volume2 className="mt-1 size-4 shrink-0 text-slate-400" />
        </button>
        <Phonetic he={toHebrewPhonetic(polish)} en={toEnglishPhonetic(polish)} size="sm" />
        <p className="text-sm text-slate-500">{tx({ he: entry.he, en: entry.en })}</p>
        <AltNote template={entry.polish} me={me} />
      </div>
    </div>
  );
}

function RoleplayRunner({ scenario, onExit }: { scenario: RoleplayT; onExit: () => void }) {
  const { completeDialogue } = useProgress();
  const { tr, lang, dir } = useLang();
  const { pl, tx } = usePersonal();
  const [turn, setTurn] = useState(0);
  const [answers, setAnswers] = useState<Turn[]>([]);
  const [picked, setPicked] = useState<RoleplayOption | null>(null);
  const [wrongPick, setWrongPick] = useState<RoleplayOption | null>(null);
  const [firstTry, setFirstTry] = useState<boolean[]>([]);
  const [tried, setTried] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const current = scenario.turns[turn];
  const options = useMemo(() => (current ? shuffle(current.options) : []), [current]);

  // The chat log is derived from state: every partner line up to the current turn plus accepted replies.
  const log = useMemo(() => {
    const entries: Turn[] = [];
    scenario.turns.slice(0, turn + 1).forEach((t, i) => {
      entries.push({ speaker: 'partner', polish: t.line.polish, he: t.line.t.he, en: t.line.t.en });
      if (answers[i]) entries.push(answers[i]);
    });
    return entries;
  }, [scenario, turn, answers]);

  useEffect(() => {
    if (current && !finished) speak(pl(current.line.polish));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, finished]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log.length, picked, wrongPick, bestScore, finished]);

  const choose = (opt: RoleplayOption) => {
    if (picked) return;
    if (!tried) {
      setFirstTry((f) => [...f, opt.correct]);
      setTried(true);
    }
    if (opt.correct) {
      setWrongPick(null);
      setPicked(opt);
      speak(pl(opt.polish), 0.9);
    } else {
      setWrongPick(opt);
    }
  };

  const advance = (score: number | undefined) => {
    if (!picked) return;
    setAnswers((a) => {
      const copy = [...a];
      copy[turn] = { speaker: 'me', polish: picked.polish, he: picked.t.he, en: picked.t.en, score };
      return copy;
    });
    setPicked(null);
    setWrongPick(null);
    setTried(false);
    setBestScore(null);
    if (turn + 1 >= scenario.turns.length) {
      const choiceScore = (firstTry.filter(Boolean).length / scenario.turns.length) * 100;
      completeDialogue(scenario.id, Math.round(choiceScore));
      setFinished(true);
    } else {
      setTurn((t) => t + 1);
    }
  };

  const restart = () => {
    setTurn(0);
    setAnswers([]);
    setPicked(null);
    setWrongPick(null);
    setFirstTry([]);
    setTried(false);
    setBestScore(null);
    setFinished(false);
  };

  const passed = bestScore !== null && bestScore >= ROLEPLAY_PASS;
  const spokenScores = answers.map((a) => a.score).filter((s): s is number => s !== undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onExit} className="grid size-10 place-items-center rounded-full hover:bg-slate-200" aria-label={tr('חזרה', 'Back')}>
          <BackIcon className="size-5" />
        </button>
        <h2 className="flex-1 text-lg font-bold">{scenario.title[lang]}</h2>
        <span className="text-xs font-bold text-slate-500">
          {Math.min(turn + 1, scenario.turns.length)}/{scenario.turns.length}
        </span>
      </div>
      <p className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">{tx(scenario.setting)}</p>

      <div className="space-y-3">
        {log.map((entry, i) => (
          <Bubble key={i} entry={entry} partnerName={scenario.partner[lang]} />
        ))}
      </div>

      {!finished && current && !picked && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-700">{tr('בחרו תגובה:', 'Choose your reply:')}</p>
          {options.map((opt) => (
            <button
              key={opt.polish}
              type="button"
              onClick={() => choose(opt)}
              className={`w-full space-y-1 rounded-2xl px-4 py-3 text-start ring-2 transition active:scale-[0.99] ${
                wrongPick === opt ? 'animate-shake bg-rose-50 ring-rose-400' : 'bg-white ring-slate-200 hover:ring-slate-300'
              }`}
            >
              <PolishSyllables notation={toSyllableNotation(pl(opt.polish))} size="md" />
              <Phonetic he={toHebrewPhonetic(pl(opt.polish))} en={toEnglishPhonetic(pl(opt.polish))} size="sm" />
              <span className="block text-sm text-slate-500">{tx(opt.t)}</span>
            </button>
          ))}
          {wrongPick && (
            <p className="animate-pop-in flex items-start gap-2 rounded-2xl bg-rose-50 p-3 text-sm text-rose-900">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                {tx(wrongPick.feedback)} {tr('נסו תגובה אחרת.', 'Try another reply.')}
              </span>
            </p>
          )}
        </div>
      )}

      {!finished && picked && (
        <div className="animate-pop-in space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-2 ring-emerald-300">
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{tx(picked.feedback)}</p>
          <p className="flex items-center gap-1.5 font-bold text-slate-800">
            <Mic className="size-4 text-rose-600" /> {tr('עכשיו אמרו את זה בקול:', 'Now say it aloud:')}
          </p>
          <div className="text-center">
            <PolishSyllables notation={toSyllableNotation(pl(picked.polish))} size="lg" />
            <Phonetic he={toHebrewPhonetic(pl(picked.polish))} en={toEnglishPhonetic(pl(picked.polish))} />
            <AltNote template={picked.polish} me />
          </div>
          <PronunciationPractice target={pl(picked.polish)} onResult={(s) => setBestScore((b) => Math.max(b ?? 0, s))} />
          {passed ? (
            <button type="button" onClick={() => advance(bestScore ?? undefined)} className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white shadow-md active:scale-[0.98]">
              {tr(`ההגייה תקינה (${bestScore}%) – המשך בשיחה`, `Pronunciation passed (${bestScore}%) – continue`)}
            </button>
          ) : (
            <p className="text-center text-xs text-slate-500">
              {bestScore === null
                ? tr(`השיחה תתקדם כשתגיעו ל-${ROLEPLAY_PASS}% לפחות.`, `The conversation continues once you reach at least ${ROLEPLAY_PASS}%.`)
                : tr(`${bestScore}% – עוד ניסיון אחד? השוו קולות ונסו שוב.`, `${bestScore}% – one more try? Compare voices and try again.`)}
            </p>
          )}
          {!passed && (
            <button type="button" onClick={() => advance(undefined)} className="mx-auto block text-xs text-slate-400 underline">
              {tr('דלגו על הדיבור בתור הזה', 'Skip speaking for this turn')}
            </button>
          )}
        </div>
      )}

      {finished && (
        <div className="animate-pop-in space-y-3 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <Trophy className="mx-auto size-12 text-amber-500" />
          <p className="text-xl font-black">{tr('השיחה הושלמה!', 'Conversation complete!')}</p>
          <p className="text-slate-600">
            {tr(
              `${firstTry.filter(Boolean).length} מתוך ${scenario.turns.length} תגובות נכונות בניסיון הראשון`,
              `${firstTry.filter(Boolean).length} of ${scenario.turns.length} replies right on the first try`,
            )}
          </p>
          {spokenScores.length > 0 && (
            <p className="text-sm text-slate-500">
              {tr('ציון הגייה ממוצע', 'Average pronunciation')}: {Math.round(spokenScores.reduce((a, b) => a + b, 0) / spokenScores.length)}%
            </p>
          )}
          <div className="flex justify-center gap-2">
            <button type="button" onClick={restart} className="flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-3 font-medium">
              <RotateCcw className="size-4" /> {tr('שוב', 'Again')}
            </button>
            <button type="button" onClick={onExit} className="rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white">
              {tr('לשיחות נוספות', 'More conversations')}
            </button>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
