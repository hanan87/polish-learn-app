import { registerSW } from 'virtual:pwa-register';
import { isStandaloneBuild } from './env';

/** Build identity injected by vite.config.ts (git commit + build time). */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
/** Release number from package.json (bumped per stage: 1.6.0 = stage 6). */
export const APP_SEMVER: string = typeof __APP_SEMVER__ !== 'undefined' ? __APP_SEMVER__ : '';
export const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

const CHECK_EVERY_MS = 15 * 60 * 1000;

/**
 * Service-worker registration with immediate updates.
 *
 * The offline cache serves the previous version on refresh, so a plain registration made a new
 * deploy visible only after a second reload. With registerType 'autoUpdate' the new worker
 * activates at once and registerSW() reloads the page when it takes control. Updates are also
 * checked whenever the app returns to the foreground (installed PWAs are rarely reloaded) and
 * every 15 minutes.
 */
export function initPwaUpdates(): void {
  if (isStandaloneBuild || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine === false) return;
        registration.update().catch(() => undefined);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.setInterval(check, CHECK_EVERY_MS);
    },
  });
}

/** Human-readable version string, e.g. "e3c972f · 06/11/2026 09:49". */
export function versionLabel(locale: string): string {
  const head = APP_SEMVER ? `v${APP_SEMVER} (${APP_VERSION})` : APP_VERSION;
  if (!BUILD_TIME) return head;
  const d = new Date(BUILD_TIME);
  return `${head} · ${d.toLocaleDateString(locale)} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}
