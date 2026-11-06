import { ListOrdered, Snail, Square, Volume2 } from 'lucide-react';
import { useTts } from '../hooks/useTts';
import { useLang } from '../i18n/LangContext';
import { ttsSupported } from '../lib/env';
import { BackchainSteps } from './BackchainSteps';

interface Props {
  text: string;
  backchainingSteps?: readonly string[];
  /** Show the backchain step strip under the buttons. */
  showSteps?: boolean;
  compact?: boolean;
}

/** Three playback modes: normal (1.0), extra slow (0.6), and backchaining (end to start). */
export function SpeakControls({ text, backchainingSteps, showSteps = true, compact = false }: Props) {
  const { mode, chainIndex, playNormal, playSlow, playChain, stop } = useTts();
  const { tr } = useLang();

  if (!ttsSupported) {
    return <p className="text-sm text-amber-700">{tr('הדפדפן לא תומך בהקראה קולית. נסו Chrome או Safari.', 'This browser has no speech synthesis. Try Chrome or Safari.')}</p>;
  }

  const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium ring-1 transition active:scale-95 disabled:opacity-50';
  const size = compact ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-sm sm:text-base';
  const on = 'bg-rose-600 text-white ring-rose-600';
  const off = 'bg-white text-slate-800 ring-slate-200 hover:bg-slate-50';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => (mode === 'normal' ? stop() : playNormal(text))} className={`${btn} ${size} ${mode === 'normal' ? on : off}`} aria-label={tr('השמעה במהירות רגילה', 'Play at normal speed')}>
          {mode === 'normal' ? <Square className="size-4" /> : <Volume2 className="size-5" />}
          {tr('רגיל', 'Normal')}
        </button>
        <button type="button" onClick={() => (mode === 'slow' ? stop() : playSlow(text))} className={`${btn} ${size} ${mode === 'slow' ? on : off}`} aria-label={tr('השמעה איטית במיוחד', 'Play extra slow')}>
          {mode === 'slow' ? <Square className="size-4" /> : <Snail className="size-5" />}
          {tr('איטי ×0.6', 'Slow ×0.6')}
        </button>
        {backchainingSteps && backchainingSteps.length > 0 && (
          <button type="button" onClick={() => (mode === 'chain' ? stop() : playChain(backchainingSteps))} className={`${btn} ${size} ${mode === 'chain' ? on : off}`} aria-label={tr('השמעה מדורגת מהסוף להתחלה', 'Play backchaining steps')}>
            {mode === 'chain' ? <Square className="size-4" /> : <ListOrdered className="size-5" />}
            {tr('מהסוף להתחלה', 'End to start')}
          </button>
        )}
      </div>
      {showSteps && backchainingSteps && backchainingSteps.length > 0 && (
        <BackchainSteps steps={backchainingSteps} activeIndex={mode === 'chain' ? chainIndex : -1} />
      )}
    </div>
  );
}
