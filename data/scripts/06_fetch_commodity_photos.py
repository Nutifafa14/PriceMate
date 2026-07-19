"""
Sources one real, properly-licensed photo per commodity from Wikimedia
Commons (no API key needed) for Section 4 of PriceMate_Upgrade_Prompt.md:
"Replace commodity icons with real, properly-licensed photos... with
graceful fallback."

For each of the 26 commodities (or, for near-identical variants like
Cowpeas / Cowpeas (white), a shared base food), searches Commons, keeps only
results with a commercial-use-compatible license (public domain, CC0, CC-BY,
CC-BY-SA — never NC/ND or unclear), downloads a ~480px-wide JPEG/PNG, and
records full attribution in assets/commodities/ATTRIBUTION.json (required by
CC-BY/CC-BY-SA even when the UI itself doesn't show a byline per photo).

Usage: python3 data/scripts/06_fetch_commodity_photos.py
Re-run is idempotent per commodity: skips any commodity whose output file
already exists (delete assets/commodities/<slug>.jpg to force a re-fetch).
"""

import json
import re
import time
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = REPO_ROOT / "assets" / "commodities"
ATTRIBUTION_PATH = OUT_DIR / "ATTRIBUTION.json"

USER_AGENT = "PriceMateApp/1.0 (educational student project; contact via repo)"

ACCEPTABLE_LICENSES = {"pd", "cc0", "cc-by-2.0", "cc-by-3.0", "cc-by-4.0", "cc-by-sa-2.0", "cc-by-sa-3.0", "cc-by-sa-4.0"}

# commodity name -> (search query, output slug). Commodities not listed here
# reuse another commodity's photo (REUSE map below) rather than searching
# again — see MOFA_CLEANING_CHANGELOG.md-style reasoning: these are genuinely
# the same or visually near-identical real food, not a different commodity
# needing its own distinct image.
SEARCH_TERMS: dict[str, str] = {
    "Cassava": "cassava root food",
    "Cowpeas": "black-eyed peas legume",
    "Eggplants": "garden egg vegetable",
    "Eggs": "chicken eggs food",
    "Fish (mackerel, fresh)": "mackerel",
    "Gari": "garri cassava granules food",
    "Maize": "dried maize corn kernels",
    "Maize (yellow)": "yellow maize corn kernels",
    "Meat (chicken)": "raw chicken drumsticks",
    "Millet": "millet grain food",
    "Onions": "red onions pile market",
    "Peppers (dried)": "dried chili peppers food",
    "Peppers (fresh)": "chili pepper fresh",
    "Plantains (apem)": "plantain fruit food",
    "Rice (imported)": "raw rice grains",
    "Rice (paddy)": "unhulled rice",
    "Sorghum": "sorghum grain food",
    "Soybeans": "Glycine max seeds",
    "Tomatoes (local)": "fresh tomatoes food market",
    "Yam": "african yam tuber food",
}

# Exact Commons file titles known (by manual review) to be a strong,
# unambiguous match — several of the top relevance-ranked search results
# above turned out, on visual inspection, to be prepared-dish photos rather
# than the raw commodity (e.g. search "raw chicken meat food" surfaced a
# "chicken and ham pie salad" plate). main() prefers this exact-title lookup
# over the heuristic search when a commodity has an entry here.
EXACT_TITLE_OVERRIDE: dict[str, str] = {
    "Eggplants": "File:Garden Eggs 1.jpg",
    "Fish (mackerel, fresh)": "File:Frozen fresh mackerel.jpg",
    "Meat (chicken)": "File:Raw chicken drumsticks (3312851753).jpg",
    "Onions": "File:Pile of Onions at Barkin Dogo Market, Kaduna North 01.jpg",
    "Peppers (fresh)": "File:FRESH CHILLI PAPER.jpg",
    "Rice (imported)": "File:Basmati Rice India, raw.jpg",
    "Rice (paddy)": "File:Mushqbudji rice - paddy (unhulled rice).jpg",
    "Soybeans": "File:Glycine max seeds.JPG",
}

REUSE: dict[str, str] = {
    "Cowpeas (white)": "Cowpeas",
    "Meat (chicken, local)": "Meat (chicken)",
    "Plantains (apentu)": "Plantains (apem)",
    "Rice (local)": "Rice (imported)",
    "Tomatoes (navrongo)": "Tomatoes (local)",
    "Yam (puna)": "Yam",
}


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(10 * (attempt + 1))
                continue
            raise


def search_candidates(query: str, limit: int = 15) -> list[dict]:
    url = (
        "https://commons.wikimedia.org/w/api.php"
        "?action=query&generator=search&gsrnamespace=6&gsrlimit={limit}"
        "&gsrsearch={q}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=480&format=json"
    ).format(limit=limit, q=urllib.request.quote(query))
    data = fetch_json(url)
    pages = data.get("query", {}).get("pages", {})
    return list(pages.values())


def pick_best(pages: list[dict]) -> dict | None:
    for page in pages:
        title = page.get("title", "")
        if not re.search(r"\.(jpe?g|png)$", title, re.IGNORECASE):
            continue
        infos = page.get("imageinfo")
        if not infos:
            continue
        info = infos[0]
        meta = info.get("extmetadata", {})
        license_key = meta.get("License", {}).get("value", "").lower().strip()
        if license_key not in ACCEPTABLE_LICENSES:
            continue
        width = info.get("width", 0)
        height = info.get("height", 0)
        if width < 300 or height < 300:
            continue
        aspect = width / height if height else 0
        if not (0.5 <= aspect <= 2.0):
            continue
        return {
            "title": title,
            "thumburl": info.get("thumburl"),
            "descriptionurl": info.get("descriptionurl"),
            "license": license_key,
            "artist": re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "Unknown")).strip(),
            "credit": re.sub(r"<[^>]+>", "", meta.get("Credit", {}).get("value", "")).strip(),
        }
    return None


def fetch_exact(title: str) -> dict | None:
    url = (
        "https://commons.wikimedia.org/w/api.php"
        "?action=query&titles={title}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=480&format=json"
    ).format(title=urllib.request.quote(title))
    data = fetch_json(url)
    pages = list(data.get("query", {}).get("pages", {}).values())
    return pick_best(pages) if pages else None


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                dest.write_bytes(resp.read())
            return
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(10 * (attempt + 1))
                continue
            raise


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    attribution: dict[str, dict] = {}
    if ATTRIBUTION_PATH.exists():
        attribution = json.loads(ATTRIBUTION_PATH.read_text())

    failures: list[str] = []

    for commodity, query in SEARCH_TERMS.items():
        slug = slugify(commodity)
        dest = OUT_DIR / f"{slug}.jpg"
        if dest.exists():
            print(f"skip (exists): {commodity}")
            continue

        override_title = EXACT_TITLE_OVERRIDE.get(commodity)
        try:
            if override_title:
                print(f"fetching exact match: {commodity!r} -> {override_title!r}")
                best = fetch_exact(override_title)
            else:
                print(f"searching: {commodity!r} -> {query!r}")
                pages = search_candidates(query)
                best = pick_best(pages)
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR fetching {commodity}: {e}")
            failures.append(commodity)
            continue

        if not best:
            print(f"  NO ACCEPTABLE CANDIDATE for {commodity}")
            failures.append(commodity)
            continue

        try:
            download(best["thumburl"], dest)
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR downloading {commodity}: {e}")
            failures.append(commodity)
            continue

        attribution[commodity] = {
            "file": f"{slug}.jpg",
            "title": best["title"],
            "source": best["descriptionurl"],
            "license": best["license"],
            "artist": best["artist"] or "Unknown",
        }
        print(f"  OK -> {dest.name} ({best['license']}, {best['artist'][:40]})")
        time.sleep(4)  # polite delay between Commons requests — avoid 429s

    for commodity, base in REUSE.items():
        slug = slugify(commodity)
        base_slug = slugify(base)
        dest = OUT_DIR / f"{slug}.jpg"
        base_file = OUT_DIR / f"{base_slug}.jpg"
        if dest.exists():
            print(f"skip (exists): {commodity}")
            continue
        if not base_file.exists():
            print(f"  CANNOT REUSE for {commodity}: base {base} has no photo yet")
            failures.append(commodity)
            continue
        dest.write_bytes(base_file.read_bytes())
        if base in attribution:
            attribution[commodity] = {**attribution[base], "file": f"{slug}.jpg", "reused_from": base}
        print(f"  reused {base} -> {commodity}")

    ATTRIBUTION_PATH.write_text(json.dumps(attribution, indent=2, ensure_ascii=False))
    print(f"\nwrote {ATTRIBUTION_PATH}")
    print(f"{len(attribution)} commodities have a photo; {len(failures)} failed: {failures}")


if __name__ == "__main__":
    main()
