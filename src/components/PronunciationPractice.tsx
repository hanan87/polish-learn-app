import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ear, Headphones, Lightbulb, Loader2, Mic, RotateCcw, Square, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useSpeechRecorder } from '../hooks/useSpeechRecorder';
import { useLang } from '../i18n/LangContext';
import { isIOS, speechRecognitionSupported } from '../lib/env';
import { normalize, scorePronunciation, similarity, type PronunciationResult } from '../lib/text';
import { speak, stopSpeaking } from '../lib/tts';
import { MIC_STATUS_MESSAGES, useMic } from '../state/MicContext';
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
    const scoring = r.recognized ? scorePronunciation(target, r.transcript) : null;
    finishAttempt({ audioUrl: r.audioUrl, simulatedVoice: null, recognized: r.recognized, scoring, selfRated: false });
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
    finishAttempt({ audioUrl: null, simulatedVoice: transcript, recognized: true, scoring: scorePronunciation(target, transcript), selfRated: false });
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
          {mic.status !== 'no-device' && !compact && <StandaloneDownload variant="inline" />}
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
              {tr(
                'הדפדפן לא תומך בזיהוי דיבור – ההקלטה וההשוואה הקולית יעבדו, והציון יהיה בהערכה עצמית.',
                'This browser has no speech recognition – recording and voice comparison work, scoring is by self-assessment.',
              )}
              {isIOS && tr(' ב-iPhone ודאו ש-Siri והכתבה מופעלים בהגדרות.', ' On iPhone make sure Siri & Dictation are enabled in Settings.')}
            </p>
          )}
          {recorder.error === 'android-audio-capture' && (
            <p className="text-center text-xs text-amber-700">
              {tr(
                'באנדרואיד, זיהוי הדיבור לא הצליח לגשת למיקרופון במקביל להקלטה. ההקלטה נשמרה – השתמשו בהשוואה הקולית ובהערכה עצמית.',
                'On Android, speech recognition could not share the microphone with the recorder. Your recording was kept – use the voice comparison and self-assessment.',
              )}
            </p>
          )}
        </div>
      )}

      {(recording || simulating) && <Waveform analyserRef={recorder.analyserRef} active simulated={simulating || !recorder.analyserRef.current} />}
      {recording && recorder.interim && (
        <p dir="ltr" lang="pl" className="polish text-center text-lg text-slate-500">
          {recorder.interim}…
        </p>
      )}

      {mic.simulation && <SimulationPanel target={target} onSimulate={simulate} disabled={processing || recording} />}

      {attempt && (
        <div className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          {attempt.scoring ? (
            <ScoreView scoring={attempt.scoring} selfRated={attempt.selfRated} />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                {tr('לא התקבל תמלול אוטומטי. האזינו להשוואה הקולית ודרגו את עצמכם בכנות:', 'No automatic transcript. Listen to the voice comparison and rate yourself honestly:')}
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

          <button
            type="button"
            onClick={compare}
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
