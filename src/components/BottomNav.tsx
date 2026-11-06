import { AudioLines, BookOpenCheck, Map, MessagesSquare, type LucideIcon } from 'lucide-react';
import { useLang } from '../i18n/LangContext';

export type TabId = 'map' | 'lab' | 'vocab' | 'talk';

export const TABS: { id: TabId; he: string; en: string; icon: LucideIcon }[] = [
  { id: 'map', he: 'מפת הקורס', en: 'Course map', icon: Map },
  { id: 'lab', he: 'מעבדת צלילים', en: 'Sound lab', icon: AudioLines },
  { id: 'vocab', he: 'אוצר מילים וחזרה', en: 'Words & review', icon: BookOpenCheck },
  { id: 'talk', he: 'סימולציית שיחה', en: 'Voice roleplay', icon: MessagesSquare },
];

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  dueCount: number;
}

/** Fixed bottom navigation, sized for thumb reach on phones and centered on desktop. */
export function BottomNav({ active, onChange, dueCount }: Props) {
  const { lang, tr } = useLang();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80" aria-label={tr('ניווט ראשי', 'Main navigation')}>
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {TABS.map(({ id, icon: Icon, ...labels }) => {
          const isActive = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] leading-tight font-medium transition sm:text-xs ${
                  isActive ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition ${isActive ? 'bg-rose-100' : ''}`}>
                  <Icon className="size-5" aria-hidden strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span className="text-center">{labels[lang]}</span>
                {id === 'vocab' && dueCount > 0 && (
                  <span className="absolute top-1.5 left-1/2 ms-4 min-w-5 rounded-full bg-rose-600 px-1.5 text-[10px] leading-5 font-bold text-white">{dueCount}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
