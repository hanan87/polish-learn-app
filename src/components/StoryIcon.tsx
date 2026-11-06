import { BookOpen, Coffee, CookingPot, Ticket, Umbrella, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'kawa-dla-kota': Coffee,
  'pierogi-babci': CookingPot,
  'gdzie-jest-bilet': Ticket,
  parasol: Umbrella,
};

/** Line icon for a mini story (one icon family across the app – no emoji). */
export function StoryIcon({ id, className = 'size-5' }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}
