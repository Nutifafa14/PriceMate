import { Router } from "express";

import { pool } from "../db/pool";
import { asyncHandler } from "../lib/async-handler";
import { notFound } from "../lib/http-error";
import { predictPrice } from "../lib/ml-client";
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

// Calls the Phase 4 ML API (ml/src/api.py) for a live prediction, persists
// it, and returns the stored row — the Prediction screen's "Predict future
// price" button hits this.
predictionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { commodityId, marketId, month, year } = createPredictionSchema.parse(req.body);

    const [commodityResult, marketResult] = await Promise.all([
      pool.query<{ name: string }>("SELECT name FROM commodities WHERE id = $1", [commodityId]),
      pool.query<{ name: string }>("SELECT name FROM markets WHERE id = $1", [marketId]),
    ]);
    const commodity = commodityResult.rows[0];
    const market = marketResult.rows[0];
    if (!commodity) throw notFound("Commodity");
    if (!market) throw notFound("Market");

    const { predictedPrice, modelName } = await predictPrice({
      commodity: commodity.name,
      market: market.name,
      month,
      year,
    });

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
      [commodityId, marketId, predictionDate, predictedPrice, modelName],
    );

    res.status(201).json(rows[0]);
  }),
);
