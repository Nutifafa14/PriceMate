import { Router } from "express";

import { asyncHandler } from "../lib/async-handler";
import { getGhanaFoodNews } from "../lib/news-client";

export const newsRouter = Router();

// Server-side cached (see lib/news-client.ts) — the app never calls GNews
// directly and never sees the API key. Always 200s with whatever's
// available (possibly an empty array), so a news outage never breaks the
// Prediction screen it's shown on.
newsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const articles = await getGhanaFoodNews();
    res.json(articles);
  }),
);
