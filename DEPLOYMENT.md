# Deployment Guide

Phase 6 deliverable. Covers taking all three services — database, `ml/`,
`server/` — and the Expo app from local dev to a real deployment. Written
against what's actually in this repo, not generic boilerplate: real env var
names, real scripts, real gaps called out explicitly.

## Architecture recap

```
Expo app (EAS Build)  ──HTTPS──▶  Express API  ──SQL──▶  PostgreSQL
                                       │
                                       └──HTTP──▶  ML API (FastAPI)
```

Three independently deployable services (`server/`, `ml/`, the Expo app)
plus a managed Postgres database. None share a deploy pipeline — each has
its own README and can be deployed to different providers.

## 1. Database

Any managed PostgreSQL 14+ works — the schema has no provider-specific
features. [Supabase](https://supabase.com) is what `PROJECT_REQUIREMENTS.md`
names explicitly (free tier is enough for this dataset: 8,543 price rows).

1. Create a project, copy its connection string (`postgres://...`).
2. From your machine (or CI), point `DATABASE_URL` at it and run:
   ```bash
   cd server
   DATABASE_URL="<supabase-connection-string>" npm run migrate
   DATABASE_URL="<supabase-connection-string>" npm run seed
   ```
   `npm run seed` is idempotent (see `server/README.md`) — safe to re-run
   after pulling a newer `data/ghana_food_prices_clean.csv`.
3. Keep this same `DATABASE_URL` for the Express deployment in §3.

**Gap**: no automated migration-on-deploy hook exists. Run `npm run
migrate` manually (or via a one-off CI step) after pulling new migration
files, before deploying the new `server/` build that expects them.

## 2. ML API (`ml/`)

Deploy this first — Express depends on it being reachable.

**The trained model is not in git** (`ml/models/*.joblib` is gitignored —
52 MB, regenerated deterministically from `RANDOM_STATE = 42`, treated as a
build artifact like `server/dist/`). The build step **must** run
`train.py` before starting the API, or `api.py` raises `RuntimeError` on
import and the process won't start. This also means the deploy environment
needs `data/ghana_food_prices_clean.csv` available (it's committed — just
make sure your deploy pulls the whole repo, not only `ml/`).

Any container/PaaS host works (Render, Railway, Fly.io, a plain VM with
systemd). Example build/start commands:

```bash
# Build
cd ml
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python src/train.py          # writes ml/models/*.joblib + metadata.json

# Start — bind 0.0.0.0, not the local-dev default, and use the platform's
# injected $PORT if it provides one (most PaaS hosts do)
cd src
../.venv/bin/uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}
```

No environment variables required. Health check: `GET /health` → `{"status":"ok"}`.

Note the deploy URL — it's `server/`'s `ML_API_URL` in the next section.

## 3. Backend (`server/`)

```bash
cd server
npm install
npm run build      # tsc -> dist/
npm start           # node dist/index.js
```

Required environment variables:

| Var            | Example                           | Notes                                                                                          |
| -------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | `postgres://...`                  | From §1                                                                                        |
| `JWT_SECRET`   | a long random string              | **Must** be changed from the dev default (`server/.env.example`'s value is for local dev only) |
| `ML_API_URL`   | `https://your-ml-api.example.com` | From §2                                                                                        |
| `PORT`         | usually injected by the platform  | `src/env.ts` already reads `process.env.PORT`, defaulting to 4000                              |

Run migrations against the production `DATABASE_URL` (§1) before the first
deploy of a version that needs them.

**CORS**: `app.use(cors())` currently allows all origins — fine for a
mobile app (native `fetch` isn't subject to browser CORS), but if this API
ever also serves a web client, restrict it via `cors({ origin: [...] })`
before that happens.

**Health check**: `GET /api/health` → `{"status":"ok"}`. **Security
headers**: `helmet()` is applied. **Rate limiting**: `/api/auth/*` is
capped at 50 requests/15min/IP (`server/src/middleware/rate-limit.ts`) —
tune this per your actual traffic before launch.

## 4. Expo app

### Environment configuration

`src/constants/config.ts` reads `EXPO_PUBLIC_API_URL` (inlined at build
time by Expo — no native rebuild needed to change it). Set it per
environment:

- **Local dev**: unset — falls back to `http://localhost:4000/api`. This only
  works in a web browser or a simulator/emulator on the same machine as the
  API. On a **physical device** (Expo Go or a dev build), "localhost" is the
  phone itself — set `EXPO_PUBLIC_API_URL` in `.env` to your computer's LAN
  IP instead (e.g. `http://192.168.1.23:4000/api`; find it with
  `ipconfig getifaddr en0` on Mac Wi-Fi) and restart Metro. See README's
  [Testing on a physical device](README.md#testing-on-a-physical-device).
- **EAS Build**: set per build profile in `eas.json`'s `env` block, e.g.:
  ```json
  {
    "build": {
      "production": {
        "env": { "EXPO_PUBLIC_API_URL": "https://your-server.example.com/api" }
      }
    }
  }
  ```
  (`eas.json` isn't in this repo yet — `eas build:configure` generates a
  starting point.)

### Build with EAS

```bash
npm install -g eas-cli   # if not already installed
eas login
eas build:configure
eas build --platform ios --profile production
eas build --platform android --profile production
```

### OTA updates

`expo-updates` isn't installed yet — add it (`npx expo install
expo-updates`) and run `eas update:configure` before relying on
over-the-air updates for JS-only changes. Native changes (any new native
dependency) still require a new store build.

### App store submission checklist

- [ ] Icons/splash already present in `assets/` and configured in
      `app.json` — verify they render correctly on both platforms via a
      production build before submitting.
- [ ] `app.json`'s `version` — bump per release; iOS/Android also track
      their own build numbers (`ios.buildNumber` / `android.versionCode`,
      not currently set — add before first submission).
- [ ] Privacy: the app collects an email/name at sign-up (stored in
      Postgres, see `server/src/migrations/001_init.sql`) and no other
      personal data (no location, camera, contacts). A privacy policy URL
      is required by both stores even for minimal-data apps — write one
      reflecting exactly this before submitting.
- [ ] Test against the **production** `EXPO_PUBLIC_API_URL`, not
      localhost, before submitting — `eas build --profile production`
      then install and click through sign-up → browse → predict for real.
- [ ] `expo-doctor` clean (`npx expo-doctor`) — re-run after any dependency
      change between now and submission.

## 5. First-time deploy order

1. Database (§1) — create, migrate, seed.
2. ML API (§2) — build (trains the model), deploy, confirm `/health`.
3. Express API (§3) — set `ML_API_URL` to step 2's URL, deploy, confirm
   `/api/health` and one real `POST /api/predictions` call.
4. Expo app (§4) — set `EXPO_PUBLIC_API_URL` to step 3's URL, build.

## 6. Known gaps (not addressed by Phase 6)

Documenting these explicitly rather than silently leaving them:

- **No CI/CD pipeline** — all verification in this repo (tsc/eslint/tests
  across all three workspaces) is run manually. Wiring these into GitHub
  Actions (or similar) so migrations/tests/lints gate every deploy is a
  natural next step, not done here.
- **No app-level automated tests** — `server/` has 41 tests and `ml/` has
  10, both against real dependencies (Postgres, a real spawned ML
  server), but the Expo app itself has no Jest/React Native Testing
  Library suite. Verification for the app is static (`tsc`/`eslint`) plus
  a production bundle export, not component/integration tests.
- **No crash reporting service wired up** — `src/components/ErrorBoundary.tsx`
  catches render errors and logs to `console.error`; there's a clear spot
  to plug in Sentry/Bugsnag (`componentDidCatch`) but no account/credentials
  exist to wire one up here.
- **No automated migration-on-deploy** — `npm run migrate` is a manual
  step (§1), not triggered by the deploy pipeline.
