// Copies the single-file build into public/ so both the dev server and the PWA build serve it as a download.
import { copyFileSync, existsSync } from 'node:fs';

const source = 'standalone-dist/index.html';
const target = 'public/polish-learn-standalone.html';

if (!existsSync(source)) {
  console.error(`Missing ${source}. Run "vite build --mode standalone" first.`);
  process.exit(1);
}
copyFileSync(source, target);
console.log(`Standalone app copied to ${target}`);
