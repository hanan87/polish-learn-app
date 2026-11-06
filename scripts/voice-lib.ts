import { createHash } from 'node:crypto';
import type { ClipSpeed, ClipVoice } from '../src/lib/voiceClips';

/** Azure AI Speech neural voices used for the course audio. */
export const AZURE_VOICES: Record<ClipVoice, { locale: string; name: string }> = {
  'pl-f': { locale: 'pl-PL', name: 'pl-PL-ZofiaNeural' },
  'pl-m': { locale: 'pl-PL', name: 'pl-PL-MarekNeural' },
  he: { locale: 'he-IL', name: 'he-IL-HilaNeural' },
  en: { locale: 'en-US', name: 'en-US-JennyNeural' },
};

/**
 * Speaking rates. Polish is spoken a touch slower than conversational speed so learners can follow;
 * the slow variant is synthesized slowly (natural prosody) instead of stretching the normal clip.
 */
export function prosodyRate(voice: ClipVoice, speed: ClipSpeed): string {
  if (voice === 'he' || voice === 'en') return '-4%';
  return speed === 's' ? '-38%' : '-6%';
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function buildSsml(voice: ClipVoice, speed: ClipSpeed, text: string): string {
  const v = AZURE_VOICES[voice];
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.locale}">` +
    `<voice name="${v.name}"><prosody rate="${prosodyRate(voice, speed)}">${escapeXml(text)}</prosody></voice></speak>`
  );
}

/** Stable, content-addressed file name: regenerating unchanged phrases is free. */
export function clipFileName(key: string): string {
  return createHash('sha1').update(key).digest('hex').slice(0, 16) + '.mp3';
}
