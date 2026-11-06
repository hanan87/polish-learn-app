import { ALL_ITEMS, getItem, getUnit, getUnitOfItem } from '../data';
import type { LessonDef } from '../data/lessons';
import { CONTRAST_GROUPS, type ContrastGroup, type MinimalPair } from '../data/minimalPairs';
import { SOUND_INFO, type SoundKey } from '../data/sounds';
import type { LearningItem, SoundTag } from '../data/types';
import { detectSounds } from '../lib/polishPhonetics';
import { pick, sample, shuffle } from '../lib/random';
import { mispronounce } from '../lib/simulate';
import { normalize, stripDiacritics } from '../lib/text';
import { itemWeakness, summarizeSounds, type ProgressState } from '../state/ProgressContext';

/**
 * Lesson Engine step generation. A lesson walks the learner through five skill stages:
 *   1. learn         – Learn & Shadow card (listen, record, compare, feedback)
 *   2. listen-*      – Listening comprehension (meaning / minimal-pair sound)
 *   3. assemble/fill/choose – Reading & context (word bank, missing word, spelling recognition)
 *   4. write         – Writing with the Polish virtual keyboard
 *   5. recall        – Active-recall speaking from a situation
 */

export type LessonStep =
  | { kind: 'learn'; key: string; itemId: string }
  | { kind: 'listen-meaning'; key: string; itemId: string; optionIds: string[] }
  | { kind: 'listen-pair'; key: string; group: ContrastGroup; pair: MinimalPair; side: 'a' | 'b' }
  | { kind: 'assemble'; key: string; itemId: string; bank: string[] }
  | { kind: 'fill-blank'; key: string; itemId: string; blankIndex: number; options: string[] }
  | { kind: 'choose-spelling'; key: string; itemId: string; options: string[] }
  | { kind: 'write'; key: string; itemId: string }
  | { kind: 'recall'; key: string; itemId: string };

export const STAGE_LABELS: Record<LessonStep['kind'], { he: string; en: string }> = {
  learn: { he: 'לימוד והאזנה', en: 'Learn & shadow' },
  'listen-meaning': { he: 'הבנת הנשמע', en: 'Listening' },
  'listen-pair': { he: 'זוג מינימלי', en: 'Minimal pair' },
  assemble: { he: 'הרכבת משפט', en: 'Build the sentence' },
  'fill-blank': { he: 'השלמת מילה', en: 'Fill the gap' },
  'choose-spelling': { he: 'קריאה וזיהוי', en: 'Reading' },
  write: { he: 'כתיבה', en: 'Writing' },
  recall: { he: 'דיבור מהזיכרון', en: 'Speak from memory' },
};

const TAG_TO_GROUP: Partial<Record<SoundTag, string>> = {
  'hard-sibilant': 'sz-s',
  'soft-sibilant': 'cz-c',
  'l-vs-ł': 'l-l',
  w: 'w-l',
  'y-vowel': 'y-i',
  nasal: 'nasal',
};

/** Split a phrase into word tokens without trailing punctuation. */
export function tokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?]+$/, ''))
    .filter(Boolean);
}

/** Forms of address that make good "register" blanks. */
const REGISTER_WORDS = ['Pan', 'Pani', 'Panu', 'masz', 'ma', 'ty'];
const REGISTER_SWAPS: Record<string, string[]> = {
  Pan: ['Pani', 'ty'],
  Pani: ['Pan', 'ty'],
  Panu: ['Pani', 'ci'],
  masz: ['ma', 'mam'],
  ma: ['masz', 'mam'],
  ty: ['Pan', 'Pani'],
};

/** Items used for distractors: the item's own unit, or the whole course for custom words. */
function poolFor(item: LearningItem): LearningItem[] {
  const unitId = getUnitOfItem(item.id);
  return unitId && unitId !== 'custom' ? getUnit(unitId).items : ALL_ITEMS;
}

function otherWords(item: LearningItem, pool: LearningItem[]): string[] {
  const own = new Set(tokens(item.polish).map((w) => normalize(w)));
  const words = pool.filter((i) => i.id !== item.id).flatMap((i) => tokens(i.polish));
  const unique = [...new Map(words.map((w) => [normalize(w), w])).values()];
  return unique.filter((w) => !own.has(normalize(w)));
}

function listenStep(item: LearningItem, keySuffix = ''): LessonStep {
  const distractors = sample(
    poolFor(item).filter((i) => i.id !== item.id && i.hebrew !== item.hebrew),
    3,
  ).map((i) => i.id);
  return { kind: 'listen-meaning', key: `listen-${item.id}${keySuffix}`, itemId: item.id, optionIds: shuffle([item.id, ...distractors]) };
}

function readingStep(item: LearningItem, preferBlank: boolean): LessonStep {
  const pool = poolFor(item);
  const words = tokens(item.polish);
  if (words.length >= 2) {
    const registerIdx = words.findIndex((w) => REGISTER_WORDS.includes(w));
    if (preferBlank || registerIdx >= 0) {
      const blankIndex = registerIdx >= 0 ? registerIdx : words.reduce((best, w, i) => (w.length > words[best].length ? i : best), 0);
      const answer = words[blankIndex];
      const distractors = [...(REGISTER_SWAPS[answer] ?? []), ...sample(otherWords(item, pool), 4)]
        .filter((w, i, arr) => normalize(w) !== normalize(answer) && arr.findIndex((x) => normalize(x) === normalize(w)) === i)
        .slice(0, 3);
      return { kind: 'fill-blank', key: `fill-${item.id}`, itemId: item.id, blankIndex, options: shuffle([answer, ...distractors]) };
    }
    const extra = sample(otherWords(item, pool), Math.min(3, Math.max(2, 6 - words.length)));
    return { kind: 'assemble', key: `asm-${item.id}`, itemId: item.id, bank: shuffle([...words, ...extra]) };
  }

  // Single word: recognize the correct spelling among realistic look-alikes.
  const correct = words[0] ?? item.polish;
  const candidates = [stripDiacritics(correct.toLocaleLowerCase('pl-PL')), mispronounce(correct), ...sample(otherWords(item, pool), 3)];
  const options = [correct];
  for (const c of candidates) {
    if (options.length >= 4) break;
    if (!options.some((o) => normalize(o) === normalize(c))) options.push(c);
  }
  return { kind: 'choose-spelling', key: `spell-${item.id}`, itemId: item.id, options: shuffle(options) };
}

function pairStep(group: ContrastGroup, keySuffix = ''): LessonStep {
  const pair = pick(group.pairs);
  return { kind: 'listen-pair', key: `pair-${group.id}-${pair.id}${keySuffix}`, group, pair, side: Math.random() < 0.5 ? 'a' : 'b' };
}

export function buildLesson(lesson: LessonDef): LessonStep[] {
  const items = lesson.itemIds.map((id) => getItem(id)!).filter(Boolean);
  const steps: LessonStep[] = [];

  // 1. Learn & Shadow
  for (const item of items) steps.push({ kind: 'learn', key: `learn-${item.id}`, itemId: item.id });

  // 2. Listening comprehension + one minimal pair from the lesson's sound features
  for (const item of shuffle(items)) steps.push(listenStep(item));
  const tags = items.flatMap((i) => i.soundTags ?? []);
  const sounds = items.flatMap((i) => detectSounds(i.polish));
  const groupId =
    tags.map((t) => TAG_TO_GROUP[t]).find(Boolean) ?? sounds.map((s) => SOUND_INFO[s].groupId).find(Boolean) ?? (lesson.unitId === 'u1' ? 'sz-s' : null);
  const group = groupId ? CONTRAST_GROUPS.find((g) => g.id === groupId) : null;
  if (group) steps.push(pairStep(group));

  // 3. Reading & context
  shuffle(items)
    .slice(0, 3)
    .forEach((item, i) => steps.push(readingStep(item, i % 2 === 1)));

  // 4. Writing – prefer shorter items so typing on a phone stays reasonable.
  const writeItems = [...items].sort((a, b) => a.polish.length - b.polish.length).slice(0, 2);
  for (const item of writeItems) steps.push({ kind: 'write', key: `write-${item.id}`, itemId: item.id });

  // 5. Active recall speaking – prefer items not used in writing.
  const recallPool = items.filter((i) => !writeItems.includes(i));
  for (const item of recallPool.length >= 2 ? sample(recallPool, 2) : sample(items, 2)) steps.push({ kind: 'recall', key: `recall-${item.id}`, itemId: item.id });

  return steps;
}

export const REINFORCEMENT_SIZE = 8;

/**
 * Personalized reinforcement lesson: exactly 8 exercises built from the learner's weakest
 * items (low pronunciation averages, writing errors, failed reviews, low mastery) and
 * weakest sounds. Each weak item gets the exercise type that targets its weakness.
 */
export function buildReinforcementLesson(state: ProgressState): LessonStep[] {
  const weakSounds = summarizeSounds(state).filter((s) => s.weak);
  const weakSet = new Set<SoundKey>(weakSounds.map((s) => s.key));

  const ranked = Object.entries(state.items)
    .map(([id, p]) => ({ item: getItem(id), p }))
    .filter((x): x is { item: LearningItem; p: (typeof state.items)[string] } => !!x.item && x.p.learned)
    .map(({ item, p }) => {
      const soundHits = detectSounds(item.polish).filter((s) => weakSet.has(s)).length;
      return { item, p, score: itemWeakness(p) + soundHits * 0.8 };
    })
    .sort((a, b) => b.score - a.score);

  const steps: LessonStep[] = [];
  const used = new Set<string>();
  const add = (s: LessonStep) => {
    if (steps.length < REINFORCEMENT_SIZE && !used.has(s.key)) {
      used.add(s.key);
      steps.push(s);
    }
  };

  // Up to two minimal-pair drills for the weakest sounds.
  const groups = [...new Set(weakSounds.map((s) => SOUND_INFO[s.key].groupId).filter(Boolean) as string[])];
  groups.slice(0, 2).forEach((g) => {
    const group = CONTRAST_GROUPS.find((c) => c.id === g);
    if (group) add(pairStep(group));
  });

  // One targeted exercise per weak item, matched to what it is weak in.
  for (const { item, p } of ranked.slice(0, 6)) {
    const pronWeak = p.pronAvg === null || p.pronAvg < 75;
    const writeWeak = p.writingAttempts > 0 && p.writingErrors / p.writingAttempts >= 0.34;
    if (writeWeak) add({ kind: 'write', key: `write-${item.id}`, itemId: item.id });
    else if (pronWeak) add({ kind: 'recall', key: `recall-${item.id}`, itemId: item.id });
    else add(listenStep(item));
  }

  // Fill the remaining slots with a different skill for the weakest items, then reading/listening.
  for (const { item } of ranked) {
    if (steps.length >= REINFORCEMENT_SIZE) break;
    add({ kind: 'write', key: `write-${item.id}`, itemId: item.id });
    add(readingStep(item, true));
    add(listenStep(item));
  }
  // Very little history: pad with minimal pairs from the most common Polish contrasts
  // (a second round uses a key suffix, since there are fewer groups than exercise slots).
  for (const round of ['', '-2']) {
    for (const g of CONTRAST_GROUPS) {
      if (steps.length >= REINFORCEMENT_SIZE) break;
      add(pairStep(g, round));
    }
  }

  // Keep the five-skill order: listening first, then reading, writing, speaking.
  const order: LessonStep['kind'][] = ['listen-pair', 'listen-meaning', 'assemble', 'fill-blank', 'choose-spelling', 'write', 'recall', 'learn'];
  return steps.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
