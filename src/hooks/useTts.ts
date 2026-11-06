import { useCallback, useEffect, useRef, useState } from 'react';
import { RATE_CHAIN, RATE_NORMAL, RATE_SLOW, loadVoices, speak, speakSequence, stopSpeaking } from '../lib/tts';

export type TtsMode = 'normal' | 'slow' | 'chain' | null;

/** React wrapper around the TTS engine exposing the three playback modes. */
export function useTts() {
  const [mode, setMode] = useState<TtsMode>(null);
  const [chainIndex, setChainIndex] = useState(-1);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadVoices();
    return () => {
      mounted.current = false;
      stopSpeaking();
    };
  }, []);

  const run = useCallback(async (m: Exclude<TtsMode, null>, job: () => Promise<unknown>) => {
    stopSpeaking();
    setMode(m);
    await job();
    if (mounted.current) {
      setMode(null);
      setChainIndex(-1);
    }
  }, []);

  const playNormal = useCallback((text: string) => run('normal', () => speak(text, RATE_NORMAL)), [run]);
  const playSlow = useCallback((text: string) => run('slow', () => speak(text, RATE_SLOW)), [run]);
  const playChain = useCallback(
    (steps: readonly string[]) =>
      run('chain', () => speakSequence([...steps], RATE_CHAIN, (i) => mounted.current && setChainIndex(i))),
    [run],
  );
  const stop = useCallback(() => {
    stopSpeaking();
    setMode(null);
    setChainIndex(-1);
  }, []);

  return { mode, chainIndex, playNormal, playSlow, playChain, stop };
}
