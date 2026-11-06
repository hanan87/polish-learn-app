/**
 * Parser for the syllable notation used in the dataset:
 *   "prze·[pra]·szam"  ->  [[{text:'prze'}, {text:'pra', stressed:true}, {text:'szam'}]]
 * Words are separated by spaces, syllables by "·", stress is wrapped in [ ].
 */

export interface Syllable {
  text: string;
  stressed: boolean;
}

export type ParsedWord = Syllable[];

export function parseSyllables(notation: string): ParsedWord[] {
  return notation
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split('·')
        .filter((s) => s.length > 0)
        .map((raw) => {
          const match = raw.match(/^(.*)\[(.+)\](.*)$/);
          if (match) {
            // Punctuation may sit outside the brackets, e.g. "[ma]?" – keep it attached but unstressed.
            return [
              ...(match[1] ? [{ text: match[1], stressed: false }] : []),
              { text: match[2], stressed: true },
              ...(match[3] ? [{ text: match[3], stressed: false }] : []),
            ];
          }
          return [{ text: raw, stressed: false }];
        })
        .flat(),
    );
}

/** Returns the plain text of a notation string (brackets and dots removed). */
export function notationToPlain(notation: string): string {
  return notation.replace(/[[\]·]/g, '');
}
