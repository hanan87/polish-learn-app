import { describe, expect, it } from 'vitest';
import { ALL_ITEMS } from '../../src/data';
import { LESSONS, getLesson } from '../../src/data/lessons';
import { buildLesson, buildReinforcementLesson, REINFORCEMENT_SIZE } from '../../src/lesson/buildLesson';
import { autoBackchain, detectSounds, toEnglishPhonetic, toHebrewPhonetic, toSyllableNotation } from '../../src/lib/polishPhonetics';
import { checkWriting, levenshtein, scorePronunciation } from '../../src/lib/text';
import { initialState, masteryOf, migrate, needsPractice, reducer, summarizeSounds } from '../../src/state/ProgressContext';
import { getItem } from '../../src/data';

describe('text scoring', () => {
  it('computes Levenshtein distance', () => {
    expect(levenshtein('kasza', 'kasia')).toBe(1);
    expect(levenshtein('szkoła', 'skola')).toBe(2);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });

  it('scores an exact transcript 100 and marks every word green', () => {
    const r = scorePronunciation('Dzień dobry', 'dzień dobry');
    expect(r.score).toBe(100);
    expect(r.words.every((w) => w.matched)).toBe(true);
  });

  it('scores an empty transcript 0', () => {
    expect(scorePronunciation('Dzień dobry', '').score).toBe(0);
  });

  it('marks a mispronounced word red and lowers the score below 85', () => {
    const r = scorePronunciation('Jak się Pan ma?', 'jak się pani masz');
    expect(r.score).toBeLessThan(85);
    expect(r.words.some((w) => !w.matched)).toBe(true);
  });

  it('detects diacritic-only writing mistakes', () => {
    const v = checkWriting('żaba', 'zaba');
    expect(v.kind).toBe('diacritics');
    if (v.kind === 'diacritics') expect(v.issues[0]).toEqual({ expected: 'ż', typed: 'z' });
    expect(checkWriting('Dzień dobry!', 'dzien dobry').kind).toBe('diacritics');
    expect(checkWriting('Dzień dobry', 'Dzień dobry').kind).toBe('correct');
    expect(checkWriting('woda', 'kawa').kind).toBe('wrong');
  });
});

describe('Polish phonetics generator', () => {
  it('stresses the penultimate syllable', () => {
    expect(toSyllableNotation('Przepraszam')).toBe('Prze·[pra]·szam');
    expect(toSyllableNotation('poniedziałek')).toBe('po·nie·[dzia]·łek');
  });

  it('leaves clitics unstressed', () => {
    expect(toSyllableNotation('Jak się Pan ma?')).toBe('[Jak] się [Pan] [ma]?');
  });

  it('applies devoicing', () => {
    expect(toEnglishPhonetic('wtorek')).toBe('[ftoh]·rehk');
    expect(toEnglishPhonetic('trzy')).toBe('[tshih]');
    // Compare in NFC: combining marks (dagesh, vowel points) may be typed in a different order.
    expect(toHebrewPhonetic('w prawo').normalize('NFC')).toBe('פ [פְּרָא]·בוֹ'.normalize('NFC'));
  });

  it('produces the English respelling from the spec example', () => {
    expect(toEnglishPhonetic('Dziękuję')).toBe('jen·[koo]·yeh');
  });

  it('detects challenging sounds', () => {
    expect(detectSounds('szczęście')).toEqual(expect.arrayContaining(['sz', 'cz', 'ę', 'ś', 'ć']));
    expect(detectSounds('Kasia')).toEqual(['ś']);
  });

  it('builds backchaining from the end', () => {
    expect(autoBackchain('trzy')).toEqual(['y', 'rzy', 'trzy']);
    expect(autoBackchain('Przepraszam')).toEqual(['szam', 'praszam', 'Przepraszam']);
  });
});

describe('progress store', () => {
  it('marks an item learned with mastery 1 and +10 XP', () => {
    const s = reducer(initialState(), { type: 'learn', id: 'u1-01' });
    expect(s.xp).toBe(10);
    expect(masteryOf(s.items['u1-01'])).toBe(1);
  });

  it('averages pronunciation scores and tracks failed sounds', () => {
    let s = reducer(initialState(), { type: 'learn', id: 'u1-01' });
    s = reducer(s, { type: 'pronunciation', id: 'u1-01', text: 'szkoła', score: 40, failedWords: ['szkoła'] });
    s = reducer(s, { type: 'pronunciation', id: 'u1-01', text: 'szkoła', score: 80, failedWords: [] });
    expect(s.items['u1-01'].pronAvg).toBe(60);
    expect(s.sounds.sz?.errors).toBe(1);
    expect(s.sounds.sz?.attempts).toBe(2);
  });

  it('flags a sound as weak after repeated errors', () => {
    let s = initialState();
    for (let i = 0; i < 4; i++) s = reducer(s, { type: 'writing', id: 'u1-10', text: 'łatwo', verdict: 'diacritics', letters: ['ł'] });
    const weak = summarizeSounds(s).find((x) => x.key === 'ł');
    expect(weak?.weak).toBe(true);
  });

  it('demotes mastery and brings the item back today after a writing mistake', () => {
    let s = reducer(initialState(), { type: 'learn', id: 'u1-01' });
    s = reducer(s, { type: 'review', id: 'u1-01', correct: true });
    s = reducer(s, { type: 'review', id: 'u1-01', correct: true });
    expect(masteryOf(s.items['u1-01'])).toBe(3);
    s = reducer(s, { type: 'writing', id: 'u1-01', text: 'szkoła', verdict: 'wrong', letters: [] });
    expect(masteryOf(s.items['u1-01'])).toBe(2);
    expect(needsPractice(s.items['u1-01'])).toBe(true);
  });

  it('migrates v1 data and round-trips a backup', () => {
    const v1 = { version: 1, xp: 42, items: { 'u1-01': { learned: true, srsBox: 2, dueDate: '2026-01-01', bestPronunciation: 77 } } };
    const m = migrate(v1)!;
    expect(m.version).toBe(2);
    expect(m.items['u1-01'].pronAvg).toBe(77);
    expect(migrate(JSON.parse(JSON.stringify(m)))).toEqual(m);
    expect(migrate({ version: 9 })).toBeNull();
    expect(migrate('garbage')).toBeNull();
  });
});

describe('lesson engine', () => {
  it.each(LESSONS.map((l) => [l.id] as const))('lesson %s builds valid steps', (id) => {
    const steps = buildLesson(getLesson(id)!);
    expect(steps.length).toBeGreaterThanOrEqual(10);
    const kinds = new Set(steps.map((s) => s.kind));
    for (const k of ['learn', 'listen-meaning', 'write', 'recall']) expect(kinds.has(k as never), k).toBe(true);
    for (const s of steps) {
      if ('itemId' in s) expect(getItem(s.itemId), s.key).toBeTruthy();
      if (s.kind === 'listen-meaning') {
        expect(s.optionIds).toContain(s.itemId);
        expect(new Set(s.optionIds).size).toBe(s.optionIds.length);
      }
      if (s.kind === 'fill-blank') expect(s.options.length).toBeGreaterThanOrEqual(2);
      if (s.kind === 'choose-spelling') expect(s.options.length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length);
  });

  it('builds an 8-exercise reinforcement lesson targeting weak items', () => {
    let s = initialState();
    for (const item of ALL_ITEMS.slice(0, 6)) s = reducer(s, { type: 'learn', id: item.id });
    s = reducer(s, { type: 'pronunciation', id: 'u1-03', text: 'żaba', score: 20, failedWords: ['żaba'] });
    s = reducer(s, { type: 'writing', id: 'u1-02', text: 'czekolada', verdict: 'wrong', letters: [] });
    const steps = buildReinforcementLesson(s);
    expect(steps).toHaveLength(REINFORCEMENT_SIZE);
    expect(steps.some((x) => 'itemId' in x && x.itemId === 'u1-03')).toBe(true);
    expect(steps.some((x) => x.kind === 'write' && x.itemId === 'u1-02')).toBe(true);
  });

  it('still builds 8 exercises with almost no history', () => {
    expect(buildReinforcementLesson(initialState())).toHaveLength(REINFORCEMENT_SIZE);
  });
});
