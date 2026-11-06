import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * End-to-end QA in the locally installed Google Chrome (no browser download needed).
 * Chrome's fake capture device plays a WAV file into getUserMedia/SpeechRecognition,
 * so the real recording pipeline runs without a physical microphone.
 */
const fixture = (name: string) => path.resolve('tests/e2e/fixtures', name);
const fakeMic = (wav: string) => [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${fixture(wav)}`,
  '--autoplay-policy=no-user-gesture-required',
];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'tests/e2e/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    permissions: ['microphone'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'mobile-speech',
      testIgnore: /silent-mic/,
      use: { ...devices['Pixel 7'], channel: 'chrome', launchOptions: { args: fakeMic('speech.wav') } },
    },
    {
      name: 'desktop-speech',
      testIgnore: /silent-mic/,
      use: { viewport: { width: 1280, height: 900 }, launchOptions: { args: fakeMic('speech.wav') } },
    },
    {
      name: 'silent-mic',
      testMatch: /silent-mic\.spec\.ts/,
      use: { ...devices['Pixel 7'], channel: 'chrome', launchOptions: { args: fakeMic('silence.wav') } },
    },
  ],
});
