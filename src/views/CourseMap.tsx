import { useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, Flame, Lock, Play, RotateCcw, Star, Target, Trophy } from 'lucide-react';
import { UNITS } from '../data';
import { lessonsOfUnit } from '../data/lessons';
import { itemText, unitText, type UnitColor } from '../data/types';
import { PolishSyllables } from '../components/PolishSyllables';
import { useLang } from '../i18n/LangContext';
import { useProgress } from '../state/ProgressContext';

const COLOR: Record<UnitColor, { bg: string; ring: string; text: string; bar: string; node: string }> = {
  rose: { bg: 'bg-rose-50', ring: 'ring-rose-200', text: 'text-rose-700', bar: 'bg-rose-500', node: 'bg-rose-500' },
  amber: { bg: 'bg-amber-50', ring: 'ring-amber-200', text: 'text-amber-700', bar: 'bg-amber-500', node: 'bg-amber-500' },
  sky: { bg: 'bg-sky-50', ring: 'ring-sky-200', text: 'text-sky-700', bar: 'bg-sky-500', node: 'bg-sky-500' },
  emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500', node: 'bg-emerald-500' },
  violet: { bg: 'bg-violet-50', ring: 'ring-violet-200', text: 'text-violet-700', bar: 'bg-violet-500', node: 'bg-violet-500' },
  teal: { bg: 'bg-teal-50', ring: 'ring-teal-200', text: 'text-teal-700', bar: 'bg-teal-500', node: 'bg-teal-500' },
  red: { bg: 'bg-red-50', ring: 'ring-red-200', text: 'text-red-700', bar: 'bg-red-500', node: 'bg-red-500' },
  orange: { bg: 'bg-orange-50', ring: 'ring-orange-200', text: 'text-orange-700', bar: 'bg-orange-500', node: 'bg-orange-500' },
};

interface Props {
  onOpenLesson: (lessonId: string) => void;
  onOpenItem: (itemId: string) => void;
}

export function CourseMap({ onOpenLesson, onOpenItem }: Props) {
  const { state, isLearned, todayXp, activeStreak, level } = useProgress();
  const { tr, lang } = useLang();
  const [openUnit, setOpenUnit] = useState<string | null>(() => {
    const firstUnfinished = UNITS.find((u) => lessonsOfUnit(u.id).some((l) => !state.lessons[l.id]));
    return firstUnfinished?.id ?? UNITS[0].id;
  });

  const goalPct = Math.min(100, (todayXp / state.dailyGoal) * 100);

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat icon={<Flame className="size-5 text-orange-500" />} label={tr('ימי רצף', 'Day streak')} value={activeStreak} sub={`${tr('שיא', 'Best')}: ${state.streak.best}`} />
        <Stat icon={<Star className="size-5 fill-amber-400 text-amber-500" />} label={tr('נקודות XP', 'XP points')} value={state.xp} sub={`${tr('רמה', 'Level')} ${level}`} />
        <Stat
          icon={<Target className="size-5 text-emerald-600" />}
          label={tr('יעד יומי', 'Daily goal')}
          value={`${todayXp}/${state.dailyGoal}`}
          sub={goalPct >= 100 ? tr('הושג!', 'Reached!') : tr('XP היום', 'XP today')}
        >
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${goalPct}%` }} />
          </div>
        </Stat>
      </section>

      <ol className="relative space-y-4">
        {UNITS.map((unit) => {
          const c = COLOR[unit.color];
          const ut = unitText(unit, lang);
          const lessons = lessonsOfUnit(unit.id);
          const learnedCount = unit.items.filter((i) => isLearned(i.id)).length;
          const doneLessons = lessons.filter((l) => state.lessons[l.id]).length;
          const pct = Math.round((learnedCount / unit.items.length) * 100);
          const expanded = openUnit === unit.id;
          const nextLesson = lessons.find((l) => !state.lessons[l.id]);

          return (
            <li key={unit.id} className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ${c.ring}`}>
              <button type="button" onClick={() => setOpenUnit(expanded ? null : unit.id)} className={`flex w-full items-start gap-3 p-4 text-start ${c.bg}`} aria-expanded={expanded}>
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-xl font-black text-white ${c.node}`}>
                  {doneLessons === lessons.length ? <Trophy className="size-6" /> : unit.order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs font-bold ${c.text}`}>
                    {tr('יחידה', 'Unit')} {unit.order}
                  </span>
                  <span className="block text-lg leading-tight font-bold text-slate-900">{ut.title}</span>
                  <span className="block text-sm text-slate-600">{ut.subtitle}</span>
                  <span className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                      <span className={`block h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                    </span>
                    {doneLessons}/{lessons.length} {tr('שיעורים', 'lessons')} · {learnedCount}/{unit.items.length} {tr('פריטים', 'items')}
                  </span>
                </span>
                <ChevronDown className={`mt-1 size-5 shrink-0 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="space-y-4 p-4">
                  <p className="text-sm leading-relaxed text-slate-600">{ut.description}</p>

                  <div className="relative flex flex-col items-center gap-3 py-2">
                    {lessons.map((lesson, idx) => {
                      const done = !!state.lessons[lesson.id];
                      const unlocked = idx === 0 || !!state.lessons[lessons[idx - 1].id];
                      const isNext = nextLesson?.id === lesson.id;
                      // Zig-zag the path nodes like a trail map.
                      const offset = ['translate-x-0', '-translate-x-12', 'translate-x-0', 'translate-x-12'][idx % 4];
                      return (
                        <div key={lesson.id} className={`flex flex-col items-center ${offset}`}>
                          <button
                            type="button"
                            disabled={!unlocked}
                            onClick={() => onOpenLesson(lesson.id)}
                            className={`relative grid size-16 place-items-center rounded-full text-white shadow-[0_5px_0_rgba(0,0,0,0.15)] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed ${
                              done ? 'bg-amber-400' : unlocked ? c.node : 'bg-slate-300'
                            } ${isNext ? 'ring-4 ring-offset-2 ' + c.ring : ''}`}
                            aria-label={`${tr('שיעור', 'Lesson')} ${lesson.number}${done ? tr(' (הושלם)', ' (completed)') : ''}`}
                          >
                            {done ? <Star className="size-7 fill-white" /> : unlocked ? <Play className="size-7 fill-white" /> : <Lock className="size-6" />}
                          </button>
                          <span className="mt-1.5 text-xs font-medium text-slate-600">
                            {tr('שיעור', 'Lesson')} {lesson.number}
                            {done && ` · ${state.lessons[lesson.id].bestAccuracy}%`}
                          </span>
                          {done && (
                            <button type="button" onClick={() => onOpenLesson(lesson.id)} className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700">
                              <RotateCcw className="size-3" /> {tr('חזרה', 'Replay')}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-bold text-slate-700">{tr('כל הפריטים ביחידה', 'All items in this unit')}</h3>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {unit.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onOpenItem(item.id)}
                            className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-start ring-1 ring-slate-200 transition hover:bg-white"
                          >
                            <span className="min-w-0 flex-1">
                              <PolishSyllables notation={item.syllablesPolish} size="sm" showDots={false} className="truncate" />
                              <span className="block truncate text-xs text-slate-500">{itemText(item, lang).meaning}</span>
                            </span>
                            {isLearned(item.id) && <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-label={tr('נלמד', 'Learned')} />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ icon, label, value, sub, children }: { icon: ReactNode; label: string; value: ReactNode; sub: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{value}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
      {children}
    </div>
  );
}
