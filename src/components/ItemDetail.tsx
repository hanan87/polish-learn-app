import { CheckCircle2, Globe2, Lightbulb, Mic, PlusCircle } from 'lucide-react';
import { itemText, type LearningItem } from '../data/types';
import { useLang } from '../i18n/LangContext';
import { useProgress } from '../state/ProgressContext';
import { FormalityBadge } from './FormalityBadge';
import { ItemStats } from './ItemStats';
import { Phonetic } from './Phonetic';
import { PolishSyllables } from './PolishSyllables';
import { PronunciationPractice } from './PronunciationPractice';
import { SpeakControls } from './SpeakControls';

interface Props {
  item: LearningItem;
  showPractice?: boolean;
  showLearnButton?: boolean;
}

/** Full presentation of one learning item: text, stress, transcription, tips, audio and pronunciation practice. */
export function ItemDetail({ item, showPractice = true, showLearnButton = true }: Props) {
  const { isLearned, markLearned, state } = useProgress();
  const { tr, lang } = useLang();
  const text = itemText(item, lang);
  const learned = isLearned(item.id);
  const best = state.items[item.id]?.bestPronunciation;

  return (
    <div className="space-y-5">
      <div className="space-y-2 pt-2 text-center">
        <div className="flex justify-center">
          <FormalityBadge formality={item.formality} />
        </div>
        <PolishSyllables notation={item.syllablesPolish} size="xl" />
        <Phonetic he={item.phoneticHebrew} en={item.phoneticEnglish} size="lg" />
        <p className="text-lg font-medium text-slate-600">{text.meaning}</p>
      </div>

      <SpeakControls text={item.polish} backchainingSteps={item.backchainingSteps} />

      <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-amber-800">
          <Lightbulb className="size-4" aria-hidden />
          {tr('מיקום הלשון והשפתיים', 'Tongue & lip position')}
        </p>
        <p className="text-sm leading-relaxed text-amber-950">{text.tip}</p>
      </div>

      {text.note && (
        <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-sky-800">
            <Globe2 className="size-4" aria-hidden />
            {tr('הקשר תרבותי', 'Cultural note')}
          </p>
          <p className="text-sm leading-relaxed text-sky-950">{text.note}</p>
        </div>
      )}

      {learned && <ItemStats itemId={item.id} />}

      {showPractice && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-base font-bold text-slate-800">
            <Mic className="size-4" aria-hidden /> {tr('תרגול הגייה', 'Pronunciation practice')}
            {best != null && <span className="ms-auto text-xs font-medium text-slate-500">{tr('שיא', 'Best')}: {best}%</span>}
          </h3>
          <PronunciationPractice target={item.polish} itemId={item.id} articulationTip={text.tip} backchainingSteps={item.backchainingSteps} />
        </section>
      )}

      {showLearnButton && (
        <button
          type="button"
          disabled={learned}
          onClick={() => markLearned(item.id)}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold transition active:scale-[0.98] ${
            learned ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
          }`}
        >
          {learned ? <CheckCircle2 className="size-5" /> : <PlusCircle className="size-5" />}
          {learned ? tr('נלמד – נמצא במאגר החזרה', 'Learned – in your review deck') : tr('סמן כנלמד והוסף לחזרה (+10 XP)', 'Mark as learned & add to review (+10 XP)')}
        </button>
      )}
    </div>
  );
}
