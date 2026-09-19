// Downloads the Live2D Cubism Core and Live2D's official "Haru" sample model into public/live2d/, so the pet
// works without reaching Live2D's site or jsDelivr while the app runs. Run it with `npm run live2d:download`.
//
// These files are not ours to redistribute (see Live2D's license terms), so public/live2d/ is git-ignored and
// every developer runs this once. Existing files are kept; pass --force to download them again.
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
const MODEL_BASE = 'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@develop/Samples/Resources/Haru/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'live2d');
const FILE_KEYS = new Set(['Moc', 'Textures', 'Physics', 'Pose', 'DisplayInfo', 'UserData', 'File', 'Sound']);
const force = process.argv.includes('--force');

const exists = (file) => access(file).then(() => true, () => false);

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function save(url, relativePath, bytes) {
  const target = path.join(OUT, relativePath);
  if (!force && (await exists(target))) {
    console.log(`skip   ${relativePath}`);
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes ?? (await fetchBytes(url)));
  console.log(`saved  ${relativePath}`);
}

// Every file a .model3.json points to: moc, textures, physics, pose, expressions, motions and their sounds.
function referencedFiles(value, key, found = []) {
  if (typeof value === 'string') {
    if (FILE_KEYS.has(key)) found.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => referencedFiles(item, key, found));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, child]) => referencedFiles(child, childKey, found));
  }
  return found;
}

await save(CORE_URL, 'live2dcubismcore.min.js');

const modelJson = await fetchBytes(`${MODEL_BASE}Haru.model3.json`);
await save(null, 'Haru/Haru.model3.json', modelJson);
const files = referencedFiles(JSON.parse(modelJson.toString('utf8')).FileReferences);
for (const file of files) await save(`${MODEL_BASE}${file}`, `Haru/${file}`);

// The pet looks for this file to know that a local copy exists.
await writeFile(
  path.join(OUT, 'manifest.json'),
  JSON.stringify({ core: 'live2dcubismcore.min.js', model: 'Haru/Haru.model3.json' }, null, 2) + '\n',
);

console.log(`\nDone: ${files.length + 2} files in frontend/public/live2d/. Do not commit them.`);
