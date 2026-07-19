# PriceMate — Architecture & Implementation Plan

Phase 1 deliverable: formal folder structure, setup commands, dependency
rationale, navigation map, system architecture, and the roadmap for Phases
2–6. This documents the scaffold built in Phase 0 as-is (no app code changed
in this pass) and plans the backend/AI/UI work still ahead.

## 1. Folder structure

_This is the Phase 1 snapshot — kept as-written for history. `README.md`'s
"Project structure" section is updated every phase and is the current
source of truth (e.g. it reflects `src/hooks/`, `ml/`, and the removal of
`sample-data.ts` since Phase 5; this diagram doesn't)._

```
PriceMate/
├── app/                          Expo Router routes — thin screens that
│   │                             compose src/components + src/store, no
│   │                             business logic of their own
│   ├── _layout.tsx                Root: font loading, splash gate, providers
│   │                               (QueryClientProvider → ThemeProvider),
│   │                               root Stack
│   ├── index.tsx                  Redirect gate: onboarding → auth → tabs,
│   │                               driven by useAuthStore
│   ├── +not-found.tsx             404 fallback route
│   ├── (auth)/                    Route group — unauthenticated flow
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx            Onboarding / splash-to-auth screen
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/                    Route group — authenticated bottom tabs
│   │   ├── _layout.tsx            Tab bar config (icons, theme colors)
│   │   ├── index.tsx               Home dashboard
│   │   ├── markets.tsx
│   │   ├── favorites.tsx
│   │   └── profile.tsx
│   ├── commodity/[id].tsx         Commodity detail (dynamic route)
│   ├── market/[id].tsx            Market detail (dynamic route)
│   └── prediction/[id].tsx        Prediction detail (dynamic route)
│
├── src/
│   ├── components/
│   │   ├── ui/                    Reusable, theme-driven primitives:
│   │   │                          Button, Card, Badge, TextField, ThemedText,
│   │   │                          Screen, EmptyState — no domain knowledge
│   │   ├── CommodityCard.tsx      Domain composite (built from ui/ primitives)
│   │   └── MarketRow.tsx          Domain composite
│   ├── theme/                     Design tokens mirroring COLOR_GUIDE.md
│   │   ├── colors.ts                light/dark palettes
│   │   ├── spacing.ts               spacing/radius/shadow scale
│   │   ├── typography.ts            Poppins family/sizes/line-heights
│   │   └── ThemeProvider.tsx        context + useTheme() hook
│   ├── store/                     Zustand — persisted client state
│   │   ├── auth-store.ts            user, onboarding flag, hydration flag
│   │   └── favorites-store.ts       favourited commodity ids
│   ├── lib/                       Cross-cutting infra
│   │   ├── query-client.ts          React Query client instance/defaults
│   │   └── api-client.ts            fetch wrapper + ApiError (Phase 2 seam)
│   ├── constants/
│   │   ├── config.ts                env-derived config (API_URL)
│   │   └── sample-data.ts           real placeholder data from the cleaned
│   │                                 CSV; deleted once Phase 2's API exists
│   ├── types/index.ts             Domain types mirroring DATABASE_SCHEMA.md
│   │                               (Market, Commodity, PricePoint,
│   │                               PredictionPoint, User, Category)
│   └── utils/validation.ts        Zod schemas for RHF forms
│
├── data/                          Offline data-cleaning pipeline (Phase 0)
│   ├── raw_ghana_food_prices.csv    verbatim source copy
│   ├── ghana_food_prices_clean.csv  cleaned output, used to seed Phase 2's DB
│   ├── scripts/                     01–04, portable + idempotent
│   ├── reports/                     CLEANING_CHANGELOG.md, flagged_outliers.csv
│   └── README.md
│
├── assets/                        App icons + splash images
├── app.json                       Expo config (New Architecture default,
│                                    automatic light/dark, plugins, extra.apiUrl)
├── tsconfig.json                  strict mode, @/* and @app/* path aliases
├── eslint.config.js                eslint-config-expo flat config
├── .prettierrc.json / .prettierignore
├── .npmrc                         legacy-peer-deps=true (expo-router web
│                                    peer-dep workaround — see §3)
├── package.json
├── README.md                      Quickstart + condensed structure + roadmap
└── ARCHITECTURE.md                This document
```

## 2. Install commands

Fresh clone → running app, in order:

```bash
# 1. Install JS dependencies (legacy-peer-deps is set in .npmrc, not needed
#    on the command line, but shown here for clarity if .npmrc is ever lost)
npm install

# 2. Sanity-check the Expo/native config and dependency versions
npx expo-doctor

# 3. Start the dev server
npm run start          # then press i (iOS sim) / a (Android emulator) /
                        # w (web) / or scan the QR code in Expo Go

# Alternatives:
npm run ios            # expo start --ios
npm run android         # expo start --android
npm run web             # expo start --web
```

Verification commands (run before considering any change done — also see
`CLAUDE.md`):

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npx prettier --check . # formatting
npx expo-doctor         # dependency/config health
npm run clean-data      # re-run the Python data-cleaning pipeline
```

No `.env` file exists yet. `src/constants/config.ts` reads `apiUrl` from
`app.json`'s `expo.extra`, currently hardcoded to
`http://localhost:4000/api` as a placeholder for Phase 2.

## 3. `package.json`

**Runtime dependencies** — grouped by why they're there, not alphabetically:

| Package                                                                                  | Role                                                                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `expo`, `expo-router`, `react`, `react-native`                                           | Core platform (SDK 57 / RN 0.86 / React 19.2)                                      |
| `expo-constants`, `expo-linking`, `expo-status-bar`, `expo-splash-screen`                | Router/runtime plumbing required by Expo Router + splash gating                    |
| `expo-font`, `@expo-google-fonts/poppins`                                                | Poppins, per COLOR_GUIDE.md's typography spec                                      |
| `expo-image`                                                                             | Used in place of RN's `Image` for perf/caching                                     |
| `expo-secure-store`                                                                      | Auth JWT storage (`src/lib/token-store.ts`) — live since Phase 5                   |
| `@expo/vector-icons`                                                                     | Icon set (COLOR_GUIDE.md: "Lucide / Expo Vector Icons")                            |
| `@tanstack/react-query`                                                                  | Server-state cache — will own all Phase 2 API data                                 |
| `zustand` + `@react-native-async-storage/async-storage`                                  | Persisted client state (auth, favourites)                                          |
| `react-hook-form` + `zod` + `@hookform/resolvers`                                        | Form state + schema validation (sign-in/sign-up today, more forms in later phases) |
| `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context` | Required peer deps of Expo Router's native-stack navigator                         |

**Dev dependencies**: `typescript` (~6.0.3, strict), `eslint` (9.x, pinned —
10.x breaks `eslint-plugin-react` inside `eslint-config-expo`),
`eslint-config-expo`, `prettier`, `@types/react`.

**Scripts**: `start`/`android`/`ios`/`web` (expo start variants),
`typecheck`, `lint`, `format`, `clean-data`.

**Not yet in `package.json`** (planned, see §6): a backend workspace
(`Express`, `pg`/Supabase client) and a Python ML environment
(`scikit-learn`, `pandas`, `joblib`/`fastapi` or similar) — both land as
separate workspaces/services in Phases 2 and 4, not as app dependencies.

## 4. Navigation

Expo Router, file-based, with two route groups:

```
/ (index.tsx)                     redirect gate:
  ├─ !hasCompletedOnboarding  →  /(auth)/welcome
  ├─ !user                    →  /(auth)/sign-in
  └─ else                     →  /(tabs)

/(auth)/welcome                  onboarding → completeOnboarding() → sign-in
/(auth)/sign-in     ⇄  /(auth)/sign-up      (Link, cross-navigation)
  └─ on submit: signIn(user) → router.replace("/(tabs)")

/(tabs)                          bottom tab bar (4 tabs)
  ├─ index (Home)
  ├─ markets
  ├─ favorites
  └─ profile
      └─ signOut() → router.replace("/(auth)/sign-in")

/commodity/[id]                  pushed from Home / Markets / Favourites
/market/[id]                     pushed from Markets
/prediction/[id]                 pushed from a commodity/market detail screen
/+not-found                      catch-all
```

The gate logic lives once, in `app/index.tsx`, reading `useAuthStore`; no
screen re-implements auth redirects. `app/_layout.tsx` blocks all rendering
until fonts are loaded **and** the auth store has rehydrated from
AsyncStorage (`isHydrated`), so the gate never flashes a wrong screen on cold
start.

**Not yet implemented** (Phase 3 scope, per the build guide's screen list —
Splash, Auth, Home, Markets, Commodity Details, Prediction, History, Profile,
Settings): a dedicated **History** screen (price-trend history is currently
only implied via commodity/market detail) and a **Settings** screen (profile
today only covers account actions, not app settings). Both need routes added
under `app/` in Phase 3; no architectural blocker, since the route-group
pattern already supports it (either new tabs, or screens pushed from
Profile).

## 5. System architecture

**Layering** (each layer only depends on the one below it):

```
app/*                  screens — routing + composition only
  ↓
src/components          domain composites (CommodityCard, MarketRow)
  ↓
src/components/ui        theme-driven primitives
  ↓
src/theme                design tokens (colors/spacing/typography)
```

Orthogonal to that stack:

- **Server state** — `@tanstack/react-query`, via `src/lib/query-client.ts`.
  Nothing calls it yet (Phase 0/1 has no real API); Phase 2 wires screens to
  it through hooks that call `apiFetch` (`src/lib/api-client.ts`), which is
  already the single seam every future network call goes through.
- **Client state** — `zustand` + `persist` + AsyncStorage, for state that is
  local to the device and must survive restarts: `auth-store` (user session,
  onboarding flag) and `favorites-store` (favourited commodities). This is
  intentionally not server state — it's why it's Zustand, not React Query.
- **Forms** — `react-hook-form` + `zod` resolvers (`src/utils/validation.ts`).
  Validation schemas are the source of truth for both the error messages
  shown and the inferred TS types (`SignInFormValues`, `SignUpFormValues`).
- **Theming** — `ThemeProvider` derives light/dark from
  `useColorScheme()` (native, follows `app.json`'s
  `userInterfaceStyle: "automatic"`) and exposes one `useTheme()` hook.
  Screens and `ui/` components never hardcode colors, spacing, radii, or
  fonts — everything is a token lookup, checked in the Phase 0 audit.
- **Domain types** (`src/types/index.ts`) mirror `DATABASE_SCHEMA.md`'s
  `markets` / `commodities` / `prices` / `predictions` tables, extended
  where the actual cleaned dataset carries more than the schema doc's
  minimal columns (see below).

**Data flow today** (since Phase 5): every screen reads live data through
`src/hooks/` (one React Query hook per resource — `useMarkets`,
`useCommodities`, `usePrices`/`useLatestPrices`, `usePredictPrice`), which
call `apiFetch` → the real Express API → Postgres. `src/constants/sample-data.ts`
(the Phase 0–4 placeholder, generated from the cleaned CSV) is deleted —
there is no longer a local-data fallback path.

**Reconciling `DATABASE_SCHEMA.md` with the cleaned dataset**: the schema doc
defines a minimal 4-table shape. The actual cleaned CSV
(`country_iso3, date, year, month, region, district, market, latitude,
longitude, category, commodity, unit, unit_quantity, unit_measure,
price_type, currency, price`) carries more detail than that — notably
`district`/`latitude`/`longitude` on markets, and a `price_type`
(Wholesale/Retail) dimension on prices that the schema doc's `prices` table
doesn't have a column for (it assumes wholesale-only). `src/types/index.ts`
already extended the schema doc's shape to match reality (`Market.district`,
`Market.latitude/longitude`, `PricePoint.priceType`) rather than discarding
real data to fit the simplified doc. Phase 2's actual Postgres DDL should
follow `src/types/index.ts`, not the literal column list in
`DATABASE_SCHEMA.md` — treat that file as a starting sketch, not the final
contract.

**Backend architecture** (per `PROJECT_REQUIREMENTS.md`'s tech stack —
Node.js/Express + PostgreSQL/Supabase), live since Phase 5:

```
Expo app  ──HTTPS/JSON──▶  Express API  ──SQL──▶  PostgreSQL (Supabase)
                                │
                                └──HTTP──▶  Python/Scikit-learn prediction
                                            service (ml/)
```

`apiFetch<T>()` (JSON in/out, thrown `ApiError` with a parsed message and
HTTP status, auto-attached JWT) is the one seam every hook goes through —
see `src/hooks/` for the full list.

**Path aliases**: `@/*` → `src/*`, `@app/*` → `app/*` (via `tsconfig.json`
`paths`; no `baseUrl`, since `moduleResolution: "bundler"` in TS 6.x doesn't
need one).

## 6. Implementation plan — Phases 2–6

**Phase 2 — Database & Backend**

- Stand up Postgres (Supabase) with tables for `markets`, `commodities`,
  `prices`, `predictions`, shaped per `src/types/index.ts` (see §5
  reconciliation note), not the literal `DATABASE_SCHEMA.md` column list.
- Express API: REST endpoints for markets/commodities/prices, filterable by
  region/category/date range; auth endpoints (sign-up/sign-in) to replace
  the local Zustand stub in `auth-store.ts`.
- Import pipeline: load `data/ghana_food_prices_clean.csv` into the schema
  (one-time seed script), preserving the two-row exclusion and 45 retained
  outliers documented in `data/reports/CLEANING_CHANGELOG.md`.
- Validation: request/response schemas (reuse `zod` on the backend too, for
  one validation vocabulary across client and server).
- **Validation prompt**: run backend tests, fix all issues before continuing.

> **✅ Implemented.** See [`server/README.md`](server/README.md) for setup
> and the full endpoint list. Notes/deltas from the plan above:
>
> - Local PostgreSQL 16 (via Homebrew) rather than Supabase for dev/test —
>   `DATABASE_URL` is the only thing that changes to point at Supabase later,
>   nothing in the schema or query layer is Supabase-specific.
> - Schema matches `src/types/index.ts` as planned (§5), plus a `users`
>   table (not in `DATABASE_SCHEMA.md`, but required for the auth endpoints
>   PROJECT_REQUIREMENTS.md lists as a core feature): bcrypt-hashed
>   passwords, JWT session tokens, `GET /api/auth/me` to verify a token
>   round-trips correctly.
> - Added `GET /api/prices/latest` (not in the original plan) — a `DISTINCT
ON (commodity_id, market_id, price_type)` query backing the "current
>   wholesale prices" home-dashboard feature from `PROJECT_REQUIREMENTS.md`,
>   which plain `GET /api/prices` can't express efficiently.
> - `predictions` table + `GET /api/predictions` exist and are queryable now;
>   the table is empty until Phase 4's model writes to it.
> - Tests (`server/tests/`, vitest + supertest) run against a **real**
>   Postgres test database via a global setup step that resets the schema
>   and runs the actual CSV import pipeline once — not a mocked DB layer —
>   so the import/seed pipeline itself is under test, not just the routes.
> - `server/` is a fully independent npm workspace (own `package.json`,
>   `tsconfig.json`, `eslint.config.js`) excluded from the root Expo app's
>   `tsconfig.json`/`eslint.config.js`, per §5's "separate workspace" note —
>   no dependency bleed between the RN/Expo toolchain and the Node backend.
> - The Expo app is **not** wired to this API yet — sign-in/sign-up still use
>   the local Zustand stub, `sample-data.ts` is still the UI's data source.
>   That connection is explicitly Phase 5 scope, not Phase 2.

**Phase 3 — UI**

- Implement full-fidelity screens in the grocery-app-inspired design
  language already established by the theme/`ui/` layer: Splash, Auth, Home,
  Markets, Commodity Details, Prediction, History, Profile, Settings.
- Add the two screens not yet routed: **History** (price trend charts per
  commodity/market) and **Settings** (app-level: theme override, currency
  display, notifications — distinct from Profile's account actions).
- Wire real data via the Phase 2 API + React Query hooks, retiring
  `sample-data.ts`.
- **Validation prompt**: verify navigation, responsiveness, design
  consistency (same checklist as the Phase 0 audit, re-run against the full
  screen set).

> **✅ Implemented, with one deliberate deviation.** All 9 screens were
> built to full fidelity, but **real-data wiring was deferred to Phase 5**
> rather than done here — `sample-data.ts` was kept (and expanded to real
> per-commodity price history from the CSV) through Phase 3, matching the
> same "build the layer, validate it standalone, wire it up in a later
> phase" pattern already used for Phase 2's backend and Phase 4's ML API.
> The build guide's own phase split backs this: Phase 5 is explicitly
> "Integration," so doing the wiring in Phase 3 would have jumped ahead of
> Phase 4 existing at all (there was no prediction API yet to wire the
> Prediction screen to). See `README.md`'s Phase 3/5 roadmap entries for
> what actually shipped in each.

**Phase 4 — AI**

- Python/Scikit-learn regression model predicting wholesale price from
  commodity, market, month, year (per `PROJECT_REQUIREMENTS.md`), trained on
  `data/ghana_food_prices_clean.csv`.
- Evaluate (train/test split, error metrics — MAE/RMSE at minimum), persist
  the trained model, expose it behind a small prediction API (FastAPI/Flask,
  or an Express route that shells out — decide based on deploy target).
- **Validation prompt**: validate model metrics, preprocessing, and API
  contract before Phase 5 depends on it.

> **✅ Implemented.** See [`ml/README.md`](ml/README.md) and
> [`ml/reports/MODEL_EVALUATION.md`](ml/reports/MODEL_EVALUATION.md) for the
> full writeup. Notes/deltas from the plan above:
>
> - **FastAPI**, not Flask or an Express shell-out — chosen for built-in
>   request validation (Pydantic) and auto-generated OpenAPI docs, standard
>   for Python ML serving.
> - Three real candidates compared, not just one model: a naive
>   group-mean baseline, Linear Regression, Random Forest, and Gradient
>   Boosting. **Random Forest** won on MAE and MAPE (chosen metric —
>   RMSE/R² are scale-dominated and misleading here given how much price
>   scale varies across commodities; see the report §4).
> - **Per-(commodity, market) chronological split**, not a single global
>   date cutoff — a global cutoff left 43 of ~450 pairs with zero training
>   rows, which the report explains is a worse evaluation setup, not a
>   simpler one.
> - Metrics: MAE, RMSE, R², **and MAPE** (not just MAE/RMSE as sketched
>   above) — necessary given the price-scale spread, plus a per-category
>   breakdown showing the model is much more reliable on storable staples
>   than on fresh produce (report §5).
> - **Cowpeas has no Wholesale rows** in the cleaned dataset (Retail only),
>   so it's excluded from training; `POST /predict` returns 422 for it
>   rather than a fabricated number.
> - Tuned `n_estimators` down from 300 to 100 after finding the first
>   version serialized to a 156 MB artifact for no accuracy gain — 100
>   trees is 52 MB at statistically identical accuracy.
> - 10 tests (`ml/tests/test_api.py`) against a real `TestClient`, no
>   mocking.
> - **Not called by `server/` or the Expo app yet** — this service is
>   self-contained and independently runnable, matching how Phase 2's
>   backend and Phase 3's UI were each validated standalone before being
>   connected. That connection, including whether predictions get cached
>   into Postgres' `predictions` table or served live, is Phase 5.

**Phase 5 — Integration**

- Connect frontend (`apiFetch`/React Query hooks) → Express API → Postgres →
  prediction service end-to-end; the `prediction/[id]` route becomes a real
  call, not a static value.
- **Validation prompt**: end-to-end testing across the full stack; repair
  all failures before continuing.

> **✅ Implemented.** Notes/deltas from the plan above:
>
> - **New `src/hooks/` layer** (`useMarkets`, `useCommodities`, `usePrices`/
>   `useLatestPrices`, `usePredictPrice`, `useSignIn`/`useSignUp`) — every
>   screen goes through these, none call `apiFetch` directly.
> - **Auth is real**: JWT from `POST /api/auth/sign-in`/`sign-up` is stored
>   in `expo-secure-store` (not AsyncStorage — it's sensitive), loaded once
>   at app startup (`app/_layout.tsx`) before the app renders, and attached
>   to every `apiFetch` call automatically.
> - **New backend endpoint**: `POST /api/predictions` — not in the original
>   plan text, but required to make "ensure prediction works from the app"
>   real. Looks up commodity/market names from their IDs, calls the ML
>   API (`server/src/lib/ml-client.ts`), persists the result (new
>   `model_name` column, migration `002`), returns it. Forwards the ML
>   API's 422 (unknown commodity — e.g. Cowpeas) rather than swallowing it
>   into a generic error.
> - **Default-market selection**: a commodity trades at many markets, but
>   Phase 3's screens were built around one market per commodity. Rather
>   than redesign that UX mid-integration, each screen picks the market
>   with the most recently dated Wholesale price
>   (`src/utils/prices.ts:pickMostRecentWholesale`) as a deterministic
>   default — same rule everywhere, reused across Home/Favourites (grouped
>   per commodity) and Commodity Detail/History/Prediction (single commodity).
> - **Prediction horizon is anchored to the dataset's own latest date, not
>   device time** — the dataset ends 2023-07; predicting "next month" from
>   a real 2026 clock would ask a Random Forest to extrapolate 3 years
>   past its training range, which tree models do badly (they can't
>   extrapolate past observed splits). "Next month" / "+3 months" / "+6
>   months" are computed from the commodity's own latest recorded price
>   instead — this keeps predictions near the training distribution.
> - **Per-category confidence badges** on the Prediction screen
>   (`src/utils/prediction-confidence.ts`), sourced directly from
>   `ml/reports/MODEL_EVALUATION.md` §5's real per-category MAPE numbers —
>   the report explicitly flagged this as a "Phase 5/6 decision," now made.
> - **Verification**: `tsc`/`eslint`/`prettier`/`expo-doctor` clean; a
>   production Android bundle export (no mocked modules) to catch
>   import/runtime errors across every rewired screen; the server's test
>   suite extended to 41 tests (8 new, against a _real_ spawned ML server,
>   not mocked); and a full manual curl chain (sign-up → authenticated
>   `/me` → browse markets/commodities/prices → predict → sign-in) run
>   against the live three-service stack end to end.
> - **Not done here**: no simulator/device was used to visually click
>   through the app — verification is static (types/lint/bundle) plus
>   the real API chain via curl, not a rendered UI. Flagging this
>   honestly rather than claiming a visual check that didn't happen.

**Phase 6 — Polish**

- Loading states, empty states (`EmptyState.tsx` already exists as a
  primitive — extend usage app-wide), animations, price-history charts,
  error handling (surface `ApiError` meaningfully in the UI), accessibility
  pass, production build optimizations.
- Confirm Expo Go compatibility is preserved throughout (no native modules
  requiring a custom dev client, per `PROJECT_REQUIREMENTS.md`'s
  non-functional requirements).
- **Validation prompt**: final production-readiness audit; fix every
  remaining issue; generate README and deployment guide.

> **✅ Implemented.** See [`DEPLOYMENT.md`](DEPLOYMENT.md). Notes/deltas:
>
> - **Animations**: RN's core `Animated` API, not `react-native-reanimated`
>   — zero extra dependency, no version-matching risk, sufficient for the
>   scope (screen fade/rise on mount in `Screen`, press-scale on `Button`,
>   a heart-bounce on favorite-toggle).
> - **Loading states**: a `Skeleton` primitive (`src/components/ui/Skeleton.tsx`)
>   replaces bare spinners on Home/Markets/Favourites; smaller loads
>   (Commodity Detail's chart, etc.) keep `ActivityIndicator`.
> - **Error handling**: a global `ErrorBoundary` (new — not in the original
>   plan text) catches render errors app-wide instead of a white-screen
>   crash; `server/`'s error handler already didn't leak stack traces
>   (verified, not just assumed); `ml/`'s API gained an explicit unhandled-
>   exception handler for the same reason, plus `helmet` + rate limiting on
>   `server/`'s auth routes (brute-force protection — also not in the
>   original plan text, added because auth became real in Phase 5).
> - **Offline-friendliness** (`PROJECT_REQUIREMENTS.md`'s non-functional
>   requirement, not explicitly in this phase's plan text either): React
>   Query's cache is now persisted to `AsyncStorage`
>   (`src/lib/query-client.ts`) — read-only stale-while-revalidate, not a
>   write queue. Phase 5 had removed the only offline path (`sample-data.ts`);
>   this restores one without reintroducing fake data.
> - **Accessibility**: consolidated `accessibilityLabel`/`accessibilityRole`
>   on every custom pressable and list item (`CommodityCard`, `MarketRow`,
>   `MarketCard`, `SegmentedControl`, plus a Profile screen gap found and
>   fixed — a chevron-only pressable with no label, now the whole row).
>   `PriceChart` gained a summarizing `accessibilityLabel` since its SVG
>   content is invisible to screen readers.
> - **Production optimizations**: `React.memo` on list item components;
>   `API_URL` switched from `Constants.expoConfig.extra` to
>   `EXPO_PUBLIC_API_URL` (Expo's built-in per-environment env var
>   inlining — simpler and more standard for EAS build profiles).
> - **Expo Go compatibility**: confirmed via `expo-doctor` (20/20) and a
>   full dependency audit — every package added since Phase 0, including
>   this phase's, is either pure JS or a standard bundled Expo SDK module.
> - **Known, documented gaps** (not silently omitted): no CI/CD pipeline,
>   no Expo-app-level automated test suite (server/ml both have real test
>   suites; the app's verification is static + a bundle export, not
>   component tests), no crash-reporting service wired up (the
>   `ErrorBoundary` has a clear seam for one). See `DEPLOYMENT.md` §6.

Each phase's validation prompt is a hard gate — per the pattern already
followed in Phase 0/1, no phase's build work should be considered done until
its own audit passes clean.
