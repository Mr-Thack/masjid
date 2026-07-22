import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.resolve(__dirname, '..', 'build', 'sw.js');

if (!fs.existsSync(swPath)) {
  console.warn('[sw-hash] build/sw.js not found — skipping hash injection');
  process.exit(0);
}

const hash = Date.now().toString(36);
let content = fs.readFileSync(swPath, 'utf-8');

if (!content.includes('__BUILD_HASH__')) {
  console.log('[sw-hash] no __BUILD_HASH__ placeholder found — skipping');
  process.exit(0);
}

content = content.replace('__BUILD_HASH__', hash);
fs.writeFileSync(swPath, content);
console.log(`[sw-hash] injected cache name: masjid-consumer-${hash}`);