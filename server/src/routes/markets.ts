import { Router } from "express";

import { pool } from "../db/pool";
import { asyncHandler } from "../lib/async-handler";
import { notFound } from "../lib/http-error";
import { marketQuerySchema } from "../schemas/markets";
import { uuidSchema } from "../schemas/shared";

export const marketsRouter = Router();

const SELECT_MARKET = `
  SELECT id, name, region, district, latitude, longitude
  FROM markets
`;

marketsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { region } = marketQuerySchema.parse(req.query);

    const { rows } = region
      ? await pool.query(`${SELECT_MARKET} WHERE region = $1 ORDER BY name`, [region])
      : await pool.query(`${SELECT_MARKET} ORDER BY name`);

    res.json(rows);
  }),
);

marketsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = uuidSchema.parse(req.params.id);
    const { rows } = await pool.query(`${SELECT_MARKET} WHERE id = $1`, [id]);
    if (!rows[0]) throw notFound("Market");
    res.json(rows[0]);
  }),
);
