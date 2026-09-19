# Live2D files (local copy)

`npm run live2d:download` (run in `frontend/`) puts the Live2D Cubism Core and Live2D's official "Haru" sample
model in this folder. The pet then loads them from here instead of from Live2D's site and jsDelivr, so it works
offline. Without them it still works, by downloading both from the internet each time.

Everything here except this file is git-ignored on purpose: Live2D's licenses do not let us redistribute these
files, so each developer downloads them. To use another model, set `VITE_LIVE2D_MODEL_URL` in `frontend/.env.local`.
