import csv
import re
from collections import Counter, defaultdict
from datetime import datetime

from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "raw_ghana_food_prices.csv"

with open(SRC, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    fieldnames = reader.fieldnames

print("=== FIELDNAMES ===")
print(fieldnames)
print("total rows:", len(rows))

# --- exact duplicate rows ---
tuples = [tuple(r[k] for k in fieldnames) for r in rows]
counts = Counter(tuples)
dupes = {k: v for k, v in counts.items() if v > 1}
print("\n=== EXACT DUPLICATE ROWS ===")
print("distinct dup row-signatures:", len(dupes))
print("total extra rows from dups:", sum(v - 1 for v in dupes.values()))

# --- key duplicate (same commodity/market/date/unit/pricetype but different price) ---
key_counts = Counter()
key_to_prices = defaultdict(set)
for r in rows:
    key = (r["date"], r["market"], r["commodity"], r["unit"], r["pricetype"])
    key_counts[key] += 1
    key_to_prices[key].add(r["price"])

conflicting = {k: v for k, v in key_to_prices.items() if key_counts[k] > 1 and len(v) > 1}
same_dupe_key = {k: c for k, c in key_counts.items() if c > 1 and k not in conflicting}
print("\n=== KEY DUPLICATES (date+market+commodity+unit+pricetype) ===")
print("keys appearing >1 time:", sum(1 for c in key_counts.values() if c > 1))
print("of which CONFLICTING price values:", len(conflicting))
print("of which same price (true dup or benign repeat):", len(same_dupe_key))
print("sample conflicting:")
for i, (k, v) in enumerate(conflicting.items()):
    if i >= 8:
        break
    print(" ", k, "->", v)

# --- missing values per field ---
print("\n=== MISSING / BLANK VALUES PER FIELD ===")
missing = Counter()
for r in rows:
    for k in fieldnames:
        v = r[k]
        if v is None or str(v).strip() == "":
            missing[k] += 1
for k in fieldnames:
    print(f"  {k}: {missing[k]}")

# --- date validity ---
print("\n=== DATE FORMAT CHECK ===")
bad_dates = []
date_pattern = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")
day_values = Counter()
for r in rows:
    d = r["date"]
    if not date_pattern.match(d or ""):
        bad_dates.append(d)
        continue
    try:
        dt = datetime.strptime(d, "%m/%d/%Y")
        day_values[dt.day] += 1
    except ValueError:
        bad_dates.append(d)
print("bad/unparseable dates:", len(bad_dates))
print("sample bad dates:", bad_dates[:10])
print("day-of-month distribution:", dict(day_values))
dates_parsed = [datetime.strptime(r["date"], "%m/%d/%Y") for r in rows if date_pattern.match(r["date"] or "")]
print("min date:", min(dates_parsed), "max date:", max(dates_parsed))

# --- numeric field checks: price, latitude, longitude ---
print("\n=== NUMERIC FIELD CHECKS ===")
def check_numeric(field, lo=None, hi=None):
    bad = []
    non_positive = []
    vals = []
    for r in rows:
        v = r[field]
        try:
            f = float(v)
            vals.append(f)
            if field == "price" and f <= 0:
                non_positive.append((r["market"], r["commodity"], r["date"], v))
            if lo is not None and (f < lo or f > hi):
                bad.append((r["market"], r["commodity"], r["date"], v))
        except (ValueError, TypeError):
            bad.append((r["market"], r["commodity"], r["date"], v))
    print(f"-- {field} --")
    print("  non-numeric / unparseable count:", len([b for b in bad if lo is None]) if lo is None else "n/a")
    if lo is not None:
        print(f"  out of plausible range [{lo},{hi}]:", len(bad))
        print("  sample:", bad[:5])
    if vals:
        print("  min:", min(vals), "max:", max(vals))
    if field == "price":
        print("  non-positive price count:", len(non_positive))
        print("  sample non-positive:", non_positive[:5])

check_numeric("price")
check_numeric("latitude", 4.0, 12.0)
check_numeric("longitude", -4.0, 2.0)

# --- categorical distinct values ---
print("\n=== DISTINCT VALUES (categorical) ===")
for field in ["countryiso3", "admin1", "category", "unit", "pricetype", "currency"]:
    vals = Counter(r[field] for r in rows)
    print(f"-- {field} ({len(vals)} distinct) --")
    for v, c in sorted(vals.items(), key=lambda x: -x[1])[:40]:
        print(f"   {v!r}: {c}")

print("\n-- admin2 (count only, too many to print all) --")
admin2_vals = Counter(r["admin2"] for r in rows)
print("distinct admin2:", len(admin2_vals))

print("\n-- market (count only) --")
market_vals = Counter(r["market"] for r in rows)
print("distinct market:", len(market_vals))
for v, c in sorted(market_vals.items())[:60]:
    print(f"   {v!r}: {c}")

print("\n-- commodity (count only) --")
commodity_vals = Counter(r["commodity"] for r in rows)
print("distinct commodity:", len(commodity_vals))
for v, c in sorted(commodity_vals.items()):
    print(f"   {v!r}: {c}")

# --- whitespace / casing anomalies ---
print("\n=== WHITESPACE / CASE ANOMALIES ===")
ws_issues = 0
for r in rows:
    for k in fieldnames:
        v = r[k]
        if v is not None and (v != v.strip() or "  " in v):
            ws_issues += 1
if ws_issues:
    print("rows with leading/trailing/double-space whitespace somewhere:", ws_issues)
else:
    print("none found")

# check market <-> lat/long consistency
print("\n=== MARKET -> LAT/LONG CONSISTENCY ===")
market_latlong = defaultdict(set)
for r in rows:
    market_latlong[r["market"]].add((r["latitude"], r["longitude"]))
inconsistent = {m: v for m, v in market_latlong.items() if len(v) > 1}
print("markets with >1 distinct lat/long pair:", len(inconsistent))
for m, v in list(inconsistent.items())[:10]:
    print(" ", m, v)

# check market <-> admin1/admin2 consistency
print("\n=== MARKET -> ADMIN1/ADMIN2 CONSISTENCY ===")
market_admin = defaultdict(set)
for r in rows:
    market_admin[r["market"]].add((r["admin1"], r["admin2"]))
inconsistent_admin = {m: v for m, v in market_admin.items() if len(v) > 1}
print("markets with >1 distinct admin1/admin2 pair:", len(inconsistent_admin))
for m, v in list(inconsistent_admin.items())[:10]:
    print(" ", m, v)
