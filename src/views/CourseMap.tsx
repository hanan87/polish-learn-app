import { useState } from 'react';
import { CheckCircle2, ChevronDown, Headphones, Lock, Play, RotateCcw, Star, Trophy, UserRound, X } from 'lucide-react';
import { ProfileFields } from '../components/ProfileFields';
import { displayName } from '../lib/personalize';
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
  onOpenHandsFree: () => void;
}

/** Big entry button for the audio-only (driving / walking) trainer – shared by the map and the review tab. */
export function HandsFreeButton({ onClick, subtitle }: { onClick: () => void; subtitle: string }) {
  const { tr } = useLang();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-2xl bg-white p-4 text-start ring-1 ring-slate-200 transition hover:ring-slate-300 active:scale-[0.99]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
        <Headphones className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900">{tr('מצב נהיגה והליכה (שמע בלבד)', 'Driving & walking mode (audio only)')}</span>
        <span className="block text-sm text-slate-500">{subtitle}</span>
      </span>
      <Play className="size-5 shrink-0 text-slate-400 transition group-hover:text-slate-900" />
    </button>
  );
}

export function CourseMap({ onOpenLesson, onOpenItem, onOpenHandsFree }: Props) {
  const { state, isLearned, todayXp, activeStreak, level, setProfile } = useProgress();
  const { tr, lang } = useLang();
  // Shown once to learners who have not picked a gender yet; stays open while they type their name.
  const [profileOpen, setProfileOpen] = useState(() => state.profile.gender === null);
  const [openUnit, setOpenUnit] = useState<string | null>(() => {
    const firstUnfinished = UNITS.find((u) => lessonsOfUnit(u.id).some((l) => !state.lessons[l.id]));
    return firstUnfinished?.id ?? UNITS[0].id;
  });

  const goalPct = Math.min(100, (todayXp / state.dailyGoal) * 100);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? tr('בוקר טוב', 'Good morning') : hour < 18 ? tr('צהריים טובים', 'Good afternoon') : tr('ערב טוב', 'Good evening');
  const firstName = state.profile.name.trim() ? displayName(state.profile, lang) : '';

  return (
    <div className="space-y-5">
      <section className="pt-1" data-testid="map-greeting">
        <p className="eyebrow">{new Date().toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h2 className="mt-1 text-3xl leading-tight font-semibold">
          {greeting}
          {firstName && <span className="text-rose-600">, {firstName}</span>}
        </h2>
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${goalPct}%` }} />
          </div>
          <span className="shrink-0 tabular-nums">
            <span className="font-semibold text-slate-900">{todayXp}</span>/{state.dailyGoal} XP {tr('היום', 'today')}
          </span>
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            {tr('רצף', 'Streak')} <span className="font-semibold text-slate-800 tabular-nums">{activeStreak}</span> · {tr('שיא', 'best')} {state.streak.best}
          </span>
          <span>
            {tr('רמה', 'Level')} <span className="font-semibold text-slate-800 tabular-nums">{level}</span> · {state.xp} XP
          </span>
        </p>
      </section>

      {profileOpen && (
        <section className="relative space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200" data-testid="profile-prompt">
          <button
            type="button"
            onClick={() => setProfileOpen(false)}
            className="absolute end-2 top-2 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-rose-100"
            aria-label={tr('סגור', 'Close')}
          >
            <X className="size-4" />
          </button>
          <p className="flex items-center gap-1.5 font-semibold text-slate-900">
            <UserRound className="size-4" /> {tr('חדש: משפטים מותאמים אישית', 'New: personalized phrases')}
          </p>
          <ProfileFields lang={lang} profile={state.profile} onChange={setProfile} />
          {state.profile.gender && (
            <button type="button" onClick={() => setProfileOpen(false)} className="btn-primary w-full">
              {tr('שמור', 'Save')}
            </button>
          )}
        </section>
      )}

      <HandsFreeButton
        onClick={onOpenHandsFree}
        subtitle={tr('המשמעות, הפולנית לאט ומהר, ואז אתם חוזרים – בלי לגעת במסך.', 'Meaning, slow and normal Polish, then you repeat – no screen taps needed.')}
      />

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
            <li key={unit.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <button type="button" onClick={() => setOpenUnit(expanded ? null : unit.id)} className="flex w-full items-start gap-4 p-4 text-start transition hover:bg-slate-50" aria-expanded={expanded}>
                <span className={`w-10 shrink-0 font-serif text-4xl leading-none font-medium tabular-nums ${c.text}`} aria-hidden>
                  {doneLessons === lessons.length ? <Trophy className="mt-1 size-7" /> : String(unit.order).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="eyebrow block">
                    {tr('יחידה', 'Unit')} {unit.order}
                  </span>
                  <span className="mt-0.5 block font-serif text-xl leading-tight font-semibold text-slate-900">{ut.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{ut.subtitle}</span>
                  <span className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
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
                            className={`relative grid size-16 place-items-center rounded-full text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed ${
                              done ? 'bg-amber-400' : unlocked ? c.node : 'bg-slate-300'
                            } ${isNext ? 'ring-2 ring-slate-900 ring-offset-4' : ''}`}
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
