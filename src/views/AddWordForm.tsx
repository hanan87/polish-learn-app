import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, Volume2 } from 'lucide-react';
import type { Formality, LearningItem } from '../data/types';
import { Phonetic } from '../components/Phonetic';
import { PolishSyllables } from '../components/PolishSyllables';
import { useLang } from '../i18n/LangContext';
import { autoBackchain, autoTip, toEnglishPhonetic, toHebrewPhonetic, toSyllableNotation } from '../lib/polishPhonetics';
import { notationToPlain } from '../lib/syllables';
import { normalize } from '../lib/text';
import { speak } from '../lib/tts';
import { useProgress } from '../state/ProgressContext';

interface Fields {
  polish: string;
  hebrew: string;
  english: string;
  syllables: string;
  phoneticHe: string;
  phoneticEn: string;
  tip: string;
  formality: Formality;
}

const EMPTY: Fields = { polish: '', hebrew: '', english: '', syllables: '', phoneticHe: '', phoneticEn: '', tip: '', formality: 'neutral' };

/**
 * "Add my own word or phrase": the learner types Polish + a translation; syllables (with stress),
 * Hebrew and English transcriptions, backchaining and an articulation tip are suggested
 * automatically and can be edited before saving to the personal dictionary.
 */
export function AddWordForm({ onDone }: { onDone: () => void }) {
  const { tr, lang } = useLang();
  const { addCustomItem } = useProgress();
  const [f, setF] = useState<Fields>(EMPTY);
  // Fields the learner edited by hand are not overwritten by the auto-suggestion.
  const [touched, setTouched] = useState<Set<keyof Fields>>(new Set());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const text = f.polish.trim();
    setF((prev) => ({
      ...prev,
      syllables: touched.has('syllables') ? prev.syllables : text ? toSyllableNotation(text) : '',
      phoneticHe: touched.has('phoneticHe') ? prev.phoneticHe : text ? toHebrewPhonetic(text) : '',
      phoneticEn: touched.has('phoneticEn') ? prev.phoneticEn : text ? toEnglishPhonetic(text) : '',
      tip: touched.has('tip') ? prev.tip : text ? autoTip(text, lang) : '',
    }));
    // Only the Polish text drives the suggestions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.polish]);

  const set = (key: keyof Fields, value: string) => {
    setF((prev) => ({ ...prev, [key]: value }));
    if (key !== 'polish' && key !== 'hebrew' && key !== 'english' && key !== 'formality') setTouched((t) => new Set(t).add(key));
  };

  const regenerate = () => {
    setTouched(new Set());
    const text = f.polish.trim();
    setF((prev) => ({ ...prev, syllables: toSyllableNotation(text), phoneticHe: toHebrewPhonetic(text), phoneticEn: toEnglishPhonetic(text), tip: autoTip(text, lang) }));
  };

  const translation = lang === 'he' ? f.hebrew : f.english;
  const syllablesValid = !f.syllables || normalize(notationToPlain(f.syllables)) === normalize(f.polish);
  const canSave = f.polish.trim().length > 0 && translation.trim().length > 0 && syllablesValid;

  const save = () => {
    const polish = f.polish.trim();
    const item: LearningItem = {
      id: `c-${Date.now().toString(36)}`,
      polish,
      syllablesPolish: f.syllables.trim() || toSyllableNotation(polish),
      hebrew: f.hebrew.trim() || f.english.trim(),
      english: f.english.trim() || f.hebrew.trim(),
      phoneticHebrew: f.phoneticHe.trim() || toHebrewPhonetic(polish),
      phoneticEnglish: f.phoneticEn.trim() || toEnglishPhonetic(polish),
      articulationTip: lang === 'he' && f.tip.trim() ? f.tip.trim() : autoTip(polish, 'he'),
      articulationTipEn: lang === 'en' && f.tip.trim() ? f.tip.trim() : autoTip(polish, 'en'),
      backchainingSteps: autoBackchain(polish),
      formality: f.formality,
      custom: true,
    };
    addCustomItem(item);
    setSaved(true);
    setF(EMPTY);
    setTouched(new Set());
  };

  const input = 'w-full rounded-xl bg-white px-3 py-2.5 text-base ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-rose-400';
  const label = 'mb-1 block text-sm font-bold text-slate-700';

  if (saved) {
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
        <p className="text-xl font-black">{tr('נוסף למילון האישי!', 'Added to your dictionary!')}</p>
        <p className="text-sm text-slate-600">{tr('המילה נכנסה למאגר החזרה המרווחת ותופיע בתרגולים.', 'The word is now in your spaced-repetition deck and will appear in practice.')}</p>
        <div className="flex justify-center gap-2">
          <button type="button" onClick={() => setSaved(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 font-medium">
            {tr('הוסף עוד', 'Add another')}
          </button>
          <button type="button" onClick={onDone} className="rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white">
            {tr('סיום', 'Done')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save();
      }}
    >
      <h2 className="text-xl font-black">{tr('הוסף מילה או משפט משלי', 'Add my own word or phrase')}</h2>

      <div>
        <label className={label} htmlFor="aw-polish">
          {tr('בפולנית *', 'Polish *')}
        </label>
        <div className="flex gap-2">
          <input id="aw-polish" value={f.polish} onChange={(e) => set('polish', e.target.value)} dir="ltr" lang="pl" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="np. Dzień dobry" className={`${input} polish text-lg`} />
          <button type="button" disabled={!f.polish.trim()} onClick={() => speak(f.polish)} className="grid size-12 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 disabled:opacity-40" aria-label={tr('השמע', 'Play')}>
            <Volume2 className="size-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="aw-he">
            {tr('תרגום לעברית *', 'Hebrew translation')}
          </label>
          <input id="aw-he" value={f.hebrew} onChange={(e) => set('hebrew', e.target.value)} dir="rtl" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="aw-en">
            {tr('תרגום לאנגלית', 'English translation *')}
          </label>
          <input id="aw-en" value={f.english} onChange={(e) => set('english', e.target.value)} dir="ltr" className={input} />
        </div>
      </div>

      <div>
        <span className={label}>{tr('רמת רשמיות', 'Register')}</span>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['neutral', tr('ניטרלי', 'Neutral')],
              ['formal', tr('רשמי (Pan/Pani)', 'Formal (Pan/Pani)')],
              ['casual', tr('יומיומי (ty)', 'Casual (ty)')],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => set('formality', value)}
              className={`rounded-xl py-2 text-sm font-medium ring-1 ${f.formality === value ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-200'}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold text-indigo-700">
            <Sparkles className="size-4" /> {tr('הצעה אוטומטית (ניתן לערוך)', 'Auto-suggested (editable)')}
          </p>
          <button type="button" onClick={regenerate} disabled={!f.polish.trim()} className="text-xs font-bold text-indigo-700 underline disabled:opacity-40">
            {tr('חשב מחדש', 'Recalculate')}
          </button>
        </div>
        <div>
          <label className={label} htmlFor="aw-syl">
            {tr('חלוקה להברות (· בין הברות, [ ] סביב ההברה המוטעמת)', 'Syllables (· between syllables, [ ] around the stressed one)')}
          </label>
          <input id="aw-syl" value={f.syllables} onChange={(e) => set('syllables', e.target.value)} dir="ltr" lang="pl" className={`${input} polish`} />
          {!syllablesValid && <p className="mt-1 text-xs text-rose-600">{tr('החלוקה לא תואמת לטקסט הפולני.', 'The syllables do not match the Polish text.')}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="aw-phe">
              {tr('תעתיק עברי מנוקד', 'Hebrew transcription')}
            </label>
            <input id="aw-phe" value={f.phoneticHe} onChange={(e) => set('phoneticHe', e.target.value)} dir="rtl" className={`${input} phonetic`} />
          </div>
          <div>
            <label className={label} htmlFor="aw-pen">
              {tr('תעתיק לדוברי אנגלית', 'English respelling')}
            </label>
            <input id="aw-pen" value={f.phoneticEn} onChange={(e) => set('phoneticEn', e.target.value)} dir="ltr" className={`${input} font-mono`} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="aw-tip">
            {tr('טיפ הגייה', 'Pronunciation tip')}
          </label>
          <textarea id="aw-tip" value={f.tip} onChange={(e) => set('tip', e.target.value)} rows={3} className={input} />
        </div>
      </div>

      {f.polish.trim() && syllablesValid && (
        <div className="space-y-1 rounded-2xl bg-rose-50/60 p-4 text-center ring-1 ring-rose-100">
          <p className="text-xs font-bold text-slate-500">{tr('תצוגה מקדימה', 'Preview')}</p>
          <PolishSyllables notation={f.syllables || f.polish} size="lg" />
          <Phonetic he={f.phoneticHe} en={f.phoneticEn} size="sm" />
          <p className="text-slate-600">{translation}</p>
        </div>
      )}

      <button type="submit" disabled={!canSave} className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white shadow-md active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none">
        {tr('שמור במילון האישי (+5 XP)', 'Save to my dictionary (+5 XP)')}
      </button>
    </form>
  );
}
