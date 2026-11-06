import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, CloudDownload, Play, Sparkles } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { ttsSupported } from '../lib/env';
import { getPreferredVoiceURI, polishVoices, setPreferredVoiceURI, speak, stopSpeaking, voiceRank } from '../lib/tts';
import { cacheAllClips, clipCount, naturalVoiceEnabled, setNaturalVoiceEnabled, subscribeManifest } from '../lib/voiceClips';

const SAMPLE = 'Dzień dobry! Miło mi Cię poznać.';

/** Teacher voice: recorded natural voice (default) and the device voice used as fallback. */
export function VoiceSettings() {
  const { tr } = useLang();
  // Re-render when the clip manifest arrives or the preference changes.
  const snapshot = useSyncExternalStore(subscribeManifest, () => `${clipCount()}|${naturalVoiceEnabled()}`);
  const [count, natural] = [Number(snapshot.split('|')[0]), snapshot.endsWith('true')];
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => polishVoices());
  const [chosen, setChosen] = useState<string | null>(() => getPreferredVoiceURI());
  const [offline, setOffline] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!ttsSupported) return;
    const update = () => setVoices(polishVoices());
    window.speechSynthesis.addEventListener('voiceschanged', update);
    update();
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  const pickDevice = (uri: string | null) => {
    setPreferredVoiceURI(uri);
    setChosen(uri);
    // Preview through the device voice even when natural clips are on.
    const prev = naturalVoiceEnabled();
    if (prev) setNaturalVoiceEnabled(false);
    speak(SAMPLE).finally(() => prev && setNaturalVoiceEnabled(true));
  };

  const saveOffline = async () => {
    setOffline({ done: 0, total: 1 });
    await cacheAllClips((done, total) => setOffline({ done, total }));
  };

  const quality = (v: SpeechSynthesisVoice) =>
    voiceRank(v) <= 1 ? tr('טבעי', 'Natural') : voiceRank(v) <= 3 ? tr('רשת', 'Online') : tr('בסיסי', 'Basic');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="size-4 text-rose-600" /> {tr('קול טבעי מוקלט', 'Natural recorded voice')}
            </span>
            <span className="block text-xs text-slate-500">
              {count > 0
                ? tr(
                    `${count} הקלטות בקול נוירוני איכותי (Zofia ו-Marek). מה שלא הוקלט – למשל השם שלכם – נקרא בקול המכשיר.`,
                    `${count} high-quality neural recordings (Zofia and Marek). Anything not recorded – like your own name – uses the device voice.`,
                  )
                : tr('ההקלטות עדיין לא זמינות – בינתיים משתמשים בקול המכשיר שנבחר למטה.', 'Recordings are not available yet – the device voice below is used meanwhile.')}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={natural}
            disabled={count === 0}
            onChange={(e) => {
              stopSpeaking();
              setNaturalVoiceEnabled(e.target.checked);
            }}
            aria-label={tr('קול טבעי מוקלט', 'Natural recorded voice')}
            className="mt-1 size-6 shrink-0 accent-rose-600"
            data-testid="natural-voice"
          />
        </label>
        {count > 0 && natural && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => speak(SAMPLE)} className="btn-secondary">
              <Play className="size-4" /> {tr('השמע דוגמה', 'Play a sample')}
            </button>
            <button type="button" onClick={saveOffline} disabled={!!offline && offline.done < offline.total} className="btn-secondary">
              <CloudDownload className="size-4" />
              {offline
                ? offline.done >= offline.total
                  ? tr('נשמר לשימוש בלי אינטרנט', 'Saved for offline use')
                  : `${Math.round((offline.done / offline.total) * 100)}%`
                : tr('שמור את הקול לשימוש בלי אינטרנט', 'Save the voice for offline use')}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-3">
        <p className="font-semibold">{tr('קול המכשיר (גיבוי)', 'Device voice (fallback)')}</p>
        {voices.length === 0 ? (
          <p className="text-xs text-slate-500">
            {tr(
              'לא נמצא קול פולני במכשיר. ב-Edge יש קולות "Natural" איכותיים בחינם; באנדרואיד: הגדרות ← המרת טקסט לדיבור ← פולנית; ב-iPhone: נגישות ← תוכן מוקרא ← קולות ← פולנית ← Zosia (משופר).',
              'No Polish device voice found. Edge offers free high-quality "Natural" voices; Android: Settings → Text-to-speech → Polish; iPhone: Accessibility → Spoken Content → Voices → Polish → Zosia (Enhanced).',
            )}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200" role="radiogroup" aria-label={tr('קול המכשיר', 'Device voice')}>
            {[null, ...voices].map((v) => {
              const uri = v?.voiceURI ?? null;
              const active = chosen === uri || (!chosen && !uri);
              return (
                <li key={uri ?? 'auto'}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickDevice(uri)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm ${active ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>
                      {active && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{v ? v.name : tr('אוטומטי – הקול הטוב ביותר שנמצא', 'Automatic – best voice found')}</span>
                    {v && <span className="shrink-0 text-[11px] font-medium text-slate-500">{quality(v)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
