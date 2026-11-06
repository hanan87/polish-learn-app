import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  Eye,
  Layers,
  Maximize2,
  Mic,
  Plus,
  Search,
  Trash2,
  Trophy,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { HandsFreeButton } from './CourseMap';
import { ALL_ITEMS, getCustomItems, getItem, getUnitOfItem, UNITS } from '../data';
import { SOUND_INFO } from '../data/sounds';
import { itemText, type LearningItem } from '../data/types';
import { FormalityBadge } from '../components/FormalityBadge';
import { MasteryDots } from '../components/ItemStats';
import { Phonetic } from '../components/Phonetic';
import { PolishSyllables } from '../components/PolishSyllables';
import { PronunciationPractice } from '../components/PronunciationPractice';
import { Sheet } from '../components/Sheet';
import { useLang } from '../i18n/LangContext';
import { daysBetween, todayKey } from '../lib/date';
import { shuffle } from '../lib/random';
import { speak } from '../lib/tts';
import { masteryOf, needsPractice, SRS_INTERVALS, summarizeSounds, useProgress } from '../state/ProgressContext';
import { AddWordForm } from './AddWordForm';

type Direction = 'native-pl' | 'pl-native';
type Filter = 'learned' | 'practice' | 'mine' | 'all';

interface Props {
  onOpenItem: (id: string) => void;
  onStartPractice: () => void;
  onOpenSoundGroup: (groupId: string) => void;
  onOpenHandsFree: () => void;
  onOpenBlitz: () => void;
}

export function VocabReview({ onOpenItem, onStartPractice, onOpenSoundGroup, onOpenHandsFree, onOpenBlitz }: Props) {
  const { dueItemIds, state } = useProgress();
  const { tr } = useLang();
  const [session, setSession] = useState<string[] | null>(null);
  const [direction, setDirection] = useState<Direction>('native-pl');
  const [adding, setAdding] = useState(false);
  const due = dueItemIds();
  const learnedIds = Object.entries(state.items)
    .filter(([id, p]) => p.learned && getItem(id))
    .map(([id]) => id);
  const hasHistory = learnedIds.length > 0 || Object.keys(state.sounds).length > 0;

  if (session) return <ReviewSession ids={session} direction={direction} onExit={() => setSession(null)} />;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-bl from-rose-600 to-orange-500 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-sm font-medium opacity-90">
          <Layers className="size-4" /> {tr('חזרה מרווחת (Spaced Repetition)', 'Spaced repetition')}
        </div>
        <p className="mt-2 text-3xl font-black">{tr(`${due.length} כרטיסים לחזרה היום`, `${due.length} cards due today`)}</p>
        <p className="mt-1 text-sm opacity-90">
          {tr(
            `מילים שנלמדו חוזרות במרווחים הולכים וגדלים: ${SRS_INTERVALS.slice(1).join(', ')} ימים. טעות בהגייה, בכתיבה או בתרגיל מורידה רמת שליטה ומחזירה את המילה להיום.`,
            `Learned words come back at growing intervals: ${SRS_INTERVALS.slice(1).join(', ')} days. A pronunciation, writing or exercise mistake lowers mastery and brings the word back today.`,
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={due.length === 0} onClick={() => setSession(due.slice(0, 20))} className="rounded-2xl bg-white px-5 py-3 font-bold text-rose-600 shadow active:scale-95 disabled:opacity-60">
            {tr('התחל חזרה', 'Start review')}
          </button>
          {due.length === 0 && learnedIds.length > 0 && (
            <button type="button" onClick={() => setSession(shuffle(learnedIds).slice(0, 15))} className="rounded-2xl bg-white/20 px-4 py-3 font-medium ring-1 ring-white/50 active:scale-95">
              {tr(`תרגול חופשי (${learnedIds.length})`, `Free practice (${learnedIds.length})`)}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDirection((d) => (d === 'native-pl' ? 'pl-native' : 'native-pl'))}
            className="flex items-center gap-1.5 rounded-2xl bg-white/20 px-4 py-3 text-sm font-medium ring-1 ring-white/50 active:scale-95"
          >
            <ArrowLeftRight className="size-4" />
            {direction === 'native-pl' ? tr('עברית ← פולנית', 'English → Polish') : tr('פולנית ← עברית', 'Polish → English')}
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onOpenBlitz}
          className="flex items-center gap-3 rounded-3xl bg-gradient-to-l from-amber-500 to-yellow-400 p-4 text-start text-white shadow-md transition active:scale-[0.98]"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/25">
            <Zap className="size-6 fill-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black">{tr('אתגר מהירות 60 שניות', '60-second Speed Blitz')}</span>
            <span className="flex items-center gap-1 text-xs text-white/90">
              <Trophy className="size-3.5" /> {tr('השיא שלכם', 'Your record')}: {state.blitz.best}
            </span>
          </span>
        </button>
        <HandsFreeButton onClick={onOpenHandsFree} subtitle={tr('חזרה קולית על המילים שלמדתם – החלשות קודם.', 'Audio review of your learned words – weakest first.')} />
      </div>

      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">
            <Dumbbell className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black">{tr('אימון חיזוק מותאם אישית', 'Personalized reinforcement')}</p>
            <p className="text-sm text-slate-600">
              {tr(
                'שיעור של 8 תרגילים שנבנה אוטומטית מהמילים והצלילים שבהם קיבלתם את הציונים הנמוכים ביותר.',
                'An 8-exercise lesson built automatically from the words and sounds where you scored lowest.',
              )}
            </p>
          </div>
        </div>
        <button type="button" disabled={!hasHistory} onClick={onStartPractice} className="w-full rounded-2xl bg-indigo-600 py-3.5 font-bold text-white shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none">
          {hasHistory ? tr('התחל אימון חיזוק', 'Start reinforcement') : tr('השלימו שיעור אחד כדי לפתוח', 'Complete one lesson to unlock')}
        </button>
      </section>

      <WeakSoundsPanel onOpenSoundGroup={onOpenSoundGroup} />

      <Dictionary onOpenItem={onOpenItem} onAdd={() => setAdding(true)} />

      <Sheet open={adding} onClose={() => setAdding(false)} title={tr('הוסף מילה או משפט משלי', 'Add my own word or phrase')}>
        <AddWordForm onDone={() => setAdding(false)} />
      </Sheet>
    </div>
  );
}

function WeakSoundsPanel({ onOpenSoundGroup }: { onOpenSoundGroup: (g: string) => void }) {
  const { state } = useProgress();
  const { tr, lang } = useLang();
  const sounds = summarizeSounds(state);
  if (sounds.length === 0) return null;
  const weakCount = sounds.filter((s) => s.weak).length;

  return (
    <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <p className="text-lg font-black">{tr('צלילים מאתגרים', 'Challenging sounds')}</p>
        <p className="text-sm text-slate-600">
          {weakCount
            ? tr(`${weakCount} צלילים סומנו כדורשים חיזוק, לפי ההיסטוריה שלכם בהגייה, בכתיבה ובשמיעה.`, `${weakCount} sounds are marked as needing reinforcement, based on your speaking, writing and listening history.`)
            : tr('אין כרגע צלילים שדורשים חיזוק – המשיכו כך!', 'No sounds need reinforcement right now – keep it up!')}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {sounds.slice(0, 8).map((s) => {
          const info = SOUND_INFO[s.key];
          const errPct = Math.round(s.errorRate * 100);
          return (
            <li key={s.key} className={`rounded-2xl p-3 ring-1 ${s.weak ? 'bg-amber-50 ring-amber-300' : 'bg-slate-50 ring-slate-200'}`}>
              <div className="flex items-center gap-2">
                <span dir="ltr" className="polish text-2xl font-black text-slate-900">
                  {s.key}
                </span>
                <span className="text-xs text-slate-500">{lang === 'he' ? info.name : info.nameEn}</span>
                {s.weak && (
                  <span className="ms-auto flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                    <AlertTriangle className="size-3" /> {tr('דורש חיזוק', 'Needs work')}
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white" title={`${errPct}%`}>
                <div className={`h-full rounded-full ${s.weak ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${100 - errPct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {tr(`${s.attempts} ניסיונות · ${errPct}% שגיאות`, `${s.attempts} attempts · ${errPct}% errors`)}
                {s.avgScore !== null && tr(` · ציון הגייה ${s.avgScore}%`, ` · speaking ${s.avgScore}%`)}
              </p>
              {s.weak && <p className="mt-1 text-xs text-amber-900">{lang === 'he' ? info.tip : info.tipEn}</p>}
              {s.weak && info.groupId && (
                <button type="button" onClick={() => onOpenSoundGroup(info.groupId!)} className="mt-2 text-xs font-bold text-indigo-700 underline">
                  {tr('תרגול זוגות מינימליים במעבדה', 'Practise minimal pairs in the lab')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewSession({ ids, direction, onExit }: { ids: string[]; direction: Direction; onExit: () => void }) {
  const { recordReview } = useProgress();
  const { tr, lang } = useLang();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const item = getItem(ids[index]);

  if (index >= ids.length || !item) {
    const correct = results.filter(Boolean).length;
    return (
      <div className="animate-pop-in space-y-4 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
        <p className="text-2xl font-black">{tr('סיימתם את החזרה!', 'Review complete!')}</p>
        <p className="text-slate-600">{tr(`${correct} מתוך ${results.length} נכונות`, `${correct} of ${results.length} correct`)}</p>
        <button type="button" onClick={onExit} className="rounded-2xl bg-slate-900 px-6 py-3 font-bold text-white">
          {tr('חזרה לאוצר המילים', 'Back to words')}
        </button>
      </div>
    );
  }

  const text = itemText(item, lang);
  const answer = (correct: boolean) => {
    recordReview(item.id, correct);
    setResults((r) => [...r, correct]);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onExit} className="grid size-10 place-items-center rounded-full hover:bg-slate-200" aria-label={tr('יציאה', 'Exit')}>
          <X className="size-5" />
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(index / ids.length) * 100}%` }} />
        </div>
        <span className="text-sm font-medium text-slate-500">
          {index + 1}/{ids.length}
        </span>
      </div>

      <div key={item.id} className="animate-pop-in min-h-72 space-y-4 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <FormalityBadge formality={item.formality} />
        {direction === 'native-pl' ? (
          <p className="text-2xl font-bold text-slate-900">{text.meaning}</p>
        ) : (
          <div className="space-y-2">
            <PolishSyllables notation={item.syllablesPolish} size="lg" />
            <button type="button" onClick={() => speak(item.polish)} className="mx-auto flex items-center gap-1 text-sm text-rose-600">
              <Volume2 className="size-4" /> {tr('השמע', 'Play')}
            </button>
          </div>
        )}
        {revealed ? (
          <div className="animate-pop-in space-y-2 border-t border-slate-100 pt-4">
            {direction === 'native-pl' ? <PolishSyllables notation={item.syllablesPolish} size="lg" /> : <p className="text-xl font-bold">{text.meaning}</p>}
            <Phonetic he={item.phoneticHebrew} en={item.phoneticEnglish} />
          </div>
        ) : (
          <p className="pt-6 text-sm text-slate-400">{tr('נסו להיזכר בתשובה לפני שאתם חושפים', 'Try to recall the answer before revealing it')}</p>
        )}
      </div>

      {revealed ? (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => answer(false)} className="flex items-center justify-center gap-2 rounded-2xl bg-rose-100 py-4 font-bold text-rose-700 active:scale-95">
            <X className="size-5" /> {tr('לא ידעתי', "Didn't know")}
          </button>
          <button type="button" onClick={() => answer(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-bold text-white active:scale-95">
            <Check className="size-5" /> {tr('ידעתי', 'Knew it')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setRevealed(true);
            speak(item.polish);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-bold text-white active:scale-[0.98]"
        >
          <Eye className="size-5" /> {tr('הצג תשובה', 'Show answer')}
        </button>
      )}
    </div>
  );
}

function Dictionary({ onOpenItem, onAdd }: { onOpenItem: (id: string) => void; onAdd: () => void }) {
  const { state, isLearned } = useProgress();
  const { tr } = useLang();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('learned');
  const [unit, setUnit] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => {
    const today = todayKey();
    const q = query.trim().toLocaleLowerCase('pl-PL');
    const pool: LearningItem[] = [...ALL_ITEMS, ...getCustomItems()];
    return pool
      .filter((i) => {
        const p = state.items[i.id];
        if (filter === 'learned') return !!p?.learned;
        if (filter === 'practice') return needsPractice(p, today);
        if (filter === 'mine') return !!i.custom;
        return true;
      })
      .filter((i) => unit === 'all' || getUnitOfItem(i.id) === unit)
      .filter((i) => !q || i.polish.toLocaleLowerCase('pl-PL').includes(q) || i.hebrew.includes(query.trim()) || i.english.toLowerCase().includes(q));
    // state.customItems is a dependency so newly added words appear immediately.
  }, [query, filter, unit, state.items, state.customItems]);

  const filters: [Filter, string][] = [
    ['learned', tr('מילים שנלמדו', 'Learned')],
    ['practice', tr('דורשות תרגול', 'Need practice')],
    ['mine', tr('המילים שלי', 'My words')],
    ['all', tr('כל הקורס', 'Whole course')],
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-bold">{tr('המילון שלי', 'My dictionary')}</h2>
        <button type="button" onClick={onAdd} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow active:scale-95">
          <Plus className="size-4" /> {tr('הוסף מילה או משפט משלי', 'Add my own word')}
        </button>
      </div>
      <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-rose-400">
        <Search className="size-4 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('חיפוש בעברית או בפולנית', 'Search in English or Polish')} className="min-w-0 flex-1 bg-transparent text-base outline-none" />
      </label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filters.map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${filter === f ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200'}`}
          >
            {label}
          </button>
        ))}
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200" aria-label={tr('סינון לפי יחידה', 'Filter by unit')}>
          <option value="all">{tr('כל היחידות', 'All units')}</option>
          {UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {tr('יחידה', 'Unit')} {u.order}
            </option>
          ))}
          <option value="custom">{tr('המילים שלי', 'My words')}</option>
        </select>
      </div>

      <ul className="grid gap-2">
        {items.map((item) => (
          <WordCard key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} onOpenItem={onOpenItem} learned={isLearned(item.id)} />
        ))}
      </ul>
      {items.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          {filter === 'learned'
            ? tr('עדיין אין מילים שנלמדו. השלימו שיעור במפת הקורס.', 'No learned words yet. Complete a lesson on the course map.')
            : filter === 'practice'
              ? tr('אין מילים שדורשות תרגול כרגע.', 'No words need practice right now.')
              : tr('לא נמצאו פריטים', 'No items found')}
        </p>
      )}
    </section>
  );
}

function WordCard({ item, open, onToggle, onOpenItem, learned }: { item: LearningItem; open: boolean; onToggle: () => void; onOpenItem: (id: string) => void; learned: boolean }) {
  const { state, removeCustomItem } = useProgress();
  const { tr, lang } = useLang();
  const text = itemText(item, lang);
  const p = state.items[item.id];
  const level = masteryOf(p);
  const days = p ? daysBetween(todayKey(), p.dueDate) : null;
  const weak = needsPractice(p);

  return (
    <li className={`overflow-hidden rounded-2xl bg-white ring-1 ${weak ? 'ring-amber-300' : 'ring-slate-200'}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => speak(item.polish)} className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600 active:scale-95" aria-label={tr('השמע', 'Play')}>
          <Volume2 className="size-5" />
        </button>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-start" aria-expanded={open}>
          <PolishSyllables notation={item.syllablesPolish} size="sm" className="truncate" />
          <span className="block truncate text-sm text-slate-500">{text.meaning}</span>
        </button>
        {learned && (
          <span className="flex flex-col items-end gap-1">
            <MasteryDots level={level} size="sm" />
            <span className="text-[10px] text-slate-400">
              {p?.pronAvg != null && `${p.pronAvg}% · `}
              {days !== null && (days <= 0 ? tr('חזרה היום', 'due today') : tr(`בעוד ${days} ימ׳`, `in ${days}d`))}
            </span>
          </span>
        )}
        <ChevronDown className={`size-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="animate-pop-in space-y-3 border-t border-slate-100 bg-slate-50 p-3">
          <Phonetic he={item.phoneticHebrew} en={item.phoneticEnglish} size="sm" />
          {p && (
            <p className="text-xs text-slate-500">
              {tr('רמת שליטה', 'Mastery')} {level}/5 · {tr('הגייה ממוצעת', 'Avg speaking')} {p.pronAvg != null ? `${p.pronAvg}%` : '—'} · {tr('שגיאות כתיבה', 'Writing errors')} {p.writingErrors}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Mic className="size-3.5" /> {tr('בדיקת הגייה מהירה', 'Quick pronunciation check')}
          </p>
          <PronunciationPractice target={item.polish} itemId={item.id} articulationTip={text.tip} backchainingSteps={item.backchainingSteps} compact />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenItem(item.id)} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-medium ring-1 ring-slate-200">
              <Maximize2 className="size-4" /> {tr('כרטיס מלא', 'Full card')}
            </button>
            {item.custom && (
              <button type="button" onClick={() => removeCustomItem(item.id)} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-medium text-rose-600 ring-1 ring-rose-200">
                <Trash2 className="size-4" /> {tr('מחק מהמילון', 'Delete')}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
