import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * In the single-file build every external reference must disappear: replace the icon links in
 * index.html with inline data URIs so the downloaded index.html shows its icon from file://.
 */
function inlineIcons(): Plugin {
  const svg = readFileSync('public/logo.svg');
  const png = readFileSync('public/apple-touch-icon-180x180.png');
  const svgUri = `data:image/svg+xml;base64,${svg.toString('base64')}`;
  const pngUri = `data:image/png;base64,${png.toString('base64')}`;
  return {
    name: 'inline-icons',
    transformIndexHtml(html) {
      return html
        .replace(/<link rel="icon" href="\.?\/favicon\.ico"[^>]*>\s*/, '')
        .replace(/href="\.?\/logo\.svg"/, `href="${svgUri}"`)
        .replace(/href="\.?\/apple-touch-icon-180x180\.png"/, `href="${pngUri}"`);
    },
  };
}

/** Build identity shown in Settings, so a learner can tell which version is actually running. */
function buildVersion(): string {
  const fromCi = process.env.GITHUB_SHA?.slice(0, 7);
  if (fromCi) return fromCi;
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

const define = {
  __APP_VERSION__: JSON.stringify(buildVersion()),
  __APP_SEMVER__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version),
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
};

/** The standalone build has no service worker: resolve the PWA virtual module to a no-op. */
function pwaRegisterStub(): Plugin {
  return {
    name: 'pwa-register-stub',
    resolveId: (id) => (id === 'virtual:pwa-register' ? 'pwa-register-stub' : null),
    load: (id) => (id === 'pwa-register-stub' ? 'export function registerSW() { return () => Promise.resolve(); }' : null),
  };
}

export default defineConfig(({ mode }) => {
  // `vite build --mode standalone` produces one self-contained index.html (React, Tailwind, fonts and icon inlined)
  // that runs from file:// or any host, outside of any iframe that blocks the microphone.
  if (mode === 'standalone') {
    return {
      base: './',
      define,
      plugins: [react(), tailwindcss(), viteSingleFile(), inlineIcons(), pwaRegisterStub()],
      build: {
        outDir: 'standalone-dist',
        emptyOutDir: true,
        assetsInlineLimit: 100_000_000,
      },
    };
  }

  return {
    // GitHub Pages serves the site from /<repo>/; the deploy workflow sets BASE_PATH.
    base: process.env.BASE_PATH || '/',
    define,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Registered from src/lib/pwaUpdate.ts, which reloads the page when a new version takes over.
        injectRegister: false,
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
        manifest: {
          name: 'Polski od zera – פולנית מאפס / Polish from Zero',
          short_name: 'Polski od zera',
          description: 'Polish course for Hebrew and English speakers: pronunciation, vocabulary, spaced repetition and voice roleplay.',
          lang: 'he',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f7f5f0',
          theme_color: '#f7f5f0',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Activate a new deploy at once AND take control of already-open pages; without clientsClaim
          // the new worker never controls the open app, so it never reloads into the new version.
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // The standalone HTML is a download, not part of the app shell.
          globIgnores: ['**/polish-learn-standalone.html'],
          maximumFileSizeToCacheInBytes: 5_000_000,
          // Natural-voice clips are not precached (several MB): each is cached the first time it plays,
          // or all at once from Settings → "Save the voice for offline use".
          runtimeCaching: [
            {
              urlPattern: /\/audio\/[0-9a-f]+\.mp3$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'voice-clips',
                rangeRequests: true,
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 4000 },
              },
            },
            {
              urlPattern: /\/audio\/manifest\.json$/,
              handler: 'NetworkFirst',
              options: { cacheName: 'voice-manifest', networkTimeoutSeconds: 3 },
            },
          ],
        },
      }),
    ],
  };
});
