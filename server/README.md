# PriceMate API (Phase 2)

Express + TypeScript + PostgreSQL backend. Independent npm workspace — not
part of the Expo app's dependency tree (see `../ARCHITECTURE.md` §5 for why).

## Prerequisites

A local PostgreSQL server. On macOS:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb pricemate        # dev database
createdb pricemate_test   # test database
```

Any reachable Postgres works (Docker, Supabase, etc.) — just point
`DATABASE_URL` at it.

The `../ml/` prediction API running (see `../ml/README.md`) — `POST
/api/predictions` calls it over HTTP. Everything else (markets, commodities,
prices, auth) works without it.

## Setup

```bash
cd server
npm install
cp .env.example .env      # edit if your DB or ML API aren't at the default local URLs
npm run migrate            # applies src/migrations/*.sql
npm run seed                # imports ../data/ghana_food_prices_clean.csv,
                             # then ../data/mofa_community_prices_clean.csv
```

The seed script is idempotent — re-running it upserts markets/commodities and
skips price rows already present (`ON CONFLICT DO NOTHING` on
`(commodity_id, market_id, date, price_type, unit)`), so it's safe to run
again after pulling a newer cleaned CSV. It also imports
`data/mofa_community_prices_clean.csv` into the separate `community_prices`
table — a second real data source (MoFA SRID) with no documented unit, kept
apart from `prices` and never used for the wholesale trend or ML training;
see `data/reports/MOFA_CLEANING_CHANGELOG.md`. This is also where the app's
10 additional individually-named markets (Makola, Agbogbloshie, etc.) come
from, alongside the original 20 city-level markets.

## Running

```bash
npm run dev     # tsx watch, http://localhost:4000
npm run build   # tsc -> dist/
npm start        # node dist/index.js (after build)
```

## Testing

Tests run against a **real** Postgres database (`pricemate_test` by
default, see `vitest.config.ts`), not a mock — `tests/global-setup.ts` drops
and rebuilds the schema, then runs the real CSV import pipeline once before
the suite, so route tests exercise the actual seeded dataset end to end.
Global setup also spawns the real `ml/` FastAPI service on port 8001 (reused
if one's already running there) so `predictions.test.ts` exercises a real
Express → ML HTTP call too, not a mock — it's killed again in teardown.

```bash
createdb pricemate_test   # once, if not already created
npm test
```

## API

All responses are JSON. Errors: `{ "error": string, "issues"?: ZodIssue[] }`.

| Method | Path                    | Notes                                                                                                                                                                                       |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`           | Liveness check                                                                                                                                                                              |
| POST   | `/api/auth/sign-up`     | `{ name, email, password }` → `{ user, token }`                                                                                                                                             |
| POST   | `/api/auth/sign-in`     | `{ email, password }` → `{ user, token }`                                                                                                                                                   |
| GET    | `/api/auth/me`          | Requires `Authorization: Bearer <token>`                                                                                                                                                    |
| GET    | `/api/markets`          | `?region=`                                                                                                                                                                                  |
| GET    | `/api/markets/:id`      |                                                                                                                                                                                             |
| GET    | `/api/commodities`      | `?category=` (one of the 4 fixed categories)                                                                                                                                                |
| GET    | `/api/commodities/:id`  |                                                                                                                                                                                             |
| GET    | `/api/prices`           | `?commodityId=&marketId=&priceType=&from=&to=&limit=&offset=`                                                                                                                               |
| GET    | `/api/prices/latest`    | Most recent row per commodity/market/priceType combination                                                                                                                                  |
| GET    | `/api/predictions`      | `?commodityId=&marketId=`                                                                                                                                                                   |
| POST   | `/api/predictions`      | `{ commodityId, marketId, month, year }` → calls the Phase 4 ML API and persists the result. 422 if the commodity has no Wholesale training data (e.g. Cowpeas).                            |
| GET    | `/api/community-prices` | `?commodityId=&marketId=&priceType=&limit=&offset=` — MoFA SRID "as reported" prices, see `data/reports/MOFA_CLEANING_CHANGELOG.md`.                                                        |
| GET    | `/api/news`             | Real Ghana food/agriculture news via GNews, cached server-side for 6h (see `src/lib/news-client.ts`). Always 200s with an array — `[]` if `GNEWS_API_KEY` is unset or GNews is unavailable. |

## Schema notes

`src/migrations/001_init.sql` extends `DATABASE_SCHEMA.md`'s minimal 4-table
sketch to match what the cleaned dataset actually contains (district/lat/long
on markets, a `price_type` + unit triple on prices) — see
`../ARCHITECTURE.md` §5 for the full reconciliation rationale. A `users`
table backs authentication, which isn't in `DATABASE_SCHEMA.md` but is listed
as a core feature in `PROJECT_REQUIREMENTS.md`.
