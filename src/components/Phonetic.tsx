import { useLang } from '../i18n/LangContext';
import { parseSyllables } from '../lib/syllables';

interface Props {
  /** Hebrew transcription (niqqud) in the syllable notation. */
  he: string;
  /** English respelling in the syllable notation. */
  en: string;
  size?: 'lg' | 'md' | 'sm';
  className?: string;
}

const SIZES = { lg: 'text-2xl', md: 'text-xl', sm: 'text-base' } as const;

/**
 * Phonetic transcription for the active language:
 *  - he: vocalized Hebrew, RTL, stressed syllable in the accent color
 *  - en: English respelling, LTR, stressed syllable UPPER-CASED and colored ("jen-KOO-yeh")
 */
export function Phonetic({ he, en, size = 'md', className = '' }: Props) {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const words = parseSyllables(isHe ? he : en);
  return (
    <p
      dir={isHe ? 'rtl' : 'ltr'}
      lang={isHe ? 'he' : 'en'}
      className={`${isHe ? 'phonetic' : 'font-mono tracking-wide'} leading-loose text-slate-700 ${SIZES[size]} ${className}`}
    >
      {words.map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap">
          {word.map((syl, si) => (
            <span key={si}>
              {si > 0 && <span className="mx-[0.1em] text-slate-300">-</span>}
              <span className={syl.stressed ? 'font-bold text-rose-600' : ''}>{!isHe && syl.stressed ? syl.text.toUpperCase() : syl.text}</span>
            </span>
          ))}
          {wi < words.length - 1 && <span>&nbsp;&nbsp;</span>}
        </span>
      ))}
    </p>
  );
}
