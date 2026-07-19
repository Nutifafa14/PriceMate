"""
Cleans the raw MoFA SRID commodity-price export into
data/mofa_community_prices_clean.csv.

Unlike data/scripts/04_clean.py (WFP data, which has an explicit unit column
and backs the app's main price trend + the ML model), this second real
government source (Ghana's Ministry of Food and Agriculture, Statistics
Research and Information Directorate) has NO documented unit for its `Price`
field, and a spot-check against the WFP-derived series (Eggs: ~GHS 62/unit
here in 2025 vs. a GHS 394 median in the WFP data in 2023, two years earlier,
during continued currency depreciation) shows the two are not directly
comparable. So this pipeline keeps MoFA data in its own lane: real, dated,
named-market price *reports*, explicitly labeled "as reported, unit not
specified by source" wherever shown in the app, never blended into the main
price trend chart or the ML training set.

Its real value: MoFA's raw `Market` column contains genuine, individually
named markets (Makola, Agbogbloshie, Tuesday Market, Nana Bosomah, Bibiani,
...) that the WFP dataset does not — WFP's Ghana registry only ever recorded
city-level markets, and its two Accra-area "named market" registry entries
(Madina, Agbogbloshie) turned out to have zero actual price rows when the
full 38,268-row WFP price file was checked directly.

Usage: python3 data/scripts/05_clean_mofa_community_prices.py   (run from
anywhere — paths are resolved relative to this file)

See data/reports/MOFA_CLEANING_CHANGELOG.md for the full methodology writeup,
including the market-name and commodity-name reconciliation tables below and
the reasoning behind each.
"""

import csv
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent
SRC = DATA_DIR / "raw_mofa_community_prices.csv"
OUT_CSV = DATA_DIR / "mofa_community_prices_clean.csv"
OUT_REPORT = DATA_DIR / "reports" / "mofa_market_reconciliation.csv"

SOURCE_NAME = "MoFA SRID"
CURRENCY = "GHS"

# ---------------------------------------------------------------------------
# Market name reconciliation.
#
# Every distinct raw `Market` string was checked against its (region,
# district) columns before being placed here — see the research notes in
# MOFA_CLEANING_CHANGELOG.md. Two buckets:
#
# 1. ATTACH_TO_EXISTING: case/whitespace variants of a market already in our
#    20 WFP-sourced markets (verified by matching district, e.g. "Wa Market" /
#    "WA MARKET" all resolve to Upper West / Wa Municipal — the same real
#    place as the existing "Wa" row). These rows attach to the existing
#    market by name, not a new row.
# 2. NEW_MARKET: genuinely distinct, real, individually-named markets not in
#    our current 20, each confirmed by a single consistent (region, district)
#    across every row using that name.
#
# Anything not listed here (numeric codes, blank, "Bowl") is dropped as
# unidentifiable / likely data-entry noise — see DROPPED_MARKET_PATTERN below.
# ---------------------------------------------------------------------------

ATTACH_TO_EXISTING: dict[str, str] = {
    "mankessim": "Mankessim",
    "nkwanta": "Nkwanta",
    "kintampo": "Kintampo",
    "kintampo.": "Kintampo",
    "techiman": "Techiman",
    "techiman market": "Techiman",
    "wa market": "Wa",
    "wa  market": "Wa",  # double space in source
    "ho central market": "Ho",
    "koforidua central market": "Koforidua",
    "koforidua central": "Koforidua",
    "central market": "Koforidua",  # same (region, district) as the Koforidua Central Market rows
    "central marketm": "Koforidua",  # typo variant of the above
    "obuasi central market": "Obuasi",
    "obuasi central": "Obuasi",
    "bolga": "Bolga",
    "bolga market": "Bolga",
    "bolgatanga municipal market": "Bolga",
    "bolgatanga market": "Bolga",
    "bolgatanga": "Bolga",
    "garu": "Garu",
    "koforidua": "Koforidua",
}

# name (lowercased) -> (canonical display name, region, district)
NEW_MARKET: dict[str, tuple[str, str, str]] = {
    "makola market": ("Makola", "Greater Accra", "AMA-Okaikoi South"),
    "agbogbloshie market": ("Agbogbloshie", "Greater Accra", "AMA-Okaikoi South"),
    "agbogbloshie": ("Agbogbloshie", "Greater Accra", "AMA-Okaikoi South"),
    "tuesday market": ("Tuesday Market", "Greater Accra", "AMA-Okaikoi South"),
    "tema community one main market": ("Tema Community One Main Market", "Greater Accra", "TMA-Tema East"),
    "bibiani": ("Bibiani", "Western North", "Bibiani Anhwiaso Bekwai Municipal"),
    "goaso": ("Goaso", "Ahafo", "Asunafo North Municipal"),
    "nana bosomah": ("Nana Bosomah", "Bono", "Sunyani Municipal"),
    "nana bosomahɔ": ("Nana Bosomah", "Bono", "Sunyani Municipal"),  # Twi spelling variant
    "bamboi market": ("Bamboi", "Savannah", "Bole"),
    "gbintiri": ("Gbintiri", "North East", "East Mamprusi Municipal"),
    "agatha market": ("Agatha Market", "Eastern", "New Juaben South Municipal"),
}

# Raw market strings that don't survive normalization (case/whitespace fold)
# below but still need routing — trailing punctuation variants of
# NEW_MARKET/ATTACH_TO_EXISTING keys are handled by normalize_market();
# these three are the ones confirmed unidentifiable and dropped.
DROPPED_MARKET_LOWER = {"bowl", "210", "607", "208", ""}


def normalize_market(raw: str) -> str:
    """Lowercase, collapse whitespace, strip trailing punctuation used inconsistently across enumerators."""
    s = re.sub(r"\s+", " ", raw.strip()).lower()
    s = s.rstrip(".,")
    return s


# ---------------------------------------------------------------------------
# Commodity reconciliation: MoFA's raw `commodity` column has 76 distinct,
# fine-grained names (e.g. "Fresh Pepper Bonnet", "Rice Imported perfumed").
# Only names that map confidently and unambiguously to one of the existing 26
# commodities (data/ghana_food_prices_clean.csv) are kept — anything that
# names a different species/product form (e.g. "Fresh Kpanla Fish" is not
# "Fish (mackerel, fresh)"; "Cassava Dough" is a processed product distinct
# from raw "Cassava") is deliberately dropped rather than guessed. See
# MOFA_CLEANING_CHANGELOG.md for the full list of what was excluded and why.
# Where multiple raw varieties map to one existing commodity (e.g. both rice
# perfumed/non-perfumed variants -> "Rice (imported)"), same-day/market/
# price-type rows are averaged — the existing commodity taxonomy is already
# generic at that granularity (WFP's "Rice (imported)" doesn't distinguish
# perfumed either).
# ---------------------------------------------------------------------------

COMMODITY_MAP: dict[str, str] = {
    "cassava": "Cassava",
    "chicken": "Meat (chicken)",
    "cowpea white": "Cowpeas (white)",
    "dried pepper legon 18": "Peppers (dried)",
    "egg commercial": "Eggs",
    "fresh pepper bonnet": "Peppers (fresh)",
    "fresh pepper legon 18": "Peppers (fresh)",
    "garden egg": "Eggplants",  # "garden egg" is the standard West African name for this eggplant variety
    "gari": "Gari",
    "maize yellow": "Maize (yellow)",
    "millet": "Millet",
    "onion": "Onions",
    "plantain apem": "Plantains (apem)",
    "plantain apentu": "Plantains (apentu)",
    "rice imported non perfumed": "Rice (imported)",
    "rice imported perfumed": "Rice (imported)",
    "rice local non perfumed": "Rice (local)",
    "rice local perfumed": "Rice (local)",
    "sorghum": "Sorghum",
    "soya bean": "Soybeans",
    "tomato local": "Tomatoes (local)",
    "tomato navrongo": "Tomatoes (navrongo)",
    "yam puna": "Yam (puna)",
    "yam white": "Yam",
    "white maize": "Maize",
}


def normalize_commodity(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.strip()).lower()


with open(SRC, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

orig_count = len(rows)

# ---------- 1. Parse date (source format DD-MM-YYYY) ----------
date_parse_failures = 0
for r in rows:
    try:
        r["_dt"] = datetime.strptime(r["date"].strip(), "%d-%m-%Y")
    except ValueError:
        r["_dt"] = None
        date_parse_failures += 1
rows = [r for r in rows if r["_dt"] is not None]

# ---------- 2. Parse price ----------
price_parse_failures = 0
for r in rows:
    try:
        r["_price"] = float(r["Price"])
    except (ValueError, TypeError):
        r["_price"] = None
rows_before = len(rows)
rows = [r for r in rows if r["_price"] is not None and r["_price"] > 0]
price_parse_failures = rows_before - len(rows)

# ---------- 3. Resolve market ----------
market_dropped_count = 0
market_attached_count = 0
market_new_count = 0
market_lookup_report: dict[str, dict] = {}

for r in rows:
    norm = normalize_market(r["Market"])
    if norm in DROPPED_MARKET_LOWER:
        r["_market_resolution"] = "DROPPED"
        r["_market_name"] = None
        r["_region"] = None
        r["_district"] = None
    elif norm in ATTACH_TO_EXISTING:
        r["_market_resolution"] = "ATTACH_TO_EXISTING"
        r["_market_name"] = ATTACH_TO_EXISTING[norm]
        r["_region"] = r["region"].strip()
        r["_district"] = r["district"].strip()
    elif norm in NEW_MARKET:
        name, region, district = NEW_MARKET[norm]
        r["_market_resolution"] = "NEW_MARKET"
        r["_market_name"] = name
        r["_region"] = region
        r["_district"] = district
    else:
        r["_market_resolution"] = "DROPPED_UNRECOGNIZED"
        r["_market_name"] = None
        r["_region"] = None
        r["_district"] = None

    key = r["Market"]
    entry = market_lookup_report.setdefault(
        key, {"raw": key, "resolution": r["_market_resolution"], "resolved_to": r["_market_name"], "rows": 0}
    )
    entry["rows"] += 1

for r in rows:
    if r["_market_resolution"] in ("DROPPED", "DROPPED_UNRECOGNIZED"):
        market_dropped_count += 1
    elif r["_market_resolution"] == "ATTACH_TO_EXISTING":
        market_attached_count += 1
    else:
        market_new_count += 1

rows = [r for r in rows if r["_market_name"] is not None]

# ---------- 4. Resolve commodity ----------
commodity_dropped_count = 0
for r in rows:
    norm = normalize_commodity(r["commodity"])
    r["_commodity_name"] = COMMODITY_MAP.get(norm)

rows_before = len(rows)
rows = [r for r in rows if r["_commodity_name"] is not None]
commodity_dropped_count = rows_before - len(rows)

# ---------- 5. Normalize price_type ----------
price_type_dropped_count = 0
for r in rows:
    t = r["Type"].strip().lower()
    r["_price_type"] = {"wholesale": "Wholesale", "retail": "Retail"}.get(t)
rows_before = len(rows)
rows = [r for r in rows if r["_price_type"] is not None]
price_type_dropped_count = rows_before - len(rows)

# ---------- 6. Aggregate same (market, commodity, date, price_type) groups ----------
# Multiple raw commodity varieties can map to the same canonical commodity
# (e.g. Rice Imported perfumed + non-perfumed -> "Rice (imported)"); average
# them rather than picking one arbitrarily or creating duplicate keys.
groups: dict[tuple, list[float]] = defaultdict(list)
group_meta: dict[tuple, dict] = {}
for r in rows:
    key = (r["_market_name"], r["_commodity_name"], r["_dt"].strftime("%Y-%m-%d"), r["_price_type"])
    groups[key].append(r["_price"])
    group_meta[key] = {"region": r["_region"], "district": r["_district"]}

aggregated_from_multiple = sum(1 for v in groups.values() if len(v) > 1)

out_rows = []
for (market, commodity, date, price_type), prices in groups.items():
    meta = group_meta[(market, commodity, date, price_type)]
    out_rows.append(
        {
            "market": market,
            "region": meta["region"],
            "district": meta["district"],
            "date": date,
            "commodity": commodity,
            "price_type": price_type,
            "price": round(sum(prices) / len(prices), 2),
            "currency": CURRENCY,
            "source": SOURCE_NAME,
        }
    )

out_rows.sort(key=lambda r: (r["date"], r["market"], r["commodity"], r["price_type"]))

# ---------- 7. Write cleaned CSV ----------
OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    fields = ["market", "region", "district", "date", "commodity", "price_type", "price", "currency", "source"]
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(out_rows)

# ---------- 8. Write market reconciliation report ----------
OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_REPORT, "w", newline="", encoding="utf-8") as f:
    fields = ["raw", "resolution", "resolved_to", "rows"]
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for entry in sorted(market_lookup_report.values(), key=lambda e: -e["rows"]):
        w.writerow(entry)

print("orig_count:", orig_count)
print("date_parse_failures:", date_parse_failures)
print("price_parse_failures_or_nonpositive:", price_parse_failures)
print("market_rows_dropped (junk/unidentified):", market_dropped_count)
print("market_rows_attached_to_existing_market:", market_attached_count)
print("market_rows_routed_to_new_market:", market_new_count)
print("commodity_rows_dropped (no confident mapping):", commodity_dropped_count)
print("price_type_rows_dropped:", price_type_dropped_count)
print("groups_aggregated_from_multiple_raw_rows:", aggregated_from_multiple)
print("final_row_count:", len(out_rows))
print()
print("New markets introduced:", sorted({r["market"] for r in out_rows} - set(ATTACH_TO_EXISTING.values())))
print(f"\nwrote {OUT_CSV}")
print(f"wrote {OUT_REPORT}")
