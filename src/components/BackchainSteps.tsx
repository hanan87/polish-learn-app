import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { speak, RATE_CHAIN } from '../lib/tts';

interface Props {
  steps: readonly string[];
  activeIndex?: number;
}

/** Visual strip of backchaining steps (end -> full word). Each chip is tappable to hear that step. */
export function BackchainSteps({ steps, activeIndex = -1 }: Props) {
  const { tr, dir } = useLang();
  const Arrow = dir === 'rtl' ? ChevronLeft : ChevronRight;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-500">{tr('פירוק מהסוף להתחלה (Backchaining):', 'Backchaining (end to start):')}</p>
      <ol className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => speak(step, RATE_CHAIN)}
              dir="ltr"
              lang="pl"
              className={`polish rounded-lg px-2.5 py-1.5 text-base font-semibold ring-1 transition ${
                activeIndex === i ? 'scale-105 bg-rose-600 text-white ring-rose-600' : 'bg-slate-50 text-slate-800 ring-slate-200 hover:bg-white'
              }`}
            >
              <span className="me-1 text-[10px] font-normal opacity-70">{i + 1}</span>
              {step}
            </button>
            {i < steps.length - 1 && <Arrow className="size-4 text-slate-300" aria-hidden />}
          </li>
        ))}
      </ol>
    </div>
  );
}
