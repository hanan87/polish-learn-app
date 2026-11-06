import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_ITEMS, applyProfile, GENDERED_ITEM_IDS, getItem, getSituation, UNITS } from '../../src/data';
import { ROLEPLAYS } from '../../src/data/dialogues';
import { LESSONS } from '../../src/data/lessons';
import { lookupWord, splitEnding, STORIES, wordKey } from '../../src/data/stories';
import { KASIA_COMPLIMENTS, KASIA_DEDICATION, KASIA_TITLE } from '../../src/components/KasiaAngel';
import { BLITZ_SECONDS, blitzPool, comboMultiplier } from '../../src/lib/blitz';
import { handsFreeQueue } from '../../src/lib/handsFreeQueue';
import { haptic, setHapticsEnabled } from '../../src/lib/haptics';
import { DEFAULT_PROFILE, displayName, hasGenderPair, isLatinName, personalize, polishName, type LearnerProfile } from '../../src/lib/personalize';
import { notationToPlain, parseSyllables } from '../../src/lib/syllables';
import { normalize } from '../../src/lib/text';
import { initialState, migrate, reducer, XP } from '../../src/state/ProgressContext';

const strip = (s: string) => normalize(s).replace(/\s+/g, ' ');
const MALE: LearnerProfile = { gender: 'm', name: '' };
const FEMALE: LearnerProfile = { gender: 'f', name: '' };
const NAMED: LearnerProfile = { gender: 'f', name: 'kasia' };

afterEach(() => applyProfile(DEFAULT_PROFILE));

describe('personalization templates', () => {
  it('resolves {masculine|feminine} pairs and {name}', () => {
    expect(personalize('Zgubił{em|am} paszport', MALE)).toBe('Zgubiłem paszport');
    expect(personalize('Zgubił{em|am} paszport', FEMALE)).toBe('Zgubiłam paszport');
    expect(personalize('Mam na imię {name}', NAMED)).toBe('Mam na imię Kasia');
    expect(personalize('Mam na imię {name}', MALE)).toBe('Mam na imię Dawid');
    expect(personalize('Mam na imię {name}', FEMALE)).toBe('Mam na imię Anna');
    // The "other form" note can resolve the opposite gender explicitly.
    expect(personalize('Jestem gotow{y|a}', MALE, 'polish', 'f')).toBe('Jestem gotowa');
  });

  it('renders the name per field (syllables / phonetics / translations)', () => {
    expect(personalize('[mam] na [i]·mię {name}', NAMED, 'syllables')).toContain('[Ka]·sia');
    expect(personalize('{name}', NAMED, 'phoneticHe')).toMatch(/[֐-׿]/);
    expect(personalize('{name}', NAMED, 'phoneticEn')).not.toMatch(/[֐-׿]/);
  });

  it('keeps Polish sentences readable for non-Latin names', () => {
    const he: LearnerProfile = { gender: 'm', name: 'חנן' };
    expect(isLatinName('Hanan')).toBe(true);
    expect(isLatinName('חנן')).toBe(false);
    expect(polishName(he)).toBe('Dawid');
    expect(displayName(he, 'he')).toBe('חנן');
    expect(displayName(he, 'en')).toBe('Dawid');
    expect(polishName({ gender: 'f', name: 'joanna maria' })).toBe('Joanna Maria');
  });

  it('defaults to masculine forms until a gender is chosen', () => {
    expect(personalize('Był{em|am}', DEFAULT_PROFILE)).toBe('Byłem');
    expect(hasGenderPair('Był{em|am}')).toBe(true);
    expect(hasGenderPair('Mam na imię {name}')).toBe(false);
  });
});

describe('gendered course items', () => {
  it('has gender-dependent items in units 2, 7 and 8', () => {
    for (const id of ['u2-15', 'u7-06', 'u7-07', 'u7-11', 'u8-11', 'u8-12']) expect(GENDERED_ITEM_IDS, id).toContain(id);
  });

  it('switches every gendered item and its "other side" note with the profile', () => {
    applyProfile(MALE);
    expect(getItem('u7-07')!.polish).toBe('Zgubiłem paszport');
    expect(getItem('u2-15')!.polish).toBe('Chciałbym się przedstawić');
    expect(getItem('u7-07')!.genderAlt).toMatchObject({ gender: 'f', polish: 'Zgubiłam paszport' });
    expect(getItem('u8-05')!.hebrew).toBe('אני מאוד אוהב את פולין');

    applyProfile(FEMALE);
    expect(getItem('u7-07')!.polish).toBe('Zgubiłam paszport');
    expect(getItem('u7-06')!.polish).toBe('Jestem uczulona na orzechy');
    expect(getItem('u8-11')!.polish).toBe('Jestem gotowa');
    expect(getItem('u2-15')!.polish).toBe('Chciałabym się przedstawić');
    expect(getItem('u2-15')!.syllablesPolish.startsWith('[chcia]·ła·bym')).toBe(true);
    expect(getItem('u7-07')!.genderAlt).toMatchObject({ gender: 'm', polish: 'Zgubiłem paszport' });
    expect(getItem('u8-05')!.hebrew).toBe('אני מאוד אוהבת את פולין');
    // The same object is shared by UNITS / ALL_ITEMS, so every screen sees the learner's form.
    expect(UNITS.find((u) => u.id === 'u7')!.items.find((i) => i.id === 'u7-07')!.polish).toBe('Zgubiłam paszport');
    expect(getSituation(getItem('u8-11')!, 'he')).toContain('מוכנה');
  });

  it('puts the learner name into "Mam na imię…" in every representation', () => {
    applyProfile(NAMED);
    const item = getItem('u2-11')!;
    expect(item.polish).toBe('Mam na imię Kasia');
    expect(item.hebrew).toBe('קוראים לי Kasia');
    expect(item.backchainingSteps).toEqual(['Kasia', 'imię Kasia', 'Mam na imię Kasia']);
    expect(strip(notationToPlain(item.syllablesPolish))).toBe(strip(item.polish));
  });

  for (const profile of [MALE, FEMALE, NAMED]) {
    it(`keeps every item consistent for ${profile.gender}${profile.name ? ' + name' : ''}`, () => {
      applyProfile(profile);
      for (const item of ALL_ITEMS) {
        const all = [item.polish, item.syllablesPolish, item.hebrew, item.english, item.phoneticHebrew, item.phoneticEnglish, ...item.backchainingSteps];
        for (const text of all) expect(text, item.id).not.toMatch(/[{}|]/);
        expect(strip(notationToPlain(item.syllablesPolish)), item.id).toBe(strip(item.polish));
        expect(strip(item.backchainingSteps[2]), item.id).toBe(strip(item.polish));
      }
    });
  }

  it('resolves every roleplay template for both genders', () => {
    for (const profile of [MALE, FEMALE, NAMED]) {
      for (const r of ROLEPLAYS) {
        const texts = [r.setting.he, r.setting.en, ...r.turns.flatMap((t) => [t.line.polish, t.line.t.he, t.line.t.en, ...t.options.flatMap((o) => [o.polish, o.t.he, o.t.en, o.feedback.he, o.feedback.en])])];
        for (const t of texts) expect(personalize(t, profile, 'polish')).not.toMatch(/[{}]/);
      }
    }
    const meeting = ROLEPLAYS.find((r) => r.id === 'meeting')!;
    expect(personalize(meeting.turns[1].line.polish, FEMALE)).toBe('Miło mi. Skąd Pani jest?');
    expect(personalize(meeting.turns[2].options[0].polish, FEMALE)).toBe('Jestem programistką.');
  });

  it('adds the new items to lessons without losing any', () => {
    const covered = LESSONS.flatMap((l) => l.itemIds);
    expect(covered.sort()).toEqual(ALL_ITEMS.map((i) => i.id).sort());
  });
});

describe('hand-checked transcription quality in units 5–8', () => {
  const shape = (notation: string) => parseSyllables(notation).map((w) => `${w.length}:${w.findIndex((s) => s.stressed)}`);
  for (const profile of [MALE, FEMALE]) {
    it(`syllables, Hebrew and English transcriptions line up word by word (${profile.gender})`, () => {
      applyProfile(profile);
      for (const unit of UNITS.filter((u) => ['u5', 'u6', 'u7', 'u8'].includes(u.id))) {
        for (const item of unit.items) {
          const pl = shape(item.syllablesPolish);
          expect(shape(item.phoneticHebrew), `${item.id} Hebrew`).toEqual(pl);
          expect(shape(item.phoneticEnglish), `${item.id} English`).toEqual(pl);
          // Every multi-syllable word carries exactly one stressed syllable.
          for (const w of parseSyllables(item.syllablesPolish)) if (w.length > 1) expect(w.filter((s) => s.stressed), `${item.id}`).toHaveLength(1);
        }
      }
    });
  }

  it('fixes the known syllable splits and stress positions', () => {
    const syl = (id: string) => getItem(id)!.syllablesPolish;
    expect(syl('u5-01')).toContain('kosz·[tu]·je');
    expect(syl('u5-04')).toContain('go·[tów]·ką');
    expect(syl('u6-04')).toContain('au·[to]·bus');
    expect(syl('u6-08')).toContain('re·zer·[wa]·cję');
    expect(syl('u7-03')).toContain('ap·[te]·ka');
    expect(syl('u7-08')).toContain('po·[li]·cję');
    expect(syl('u8-08')).toContain('pow·[tó]·rzyć');
    // Units 5–8 use the same Hebrew conventions as units 1–4 (geresh before niqqud).
    expect(getItem('u5-05')!.phoneticHebrew).toContain('גְּג׳ֶה');
    expect(getItem('u5-05')!.phoneticHebrew).toBe('[גְּג׳ֶה] [יֶסְט] [קָא]·סָה?');
  });
});

describe('mini stories', () => {
  it('has 4 stories of 6–8 lines with 2 questions each (exactly one correct answer)', () => {
    expect(STORIES).toHaveLength(4);
    for (const s of STORIES) {
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(6);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(8);
      expect(s.questions).toHaveLength(2);
      for (const q of s.questions) expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('can explain every single word of every story', () => {
    for (const s of STORIES) {
      for (const line of s.lines) {
        for (const token of line.polish.split(/\s+/)) {
          if (!wordKey(token)) continue;
          expect(lookupWord(s, token), `${s.id}: "${token}"`).toBeTruthy();
        }
      }
    }
  });

  it('explains inflected forms with the dictionary form and a note', () => {
    const kawa = STORIES[0];
    expect(lookupWord(kawa, 'kawę')).toMatchObject({ base: 'kawa' });
    expect(lookupWord(kawa, 'mlekiem.')!.note!.en).toMatch(/instrumental/);
    expect(splitEnding('kawa', 'kawę')).toEqual({ stem: 'kaw', baseEnd: 'a', formEnd: 'ę' });
    expect(splitEnding('mleko', 'mlekiem')).toEqual({ stem: 'mlek', baseEnd: 'o', formEnd: 'iem' });
    expect(wordKey('„nie')).toBe('nie');
    expect(wordKey('Kraków.')).toBe('kraków');
  });

  it('keeps RTL notes readable: Latin "base → form" runs use a left-to-right arrow', () => {
    for (const s of STORIES) {
      for (const e of Object.values(s.glossary)) {
        if (e.note) expect(e.note.he, e.note.he).not.toMatch(/[a-ząćęłńóśźż]+ ← [a-ząćęłńóśźż]+/i);
      }
    }
  });
});

describe('Speed Blitz and hands-free queue', () => {
  it('lasts 60 seconds and rewards combos', () => {
    expect(BLITZ_SECONDS).toBe(60);
    expect([1, 4, 5, 9, 10, 25].map(comboMultiplier)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('plays learned words, falling back to the first units for new learners', () => {
    expect(blitzPool([]).length).toBeGreaterThanOrEqual(20);
    const learned = ['u3-01', 'u3-02', 'u3-03', 'u3-04', 'u3-05', 'u3-06'];
    expect(blitzPool(learned).map((i) => i.id)).toEqual(learned);
  });

  it('builds the hands-free queue from the active unit or the weakest learned words', () => {
    const fromMap = handsFreeQueue('map', [], () => 0, new Set());
    expect(fromMap.map((i) => i.id)).toEqual(UNITS[0].items.map((i) => i.id));
    const learned = ['u2-01', 'u2-02', 'u2-03'];
    const weak = handsFreeQueue('vocab', learned, (id) => (id === 'u2-03' ? 5 : 1), new Set());
    expect(weak[0].id).toBe('u2-03');
    expect(weak).toHaveLength(3);
  });
});

describe('progress state for stage 6', () => {
  it('stores profile, haptics, Blitz record and stories – and awards XP', () => {
    let s = initialState();
    s = reducer(s, { type: 'profile', profile: { gender: 'f', name: 'Kasia' } });
    expect(s.profile).toEqual({ gender: 'f', name: 'Kasia' });
    s = reducer(s, { type: 'haptics', on: false });
    expect(s.prefs.haptics).toBe(false);
    s = reducer(s, { type: 'blitz', score: 17 });
    s = reducer(s, { type: 'blitz', score: 9 });
    expect(s.blitz).toEqual({ best: 17, plays: 2 });
    const xpBefore = s.xp;
    s = reducer(s, { type: 'story', id: 'parasol', correct: 2, total: 2 });
    expect(s.xp - xpBefore).toBe(XP.storyComplete + 2 * XP.storyQuestion);
    expect(s.stories.parasol.bestCorrect).toBe(2);
  });

  it('migrates older saves and backups with the new defaults', () => {
    const old = { version: 2, xp: 40, items: {}, lessons: {}, dialogues: {} };
    const m = migrate(old)!;
    expect(m.profile).toEqual(DEFAULT_PROFILE);
    expect(m.prefs.haptics).toBe(true);
    expect(m.blitz).toEqual({ best: 0, plays: 0 });
    expect(m.stories).toEqual({});
    expect(m.xp).toBe(40);
  });
});

describe('haptics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setHapticsEnabled(true);
  });

  it('vibrates only when supported and enabled, and never throws', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    haptic('tap');
    expect(vibrate).toHaveBeenCalledTimes(1);
    setHapticsEnabled(false);
    haptic('error');
    expect(vibrate).toHaveBeenCalledTimes(1);
    setHapticsEnabled(true);
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(() => haptic('success')).not.toThrow();
    vi.stubGlobal('navigator', {});
    expect(() => haptic('start')).not.toThrow();
  });
});

describe('Dla Kasi', () => {
  it('has the dedication, the title and 8 translated compliments', () => {
    expect(KASIA_TITLE.pl).toBe('Kasiu, jesteś moim małym aniołkiem');
    expect(KASIA_DEDICATION.pl).toContain('Jesteś moim najpiękniejszym powodem do nauki!');
    expect(KASIA_COMPLIMENTS).toHaveLength(8);
    expect(KASIA_COMPLIMENTS.some((c) => c.pl === 'Kasieńko, kocham Cię najbardziej na świecie.')).toBe(true);
    for (const c of KASIA_COMPLIMENTS) {
      expect(c.he).toMatch(/[֐-׿]/);
      expect(c.en).not.toMatch(/[֐-׿]/);
    }
    expect(new Set(KASIA_COMPLIMENTS.map((c) => c.pl)).size).toBe(8);
  });
});
