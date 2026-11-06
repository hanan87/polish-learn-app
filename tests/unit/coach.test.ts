import { describe, expect, it } from 'vitest';
import { COACH } from '../../src/data/coach';
import type { RecorderResult } from '../../src/hooks/useSpeechRecorder';
import { HANDS_FREE_PASS, helpForMiss, judgeAttempt } from '../../src/lib/handsFreeJudge';

const result = (over: Partial<RecorderResult>): RecorderResult => ({
  audioUrl: 'blob:x',
  transcript: '',
  recognized: false,
  sttError: null,
  peakLevel: 0.2,
  heardVoice: true,
  audioLost: false,
  durationMs: 2000,
  mode: 'both',
  ...over,
});

describe('hands-free judging – never praise what was not verified', () => {
  it('passes only a real recognition score at or above the threshold', () => {
    const v = judgeAttempt('szkoła', result({ recognized: true, transcript: 'szkoła' }));
    expect(v.outcome).toBe('pass');
    expect(v.score).toBeGreaterThanOrEqual(HANDS_FREE_PASS);
    expect(v.heard).toBe('szkoła');
  });

  it('marks gibberish or a different word as a miss', () => {
    expect(judgeAttempt('szkoła', result({ recognized: true, transcript: 'bla bla bla' })).outcome).toBe('low');
    expect(judgeAttempt('Dzień dobry', result({ recognized: true, transcript: 'dobranoc' })).outcome).toBe('low');
  });

  it('a voice with nothing recognized is a miss ("unclear"), not a success', () => {
    expect(judgeAttempt('szkoła', result({})).outcome).toBe('unclear');
    expect(judgeAttempt('szkoła', result({ sttError: 'no-speech' })).outcome).toBe('unclear');
    expect(judgeAttempt('szkoła', result({ sttError: 'aborted' })).outcome).toBe('unclear');
    expect(judgeAttempt('szkoła', null).outcome).toBe('unclear');
  });

  it('reports silence separately', () => {
    expect(judgeAttempt('szkoła', result({ heardVoice: false, peakLevel: 0 })).outcome).toBe('silent');
  });

  it('is honest when the device cannot check speech at all', () => {
    expect(judgeAttempt('szkoła', result({ mode: 'record' })).outcome).toBe('unchecked');
    expect(judgeAttempt('szkoła', result({ sttError: 'network' })).outcome).toBe('unchecked');
    expect(judgeAttempt('szkoła', result({ sttError: 'not-allowed' })).outcome).toBe('unchecked');
  });
});

describe('coaching ladder', () => {
  it('adds a different kind of help on every miss and keeps going', () => {
    expect([1, 2, 3, 4, 5, 6].map(helpForMiss)).toEqual(['replay', 'chunks', 'tip', 'chunks', 'replay', 'chunks']);
  });

  it('has every coaching line in Hebrew and English', () => {
    for (const line of Object.values(COACH)) {
      expect(line.he).toMatch(/[֐-׿]/);
      expect(line.en).not.toMatch(/[֐-׿]/);
    }
  });
});
