import { useState } from 'react';
import logoUrl from '../assets/logo.svg';
import { ProfileFields } from '../components/ProfileFields';
import { useLang, type Lang } from '../i18n/LangContext';
import { useProgress } from '../state/ProgressContext';

/**
 * First-run screen.
 * Step 1: choose Hebrew or English as the interface and learning language.
 * Step 2: speaker gender and (optional) first name, so gendered Polish phrases match the learner.
 * The language is saved only at the end, because saving it closes the welcome screen.
 */
export function Welcome() {
  const { setLang } = useLang();
  const { state, setProfile } = useProgress();
  const [chosen, setChosen] = useState<Lang | null>(null);

  const options: { lang: Lang; title: string; sub: string; sample: string; dir: 'rtl' | 'ltr' }[] = [
    { lang: 'he', title: 'פולנית לדוברי עברית', sub: 'ממשק בעברית, תרגומים, תעתיק מנוקד וטיפים בעברית', sample: 'גֶ׳נְ·[קוּ]·יֶה', dir: 'rtl' },
    { lang: 'en', title: 'Polish for English speakers', sub: 'English interface, translations, respelling and tips', sample: 'jen·KOO·yeh', dir: 'ltr' },
  ];

  if (chosen) {
    const t = (he: string, en: string) => (chosen === 'he' ? he : en);
    return (
      <div dir={chosen === 'he' ? 'rtl' : 'ltr'} className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-rose-50 to-white px-6 py-10">
        <img src={logoUrl} alt="" className="size-16 rounded-2xl shadow" />
        <div className="text-center">
          <p className="text-2xl font-black text-slate-900">{t('נעים להכיר!', 'Nice to meet you!')}</p>
          <p className="polish text-slate-500" dir="ltr">
            Miło mi!
          </p>
        </div>
        <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <ProfileFields lang={chosen} profile={state.profile} onChange={setProfile} />
        </div>
        <div className="grid w-full max-w-md gap-2">
          <button
            type="button"
            onClick={() => setLang(chosen)}
            className="rounded-2xl bg-rose-600 py-4 text-base font-bold text-white shadow-md active:scale-[0.98]"
          >
            {t('בואו נתחיל', "Let's start")}
          </button>
          <button type="button" onClick={() => setChosen(null)} className="text-sm text-slate-500 underline">
            {t('חזרה לבחירת שפה', 'Back to language choice')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-gradient-to-b from-rose-50 to-white px-6 py-10 text-center">
      <img src={logoUrl} alt="" className="size-24 rounded-3xl shadow-lg" />
      <div>
        <p className="polish text-4xl font-black text-slate-900" dir="ltr">
          Polski od zera
        </p>
        <p className="mt-1 text-slate-500">פולנית מאפס · Polish from zero</p>
      </div>
      <div className="grid w-full max-w-md gap-3">
        {options.map((o) => (
          <button
            key={o.lang}
            type="button"
            dir={o.dir}
            onClick={() => setChosen(o.lang)}
            className="rounded-3xl bg-white p-5 text-start shadow-sm ring-2 ring-slate-200 transition hover:ring-rose-400 active:scale-[0.98]"
          >
            <span className="block text-xl font-black text-slate-900">{o.title}</span>
            <span className="mt-1 block text-sm text-slate-500">{o.sub}</span>
            <span className="mt-3 flex items-center gap-2 text-sm">
              <span dir="ltr" className="polish font-bold text-slate-800">
                Dzię<span className="text-rose-600 underline decoration-4">ku</span>ję
              </span>
              <span className="text-slate-400">→</span>
              <span className={o.lang === 'he' ? 'phonetic text-base' : 'font-mono'}>{o.sample.replace(/[[\]]/g, '')}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
