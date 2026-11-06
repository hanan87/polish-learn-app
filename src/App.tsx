import { useEffect, useState, useSyncExternalStore } from 'react';
import { clipCount, subscribeManifest } from './lib/voiceClips';
import { getItem } from './data';
import { BottomNav, TABS, type TabId } from './components/BottomNav';
import { ItemDetail } from './components/ItemDetail';
import { Sheet } from './components/Sheet';
import { StandaloneDownload } from './components/StandaloneDownload';
import { TopBar } from './components/TopBar';
import { useHashRoute } from './hooks/useHashRoute';
import { useLang } from './i18n/LangContext';
import { LessonPlayer } from './lesson/LessonPlayer';
import { ttsSupported } from './lib/env';
import { hasPolishVoice, loadVoices } from './lib/tts';
import { useMic } from './state/MicContext';
import { useProgress } from './state/ProgressContext';
import { CourseMap } from './views/CourseMap';
import { Roleplay } from './views/Roleplay';
import { Settings } from './views/Settings';
import { SoundLab } from './views/SoundLab';
import { VocabReview } from './views/VocabReview';
import { Welcome } from './views/Welcome';
import { HandsFree } from './views/HandsFree';
import { SpeedBlitz } from './views/SpeedBlitz';
import { StoryPlayer } from './views/StoryPlayer';
import { getStory } from './data/stories';
import { KasiaAngel } from './components/KasiaAngel';

const TAB_IDS = TABS.map((t) => t.id);

/**
 * Routes:
 *   #/map | #/lab | #/vocab | #/talk          – tabs
 *   #/<tab>/item/<itemId>                      – item sheet on top of a tab
 *   #/<tab>/settings                           – settings sheet
 *   #/lab/group/<groupId>                      – Sound Lab opened on a contrast group
 *   #/lesson/<lessonId>                        – full-screen lesson
 *   #/lesson/practice                          – personalized reinforcement lesson
 *   #/handsfree/<map|vocab>                    – audio-only trainer
 *   #/story/<storyId>                          – mini story
 *   #/blitz                                    – 60-second Speed Blitz
 *   #/<tab>/kasia                              – "Dla Kasi" dedication screen
 */
export function App() {
  const { segments, navigate } = useHashRoute('map');
  const { dueItemIds } = useProgress();
  const { lang, unset, tr } = useLang();
  const mic = useMic();
  const [voiceMissing, setVoiceMissing] = useState(false);
  const clips = useSyncExternalStore(subscribeManifest, clipCount);

  useEffect(() => {
    if (!ttsSupported) return;
    loadVoices(2500).then(() => setVoiceMissing(!hasPolishVoice()));
  }, []);

  if (unset) return <Welcome />;

  const isLesson = segments[0] === 'lesson' && segments[1];
  const tab: TabId = (TAB_IDS as string[]).includes(segments[0]) ? (segments[0] as TabId) : 'map';
  const itemId = segments[1] === 'item' ? segments[2] : undefined;
  const item = itemId ? getItem(itemId) : undefined;
  const settingsOpen = segments[1] === 'settings';
  const kasiaOpen = segments[1] === 'kasia';

  const openItem = (id: string) => navigate(`${tab}/item/${id}`);
  const closeSheet = () => navigate(tab, true);
  const tabInfo = TABS.find((t) => t.id === tab)!;

  if (segments[0] === 'handsfree') {
    const source = segments[1] === 'vocab' ? 'vocab' : 'map';
    return <HandsFree key={source} source={source} onExit={() => navigate(source, true)} />;
  }
  if (segments[0] === 'blitz') return <SpeedBlitz onExit={() => navigate('vocab', true)} />;
  const story = segments[0] === 'story' ? getStory(segments[1] ?? '') : undefined;
  if (story) return <StoryPlayer key={story.id} story={story} onExit={() => navigate('talk', true)} />;

  if (isLesson) {
    return <LessonPlayer key={segments[1]} lessonId={segments[1]} onClose={() => navigate(segments[1] === 'practice' ? 'vocab' : 'map', true)} />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {mic.blocked && mic.status !== 'no-device' && <StandaloneDownload />}
      <TopBar title={tabInfo[lang]} onOpenSettings={() => navigate(`${tab}/settings`)} onOpenKasia={() => navigate(`${tab}/kasia`)} />
      {voiceMissing && clips === 0 && (
        <p className="mx-auto mt-3 w-full max-w-3xl px-4 text-xs leading-relaxed text-slate-500">
          {tr(
            'לא נמצא קול פולני במכשיר – ההקראה עשויה להישמע במבטא זר. באנדרואיד: הגדרות ← שפה ← המרת טקסט לדיבור ← התקינו פולנית. ב-iPhone: הגדרות ← נגישות ← תוכן מוקרא ← קולות ← פולנית.',
            'No Polish voice was found on this device – playback may sound foreign. Android: Settings → Language → Text-to-speech → install Polish. iPhone: Settings → Accessibility → Spoken Content → Voices → Polish.',
          )}
        </p>
      )}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">
        {tab === 'map' && <CourseMap onOpenLesson={(id) => navigate(`lesson/${id}`)} onOpenItem={openItem} onOpenHandsFree={() => navigate('handsfree/map')} />}
        {tab === 'lab' && <SoundLab key={segments[2] ?? 'lab'} onOpenItem={openItem} initialGroup={segments[1] === 'group' ? segments[2] : undefined} />}
        {tab === 'vocab' && <VocabReview
            onOpenItem={openItem}
            onStartPractice={() => navigate('lesson/practice')}
            onOpenSoundGroup={(g) => navigate(`lab/group/${g}`)}
            onOpenHandsFree={() => navigate('handsfree/vocab')}
            onOpenBlitz={() => navigate('blitz')}
          />}
        {tab === 'talk' && <Roleplay onOpenStory={(id) => navigate(`story/${id}`)} />}
      </main>
      <BottomNav active={tab} onChange={(t) => navigate(t)} dueCount={dueItemIds().length} />
      <Sheet open={!!item} onClose={closeSheet} title={item?.polish}>
        {item && <ItemDetail key={item.id} item={item} />}
      </Sheet>
      {kasiaOpen && <KasiaAngel onClose={closeSheet} />}
      <Sheet open={settingsOpen} onClose={closeSheet} title={tr('הגדרות', 'Settings')}>
        <Settings />
      </Sheet>
    </div>
  );
}
