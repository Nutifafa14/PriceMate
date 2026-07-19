@AGENTS.md

# PriceMate

Market Price Monitoring and Prediction System for Ghana — spec content
(PROJECT_REQUIREMENTS.md / DATABASE_SCHEMA.md / COLOR_GUIDE.md sections) lives
in `../Requirements/Project_Specification_Files.docx`; no standalone `.md`
mirrors exist in this repo. Phased build guide:
`../Requirements/Claude_Market_Price_System_Build_Guide.docx`.

**Status:** All 6 phases complete — production-ready. Dataset cleaned; full
architecture doc in `ARCHITECTURE.md`; a real Express + PostgreSQL backend
in `server/` (schema, REST API including `POST /api/predictions`, CSV
import/seed pipeline, auth, `helmet` + rate limiting, 41 vitest tests
against a real test DB); a scikit-learn wholesale-price model (Random
Forest — see `ml/reports/MODEL_EVALUATION.md`) served by FastAPI in `ml/`;
every screen wired to real data via `src/hooks/` with a global
`ErrorBoundary`, loading skeletons, RN-`Animated`-based micro-animations, an
accessibility pass, and an `AsyncStorage`-persisted React Query cache for
offline reads; and [`DEPLOYMENT.md`](DEPLOYMENT.md) for taking all three
services live, including its own documented gaps (no CI/CD, no app-level
test suite, no crash reporter wired up — listed explicitly, not hidden).

**Running it**: all three services must be up — `ml/` (FastAPI, port 8000),
`server/` (Express, port 4000, calls `ml/`), then the Expo app. See each
workspace's README, or `DEPLOYMENT.md` for taking them to production.

- `data/README.md` — start here for anything dataset-related.
- `data/reports/CLEANING_CHANGELOG.md` — full data-cleaning methodology and
  every change made.
- `server/README.md` — backend setup, full API reference, test instructions.
  `server/` is a fully independent npm workspace (own `package.json`,
  `tsconfig.json`, `eslint.config.js`) — excluded from the root `tsconfig.json`
  and `eslint.config.js`; run its checks from inside `server/`, not the root.
  Its test suite spawns a real `ml/` instance (port 8001) for
  `predictions.test.ts` — see `server/tests/global-setup.ts`.
- `ml/README.md` — model training/API setup, `ml/reports/MODEL_EVALUATION.md`
  for full methodology. `ml/` is a Python venv workspace, independent of both
  `server/` and the Expo app. `ml/models/*.joblib` and `metadata.json` are
  gitignored build artifacts — regenerate with `ml/.venv/bin/python
src/train.py`, don't hand-edit or expect them to exist after a fresh clone.
- `DEPLOYMENT.md` — the deployment guide (database, both APIs, EAS build for
  the app, app-store checklist). Read this before suggesting how to ship
  any change to production.
- `src/hooks/` — every screen's one path to the Express API (React Query).
  Don't call `apiFetch` directly from a screen; add/use a hook.
- `src/lib/token-store.ts` — JWT lives in SecureStore, not the Zustand
  auth-store (which only holds the profile) — see its module comment for why.
  `signOut()` call sites must also call `clearToken()`.
- `src/lib/query-client.ts` — the query cache is persisted to `AsyncStorage`
  (offline reads). Mutations (auth, predictions) are never persisted and
  always need a live connection — don't change that without re-reading why
  in the module comment.
- `src/utils/prices.ts` — `pickMostRecentWholesale` /
  `groupLatestWholesaleByCommodity` are the one rule for "which market
  represents this commodity" across Home/Favourites/Commodity Detail/History/
  Prediction. Reuse them rather than re-deriving a default-market choice
  elsewhere.
- `src/components/ErrorBoundary.tsx` — wraps the whole app in `app/_layout.tsx`.
  `componentDidCatch` is the seam for a real crash reporter if one ever gets
  wired up; currently just `console.error`.
- `src/theme/` — colors/typography/spacing from `COLOR_GUIDE.md`; don't
  hardcode colors in screens, use `useTheme()`.
- `src/store/settings-store.ts` — persisted appearance override
  (system/light/dark), read by `ThemeProvider`. Settings screen only exposes
  real, functional controls (appearance, clear favourites, sign out) —
  don't add toggles with no working effect behind them.
- When adding `Animated.Value`s, initialize via `useState(() => new
Animated.Value(...))`, not `useRef(...).current` — this repo's eslint
  config flags reading `.current` during render (`react-hooks/refs`); see
  any of `Button.tsx`/`Screen.tsx`/`Skeleton.tsx` for the pattern.
- Path aliases: `@/*` → `src/*`, `@app/*` → `app/*`.
- `npm run typecheck`, `npm run lint`, `npm run clean-data` — run these before
  considering any change to the Expo app done. For backend changes, run the
  equivalent scripts inside `server/` (`npm run typecheck`, `npm run lint`,
  `npm test`). For model changes, `ml/.venv/bin/python -m pytest tests/ -v`
  inside `ml/`.
