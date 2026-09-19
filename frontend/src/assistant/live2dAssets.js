// Where the pet gets the Live2D Cubism Core and its model. A local copy in public/live2d/ (made by
// `npm run live2d:download`, which also writes manifest.json) is used when it exists, otherwise Live2D's own
// servers are used. So the pet works offline after one download, and still works without it when the network is fine.
const BASE = import.meta.env.BASE_URL;

const REMOTE_CORE = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
// Live2D's official sample model "Haru", from Live2D's own repository. Set VITE_LIVE2D_MODEL_URL to use another
// model (mind its license).
const REMOTE_MODEL =
  'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@develop/Samples/Resources/Haru/Haru.model3.json';

// Asks for the manifest (a .json, so the Vite dev server does not raise an error overlay for a missing script).
// A dev server answers unknown paths with index.html and status 200, hence the content type check.
let localAssets;
function findLocalAssets() {
  localAssets ??= fetch(`${BASE}live2d/manifest.json`)
    .then((response) =>
      response.ok && (response.headers.get('content-type') || '').includes('json') ? response.json() : null,
    )
    .catch(() => null);
  return localAssets;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

export async function loadCubismCore() {
  if (window.Live2DCubismCore) return;
  const local = await findLocalAssets();
  if (local) {
    try {
      await loadScript(`${BASE}live2d/${local.core}`);
      return;
    } catch {
      // The manifest is there but the file is not: fall through to Live2D's server.
    }
  }
  await loadScript(REMOTE_CORE);
}

export async function resolveModelUrl() {
  if (import.meta.env.VITE_LIVE2D_MODEL_URL) return import.meta.env.VITE_LIVE2D_MODEL_URL;
  const local = await findLocalAssets();
  return local ? `${BASE}live2d/${local.model}` : REMOTE_MODEL;
}
