import { Router } from "express";

import { pool } from "../db/pool";
import { asyncHandler } from "../lib/async-handler";
import { buildForecast } from "../lib/forecast-pipeline";
import { notFound } from "../lib/http-error";
import { predictionsRateLimiter } from "../middleware/rate-limit";
import { createPredictionSchema, predictionQuerySchema } from "../schemas/predictions";

export const predictionsRouter = Router();

predictionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { commodityId, marketId } = predictionQuerySchema.parse(req.query);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (commodityId) {
      params.push(commodityId);
      conditions.push(`commodity_id = $${params.length}`);
    }
    if (marketId) {
      params.push(marketId);
      conditions.push(`market_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `
      SELECT
        id,
        commodity_id AS "commodityId",
        market_id AS "marketId",
        to_char(prediction_date, 'YYYY-MM-DD') AS "predictionDate",
        predicted_price::float AS "predictedPrice",
        model_name AS "modelName",
        created_at AS "createdAt"
      FROM predictions
      ${where}
      ORDER BY prediction_date DESC, created_at DESC
      `,
      params,
    );

    res.json(rows);
  }),
);

// Runs the full forecast pipeline (Phase 4 ML baseline + FX/global-benchmark
// signal adjustment + real backtest-derived range, see
// lib/forecast-pipeline.ts), persists the baseline point estimate (unchanged
// row shape, so history/trend consumers of GET below are unaffected) plus a
// full audit-log row in forecast_runs, and returns the enriched forecast —
// the Prediction screen's "Predict future price" button hits this.
predictionsRouter.post(
  "/",
  predictionsRateLimiter,
  asyncHandler(async (req, res) => {
    const { commodityId, marketId, month, year } = createPredictionSchema.parse(req.body);

    const [commodityResult, marketResult] = await Promise.all([
      pool.query<{ name: string; category: string }>("SELECT name, category FROM commodities WHERE id = $1", [
        commodityId,
      ]),
      pool.query<{ name: string }>("SELECT name FROM markets WHERE id = $1", [marketId]),
    ]);
    const commodity = commodityResult.rows[0];
    const market = marketResult.rows[0];
    if (!commodity) throw notFound("Commodity");
    if (!market) throw notFound("Market");

    const forecast = await buildForecast(commodityId, commodity.name, market.name, commodity.category, month, year);

    const predictionDate = `${year}-${String(month).padStart(2, "0")}-15`;

    const { rows } = await pool.query(
      `
      INSERT INTO predictions (commodity_id, market_id, prediction_date, predicted_price, model_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        commodity_id AS "commodityId",
        market_id AS "marketId",
        to_char(prediction_date, 'YYYY-MM-DD') AS "predictionDate",
        predicted_price::float AS "predictedPrice",
        model_name AS "modelName",
        created_at AS "createdAt"
      `,
      [commodityId, marketId, predictionDate, forecast.baselinePrice, forecast.baselineModelName],
    );
    const prediction = rows[0];

    await pool.query(
      `
      INSERT INTO forecast_runs (
        prediction_id, commodity_id, market_id, forecast_date,
        baseline_price, central_estimate, low_estimate, high_estimate,
        confidence_label, category_mape, signals
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        prediction.id,
        commodityId,
        marketId,
        predictionDate,
        forecast.baselinePrice,
        forecast.centralEstimate,
        forecast.lowEstimate,
        forecast.highEstimate,
        forecast.confidenceLabel,
        forecast.categoryMape ?? null,
        JSON.stringify({
          signals: forecast.signals,
          why: forecast.why,
          dataFreshness: forecast.dataFreshness,
          extrapolationYears: forecast.extrapolationYears,
        }),
      ],
    );

    res.status(201).json({
      ...prediction,
      centralEstimate: forecast.centralEstimate,
      lowEstimate: forecast.lowEstimate,
      highEstimate: forecast.highEstimate,
      confidenceLabel: forecast.confidenceLabel,
      categoryMape: forecast.categoryMape ?? null,
      extrapolationYears: forecast.extrapolationYears,
      signals: forecast.signals,
      why: forecast.why,
      dataFreshness: forecast.dataFreshness,
      disclaimer: forecast.disclaimer,
    });
  }),
);
