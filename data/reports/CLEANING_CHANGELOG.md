# Data Cleaning Changelog — Ghana Food Prices Dataset

**Source:** `data/raw_ghana_food_prices.csv` (copied verbatim from the uploaded
`ghana_food_prices_cleaned.csv`, 8,545 data rows)
**Output:** `data/ghana_food_prices_clean.csv` (8,543 data rows)
**Reports:** `data/reports/flagged_outliers.csv` (all 47 statistically flagged
points, with the decision and reasoning for each)

This document records every check performed and every change made, per the
brief: *"inspect it, identify duplicates, missing values, inconsistent names,
invalid dates, incorrect data types and outliers. Clean it automatically,
document every change."*

## Summary of findings

The source file turned out to be **structurally very clean already**. Despite
its filename, it had not been checked for statistical/semantic issues, so a
full automated audit (`inspect.py`, `inspect2.py`, `inspect3.py`) was run
before touching anything:

| Check | Result |
|---|---|
| Exact duplicate rows | **0** found |
| Duplicate (date+market+commodity+unit+pricetype) keys with conflicting prices | **0** found |
| Missing/blank values (any of the 13 source columns) | **0** found |
| Invalid/unparseable dates | **0** found (all `M/D/YYYY`, always day=15, range 2015-01 → 2023-07) |
| Non-numeric or out-of-range `price` | **0** found |
| Non-positive (`<= 0`) prices | **0** found |
| `latitude`/`longitude` outside Ghana's bounding box (4–12°N, -4–2°E) | **0** found |
| Leading/trailing/double whitespace in any field | **0** found |
| `commodity` mapping to more than one `category` | **0** found (26 commodities, 4 categories, 1:1) |
| `market` mapping to more than one `region`/`district`/lat-long | **0** found (20 markets, all internally consistent) |
| Inconsistent casing/spelling in `region`, `category`, `pricetype`, `currency`, `unit` | **0** found |

Because nothing above required a fix, the automated pipeline still performs
all of the following steps defensively (so it is safe to re-run on a future,
messier export of the same dataset) and reports the count each step actually
changed:

## Steps performed (in order)

1. **Whitespace normalization** — trim + collapse internal whitespace on every
   field. *0 cells changed.*
2. **Exact duplicate row removal** — drop byte-identical rows. *0 rows
   removed.*
3. **Type coercion** — `price`, `latitude`, `longitude` → float; `date` →
   `datetime` (parsed as `M/D/YYYY`). Rows that fail to parse are dropped and
   logged. *0 rows dropped.*
4. **Critical-field completeness** — rows missing `market`, `commodity`,
   `unit`, `pricetype`, `category`, or `region` are dropped. *0 rows dropped.*
5. **Non-positive price removal** — `price <= 0` is physically impossible for
   a market price. *0 rows dropped.*
6. **Unit decomposition** — `unit` (e.g. `"91 KG"`, `"30 pcs"`, `"Bunch"`) is
   split into a numeric `unit_quantity` and a string `unit_measure` for
   downstream ML feature engineering (bags/bunches priced per KG-equivalent
   later in Phase 4). *Applied to all 8,545 rows — not a correction, an
   enrichment.*
7. **Key-level duplicate resolution** — for any `(date, market, commodity,
   unit, pricetype)` combination appearing more than once, the later record
   would be kept and the earlier dropped. *0 rows removed (none existed).*
8. **Outlier detection & remediation** — see methodology below.
   **2 rows removed.**

## Outlier methodology (the one substantive edit)

Ghana's wholesale prices legitimately span **two orders of magnitude across
the 2015–2023 window** because of real cedi depreciation and known regional
supply shocks (e.g. the Feb 2021 tomato shortage after Burkina Faso's export
restriction, and the 2022 currency crisis). A naive global or per-commodity
outlier filter would delete real, important signal — exactly the kind of
signal this system is meant to surface. So a conservative, two-part test was
used instead of a single z-score cutoff:

1. **Statistical flag** — within each `(commodity, unit, pricetype, year)`
   group (n ≥ 5), compute the median-absolute-deviation–based modified
   z-score. Flag anything with `|z| > 8`. This produced **47 candidates**.
2. **Corroboration test** (applied only to the 47 candidates) — a flagged
   point is treated as a **probable data-entry error** and removed only if
   **all** of:
   - it is ≥ 8× its own `(market, commodity, unit, pricetype)` time-series
     median (i.e. an isolated spike in that market's own history), **and**
   - no other market reporting the same commodity/unit/pricetype on the same
     date shows a comparable relative elevation (≥ 3× that other market's own
     baseline, or ≥ 2 other markets simultaneously ≥ 3× the group median) —
     i.e. the move is **not corroborated** across markets.

   A point that fails either condition is **retained** as a plausible real
   market event (widespread synchronized moves, like the Feb 2021 tomato
   spike corroborated across 7 markets, are always retained).

### Rows removed as data-entry errors

| Date | Market | Commodity | Unit | Price | Own-series median | Ratio | Other markets same date |
|---|---|---|---|---|---|---|---|
| 2015-01-15 | Sekondi/Takoradi | Plantains (apentu) | Bunch, Wholesale | **380.0** | 40.34 | 9.4× | 10 markets, all reporting 5–20 |
| 2023-03-15 | Wa | Eggs | 30 pcs, Wholesale | **4114.55** | 394.26 | 10.4× | 9 markets, none elevated |

Both are single-market, single-month spikes with no supporting move anywhere
else in the country and a sharp reversion the following observation — the
signature of a fat-fingered entry (e.g. a stray digit), not a market event.

### Flagged but retained (45 of 47)

The remaining 45 candidates were **kept** — the full list with z-scores,
ratios, and the corroboration verdict for each is in
`data/reports/flagged_outliers.csv`. Notable examples:

- **Tomatoes (navrongo), 52 KG Wholesale, Feb 2021**: Garu, Ejura, Kumasi,
  Tema, Sekondi/Takoradi, Bolga, Accra and Techiman *all* spiked 5–15× their
  normal price in the same month — a real, corroborated national shortage,
  not an error.
- **Eggs / Meat / Yam wholesale prices in 2022–2023**: large jumps reflect
  Ghana's genuine inflation/currency crisis in that period, corroborated by
  the same upward trend across multiple markets and sustained (not
  single-point) in the following months.
- **A handful of single-market, no-cross-reference points** (e.g. Cowpeas
  retail, Sekondi/Takoradi, Jan 2020, ratio 7.7×) sit just under the 8×
  removal threshold with no other market reporting that commodity/date to
  corroborate or refute them. These are called out explicitly in the report
  as borderline (`RETAINED_PLAUSIBLE_MARKET_EVENT` with ratio 5–8×) so a
  domain reviewer can override the automated decision if desired. The
  pipeline intentionally does not guess on these — an 8× hard threshold with
  full transparency was preferred over manual cherry-picking, to keep the
  process reproducible.

## Output schema

`data/ghana_food_prices_clean.csv` (8,543 rows), sorted by date, market,
commodity, unit:

| Column | Type | Notes |
|---|---|---|
| `country_iso3` | string | always `GHA` |
| `date` | ISO `YYYY-MM-DD` | was `M/D/YYYY` |
| `year` | int | derived |
| `month` | int (1–12) | derived |
| `region` | string | was `admin1` |
| `district` | string | was `admin2` |
| `market` | string | |
| `latitude`, `longitude` | float (4dp) | |
| `category` | string | |
| `commodity` | string | |
| `unit` | string | original combined unit string, e.g. `"91 KG"` |
| `unit_quantity` | float | numeric portion of `unit`, e.g. `91` |
| `unit_measure` | string | measure portion of `unit`, e.g. `"KG"` |
| `price_type` | string | `Wholesale` \| `Retail` (was `pricetype`) |
| `currency` | string | always `GHS` |
| `price` | float (2dp) | |

This maps onto `DATABASE_SCHEMA.md`'s `prices` table
(`commodity_id, market_id, date, wholesale_price, currency, unit`) with one
intentional extension: **`price_type`** is kept as its own column (rather
than assuming everything is wholesale) because 1,337 of the 8,545 rows are
retail observations and dropping that distinction would silently corrupt the
price series. This is called out again in `DATABASE_SCHEMA.md` updates in
Phase 2.

## Row-count reconciliation

```
8,545  source rows
-    0  exact duplicates
-    0  invalid type / unparseable date
-    0  missing critical fields
-    0  non-positive prices
-    0  key-level duplicates
-    2  outlier rows removed (data-entry errors)
-----
8,543  final cleaned rows
```
