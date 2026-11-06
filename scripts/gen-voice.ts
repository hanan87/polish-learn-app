/**
 * Generates the natural-voice clips with Azure AI Speech (neural TTS) into public/audio/ and writes
 * public/audio/manifest.json. Run locally – the key never leaves this machine or enters git:
 *
 *   .env.local:  AZURE_SPEECH_KEY=…   AZURE_SPEECH_REGION=westeurope
 *   npm run voice            # generate missing clips
 *   npm run voice -- --dry   # only count phrases and characters
 *
 * Clips are content-addressed (hash of voice + speed + text), so re-running after a content change
 * only synthesizes new phrases. Stale files are removed with --prune.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildClipCatalog } from '../src/lib/clipCatalog';
import { AZURE_VOICES, buildSsml, clipFileName } from './voice-lib';

const OUT = 'public/audio';
const args = new Set(process.argv.slice(2));
const dry = args.has('--dry');
const prune = args.has('--prune');

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...env, ...(process.env as Record<string, string>) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synthesize(key: string, region: string, ssml: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'polish-learn-app-voice-generator',
      },
      body: ssml,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1500 * 2 ** attempt;
      await sleep(wait);
      continue;
    }
    throw new Error(`Azure TTS ${res.status}: ${await res.text()}`);
  }
  throw new Error('Azure TTS: too many retries');
}

async function main() {
  const catalog = buildClipCatalog();
  const chars = catalog.reduce((n, c) => n + c.text.length, 0);
  console.log(`${catalog.length} phrases, ${chars} characters (Azure free tier: 500,000 / month).`);
  if (dry) return;

  const env = loadEnv();
  const key = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION || 'westeurope';
  if (!key) {
    console.error('Missing AZURE_SPEECH_KEY (put it in .env.local). See the comment at the top of this file.');
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  const clips: Record<string, string> = {};
  const todo = catalog.filter((c) => {
    const file = clipFileName(c.key);
    clips[c.key] = file;
    return !existsSync(join(OUT, file));
  });
  console.log(`${todo.length} new clips to synthesize.`);

  let done = 0;
  let failed = 0;
  const queue = [...todo];
  // Two parallel requests stay inside the free tier's rate limit; 429s back off automatically.
  const worker = async () => {
    while (queue.length) {
      const c = queue.shift()!;
      try {
        const mp3 = await synthesize(key, region, buildSsml(c.voice, c.speed, c.text));
        writeFileSync(join(OUT, clips[c.key]), mp3);
      } catch (err) {
        failed++;
        delete clips[c.key];
        console.error(`\n✗ ${c.key}: ${(err as Error).message}`);
        if (/401|403/.test((err as Error).message)) process.exit(1);
      }
      done++;
      if (done % 20 === 0 || done === todo.length) process.stdout.write(`\r${done}/${todo.length}`);
    }
  };
  await Promise.all([worker(), worker()]);
  console.log('');

  // Only clips that exist on disk go into the manifest.
  for (const [k, f] of Object.entries(clips)) if (!existsSync(join(OUT, f))) delete clips[k];
  const voices = Object.fromEntries(Object.entries(AZURE_VOICES).map(([k, v]) => [k, v.name]));
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), voices, clips }));
  console.log(`manifest: ${Object.keys(clips).length} clips${failed ? `, ${failed} failed (re-run to retry)` : ''}.`);

  if (prune) {
    const keep = new Set(Object.values(clips));
    let removed = 0;
    for (const f of readdirSync(OUT)) {
      if (f.endsWith('.mp3') && !keep.has(f)) {
        unlinkSync(join(OUT, f));
        removed++;
      }
    }
    console.log(`pruned ${removed} stale clips.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
