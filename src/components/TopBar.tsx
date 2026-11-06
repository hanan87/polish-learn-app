import { Flame, Moon, Settings, Star, Sun, Target } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../i18n/ThemeContext';
import { useProgress } from '../state/ProgressContext';
import { StandaloneDownload } from './StandaloneDownload';
import { KasiaButton } from './KasiaAngel';

/** HE | EN segmented switch for the interface + learning language. */
export function LangSwitch() {
  const { lang, setLang, tr } = useLang();
  return (
    <div className="flex shrink-0 overflow-hidden rounded-full text-xs font-bold ring-1 ring-slate-300" dir="ltr" role="group" aria-label={tr('שפת ממשק', 'Interface language')}>
      {(['he', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1.5 transition ${lang === l ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Sticky header with title, language switch, download/settings, streak, daily goal and XP. */
export function TopBar({ title, onOpenSettings, onOpenKasia }: { title: string; onOpenSettings: () => void; onOpenKasia: () => void }) {
  const { activeStreak, todayXp, state, level, levelProgress } = useProgress();
  const { tr } = useLang();
  const theme = useTheme();
  const goalPct = Math.min(100, Math.round((todayXp / state.dailyGoal) * 100));

  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        {/* Phones: the bottom nav already names the tab, so the title is for screen readers only and the row keeps room for its buttons. */}
        <h1 className="sr-only min-w-0 flex-1 truncate text-base font-bold text-slate-900 sm:not-sr-only sm:text-lg">{title}</h1>
        <span className="flex-1 sm:hidden" aria-hidden />
        <KasiaButton onClick={onOpenKasia} />
        <LangSwitch />
        <button
          type="button"
          onClick={theme.toggle}
          className="grid size-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
          aria-label={theme.resolved === 'dark' ? tr('מצב בהיר', 'Light mode') : tr('מצב כהה', 'Dark mode')}
        >
          {theme.resolved === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        {/* On narrow phones the download shortcut lives in Settings only. */}
        <span className="hidden sm:contents">
          <StandaloneDownload variant="icon" />
        </span>
        <button type="button" onClick={onOpenSettings} className="grid size-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label={tr('הגדרות', 'Settings')}>
          <Settings className="size-5" />
        </button>
      </div>
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 pb-2 sm:px-4">
        <div className="flex items-center gap-1 text-sm text-slate-600" title={tr('רצף ימי לימוד', 'Day streak')}>
          <Flame className={`size-4 ${activeStreak > 0 ? 'fill-amber-400 text-amber-600' : 'text-slate-400'}`} aria-hidden />
          <span className="font-semibold text-slate-900 tabular-nums">{activeStreak}</span>
          <span className="text-xs">{tr('ימים', 'days')}</span>
        </div>
        <span className="h-3.5 w-px bg-slate-300" aria-hidden />
        <div className="flex items-center gap-1 text-sm text-slate-600" title={`${todayXp}/${state.dailyGoal} XP`}>
          <Target className="size-4 text-slate-400" aria-hidden />
          <span className="font-semibold text-slate-900 tabular-nums">{goalPct}%</span>
          <span className="text-xs">{tr('מהיעד', 'of goal')}</span>
        </div>
        <div className="ms-auto flex items-center gap-1 text-sm text-slate-600">
          <Star className="size-4 text-slate-400" aria-hidden />
          <span className="font-semibold text-slate-900 tabular-nums">{state.xp}</span>
          <span className="text-xs">XP · {tr('רמה', 'Lv')} {level}</span>
        </div>
      </div>
      <div className="h-px bg-slate-200">
        <div className="h-full bg-rose-600 transition-all" style={{ width: `${levelProgress * 100}%` }} />
      </div>
    </header>
  );
}
