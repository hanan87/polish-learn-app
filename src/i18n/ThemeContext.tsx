import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Color theme. 'system' follows the device setting (prefers-color-scheme). */
export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'polish-learn:theme';

interface ThemeApi {
  choice: ThemeChoice;
  /** The theme actually applied. */
  resolved: 'light' | 'dark';
  setChoice: (c: ThemeChoice) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [systemDark, setSystemDark] = useState(() => !!media?.matches);

  useEffect(() => {
    if (!media) return;
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolved: 'light' | 'dark' = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#e11d48');
  }, [resolved]);

  const setChoice = useCallback((c: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      // Storage disabled: the choice lasts for this session only.
    }
    setChoiceState(c);
  }, []);

  const api = useMemo<ThemeApi>(
    () => ({ choice, resolved, setChoice, toggle: () => setChoice(resolved === 'dark' ? 'light' : 'dark') }),
    [choice, resolved, setChoice],
  );

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
