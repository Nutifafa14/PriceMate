import { env } from "../env";

export type NewsArticle = {
  title: string;
  description: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  sourceName: string;
};

// A single shared query, not one per commodity — GNews's free tier rate-limits
// aggressively (observed: blocked after ~2 requests in quick succession during
// development) and only refreshes its index every 12h anyway, so querying more
// often or more granularly than that buys nothing.
//
// Bare single-word terms like "rice" or "food" turned out to be a real
// correctness problem, not just noise: GNews's full-text search matched
// "rice" against footballer Declan Rice's name (England squad news), and
// "food" against unrelated "food and drink" phrases in non-agricultural
// articles. Multi-word phrases avoid that collision while still surfacing
// genuine coverage — verified against a live query during development.
const QUERY =
  '"Ghana" AND ("food price" OR "food prices" OR "food security" OR agriculture OR cocoa OR maize OR cassava OR "rice farmers" OR "rice production" OR sorghum OR millet OR "crop harvest")';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// Second layer of defense: even a well-phrased query can let through an
// article that happens to mention "Ghana" and a food word in an unrelated
// context (sports, entertainment). Require the title/description to also
// avoid an obvious off-topic signal before showing it.
const OFF_TOPIC_PATTERN =
  /\b(world cup|football|match|goal|injury|striker|midfielder|premier league|fifa|england squad)\b/i;

function isOnTopic(article: { title: string; description: string | null }): boolean {
  return !OFF_TOPIC_PATTERN.test(`${article.title} ${article.description ?? ""}`);
}

let cache: { articles: NewsArticle[]; fetchedAt: number } | null = null;

type GNewsArticle = {
  title: string;
  description: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string };
};

/**
 * Returns cached Ghana food/agriculture news, refetching from GNews at most
 * once per CACHE_TTL_MS. Never throws — a missing API key, a GNews error, or
 * a rate limit all resolve to an empty list (or the last good cache, if one
 * exists) so a news outage never breaks the Prediction screen it's shown on.
 */
export async function getGhanaFoodNews(): Promise<NewsArticle[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.articles;
  }

  if (!env.gnewsApiKey) {
    return cache?.articles ?? [];
  }

  try {
    const url = new URL("https://gnews.io/api/v4/search");
    url.searchParams.set("q", QUERY);
    url.searchParams.set("lang", "en");
    url.searchParams.set("max", "10");
    url.searchParams.set("sortby", "publishedAt");
    url.searchParams.set("apikey", env.gnewsApiKey);

    const response = await fetch(url);
    if (!response.ok) {
      return cache?.articles ?? [];
    }

    const body = (await response.json()) as { articles?: GNewsArticle[] };
    const articles: NewsArticle[] = (body.articles ?? []).filter(isOnTopic).map((a) => ({
      title: a.title,
      description: a.description,
      url: a.url,
      image: a.image,
      publishedAt: a.publishedAt,
      sourceName: a.source?.name ?? "Unknown source",
    }));

    cache = { articles, fetchedAt: Date.now() };
    return articles;
  } catch {
    return cache?.articles ?? [];
  }
}
