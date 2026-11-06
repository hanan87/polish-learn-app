import { getItem, UNITS } from '../data';
import { lessonsOfUnit } from '../data/lessons';
import type { LearningItem } from '../data/types';

/** Items for the session: from the review tab – learned words, weakest first; from the map – the active unit. */
export function handsFreeQueue(source: 'map' | 'vocab', learnedIds: string[], weakness: (id: string) => number, doneLessons: Set<string>): LearningItem[] {
  const activeUnit = UNITS.find((u) => lessonsOfUnit(u.id).some((l) => !doneLessons.has(l.id))) ?? UNITS[0];
  if (source === 'vocab') {
    const learned = learnedIds
      .map((id) => getItem(id))
      .filter((i): i is LearningItem => !!i)
      .sort((a, b) => weakness(b.id) - weakness(a.id));
    if (learned.length >= 3) return learned.slice(0, 30);
  }
  const learnedInUnit = activeUnit.items.filter((i) => learnedIds.includes(i.id));
  const rest = activeUnit.items.filter((i) => !learnedIds.includes(i.id));
  return [...learnedInUnit, ...rest];
}
