/**
 * Rule-based Polish phonetics used for user-added words and for sound tracking:
 *   - grapheme tokenizer (digraphs, softening "i")
 *   - syllabification with penultimate stress, in the dataset notation "prze·[pra]·szam"
 *   - vocalized Hebrew transcription following the app's legend, including devoicing
 *   - detection of the "challenging sounds" contained in a text
 *   - automatic backchaining steps and articulation tips
 * Output is a best-effort suggestion; the add-word form lets the learner edit it.
 */

import { SOUND_INFO, type SoundKey } from '../data/sounds';

const VOWELS = new Set(['a', 'ą', 'e', 'ę', 'i', 'o', 'ó', 'u', 'y']);
const DIGRAPHS = ['dź', 'dż', 'dz', 'ch', 'cz', 'rz', 'sz'];
const SONORANTS = new Set(['r', 'l', 'ł', 'm', 'n', 'ń', 'j']);
const VOICELESS = new Set(['p', 't', 'k', 'f', 's', 'sz', 'ś', 'c', 'cz', 'ć', 'ch', 'h']);
const SOFTENABLE: Record<string, string> = { s: 'ś', c: 'ć', z: 'ź', n: 'ń', dz: 'dź' };
const DEVOICE: Record<string, string> = { b: 'p', d: 't', g: 'k', w: 'f', z: 's', ż: 'sz', rz: 'sz', dz: 'c', dż: 'cz', dź: 'ć', ź: 'ś' };
const CLITICS = new Set(['w', 'z', 'we', 'ze', 'na', 'do', 'i', 'a', 'o', 'u', 'się', 'nie', 'to', 'mi', 'ci', 'go', 'mu', 'czy', 'dla', 'od', 'po', 'przy', 'za', 'bez']);

export interface Token {
  /** Lowercase grapheme as spelled: "sz", "a", "rz"… */
  g: string;
  /** Original text (keeps casing; a softening "i" is merged into the consonant). */
  orig: string;
  vowel: boolean;
  /** Consonant is palatal (ś/ć/ź/ń/dź or followed by a softening i). */
  soft: boolean;
  /** Effective phoneme after softening and devoicing (consonants only). */
  e: string;
}

interface Word {
  lead: string;
  trail: string;
  tokens: Token[];
}

function tokenizeCore(word: string): Token[] {
  const lower = word.toLocaleLowerCase('pl-PL');
  const toks: Token[] = [];
  let i = 0;
  while (i < lower.length) {
    const two = lower.slice(i, i + 2);
    const g = DIGRAPHS.includes(two) ? two : lower[i];
    const orig = word.slice(i, i + g.length);
    i += g.length;
    const prev = toks[toks.length - 1];
    if (VOWELS.has(g)) {
      if (g === 'i' && prev && !prev.vowel) {
        prev.soft = true;
        // Consonant + i + vowel: the i only marks softness and is not a syllable nucleus.
        if (i < lower.length && VOWELS.has(lower[i])) {
          prev.orig += orig;
          continue;
        }
      }
      toks.push({ g, orig, vowel: true, soft: false, e: g });
    } else {
      toks.push({ g, orig, vowel: false, soft: ['ś', 'ć', 'ź', 'ń', 'dź'].includes(g), e: g });
    }
  }
  for (const t of toks) if (!t.vowel && t.soft && SOFTENABLE[t.g]) t.e = SOFTENABLE[t.g];
  return toks;
}

function splitWords(text: string): Word[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/^([^\p{L}]*)(.*?)([^\p{L}]*)$/u)!;
      return { lead: m[1], trail: m[3], tokens: tokenizeCore(m[2]) };
    });
}

/** Regressive and progressive voicing assimilation across the phrase. */
function applyDevoicing(words: Word[]): void {
  words.forEach((word, wi) => {
    const toks = word.tokens;
    const isVowelless = toks.length > 0 && toks.every((t) => !t.vowel);
    const nextWordFirst = words[wi + 1]?.tokens[0];
    for (let i = toks.length - 1; i >= 0; i--) {
      const t = toks[i];
      if (t.vowel) continue;
      const next = toks[i + 1];
      let devoice = false;
      if (!next) {
        // Single-consonant prepositions (w, z) assimilate to the next word; other word-final consonants devoice.
        devoice = isVowelless ? !!nextWordFirst && !nextWordFirst.vowel && VOICELESS.has(nextWordFirst.e) : true;
      } else if (!next.vowel && VOICELESS.has(next.e)) {
        devoice = true;
      }
      if (devoice && DEVOICE[t.e]) t.e = DEVOICE[t.e];
    }
    // Progressive: w and rz after a voiceless consonant (twój -> tfuj, przy -> pszy).
    for (let i = 1; i < toks.length; i++) {
      const t = toks[i];
      const prev = toks[i - 1];
      if (!prev.vowel && VOICELESS.has(prev.e) && (t.g === 'w' || t.g === 'rz') && !t.vowel) {
        t.e = DEVOICE[t.g];
      }
    }
  });
}

function syllabify(toks: Token[]): Token[][] {
  const nuclei = toks.map((t, i) => (t.vowel ? i : -1)).filter((i) => i >= 0);
  if (nuclei.length === 0) return toks.length ? [toks] : [];
  const sylls: Token[][] = [];
  let start = 0;
  for (let n = 0; n < nuclei.length; n++) {
    const v = nuclei[n];
    const nextV = nuclei[n + 1];
    if (nextV === undefined) {
      sylls.push(toks.slice(start));
      break;
    }
    const consonants = nextV - v - 1;
    // One consonant opens the next syllable. A cluster splits after its first consonant when that one is
    // a sonorant (kar·ta) or when the next one is a nasal/j, which cannot follow an obstruent in an onset (smacz·nej).
    const splitAfterFirst =
      consonants >= 2 && (SONORANTS.has(toks[v + 1].g) || ['n', 'ń', 'm', 'j'].includes(toks[v + 2].g));
    const cut = splitAfterFirst ? v + 2 : v + 1;
    sylls.push(toks.slice(start, cut));
    start = cut;
  }
  return sylls;
}

function stressIndex(sylls: Token[][], wordLower: string): number {
  if (sylls.length === 0) return -1;
  if (sylls.length === 1) return CLITICS.has(wordLower) || sylls[0].every((t) => !t.vowel) ? -1 : 0;
  return sylls.length - 2;
}

interface Analysis {
  words: { word: Word; sylls: Token[][]; stress: number }[];
}

export function analyze(text: string): Analysis {
  const words = splitWords(text);
  applyDevoicing(words);
  return {
    words: words.map((word) => {
      const sylls = syllabify(word.tokens);
      const lower = word.tokens.map((t) => t.orig).join('').toLocaleLowerCase('pl-PL');
      return { word, sylls, stress: stressIndex(sylls, lower) };
    }),
  };
}

/** Syllable notation with the stressed syllable in brackets: "prze·[pra]·szam". */
export function toSyllableNotation(text: string): string {
  return analyze(text)
    .words.map(({ word, sylls, stress }) => {
      const parts = sylls.map((s, i) => {
        const t = s.map((tok) => tok.orig).join('');
        return i === stress ? `[${t}]` : t;
      });
      return word.lead + parts.join('·') + word.trail;
    })
    .join(' ');
}

// ---------- Hebrew transcription ----------

const SHVA = 'ְ';
const HE: Record<string, [string, string]> = {
  b: ['בּ', ''],
  p: ['פּ', ''],
  c: ['צ', ''],
  ch: ['ח', ''],
  h: ['ח', ''],
  cz: ['צ', '׳'],
  ć: ['צ', '׳'],
  d: ['ד', ''],
  t: ['ט', ''],
  dz: ['דְז', ''],
  dż: ['ג', '׳'],
  dź: ['ג', '׳'],
  f: ['פ', ''],
  g: ['ג', ''],
  k: ['ק', ''],
  j: ['י', ''],
  l: ['ל', ''],
  ł: ['וו', ''],
  m: ['מ', ''],
  n: ['נ', ''],
  ń: ['נ', ''],
  r: ['ר', ''],
  rz: ['ז', '׳'],
  ż: ['ז', '׳'],
  ź: ['ז', '׳'],
  s: ['ס', ''],
  sz: ['שׁ', ''],
  ś: ['שׁ', ''],
  w: ['ב', ''],
  v: ['ב', ''],
  z: ['ז', ''],
  x: ['קס', ''],
  q: ['ק', ''],
};
const FINAL_FORMS: Record<string, string> = { מ: 'ם', נ: 'ן', צ: 'ץ', פ: 'ף' };

function consonantParts(t: Token): [string, string] {
  return HE[t.e] ?? HE[t.g] ?? [t.g, ''];
}

function finalForm([base, suffix]: [string, string]): string {
  const last = base.slice(-1);
  return (FINAL_FORMS[last] ? base.slice(0, -1) + FINAL_FORMS[last] : base) + suffix;
}

/** Whether a soft consonant needs an audible "י" glide before the following vowel. */
function needsGlide(t: Token, vowel: string): boolean {
  if (!t.soft || vowel === 'i' || vowel === 'y') return false;
  return t.e !== 'dź' && t.e !== 'dż';
}

function renderVowel(v: string, c: [string, string] | null, syllFinal: boolean, wordFinal: boolean): string {
  const [base, suffix] = c ?? ['א', ''];
  switch (v) {
    case 'a':
      return base + 'ָ' + suffix + (wordFinal ? 'ה' : 'א');
    case 'e':
      return base + 'ֶ' + suffix + (syllFinal ? 'ה' : '');
    case 'i':
      return base + 'ִ' + suffix + 'י';
    case 'y':
      return base + 'ִ' + suffix;
    case 'o':
      return (base === 'וו' ? 'ו' : base) + suffix + 'וֹ';
    case 'u':
    case 'ó':
      return (base === 'וו' ? 'ו' : base) + suffix + 'וּ';
    case 'ą':
      return (base === 'וו' ? 'ו' : base) + suffix + 'וֹ' + (wordFinal ? 'ן' : 'נ' + SHVA);
    case 'ę':
      return base + 'ֶ' + suffix + (wordFinal ? 'ה' : 'נ' + SHVA);
    default:
      return base + suffix;
  }
}

function renderSyllable(syll: Token[], isLastSyll: boolean): string {
  let out = '';
  // One-letter prepositions (w, z) are glued to the next word, so they never take a final letter form.
  const vowelless = syll.every((t) => !t.vowel);
  if (vowelless) return syll.map((t) => consonantParts(t).join('')).join('');
  const nucleus = syll.findIndex((t) => t.vowel);
  for (let i = 0; i < syll.length; i++) {
    const t = syll[i];
    if (t.vowel) {
      if (i > 0 && !syll[i - 1].vowel) continue; // rendered together with its consonant
      out += renderVowel(t.g, null, i === syll.length - 1, isLastSyll && i === syll.length - 1);
      continue;
    }
    const next = syll[i + 1];
    const parts = consonantParts(t);
    if (next?.vowel) {
      const syllFinal = i + 1 === syll.length - 1;
      const wordFinal = isLastSyll && syllFinal;
      if (needsGlide(t, next.g)) {
        out += parts[0] + SHVA + parts[1] + renderVowel(next.g, ['י', ''], syllFinal, wordFinal);
      } else {
        out += renderVowel(next.g, parts, syllFinal, wordFinal);
      }
    } else if (nucleus === -1 || i < nucleus) {
      // Onset cluster consonant: no vowel of its own.
      out += isLastSyll && i === syll.length - 1 ? finalForm(parts) : parts[0] + SHVA + parts[1];
    } else {
      // Coda consonant.
      out += isLastSyll && i === syll.length - 1 ? finalForm(parts) : parts[0] + parts[1];
    }
  }
  return out;
}

/** Vocalized Hebrew transcription in the dataset notation: "פְּשֶׁה·[פְּרָא]·שָׁם". */
export function toHebrewPhonetic(text: string): string {
  return analyze(text)
    .words.map(({ word, sylls, stress }) => {
      const parts = sylls.map((s, i) => {
        const h = renderSyllable(s, i === sylls.length - 1);
        return i === stress ? `[${h}]` : h;
      });
      const trail = word.trail.replace(/[^?!]/g, '');
      return parts.join('·') + trail;
    })
    .join(' ');
}

// ---------- English respelling ----------

const EN_CONS: Record<string, string> = {
  b: 'b',
  p: 'p',
  c: 'ts',
  ch: 'kh',
  h: 'kh',
  cz: 'ch',
  ć: 'ch',
  d: 'd',
  t: 't',
  dz: 'dz',
  dż: 'j',
  dź: 'j',
  f: 'f',
  g: 'g',
  k: 'k',
  j: 'y',
  l: 'l',
  ł: 'w',
  m: 'm',
  n: 'n',
  ń: 'n',
  r: 'r',
  rz: 'zh',
  ż: 'zh',
  ź: 'zh',
  s: 's',
  sz: 'sh',
  ś: 'sh',
  w: 'v',
  v: 'v',
  z: 'z',
  x: 'ks',
  q: 'k',
};

function enVowel(v: string, wordFinal: boolean): string {
  switch (v) {
    case 'a':
      return 'ah';
    case 'e':
      return 'eh';
    case 'i':
      return 'ee';
    case 'y':
      return 'ih';
    case 'o':
      return 'oh';
    case 'u':
    case 'ó':
      return 'oo';
    case 'ą':
      return wordFinal ? 'ohn' : 'on';
    case 'ę':
      return wordFinal ? 'eh' : 'en';
    default:
      return v;
  }
}

function renderSyllableEn(syll: Token[], isLastSyll: boolean): string {
  let out = '';
  for (let i = 0; i < syll.length; i++) {
    const t = syll[i];
    const wordFinal = isLastSyll && i === syll.length - 1;
    if (t.vowel) {
      out += enVowel(t.g, wordFinal);
      continue;
    }
    out += EN_CONS[t.e] ?? EN_CONS[t.g] ?? t.g;
    const next = syll[i + 1];
    // Soft consonant before a vowel other than i gets an audible "y" glide: nie -> nyeh.
    if (next?.vowel && needsGlide(t, next.g)) out += 'y';
  }
  // Syllable-final j after a vowel reads as an English diphthong: dzisiaj -> "shyai", cznej -> "chney".
  return out.replace(/ahy$/, 'ai').replace(/ehy$/, 'ey').replace(/ohy$/, 'oy').replace(/ooy$/, 'ooy');
}

/** English-speaker respelling in the dataset notation, e.g. "jen·[koo]·yeh". The UI upper-cases the stressed syllable. */
export function toEnglishPhonetic(text: string): string {
  return analyze(text)
    .words.map(({ word, sylls, stress }) => {
      const parts = sylls.map((s, i) => {
        const h = renderSyllableEn(s, i === sylls.length - 1);
        return i === stress ? `[${h}]` : h;
      });
      const trail = word.trail.replace(/[^?!]/g, '');
      return parts.join('·') + trail;
    })
    .join(' ');
}

// ---------- Sound detection ----------

function tokenSound(t: Token): SoundKey | null {
  if (t.vowel) return t.g === 'ą' || t.g === 'ę' || t.g === 'y' ? (t.g as SoundKey) : null;
  switch (t.g) {
    case 'sz':
      return 'sz';
    case 'cz':
      return 'cz';
    case 'ż':
    case 'rz':
      return 'ż/rz';
    case 'ś':
      return 'ś';
    case 'ć':
      return 'ć';
    case 'ź':
      return 'ź';
    case 'dź':
      return 'dź';
    case 'ń':
      return 'ń';
    case 'ł':
      return 'ł';
    case 'w':
      return 'w';
    case 'ch':
    case 'h':
      return 'ch';
    case 's':
      return t.soft ? 'ś' : null;
    case 'c':
      return t.soft ? 'ć' : null;
    case 'z':
      return t.soft ? 'ź' : null;
    case 'n':
      return t.soft ? 'ń' : null;
    case 'dz':
      return t.soft ? 'dź' : null;
    default:
      return null;
  }
}

/** Challenging sounds present in a Polish text (unique). */
export function detectSounds(text: string): SoundKey[] {
  const set = new Set<SoundKey>();
  for (const word of splitWords(text)) {
    for (const t of word.tokens) {
      const s = tokenSound(t);
      if (s) set.add(s);
    }
  }
  return [...set];
}

/** Map a single Polish letter (from a diacritic mistake) to its sound key. */
export function letterSound(letter: string): SoundKey | null {
  const map: Record<string, SoundKey> = { ą: 'ą', ę: 'ę', ł: 'ł', ś: 'ś', ć: 'ć', ź: 'ź', ż: 'ż/rz', ń: 'ń' };
  return map[letter.toLocaleLowerCase('pl-PL')] ?? null;
}

// ---------- Generated helpers for user-added items ----------

/** Three backchaining steps from the end of the phrase to the full phrase. */
export function autoBackchain(text: string): [string, string, string] {
  const clean = text.trim().replace(/[.,!?]+$/, '');
  const words = clean.split(/\s+/);
  if (words.length >= 3) {
    return [words[words.length - 1], words.slice(-2).join(' '), clean];
  }
  const { words: analyzed } = analyze(clean);
  const sylls = analyzed.flatMap((w, wi) => w.sylls.map((s, si) => (si === 0 && wi > 0 ? ' ' : '') + s.map((t) => t.orig).join('')));
  if (sylls.length >= 3) {
    const half = Math.max(2, Math.ceil(sylls.length / 2));
    return [sylls[sylls.length - 1].trim(), sylls.slice(-half).join('').trim(), clean];
  }
  if (sylls.length === 2) {
    // Two syllables: last syllable, then from the first vowel, then the whole word (Ka·sia -> sia, asia, Kasia).
    const firstVowel = clean.search(/[aąeęioóuy]/i);
    const step2 = firstVowel > 0 ? clean.slice(firstVowel) : clean.slice(1);
    return [sylls[1].trim(), step2, clean];
  }
  // One syllable: the rime, then drop only the first sound, then the whole word (trzy -> y, rzy, trzy).
  const toks = analyzed[0]?.word.tokens ?? [];
  const nucleus = toks.findIndex((t) => t.vowel);
  const rime = nucleus >= 0 ? toks.slice(nucleus).map((t) => t.orig).join('') : clean.slice(-1);
  const tail = toks.slice(1).map((t) => t.orig).join('') || clean;
  return [rime, tail === rime ? clean.slice(Math.max(0, clean.length - rime.length - 1)) : tail, clean];
}

/** Articulation tip assembled from the sounds in the text, plus stress and devoicing notes. */
export function autoTip(text: string, lang: 'he' | 'en' = 'he'): string {
  const sounds = detectSounds(text);
  const parts = sounds.slice(0, 3).map((s) => (lang === 'he' ? SOUND_INFO[s].tip : SOUND_INFO[s].tipEn));
  const notation = toSyllableNotation(text);
  const stressed = [...notation.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  if (stressed.length) parts.push(lang === 'he' ? `ההטעמה על: ${stressed.join(', ')}.` : `Stress on: ${stressed.join(', ')}.`);
  const devoiced = analyze(text).words.some((w) => w.word.tokens.some((t) => !t.vowel && t.e !== t.g && !t.soft));
  if (devoiced)
    parts.push(
      lang === 'he'
        ? 'שימו לב לאיבוד קוליות: עיצור קולי לפני עיצור אטום או בסוף מילה נהגה אטום.'
        : 'Watch the devoicing: a voiced consonant before a voiceless one or at the end of a word is pronounced voiceless.',
    );
  return parts.join(' ') || (lang === 'he' ? 'הקשיבו לדובר וחזרו לאט, הברה אחר הברה.' : 'Listen to the speaker and repeat slowly, syllable by syllable.');
}
