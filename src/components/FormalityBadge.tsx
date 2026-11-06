import { Briefcase, Coffee, Scale } from 'lucide-react';
import { FORMALITY_LABELS, type Formality } from '../data/types';
import { useLang } from '../i18n/LangContext';

const STYLES: Record<Formality, string> = {
  formal: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  casual: 'bg-amber-50 text-amber-700 ring-amber-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const ICONS = { formal: Briefcase, casual: Coffee, neutral: Scale };

export function FormalityBadge({ formality }: { formality: Formality }) {
  const { lang } = useLang();
  const Icon = ICONS[formality];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STYLES[formality]}`}>
      <Icon className="size-3.5" aria-hidden />
      {FORMALITY_LABELS[formality][lang]}
    </span>
  );
}
