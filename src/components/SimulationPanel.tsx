import { CheckCircle2, FlaskConical, Scissors, XCircle } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { mispronounce, truncate } from '../lib/simulate';

/**
 * Test panel that fakes a recording result when the real microphone is unavailable
 * (e.g. blocked by an embedding iframe). It feeds a synthetic transcript into the
 * same scoring pipeline, so the whole feedback flow can be exercised.
 */
interface Props {
  target: string;
  onSimulate: (transcript: string) => void;
  disabled?: boolean;
}

export function SimulationPanel({ target, onSimulate, disabled }: Props) {
  const { tr } = useLang();
  const btn = 'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 active:scale-95 disabled:opacity-50';
  return (
    <div className="rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-violet-800">
        <FlaskConical className="size-4" aria-hidden />
        {tr('פאנל סימולציית הקלטה לבדיקה', 'Recording simulation panel (testing)')}
      </p>
      <p className="mb-3 text-xs text-violet-700">
        {tr(
          'הדמיית תוצאת הקלטה כדי לבדוק את מנוע הפידבק. ה"הקלטה שלכם" בהשוואה הקולית תושמע כקריאה ממוחשבת של התמלול המדומה.',
          'Simulate a recording result to test the feedback engine. In the voice comparison, "your recording" is played as a synthetic reading of the simulated transcript.',
        )}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={disabled} onClick={() => onSimulate(target)} className={`${btn} bg-white text-emerald-700 ring-emerald-200`}>
          <CheckCircle2 className="size-4" aria-hidden />
          {tr('דמה הגייה מוצלחת', 'Simulate correct')}
        </button>
        <button type="button" disabled={disabled} onClick={() => onSimulate(mispronounce(target))} className={`${btn} bg-white text-rose-700 ring-rose-200`}>
          <XCircle className="size-4" aria-hidden />
          {tr('דמה הגייה שגויה', 'Simulate mistake')}
        </button>
        <button type="button" disabled={disabled} onClick={() => onSimulate(truncate(target))} className={`${btn} bg-white text-amber-700 ring-amber-200`}>
          <Scissors className="size-4" aria-hidden />
          {tr('דמה הקלטה חלקית', 'Simulate partial')}
        </button>
      </div>
    </div>
  );
}
