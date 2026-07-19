# Model Evaluation — Wholesale Price Regression

Phase 4 deliverable. Trains a regression model predicting wholesale price
from **commodity, market, month and year** (exactly the feature set the
build prompt specifies — no lag/autoregressive features, no external
economic indicators), evaluates it honestly, and documents where it's
reliable and where it isn't.

Reproduce: `ml/.venv/bin/python ml/src/train.py` (from the repo root or
`ml/src/`). Deterministic — `RANDOM_STATE = 42` everywhere a candidate model
uses one.

## 1. Data

`data/ghana_food_prices_clean.csv`, filtered to `price_type == "Wholesale"`:
**7,206 rows**, 2015-01-15 to 2023-07-15, 25 commodities × 20 markets (not
all 500 combinations exist — coverage varies by market/commodity).

**Cowpeas is excluded.** It has zero Wholesale rows in the cleaned dataset —
every recorded Cowpeas price is Retail (see Phase 0's
`data/reports/CLEANING_CHANGELOG.md`). This isn't a bug in this phase; it's
a direct, correct consequence of the build prompt asking specifically for
wholesale prices. `POST /predict` returns a 422 for Cowpeas rather than a
fabricated number — see §4.

## 2. Preprocessing

- **Categorical** (`commodity`, `market`): one-hot encoded, `handle_unknown="ignore"` so an unseen category at inference time contributes no signal instead of crashing.
- **`month`**: encoded as `(sin, cos)` of `2π·month/12` rather than the raw integer 1–12. A raw integer tells the model December (12) and January (1) are 11 apart, which is wrong — they're adjacent. This is a real, measurable modeling decision, not decoration: seasonal effects (harvest/lean seasons) are exactly the kind of pattern this dataset should let a model pick up, and a raw integer actively fights that.
- **`year`**: passed through as-is (captures multi-year trend/inflation).
- No scaling — both candidate models below are tree-based or handle unscaled linear inputs fine; the one-hot + 3 numeric columns don't need it.

## 3. Train/test split

**Per-(commodity, market) chronological split**, not a single global date
cutoff. Each of the ~450 (commodity, market) groups is sorted by date and
the last 20% of _that group's own points_ becomes test data.

This was a deliberate choice after checking the alternative: a single global
cutoff (tried at 2022-01-01) left **43 of the ~450 pairs with zero training
rows** — pairs whose price tracking in this dataset only started in 2022 or
later. Evaluating a model on pairs it never saw a single training example of
isn't a meaningful test of "how well does this model predict" — it's a test
of "how well does this model extrapolate to categories it has literally no
information about," which is a different and less useful question here. The
per-group split guarantees every pair contributes to both train and test
(down to a minimum of 1 test row for the smallest groups), while still being
a genuine temporal holdout — the model never sees the future of any group it's evaluated on.

Result: **5,729 train rows / 1,477 test rows (20.5% test)**.

## 4. Model comparison

Three real candidates plus a naive baseline, all evaluated on the same held-out test set:

| Model                        |  MAE (GHS) | RMSE (GHS) |        R² |      MAPE |
| ---------------------------- | ---------: | ---------: | --------: | --------: |
| Naive (group mean)           |     285.41 |     431.38 |     0.031 |     65.1% |
| Linear Regression            |     239.48 |     379.45 |     0.250 |     86.8% |
| **Random Forest** (selected) | **188.15** |     330.37 |     0.432 | **58.5%** |
| Gradient Boosting            |     194.09 | **317.05** | **0.477** |     86.5% |

**Naive baseline**: predicts each test row as its (commodity, market) pair's
mean price from the training data alone. Any real model has to beat this to
be worth anything — it's the "just guess the average" bar.

**Why Random Forest, not Gradient Boosting**, despite GB's better RMSE/R²:
this dataset's price scale varies enormously across commodities (tomatoes
~GHS 25 vs. yam ~GHS 1,200+). RMSE and R² are dominated by whichever rows
have the largest absolute prices, so a model can post a good RMSE/R² by
fitting the expensive commodities well while doing badly, proportionally, on
cheap ones. MAPE doesn't have that bias — it weights every row by its own
percentage error, so cheap and expensive commodities count equally. Random
Forest wins on **both** MAE and MAPE; Gradient Boosting's MAPE (86.5%) is
barely better than plain Linear Regression's (86.8%), meaning it's
systematically worse, proportionally, on the majority of commodities even
though it wins on the scale-dominated metrics. Model selection in
`train.py` picks by MAE (decided before results were seen, not
cherry-picked after), and MAE and MAPE agree here.

**Forest size**: the first working version used `n_estimators=300`, which
serialized to a 156 MB `.joblib` file — too large for a "production-ready"
artifact (slow cold start, unnecessary memory footprint). Sweeping
`n_estimators` down showed accuracy is flat from 300 to 100 trees (MAE
188.25 → 188.15, i.e. noise) and only degrades once tree count drops further
or `max_depth` gets constrained. `n_estimators=100` was kept: identical
accuracy, 52 MB — a strictly better operating point, not a tradeoff.

## 5. Where the model is reliable, and where it isn't

Per-category breakdown for the selected Random Forest model, on the same test set:

| Category              | n (test rows) | MAE (GHS) |       MAPE |
| --------------------- | ------------: | --------: | ---------: |
| Pulses and nuts       |            88 |    185.22 |      37.4% |
| Cereals and tubers    |           779 |    219.04 |      38.1% |
| Meat, fish and eggs   |           188 |    230.40 |      49.6% |
| Vegetables and fruits |           422 |    112.91 | **104.4%** |

Vegetables and fruits have the _lowest_ absolute error (GHS 113) but the
_highest_ percentage error (>100% — the average miss is larger than the
price itself). This is a real, explainable limitation, not noise: fresh
produce is perishable and its price is driven substantially by short-term
supply shocks (a bad harvest week, a transport disruption) that repeat
year-to-year in neither a fixed calendar month nor a steady multi-year
trend — the only two kinds of signal `month`/`year` can give a model. Phase
0's own outlier analysis (`data/reports/CLEANING_CHANGELOG.md`) already
found and validated several large, real (non-error) price shocks in exactly
this category. Cereals/tubers and pulses/nuts — more storable commodities
with less volatile short-term supply — predict meaningfully better (~37% MAPE).

**Practical takeaway**: this model is reasonably trustworthy for storable
staples (grains, tubers, legumes) and much less trustworthy for fresh
produce. A production feature using this should surface that distinction to
users (e.g., a confidence indicator per category) rather than presenting
every prediction with equal confidence. That's a Phase 5/6 UI decision, not
addressed here — flagging it now so it isn't lost.

## 6. What would improve this (out of scope for Phase 4)

The build prompt fixes the feature set to commodity/market/month/year. Given
that constraint, the largest lever left is model choice/tuning, which was
explored (§4). The bigger lever — not used, because it's outside the
specified inputs — would be **lag features** (last month's price for that
commodity/market) or an external signal (fuel price, exchange rate,
rainfall). Noting this for whoever scopes Phase 4 follow-up work or a future
model-quality pass; not implemented here since it would mean training on
inputs the build prompt didn't ask for.

## 7. API

See `ml/README.md` for the FastAPI service (`ml/src/api.py`) that serves
this model, and `ml/tests/test_api.py` for its test suite. The persisted
artifact is `ml/models/price_model.joblib` (the fitted preprocessing +
model pipeline, one object) plus `ml/models/metadata.json` (metrics, known
commodities/markets, training row counts — regenerated by `train.py`, not
hand-edited).
