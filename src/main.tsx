import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/rubik';
import './index.css';
import { App } from './App';
import { LangProvider } from './i18n/LangContext';
import { ThemeProvider } from './i18n/ThemeContext';
import { ProgressProvider } from './state/ProgressContext';
import { MicProvider } from './state/MicContext';

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
