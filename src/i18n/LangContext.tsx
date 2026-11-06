import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Interface + learning language. 'he' = Polish for Hebrew speakers (RTL, Hebrew translations,
 * vocalized Hebrew transcription). 'en' = Polish for English speakers (LTR, English respelling).
 */
export type Lang = 'he' | 'en';

const STORAGE_KEY = 'polish-learn:lang';

interface LangApi {
  lang: Lang;
  /** True until the learner picked a language on the welcome screen. */
  unset: boolean;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Lang) => void;
  /** Inline bilingual string: tr('שלום', 'Hello'). */
  tr: (he: string, en: string) => string;
  /** Pick any localized value. */
  pick: <T>(he: T, en: T) => T;
}

const LangContext = createContext<LangApi | null>(null);

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'he' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Lang | null>(readStored);
  const lang: Lang = stored ?? (navigator.language?.startsWith('he') ? 'he' : 'en');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.title = lang === 'he' ? 'פולנית מאפס' : 'Polish from Zero';
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Storage disabled: the choice lasts for this session only.
    }
    setStored(l);
  }, []);

  const api = useMemo<LangApi>(
    () => ({
      lang,
      unset: stored === null,
      dir: lang === 'he' ? 'rtl' : 'ltr',
      setLang,
      tr: (he, en) => (lang === 'he' ? he : en),
      pick: (he, en) => (lang === 'he' ? he : en),
    }),
    [lang, stored, setLang],
  );

  return <LangContext.Provider value={api}>{children}</LangContext.Provider>;
}

export function useLang(): LangApi {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}

/** Bilingual value used by data modules. */
export interface Bi {
  he: string;
  en: string;
}
