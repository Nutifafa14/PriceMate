# Data

| File | Description |
|---|---|
| `raw_ghana_food_prices.csv` | Verbatim copy of the uploaded source export (8,545 rows). Never edited directly. |
| `ghana_food_prices_clean.csv` | Cleaned, typed, enriched output (8,543 rows). This is what the backend seed script (Phase 2) and the ML training pipeline (Phase 4) should read. |
| `reports/CLEANING_CHANGELOG.md` | Human-readable writeup of every check performed and every change made, with reasoning. **Read this first.** |
| `reports/flagged_outliers.csv` | All 47 statistically-flagged price points with the automated decision (removed/retained) and full reasoning for each — useful for a domain expert to sanity-check or override. |
| `scripts/01_inspect_structure.py` | Structural audit: duplicates, missing values, invalid dates/types, whitespace, categorical consistency. |
| `scripts/02_inspect_semantics.py` | Semantic audit: commodity↔category consistency, commodity↔unit sets, pricetype↔unit sets, statistical outlier candidates. |
| `scripts/03_inspect_outlier_candidates.py` | Deep-dive on specific flagged points: own time series + same-date cross-market comparison. |
| `scripts/04_clean.py` | The actual cleaning pipeline. Reads `raw_ghana_food_prices.csv`, writes `ghana_food_prices_clean.csv` and `reports/flagged_outliers.csv`. Idempotent — safe to re-run (`npm run clean-data`). |

Run the full pipeline from the project root:

```bash
npm run clean-data
```
