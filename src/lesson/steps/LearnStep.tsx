import { useEffect } from 'react';
import { getItem } from '../../data';
import { ItemDetail } from '../../components/ItemDetail';
import { useLang } from '../../i18n/LangContext';
import { speak } from '../../lib/tts';
import type { LessonStep } from '../buildLesson';
import type { StepProps } from '../types';

type Step = Extract<LessonStep, { kind: 'learn' }>;

/** Stage 1 – Learn & Shadow: full item card with listening, recording, voice comparison and feedback. */
export function LearnStep({ step, answered, onAnswered }: StepProps<Step>) {
  const item = getItem(step.itemId)!;
  const { tr } = useLang();

  useEffect(() => {
    const t = setTimeout(() => speak(item.polish), 350);
    return () => clearTimeout(t);
  }, [item.polish]);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-500">
        {tr('האזינו, הקליטו את עצמכם והשוו לדובר. כשאתם מוכנים – המשיכו.', 'Listen, record yourself and compare with the speaker. Continue when you are ready.')}
      </p>
      <ItemDetail item={item} showLearnButton={false} />
      {!answered && (
        <button
          type="button"
          onClick={() => onAnswered({ correct: null, tone: 'neutral', title: '' })}
          className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white shadow-md active:scale-[0.98]"
        >
          {tr('הבנתי, המשך', 'Got it, continue')}
        </button>
      )}
    </div>
  );
}
