# PriceMate

Market Price Monitoring and Prediction System for Ghana — an Expo React
Native app that tracks and (eventually) predicts wholesale food prices across
20 Ghanaian markets, for farmers, traders, businesses, researchers and
students.

> **Status:** Phases 0–6 complete — production-ready. The app is fully live
> end to end (every screen reads real data, auth is real, predictions are
> real), hardened for production (rate limiting, security headers, a global
> error boundary, sanitized error responses), polished (loading skeletons,
> animations, an offline-friendly persisted cache, accessibility labels),
> and documented for deployment. See [`DEPLOYMENT.md`](DEPLOYMENT.md) and
> [Roadmap](#roadmap).

## Getting started

The app now expects the backend to be running — it no longer falls back to
local sample data (though a persisted cache means previously-loaded data
still shows up if you go offline after that first load — see
[Offline behavior](#offline-behavior)). Start Postgres, the ML API, and the
Express API first (see [Backend](#backend) and
[ML / prediction API](#ml--prediction-api) below), then:

```bash
npm install
cp .env.example .env   # only needed if your API isn't at the default localhost:4000
npm run start           # then press i / a / w, or scan the QR code in Expo Go
```

Useful scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write .
npm run clean-data   # re-run the data cleaning pipeline
```

### Testing on a physical device

If commodities/markets/favourites fail to load only on your phone (Expo Go
or a dev build) while they work fine in the simulator, this is almost always
the cause: `EXPO_PUBLIC_API_URL` defaults to `http://localhost:4000/api`, and
on a physical device "localhost" resolves to the phone itself, not the
computer running the API.

Fix:

1. Find your computer's LAN IP — `ipconfig getifaddr en0` (Mac Wi-Fi) or
   `ipconfig` (Windows, look for IPv4 Address).
2. Set `EXPO_PUBLIC_API_URL=http://<that-ip>:4000/api` in `.env`.
3. Make sure the phone and computer are on the same Wi-Fi network, and that
   the Express server is actually reachable at that IP (not just
   `localhost`) — see [`DEPLOYMENT.md`](DEPLOYMENT.md).
4. Restart `npm run start` (env vars are inlined at build time, so a running
   Metro instance won't pick up the change).

### ML / prediction API

Start this first — Express calls it. Lives in [`ml/`](ml/), an independent
workspace (own Python venv). See [`ml/README.md`](ml/README.md) — in short:

```bash
cd ml && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python src/train.py               # trains + evaluates, writes models/
cd src && ../.venv/bin/uvicorn api:app --port 8000
```

### Backend

The API lives in [`server/`](server/) as an independent npm workspace (own
`package.json`, not part of the Expo app's dependency tree). See
[`server/README.md`](server/README.md) for setup — in short:

```bash
cd server && npm install
cp .env.example .env
npm run migrate && npm run seed
npm run dev           # http://localhost:4000
```

## Tech stack

Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router · React Query ·
Zustand · React Hook Form · Zod · `@expo-google-fonts/poppins` ·
`@expo/vector-icons`. See `PROJECT_REQUIREMENTS.md` for the full brief
(backend/AI stack lands in later phases).

## Project structure

```
app/                    Expo Router routes (thin — delegate to src/)
  (auth)/                welcome (splash+onboarding), sign-in, sign-up
  (tabs)/                home, markets, favourites, profile
  commodity/[id].tsx      market/[id].tsx      prediction/[id].tsx
  history/[id].tsx         settings.tsx
src/
  components/            domain composites (CommodityCard, MarketRow,
                          MarketCard), ErrorBoundary
  components/ui/          reusable primitives (Button, Card, TextField,
                          ScreenHeader, SegmentedControl, PriceChart,
                          Skeleton, ...)
  theme/                  colors/typography/spacing from COLOR_GUIDE.md
  store/                  Zustand stores (auth, favourites, settings),
                          persisted to AsyncStorage for offline-friendly state
  hooks/                  React Query hooks — every screen's one path to the
                          real Express API (useMarkets, useCommodities,
                          usePrices, usePredictPrice, useSignIn/useSignUp)
  lib/                    React Query client + AsyncStorage persister,
                          apiFetch (attaches the JWT, parses API error
                          bodies), SecureStore token cache
  types/                  domain types mirroring the real API response
                          shapes exactly (server/src/schemas/*.ts)
  utils/                  Zod validation schemas, category→icon mapping,
                          price-picking helpers (utils/prices.ts),
                          per-category prediction confidence labels
data/                    see data/README.md
server/                  Express + PostgreSQL API, own workspace — see
                          server/README.md
ml/                      Wholesale-price model + FastAPI prediction service,
                          own workspace — see ml/README.md
```

Path aliases: `@/*` → `src/*`, `@app/*` → `app/*`.

## Data

The wholesale/retail price dataset (2015–2023, 20 markets, 26 commodities)
was audited and cleaned before any app code was written. Full methodology,
every check performed, and the reasoning behind the two rows that were
removed as data-entry errors: **[`data/reports/CLEANING_CHANGELOG.md`](data/reports/CLEANING_CHANGELOG.md)**.

A second real source — MoFA SRID (Ghana's Ministry of Food and Agriculture),
2025 — adds 10 more, individually-named markets (Makola, Agbogbloshie,
Tuesday Market, Tema Community One Main Market, Bibiani, Goaso, Nana
Bosomah, Bamboi, Gbintiri, Agatha Market) alongside the original 20
city-level markets. It's kept in its own `community_prices` table and always
labeled "as reported" in the UI — its source has no documented unit, so it's
never blended into the wholesale trend chart or the ML model. Full
methodology: **[`data/reports/MOFA_CLEANING_CHANGELOG.md`](data/reports/MOFA_CLEANING_CHANGELOG.md)**.

Commodity photos (`src/components/CommodityCard.tsx`,
`CommodityListItem.tsx`) are real, individually-licensed images from
Wikimedia Commons — see
**[`assets/commodities/ATTRIBUTION.json`](assets/commodities/ATTRIBUTION.json)**
for the source/license/artist of each.

## Offline behavior

React Query's cache is persisted to `AsyncStorage`
(`src/lib/query-client.ts`) — once a screen has loaded successfully, that
data is available again on a cold start even with no connection, for up to
24 hours. This is read-only: sign-in, sign-up, and predictions are
mutations and are never persisted, so they always need a live connection.
This directly targets `PROJECT_REQUIREMENTS.md`'s "offline-friendly where
possible" — not full offline read/write, which the spec doesn't ask for.

## Roadmap

Following the phased build guide:

- [x] **Phase 0** — dataset cleaning, Expo/TS/Router scaffold, design tokens,
      reusable components, state/query wiring, navigable skeleton.
- [x] **Phase 1** — formal architecture doc + implementation plan. See
      [`ARCHITECTURE.md`](ARCHITECTURE.md).
- [x] **Phase 2** — Express + PostgreSQL backend, CSV import pipeline, seed
      process. See [`server/README.md`](server/README.md).
- [x] **Phase 3** — full-fidelity screens (Splash/Auth, Home, Markets,
      Commodity Details, Prediction, History, Profile, Settings,
      Favourites) in the grocery-app-inspired design language.
- [x] **Phase 4** — Scikit-learn regression model + prediction API. See
      [`ml/README.md`](ml/README.md) and
      [`ml/reports/MODEL_EVALUATION.md`](ml/reports/MODEL_EVALUATION.md).
- [x] **Phase 5** — frontend/backend/AI integration. Every screen reads real
      data via a React Query hooks layer (`src/hooks/`); auth is real (JWT
      in SecureStore); `src/constants/sample-data.ts` is deleted; the
      Prediction screen calls a real `POST /api/predictions`, which calls
      the real ML API and persists the result. Verified with a real
      sign-up→browse→predict curl chain against the live stack, plus 41
      backend tests (including 8 for the new endpoint, against a real
      spawned ML server) and a clean production bundle export.
- [x] **Phase 6** — loading skeletons, a screen entrance + press/toggle
      animation layer (RN's core `Animated`, no extra dependency),
      min/max/date labels + a screen-reader summary on `PriceChart`, a
      global `ErrorBoundary`, sanitized error responses on both APIs,
      `helmet` + rate limiting on `server/`, an offline-friendly persisted
      React Query cache (`AsyncStorage`), an accessibility pass (consolidated
      labels, roles, states on every custom pressable/list item), and
      [`DEPLOYMENT.md`](DEPLOYMENT.md) for taking all three services live.
      Known gaps (no CI, no app-level test suite, no crash reporting wired
      up) are documented in `DEPLOYMENT.md` §6, not silently left out.
