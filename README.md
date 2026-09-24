# Route 21 vinyl prototype

The arrival timer uses SEPTA GTFS Realtime Trip Updates for Route 21 westbound at Walnut St & 34th St (stop 21360). Every three rider contributions are sent to a server-side music endpoint, which asks ElevenLabs Music to compose a 30-second instrumental passage from the aggregated mood and texture choices. The API key never goes to the browser. The local Web Audio demo remains available if generation is not configured or fails.

## Run locally

From this folder, run:

```powershell
node server.mjs
```

Open `http://localhost:3000/`. Keep that terminal running while using the prototype. Opening the HTML file directly with `file://` cannot reach the local API route.

Node.js is already available; no npm package is required. Without the ElevenLabs key, the prototype still runs and plays its local demo sound. To enable generated audio in PowerShell, set the key in the server's environment before starting it:

```powershell
$env:ELEVENLABS_API_KEY = "your-key"
node server.mjs
```

The sound-generation endpoint uses ElevenLabs Music (`music_v2_5`) with instrumental mode enabled. The generated 30-second passage is played by the prototype's audio player and may repeat while the interval is active; it is not guaranteed to be a seamless loop. The key needs Music Generation access. Provider usage may incur charges under your account plan. Do not put the key in the HTML or commit it to the repository.

## Vercel

This project can be deployed from the CLI without a GitHub repository. From this folder, run `npx vercel` to link/create the Vercel project and make a preview deployment, then `npx vercel --prod` when ready to publish. The root URL rewrites to the prototype, while `/api/arrival` and `/api/soundscape` run as Vercel Functions. Add `ELEVENLABS_API_KEY` in the Vercel project's server-side Environment Variables, for Production (and Preview if needed), then redeploy. Never put the key in this folder, the HTML, or chat. The SEPTA feed does not require an environment variable.
