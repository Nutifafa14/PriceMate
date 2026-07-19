import { Router } from "express";

import { pool } from "../db/pool";
import { asyncHandler } from "../lib/async-handler";
import { notFound } from "../lib/http-error";
import { commodityQuerySchema } from "../schemas/commodities";
import { uuidSchema } from "../schemas/shared";

export const commoditiesRouter = Router();

const SELECT_COMMODITY = `
  SELECT id, name, category
  FROM commodities
`;

commoditiesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { category } = commodityQuerySchema.parse(req.query);

    const { rows } = category
      ? await pool.query(`${SELECT_COMMODITY} WHERE category = $1 ORDER BY name`, [category])
      : await pool.query(`${SELECT_COMMODITY} ORDER BY name`);

    res.json(rows);
  }),
);

commoditiesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = uuidSchema.parse(req.params.id);
    const { rows } = await pool.query(`${SELECT_COMMODITY} WHERE id = $1`, [id]);
    if (!rows[0]) throw notFound("Commodity");
    res.json(rows[0]);
  }),
);
