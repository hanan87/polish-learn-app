import { Users, Volume2 } from 'lucide-react';
import type { LearningItem } from '../data/types';
import { useLang } from '../i18n/LangContext';
import { speak } from '../lib/tts';

/** For gender-dependent phrases: shows how a speaker of the other gender says the same thing. */
export function GenderNote({ item }: { item: LearningItem }) {
  const { tr, lang } = useLang();
  const alt = item.genderAlt;
  if (!alt) return null;
  const label = alt.gender === 'f' ? tr('אישה אומרת:', 'A woman says:') : tr('גבר אומר:', 'A man says:');
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-violet-50 p-3 text-sm text-violet-900 ring-1 ring-violet-200" data-testid="gender-note">
      <Users className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>
          <span className="font-bold">{label}</span>{' '}
          <button type="button" onClick={() => speak(alt.polish)} className="polish inline-flex items-center gap-1 font-bold underline decoration-violet-300" dir="ltr">
            {alt.polish}
            <Volume2 className="size-3.5" />
          </button>
        </p>
        <p className="text-xs text-violet-700">{lang === 'he' ? alt.hebrew : alt.english}</p>
      </div>
    </div>
  );
}
