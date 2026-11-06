import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { applyProfile, getItem, registerCustomItems } from '../data';
import { SOUND_INFO, WEAK_SOUND_ERROR_RATE, WEAK_SOUND_MIN_ATTEMPTS, WEAK_SOUND_MIN_AVG, type SoundKey } from '../data/sounds';
import type { LearningItem } from '../data/types';
import { addDays, daysBetween, todayKey } from '../lib/date';
import { setHapticsEnabled } from '../lib/haptics';
import { DEFAULT_PROFILE, type LearnerProfile } from '../lib/personalize';
import { detectSounds, letterSound } from '../lib/polishPhonetics';

/**
 * Learner progress persisted in LocalStorage (schema v2):
 *  - XP, daily goal, streak
 *  - per-item performance history: pronunciation scores + average, writing errors,
 *    mastery level 1–5 (Leitner box) and next review date
 *  - per-sound statistics to detect "challenging sounds" (e.g. sz, ą)
 *  - lesson / dialogue completion, and the learner's own dictionary items
 */

const STORAGE_KEY = 'polish-learn:progress:v1';

/** Leitner box intervals in days. Box 0 = new; boxes 1–5 equal the mastery level. */
export const SRS_INTERVALS = [0, 1, 3, 7, 14, 30];
export const MAX_MASTERY = 5;
const PRON_HISTORY = 10;

export const XP = {
  learnItem: 10,
  reviewCorrect: 5,
  reviewWrong: 1,
  pronunciationGood: 5,
  earTraining: 2,
  lessonComplete: 30,
  dialogueComplete: 25,
  customWord: 5,
  storyQuestion: 10,
  storyComplete: 15,
} as const;

export interface ItemProgress {
  learned: boolean;
  /** Leitner box 0–5; mastery level = max(1, srsBox) once learned. */
  srsBox: number;
  dueDate: string;
  reviews: number;
  correct: number;
  wrong: number;
  pronScores: number[];
  pronAvg: number | null;
  bestPronunciation: number | null;
  writingAttempts: number;
  writingErrors: number;
  exerciseErrors: number;
  lastPracticed: string | null;
}

export interface SoundStat {
  attempts: number;
  errors: number;
  scoreSum: number;
  scoreCount: number;
}

export interface ProgressState {
  version: 2;
  xp: number;
  dailyGoal: number;
  daily: { date: string; xp: number };
  streak: { current: number; best: number; lastActiveDate: string | null };
  items: Record<string, ItemProgress>;
  sounds: Partial<Record<SoundKey, SoundStat>>;
  lessons: Record<string, { completedAt: string; bestAccuracy: number }>;
  dialogues: Record<string, { completedAt: string; bestScore: number }>;
  customItems: LearningItem[];
  /** Learner's grammatical gender and first name (personalizes gendered phrases). */
  profile: LearnerProfile;
  prefs: { haptics: boolean };
  /** Speed Blitz personal record. */
  blitz: { best: number; plays: number };
  stories: Record<string, { completedAt: string; bestCorrect: number }>;
}

export const initialState = (): ProgressState => ({
  version: 2,
  xp: 0,
  dailyGoal: 50,
  daily: { date: todayKey(), xp: 0 },
  streak: { current: 0, best: 0, lastActiveDate: null },
  items: {},
  sounds: {},
  lessons: {},
  dialogues: {},
  customItems: [],
  profile: { ...DEFAULT_PROFILE },
  prefs: { haptics: true },
  blitz: { best: 0, plays: 0 },
  stories: {},
});

const emptyItem = (): ItemProgress => ({
  learned: false,
  srsBox: 0,
  dueDate: todayKey(),
  reviews: 0,
  correct: 0,
  wrong: 0,
  pronScores: [],
  pronAvg: null,
  bestPronunciation: null,
  writingAttempts: 0,
  writingErrors: 0,
  exerciseErrors: 0,
  lastPracticed: null,
});

/** Accepts v1 or v2 data (from storage or a backup file) and returns a valid v2 state. */
export function migrate(raw: unknown): ProgressState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Omit<Partial<ProgressState>, 'version'> & { version?: number };
  if (data.version !== 1 && data.version !== 2) return null;
  const base = initialState();
  const items: Record<string, ItemProgress> = {};
  for (const [id, p] of Object.entries(data.items ?? {})) {
    const old = p as Partial<ItemProgress>;
    const scores = old.pronScores ?? (old.bestPronunciation != null ? [old.bestPronunciation] : []);
    items[id] = {
      ...emptyItem(),
      ...old,
      pronScores: scores,
      pronAvg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    };
  }
  return {
    ...base,
    ...data,
    version: 2,
    items,
    sounds: data.sounds ?? {},
    customItems: Array.isArray(data.customItems) ? data.customItems : [],
    profile: { ...base.profile, ...(data.profile ?? {}) },
    prefs: { ...base.prefs, ...(data.prefs ?? {}) },
    blitz: { ...base.blitz, ...(data.blitz ?? {}) },
    stories: data.stories ?? {},
  } as ProgressState;
}

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return (raw && migrate(JSON.parse(raw))) || initialState();
  } catch {
    return initialState();
  }
}

export type Action =
  | { type: 'award'; amount: number }
  | { type: 'learn'; id: string }
  | { type: 'review'; id: string; correct: boolean }
  | { type: 'pronunciation'; id?: string; text: string; score: number; failedWords: string[] }
  | { type: 'writing'; id: string; text: string; verdict: 'correct' | 'diacritics' | 'wrong'; letters: string[] }
  | { type: 'exercise'; id?: string; text: string; correct: boolean; sounds?: SoundKey[] }
  | { type: 'lesson'; id: string; accuracy: number }
  | { type: 'dialogue'; id: string; score: number }
  | { type: 'goal'; goal: number }
  | { type: 'addCustom'; item: LearningItem }
  | { type: 'removeCustom'; id: string }
  | { type: 'profile'; profile: Partial<LearnerProfile> }
  | { type: 'haptics'; on: boolean }
  | { type: 'blitz'; score: number }
  | { type: 'story'; id: string; correct: number; total: number }
  | { type: 'replace'; state: ProgressState }
  | { type: 'reset' };

/** Adds XP and updates the daily counter and streak. */
function withXp(state: ProgressState, amount: number): ProgressState {
  if (amount <= 0) return state;
  const today = todayKey();
  const daily = state.daily.date === today ? { date: today, xp: state.daily.xp + amount } : { date: today, xp: amount };
  let { current, best, lastActiveDate } = state.streak;
  if (lastActiveDate !== today) {
    const gap = lastActiveDate ? daysBetween(lastActiveDate, today) : Infinity;
    current = gap === 1 ? current + 1 : 1;
    best = Math.max(best, current);
    lastActiveDate = today;
  }
  return { ...state, xp: state.xp + amount, daily, streak: { current, best, lastActiveDate } };
}

function updateItem(state: ProgressState, id: string, fn: (p: ItemProgress) => ItemProgress): ProgressState {
  const prev = state.items[id] ?? emptyItem();
  return { ...state, items: { ...state.items, [id]: { ...fn(prev), lastPracticed: todayKey() } } };
}

/** A failure in any skill lowers mastery by one level and brings the item back today. */
function demote(p: ItemProgress): ItemProgress {
  if (!p.learned) return p;
  return { ...p, srsBox: Math.max(1, p.srsBox - 1), dueDate: todayKey() };
}

function updateSounds(state: ProgressState, sounds: SoundKey[], errorSounds: Set<SoundKey>, score: number | null): ProgressState {
  if (!sounds.length) return state;
  const next = { ...state.sounds };
  for (const s of sounds) {
    const prev = next[s] ?? { attempts: 0, errors: 0, scoreSum: 0, scoreCount: 0 };
    next[s] = {
      attempts: prev.attempts + 1,
      errors: prev.errors + (errorSounds.has(s) ? 1 : 0),
      scoreSum: prev.scoreSum + (score ?? 0),
      scoreCount: prev.scoreCount + (score === null ? 0 : 1),
    };
  }
  return { ...state, sounds: next };
}

export function reducer(state: ProgressState, action: Action): ProgressState {
  switch (action.type) {
    case 'award':
      return withXp(state, action.amount);

    case 'learn': {
      const prev = state.items[action.id] ?? emptyItem();
      if (prev.learned) return state;
      const s = updateItem(state, action.id, (p) => ({ ...p, learned: true, srsBox: Math.max(p.srsBox, 1), dueDate: addDays(todayKey(), 1) }));
      return withXp(s, XP.learnItem);
    }

    case 'review': {
      const s = updateItem(state, action.id, (p) => {
        const box = action.correct ? Math.min(p.srsBox + 1, MAX_MASTERY) : 1;
        return {
          ...p,
          learned: true,
          srsBox: box,
          dueDate: addDays(todayKey(), action.correct ? SRS_INTERVALS[box] : 0),
          reviews: p.reviews + 1,
          correct: p.correct + (action.correct ? 1 : 0),
          wrong: p.wrong + (action.correct ? 0 : 1),
        };
      });
      return withXp(s, action.correct ? XP.reviewCorrect : XP.reviewWrong);
    }

    case 'pronunciation': {
      let s = state;
      if (action.id) {
        s = updateItem(s, action.id, (p) => {
          const pronScores = [...p.pronScores, action.score].slice(-PRON_HISTORY);
          const updated = {
            ...p,
            pronScores,
            pronAvg: Math.round(pronScores.reduce((a, b) => a + b, 0) / pronScores.length),
            bestPronunciation: Math.max(p.bestPronunciation ?? 0, action.score),
          };
          return action.score < 60 ? demote(updated) : updated;
        });
      }
      const sounds = detectSounds(action.text);
      // Sounds inside the words that were not recognized are counted as errors.
      const errorSounds = new Set<SoundKey>(
        action.failedWords.length
          ? action.failedWords.flatMap((w) => detectSounds(w))
          : action.score < 70
            ? sounds
            : [],
      );
      s = updateSounds(s, sounds, errorSounds, action.score);
      return action.score >= 85 ? withXp(s, XP.pronunciationGood) : s;
    }

    case 'writing': {
      const s = updateItem(state, action.id, (p) => {
        const updated = {
          ...p,
          writingAttempts: p.writingAttempts + 1,
          writingErrors: p.writingErrors + (action.verdict === 'correct' ? 0 : 1),
        };
        return action.verdict === 'wrong' ? demote(updated) : updated;
      });
      const sounds = detectSounds(action.text);
      const errorSounds = new Set<SoundKey>(
        action.verdict === 'wrong' ? sounds : (action.letters.map(letterSound).filter(Boolean) as SoundKey[]),
      );
      const all = [...new Set([...sounds, ...errorSounds])];
      return updateSounds(s, all, errorSounds, null);
    }

    case 'exercise': {
      let s = state;
      if (action.id) {
        s = updateItem(s, action.id, (p) =>
          action.correct ? p : demote({ ...p, exerciseErrors: p.exerciseErrors + 1 }),
        );
      }
      const sounds = action.sounds ?? detectSounds(action.text);
      return updateSounds(s, sounds, new Set(action.correct ? [] : sounds), null);
    }

    case 'lesson': {
      const prev = state.lessons[action.id];
      const entry = { completedAt: todayKey(), bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, action.accuracy) };
      return withXp({ ...state, lessons: { ...state.lessons, [action.id]: entry } }, XP.lessonComplete);
    }

    case 'dialogue': {
      const prev = state.dialogues[action.id];
      const entry = { completedAt: todayKey(), bestScore: Math.max(prev?.bestScore ?? 0, action.score) };
      return withXp({ ...state, dialogues: { ...state.dialogues, [action.id]: entry } }, XP.dialogueComplete);
    }

    case 'goal':
      return { ...state, dailyGoal: action.goal };

    case 'addCustom': {
      const s = { ...state, customItems: [...state.customItems.filter((i) => i.id !== action.item.id), action.item] };
      const learned = updateItem(s, action.item.id, (p) => ({ ...p, learned: true, srsBox: Math.max(p.srsBox, 1), dueDate: todayKey() }));
      return withXp(learned, XP.customWord);
    }

    case 'removeCustom': {
      const items = { ...state.items };
      delete items[action.id];
      return { ...state, items, customItems: state.customItems.filter((i) => i.id !== action.id) };
    }

    case 'profile':
      return { ...state, profile: { ...state.profile, ...action.profile } };

    case 'haptics':
      return { ...state, prefs: { ...state.prefs, haptics: action.on } };

    case 'blitz': {
      const s = { ...state, blitz: { best: Math.max(state.blitz.best, action.score), plays: state.blitz.plays + 1 } };
      return withXp(s, action.score);
    }

    case 'story': {
      const prev = state.stories[action.id];
      const entry = { completedAt: todayKey(), bestCorrect: Math.max(prev?.bestCorrect ?? 0, action.correct) };
      return withXp({ ...state, stories: { ...state.stories, [action.id]: entry } }, XP.storyComplete + action.correct * XP.storyQuestion);
    }

    case 'replace':
      return action.state;

    case 'reset':
      return initialState();
  }
}

export interface WeakSound {
  key: SoundKey;
  attempts: number;
  errorRate: number;
  avgScore: number | null;
  weak: boolean;
}

/** Per-sound summary, weakest first. */
export function summarizeSounds(state: ProgressState): WeakSound[] {
  return (Object.keys(SOUND_INFO) as SoundKey[])
    .map((key) => {
      const s = state.sounds[key];
      if (!s || s.attempts === 0) return null;
      const errorRate = s.errors / s.attempts;
      const avgScore = s.scoreCount ? Math.round(s.scoreSum / s.scoreCount) : null;
      const weak =
        s.attempts >= WEAK_SOUND_MIN_ATTEMPTS && (errorRate >= WEAK_SOUND_ERROR_RATE || (avgScore !== null && avgScore < WEAK_SOUND_MIN_AVG));
      return { key, attempts: s.attempts, errorRate, avgScore, weak };
    })
    .filter((x): x is WeakSound => x !== null)
    .sort((a, b) => Number(b.weak) - Number(a.weak) || b.errorRate - a.errorRate);
}

export function masteryOf(p: ItemProgress | undefined): number {
  if (!p?.learned) return 0;
  return Math.max(1, Math.min(MAX_MASTERY, p.srsBox));
}

/** 0 = solid, higher = weaker. Combines pronunciation, writing, exercise and review history. */
export function itemWeakness(p: ItemProgress | undefined): number {
  if (!p) return 0;
  let w = 0;
  if (p.pronAvg !== null) w += ((100 - p.pronAvg) / 100) * 3;
  if (p.writingAttempts) w += (p.writingErrors / p.writingAttempts) * 2;
  if (p.reviews) w += (p.wrong / p.reviews) * 1.5;
  w += Math.min(p.exerciseErrors, 4) * 0.4;
  if (p.learned) w += (MAX_MASTERY - masteryOf(p)) * 0.25;
  return w;
}

export function needsPractice(p: ItemProgress | undefined, today = todayKey()): boolean {
  if (!p?.learned) return false;
  return (
    p.dueDate <= today ||
    masteryOf(p) <= 2 ||
    (p.pronAvg !== null && p.pronAvg < 75) ||
    (p.writingAttempts > 0 && p.writingErrors / p.writingAttempts >= 0.5)
  );
}

interface ProgressApi {
  state: ProgressState;
  level: number;
  levelProgress: number;
  todayXp: number;
  activeStreak: number;
  award: (amount: number) => void;
  markLearned: (id: string) => void;
  recordReview: (id: string, correct: boolean) => void;
  recordPronunciation: (id: string | undefined, text: string, score: number, failedWords?: string[]) => void;
  recordWriting: (id: string, text: string, verdict: 'correct' | 'diacritics' | 'wrong', letters?: string[]) => void;
  recordExercise: (id: string | undefined, text: string, correct: boolean, sounds?: SoundKey[]) => void;
  completeLesson: (id: string, accuracy: number) => void;
  completeDialogue: (id: string, score: number) => void;
  setDailyGoal: (goal: number) => void;
  setProfile: (profile: Partial<LearnerProfile>) => void;
  setHaptics: (on: boolean) => void;
  recordBlitz: (score: number) => void;
  completeStory: (id: string, correct: number, total: number) => void;
  addCustomItem: (item: LearningItem) => void;
  removeCustomItem: (id: string) => void;
  exportJson: () => string;
  importJson: (json: string) => boolean;
  resetAll: () => void;
  isLearned: (id: string) => boolean;
  dueItemIds: () => string[];
}

const ProgressContext = createContext<ProgressApi | null>(null);

export const XP_PER_LEVEL = 150;

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  // Register custom items synchronously so getItem() resolves them during this render.
  useMemo(() => registerCustomItems(state.customItems), [state.customItems]);
  // Resolve gendered / named phrases for this learner before any child renders an item.
  useMemo(() => applyProfile(state.profile), [state.profile]);
  useMemo(() => setHapticsEnabled(state.prefs.haptics), [state.prefs.haptics]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage may be full or disabled (private mode); progress then lives for this session only.
    }
  }, [state]);

  const award = useCallback((amount: number) => dispatch({ type: 'award', amount }), []);
  const markLearned = useCallback((id: string) => dispatch({ type: 'learn', id }), []);
  const recordReview = useCallback((id: string, correct: boolean) => dispatch({ type: 'review', id, correct }), []);
  const recordPronunciation = useCallback(
    (id: string | undefined, text: string, score: number, failedWords: string[] = []) =>
      dispatch({ type: 'pronunciation', id, text, score, failedWords }),
    [],
  );
  const recordWriting = useCallback(
    (id: string, text: string, verdict: 'correct' | 'diacritics' | 'wrong', letters: string[] = []) =>
      dispatch({ type: 'writing', id, text, verdict, letters }),
    [],
  );
  const recordExercise = useCallback(
    (id: string | undefined, text: string, correct: boolean, sounds?: SoundKey[]) => dispatch({ type: 'exercise', id, text, correct, sounds }),
    [],
  );
  const completeLesson = useCallback((id: string, accuracy: number) => dispatch({ type: 'lesson', id, accuracy }), []);
  const completeDialogue = useCallback((id: string, score: number) => dispatch({ type: 'dialogue', id, score }), []);
  const setDailyGoal = useCallback((goal: number) => dispatch({ type: 'goal', goal }), []);
  const setProfile = useCallback((profile: Partial<LearnerProfile>) => dispatch({ type: 'profile', profile }), []);
  const setHaptics = useCallback((on: boolean) => dispatch({ type: 'haptics', on }), []);
  const recordBlitz = useCallback((score: number) => dispatch({ type: 'blitz', score }), []);
  const completeStory = useCallback((id: string, correct: number, total: number) => dispatch({ type: 'story', id, correct, total }), []);
  const addCustomItem = useCallback((item: LearningItem) => dispatch({ type: 'addCustom', item }), []);
  const removeCustomItem = useCallback((id: string) => dispatch({ type: 'removeCustom', id }), []);
  const resetAll = useCallback(() => dispatch({ type: 'reset' }), []);
  const importJson = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      // Accept both a raw state and the wrapped backup format { app, exportedAt, progress }.
      const next = migrate(parsed?.progress ?? parsed);
      if (!next) return false;
      dispatch({ type: 'replace', state: next });
      return true;
    } catch {
      return false;
    }
  }, []);

  const api = useMemo<ProgressApi>(() => {
    const today = todayKey();
    const last = state.streak.lastActiveDate;
    const activeStreak = last && daysBetween(last, today) <= 1 ? state.streak.current : 0;
    return {
      state,
      level: Math.floor(state.xp / XP_PER_LEVEL) + 1,
      levelProgress: (state.xp % XP_PER_LEVEL) / XP_PER_LEVEL,
      todayXp: state.daily.date === today ? state.daily.xp : 0,
      activeStreak,
      award,
      markLearned,
      recordReview,
      recordPronunciation,
      recordWriting,
      recordExercise,
      completeLesson,
      completeDialogue,
      setDailyGoal,
      setProfile,
      setHaptics,
      recordBlitz,
      completeStory,
      addCustomItem,
      removeCustomItem,
      exportJson: () => JSON.stringify({ app: 'polish-learn', exportedAt: new Date().toISOString(), progress: state }, null, 2),
      importJson,
      resetAll,
      isLearned: (id) => !!state.items[id]?.learned,
      dueItemIds: () =>
        Object.entries(state.items)
          .filter(([id, p]) => p.learned && p.dueDate <= today && !!getItem(id))
          .sort((a, b) => a[1].srsBox - b[1].srsBox)
          .map(([id]) => id),
    };
  }, [
    state,
    award,
    markLearned,
    recordReview,
    recordPronunciation,
    recordWriting,
    recordExercise,
    completeLesson,
    completeDialogue,
    setDailyGoal,
    setProfile,
    setHaptics,
    recordBlitz,
    completeStory,
    addCustomItem,
    removeCustomItem,
    importJson,
    resetAll,
  ]);

  return <ProgressContext.Provider value={api}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressApi {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
