import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ear, Headphones, Lightbulb, Loader2, Mic, RotateCcw, Square, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useSpeechRecorder } from '../hooks/useSpeechRecorder';
import type { CaptureMode } from '../lib/captureMode';
import { useLang } from '../i18n/LangContext';
import { isIOS, speechRecognitionSupported } from '../lib/env';
import { normalize, scorePronunciation, similarity, type PronunciationResult } from '../lib/text';
import { speak, stopSpeaking } from '../lib/tts';
import { MIC_STATUS_MESSAGES, RETRYABLE, useMic } from '../state/MicContext';
import { useProgress } from '../state/ProgressContext';
import { SimulationPanel } from './SimulationPanel';
import { SpeakControls } from './SpeakControls';
import { StandaloneDownload } from './StandaloneDownload';
import { Waveform } from './Waveform';

export const PASS_SCORE = 85;

interface Attempt {
  audioUrl: string | null;
  /** When simulated, this text is spoken as "your recording" in the voice comparison. */
  simulatedVoice: string | null;
  recognized: boolean;
  scoring: PronunciationResult | null;
  selfRated: boolean;
  /** Nothing was captured at all (silent mic, muted input): not scored, the learner is asked to retry. */
  noAudio: boolean;
  /** The recording exists but carries no usable sound (the browser gave the mic to speech recognition). */
  audioSilent: boolean;
  sttError: string | null;
  mode: CaptureMode;
}

/** Human explanation of why automatic scoring was not available. */
function sttReason(code: string | null, tr: (he: string, en: string) => string): string {
  switch (code) {
    case 'unsupported':
      return tr(
        'הדפדפן הזה לא תומך בזיהוי דיבור (למשל Firefox). ההקלטה וההשוואה עובדות; לציון אוטומטי פתחו ב-Chrome או ב-Safari.',
        'This browser has no speech recognition (e.g. Firefox). Recording and comparison work; for automatic scoring use Chrome or Safari.',
      );
    case 'network':
      return tr('זיהוי הדיבור דורש חיבור לאינטרנט (הוא רץ בשרתי Google/Apple).', 'Speech recognition needs an internet connection (it runs on Google/Apple servers).');
    case 'not-allowed':
    case 'service-not-allowed':
      return tr(
        'הדפדפן חסם את שירות זיהוי הדיבור (קורה ב-Brave, Edge ובמצב פרטי). ההקלטה עצמה עובדת – דרגו את עצמכם.',
        'The browser blocked its speech-recognition service (happens in Brave, Edge and private mode). Recording itself works – rate yourself.',
      );
    case 'language-not-supported':
      return tr('זיהוי הדיבור בדפדפן הזה לא תומך בפולנית. נסו Chrome.', 'Speech recognition in this browser does not support Polish. Try Chrome.');
    case 'audio-capture':
      return tr(
        'הדפדפן לא הצליח להפעיל זיהוי דיבור במקביל להקלטה. ההקלטה נשמרה – השוו קולות ודרגו את עצמכם.',
        'The browser could not run speech recognition alongside the recording. Your recording was kept – compare and rate yourself.',
      );
    default:
      return tr(
        'לא זוהו מילים בהקלטה. דברו קרוב יותר למיקרופון, בקול ברור, ונסו שוב – או דרגו את עצמכם.',
        'No words were recognized. Speak closer to the microphone, clearly, and try again – or rate yourself.',
      );
  }
}

interface Props {
  target: string;
  itemId?: string;
  articulationTip?: string;
  backchainingSteps?: readonly string[];
  /** Called once per finished attempt with the 0-100 score. */
  onResult?: (score: number) => void;
  /** Label above the mic button. */
  prompt?: string;
  /** Minimal-pair partner: warn when the transcript is closer to this word than to the target. */
  confusableWith?: string;
  /** Smaller layout for quick checks inside lists. */
  compact?: boolean;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function playAudioElement(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.currentTime = 0;
    audio.play().catch(() => resolve());
  });
}

export function PronunciationPractice({ target, itemId, articulationTip, backchainingSteps, onResult, prompt, confusableWith, compact = false }: Props) {
  const mic = useMic();
  const { tr, lang } = useLang();
  const { recordPronunciation } = useProgress();
  const recorder = useSpeechRecorder({ target });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [comparing, setComparing] = useState<'speaker' | 'you' | null>(null);
  const [simulating, setSimulating] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const finishAttempt = useCallback(
    (a: Attempt) => {
      setAttempt(a);
      if (a.scoring) {
        // Self-rated attempts have no word-level data, so only real or simulated transcripts feed sound tracking.
        const failed = a.selfRated ? [] : a.scoring.words.filter((w) => !w.matched).map((w) => w.word);
        recordPronunciation(itemId, target, a.scoring.score, failed);
        onResultRef.current?.(a.scoring.score);
      }
    },
    [itemId, target, recordPronunciation],
  );

  // Turn a finished real recording into an attempt.
  useEffect(() => {
    const r = recorder.result;
    if (!r) return;
    const noAudio = !r.recognized && !r.heardVoice && r.peakLevel < 0.01;
    const scoring = r.recognized ? scorePronunciation(target, r.transcript) : null;
    finishAttempt({
      audioUrl: r.audioUrl,
      simulatedVoice: null,
      recognized: r.recognized,
      scoring,
      selfRated: false,
      noAudio,
      audioSilent: !r.audioUrl || r.audioLost || r.peakLevel < 0.004,
      sttError: r.sttError,
      mode: r.mode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.result]);

  // Reset when the target phrase changes (e.g. next lesson step).
  const resetRecorder = recorder.reset;
  useEffect(() => {
    setAttempt(null);
    resetRecorder();
  }, [target, resetRecorder]);

  const simulate = async (transcript: string) => {
    setAttempt(null);
    setSimulating(true);
    await wait(1400);
    setSimulating(false);
    finishAttempt({
      audioUrl: null,
      simulatedVoice: transcript,
      recognized: true,
      scoring: scorePronunciation(target, transcript),
      selfRated: false,
      noAudio: false,
      audioSilent: false,
      sttError: null,
      mode: 'both',
    });
  };

  const selfRate = (good: boolean) => {
    if (!attempt) return;
    const score = good ? 90 : 50;
    finishAttempt({
      ...attempt,
      selfRated: true,
      scoring: { score, transcript: '', words: target.split(/\s+/).map((w) => ({ word: w, matched: good, similarity: good ? 1 : 0 })) },
    });
  };

  const compare = async () => {
    if (!attempt) return;
    let audio: HTMLAudioElement | null = null;
    if (attempt.audioUrl) {
      audio = new Audio(attempt.audioUrl);
      // iOS only allows audio.play() inside a user gesture. Unlock the element now (muted),
      // so the later play() after the TTS finishes is permitted.
      audio.muted = true;
      audio
        .play()
        .then(() => {
          audio!.pause();
          audio!.currentTime = 0;
          audio!.muted = false;
        })
        .catch(() => {
          audio!.muted = false;
        });
    }
    setComparing('speaker');
    await speak(target, 0.9);
    await wait(450);
    setComparing('you');
    if (audio) await playAudioElement(audio);
    else if (attempt.simulatedVoice) await speak(attempt.simulatedVoice, 0.8);
    setComparing(null);
  };

  const recording = recorder.status === 'recording' || recorder.status === 'starting';
  const processing = recorder.status === 'processing' || simulating;
  const score = attempt?.scoring?.score ?? null;
  const needsHelp = score !== null && score < PASS_SCORE;
  const canCompare = !!attempt && !attempt.noAudio && ((!!attempt.audioUrl && !attempt.audioSilent) || !!attempt.simulatedVoice);
  const heard = attempt?.scoring?.transcript ? normalize(attempt.scoring.transcript) : '';
  const soundedLikePartner = !!confusableWith && !!heard && similarity(heard, normalize(confusableWith)) > similarity(heard, normalize(target));

  const toggleRecording = () => {
    stopSpeaking();
    if (recording) recorder.stop();
    else {
      setAttempt(null);
      recorder.start();
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {mic.blocked && (
        <div className="space-y-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <p className="flex items-start gap-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {MIC_STATUS_MESSAGES[mic.status][lang]}
          </p>
          {RETRYABLE.includes(mic.status) && (
            <button
              type="button"
              onClick={() => {
                mic.retry();
                setAttempt(null);
                recorder.start();
              }}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white active:scale-95"
            >
              <RotateCcw className="size-4" /> {tr('נסו שוב', 'Try again')}
            </button>
          )}
          {(mic.status === 'blocked-frame' || mic.status === 'insecure' || mic.status === 'unsupported') && !compact && <StandaloneDownload variant="inline" />}
        </div>
      )}

      {!mic.blocked && (
        <div className="flex flex-col items-center gap-3">
          {prompt && <p className="text-center text-sm text-slate-600">{prompt}</p>}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={processing}
            className={`relative grid place-items-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-60 ${compact ? 'size-14' : 'size-20'} ${
              recording ? 'bg-rose-600' : 'bg-slate-900 hover:bg-slate-800'
            }`}
            aria-label={recording ? tr('עצור הקלטה', 'Stop recording') : tr('התחל הקלטה', 'Start recording')}
          >
            {recording && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" />}
            {processing ? <Loader2 className="size-8 animate-spin" /> : recording ? <Square className="size-7" /> : <Mic className={compact ? 'size-7' : 'size-9'} />}
          </button>
          <p className="text-sm font-medium text-slate-600">
            {recorder.status === 'starting' && tr('מפעיל מיקרופון…', 'Starting microphone…')}
            {recorder.status === 'recording' && tr('מקליט – הגו עכשיו, ולחצו שוב לסיום', 'Recording – speak now, tap again to finish')}
            {recorder.status === 'processing' && tr('מעבד את ההקלטה…', 'Processing…')}
            {(recorder.status === 'idle' || recorder.status === 'done') && !simulating && tr('לחצו על המיקרופון והגו בקול', 'Tap the microphone and speak aloud')}
          </p>
          {!speechRecognitionSupported && (
            <p className="text-center text-xs text-slate-500">
              {sttReason('unsupported', tr)}
              {isIOS && tr(' ב-iPhone ודאו ש-Siri והכתבה מופעלים בהגדרות.', ' On iPhone make sure Siri & Dictation are enabled in Settings.')}
            </p>
          )}
        </div>
      )}

      {(recording || simulating) && <Waveform analyserRef={recorder.analyserRef} active simulated={simulating || !recorder.analyserRef.current} />}
      {recording && !simulating && (
        <div className="space-y-1" aria-live="polite">
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-200"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(recorder.level * 100)}
            aria-label={tr('עוצמת קול', 'Input level')}
          >
            <div className={`h-full rounded-full transition-[width] duration-75 ${recorder.heardVoice ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.max(3, recorder.level * 100)}%` }} />
          </div>
          <p className={`text-center text-xs font-medium ${recorder.heardVoice ? 'text-emerald-700' : 'text-slate-500'}`}>
            {recorder.analyserDead
              ? tr('מד העוצמה לא זמין בדפדפן הזה כרגע – דברו, ובסיום לחצו "סיימתי לדבר".', 'The level meter is unavailable in this browser right now – speak, then tap "I\'m done speaking".')
              : recorder.heardVoice
                ? tr('שומעים אתכם – ההקלטה תיעצר לבד כשתסיימו', 'We hear you – recording stops by itself when you finish')
                : tr('מחכים לקול שלכם… אם הפס לא זז, המיקרופון לא קולט', 'Waiting for your voice… if the bar does not move, the mic is not picking up')}
          </p>
          {/* Always offer a manual stop so the learner never depends on silence detection. */}
          <button
            type="button"
            onClick={() => recorder.stop('manual')}
            className="mx-auto mt-1 flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-md active:scale-95"
          >
            <Square className="size-4 fill-white" /> {tr('סיימתי לדבר (עצור הקלטה)', "I'm done speaking (stop recording)")}
          </button>
        </div>
      )}
      {recording && recorder.interim && (
        <p dir="ltr" lang="pl" className="polish text-center text-lg text-slate-500">
          {recorder.interim}…
        </p>
      )}

      {mic.simulation && <SimulationPanel target={target} onSimulate={simulate} disabled={processing || recording} />}

      {attempt?.noAudio && (
        <div className="animate-pop-in space-y-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200" role="alert">
          <p className="flex items-start gap-2 text-sm font-bold text-rose-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {tr('לא נקלט קול בהקלטה.', 'No sound was captured.')}
          </p>
          <ul className="list-disc space-y-1 ps-5 text-sm text-rose-900">
            <li>{tr('ודאו שהמיקרופון לא מושתק ושהדפדפן קיבל הרשאה.', 'Check the microphone is not muted and the browser has permission.')}</li>
            <li>{tr('דברו מיד אחרי הלחיצה, קרוב לטלפון.', 'Start speaking right after tapping, close to the phone.')}</li>
            <li>{tr('בהגדרות ← "בדיקת מיקרופון" אפשר לראות מה הדפדפן קולט.', 'Settings → "Microphone test" shows what the browser picks up.')}</li>
          </ul>
          <button type="button" onClick={toggleRecording} className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white active:scale-95">
            <RotateCcw className="size-4" /> {tr('נסו שוב', 'Try again')}
          </button>
        </div>
      )}

      {attempt && !attempt.noAudio && (
        <div className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          {attempt.scoring ? (
            <ScoreView scoring={attempt.scoring} selfRated={attempt.selfRated} />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">{sttReason(attempt.sttError, tr)}</p>
              <p className="text-sm font-medium text-slate-800">
                {tr('האזינו להשוואה הקולית ודרגו את עצמכם בכנות:', 'Listen to the voice comparison and rate yourself honestly:')}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => selfRate(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <ThumbsUp className="size-4" /> {tr('נשמע כמו הדובר', 'Sounds like the speaker')}
                </button>
                <button type="button" onClick={() => selfRate(false)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-50 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
                  <ThumbsDown className="size-4" /> {tr('צריך עוד תרגול', 'Needs more practice')}
                </button>
              </div>
            </div>
          )}

          {soundedLikePartner && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {tr('זה נשמע יותר כמו', 'That sounded more like')}{' '}
                <strong dir="ltr" lang="pl" className="polish">
                  {confusableWith}
                </strong>{' '}
                {tr('מאשר', 'than')}{' '}
                <strong dir="ltr" lang="pl" className="polish">
                  {target}
                </strong>
                . {tr('שימו לב למיקום הלשון בצליל המבדיל.', 'Watch the tongue position on the sound that differs.')}
              </span>
            </p>
          )}

          {!canCompare && (
            <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
              {attempt.mode === 'stt'
                ? tr(
                    'במצב "זיהוי דיבור בלבד" לא נשמרת הקלטה, ולכן אין השוואת קולות. כדי לשמוע את עצמכם בחרו בהגדרות ← מצב הקלטה אחר.',
                    'In "speech recognition only" mode no audio is kept, so there is no voice comparison. To hear yourself, pick another capture mode in Settings.',
                  )
                : tr(
                    'הדפדפן לא שמר את הקול שלכם במקביל לזיהוי הדיבור, ולכן אי אפשר להשמיע את ההקלטה. הציון מבוסס על הזיהוי.',
                    'The browser did not keep your audio while recognizing speech, so your recording cannot be played back. The score is based on recognition.',
                  )}
            </p>
          )}

          <button
            type="button"
            onClick={compare}
            hidden={!canCompare}
            disabled={comparing !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-rose-600 to-orange-500 px-4 py-3.5 text-base font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-80"
          >
            {comparing === null && <Headphones className="size-5" aria-hidden />}
            {comparing === 'speaker' && <Ear className="size-5 animate-pulse" aria-hidden />}
            {comparing === 'you' && <Mic className="size-5 animate-pulse" aria-hidden />}
            {comparing === null && tr('השווה קולות (שמע את עצמך מול הדובר)', 'Compare voices (you vs. the speaker)')}
            {comparing === 'speaker' && tr('משמיע: הדובר הפולני…', 'Playing: the Polish speaker…')}
            {comparing === 'you' &&
              (attempt.simulatedVoice ? tr('משמיע: ההקלטה המדומה שלך…', 'Playing: your simulated recording…') : tr('משמיע: ההקלטה שלך…', 'Playing: your recording…'))}
          </button>

          {!mic.blocked && (
            <button type="button" onClick={toggleRecording} className="mx-auto flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
              <RotateCcw className="size-4" /> {tr('נסו שוב', 'Try again')}
            </button>
          )}

          {needsHelp && (articulationTip || backchainingSteps) && (
            <div className="space-y-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              {articulationTip && (
                <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-900">
                  <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <strong>{tr('איך למקם את הלשון והשפתיים: ', 'Tongue & lip position: ')}</strong>
                    {articulationTip}
                  </span>
                </p>
              )}
              {backchainingSteps && <SpeakControls text={target} backchainingSteps={backchainingSteps} compact />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreView({ scoring, selfRated }: { scoring: PronunciationResult; selfRated: boolean }) {
  const { tr } = useLang();
  const { score } = scoring;
  const color = score >= PASS_SCORE ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-rose-600';
  const ring = score >= PASS_SCORE ? 'stroke-emerald-500' : score >= 60 ? 'stroke-amber-500' : 'stroke-rose-500';
  const circumference = 2 * Math.PI * 26;
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-16 shrink-0">
        <svg viewBox="0 0 60 60" className="size-16 -rotate-90">
          <circle cx="30" cy="30" r="26" className="fill-none stroke-slate-100" strokeWidth="6" />
          <circle
            cx="30"
            cy="30"
            r="26"
            className={`fill-none ${ring} transition-all duration-700`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
          />
        </svg>
        <span className={`absolute inset-0 grid place-items-center text-base font-bold ${color}`}>{score}%</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={`text-sm font-bold ${color}`}>
          {selfRated
            ? tr('הערכה עצמית', 'Self-assessment')
            : score >= PASS_SCORE
              ? tr('מצוין! הגייה ברורה', 'Excellent! Clear pronunciation')
              : score >= 60
                ? tr('קרוב – עוד קצת דיוק', 'Close – a bit more precision')
                : tr('בואו נפרק ונתרגל', "Let's break it down and practise")}
        </p>
        <p dir="ltr" lang="pl" className="polish flex flex-wrap gap-x-2 text-xl font-semibold">
          {scoring.words.map((w, i) => (
            <span key={i} className={w.matched ? 'text-emerald-600' : 'text-rose-600 underline decoration-rose-300 decoration-wavy'}>
              {w.word}
            </span>
          ))}
        </p>
        {!selfRated && (
          <p className="truncate text-xs text-slate-500">
            {tr('זוהה:', 'Heard:')}{' '}
            <span dir="ltr" lang="pl" className="polish">
              {scoring.transcript || '—'}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
