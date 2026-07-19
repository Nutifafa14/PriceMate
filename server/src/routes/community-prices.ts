import { Router } from "express";

import { pool } from "../db/pool";
import { asyncHandler } from "../lib/async-handler";
import { communityPriceQuerySchema } from "../schemas/community-prices";

export const communityPricesRouter = Router();

// Real MoFA SRID price reports — see data/reports/MOFA_CLEANING_CHANGELOG.md
// for why this is a separate table/endpoint from /api/prices: the source
// has no documented unit, so it's never blended into the wholesale trend or
// the ML model. `source` is always returned so the client can label it
// honestly ("As reported by MoFA SRID — unit not specified by source").
communityPricesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = communityPriceQuerySchema.parse(req.query);

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

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(query.limit, query.offset);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        commodity_id AS "commodityId",
        market_id AS "marketId",
        to_char(date, 'YYYY-MM-DD') AS date,
        price::float AS price,
        price_type AS "priceType",
        currency,
        source
      FROM community_prices
      ${where}
      ORDER BY date DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );

    res.json(rows);
  }),
);
