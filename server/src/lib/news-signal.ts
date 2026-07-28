import { getCommodityNews, type NewsArticle } from "./news-client";

/**
 * A real, live "market pressure" signal extracted from this commodity's own
 * recent news (see news-client.ts) — deliberately NOT generic positive/
 * negative sentiment analysis. Generic sentiment doesn't map to price
 * direction: "Rice prices surge" reads as negative in tone but means
 * upward price pressure, while "Bumper cassava harvest expected" reads
 * positive but means downward price pressure. This scores articles against
 * two curated term sets — supply/cost-disruption language (upward pressure)
 * vs. supply-relief language (downward pressure) — which is what a market
 * analyst actually reads these articles for.
 *
 * Important, hard constraint this module works within: GNews's free tier
 * strips articles older than 30 days from its response even when they're
 * indexed (confirmed empirically — see news-client.ts's own comments).
 * There is no way to reconstruct a historical news-pressure series back to
 * 2015 for the ML model's training set, so this can only ever be a live,
 * present-moment signal — see forecast-pipeline.ts for why it's applied as
 * a disclosed post-hoc adjustment (the same mechanism as the FX and global-
 * benchmark signals) rather than a retrained model feature.
 */

const UPWARD_PRESSURE_TERMS: RegExp[] = [
  /shortage/i,
  /scarc(e|ity)/i,
  /drought/i,
  /flood(ing)?/i,
  /export ban/i,
  /smuggl/i,
  /fuel price/i,
  /diesel price/i,
  /transport(ation)? (cost|fare)/i,
  /supply disrupt/i,
  /crop failure/i,
  /pest (outbreak|infestation)/i,
  /price (surge|spike|hike|soar)/i,
  /(prices?) (ris(e|ing)|rose|climb)/i,
  /currency depreciat/i,
  /cedi (falls|weakens|depreciates)/i,
  /inflation/i,
  /supply chain (crisis|disruption)/i,
  /border closure/i,
  /strike/i,
];

const DOWNWARD_PRESSURE_TERMS: RegExp[] = [
  /bumper harvest/i,
  /surplus/i,
  /import influx/i,
  /subsid(y|ies)/i,
  /price (cap|control)/i,
  /favo(u)?rable rain/i,
  /good rainfall/i,
  /stabiliz/i,
  /glut/i,
  /(prices?) (fall|falling|fell|drop|decline|ease)/i,
  /cedi (strengthens|appreciates|gains)/i,
  /bumper (yield|production)/i,
  /increased (supply|production)/i,
];

export type NewsSignal = {
  available: boolean;
  /** -1 (strong downward pressure) .. +1 (strong upward pressure). */
  pressureScore: number;
  articleCount: number;
  matchedUpwardTerms: string[];
  matchedDownwardTerms: string[];
  detail: string;
};

function scoreArticle(article: NewsArticle): { upward: string[]; downward: string[] } {
  const text = `${article.title} ${article.description ?? ""}`;
  const upward = UPWARD_PRESSURE_TERMS.filter((re) => re.test(text)).map((re) => re.source);
  const downward = DOWNWARD_PRESSURE_TERMS.filter((re) => re.test(text)).map((re) => re.source);
  return { upward, downward };
}

/**
 * Fetches this commodity's real recent news (reuses news-client.ts's
 * existing cache and rate-limit queue — this does not add extra GNews
 * requests beyond what the Prediction screen's own news feed already
 * makes) and scores it for price-pressure language. Returns
 * `available: false` (never throws) when there's no news to score, so the
 * forecast pipeline can fall back to its baseline-only estimate cleanly.
 */
export async function getNewsSignal(commodityName: string): Promise<NewsSignal> {
  const articles = await getCommodityNews(commodityName);
  if (articles.length === 0) {
    return {
      available: false,
      pressureScore: 0,
      articleCount: 0,
      matchedUpwardTerms: [],
      matchedDownwardTerms: [],
      detail: `No recent ${commodityName} news available — this signal contributes nothing to the forecast.`,
    };
  }

  const upwardTerms = new Set<string>();
  const downwardTerms = new Set<string>();
  let upwardHits = 0;
  let downwardHits = 0;

  for (const article of articles) {
    const { upward, downward } = scoreArticle(article);
    upward.forEach((t) => upwardTerms.add(t));
    downward.forEach((t) => downwardTerms.add(t));
    upwardHits += upward.length;
    downwardHits += downward.length;
  }

  if (upwardHits === 0 && downwardHits === 0) {
    return {
      available: true,
      pressureScore: 0,
      articleCount: articles.length,
      matchedUpwardTerms: [],
      matchedDownwardTerms: [],
      detail: `${articles.length} recent ${commodityName} article(s) found, but none mention supply, cost, or price-direction language — neutral signal.`,
    };
  }

  // Bounded in (-1, 1); the "+1" in the denominator means a single hit
  // never swings the score to the extremes — it takes several corroborating
  // articles to reach a strong reading, which is the honest behavior for a
  // low-volume, unvalidated signal like this one.
  const pressureScore = (upwardHits - downwardHits) / (upwardHits + downwardHits + 1);

  const direction = pressureScore > 0.1 ? "upward" : pressureScore < -0.1 ? "downward" : "mixed/neutral";
  const matchedUpwardTerms = [...upwardTerms];
  const matchedDownwardTerms = [...downwardTerms];
  const mentionParts = [
    matchedUpwardTerms.length ? `upward-pressure terms: ${matchedUpwardTerms.join(", ")}` : null,
    matchedDownwardTerms.length ? `downward-pressure terms: ${matchedDownwardTerms.join(", ")}` : null,
  ].filter(Boolean);

  return {
    available: true,
    pressureScore,
    articleCount: articles.length,
    matchedUpwardTerms,
    matchedDownwardTerms,
    detail: `${articles.length} recent ${commodityName} article(s) scanned, net ${direction} price-pressure signal (${mentionParts.join("; ")}).`,
  };
}
