import { Flame, Settings, Star, Target } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { useProgress } from '../state/ProgressContext';
import { StandaloneDownload } from './StandaloneDownload';

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
export function TopBar({ title, onOpenSettings }: { title: string; onOpenSettings: () => void }) {
  const { activeStreak, todayXp, state, level, levelProgress } = useProgress();
  const { tr } = useLang();
  const goalPct = Math.min(100, Math.round((todayXp / state.dailyGoal) * 100));

  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 sm:text-lg">{title}</h1>
        <LangSwitch />
        <StandaloneDownload variant="icon" />
        <button type="button" onClick={onOpenSettings} className="grid size-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label={tr('הגדרות', 'Settings')}>
          <Settings className="size-5" />
        </button>
      </div>
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 pb-2 sm:px-4">
        <div className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-sm font-bold text-orange-600" title={tr('רצף ימי לימוד', 'Day streak')}>
          <Flame className={`size-4 ${activeStreak > 0 ? 'fill-orange-400' : ''}`} aria-hidden />
          <span>{activeStreak}</span>
          <span className="text-xs font-medium">{tr('ימים', 'days')}</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700" title={`${todayXp}/${state.dailyGoal} XP`}>
          <Target className="size-4" aria-hidden />
          <span>{goalPct}%</span>
          <span className="text-xs font-medium">{tr('מהיעד', 'of goal')}</span>
        </div>
        <div className="ms-auto flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-bold text-amber-700">
          <Star className="size-4 fill-amber-400 text-amber-500" aria-hidden />
          <span>{state.xp} XP</span>
          <span className="text-xs font-medium">· {tr('רמה', 'Lv')} {level}</span>
        </div>
      </div>
      <div className="h-0.5 bg-slate-100">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${levelProgress * 100}%` }} />
      </div>
    </header>
  );
}
