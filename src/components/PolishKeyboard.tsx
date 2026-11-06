import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { ArrowBigUp, Delete, Space } from 'lucide-react';
import { useLang } from '../i18n/LangContext';

const LETTERS = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'];
const DIGRAPHS = ['sz', 'cz', 'rz', 'dz', 'dź', 'dż', 'ch'];

interface Props {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Touch-friendly helper keyboard with Polish special letters and common digraphs.
 * Inserts at the caret position of the linked input. Buttons use onPointerDown + preventDefault
 * so the input keeps focus (and the caret) on both desktop and mobile.
 */
export function PolishKeyboard({ inputRef, value, onChange }: Props) {
  const [shift, setShift] = useState(false);
  const { tr } = useLang();

  const insert = (text: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const chunk = shift ? text.charAt(0).toLocaleUpperCase('pl-PL') + text.slice(1) : text;
    const next = value.slice(0, start) + chunk + value.slice(end);
    onChange(next);
    setShift(false);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + chunk.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const backspace = () => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    if (start === 0 && end === 0) return;
    const from = start === end ? start - 1 : start;
    onChange(value.slice(0, from) + value.slice(end));
    requestAnimationFrame(() => el?.setSelectionRange(from, from));
  };

  const keyCls =
    'polish grid h-12 place-items-center rounded-xl bg-white text-xl font-semibold text-slate-900 shadow-[0_2px_0_rgba(15,23,42,0.15)] ring-1 ring-slate-200 active:translate-y-0.5 active:shadow-none active:bg-rose-50';
  const press = (fn: () => void) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      fn();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
      }
    },
  });

  return (
    <div className="space-y-2 rounded-2xl bg-slate-200/70 p-2" dir="ltr" aria-label={tr('מקלדת עזר פולנית', 'Polish helper keyboard')}>
      <div className="grid grid-cols-9 gap-1.5">
        {LETTERS.map((l) => (
          <button key={l} type="button" className={keyCls} {...press(() => insert(l))}>
            {shift ? l.toLocaleUpperCase('pl-PL') : l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        <button type="button" aria-label={tr('אות גדולה', 'Shift')} className={`${keyCls} col-span-1 ${shift ? '!bg-rose-600 !text-white' : ''}`} {...press(() => setShift((s) => !s))}>
          <ArrowBigUp className="size-5" />
        </button>
        {DIGRAPHS.map((d) => (
          <button key={d} type="button" className={`${keyCls} text-base`} {...press(() => insert(d))}>
            {shift ? d.charAt(0).toUpperCase() + d.slice(1) : d}
          </button>
        ))}
        <button type="button" aria-label={tr('רווח', 'Space')} className={keyCls} {...press(() => insert(' '))}>
          <Space className="size-5" />
        </button>
        <button type="button" aria-label={tr('מחיקה', 'Backspace')} className={keyCls} {...press(backspace)}>
          <Delete className="size-5" />
        </button>
      </div>
    </div>
  );
}
