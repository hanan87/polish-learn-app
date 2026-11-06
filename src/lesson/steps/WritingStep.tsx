import { useEffect, useRef, useState } from 'react';
import { Snail, Volume2 } from 'lucide-react';
import { getItem } from '../../data';
import { itemText } from '../../data/types';
import { FormalityBadge } from '../../components/FormalityBadge';
import { PolishKeyboard } from '../../components/PolishKeyboard';
import { PolishSyllables } from '../../components/PolishSyllables';
import { useLang } from '../../i18n/LangContext';
import { checkWriting, explainDiacritic } from '../../lib/text';
import { RATE_SLOW, speak } from '../../lib/tts';
import { useProgress } from '../../state/ProgressContext';
import type { LessonStep } from '../buildLesson';
import type { StepProps } from '../types';

type Step = Extract<LessonStep, { kind: 'write' }>;

/** Stage 4 – Writing: native-language prompt + Polish audio, typed answer with the Polish helper keyboard. */
export function WritingStep({ step, answered, onAnswered }: StepProps<Step>) {
  const item = getItem(step.itemId)!;
  const { tr, lang } = useLang();
  const { recordWriting } = useProgress();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => speak(item.polish), 400);
    return () => clearTimeout(t);
  }, [item.polish]);

  const check = () => {
    const verdict = checkWriting(item.polish, value);
    const answer = <PolishSyllables notation={item.syllablesPolish} size="sm" />;
    if (verdict.kind === 'correct') {
      recordWriting(item.id, item.polish, 'correct');
      onAnswered({ correct: true, tone: 'success', title: tr('כתיבה מושלמת!', 'Perfect spelling!'), detail: answer });
    } else if (verdict.kind === 'diacritics') {
      recordWriting(item.id, item.polish, 'diacritics', verdict.issues.map((i) => i.expected));
      onAnswered({
        correct: true,
        tone: 'warning',
        title: tr('כמעט מושלם – חסר סימן דיאקריטי', 'Almost perfect – a diacritic is missing'),
        detail: (
          <div className="space-y-2">
            {answer}
            <ul className="space-y-1.5">
              {verdict.issues.map((iss) => (
                <li key={iss.expected + iss.typed} className="rounded-lg bg-white/60 p-2">
                  <span className="font-bold">
                    {tr('כתבתם', 'You typed')}{' '}
                    <span dir="ltr" className="polish">
                      {iss.typed}
                    </span>{' '}
                    {tr('במקום', 'instead of')}{' '}
                    <span dir="ltr" className="polish text-rose-600">
                      {iss.expected}
                    </span>
                    :
                  </span>{' '}
                  {explainDiacritic(iss, lang)}
                </li>
              ))}
            </ul>
          </div>
        ),
      });
    } else {
      recordWriting(item.id, item.polish, 'wrong');
      onAnswered({
        correct: false,
        tone: 'error',
        title: verdict.distance <= 2 ? tr('קרוב! יש שגיאת כתיב קטנה', 'Close! A small spelling mistake') : tr('התשובה הנכונה:', 'The correct answer:'),
        detail: answer,
      });
    }
    speak(item.polish);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{tr('כתבו בפולנית', 'Write it in Polish')}</h2>
      <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <FormalityBadge formality={item.formality} />
        <p className="text-xl font-bold">{itemText(item, lang).meaning}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => speak(item.polish)} className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white">
            <Volume2 className="size-4" /> {tr('השמע', 'Play')}
          </button>
          <button type="button" onClick={() => speak(item.polish, RATE_SLOW)} className="flex items-center gap-1.5 rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700">
            <Snail className="size-4" /> {tr('לאט', 'Slow')}
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && value.trim() && !answered && check()}
        disabled={answered}
        dir="ltr"
        lang="pl"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder="Napisz po polsku…"
        className="polish w-full rounded-2xl bg-white px-4 py-4 text-2xl font-semibold ring-2 ring-slate-200 outline-none focus:ring-rose-400 disabled:bg-slate-50"
      />
      {!answered && <PolishKeyboard inputRef={inputRef} value={value} onChange={setValue} />}
      {!answered && (
        <button type="button" disabled={!value.trim()} onClick={check} className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none">
          {tr('בדיקה', 'Check')}
        </button>
      )}
    </div>
  );
}
