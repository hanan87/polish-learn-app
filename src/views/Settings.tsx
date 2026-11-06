import { useRef, useState } from 'react';
import { Download, FileJson, Mic, Moon, RotateCcw, Smartphone, Target, Upload } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { useTheme, type ThemeChoice } from '../i18n/ThemeContext';
import { MicTest } from '../components/MicTest';
import { isStandaloneBuild } from '../lib/env';
import { todayKey } from '../lib/date';
import { useProgress } from '../state/ProgressContext';
import { StandaloneDownload } from '../components/StandaloneDownload';
import { LangSwitch } from '../components/TopBar';

/** Settings: language, daily goal, standalone download, JSON backup/restore and reset. */
export function Settings() {
  const { tr } = useLang();
  const theme = useTheme();
  const { state, setDailyGoal, exportJson, importJson, resetAll } = useProgress();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const backup = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polish-learn-backup-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMessage({ ok: true, text: tr('קובץ הגיבוי נוצר. העבירו אותו למכשיר השני ושחזרו משם.', 'Backup file created. Move it to your other device and restore it there.') });
  };

  const restore = async (file: File) => {
    const text = await file.text();
    const ok = importJson(text);
    setMessage(
      ok
        ? { ok: true, text: tr('ההתקדמות שוחזרה בהצלחה!', 'Progress restored successfully!') }
        : { ok: false, text: tr('הקובץ אינו גיבוי תקין של האפליקציה.', 'This file is not a valid backup of the app.') },
    );
  };

  const card = 'space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200';
  const btn = 'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold active:scale-[0.98]';

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-xl font-black">{tr('הגדרות', 'Settings')}</h2>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">{tr('שפת ממשק ולימוד', 'Interface & learning language')}</p>
            <p className="text-xs text-slate-500">
              {tr('עברית: תרגומים, תעתיק מנוקד וטיפים בעברית. English: translations, respelling and tips in English.', 'עברית: Hebrew translations, vocalized transcription and tips. English: English translations, respelling and tips.')}
            </p>
          </div>
          <LangSwitch />
        </div>
      </section>

      <section className={card}>
        <p className="flex items-center gap-1.5 font-bold">
          <Moon className="size-4 text-indigo-600" /> {tr('ערכת צבעים', 'Color theme')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['light', tr('בהיר', 'Light')],
              ['dark', tr('כהה', 'Dark')],
              ['system', tr('לפי המכשיר', 'Device')],
            ] as [ThemeChoice, string][]
          ).map(([c, label]) => (
            <button
              key={c}
              type="button"
              onClick={() => theme.setChoice(c)}
              aria-pressed={theme.choice === c}
              className={`rounded-xl py-2.5 text-sm font-bold ring-1 ${theme.choice === c ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-slate-50 ring-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <p className="flex items-center gap-1.5 font-bold">
          <Mic className="size-4 text-rose-600" /> {tr('בדיקת מיקרופון', 'Microphone test')}
        </p>
        <MicTest />
      </section>

      <section className={card}>
        <p className="flex items-center gap-1.5 font-bold">
          <Target className="size-4 text-emerald-600" /> {tr('יעד יומי', 'Daily goal')}
        </p>
        <div className="grid grid-cols-4 gap-2" dir="ltr">
          {[20, 50, 100, 150].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setDailyGoal(g)}
              className={`rounded-xl py-2.5 text-sm font-bold ring-1 ${state.dailyGoal === g ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-slate-50 ring-slate-200'}`}
            >
              {g} XP
            </button>
          ))}
        </div>
      </section>

      {!isStandaloneBuild && (
        <section className={card}>
          <p className="flex items-center gap-1.5 font-bold">
            <Smartphone className="size-4 text-rose-600" /> {tr('אפליקציה עצמאית', 'Standalone app')}
          </p>
          <p className="text-sm text-slate-600">
            {tr(
              'קובץ index.html יחיד שכולל את כל האפליקציה (React, Tailwind, פונטים ואייקון). פתחו אותו ב-Chrome או ב-Safari – המיקרופון וההקלטה יעבדו במלואם. אפשר גם להתקין את האתר כאפליקציה: בתפריט הדפדפן בחרו "הוסף למסך הבית".',
              'A single index.html file containing the whole app (React, Tailwind, fonts and icon). Open it in Chrome or Safari and the microphone and recording work fully. You can also install the site as an app: choose "Add to Home Screen" in the browser menu.',
            )}
          </p>
          <StandaloneDownload variant="inline" />
        </section>
      )}

      <section className={card}>
        <p className="flex items-center gap-1.5 font-bold">
          <FileJson className="size-4 text-sky-600" /> {tr('גיבוי ושחזור התקדמות', 'Backup & restore progress')}
        </p>
        <p className="text-sm text-slate-600">
          {tr(
            'שמרו את כל ההתקדמות (XP, רצף, היסטוריית מילים וצלילים, המילון האישי) לקובץ JSON, ושחזרו אותו בטלפון או במחשב אחר.',
            'Save all progress (XP, streak, word and sound history, personal dictionary) to a JSON file and restore it on another phone or computer.',
          )}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={backup} className={`${btn} bg-sky-600 text-white`}>
            <Download className="size-4" /> {tr('הורד קובץ גיבוי', 'Download backup')}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={`${btn} bg-sky-50 text-sky-800 ring-1 ring-sky-200`}>
            <Upload className="size-4" /> {tr('שחזר מקובץ', 'Restore from file')}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) restore(f);
            e.target.value = '';
          }}
        />
        {message && <p className={`rounded-xl p-2.5 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{message.text}</p>}
      </section>

      <section className={card}>
        <p className="flex items-center gap-1.5 font-bold text-rose-700">
          <RotateCcw className="size-4" /> {tr('איפוס התקדמות', 'Reset progress')}
        </p>
        {confirmReset ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                resetAll();
                setConfirmReset(false);
                setMessage({ ok: true, text: tr('ההתקדמות אופסה.', 'Progress was reset.') });
              }}
              className={`${btn} bg-rose-600 text-white`}
            >
              {tr('כן, למחוק הכל', 'Yes, erase everything')}
            </button>
            <button type="button" onClick={() => setConfirmReset(false)} className={`${btn} bg-slate-100`}>
              {tr('ביטול', 'Cancel')}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)} className={`${btn} w-full bg-rose-50 text-rose-700 ring-1 ring-rose-200`}>
            {tr('אפס את כל ההתקדמות', 'Reset all progress')}
          </button>
        )}
      </section>
    </div>
  );
}
