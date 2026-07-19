import csv
from collections import defaultdict, Counter
from datetime import datetime
import statistics

from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "raw_ghana_food_prices.csv"

with open(SRC, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

for r in rows:
    r["price"] = float(r["price"])
    r["_dt"] = datetime.strptime(r["date"], "%m/%d/%Y")
    r["_year"] = r["_dt"].year

# --- commodity -> category consistency ---
print("=== COMMODITY -> CATEGORY CONSISTENCY ===")
cc = defaultdict(set)
for r in rows:
    cc[r["commodity"]].add(r["category"])
bad = {k: v for k, v in cc.items() if len(v) > 1}
print("commodities mapping to >1 category:", len(bad))
for k, v in bad.items():
    print(" ", k, v)

# --- commodity -> unit set ---
print("\n=== COMMODITY -> UNIT SET ===")
cu = defaultdict(Counter)
for r in rows:
    cu[r["commodity"]][r["unit"]] += 1
for k in sorted(cu):
    print(f"  {k}: {dict(cu[k])}")

# --- pricetype -> unit consistency (is 'KG'/'30 pcs' always retail? bag units always wholesale?) ---
print("\n=== PRICETYPE -> UNIT SET ===")
pu = defaultdict(Counter)
for r in rows:
    pu[r["pricetype"]][r["unit"]] += 1
for k in sorted(pu):
    print(f"  {k}: {dict(pu[k])}")

# --- outlier detection: group by commodity+unit+pricetype+year, robust MAD-based z-score ---
print("\n=== OUTLIER DETECTION (per commodity+unit+pricetype+year, robust z-score via MAD) ===")
groups = defaultdict(list)
for r in rows:
    key = (r["commodity"], r["unit"], r["pricetype"], r["_year"])
    groups[key].append(r)

flagged = []
for key, items in groups.items():
    if len(items) < 5:
        continue  # not enough data to judge statistically
    prices = [it["price"] for it in items]
    med = statistics.median(prices)
    mad = statistics.median([abs(p - med) for p in prices]) or 1e-9
    # consistent estimator: 0.6745 * (x - med) / mad  ~ modified z-score
    for it in items:
        z = 0.6745 * (it["price"] - med) / mad
        if abs(z) > 8:  # very conservative threshold -> true extreme outliers only
            flagged.append((key, it["price"], med, round(z, 1), it["market"], it["date"]))

print("extreme outliers flagged (|modified z| > 8):", len(flagged))
for f_ in sorted(flagged, key=lambda x: -abs(x[3]))[:60]:
    print(" ", f_)

# --- overall price stats per commodity+unit+pricetype (ignoring year) to see spread ---
print("\n=== MIN/MAX PRICE PER COMMODITY+UNIT+PRICETYPE (sanity) ===")
gu = defaultdict(list)
for r in rows:
    gu[(r["commodity"], r["unit"], r["pricetype"])].append(r["price"])
for k in sorted(gu):
    v = gu[k]
    print(f"  {k}: n={len(v)} min={min(v)} max={max(v)} median={statistics.median(v)}")
