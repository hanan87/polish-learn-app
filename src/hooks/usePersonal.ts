import { useMemo } from 'react';
import { useLang } from '../i18n/LangContext';
import { effectiveGender, hasGenderPair, otherGender, personalize, type Gender } from '../lib/personalize';
import { useProgress } from '../state/ProgressContext';

/** Resolve gender / name templates (see lib/personalize) for the current learner and language. */
export function usePersonal() {
  const { state } = useProgress();
  const { lang } = useLang();
  const profile = state.profile;
  return useMemo(() => {
    const gender = effectiveGender(profile);
    const other = otherGender(gender);
    return {
      gender,
      /** Polish text in the learner's own form. */
      pl: (t: string) => personalize(t, profile, 'polish'),
      /** Translation in the interface language. */
      tx: (bi: { he: string; en: string }) => personalize(bi[lang], profile, lang),
      /** The other gender's Polish form, when the phrase depends on gender. */
      alt: (t: string): { gender: Gender; polish: string } | null =>
        hasGenderPair(t) ? { gender: other, polish: personalize(t, profile, 'polish', other) } : null,
    };
  }, [profile, lang]);
}
