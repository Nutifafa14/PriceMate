# PriceMate ML (Phase 4)

Python/scikit-learn wholesale-price regression model + FastAPI prediction
service. Independent workspace (own venv) — not part of the Expo app's or
the Express backend's dependency tree.

## Setup

```bash
cd ml
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
```

## Train

```bash
.venv/bin/python src/train.py
```

Reads `../data/ghana_food_prices_clean.csv`, trains and evaluates several
candidate models, and writes:

- `models/price_model.joblib` — the winning fitted pipeline (preprocessing + model, one object)
- `models/metadata.json` — metrics, known commodities/markets, training row counts

Full methodology and results: **[`reports/MODEL_EVALUATION.md`](reports/MODEL_EVALUATION.md)**.
Short version: Random Forest, MAE ≈ GHS 188 / MAPE ≈ 58% on a held-out
per-(commodity, market) chronological test split — meaningfully better than
a naive group-mean baseline, most reliable on storable staples (grains,
tubers, legumes), least reliable on fresh produce (see the report for why).

## Run the API

```bash
cd src
../.venv/bin/uvicorn api:app --reload --port 8000
```

Interactive docs at `http://localhost:8000/docs`.

| Method | Path        | Notes                                                                                              |
| ------ | ----------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/health`   | Liveness check                                                                                     |
| GET    | `/metadata` | Model name, metrics, known commodities/markets, training info                                      |
| POST   | `/predict`  | `{ commodity, market, month, year }` → `{ predictedPrice, currency, modelName, predictedAt, ... }` |

`/predict` returns **422** for a commodity/market outside the training set —
notably **Cowpeas**, which has no Wholesale rows in the cleaned dataset (see
the evaluation report §1) and so has no wholesale model to predict from.
This is a deliberate, honest failure mode, not a bug: the API never
fabricates a number for something it wasn't trained on.

## Test

```bash
.venv/bin/python -m pytest tests/ -v
```

10 tests against a real `TestClient` (no mocking) — health, metadata shape,
a real prediction, determinism, and every rejection path (unknown
commodity/market, Cowpeas specifically, out-of-range month/year, missing
field).

## Not done here (by design)

- **Not called by the Express API or the Expo app yet.** This service is
  self-contained and independently runnable/testable. Wiring it into
  `server/`'s `/api/predictions` and the app's Prediction screen — including
  deciding whether predictions get cached into Postgres' `predictions` table
  or served live — is Phase 5 (Integration), matching how Phase 2's backend
  and Phase 3's UI were each also built and validated independently before
  being connected.
- **No lag/autoregressive or external features** (last month's price,
  fuel/exchange-rate signals). The build prompt specifies commodity, market,
  month and year only; see the evaluation report §6 for what a future
  accuracy pass could add.
