import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Ear, Headphones, HelpCircle, Mic, Play, Shuffle, Volume2, X } from 'lucide-react';
import { CONTRAST_GROUPS, type ContrastGroup, type MinimalPair, type PairWord } from '../data/minimalPairs';
import { PHONETIC_LEGEND, UNITS } from '../data';
import { GROUP_SOUNDS } from '../data/sounds';
import { Phonetic } from '../components/Phonetic';
import { PolishSyllables } from '../components/PolishSyllables';
import { PronunciationPractice } from '../components/PronunciationPractice';
import { useLang } from '../i18n/LangContext';
import { toEnglishPhonetic } from '../lib/polishPhonetics';
import { pick } from '../lib/random';
import { RATE_NORMAL, RATE_SLOW, speak, speakSequence, stopSpeaking } from '../lib/tts';
import { XP, summarizeSounds, useProgress } from '../state/ProgressContext';

type Mode = 'compare' | 'ear' | 'speak';


const meaning = (w: PairWord, lang: 'he' | 'en') => (lang === 'he' ? w.hebrew : w.english);
const desc = (g: ContrastGroup, side: 'a' | 'b', lang: 'he' | 'en') =>
  side === 'a' ? (lang === 'he' ? g.descriptionA : g.descriptionAEn) : lang === 'he' ? g.descriptionB : g.descriptionBEn;

export function SoundLab({ onOpenItem, initialGroup }: { onOpenItem: (id: string) => void; initialGroup?: string }) {
  const { tr, lang } = useLang();
  const { state } = useProgress();
  const [groupId, setGroupId] = useState(initialGroup && CONTRAST_GROUPS.some((g) => g.id === initialGroup) ? initialGroup : CONTRAST_GROUPS[0].id);
  const [mode, setMode] = useState<Mode>('compare');
  const group = CONTRAST_GROUPS.find((g) => g.id === groupId)!;
  const weak = new Set(summarizeSounds(state).filter((s) => s.weak).map((s) => s.key));

  useEffect(() => () => stopSpeaking(), []);

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-slate-600">
        {tr(
          'זוגות מינימליים הם שתי מילים שנבדלות בצליל אחד בלבד. האוזן נוטה לאחד אותם – כאן מאמנים את האוזן ואת הפה להבחין.',
          'Minimal pairs are two words that differ in a single sound. Your ear tends to merge them – here you train both ear and mouth to tell them apart.',
        )}
      </p>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CONTRAST_GROUPS.map((g) => {
          const isWeak = (GROUP_SOUNDS[g.id] ?? []).some((s) => weak.has(s));
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroupId(g.id)}
              className={`polish relative shrink-0 rounded-full px-4 py-2 text-base font-bold ring-1 transition ${
                g.id === groupId ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-slate-700 ring-slate-200'
              }`}
              dir="ltr"
            >
              {g.soundA} / {g.soundB}
              {isWeak && <span className="absolute -top-1 -right-1 size-3 rounded-full bg-amber-500 ring-2 ring-white" title={tr('דורש חיזוק', 'Needs reinforcement')} />}
            </button>
          );
        })}
      </div>

      {(GROUP_SOUNDS[group.id] ?? []).some((s) => weak.has(s)) && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertCircle className="size-4 shrink-0" />
          {tr('הצליל הזה סומן אצלכם כדורש חיזוק – כדאי לתרגל אותו היום.', 'This sound is marked as needing reinforcement for you – worth practising today.')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(['a', 'b'] as const).map((side) => (
          <div key={side} className={`rounded-2xl p-3 ring-1 ${side === 'a' ? 'bg-indigo-50 text-indigo-900 ring-indigo-200' : 'bg-rose-50 text-rose-900 ring-rose-200'}`}>
            <p dir="ltr" className="polish text-start text-3xl font-black">
              {side === 'a' ? group.soundA : group.soundB}
            </p>
            <p className="mt-1 text-xs leading-relaxed sm:text-sm">{desc(group, side, lang)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1">
        {(
          [
            ['compare', tr('השוואה חיה', 'Live compare'), Headphones],
            ['ear', tr('זיהוי שמיעתי', 'Ear training'), Ear],
            ['speak', tr('תרגול הגייה', 'Speaking'), Mic],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition ${mode === m ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {mode === 'compare' && <LiveCompare key={group.id} group={group} />}
      {mode === 'ear' && <EarTraining key={group.id} group={group} />}
      {mode === 'speak' && <SpeakDrill key={group.id} group={group} />}

      <section className="space-y-2">
        <h2 className="text-lg font-bold">{tr('מילים ליחידת ההגייה', 'Pronunciation unit words')}</h2>
        <div className="flex flex-wrap gap-2">
          {UNITS[0].items.map((item) => (
            <button key={item.id} type="button" onClick={() => onOpenItem(item.id)} className="polish rounded-xl bg-white px-3 py-2 text-base font-semibold ring-1 ring-slate-200 hover:ring-rose-300" dir="ltr">
              {item.polish}
            </button>
          ))}
        </div>
      </section>

      <Legend />
    </div>
  );
}

function WordTile({ word, tone, active }: { word: PairWord; tone: 'a' | 'b'; active: boolean }) {
  const { lang, tr } = useLang();
  const cls = tone === 'a' ? 'ring-indigo-200' : 'ring-rose-200';
  return (
    <div className={`rounded-2xl bg-white p-3 text-center ring-2 transition ${active ? 'scale-[1.03] shadow-lg ' + (tone === 'a' ? 'ring-indigo-500' : 'ring-rose-500') : cls}`}>
      <PolishSyllables notation={word.syllablesPolish} size="md" />
      <Phonetic he={word.phoneticHebrew} en={toEnglishPhonetic(word.polish)} size="sm" />
      <p className="text-xs text-slate-500">{meaning(word, lang)}</p>
      <div className="mt-2 flex justify-center gap-1">
        <button type="button" onClick={() => speak(word.polish, RATE_NORMAL)} className="rounded-lg bg-slate-100 p-2" aria-label={tr('השמעה', 'Play')}>
          <Volume2 className="size-4" />
        </button>
        <button type="button" onClick={() => speak(word.polish, RATE_SLOW)} className="rounded-lg bg-slate-100 px-2 text-xs font-medium" aria-label={tr('השמעה איטית', 'Play slowly')}>
          ×0.6
        </button>
      </div>
    </div>
  );
}

function LiveCompare({ group }: { group: ContrastGroup }) {
  const { tr } = useLang();
  const [active, setActive] = useState<{ pair: string; side: 'a' | 'b' } | null>(null);

  const playPair = async (pair: MinimalPair) => {
    const seq = [pair.a, pair.b, pair.a, pair.b];
    await speakSequence(
      seq.map((w) => w.polish),
      0.8,
      (i) => setActive({ pair: pair.id, side: i % 2 === 0 ? 'a' : 'b' }),
      700,
    );
    setActive(null);
  };

  return (
    <div className="space-y-4">
      {group.pairs.map((pair) => (
        <div key={pair.id} className="space-y-2 rounded-3xl bg-slate-100 p-3">
          <div className="grid grid-cols-2 gap-2">
            <WordTile word={pair.a} tone="a" active={active?.pair === pair.id && active.side === 'a'} />
            <WordTile word={pair.b} tone="b" active={active?.pair === pair.id && active.side === 'b'} />
          </div>
          <button type="button" onClick={() => playPair(pair)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white active:scale-[0.98]">
            <Play className="size-4 fill-white" /> {tr('השמע זה מול זה (A-B-A-B)', 'Play side by side (A-B-A-B)')}
          </button>
        </div>
      ))}
    </div>
  );
}

function EarTraining({ group }: { group: ContrastGroup }) {
  const { award, recordExercise } = useProgress();
  const { tr, lang } = useLang();
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState<'a' | 'b' | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0 });

  const question = useMemo(() => {
    const pair = pick(group.pairs);
    const side: 'a' | 'b' = Math.random() < 0.5 ? 'a' : 'b';
    return { pair, side, round };
  }, [group, round]);

  const target = question.pair[question.side];

  useEffect(() => {
    const t = setTimeout(() => speak(target.polish), 300);
    return () => clearTimeout(t);
  }, [target]);

  const choose = (side: 'a' | 'b') => {
    if (answer) return;
    setAnswer(side);
    const ok = side === question.side;
    setStats((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0 }));
    recordExercise(undefined, target.polish, ok, GROUP_SOUNDS[group.id]);
    if (ok) award(XP.earTraining);
    else speak(target.polish, RATE_SLOW);
  };

  const next = () => {
    setAnswer(null);
    setRound((r) => r + 1);
  };

  const sound = question.side === 'a' ? group.soundA : group.soundB;

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {stats.correct}/{stats.total} {tr('נכונות', 'correct')}
        </span>
        <span className="font-bold text-orange-600">
          {tr('רצף', 'Streak')}: {stats.streak}
        </span>
      </div>
      <div className="flex flex-col items-center gap-2 py-2">
        <button type="button" onClick={() => speak(target.polish)} className="grid size-20 place-items-center rounded-full bg-rose-600 text-white shadow-lg active:scale-95" aria-label={tr('השמע שוב', 'Play again')}>
          <Volume2 className="size-9" />
        </button>
        <button type="button" onClick={() => speak(target.polish, RATE_SLOW)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium">
          {tr('איטי', 'Slow')}
        </button>
        <p className="font-medium text-slate-700">{tr('איזו מילה שמעתם?', 'Which word did you hear?')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(['a', 'b'] as const).map((side) => {
          const w = question.pair[side];
          const isRight = answer && side === question.side;
          const isWrongPick = answer === side && side !== question.side;
          return (
            <button
              key={side}
              type="button"
              onClick={() => choose(side)}
              className={`rounded-2xl p-4 ring-2 transition active:scale-95 ${isRight ? 'bg-emerald-50 ring-emerald-500' : isWrongPick ? 'animate-shake bg-rose-50 ring-rose-400' : 'bg-white ring-slate-200'}`}
            >
              <span dir="ltr" lang="pl" className="polish block text-2xl font-bold">
                {w.polish}
              </span>
              <span className="block text-xs text-slate-500">{meaning(w, lang)}</span>
              <span dir="ltr" className="polish mt-1 block text-xs font-bold text-slate-400">
                {side === 'a' ? group.soundA : group.soundB}
              </span>
            </button>
          );
        })}
      </div>
      {answer && (
        <div className="animate-pop-in space-y-3">
          <p className={`flex items-center gap-2 rounded-xl p-3 text-sm ${answer === question.side ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
            {answer === question.side ? <Check className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}
            {answer === question.side
              ? tr(`נכון! +${XP.earTraining} XP`, `Correct! +${XP.earTraining} XP`)
              : tr(
                  `השמענו "${target.polish}" (${target.hebrew}). האזינו שוב לאט – ההבדל ב-${sound}.`,
                  `We played "${target.polish}" (${target.english}). Listen again slowly – the difference is the ${sound}.`,
                )}
          </p>
          <button type="button" onClick={next} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 font-bold text-white">
            <Shuffle className="size-4" /> {tr('המילה הבאה', 'Next word')}
          </button>
        </div>
      )}
    </div>
  );
}

function SpeakDrill({ group }: { group: ContrastGroup }) {
  const { tr, lang } = useLang();
  const [pairIdx, setPairIdx] = useState(0);
  const [side, setSide] = useState<'a' | 'b'>('a');
  const pair = group.pairs[pairIdx % group.pairs.length];
  const word = pair[side];
  const other = pair[side === 'a' ? 'b' : 'a'];

  return (
    <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-2">
        {group.pairs.map((p, i) =>
          (['a', 'b'] as const).map((s) => (
            <button
              key={p.id + s}
              type="button"
              onClick={() => {
                setPairIdx(i);
                setSide(s);
              }}
              className={`polish rounded-xl px-3 py-1.5 text-base font-semibold ring-1 ${pairIdx === i && side === s ? 'bg-rose-600 text-white ring-rose-600' : 'bg-slate-50 ring-slate-200'}`}
              dir="ltr"
            >
              {p[s].polish}
            </button>
          )),
        )}
      </div>
      <div className="text-center">
        <PolishSyllables notation={word.syllablesPolish} size="lg" />
        <Phonetic he={word.phoneticHebrew} en={toEnglishPhonetic(word.polish)} />
        <p className="text-sm text-slate-500">{meaning(word, lang)}</p>
        <button type="button" onClick={() => speak(word.polish)} className="mx-auto mt-1 flex items-center gap-1 text-sm font-medium text-rose-600">
          <Volume2 className="size-4" /> {tr('שמעו את הדובר', 'Hear the speaker')}
        </button>
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <HelpCircle className="mt-0.5 size-4 shrink-0" />
        {desc(group, side, lang)}
      </p>
      <PronunciationPractice target={word.polish} confusableWith={other.polish} prompt={tr(`אמרו "${word.polish}" – ולא "${other.polish}"`, `Say "${word.polish}" – not "${other.polish}"`)} />
    </div>
  );
}

function Legend() {
  const { tr, lang } = useLang();
  return (
    <details className="group rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <summary className="cursor-pointer text-base font-bold">{tr('מקרא התעתיק העברי', 'Respelling legend')}</summary>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {PHONETIC_LEGEND.map((row) => (
            <tr key={row.pl} className="border-t border-slate-100">
              <td dir="ltr" className="polish py-2 pe-2 text-start font-bold text-slate-900">
                {row.pl}
              </td>
              <td className={lang === 'he' ? 'phonetic px-2 text-lg' : 'px-2 font-mono'}>{lang === 'he' ? row.he : row.en}</td>
              <td className="py-2 text-slate-600">{lang === 'he' ? row.noteHe : row.noteEn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
