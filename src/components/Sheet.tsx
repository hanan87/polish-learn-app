import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLang } from '../i18n/LangContext';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Bottom sheet on phones, centered dialog on wider screens. */
export function Sheet({ open, onClose, title, children }: Props) {
  const { tr } = useLang();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label={tr('סגירה', 'Close')} />
      <div className="animate-pop-in pb-safe relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-slate-50 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden />
        </div>
        <div className="absolute end-2 top-2">
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-200" aria-label={tr('סגירה', 'Close')}>
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pt-2 pb-6 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
