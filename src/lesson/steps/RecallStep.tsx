import { useState } from 'react';
import { Lightbulb, MessageCircleQuestion, MicOff } from 'lucide-react';
import { getItem, getSituation } from '../../data';
import { itemText } from '../../data/types';
import { FormalityBadge } from '../../components/FormalityBadge';
import { Phonetic } from '../../components/Phonetic';
import { PolishSyllables } from '../../components/PolishSyllables';
import { PronunciationPractice } from '../../components/PronunciationPractice';
import { useLang } from '../../i18n/LangContext';
import { parseSyllables } from '../../lib/syllables';
import type { LessonStep } from '../buildLesson';
import type { StepProps } from '../types';

type Step = Extract<LessonStep, { kind: 'recall' }>;

export const RECALL_PASS = 70;

/** Stage 5 – Active recall speaking: a situation, the learner says the phrase without seeing it. */
export function RecallStep({ step, answered, onAnswered }: StepProps<Step>) {
  const item = getItem(step.itemId)!;
  const { tr, lang } = useLang();
  const [hintLevel, setHintLevel] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const situation = getSituation(item, lang);

  // Hint 1: first syllable of each word in the transcription. Hint 2: the full Polish text.
  const firstSyllables = (notation: string) =>
    parseSyllables(notation)
      .map((w) => (w[0]?.text ?? '') + (w.length > 1 ? '…' : ''))
      .join(' ');

  const finish = () => {
    const score = bestScore ?? 0;
    const ok = score >= RECALL_PASS;
    onAnswered({
      correct: ok,
      tone: ok ? (hintLevel > 0 ? 'warning' : 'success') : 'error',
      title: ok
        ? hintLevel > 0
          ? tr(`הצלחתם עם רמז (${score}%)`, `Done with a hint (${score}%)`)
          : tr(`מהזיכרון – ${score}%!`, `From memory – ${score}%!`)
        : tr(`${score}% – כדאי לחזור על הביטוי`, `${score}% – worth reviewing this phrase`),
      detail: <PolishSyllables notation={item.syllablesPolish} size="sm" />,
    });
  };

  const skip = () =>
    onAnswered({
      correct: null,
      tone: 'neutral',
      title: tr('דילגתם על תרגיל הדיבור', 'Speaking exercise skipped'),
      detail: <PolishSyllables notation={item.syllablesPolish} size="sm" />,
    });

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <MessageCircleQuestion className="size-6 text-rose-600" /> {tr('אמרו בפולנית – מהזיכרון', 'Say it in Polish – from memory')}
      </h2>
      <div className="space-y-2 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
        <FormalityBadge formality={item.formality} />
        <p className="text-lg leading-relaxed font-bold text-slate-900">{situation}</p>
      </div>

      {!answered && (
        <div className="space-y-2">
          {hintLevel >= 1 && (
            <div className="animate-pop-in rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-xs font-bold text-amber-800">{tr('רמז – תחילת ההברות:', 'Hint – first syllables:')}</p>
              <Phonetic he={firstSyllables(item.phoneticHebrew)} en={firstSyllables(item.phoneticEnglish)} size="md" />
            </div>
          )}
          {hintLevel >= 2 && (
            <div className="animate-pop-in rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <PolishSyllables notation={item.syllablesPolish} size="md" />
              <Phonetic he={item.phoneticHebrew} en={item.phoneticEnglish} size="sm" />
            </div>
          )}
          {hintLevel < 2 && (
            <button type="button" onClick={() => setHintLevel((h) => h + 1)} className="flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
              <Lightbulb className="size-4" /> {hintLevel === 0 ? tr('נתקעתם? רמז', 'Stuck? Hint') : tr('הצג את הביטוי המלא', 'Show the full phrase')}
            </button>
          )}
        </div>
      )}

      <PronunciationPractice
        target={item.polish}
        itemId={item.id}
        articulationTip={itemText(item, lang).tip}
        backchainingSteps={item.backchainingSteps}
        onResult={(s) => setBestScore((b) => Math.max(b ?? 0, s))}
        prompt={tr('לחצו על המיקרופון ואמרו את הביטוי', 'Tap the microphone and say the phrase')}
      />

      {!answered && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={bestScore === null}
            onClick={finish}
            className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
          >
            {bestScore === null ? tr('הקליטו את עצמכם כדי להמשיך', 'Record yourself to continue') : tr(`סיום (ציון מיטבי: ${bestScore}%)`, `Finish (best score: ${bestScore}%)`)}
          </button>
          <button type="button" onClick={skip} className="mx-auto flex items-center gap-1.5 py-2 text-sm text-slate-500">
            <MicOff className="size-4" /> {tr('לא יכול/ה לדבר עכשיו', "Can't speak right now")}
          </button>
        </div>
      )}
    </div>
  );
}
