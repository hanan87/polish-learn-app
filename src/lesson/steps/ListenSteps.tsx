import { useEffect, useState } from 'react';
import { Snail, Volume2 } from 'lucide-react';
import { getItem } from '../../data';
import { GROUP_SOUNDS } from '../../data/sounds';
import { itemText } from '../../data/types';
import { Phonetic } from '../../components/Phonetic';
import { PolishSyllables } from '../../components/PolishSyllables';
import { useLang } from '../../i18n/LangContext';
import { toEnglishPhonetic } from '../../lib/polishPhonetics';
import { RATE_SLOW, speak } from '../../lib/tts';
import { useProgress } from '../../state/ProgressContext';
import type { LessonStep } from '../buildLesson';
import type { StepProps } from '../types';

function ListenButtons({ text }: { text: string }) {
  const { tr } = useLang();
  useEffect(() => {
    const t = setTimeout(() => speak(text), 400);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <button type="button" onClick={() => speak(text)} className="grid size-24 place-items-center rounded-3xl bg-rose-600 text-white shadow-[0_6px_0_#9f1239] active:translate-y-1 active:shadow-none" aria-label={tr('השמע', 'Play')}>
        <Volume2 className="size-11" />
      </button>
      <button type="button" onClick={() => speak(text, RATE_SLOW)} className="grid size-16 place-items-center rounded-2xl bg-rose-100 text-rose-700 shadow-[0_4px_0_#fecdd3] active:translate-y-1 active:shadow-none" aria-label={tr('השמע לאט', 'Play slowly')}>
        <Snail className="size-7" />
      </button>
    </div>
  );
}

type MeaningStep = Extract<LessonStep, { kind: 'listen-meaning' }>;

/** Stage 2a – hear Polish without text, pick the meaning. */
export function ListenMeaningStep({ step, answered, onAnswered }: StepProps<MeaningStep>) {
  const item = getItem(step.itemId)!;
  const { tr, lang } = useLang();
  const { recordExercise } = useProgress();
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (id: string) => {
    if (answered) return;
    setPicked(id);
    const ok = id === item.id;
    recordExercise(item.id, item.polish, ok);
    onAnswered({
      correct: ok,
      tone: ok ? 'success' : 'error',
      title: ok ? tr('נכון!', 'Correct!') : tr('לא בדיוק', 'Not quite'),
      detail: (
        <div className="space-y-1">
          <PolishSyllables notation={item.syllablesPolish} size="sm" />
          <p>{itemText(item, lang).meaning}</p>
        </div>
      ),
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{tr('מה שמעתם?', 'What did you hear?')}</h2>
      <ListenButtons text={item.polish} />
      <div className="grid gap-2">
        {step.optionIds.map((id) => {
          const opt = getItem(id);
          if (!opt) return null;
          const isPicked = picked === id;
          const isRight = answered && id === item.id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              disabled={answered}
              className={`rounded-2xl px-4 py-3.5 text-start text-base font-medium ring-2 transition active:scale-[0.99] ${
                isRight ? 'bg-emerald-50 ring-emerald-500' : isPicked ? 'animate-shake bg-rose-50 ring-rose-400' : 'bg-white ring-slate-200'
              }`}
            >
              {itemText(opt, lang).meaning}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type PairStep = Extract<LessonStep, { kind: 'listen-pair' }>;

/** Stage 2b – minimal-pair identification: which of two near-identical words was spoken. */
export function ListenPairStep({ step, answered, onAnswered }: StepProps<PairStep>) {
  const { pair, group, side } = step;
  const target = pair[side];
  const { tr, lang } = useLang();
  const { recordExercise } = useProgress();
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);
  const sound = side === 'a' ? group.soundA : group.soundB;

  const choose = (s: 'a' | 'b') => {
    if (answered) return;
    setPicked(s);
    const ok = s === side;
    recordExercise(undefined, target.polish, ok, GROUP_SOUNDS[group.id]);
    onAnswered({
      correct: ok,
      tone: ok ? 'success' : 'error',
      title: ok ? tr('אוזן חדה!', 'Sharp ear!') : tr('ההבדל עדין – האזינו שוב', 'A subtle difference – listen again'),
      detail: (
        <p>
          {tr('השמענו', 'We played')}{' '}
          <strong dir="ltr" className="polish">
            {target.polish}
          </strong>{' '}
          ({lang === 'he' ? target.hebrew : target.english}) – {tr('עם', 'with')}{' '}
          <strong dir="ltr" className="polish">
            {sound}
          </strong>
          .
        </p>
      ),
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{tr('איזה צליל שמעתם?', 'Which sound did you hear?')}</h2>
      <p className="text-sm text-slate-500">
        <span dir="ltr" className="polish font-bold">
          {group.soundA}
        </span>{' '}
        {tr('מול', 'vs')}{' '}
        <span dir="ltr" className="polish font-bold">
          {group.soundB}
        </span>
      </p>
      <ListenButtons text={target.polish} />
      <div className="grid grid-cols-2 gap-3">
        {(['a', 'b'] as const).map((s) => {
          const w = pair[s];
          const isRight = answered && s === side;
          const isPicked = picked === s;
          return (
            <button
              key={s}
              type="button"
              disabled={answered}
              onClick={() => choose(s)}
              className={`space-y-1 rounded-2xl p-4 ring-2 transition ${isRight ? 'bg-emerald-50 ring-emerald-500' : isPicked ? 'animate-shake bg-rose-50 ring-rose-400' : 'bg-white ring-slate-200'}`}
            >
              <PolishSyllables notation={w.syllablesPolish} size="md" />
              <Phonetic he={w.phoneticHebrew} en={toEnglishPhonetic(w.polish)} size="sm" />
              <span className="block text-xs text-slate-500">{lang === 'he' ? w.hebrew : w.english}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
