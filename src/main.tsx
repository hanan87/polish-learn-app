import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-hebrew/400.css';
import '@fontsource/ibm-plex-sans-hebrew/500.css';
import '@fontsource/ibm-plex-sans-hebrew/600.css';
import '@fontsource/ibm-plex-sans-hebrew/700.css';
import '@fontsource-variable/frank-ruhl-libre';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';
import { App } from './App';
import { LangProvider } from './i18n/LangContext';
import { ThemeProvider } from './i18n/ThemeContext';
import { ProgressProvider } from './state/ProgressContext';
import { MicProvider } from './state/MicContext';
import { initPwaUpdates } from './lib/pwaUpdate';
import { loadManifest } from './lib/voiceClips';

initPwaUpdates();
// Natural-voice clip index; until it arrives (or if it is missing) the device voice is used.
void loadManifest();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LangProvider>
        <ProgressProvider>
          <MicProvider>
            <App />
          </MicProvider>
        </ProgressProvider>
      </LangProvider>
    </ThemeProvider>
  </StrictMode>,
);
