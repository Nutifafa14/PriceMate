# Data Cleaning Changelog — MoFA SRID Community Prices

**Source:** `data/raw_mofa_community_prices.csv` (downloaded verbatim from
`https://srid.mofa.gov.gh/sites/default/files/uploaded_resources/Commodity%20prices%20_04.11.25.csv`,
Ghana's Ministry of Food and Agriculture, Statistics Research and Information
Directorate — real government data, last updated by MoFA on 2025-11-07;
10,779 data rows, covering 2025-07-01 to 2025-10-31)
**Output:** `data/mofa_community_prices_clean.csv` (5,143 rows)
**Reports:** `data/reports/mofa_market_reconciliation.csv` (every distinct
raw market string, its resolution, and how many rows it contributed)

## Why this is a separate pipeline from `04_clean.py`

This is a genuinely different real data source from the WFP-derived dataset
that backs the rest of the app (`data/ghana_food_prices_clean.csv`), and it
is **not merged into it**:

1. **No documented unit.** The WFP CSV has an explicit `unit` column (e.g.
   `"91 KG"`, `"30 pcs"`). MoFA's export has none — no unit/quantity column
   anywhere in the file, and no methodology notes on the source page (checked
   directly; MoFA's Market Services Unit would need to be contacted for
   clarification, which is out of scope here).
2. **Spot-check suggests incompatible units.** MoFA's "Egg Commercial"
   prices cluster around GHS 62/unit in mid-late 2025. The existing
   WFP-derived series has Eggs (30-piece crate, Wholesale) at a median of
   GHS 394 in 2023 — two years *earlier*, during a period of continued cedi
   depreciation. A ~6x price *drop* over that period for the same good,
   under inflation, is not plausible; the two sources most likely report
   different pack sizes or survey conventions.

Given `DATABASE_SCHEMA`'s `prices` table requires a unit and directly backs
both the on-screen price trend chart and the ML model's training data,
silently merging an unverified-unit series into it would misrepresent real
data as more precise/comparable than it is. Instead, this pipeline's output
is loaded into its own `community_prices` table (see
`server/src/migrations/003_add_community_prices.sql`) and is always shown in
the app labeled **"As reported by MoFA SRID — unit not specified by
source"**, never plotted on the same axis as the wholesale trend, and
excluded from ML training entirely.

## What this source is genuinely good for: real, individually named markets

The WFP dataset's Ghana market registry (`wfp_markets_gha.csv`, 93 entries)
is almost entirely **city-level** — "Accra", "Kumasi", "Techiman" — not
individually named markets. Its two Greater Accra entries that *are*
individually named (`Madina`, id 10947; `Agbogbloshie`, id 10946) were
checked directly against the full 38,268-row WFP price file
(`wfp_food_prices_gha.csv`) and have **zero actual price records** — they
were registered but never surveyed. Neither "Kejetia" nor "Makola" appear in
the WFP registry at all.

MoFA's raw `Market` column, by contrast, does contain real, individually
named markets with real 2025 price data — including **Makola** and
**Agbogbloshie** (both confirmed by the source's own `(region, district)`
columns as `Greater Accra / AMA-Okaikoi South`, consistent with their real
locations in central Accra). "Kejetia" does not appear in this source either
— it is not available as verified data in either real source used by this
project.

## Steps performed (in order)

1. **Date parsing** — source format is `DD-MM-YYYY` (e.g. `16-07-2025`).
   *0 rows failed to parse.*
2. **Price parsing + non-positive removal** — `Price` coerced to float; rows
   with a missing/non-numeric/non-positive price dropped. *0 rows dropped.*
3. **Market name reconciliation** — see below. *550 rows dropped as
   unidentifiable, 5,263 rows attached to one of the existing 20 markets,
   4,966 rows routed to one of 10 genuinely new named markets.*
4. **Commodity name reconciliation** — see below. *4,624 rows dropped
   (commodity has no confident match in the existing 26-commodity
   taxonomy).*
5. **Price type normalization** — source's `Type` column (`wholesale` /
   `retail`) mapped to the existing `Wholesale`/`Retail` enum. *0 rows
   dropped.*
6. **Group aggregation** — where multiple raw commodity varieties map to the
   same canonical commodity (e.g. `Rice Imported perfumed` and
   `Rice Imported non perfumed` both map to `Rice (imported)`), same
   `(market, commodity, date, price_type)` rows are averaged rather than
   picking one arbitrarily. *456 groups were aggregated from 2+ raw rows.*

## Market name reconciliation methodology

Every one of the 56 distinct raw `Market` strings was resolved by checking
its `(region, district)` columns for internal consistency (a real market
reports from one place; if a name's rows span more than one district, that
is a signal something is wrong) — not by string similarity alone. Full
per-string counts and resolutions are in
`data/reports/mofa_market_reconciliation.csv`. Three outcomes:

- **Attach to an existing market** (case/whitespace/typo variants of a
  market already in our 20, confirmed by matching district) — e.g. `"WA
  MARKET"`, `"Wa  Market"` (double space), `"Wa market"` all resolve to the
  existing `Wa` market (Upper West / Wa Municipal matches exactly). The
  `"X Central Market"` / `"Central market"` pattern for Koforidua and Obuasi
  was treated the same way — no evidence either city has more than one
  market, so these are read as enumerators writing "the market at X", not a
  distinctly-named submarket.
- **New, genuinely distinct market** — 10 real markets not in our current
  20, each confirmed by a single consistent `(region, district)` across
  every row using that name: **Makola**, **Agbogbloshie**, **Tuesday
  Market**, **Tema Community One Main Market**, **Bibiani**, **Goaso**,
  **Nana Bosomah**, **Bamboi**, **Gbintiri**, **Agatha Market**. Notably,
  `"Tuesday Market"`, `"Makola Market"` and `"AGBOGBLOSHIE"` all share the
  exact same `(Greater Accra, AMA-Okaikoi South)` district, consistent with
  all three being real, well-known, separately-named markets inside central
  Accra. `"Nana Bosomah"` (the single highest-volume new market, 701+ rows)
  resolves to a proper name rather than a city name — most plausibly
  Sunyani's primary market is locally known by that name, the same pattern
  as Kumasi's main market being known as "Kejetia" rather than "Kumasi
  Market".
- **Dropped** — blank market values (434 rows), stray numeric codes
  (`"210"`, `"607"`, `"208"` — 107 rows combined, almost certainly a
  column-shift or enumerator-ID data-entry error), and `"Bowl"` (9 rows, an
  unidentifiable single-word value with no corroborating pattern). 550 rows
  total.

## Commodity name reconciliation methodology

MoFA's raw `commodity` column has 76 distinct, fine-grained names. Only
names that map **confidently and unambiguously** to one of the existing 26
commodities (`data/ghana_food_prices_clean.csv`) were kept — 24 raw names
mapped to 22 existing commodities; the remaining 52 raw names (4,624 rows)
were dropped rather than guessed. The full mapping is in
`data/scripts/05_clean_mofa_community_prices.py`'s `COMMODITY_MAP`. Notable
decisions:

- **`"Garden Egg"` → `Eggplants`**: "garden egg" is the standard West
  African common name for this eggplant variety, not a different commodity.
- **`"white maize"` → `Maize`, `"Yam White"` → `Yam`**: these are the
  default/base varieties of their commodity, matching the existing
  unqualified `Maize`/`Yam` buckets (as distinct from `Maize (yellow)` and
  `Yam (puna)`, which stay separate).
- **Fish names deliberately NOT mapped**: `"Fresh Kpanla Fish"`, `"Fresh Red
  Fish"`, `"Fresh Salmon Mackerel Fish"`, `"Salted Dried Tilapia Koobi"`,
  `"Smoked Herring"`, `"Anchovy"` were all excluded rather than mapped to the
  existing `Fish (mackerel, fresh)` commodity — none of them name mackerel
  unambiguously as the primary species, and silently blending different real
  fish species into one commodity's price history would misrepresent the
  data.
- **Processed products kept separate from their raw form**: `"Cassava
  Dough"`, `"Dried Cassava Chips Kokonte"`, `"Dried Cassava Powder Kokonte"`
  were not mapped to `Cassava` — these are different, separately-priced
  products, not the same commodity.
- **`"Plantain Riped"`** (ripe plantain, no variety specified) was not
  mapped to either `Plantains (apem)` or `Plantains (apentu)` — there is no
  way to confidently assign it to one variety over the other.
- Commodities with no equivalent in the existing 26 at all (beef, pork,
  goat/mutton, most vegetables, fruits, groundnuts, sweet potato, cocoyam,
  etc.) were excluded entirely — the existing taxonomy is not being
  expanded, only the market list is.

## Output schema

`data/mofa_community_prices_clean.csv` (5,143 rows), sorted by date, market,
commodity, price type:

| Column | Type | Notes |
|---|---|---|
| `market` | string | canonical name, post-reconciliation |
| `region` | string | |
| `district` | string | |
| `date` | ISO `YYYY-MM-DD` | was `DD-MM-YYYY` |
| `commodity` | string | mapped to the existing 26-commodity taxonomy |
| `price_type` | string | `Wholesale` \| `Retail` |
| `price` | float (2dp) | **unit not specified by source** — see above |
| `currency` | string | always `GHS` |
| `source` | string | always `"MoFA SRID"` — carried through to the DB and shown in the UI |

## Row-count reconciliation

```
10,779  source rows
-    0  date parse failures
-    0  price parse failures / non-positive
-  550  market unidentifiable/junk
- 4,624  commodity has no confident mapping
-  456  groups collapsed via averaging (not a drop — see above)
------
 5,143  final cleaned rows
```
