import { toEnglishPhonetic, toHebrewPhonetic, toSyllableNotation } from './polishPhonetics';

/**
 * Learner personalization: grammatical gender and first name.
 *
 * Polish verbs in the past tense, adjectives and conditional forms agree with the speaker's gender
 * (Zgubiłem / Zgubiłam, Jestem gotowy / gotowa, Chciałbym / Chciałabym). Course data is authored
 * as templates that are resolved for the active learner:
 *   {masculine|feminine}  – alternative pair, e.g. "Jestem gotow{y|a}" or "{Pan|Pani}"
 *   {name}                – the learner's first name (rendered per field: plain, syllables or phonetics)
 */

export type Gender = 'm' | 'f';

export interface LearnerProfile {
  gender: Gender | null;
  name: string;
}

export const DEFAULT_PROFILE: LearnerProfile = { gender: null, name: '' };

/** Fallback names used until the learner types their own. */
export const DEFAULT_NAMES: Record<Gender, { latin: string; he: string }> = {
  m: { latin: 'Dawid', he: 'דוד' },
  f: { latin: 'Anna', he: 'אנה' },
};

/** Which representation a template string belongs to – decides how {name} is rendered. */
export type TemplateField = 'polish' | 'syllables' | 'phoneticHe' | 'phoneticEn' | 'he' | 'en';

const PAIR = /\{([^{}|]*)\|([^{}|]*)\}/g;
const NAME = /\{name\}/g;

export const effectiveGender = (p: LearnerProfile): Gender => p.gender ?? 'm';
export const otherGender = (g: Gender): Gender => (g === 'm' ? 'f' : 'm');

/** Latin script (including Polish letters), spaces and hyphens only – something the Polish voice can read. */
export function isLatinName(name: string): boolean {
  return /^[A-Za-zÀ-ž' -]+$/.test(name.trim());
}

function capitalize(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase('pl-PL') + w.slice(1))
    .join(' ');
}

/** The name as used inside Polish sentences (Latin letters only, otherwise the default name). */
export function polishName(p: LearnerProfile, gender: Gender = effectiveGender(p)): string {
  return p.name.trim() && isLatinName(p.name) ? capitalize(p.name) : DEFAULT_NAMES[gender].latin;
}

/** The name as shown in Hebrew / English translations. */
export function displayName(p: LearnerProfile, lang: 'he' | 'en', gender: Gender = effectiveGender(p)): string {
  const typed = p.name.trim();
  if (typed && (lang === 'he' || isLatinName(typed))) return isLatinName(typed) ? capitalize(typed) : typed;
  return lang === 'he' ? DEFAULT_NAMES[gender].he : DEFAULT_NAMES[gender].latin;
}

export function hasTemplate(text: string | undefined): boolean {
  return !!text && (/\{name\}/.test(text) || /\{[^{}|]*\|[^{}|]*\}/.test(text));
}

/** True when the masculine and feminine resolutions differ. */
export function hasGenderPair(text: string | undefined): boolean {
  return !!text && /\{[^{}|]*\|[^{}|]*\}/.test(text);
}

function renderName(name: string, field: TemplateField, p: LearnerProfile, gender: Gender): string {
  switch (field) {
    case 'syllables':
      return toSyllableNotation(name);
    case 'phoneticHe':
      return toHebrewPhonetic(name);
    case 'phoneticEn':
      return toEnglishPhonetic(name);
    case 'he':
      return displayName(p, 'he', gender);
    case 'en':
      return displayName(p, 'en', gender);
    default:
      return name;
  }
}

/** Resolve a template for a profile. `gender` overrides the profile's gender (used for the "other form" note). */
export function personalize(text: string, p: LearnerProfile, field: TemplateField = 'polish', gender: Gender = effectiveGender(p)): string {
  if (!text || !text.includes('{')) return text;
  const name = polishName(p, gender);
  return text.replace(PAIR, (_m, a: string, b: string) => (gender === 'm' ? a : b)).replace(NAME, () => renderName(name, field, p, gender));
}
