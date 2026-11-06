/**
 * Synthetic transcripts for the recording simulation panel and for spelling distractors.
 * Substitutions mirror typical mistakes of Hebrew and English speakers.
 */
const MISTAKES: [RegExp, string][] = [
  [/ł/, 'l'],
  [/sz/, 's'],
  [/ś/, 'sz'],
  [/cz/, 'c'],
  [/ć/, 'cz'],
  [/rz/, 'r'],
  [/ż/, 'z'],
  [/ą/, 'a'],
  [/ę/, 'en'],
  [/w/, 'ł'],
  [/y/, 'i'],
];

export function mispronounce(target: string): string {
  let out = target.toLocaleLowerCase('pl-PL');
  let applied = 0;
  for (const [pattern, replacement] of MISTAKES) {
    if (pattern.test(out)) {
      out = out.replace(pattern, replacement);
      applied++;
      if (applied >= 2) break;
    }
  }
  if (applied === 0) out = out.slice(0, Math.max(1, out.length - 2));
  return out;
}

export function truncate(target: string): string {
  const words = target.split(/\s+/);
  if (words.length > 1) return words.slice(0, Math.ceil(words.length / 2)).join(' ');
  return target.slice(0, Math.ceil(target.length / 2));
}
