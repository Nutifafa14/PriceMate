import { Router } from "express";

import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { getBacktestSample, getMlMetadata, retrainModel } from "../lib/ml-client";
import { requireAuth } from "../middleware/auth";

export const modelRouter = Router();

// Real model provenance + quality metrics — everything here comes straight
// from ml/models/metadata.json (itself produced by a real chronological
// backtest in ml/src/train.py), nothing computed or estimated here.
modelRouter.get(
  "/insights",
  asyncHandler(async (_req, res) => {
    const metadata = await getMlMetadata();
    if (!metadata) throw new HttpError(502, "Model metadata is unavailable — check that the prediction service is running.");
    res.json(metadata);
  }),
);

// A real predicted-vs-actual sample from the model's held-out chronological
// test set (see ml/src/train.py) — never-trained-on data, not simulated.
modelRouter.get(
  "/backtest",
  asyncHandler(async (_req, res) => {
    res.json(await getBacktestSample());
  }),
);

// Retraining is an explicit, authenticated, on-demand action (any signed-in
// user — this app has no admin-role concept, matching every other
// authenticated route) rather than an automatic background job, per this
// app's "no CI/CD, changes are reviewed" posture (see DEPLOYMENT.md). Runs
// synchronously (real training takes a few seconds on this dataset size)
// and returns once the running ml/ API has hot-reloaded the fresh model.
modelRouter.post(
  "/retrain",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const result = await retrainModel();
    res.json(result);
  }),
);
