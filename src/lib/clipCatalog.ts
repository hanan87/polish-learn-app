import { ALL_ITEMS, applyProfile, getProfile } from '../data';
import { COACH } from '../data/coach';
import { ROLEPLAYS } from '../data/dialogues';
import { KASIA_COMPLIMENTS, KASIA_DEDICATION, KASIA_TITLE } from '../data/kasia';
import { CONTRAST_GROUPS } from '../data/minimalPairs';
import { speakerVoice, STORIES, wordKey } from '../data/stories';
import { personalize, type LearnerProfile } from './personalize';
import { clipKey, clipText, type ClipSpeed, type ClipVoice } from './voiceClips';

/**
 * Every phrase the app can say, for the neural-voice generator (scripts/gen-voice.ts).
 * Gendered items and roleplays are expanded for both genders with the default names (Dawid / Anna);
 * a learner's own name is spoken by the device voice.
 */

export interface ClipRequest {
  key: string;
  voice: ClipVoice;
  speed: ClipSpeed;
  text: string;
}

const PROFILES: LearnerProfile[] = [
  { gender: 'm', name: '' },
  { gender: 'f', name: '' },
];

/** Words of a phrase without surrounding punctuation (for word-by-word playback). */
export function phraseWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter(Boolean);
}

export function buildClipCatalog(): ClipRequest[] {
  const out = new Map<string, ClipRequest>();
  const add = (voice: ClipVoice, speed: ClipSpeed, text: string) => {
    const t = clipText(text);
    if (!t) return;
    const key = clipKey(voice, speed, t);
    if (!out.has(key)) out.set(key, { key, voice, speed, text: t });
  };
  const addPolish = (text: string, voice: ClipVoice = 'pl-f', slow = false) => {
    add(voice, 'n', text);
    if (slow) add(voice, 's', text);
  };

  const saved = getProfile();
  try {
    for (const profile of PROFILES) {
      applyProfile(profile);
      for (const item of ALL_ITEMS) {
        // The teacher (Zofia) says everything; Marek also says the male forms of gendered phrases.
        addPolish(item.polish, 'pl-f', true);
        if (item.genderAlt && profile.gender === 'm') addPolish(item.polish, 'pl-m', true);
        item.backchainingSteps.forEach((s) => addPolish(s));
        phraseWords(item.polish).forEach((w) => addPolish(w));
        // Hands-free mode reads the meaning in the learner's language.
        add('he', 'n', item.hebrew);
        add('en', 'n', item.english);
        // The articulation tip, read by the hands-free coach after repeated misses.
        add('he', 'n', `${COACH.tip.he} ${item.articulationTip}`);
        add('en', 'n', `${COACH.tip.en} ${item.articulationTipEn}`);
        if (item.genderAlt) addPolish(item.genderAlt.polish, item.genderAlt.gender === 'm' ? 'pl-m' : 'pl-f');
      }
      for (const r of ROLEPLAYS) {
        for (const turn of r.turns) {
          addPolish(personalize(turn.line.polish, profile), turn.voice === 'm' || (!turn.voice && r.voice === 'm') ? 'pl-m' : 'pl-f');
          for (const o of turn.options) addPolish(personalize(o.polish, profile), profile.gender === 'm' ? 'pl-m' : 'pl-f');
        }
      }
    }
  } finally {
    applyProfile(saved);
  }

  for (const g of CONTRAST_GROUPS) {
    for (const p of g.pairs) {
      addPolish(p.a.polish, 'pl-f', true);
      addPolish(p.b.polish, 'pl-f', true);
    }
  }

  for (const s of STORIES) {
    for (const line of s.lines) {
      addPolish(line.polish, speakerVoice(line.speaker) === 'm' ? 'pl-m' : 'pl-f');
      for (const w of line.polish.split(/\s+/)) if (wordKey(w)) addPolish(w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''));
    }
    for (const q of s.questions) {
      addPolish(q.q);
      q.options.forEach((o) => addPolish(o.polish));
    }
  }

  for (const line of Object.values(COACH)) {
    add('he', 'n', line.he);
    add('en', 'n', line.en);
  }

  // The dedication is written by a man, so Marek reads it.
  for (const line of [KASIA_TITLE, KASIA_DEDICATION, ...KASIA_COMPLIMENTS]) addPolish(line.pl, 'pl-m');

  return [...out.values()];
}
