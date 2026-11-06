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

export default defineConfig(({ mode }) => {
  // `vite build --mode standalone` produces one self-contained index.html (React, Tailwind, fonts and icon inlined)
  // that runs from file:// or any host, outside of any iframe that blocks the microphone.
  if (mode === 'standalone') {
    return {
      base: './',
      plugins: [react(), tailwindcss(), viteSingleFile(), inlineIcons()],
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
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
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
          background_color: '#f8fafc',
          theme_color: '#e11d48',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // The standalone HTML is a download, not part of the app shell.
          globIgnores: ['**/polish-learn-standalone.html'],
          maximumFileSizeToCacheInBytes: 5_000_000,
        },
      }),
    ],
  };
});
