# EVIQ — EV Intelligence Command Center

A full-viewport React dashboard for an AI-powered electric vehicle journey
system. A single "cockpit" shell navigates between Dashboard, Route,
Range AI, Energy, Eco-Speed, Charging, and Journey AI — every view swaps in
place. The car section features an interactive 3D vehicle viewer built with
three.js.

## Stack

- React 19 + Vite
- `three` for the reusable 3D car viewer (`components/Car3DViewer.jsx`)
- `framer-motion` for screen/view transitions
- `lucide-react` for icons
- Leaflet + MapLibre GL (OpenFreeMap "Liberty" style) for the live map
- Plain CSS (custom properties, no framework) — see `src/index.css` for the design tokens,
  including the light/dark theme variables toggled via `data-theme`

No backend: all telemetry in `src/data/vehicleData.js` is mocked, structured so it's
a drop-in replacement point for a real API.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Deploy

This is a static, backend-free SPA — there are no environment variables, API
keys, or servers to configure. `npm run build` outputs a fully static
`dist/` folder that any static host can serve over HTTPS.

### Vercel (recommended, ~1 minute)

1. Push this repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → import the repo. `vercel.json`
   in this project already sets the build command, output directory, SPA
   rewrite, asset caching, and security headers — no manual config needed.
3. Every push to the production branch redeploys automatically.

### Netlify (~1 minute)

1. Push this repo to GitHub.
2. [app.netlify.com/start](https://app.netlify.com/start) → pick the repo.
   `netlify.toml` already sets build command `npm run build`, publish dir
   `dist`, the SPA redirect, caching, and security headers.
3. Every push to the production branch redeploys automatically.

### GitHub Pages

1. Push this repo to GitHub.
2. `npm install --save-dev gh-pages`
3. Add to `package.json`:
   ```json
   "homepage": "https://<your-username>.github.io/<repo-name>",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
4. In `vite.config.js`, set `base: '/<repo-name>/'` inside `defineConfig({...})`.
5. `npm run deploy`, then enable Pages (branch `gh-pages`) in your repo settings.

Any other static host (Cloudflare Pages, Render, Firebase Hosting, S3 +
CloudFront, etc.) works the same way: build command `npm run build`, output
directory `dist`, serve `index.html` for any unmatched path.

### What's actually reachable at runtime

The app calls a handful of free, keyless third-party services directly from
the browser — there is no proxy/backend in front of them, so nothing needs
CORS configuration on your side:

| Service | Used for | Notes |
| --- | --- | --- |
| `router.project-osrm.org` | Turn-by-turn routing | Public demo server; can rate-limit under load. The app already falls back to a straight-line distance estimate with a visible notice if it's unreachable. |
| `nominatim.openstreetmap.org` | Destination search / geocoding | Public demo instance; same rate-limit caveat. |
| `tiles.openfreemap.org` (via MapLibre) | Map tiles | Free, no key. |
| `unpkg.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `cdn.jsdelivr.net` | Leaflet/MapLibre JS+CSS, web fonts | Static CDN assets, loaded via `<link>`/`<script>` in `index.html`. |

`src/data/chargingStations.js` also exports an unused `fetchEvSpecs()` helper
for the paid api-ninjas.com EV-specs endpoint — it's dead code (nothing in
the UI calls it) and throws unless a caller passes its own key, so it can't
leak a secret. Leave it as-is or delete it; either is safe.

For a hackathon demo on a flaky venue network, consider self-hosting an OSRM
instance or caching a few known routes if live routing needs to be rock
solid — the free demo server is fine for normal use but isn't an SLA'd
production API.

## Project structure

```
src/
  App.jsx                  # top-level state: phase, active view, live mode
  context/AppContext.jsx   # shared state: active journey route, theme, car-section scroll target
  data/vehicleData.js      # all mock telemetry for the single vehicle, + nav item order
  components/
    Car3DViewer.jsx         # reusable three.js car viewer (used on every "car showcase" surface)
    Panel.jsx, Modal.jsx, RadialGauge.jsx, TopNav.jsx, MobileTabBar.jsx, FreeMap.jsx
  screens/
    CommandCenter.jsx      # shell — top nav + swappable view area
    LiveJourney.jsx         # full-screen live driving overlay
  views/                    # the 7 command-center views (Dashboard, Route, RangeAI, Energy, EcoSpeed, Charging, JourneyAI)

public/assets/car3d/        # ferrari.glb model, AO map, skybox cubemap, draco decoder
```

## Design notes

- Color is functional, not decorative: **cyan** = live vehicle telemetry (battery/range/speed),
  **violet** = EVIQ AI reasoning, **green** = efficiency gains, **amber** = current-vs-optimal deltas,
  **red** is reserved for alerts.
- Typography: Space Grotesk (headings/voice), Inter (body/UI), JetBrains Mono (all numeric
  readouts — speed, kWh, scores — to read like an instrument cluster).
- `components/Car3DViewer.jsx` is the one 3D vehicle experience reused across the Dashboard hero,
  Range AI, Energy, and Live Journey panels — one implementation, no duplicated viewer code.
  It renders white body / metallic trim / transparent glass, matches drag-to-orbit + auto-rotate
  on the primary Dashboard instance, and runs in a lighter, non-interactive mode elsewhere.
- Route Selection (start/destination search + Find Routes) lives in its own panel below Route
  Options — nothing is ever rendered on top of the Live Map. Confirming a route there makes it
  the active journey route, which Journey AI and the Live Map both read from a shared context.
- Below ~980px width, the fixed 3-column grids collapse to a single scrollable column per view,
  and the top nav is replaced by a bottom tab bar.

## Known simplifications

- All AI copy and numbers are mocked and static; "Optimize / Explain / Plan Charge" etc. cycle
  through canned responses rather than calling a model.
- Elevation/gradient data isn't available from the free OSRM demo router, so route elevation is
  omitted rather than estimated.
