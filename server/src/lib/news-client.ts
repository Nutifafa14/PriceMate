import { env } from "../env";

export type NewsArticle = {
  title: string;
  description: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  sourceName: string;
};

type GNewsArticle = {
  title: string;
  description: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string };
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — matches GNews free tier's own real-time delay, so refreshing more often buys nothing.

// GNews's free tier: 100 requests/day (confirmed against their pricing page),
// plus an undocumented burst limit — empirically, firing requests back-to-back
// got blocked after ~2 in quick succession during development. This gate
// serializes every outbound call (general + per-commodity) through one queue
// with a minimum spacing, so concurrent requests for different commodities
// queue up and wait their turn instead of bursting.
const MIN_SPACING_MS = 4000;
let queueTail: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const result = await fn();
    await new Promise((resolve) => setTimeout(resolve, MIN_SPACING_MS));
    return result;
  });
  // Swallow errors here so one failed fetch doesn't wedge the queue for
  // everything queued after it — the real error still propagates to `run`'s
  // own caller via the returned promise.
  queueTail = run.catch(() => undefined);
  return run;
}

// Bare single-word terms are a real correctness problem, not just noise:
// GNews's full-text search matched "rice" against footballer Declan Rice's
// name (England squad news), and "food" against unrelated "food and drink"
// phrases in non-agricultural articles. Every query below uses multi-word
// phrases to avoid that collision — verified against live queries during
// development.
const GENERAL_QUERY =
  '"Ghana" AND ("food price" OR "food prices" OR "food security" OR agriculture OR cocoa OR maize OR cassava OR "rice farmers" OR "rice production" OR sorghum OR millet OR "crop harvest")';

const OFF_TOPIC_PATTERN =
  /\b(world cup|football|match|goal|injury|striker|midfielder|premier league|fifa|england squad)\b/i;

function isOnTopic(article: { title: string; description: string | null }): boolean {
  return !OFF_TOPIC_PATTERN.test(`${article.title} ${article.description ?? ""}`);
}

/**
 * Commodity variants that would genuinely share the same real-world news
 * (e.g. "Maize" and "Maize (yellow)" both move on the same maize-market
 * news) are grouped under one query — 17 groups covering the app's 26
 * commodities, not 26 separate queries, to stay well inside the 100/day
 * budget even with periodic refresh. Each group has its own search query
 * AND a relevance pattern used to double-check returned articles actually
 * mention that commodity (or a close synonym) before showing them.
 *
 * Query design note: an earlier version of every query here required an
 * exact multi-word phrase (e.g. "maize price"), reasoning that would be
 * safest against false matches. Testing live against GNews showed the
 * opposite problem — exact-phrase AND queries returned *zero* results for
 * most commodities on most days; GNews's real Ghana-specific agricultural
 * coverage is low-volume, and few articles happen to contain the exact
 * phrase verbatim. Queries below use a single distinctive commodity word
 * where that word has no real collision risk (verified — "maize",
 * "cassava", "plantain", "sorghum", "gari" aren't names/idioms/other
 * products), and keep phrase-qualification only where a real collision was
 * found or is plausible ("rice" matched footballer Declan Rice; "chicken"
 * and "egg" collide with restaurants/idioms/unrelated common usage).
 */
const COMMODITY_NEWS_GROUPS: Record<string, { query: string; relevance: RegExp }> = {
  cassava: {
    query: '"Ghana" AND cassava',
    relevance: /cassava/i,
  },
  cowpeas: {
    query: '"Ghana" AND (cowpea OR cowpeas)',
    relevance: /cowpea/i,
  },
  eggplants: {
    query: '"Ghana" AND (eggplant OR "garden egg")',
    relevance: /eggplant|garden egg/i,
  },
  eggs: {
    query: '"Ghana" AND ("egg price" OR "egg production" OR poultry)',
    relevance: /\begg\b|\beggs\b|poultry/i,
  },
  fish: {
    query: '"Ghana" AND (mackerel OR "fish price" OR fishing)',
    relevance: /mackerel|\bfish\b|fishing/i,
  },
  gari: {
    query: '"Ghana" AND (gari OR garri)',
    relevance: /\bgari\b|\bgarri\b/i,
  },
  maize: {
    query: '"Ghana" AND maize',
    relevance: /maize/i,
  },
  chicken: {
    query: '"Ghana" AND ("chicken price" OR poultry)',
    relevance: /chicken|poultry/i,
  },
  millet: {
    query: '"Ghana" AND millet',
    relevance: /millet/i,
  },
  onions: {
    query: '"Ghana" AND onion',
    relevance: /onion/i,
  },
  peppers: {
    query: '"Ghana" AND (pepper OR "scotch bonnet")',
    relevance: /pepper|scotch bonnet/i,
  },
  plantains: {
    query: '"Ghana" AND plantain',
    relevance: /plantain/i,
  },
  rice: {
    query: '"Ghana" AND ("rice price" OR "rice farmers" OR "rice production" OR "rice import")',
    relevance: /\brice\b/i,
  },
  sorghum: {
    query: '"Ghana" AND sorghum',
    relevance: /sorghum/i,
  },
  soybeans: {
    query: '"Ghana" AND (soybean OR "soya bean")',
    relevance: /soybean|soya bean/i,
  },
  tomatoes: {
    query: '"Ghana" AND tomato',
    relevance: /tomato/i,
  },
  yam: {
    query: '"Ghana" AND (yam OR yams)',
    relevance: /\byam\b|\byams\b/i,
  },
};

/** Maps an exact commodity name (as stored in the DB) to its news group key. */
const COMMODITY_TO_GROUP: Record<string, string> = {
  Cassava: "cassava",
  Cowpeas: "cowpeas",
  "Cowpeas (white)": "cowpeas",
  Eggplants: "eggplants",
  Eggs: "eggs",
  "Fish (mackerel, fresh)": "fish",
  Gari: "gari",
  Maize: "maize",
  "Maize (yellow)": "maize",
  "Meat (chicken)": "chicken",
  "Meat (chicken, local)": "chicken",
  Millet: "millet",
  Onions: "onions",
  "Peppers (dried)": "peppers",
  "Peppers (fresh)": "peppers",
  "Plantains (apem)": "plantains",
  "Plantains (apentu)": "plantains",
  "Rice (imported)": "rice",
  "Rice (local)": "rice",
  "Rice (paddy)": "rice",
  Sorghum: "sorghum",
  Soybeans: "soybeans",
  "Tomatoes (local)": "tomatoes",
  "Tomatoes (navrongo)": "tomatoes",
  Yam: "yam",
  "Yam (puna)": "yam",
};

const cache = new Map<string, { articles: NewsArticle[]; fetchedAt: number }>();

async function fetchGNews(query: string, relevance?: RegExp): Promise<NewsArticle[] | undefined> {
  if (!env.gnewsApiKey) return undefined;

  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", query);
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", "10");
  url.searchParams.set("sortby", "publishedAt");
  url.searchParams.set("apikey", env.gnewsApiKey);

  const response = await fetch(url);
  if (!response.ok) return undefined;

  const body = (await response.json()) as { articles?: GNewsArticle[] };
  return (body.articles ?? [])
    .filter(isOnTopic)
    .filter((a) => !relevance || relevance.test(`${a.title} ${a.description ?? ""}`))
    .map((a) => ({
      title: a.title,
      description: a.description,
      url: a.url,
      image: a.image,
      publishedAt: a.publishedAt,
      sourceName: a.source?.name ?? "Unknown source",
    }));
}

async function getCached(cacheKey: string, query: string, relevance?: RegExp): Promise<NewsArticle[]> {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.articles;
  }

  try {
    const articles = await enqueue(() => fetchGNews(query, relevance));
    if (articles === undefined) return cached?.articles ?? [];
    cache.set(cacheKey, { articles, fetchedAt: Date.now() });
    return articles;
  } catch {
    return cached?.articles ?? [];
  }
}

/** General Ghana food/agriculture news — used when no specific commodity is requested. */
export async function getGhanaFoodNews(): Promise<NewsArticle[]> {
  return getCached("__general__", GENERAL_QUERY);
}

/**
 * Real, commodity-scoped news — a distinct GNews query per commodity group
 * (see COMMODITY_NEWS_GROUPS), each result double-checked against a
 * relevance pattern before being shown. Falls back to the general feed for
 * a commodity name that isn't mapped to a group (shouldn't happen for any
 * of the app's 26 commodities, but fails safe rather than erroring).
 */
export async function getCommodityNews(commodityName: string): Promise<NewsArticle[]> {
  const groupKey = COMMODITY_TO_GROUP[commodityName];
  if (!groupKey) return getGhanaFoodNews();

  const group = COMMODITY_NEWS_GROUPS[groupKey];
  return getCached(groupKey, group.query, group.relevance);
}
