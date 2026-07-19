import { Router } from "express";

import { pool } from "../db/pool";
import { asyncHandler } from "../lib/async-handler";
import { latestPriceQuerySchema, priceQuerySchema } from "../schemas/prices";

export const pricesRouter = Router();

const SELECT_PRICE = `
  SELECT
    id,
    commodity_id AS "commodityId",
    market_id AS "marketId",
    to_char(date, 'YYYY-MM-DD') AS date,
    price::float AS price,
    price_type AS "priceType",
    currency,
    unit,
    unit_quantity::float AS "unitQuantity",
    unit_measure AS "unitMeasure"
  FROM prices
`;

pricesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = priceQuerySchema.parse(req.query);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.commodityId) {
      params.push(query.commodityId);
      conditions.push(`commodity_id = $${params.length}`);
    }
    if (query.marketId) {
      params.push(query.marketId);
      conditions.push(`market_id = $${params.length}`);
    }
    if (query.priceType) {
      params.push(query.priceType);
      conditions.push(`price_type = $${params.length}`);
    }
    if (query.from) {
      params.push(query.from);
      conditions.push(`date >= $${params.length}`);
    }
    if (query.to) {
      params.push(query.to);
      conditions.push(`date <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(query.limit, query.offset);

    const { rows } = await pool.query(
      `${SELECT_PRICE} ${where} ORDER BY date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json(rows);
  }),
);

// Most recent price per (commodity, market, price_type) combination —
// backs the "current wholesale prices" home dashboard feature.
pricesRouter.get(
  "/latest",
  asyncHandler(async (req, res) => {
    const { commodityId, marketId } = latestPriceQuerySchema.parse(req.query);

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
      SELECT DISTINCT ON (commodity_id, market_id, price_type)
        id,
        commodity_id AS "commodityId",
        market_id AS "marketId",
        to_char(date, 'YYYY-MM-DD') AS date,
        price::float AS price,
        price_type AS "priceType",
        currency,
        unit,
        unit_quantity::float AS "unitQuantity",
        unit_measure AS "unitMeasure"
      FROM prices
      ${where}
      ORDER BY commodity_id, market_id, price_type, date DESC
      `,
      params,
    );

    res.json(rows);
  }),
);
