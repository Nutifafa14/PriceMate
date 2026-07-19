import csv
from collections import defaultdict
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

flagged_keys = [
    ("Plantains (apentu)", "Bunch", "Wholesale", "Sekondi/Takoradi", "1/15/2015", 380.0),
    ("Cowpeas", "KG", "Retail", "Sekondi/Takoradi", "1/15/2020", 81.95),
    ("Tomatoes (navrongo)", "52 KG", "Wholesale", "Garu", "2/15/2021", 618.31),
    ("Plantains (apentu)", "KG", "Retail", "Tema", "4/15/2022", 30.16),
    ("Maize (yellow)", "100 KG", "Wholesale", "Koforidua", "5/15/2021", 1740.0),
    ("Soybeans", "KG", "Retail", "Tema", "8/15/2021", 66.67),
    ("Fish (mackerel, fresh)", "KG", "Retail", "Tema", "6/15/2021", 38.89),
    ("Fish (mackerel, fresh)", "KG", "Retail", "Tema", "11/15/2019", 41.67),
]

# series = same commodity+unit+pricetype+market, sorted by date
series_map = defaultdict(list)
for r in rows:
    k = (r["commodity"], r["unit"], r["pricetype"], r["market"])
    series_map[k].append(r)
for k in series_map:
    series_map[k].sort(key=lambda r: r["_dt"])

# cross section = same commodity+unit+pricetype+date across markets
cross_map = defaultdict(list)
for r in rows:
    k = (r["commodity"], r["unit"], r["pricetype"], r["date"])
    cross_map[k].append(r)

for commodity, unit, pricetype, market, date, price in flagged_keys:
    print("=" * 80)
    print(f"FLAGGED: {commodity} | {unit} | {pricetype} | {market} | {date} -> {price}")
    sk = (commodity, unit, pricetype, market)
    series = series_map[sk]
    idx = next(i for i, r in enumerate(series) if r["date"] == date and r["price"] == price)
    lo = max(0, idx - 3)
    hi = min(len(series), idx + 4)
    print(f"  -- time series for {market} (this market only), +/-3 points around flagged --")
    for r in series[lo:hi]:
        marker = " <== FLAGGED" if r["date"] == date and r["price"] == price else ""
        print(f"     {r['date']}: {r['price']}{marker}")
    ck = (commodity, unit, pricetype, date)
    cross = cross_map[ck]
    print(f"  -- cross-section: all markets for {commodity}/{unit}/{pricetype} on {date} --")
    for r in sorted(cross, key=lambda r: -r["price"]):
        print(f"     {r['market']}: {r['price']}")
