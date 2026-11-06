import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
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
  // Caret position to restore after React re-renders the controlled input with the new value.
  const pendingCaret = useRef<number | null>(null);
  // Latest text, updated synchronously on every tap so quick taps never work on a stale value.
  const valueRef = useRef(value);
  valueRef.current = value;

  // Runs synchronously after the DOM update, before the browser handles the next key tap –
  // so two fast taps both land at the caret instead of the second one jumping to the end.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value, inputRef]);

  const selection = () => {
    const el = inputRef.current;
    const len = valueRef.current.length;
    const start = pendingCaret.current ?? el?.selectionStart ?? len;
    const end = pendingCaret.current ?? el?.selectionEnd ?? len;
    return [start, end] as const;
  };

  const insert = (text: string) => {
    const [start, end] = selection();
    const chunk = shift ? text.charAt(0).toLocaleUpperCase('pl-PL') + text.slice(1) : text;
    const current = valueRef.current;
    const next = current.slice(0, start) + chunk + current.slice(end);
    pendingCaret.current = start + chunk.length;
    valueRef.current = next;
    onChange(next);
    setShift(false);
  };

  const backspace = () => {
    const [start, end] = selection();
    if (start === 0 && end === 0) return;
    const from = start === end ? start - 1 : start;
    const current = valueRef.current;
    const next = current.slice(0, from) + current.slice(end);
    pendingCaret.current = from;
    valueRef.current = next;
    onChange(next);
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
