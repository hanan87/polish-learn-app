import { useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { getCapturePreference, getLearnedMode, learnMode, resolveCaptureMode, setCapturePreference, sttAvailable, type CapturePreference } from '../lib/captureMode';

/** Lets the learner choose how pronunciation attempts use the microphone. */
export function CaptureModeSetting() {
  const { tr } = useLang();
  const [pref, setPref] = useState<CapturePreference>(getCapturePreference);
  const [, force] = useState(0);
  const learned = getLearnedMode();
  const active = resolveCaptureMode();

  const options: { value: CapturePreference; title: string; desc: string; disabled?: boolean }[] = [
    {
      value: 'auto',
      title: tr('אוטומטי (מומלץ)', 'Automatic (recommended)'),
      desc: tr('ההקלטה והזיהוי פועלים יחד, ואם זה נכשל במכשיר – המצב מתחלף לבד ונשמר.', 'Recording and recognition run together; if that fails on this device the mode switches by itself and is remembered.'),
    },
    {
      value: 'both',
      title: tr('הקלטה + זיהוי דיבור', 'Recording + speech recognition'),
      desc: tr('ציון אוטומטי, מד עוצמה והשוואת קולות. עובד הכי טוב במחשב.', 'Automatic score, level meter and voice comparison. Works best on desktop.'),
      disabled: !sttAvailable(),
    },
    {
      value: 'stt',
      title: tr('זיהוי דיבור בלבד', 'Speech recognition only'),
      desc: tr('ציון אוטומטי, בלי שמירת הקול שלכם. האמין ביותר בטלפונים שלא מאפשרים שימוש כפול במיקרופון.', 'Automatic score without keeping your audio. Most reliable on phones that cannot share the microphone.'),
      disabled: !sttAvailable(),
    },
    {
      value: 'record',
      title: tr('הקלטה בלבד', 'Recording only'),
      desc: tr('שמירת הקול והשוואה לדובר, עם הערכה עצמית במקום ציון.', 'Keeps your audio for comparison with the speaker; self-assessment instead of a score.'),
    },
  ];

  const labelOf = (m: string) => options.find((o) => o.value === m)?.title ?? m;

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            aria-pressed={pref === o.value}
            onClick={() => {
              setCapturePreference(o.value);
              setPref(o.value);
            }}
            className={`rounded-xl p-3 text-start ring-1 transition disabled:opacity-40 ${pref === o.value ? 'bg-rose-50 ring-2 ring-rose-500' : 'bg-slate-50 ring-slate-200'}`}
          >
            <span className="block text-sm font-bold">{o.title}</span>
            <span className="block text-xs text-slate-600">{o.desc}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {tr('פעיל עכשיו:', 'Active now:')} <strong>{labelOf(active)}</strong>
        {pref === 'auto' && learned && (
          <>
            {' · '}
            {tr('נבחר אוטומטית לפי ניסיונות קודמים.', 'chosen automatically from earlier attempts.')}{' '}
            <button
              type="button"
              className="font-bold text-indigo-700 underline"
              onClick={() => {
                learnMode(null);
                force((x) => x + 1);
              }}
            >
              {tr('אפס זיהוי', 'Reset detection')}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
