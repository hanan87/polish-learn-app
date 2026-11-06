/**
 * Core data model for the course.
 *
 * Syllable notation (used by `syllablesPolish`, `phoneticHebrew` and `phoneticEnglish`):
 *   - "·" (U+00B7 middle dot) separates syllables inside a word.
 *   - A space separates words.
 *   - Square brackets mark the stressed syllable: "prze·[pra]·szam".
 *   - Words without brackets are unstressed clitics (e.g. "się", "w", "nie").
 * The UI parses this notation and paints the stressed syllable in an accent color
 * (and upper-cases it in the English respelling, e.g. "jen·KOO·yeh").
 */

import type { Lang } from '../i18n/LangContext';

export type Formality = 'formal' | 'casual' | 'neutral';

export type CourseUnitId = 'u1' | 'u2' | 'u3' | 'u4' | 'u5' | 'u6' | 'u7' | 'u8';
export type UnitId = CourseUnitId | 'custom';

/** Sound features used to group items in the Sound Lab. */
export type SoundTag =
  | 'hard-sibilant'
  | 'soft-sibilant'
  | 'l-vs-ł'
  | 'w'
  | 'nasal'
  | 'devoicing'
  | 'cluster'
  | 'y-vowel';

/** Item as authored in the Hebrew-first unit files (units 1–4). English is merged in from english.ts. */
export interface ItemSource {
  id: string;
  polish: string;
  syllablesPolish: string;
  hebrew: string;
  phoneticHebrew: string;
  articulationTip: string;
  backchainingSteps: [string, string, string];
  formality: Formality;
  soundTags?: SoundTag[];
  culturalNote?: string;
}

/** Complete bilingual item used by the app. */
export interface LearningItem extends ItemSource {
  english: string;
  phoneticEnglish: string;
  articulationTipEn: string;
  culturalNoteEn?: string;
  /** True for words the learner added to the personal dictionary. */
  custom?: boolean;
}

export type UnitColor = 'rose' | 'amber' | 'sky' | 'emerald' | 'violet' | 'orange' | 'red' | 'teal';

export interface UnitSource {
  id: CourseUnitId;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  color: UnitColor;
  items: ItemSource[];
}

export interface Unit extends Omit<UnitSource, 'items'> {
  titleEn: string;
  subtitleEn: string;
  descriptionEn: string;
  items: LearningItem[];
}

export const FORMALITY_LABELS: Record<Formality, { he: string; en: string }> = {
  formal: { he: 'רשמי (Pan/Pani)', en: 'Formal (Pan/Pani)' },
  casual: { he: 'יומיומי (ty)', en: 'Casual (ty)' },
  neutral: { he: 'ניטרלי', en: 'Neutral' },
};

/** Localized view of an item for the active language. */
export function itemText(item: LearningItem, lang: Lang) {
  return lang === 'he'
    ? { meaning: item.hebrew, phonetic: item.phoneticHebrew, tip: item.articulationTip, note: item.culturalNote }
    : { meaning: item.english, phonetic: item.phoneticEnglish, tip: item.articulationTipEn, note: item.culturalNoteEn };
}

export function unitText(unit: Unit, lang: Lang) {
  return lang === 'he'
    ? { title: unit.title, subtitle: unit.subtitle, description: unit.description }
    : { title: unit.titleEn, subtitle: unit.subtitleEn, description: unit.descriptionEn };
}
