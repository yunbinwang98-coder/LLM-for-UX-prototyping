# Route 21 vinyl prototype

The portrait iPad interface shows SEPTA GTFS Realtime arrivals for Route 21 westbound at Walnut St & 34th St (stop 21360). Tap the vinyl to choose a mood and optional sound texture using two radial wheels. Each submission requests a 30-second instrumental composition from ElevenLabs Music, weighted by all rider choices in the current bus interval. Choices submitted during generation are combined into one follow-up request. Existing music keeps playing until replacement audio is loaded; failed or expired updates do not interrupt it. The API key never goes to the browser.

The volume slider controls generated music and the local demo; tapping the speaker toggles mute and restores the previous level. Audio begins after a rider interacts with the vinyl or volume controls, as required by browser playback policies. The timer begins at the first live ETA, including estimates longer than ten minutes, and smoothly follows revisions. Trip identifiers prevent a revised estimate from resetting the mood tally. The tally resets when the ETA reaches zero or the next trip becomes the earliest prediction; these are arrival proxies, not confirmation that a bus physically stopped. The one-minute demo uses a simulated interval, then returns to the live feed. Rider state is held in the kiosk browser and is not shared between separate devices or retained after refresh.

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
