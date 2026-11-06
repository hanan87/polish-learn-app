/**
 * Text comparison utilities: normalization, Levenshtein distance,
 * word-level pronunciation scoring and Polish diacritic diagnostics.
 */

const DIACRITIC_MAP: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
};

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLocaleLowerCase('pl-PL')
    .replace(/[.,!?;:"„”'«»()\-–—…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripDiacritics(text: string): string {
  return [...text].map((ch) => DIACRITIC_MAP[ch] ?? ch).join('');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similarity in [0, 1] based on Levenshtein distance. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export interface WordResult {
  word: string;
  matched: boolean;
  heard?: string;
  similarity: number;
}

export interface PronunciationResult {
  score: number;
  transcript: string;
  words: WordResult[];
}

const WORD_MATCH_THRESHOLD = 0.75;

/**
 * Score a recognized transcript against the target phrase.
 * The overall score blends whole-string similarity with the share of target words
 * that found a close match in the transcript, so a single garbled word in a long
 * sentence is penalized but does not zero the score.
 */
export function scorePronunciation(target: string, transcript: string): PronunciationResult {
  const targetNorm = normalize(target);
  const heardNorm = normalize(transcript);
  const targetWords = targetNorm.split(' ').filter(Boolean);
  const heardWords = heardNorm.split(' ').filter(Boolean);
  const used = new Set<number>();

  const displayWords = target.split(/\s+/).filter(Boolean);
  const words: WordResult[] = targetWords.map((tw, idx) => {
    let best = -1;
    let bestSim = 0;
    heardWords.forEach((hw, j) => {
      if (used.has(j)) return;
      const sim = similarity(tw, hw);
      if (sim > bestSim) {
        bestSim = sim;
        best = j;
      }
    });
    const matched = bestSim >= WORD_MATCH_THRESHOLD;
    if (matched && best >= 0) used.add(best);
    return {
      word: displayWords[idx] ?? tw,
      matched,
      heard: best >= 0 ? heardWords[best] : undefined,
      similarity: bestSim,
    };
  });

  const charScore = similarity(targetNorm, heardNorm);
  const wordScore = words.length ? words.filter((w) => w.matched).length / words.length : 0;
  const score = Math.round((charScore * 0.6 + wordScore * 0.4) * 100);
  return { score: heardNorm ? score : 0, transcript, words };
}

export const DIACRITIC_EXPLANATIONS: Record<string, { he: string; en: string }> = {
  ą: { he: 'ą היא o אפית ("וֹן") – בלי הסימן, a היא סתם "אָ".', en: 'ą is a nasal o ("on") – without the tail, a is just "ah".' },
  ć: { he: 'ć היא צ׳ רכה (לשון קדימה, חיוך) – בלי הסימן, c היא "צ" רגילה.', en: 'ć is a soft "ch" (tongue forward, smile) – without the accent, c is "ts".' },
  ę: { he: 'ę היא e אפית ("ֶן"; בסוף מילה – e) – בלי הסימן, e רגילה.', en: 'ę is a nasal e ("en"; plain e at the end of a word) – without the tail, a plain e.' },
  ł: { he: 'ł נהגית כמו w באנגלית – בלי הקו, l היא ל׳ רגילה. זה משנה את המילה לגמרי!', en: 'ł sounds like English w – without the stroke, l is a plain l. It changes the word completely!' },
  ń: { he: 'ń היא n רכה ("נְי") – בלי הסימן, n רגילה.', en: 'ń is a soft n ("ny") – without the accent, a plain n.' },
  ó: { he: 'ó נהגית בדיוק כמו u ("וּ") – בלי הסימן, o היא "וֹ".', en: 'ó sounds exactly like u ("oo") – without the accent, o is "oh".' },
  ś: { he: 'ś היא ש׳ רכה (לשון קדימה, חיוך) – בלי הסימן, s היא "ס".', en: 'ś is a soft "sh" (tongue forward, smile) – without the accent, s is a plain s.' },
  ź: { he: 'ź היא ז׳ רכה (לשון קדימה) – בלי הסימן, z היא "ז" רגילה.', en: 'ź is a soft "zh" (tongue forward) – without the accent, z is a plain z.' },
  ż: { he: 'ż היא ז׳ קשה (לשון אחורה, שפתיים מעוגלות) – בלי הנקודה, z היא "ז" רגילה.', en: 'ż is a hard "zh" as in "measure" (tongue back, lips rounded) – without the dot, z is a plain z.' },
};

export interface DiacriticIssue {
  expected: string;
  typed: string;
}

export type WritingVerdict =
  | { kind: 'correct' }
  | { kind: 'diacritics'; issues: DiacriticIssue[] }
  | { kind: 'wrong'; distance: number };

/** Explanation of a single diacritic mistake in the active language. */
export function explainDiacritic(issue: DiacriticIssue, lang: 'he' | 'en'): string {
  const exp = DIACRITIC_EXPLANATIONS[issue.expected]?.[lang];
  if (exp) return exp;
  const typedExp = DIACRITIC_EXPLANATIONS[issue.typed]?.[lang] ?? '';
  return lang === 'he'
    ? `כתבתם ${issue.typed} – אבל כאן צריך ${issue.expected} בלי סימן מיוחד. ${typedExp}`
    : `You typed ${issue.typed} – but here it is a plain ${issue.expected}. ${typedExp}`;
}

/** Compare a typed answer with the expected Polish text. */
export function checkWriting(expected: string, typed: string): WritingVerdict {
  const e = normalize(expected);
  const t = normalize(typed);
  if (e === t) return { kind: 'correct' };

  if (e.length === t.length && stripDiacritics(e) === stripDiacritics(t)) {
    const issues: DiacriticIssue[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < e.length; i++) {
      if (e[i] === t[i]) continue;
      const key = `${e[i]}>${t[i]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({ expected: e[i], typed: t[i] });
    }
    return { kind: 'diacritics', issues };
  }

  return { kind: 'wrong', distance: levenshtein(e, t) };
}
