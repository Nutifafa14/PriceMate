"""
Cleans the raw Ghana food prices export into data/ghana_food_prices_clean.csv.

Usage: python3 data/scripts/clean.py   (run from the project root, or anywhere
--- paths are resolved relative to this file, not the current working dir)

See data/reports/CLEANING_CHANGELOG.md for the full methodology writeup.
Re-running this script is idempotent: it always reads from
data/raw_ghana_food_prices.csv and rewrites the two output files below.
"""

import csv
import re
import statistics
from collections import defaultdict
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent
SRC = DATA_DIR / "raw_ghana_food_prices.csv"
OUT_CSV = DATA_DIR / "ghana_food_prices_clean.csv"
OUT_OUTLIERS = DATA_DIR / "reports" / "flagged_outliers.csv"

with open(SRC, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    raw_fieldnames = reader.fieldnames
    rows = list(reader)

orig_count = len(rows)

# ---------- 1. Trim whitespace defensively on every field ----------
trim_fixes = 0
for r in rows:
    for k in raw_fieldnames:
        v = r[k]
        if v is not None:
            nv = re.sub(r"\s+", " ", v.strip())
            if nv != v:
                trim_fixes += 1
            r[k] = nv

# ---------- 2. Exact duplicate row removal ----------
seen = set()
deduped = []
exact_dupes_removed = 0
for r in rows:
    sig = tuple(r[k] for k in raw_fieldnames)
    if sig in seen:
        exact_dupes_removed += 1
        continue
    seen.add(sig)
    deduped.append(r)
rows = deduped

# ---------- 3. Type conversion + date normalization ----------
for r in rows:
    try:
        r["_price"] = round(float(r["price"]), 2)
    except (ValueError, TypeError):
        r["_price"] = None
    try:
        r["_lat"] = round(float(r["latitude"]), 4)
    except (ValueError, TypeError):
        r["_lat"] = None
    try:
        r["_lon"] = round(float(r["longitude"]), 4)
    except (ValueError, TypeError):
        r["_lon"] = None
    try:
        r["_dt"] = datetime.strptime(r["date"], "%m/%d/%Y")
    except ValueError:
        r["_dt"] = None

rows_before_type_drop = len(rows)
rows = [
    r
    for r in rows
    if r["_price"] is not None and r["_lat"] is not None and r["_lon"] is not None and r["_dt"] is not None
]
type_error_drops = rows_before_type_drop - len(rows)

# ---------- 4. Drop rows with missing critical fields ----------
critical = ["market", "commodity", "unit", "pricetype", "category", "admin1"]
rows_before_missing_drop = len(rows)
rows = [r for r in rows if all((r[k] or "").strip() for k in critical)]
missing_critical_drops = rows_before_missing_drop - len(rows)

# ---------- 5. Non-positive price drop ----------
rows_before_nonpos = len(rows)
rows = [r for r in rows if r["_price"] > 0]
nonpos_drops = rows_before_nonpos - len(rows)

# ---------- 6. Split unit into quantity + measure (enrichment, not a fix) ----------
unit_pattern = re.compile(r"^(\d+(?:\.\d+)?)\s*(.+)$")
for r in rows:
    m = unit_pattern.match(r["unit"])
    if m:
        r["_unit_qty"] = float(m.group(1))
        r["_unit_measure"] = m.group(2).strip()
    else:
        r["_unit_qty"] = 1.0
        r["_unit_measure"] = r["unit"].strip()

# ---------- 7. Key-level duplicate resolution ----------
key_groups = defaultdict(list)
for r in rows:
    key = (r["date"], r["market"], r["commodity"], r["unit"], r["pricetype"])
    key_groups[key].append(r)

key_dupe_drops = 0
dropped_ids = set()
for _key, v in key_groups.items():
    if len(v) > 1:
        for extra in v[:-1]:  # keep the last record, drop earlier ones
            dropped_ids.add(id(extra))
            key_dupe_drops += 1
rows = [r for r in rows if id(r) not in dropped_ids]

# ---------- 8. Outlier detection & principled remediation ----------
# Statistical flag: per (commodity, unit, pricetype, year) group, MAD-based
# modified z-score. Ghana's real inflation/FX moves + regional supply shocks
# mean a naive global cutoff would delete genuine signal, so flags here are
# only *candidates* -- see the corroboration test below.
groups = defaultdict(list)
for r in rows:
    key = (r["commodity"], r["unit"], r["pricetype"], r["_dt"].year)
    groups[key].append(r)

candidate_flags = []
for key, items in groups.items():
    if len(items) < 5:
        continue
    prices = [it["_price"] for it in items]
    med = statistics.median(prices)
    mad = statistics.median([abs(p - med) for p in prices]) or 1e-9
    for it in items:
        z = 0.6745 * (it["_price"] - med) / mad
        if abs(z) > 8:
            candidate_flags.append((key, it, med, z))

series_map = defaultdict(list)
for r in rows:
    sk = (r["commodity"], r["unit"], r["pricetype"], r["market"])
    series_map[sk].append(r)
for sk in series_map:
    series_map[sk].sort(key=lambda r: r["_dt"])

cross_map = defaultdict(list)
for r in rows:
    ck = (r["commodity"], r["unit"], r["pricetype"], r["date"])
    cross_map[ck].append(r)

removed_ids = set()
outlier_report_rows = []

for key, it, group_median, z in candidate_flags:
    commodity, unit, pricetype, _year = key
    sk = (commodity, unit, pricetype, it["market"])
    series = series_map[sk]
    own_prices = [p["_price"] for p in series if p is not it]
    own_median = statistics.median(own_prices) if own_prices else group_median
    own_ratio = it["_price"] / own_median if own_median else float("inf")

    ck = (commodity, unit, pricetype, it["date"])
    others = [o for o in cross_map[ck] if o is not it]
    corroborated = False
    if others:
        other_prices = [o["_price"] for o in others]
        for o in others:
            osk = (commodity, unit, pricetype, o["market"])
            oseries = [p["_price"] for p in series_map[osk] if p is not o]
            obase = statistics.median(oseries) if oseries else None
            if obase and obase > 0 and (o["_price"] / obase) >= 3:
                corroborated = True
                break
        if not corroborated:
            high_others = [p for p in other_prices if group_median and p / group_median >= 3]
            if len(high_others) >= 2:
                corroborated = True

    is_error = (not corroborated) and own_ratio >= 8 and abs(z) > 8

    decision = "REMOVED_LIKELY_DATA_ENTRY_ERROR" if is_error else "RETAINED_PLAUSIBLE_MARKET_EVENT"
    reason = (
        f"modified_z={z:.1f}; ratio_vs_own_series_median={own_ratio:.1f}x; "
        f"corroborated_by_other_markets={corroborated}; other_markets_same_date={len(others)}"
    )
    outlier_report_rows.append(
        {
            "date": it["date"],
            "market": it["market"],
            "commodity": commodity,
            "unit": unit,
            "pricetype": pricetype,
            "price": it["_price"],
            "year_group_median": round(group_median, 2),
            "own_series_median": round(own_median, 2),
            "modified_z_score": round(z, 2),
            "decision": decision,
            "reason": reason,
        }
    )
    if is_error:
        removed_ids.add(id(it))

rows = [r for r in rows if id(r) not in removed_ids]
outlier_removed_count = len(removed_ids)

# ---------- 9. Write cleaned CSV ----------
out_fields = [
    "country_iso3", "date", "year", "month", "region", "district", "market",
    "latitude", "longitude", "category", "commodity", "unit", "unit_quantity",
    "unit_measure", "price_type", "currency", "price",
]

rows.sort(key=lambda r: (r["_dt"], r["market"], r["commodity"], r["unit"]))

OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=out_fields)
    w.writeheader()
    for r in rows:
        w.writerow(
            {
                "country_iso3": r["countryiso3"],
                "date": r["_dt"].strftime("%Y-%m-%d"),
                "year": r["_dt"].year,
                "month": r["_dt"].month,
                "region": r["admin1"],
                "district": r["admin2"],
                "market": r["market"],
                "latitude": r["_lat"],
                "longitude": r["_lon"],
                "category": r["category"],
                "commodity": r["commodity"],
                "unit": r["unit"],
                "unit_quantity": r["_unit_qty"],
                "unit_measure": r["_unit_measure"],
                "price_type": r["pricetype"],
                "currency": r["currency"],
                "price": r["_price"],
            }
        )

# ---------- 10. Write outlier report ----------
OUT_OUTLIERS.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_OUTLIERS, "w", newline="", encoding="utf-8") as f:
    fields = [
        "date", "market", "commodity", "unit", "pricetype", "price",
        "year_group_median", "own_series_median", "modified_z_score",
        "decision", "reason",
    ]
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for row in sorted(outlier_report_rows, key=lambda x: -abs(x["modified_z_score"])):
        w.writerow(row)

final_count = len(rows)

print("orig_count:", orig_count)
print("trim_fixes (cells):", trim_fixes)
print("exact_dupes_removed:", exact_dupes_removed)
print("type_error_drops:", type_error_drops)
print("missing_critical_drops:", missing_critical_drops)
print("nonpos_price_drops:", nonpos_drops)
print("key_level_dupe_drops:", key_dupe_drops)
print("outlier_candidates_examined:", len(candidate_flags))
print("outlier_removed_as_error:", outlier_removed_count)
print("outlier_retained_as_plausible:", len(candidate_flags) - outlier_removed_count)
print("final_count:", final_count)
print("total_removed:", orig_count - final_count)
print(f"\nwrote {OUT_CSV}")
print(f"wrote {OUT_OUTLIERS}")
