import { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Mic, Play, Square, XCircle } from 'lucide-react';
import { useSpeechRecorder } from '../hooks/useSpeechRecorder';
import { useLang } from '../i18n/LangContext';
import { getRecognizerCtor, isInIframe, mediaRecordingSupported, pickRecorderMimeType } from '../lib/env';
import { getMicLog, subscribeMicLog } from '../lib/micLog';
import { versionLabel } from '../lib/pwaUpdate';
import { MIC_STATUS_MESSAGES, useMic } from '../state/MicContext';

const PHRASE = 'Dzień dobry';

/**
 * Microphone diagnostic: records one phrase and shows what each part of the pipeline did –
 * permission, input level, recorded bytes, speech recognition result or error – plus the event log.
 */
export function MicTest() {
  const { tr, lang } = useLang();
  const mic = useMic();
  const rec = useSpeechRecorder({ target: PHRASE, maxDurationMs: 8000 });
  const log = useSyncExternalStore(subscribeMicLog, getMicLog);
  const [permission, setPermission] = useState<string>('?');

  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((p) => {
        setPermission(p.state);
        p.onchange = () => setPermission(p.state);
      })
      .catch(() => setPermission('n/a'));
  }, []);

  const recording = rec.status === 'recording' || rec.status === 'starting';
  const r = rec.result;
  const row = (ok: boolean | null, label: string, value: string) => (
    <li className="flex items-start gap-2 text-sm">
      {ok === null ? <span className="mt-0.5 size-4 shrink-0" /> : ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />}
      <span className="font-medium">{label}:</span>
      <span dir="ltr" className="min-w-0 break-all text-slate-600">
        {value}
      </span>
    </li>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {tr(`לחצו, אמרו "${PHRASE}" ובדקו שכל השורות ירוקות.`, `Tap, say "${PHRASE}" and check that every line is green.`)}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (recording ? rec.stop() : (mic.retry(), rec.start()))}
          className={`grid size-14 shrink-0 place-items-center rounded-full text-white shadow ${recording ? 'bg-rose-600' : 'bg-slate-900'}`}
          aria-label={recording ? tr('עצור', 'Stop') : tr('התחל בדיקה', 'Start test')}
        >
          {recording ? <Square className="size-6" /> : <Mic className="size-7" />}
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full rounded-full transition-[width] duration-75 ${rec.heardVoice ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.max(2, rec.level * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-500">
            {rec.status === 'recording' ? (rec.heardVoice ? tr('קול זוהה', 'Voice detected') : tr('מקשיב…', 'Listening…')) : rec.status === 'processing' ? tr('מעבד…', 'Processing…') : ''}
            {rec.interim && (
              <span dir="ltr" className="polish ms-2">
                {rec.interim}
              </span>
            )}
          </p>
        </div>
        {r?.audioUrl && (
          <button type="button" onClick={() => new Audio(r.audioUrl!).play().catch(() => undefined)} className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700" aria-label={tr('השמע הקלטה', 'Play recording')}>
            <Play className="size-5" />
          </button>
        )}
      </div>

      <ul className="space-y-1 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        {row(null, tr('גרסת האפליקציה', 'App version'), versionLabel('en-GB'))}
        {row(window.isSecureContext, tr('חיבור מאובטח', 'Secure context'), String(window.isSecureContext))}
        {row(!isInIframe, tr('מחוץ ל-iframe', 'Not in an iframe'), String(!isInIframe))}
        {row(mediaRecordingSupported, 'MediaRecorder', pickRecorderMimeType() ?? (mediaRecordingSupported ? 'default' : 'none'))}
        {row(!!getRecognizerCtor(), tr('זיהוי דיבור', 'Speech recognition'), getRecognizerCtor() ? 'available' : 'not available')}
        {row(permission === 'granted' ? true : permission === 'denied' ? false : null, tr('הרשאת מיקרופון', 'Mic permission'), permission)}
        {row(mic.status === 'ready', tr('מצב מיקרופון', 'Mic status'), mic.status + (mic.status !== 'ready' ? ` – ${MIC_STATUS_MESSAGES[mic.status][lang]}` : ''))}
        {r && row(r.heardVoice, tr('קול נקלט', 'Voice captured'), `peak ${r.peakLevel}`)}
        {r && row(!!r.audioUrl && !r.audioLost, tr('הקלטה נשמרה', 'Recording saved'), r.audioUrl ? (r.audioLost ? 'track ended early' : 'yes') : 'no')}
        {r && row(r.recognized, tr('תמלול', 'Transcript'), r.transcript || r.sttError || 'empty')}
      </ul>

      <details className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-bold">{tr('יומן אירועים', 'Event log')}</summary>
        <ol dir="ltr" className="mt-2 max-h-48 space-y-0.5 overflow-y-auto font-mono text-[11px] text-slate-600">
          {log.map((e, i) => (
            <li key={i}>
              {new Date(e.t).toLocaleTimeString()} {e.event}
              {e.detail ? ` – ${e.detail}` : ''}
            </li>
          ))}
          {log.length === 0 && <li>–</li>}
        </ol>
      </details>
    </div>
  );
}
