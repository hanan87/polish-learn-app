import { describe, expect, it } from 'vitest';
import { ALL_ITEMS, getSituation, PHONETIC_LEGEND, UNITS } from '../../src/data';
import { ROLEPLAYS } from '../../src/data/dialogues';
import { LESSONS } from '../../src/data/lessons';
import { CONTRAST_GROUPS } from '../../src/data/minimalPairs';
import { GROUP_SOUNDS, SOUND_INFO } from '../../src/data/sounds';
import { parseSyllables, notationToPlain } from '../../src/lib/syllables';
import { normalize } from '../../src/lib/text';

const strip = (s: string) => normalize(s).replace(/\s+/g, ' ');

describe('course data integrity', () => {
  it('has 8 units with at least 8 items each', () => {
    expect(UNITS).toHaveLength(8);
    for (const u of UNITS) expect(u.items.length, u.id).toBeGreaterThanOrEqual(8);
  });

  it('uses unique item ids', () => {
    const ids = ALL_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ALL_ITEMS.map((i) => [i.id, i] as const))('%s has every bilingual field', (_id, item) => {
    expect(item.polish.trim()).not.toBe('');
    expect(item.hebrew.trim()).not.toBe('');
    expect(item.english.trim()).not.toBe('');
    expect(item.phoneticHebrew.trim()).not.toBe('');
    expect(item.phoneticEnglish.trim()).not.toBe('');
    expect(item.articulationTip.trim()).not.toBe('');
    expect(item.articulationTipEn.trim()).not.toBe('');
    // English text must really be English: no Hebrew letters.
    expect(item.english).not.toMatch(/[֐-׿]/);
    expect(item.articulationTipEn).not.toMatch(/[֐-׿]/);
    if (item.culturalNote) expect(item.culturalNoteEn, 'cultural note needs English').toBeTruthy();
  });

  it.each(ALL_ITEMS.map((i) => [i.id, i] as const))('%s syllable notation matches the Polish text', (_id, item) => {
    expect(strip(notationToPlain(item.syllablesPolish))).toBe(strip(item.polish));
    // Brackets are balanced and every word has at most one stressed syllable.
    expect((item.syllablesPolish.match(/\[/g) ?? []).length).toBe((item.syllablesPolish.match(/\]/g) ?? []).length);
    for (const word of parseSyllables(item.syllablesPolish)) {
      expect(word.filter((s) => s.stressed).length).toBeLessThanOrEqual(1);
    }
    // Multi-syllable content words carry stress somewhere in the phrase.
    if (parseSyllables(item.syllablesPolish).some((w) => w.length > 1)) expect(item.syllablesPolish).toContain('[');
  });

  it.each(ALL_ITEMS.map((i) => [i.id, i] as const))('%s backchaining builds up to the full phrase', (_id, item) => {
    const steps = item.backchainingSteps;
    expect(steps).toHaveLength(3);
    steps.forEach((s) => expect(s.trim()).not.toBe(''));
    expect(strip(steps[2])).toBe(strip(item.polish));
    // Each step is a suffix of the next one (end-to-start building).
    expect(strip(steps[1]).endsWith(strip(steps[0])) || strip(steps[1]).includes(strip(steps[0]))).toBe(true);
  });

  it('gives every item a recall situation in both languages', () => {
    for (const item of ALL_ITEMS) {
      expect(getSituation(item, 'he').trim(), item.id).not.toBe('');
      expect(getSituation(item, 'en'), item.id).not.toMatch(/[֐-׿]/);
    }
  });

  it('covers every course item in exactly one lesson', () => {
    const covered = LESSONS.flatMap((l) => l.itemIds);
    expect(new Set(covered).size).toBe(covered.length);
    expect(covered.sort()).toEqual(ALL_ITEMS.map((i) => i.id).sort());
  });

  it('has complete minimal-pair groups', () => {
    for (const g of CONTRAST_GROUPS) {
      expect(GROUP_SOUNDS[g.id], g.id).toBeTruthy();
      expect(g.descriptionAEn && g.descriptionBEn).toBeTruthy();
      for (const p of g.pairs) {
        for (const w of [p.a, p.b]) {
          expect(strip(notationToPlain(w.syllablesPolish))).toBe(strip(w.polish));
          expect(w.english && w.hebrew && w.phoneticHebrew).toBeTruthy();
        }
      }
    }
  });

  it('links every sound group id to an existing contrast group', () => {
    for (const info of Object.values(SOUND_INFO)) {
      if (info.groupId) expect(CONTRAST_GROUPS.some((g) => g.id === info.groupId), info.key).toBe(true);
      expect(info.tipEn).not.toMatch(/[֐-׿]/);
    }
  });

  it('has 4 roleplays whose every turn has exactly one correct reply among 2–3 options', () => {
    expect(ROLEPLAYS).toHaveLength(4);
    for (const r of ROLEPLAYS) {
      for (const t of r.turns) {
        expect(t.options.length).toBeGreaterThanOrEqual(2);
        expect(t.options.length).toBeLessThanOrEqual(3);
        expect(t.options.filter((o) => o.correct)).toHaveLength(1);
        for (const o of t.options) expect(o.t.en && o.t.he && o.feedback.en && o.feedback.he).toBeTruthy();
      }
    }
  });

  it('has a complete phonetic legend', () => {
    for (const row of PHONETIC_LEGEND) expect(row.he && row.en && row.noteHe && row.noteEn).toBeTruthy();
  });
});
