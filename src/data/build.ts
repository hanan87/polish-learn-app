import { autoBackchain, toEnglishPhonetic, toHebrewPhonetic, toSyllableNotation } from '../lib/polishPhonetics';
import type { Formality, LearningItem } from './types';

/** Compact authoring format for units 5–8 and custom words; phonetic fields are derived from the Polish text. */
export interface CompactItem {
  id: string;
  polish: string;
  he: string;
  en: string;
  tipHe: string;
  tipEn: string;
  formality: Formality;
  noteHe?: string;
  noteEn?: string;
  /** Optional hand-written overrides. */
  syllablesPolish?: string;
  phoneticHebrew?: string;
  phoneticEnglish?: string;
  backchainingSteps?: [string, string, string];
}

export function buildItem(c: CompactItem): LearningItem {
  return {
    id: c.id,
    polish: c.polish,
    syllablesPolish: c.syllablesPolish || toSyllableNotation(c.polish),
    hebrew: c.he,
    english: c.en,
    phoneticHebrew: c.phoneticHebrew || toHebrewPhonetic(c.polish),
    phoneticEnglish: c.phoneticEnglish || toEnglishPhonetic(c.polish),
    articulationTip: c.tipHe,
    articulationTipEn: c.tipEn,
    backchainingSteps: c.backchainingSteps ?? autoBackchain(c.polish),
    formality: c.formality,
    culturalNote: c.noteHe,
    culturalNoteEn: c.noteEn,
  };
}
