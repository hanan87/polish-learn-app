import { useState } from 'react';
import { Globe2, Volume2 } from 'lucide-react';
import { getItem } from '../../data';
import { itemText } from '../../data/types';
import { FormalityBadge } from '../../components/FormalityBadge';
import { PolishSyllables } from '../../components/PolishSyllables';
import { useLang } from '../../i18n/LangContext';
import { normalize } from '../../lib/text';
import { speak } from '../../lib/tts';
import { useProgress } from '../../state/ProgressContext';
import { tokens, type LessonStep } from '../buildLesson';
import type { StepProps } from '../types';

function ContextBox({ itemId }: { itemId: string }) {
  const item = getItem(itemId)!;
  const { lang } = useLang();
  const text = itemText(item, lang);
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <FormalityBadge formality={item.formality} />
      <p className="text-lg font-bold text-slate-900">{text.meaning}</p>
      {text.note && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-sky-800">
          <Globe2 className="mt-0.5 size-3.5 shrink-0" />
          {text.note}
        </p>
      )}
    </div>
  );
}

function CheckButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { tr } = useLang();
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white shadow-md transition active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none">
      {tr('בדיקה', 'Check')}
    </button>
  );
}

function ResultDetail({ itemId }: { itemId: string }) {
  const item = getItem(itemId)!;
  return (
    <button type="button" onClick={() => speak(item.polish)} className="flex items-center gap-2 text-start">
      <PolishSyllables notation={item.syllablesPolish} size="sm" />
      <Volume2 className="size-4 shrink-0 opacity-60" />
    </button>
  );
}

type AssembleStepT = Extract<LessonStep, { kind: 'assemble' }>;

/** Stage 3a – build the Polish sentence from a word bank (with distractor words). */
export function AssembleStep({ step, answered, onAnswered }: StepProps<AssembleStepT>) {
  const item = getItem(step.itemId)!;
  const { tr } = useLang();
  const { recordExercise } = useProgress();
  // Track chosen bank indices so duplicate words are handled correctly.
  const [chosen, setChosen] = useState<number[]>([]);

  const check = () => {
    const built = chosen.map((i) => step.bank[i]).join(' ');
    const ok = normalize(built) === normalize(tokens(item.polish).join(' '));
    recordExercise(item.id, item.polish, ok);
    onAnswered({
      correct: ok,
      tone: ok ? 'success' : 'error',
      title: ok ? tr('משפט מושלם!', 'Perfect sentence!') : tr('הסדר או המילים לא מדויקים', 'The words or their order are not right'),
      detail: <ResultDetail itemId={item.id} />,
    });
    speak(item.polish);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{tr('הרכיבו את המשפט בפולנית', 'Build the sentence in Polish')}</h2>
      <ContextBox itemId={item.id} />
      <div dir="ltr" className="flex min-h-16 flex-wrap content-start gap-2 rounded-2xl border-b-2 border-slate-300 p-2">
        {chosen.map((bankIdx, pos) => (
          <button
            key={`${bankIdx}-${pos}`}
            type="button"
            disabled={answered}
            onClick={() => setChosen((c) => c.filter((_, i) => i !== pos))}
            className="polish animate-pop-in rounded-xl bg-white px-3 py-2 text-lg font-semibold shadow-xs ring-1 ring-slate-300"
          >
            {step.bank[bankIdx]}
          </button>
        ))}
      </div>
      <div dir="ltr" className="flex flex-wrap justify-center gap-2">
        {step.bank.map((word, idx) => {
          const used = chosen.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              disabled={used || answered}
              onClick={() => {
                setChosen((c) => [...c, idx]);
                speak(word);
              }}
              className={`polish rounded-xl px-3 py-2 text-lg font-semibold ring-1 transition ${
                used ? 'bg-slate-200 text-transparent ring-slate-200' : 'bg-white shadow-xs ring-slate-300 active:scale-95'
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>
      {!answered && <CheckButton disabled={chosen.length === 0} onClick={check} />}
    </div>
  );
}

type FillStep = Extract<LessonStep, { kind: 'fill-blank' }>;

/** Stage 3b – complete the missing word (often the form of address: Pan / Pani / ty). */
export function FillBlankStep({ step, answered, onAnswered }: StepProps<FillStep>) {
  const item = getItem(step.itemId)!;
  const { tr } = useLang();
  const { recordExercise } = useProgress();
  const words = tokens(item.polish);
  const answer = words[step.blankIndex];
  const [picked, setPicked] = useState<string | null>(null);
  const trailing = item.polish.trim().match(/[.,!?]+$/)?.[0] ?? '';

  const check = () => {
    if (!picked) return;
    const ok = normalize(picked) === normalize(answer);
    recordExercise(item.id, item.polish, ok);
    const isRegister = ['Pan', 'Pani', 'Panu', 'ty', 'masz', 'ma'].includes(answer);
    const registerHint = !isRegister
      ? ''
      : item.formality === 'formal'
        ? tr('שימו לב: זו פנייה רשמית – Pan/Pani עם פועל בגוף שלישי.', 'Note: this is formal address – Pan/Pani with a third-person verb.')
        : item.formality === 'casual'
          ? tr('שימו לב: זו פנייה חברית (ty) – פועל בגוף שני.', 'Note: this is casual address (ty) – a second-person verb.')
          : '';
    onAnswered({
      correct: ok,
      tone: ok ? 'success' : 'error',
      title: ok ? tr('נכון!', 'Correct!') : tr(`המילה החסרה: ${answer}`, `The missing word: ${answer}`),
      detail: (
        <div className="space-y-1">
          <ResultDetail itemId={item.id} />
          {registerHint && <p>{registerHint}</p>}
        </div>
      ),
    });
    speak(item.polish);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{tr('השלימו את המילה החסרה', 'Fill in the missing word')}</h2>
      <ContextBox itemId={item.id} />
      <p dir="ltr" lang="pl" className="polish flex flex-wrap items-center gap-x-2 gap-y-2 text-2xl font-semibold">
        {words.map((w, i) =>
          i === step.blankIndex ? (
            <span key={i} className={`inline-block min-w-20 rounded-lg border-b-4 px-2 text-center ${picked ? 'border-rose-400 text-rose-600' : 'border-slate-300 text-transparent'}`}>
              {picked ?? '___'}
            </span>
          ) : (
            <span key={i}>{w}</span>
          ),
        )}
        {trailing && <span>{trailing}</span>}
      </p>
      <div dir="ltr" className="grid grid-cols-2 gap-2">
        {step.options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={answered}
            onClick={() => setPicked(opt)}
            className={`polish rounded-2xl px-3 py-3 text-lg font-semibold ring-2 transition ${
              answered && normalize(opt) === normalize(answer) ? 'bg-emerald-50 ring-emerald-500' : picked === opt ? 'bg-rose-50 ring-rose-400' : 'bg-white ring-slate-200'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {!answered && <CheckButton disabled={!picked} onClick={check} />}
    </div>
  );
}

type SpellStep = Extract<LessonStep, { kind: 'choose-spelling' }>;

/** Stage 3c – reading recognition for single words: pick the correctly written Polish word. */
export function ChooseSpellingStep({ step, answered, onAnswered }: StepProps<SpellStep>) {
  const item = getItem(step.itemId)!;
  const { tr } = useLang();
  const { recordExercise } = useProgress();
  const [picked, setPicked] = useState<string | null>(null);

  const check = () => {
    if (!picked) return;
    const ok = normalize(picked) === normalize(item.polish);
    recordExercise(item.id, item.polish, ok);
    onAnswered({
      correct: ok,
      tone: ok ? 'success' : 'error',
      title: ok ? tr('קריאה מדויקת!', 'Accurate reading!') : tr('כמעט – שימו לב לאותיות המיוחדות', 'Almost – watch the special letters'),
      detail: <ResultDetail itemId={item.id} />,
    });
    speak(item.polish);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{tr('איך כותבים את זה בפולנית?', 'How is this written in Polish?')}</h2>
      <ContextBox itemId={item.id} />
      <div dir="ltr" className="grid gap-2">
        {step.options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={answered}
            onClick={() => setPicked(opt)}
            className={`polish rounded-2xl px-4 py-3.5 text-start text-2xl font-semibold ring-2 transition ${
              answered && normalize(opt) === normalize(item.polish) ? 'bg-emerald-50 ring-emerald-500' : picked === opt ? 'bg-rose-50 ring-rose-400' : 'bg-white ring-slate-200'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {!answered && <CheckButton disabled={!picked} onClick={check} />}
    </div>
  );
}
