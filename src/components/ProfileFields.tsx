import { UserRound } from 'lucide-react';
import type { Lang } from '../i18n/LangContext';
import { DEFAULT_NAMES, isLatinName, type Gender, type LearnerProfile } from '../lib/personalize';

interface Props {
  lang: Lang;
  profile: LearnerProfile;
  onChange: (profile: Partial<LearnerProfile>) => void;
}

/**
 * Gender + first-name picker. Used on the welcome screen (before the interface language is saved,
 * hence the explicit `lang` prop) and in Settings.
 */
export function ProfileFields({ lang, profile, onChange }: Props) {
  const t = (he: string, en: string) => (lang === 'he' ? he : en);
  const options: [Gender, string, string][] = [
    ['m', t('זכר', 'Male'), 'Chciałbym · gotowy'],
    ['f', t('נקבה', 'Female'), 'Chciałabym · gotowa'],
  ];
  const name = profile.name;
  const nonLatin = name.trim() !== '' && !isLatinName(name);

  return (
    <div className="space-y-3" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <div>
        <p className="text-sm font-bold text-slate-800">{t('אני מדבר/ת פולנית בתור:', 'I speak Polish as:')}</p>
        <p className="text-xs text-slate-500">
          {t('בפולנית פעלים ותארים משתנים לפי מגדר הדובר – נתאים לכם את המשפטים.', 'In Polish, verbs and adjectives change with the speaker’s gender – phrases will match yours.')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('מגדר הדובר', 'Speaker gender')}>
        {options.map(([g, label, sample]) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={profile.gender === g}
            onClick={() => onChange({ gender: g })}
            className={`rounded-2xl px-3 py-3 text-start ring-2 transition active:scale-[0.98] ${
              profile.gender === g ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-slate-800 ring-slate-200 hover:ring-rose-300'
            }`}
          >
            <span className="flex items-center gap-1.5 font-bold">
              <UserRound className="size-4" /> {label}
            </span>
            <span dir="ltr" className={`polish mt-1 block text-xs ${profile.gender === g ? 'text-rose-100' : 'text-slate-500'}`}>
              {sample}
            </span>
          </button>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-bold text-slate-800">{t('שם פרטי (לא חובה)', 'First name (optional)')}</span>
        <input
          type="text"
          value={name}
          maxLength={24}
          autoComplete="given-name"
          dir="ltr"
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={profile.gender ? DEFAULT_NAMES[profile.gender].latin : 'Dawid / Anna'}
          className="w-full rounded-xl bg-white px-3 py-2.5 text-base ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-rose-400"
        />
        <span className={`block text-xs ${nonLatin ? 'text-amber-700' : 'text-slate-500'}`}>
          {nonLatin
            ? t('כדי שהקול הפולני יוכל להגות את השם, כתבו אותו באותיות לטיניות (כמו בדרכון). עד אז נשתמש ב-' + DEFAULT_NAMES[profile.gender ?? 'm'].latin + '.', 'Write the name in Latin letters so the Polish voice can say it.')
            : t('השם יופיע במשפטים כמו "Mam na imię…" ובסימולציות השיחה.', 'Your name appears in phrases like "Mam na imię…" and in the conversations.')}
        </span>
      </label>
    </div>
  );
}
