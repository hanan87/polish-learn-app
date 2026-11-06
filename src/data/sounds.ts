/**
 * Sounds tracked for the "challenging sounds" model. Each item text is scanned for these
 * sounds; every pronunciation, writing and listening outcome updates the per-sound stats.
 */

export type SoundKey = 'sz' | 'cz' | 'ż/rz' | 'ś' | 'ć' | 'ź' | 'dź' | 'ń' | 'ł' | 'w' | 'ą' | 'ę' | 'y' | 'ch';

export interface SoundInfo {
  key: SoundKey;
  /** Short Hebrew description of the sound. */
  name: string;
  nameEn: string;
  /** Articulation instruction used in tips and in the weak-sounds panel. */
  tip: string;
  tipEn: string;
  /** Related minimal-pair group in the Sound Lab, if any. */
  groupId?: string;
}

export const SOUND_INFO: Record<SoundKey, SoundInfo> = {
  sz: { key: 'sz', name: 'ש קשה', tip: 'sz: משכו את קצה הלשון אחורה לחך ועגלו את השפתיים.', nameEn: 'hard sh', tipEn: 'sz: pull the tongue tip back to the palate and round the lips.', groupId: 'sz-s' },
  cz: { key: 'cz', name: 'צ׳ קשה', tip: 'cz: לשון משוכה אחורה, שפתיים בולטות – צ׳ "עבה".', nameEn: 'hard ch', tipEn: 'cz: tongue pulled back, lips pushed forward – a "thick" ch.', groupId: 'cz-c' },
  'ż/rz': { key: 'ż/rz', name: 'ז׳ קשה', tip: 'ż / rz: לשון אחורה כמו ב-sz, עם רטט של מיתרי הקול.', nameEn: 'hard zh', tipEn: 'ż / rz: tongue back as for sz, with the vocal cords vibrating.', groupId: 'z-z' },
  ś: { key: 'ś', name: 'ש רכה', tip: 'ś: קצה הלשון מאחורי השיניים התחתונות, גב הלשון מורם, שפתיים בחיוך.', nameEn: 'soft sh', tipEn: 'ś: tongue tip behind the lower teeth, middle of the tongue raised, smiling lips.', groupId: 'sz-s' },
  ć: { key: 'ć', name: 'צ׳ רכה', tip: 'ć: לשון צמודה קדימה, שפתיים בחיוך – צ׳ דקה.', nameEn: 'soft ch', tipEn: 'ć: tongue pressed forward, smiling lips – a thin ch.', groupId: 'cz-c' },
  ź: { key: 'ź', name: 'ז׳ רכה', tip: 'ź: מיקום של ś (לשון קדימה, חיוך) עם רטט קולי.', nameEn: 'soft zh', tipEn: 'ź: the ś position (tongue forward, smile) with voice.' },
  dź: { key: 'dź', name: 'ג׳ רכה', tip: 'dź: ג׳ עם לשון קדימה וחיוך.', nameEn: 'soft j', tipEn: 'dź: a "j" with the tongue forward and a smile.' },
  ń: { key: 'ń', name: 'n רכה', tip: 'ń: n עם גב לשון מורם – כמו "ני" קצרצרה.', nameEn: 'soft n', tipEn: 'ń: n with the middle of the tongue raised – like a tiny "ny".' },
  ł: { key: 'ł', name: 'w אנגלית', tip: 'ł: שפתיים מעוגלות, הלשון לא נוגעת בשיניים – כמו w ב-water.', nameEn: 'English w', tipEn: 'ł: rounded lips, tongue away from the teeth – like w in "water".', groupId: 'l-l' },
  w: { key: 'w', name: 'v', tip: 'w = v: שיניים עליונות על השפה התחתונה. לפני עיצור אטום – f.', nameEn: 'v', tipEn: 'w = v: upper teeth on the lower lip. Before a voiceless consonant – f.', groupId: 'w-l' },
  ą: { key: 'ą', name: 'o אפית', tip: 'ą: אמרו o ותנו לאוויר לעבור גם דרך האף.', nameEn: 'nasal o', tipEn: 'ą: say o and let air flow through the nose as well.', groupId: 'nasal' },
  ę: { key: 'ę', name: 'e אפית', tip: 'ę: e אפית; בסוף מילה – e רגילה.', nameEn: 'nasal e', tipEn: 'ę: a nasal e; at the end of a word – a plain e.', groupId: 'nasal' },
  y: { key: 'y', name: 'i כהה', tip: 'y: i עם לשון נסוגה מעט אחורה – "כהה" יותר מ-i.', nameEn: 'dark i', tipEn: 'y: i with the tongue pulled slightly back – like "i" in "bit".', groupId: 'y-i' },
  ch: { key: 'ch', name: 'ח', tip: 'ch / h: ח רכה מהגרון.', nameEn: 'throaty h', tipEn: 'ch / h: a soft throaty h as in "loch".' },
};

/** Thresholds for marking a sound as needing reinforcement. */
export const WEAK_SOUND_MIN_ATTEMPTS = 3;
export const WEAK_SOUND_ERROR_RATE = 0.35;
export const WEAK_SOUND_MIN_AVG = 75;

/** Sounds exercised by each Sound Lab contrast group. */
export const GROUP_SOUNDS: Record<string, SoundKey[]> = {
  'sz-s': ['sz', 'ś'],
  'cz-c': ['cz', 'ć'],
  'w-l': ['w', 'ł'],
  'l-l': ['ł'],
  'z-z': ['ż/rz'],
  nasal: ['ą', 'ę'],
  'y-i': ['y'],
};
