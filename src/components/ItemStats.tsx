import { CalendarClock, Mic, PenLine } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { daysBetween, todayKey } from '../lib/date';
import { MAX_MASTERY, masteryOf, useProgress } from '../state/ProgressContext';

/** Mastery dots (1–5). */
export function MasteryDots({ level, size = 'md' }: { level: number; size?: 'sm' | 'md' }) {
  const dot = size === 'sm' ? 'h-3 w-1.5' : 'h-4 w-2';
  return (
    <span className="flex shrink-0 items-center gap-0.5" dir="ltr" aria-label={`${level}/${MAX_MASTERY}`}>
      {Array.from({ length: MAX_MASTERY }, (_, b) => (
        <span key={b} className={`${dot} rounded-full ${b < level ? (level <= 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'}`} />
      ))}
    </span>
  );
}

/** Personal performance history of one item. */
export function ItemStats({ itemId }: { itemId: string }) {
  const { state } = useProgress();
  const { tr } = useLang();
  const p = state.items[itemId];
  if (!p) return null;
  const level = masteryOf(p);
  const days = daysBetween(todayKey(), p.dueDate);
  const due = days <= 0 ? tr('היום', 'today') : days === 1 ? tr('מחר', 'tomorrow') : tr(`בעוד ${days} ימים`, `in ${days} days`);

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200 sm:grid-cols-4">
      <div>
        <p className="text-xs text-slate-500">{tr('רמת שליטה', 'Mastery')}</p>
        <div className="mt-1 flex items-center gap-2">
          <MasteryDots level={level} />
          <span className="font-bold">{level}/5</span>
        </div>
      </div>
      <div>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <Mic className="size-3" /> {tr('ציון הגייה ממוצע', 'Avg pronunciation')}
        </p>
        <p className="mt-1 font-bold">{p.pronAvg != null ? `${p.pronAvg}%` : '—'}</p>
      </div>
      <div>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <PenLine className="size-3" /> {tr('שגיאות כתיבה', 'Writing errors')}
        </p>
        <p className="mt-1 font-bold">
          {p.writingErrors}/{p.writingAttempts}
        </p>
      </div>
      <div>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <CalendarClock className="size-3" /> {tr('חזרה הבאה', 'Next review')}
        </p>
        <p className="mt-1 font-bold">{due}</p>
      </div>
    </div>
  );
}
