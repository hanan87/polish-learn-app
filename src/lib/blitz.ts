import { getCustomItems, getItem, UNITS } from '../data';
import type { LearningItem } from '../data/types';

/** Speed Blitz rules (pure, unit-tested). */

export const BLITZ_SECONDS = 60;

export function comboMultiplier(combo: number): number {
  return combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
}

/** Learned words (course + personal); falls back to the first two units for brand-new learners. */
export function blitzPool(learnedIds: string[]): LearningItem[] {
  const learned = learnedIds.map((id) => getItem(id)).filter((i): i is LearningItem => !!i);
  if (learned.length >= 6) return learned;
  const extra = [...UNITS[0].items, ...UNITS[1].items, ...getCustomItems()];
  const seen = new Set(learned.map((i) => i.id));
  return [...learned, ...extra.filter((i) => !seen.has(i.id))];
}
