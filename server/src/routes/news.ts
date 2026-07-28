import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/async-handler";
import { getCommodityNews, getGhanaFoodNews } from "../lib/news-client";

export const newsRouter = Router();

const newsQuerySchema = z.object({
  commodity: z.string().trim().min(1).optional(),
});

// Server-side cached (see lib/news-client.ts) — the app never calls GNews
// directly and never sees the API key. Always 200s with whatever's
// available (possibly an empty array), so a news outage never breaks the
// Prediction screen it's shown on. `?commodity=<name>` returns a real,
// commodity-scoped feed (its own query + relevance check); omitted, it
// falls back to the general Ghana food/agriculture feed.
newsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { commodity } = newsQuerySchema.parse(req.query);
    const articles = commodity ? await getCommodityNews(commodity) : await getGhanaFoodNews();
    res.json(articles);
  }),
);
