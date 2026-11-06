import { afterEach, describe, expect, it } from 'vitest';
import { ALL_ITEMS, applyProfile, getItem } from '../../src/data';
import { KASIA_DEDICATION } from '../../src/data/kasia';
import { STORIES } from '../../src/data/stories';
import { buildClipCatalog, phraseWords } from '../../src/lib/clipCatalog';
import { DEFAULT_PROFILE } from '../../src/lib/personalize';
import { voiceRank } from '../../src/lib/tts';
import { clipKey, clipText, findClip, setManifest, type ClipManifest } from '../../src/lib/voiceClips';
import { AZURE_VOICES, buildSsml, clipFileName, escapeXml, prosodyRate } from '../../scripts/voice-lib';

afterEach(() => {
  setManifest(null);
  applyProfile(DEFAULT_PROFILE);
});

describe('neural voice catalog', () => {
  const catalog = buildClipCatalog();
  const keys = new Set(catalog.map((c) => c.key));

  it('covers every item at normal and slow speed, for both genders', () => {
    for (const gender of ['m', 'f'] as const) {
      applyProfile({ gender, name: '' });
      for (const item of ALL_ITEMS) {
        expect(keys.has(clipKey('pl-f', 'n', item.polish)), `${item.id} normal`).toBe(true);
        expect(keys.has(clipKey('pl-f', 's', item.polish)), `${item.id} slow`).toBe(true);
        for (const step of item.backchainingSteps) expect(keys.has(clipKey('pl-f', 'n', step)), `${item.id} step "${step}"`).toBe(true);
        expect(keys.has(clipKey('he', 'n', item.hebrew)), `${item.id} Hebrew meaning`).toBe(true);
        expect(keys.has(clipKey('en', 'n', item.english)), `${item.id} English meaning`).toBe(true);
      }
    }
    // Male forms are also recorded in the male voice.
    expect(keys.has(clipKey('pl-m', 'n', 'Zgubiłem paszport'))).toBe(true);
    expect(keys.has(clipKey('pl-f', 'n', 'Zgubiłam paszport'))).toBe(true);
  });

  it('records story lines in each character voice, and the dedication in a male voice', () => {
    const line = STORIES[0].lines.find((l) => l.speaker === 'Tomek')!;
    expect(keys.has(clipKey('pl-m', 'n', line.polish))).toBe(true);
    expect(keys.has(clipKey('pl-m', 'n', KASIA_DEDICATION.pl))).toBe(true);
    expect(keys.has(clipKey('pl-f', 'n', 'mlekiem'))).toBe(true);
  });

  it('stays far inside the Azure free tier and has no template leftovers', () => {
    const chars = catalog.reduce((n, c) => n + c.text.length, 0);
    expect(chars).toBeLessThan(100_000);
    for (const c of catalog) expect(c.text, c.key).not.toMatch(/[{}]/);
    expect(phraseWords('Dzień dobry! Co podać?')).toEqual(['Dzień', 'dobry', 'Co', 'podać']);
  });
});

describe('Azure request building', () => {
  it('builds escaped SSML with the right voice and rate', () => {
    const ssml = buildSsml('pl-f', 's', 'Tom & "Jerry" <3');
    expect(ssml).toContain('<voice name="pl-PL-ZofiaNeural">');
    expect(ssml).toContain('xml:lang="pl-PL"');
    expect(ssml).toContain('rate="-38%"');
    expect(ssml).toContain('Tom &amp; &quot;Jerry&quot; &lt;3');
    expect(escapeXml("it's")).toBe('it&apos;s');
    expect(prosodyRate('pl-m', 'n')).toBe('-6%');
    expect(AZURE_VOICES.he.name).toBe('he-IL-HilaNeural');
  });

  it('names clips by content hash', () => {
    const a = clipFileName(clipKey('pl-f', 'n', 'Dzień dobry'));
    expect(a).toMatch(/^[0-9a-f]{16}\.mp3$/);
    expect(clipFileName(clipKey('pl-f', 'n', 'Dzień  dobry '))).toBe(a);
    expect(clipFileName(clipKey('pl-m', 'n', 'Dzień dobry'))).not.toBe(a);
  });
});

describe('clip lookup', () => {
  const manifest: ClipManifest = {
    version: 1,
    voices: { 'pl-f': 'pl-PL-ZofiaNeural', 'pl-m': 'pl-PL-MarekNeural', he: 'he-IL-HilaNeural', en: 'en-US-JennyNeural' },
    clips: {
      [clipKey('pl-f', 'n', 'Dzień dobry')]: 'aaa.mp3',
      [clipKey('pl-m', 'n', 'Jestem gotowy')]: 'bbb.mp3',
      [clipKey('pl-f', 'n', 'mlekiem')]: 'ccc.mp3',
    },
  };

  it('prefers the requested voice and falls back to the other Polish voice', () => {
    setManifest(manifest);
    expect(findClip('Dzień dobry', 'n')).toMatch(/aaa\.mp3$/);
    expect(findClip('Dzień dobry', 'n', 'pl-m')).toMatch(/aaa\.mp3$/);
    expect(findClip('Jestem gotowy', 'n', 'pl-m')).toMatch(/bbb\.mp3$/);
    expect(findClip('Jestem gotowy', 'n', 'pl-f')).toMatch(/bbb\.mp3$/);
    expect(findClip('Dzień dobry', 's')).toBeNull();
    expect(findClip('Nie ma', 'n')).toBeNull();
  });

  it('finds single words with punctuation and normalizes spacing', () => {
    setManifest(manifest);
    expect(findClip('mlekiem.', 'n')).toMatch(/ccc\.mp3$/);
    expect(findClip('  Dzień   dobry ', 'n')).toMatch(/aaa\.mp3$/);
    expect(clipText('ą')).toBe('ą');
  });

  it('returns nothing without a manifest (device voice is used)', () => {
    expect(findClip('Dzień dobry', 'n')).toBeNull();
  });

  it('every resolved item phrase would find its clip', () => {
    const catalog = buildClipCatalog();
    setManifest({ ...manifest, clips: Object.fromEntries(catalog.map((c) => [c.key, 'x.mp3'])) });
    applyProfile({ gender: 'f', name: '' });
    expect(findClip(getItem('u8-11')!.polish, 'n')).toBeTruthy();
    expect(findClip(getItem('u8-11')!.polish, 's')).toBeTruthy();
  });
});

describe('device voice ranking', () => {
  it('ranks neural / natural voices above robotic legacy voices', () => {
    const voices = [
      { name: 'Microsoft Paulina - Polish (Poland)', localService: true },
      { name: 'Google polski', localService: false },
      { name: 'Microsoft Zofia Online (Natural) - Polish (Poland)', localService: false },
      { name: 'Zosia (Enhanced)', localService: true },
    ];
    const sorted = [...voices].sort((a, b) => voiceRank(a) - voiceRank(b)).map((v) => v.name);
    expect(sorted[0]).toContain('Natural');
    expect(sorted[1]).toContain('Enhanced');
    expect(sorted.at(-1)).toContain('Paulina');
  });
});
