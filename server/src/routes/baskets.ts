import { Router } from "express";

import { pool } from "../db/pool";
import { asyncHandler } from "../lib/async-handler";
import { optimizeBasket } from "../lib/basket-optimizer";
import { notFound } from "../lib/http-error";
import { type AuthedRequest, requireAuth } from "../middleware/auth";
import { createBasketSchema, optimizeBasketSchema, updateBasketSchema } from "../schemas/baskets";
import { uuidSchema } from "../schemas/shared";

export const basketsRouter = Router();

// Saved-basket CRUD is personal data and requires auth; the ad-hoc
// POST /optimize below deliberately does not — it's a stateless calculator
// over public price data, matching this app's existing convention that
// predictions/news are public and only saved, user-owned data is gated
// (see routes/predictions.ts, routes/news.ts).

async function loadBasketItems(basketId: string): Promise<{ commodityId: string; commodityName: string; quantity: number }[]> {
  const { rows } = await pool.query<{ commodityId: string; commodityName: string; quantity: number }>(
    `
    SELECT bi.commodity_id AS "commodityId", c.name AS "commodityName", bi.quantity::float AS quantity
    FROM shopping_basket_items bi
    JOIN commodities c ON c.id = bi.commodity_id
    WHERE bi.basket_id = $1
    ORDER BY c.name
    `,
    [basketId],
  );
  return rows;
}

async function loadOwnedBasket(basketId: string, userId: string): Promise<{ id: string; name: string; createdAt: string; updatedAt: string } | undefined> {
  const { rows } = await pool.query<{ id: string; name: string; createdAt: string; updatedAt: string }>(
    `
    SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM shopping_baskets
    WHERE id = $1 AND user_id = $2
    `,
    [basketId, userId],
  );
  return rows[0];
}

basketsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await pool.query(
      `
      SELECT
        b.id, b.name, b.created_at AS "createdAt", b.updated_at AS "updatedAt",
        COUNT(bi.id)::int AS "itemCount"
      FROM shopping_baskets b
      LEFT JOIN shopping_basket_items bi ON bi.basket_id = b.id
      WHERE b.user_id = $1
      GROUP BY b.id
      ORDER BY b.updated_at DESC
      `,
      [req.userId],
    );
    res.json(rows);
  }),
);

basketsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { name, items } = createBasketSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const basketResult = await client.query<{ id: string; name: string; createdAt: string; updatedAt: string }>(
        `INSERT INTO shopping_baskets (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [req.userId, name],
      );
      const basket = basketResult.rows[0];
      for (const item of items) {
        await client.query(`INSERT INTO shopping_basket_items (basket_id, commodity_id, quantity) VALUES ($1, $2, $3)`, [
          basket.id,
          item.commodityId,
          item.quantity,
        ]);
      }
      await client.query("COMMIT");
      res.status(201).json({ ...basket, items: await loadBasketItems(basket.id) });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }),
);

basketsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = uuidSchema.parse(req.params.id);
    const basket = await loadOwnedBasket(id, req.userId!);
    if (!basket) throw notFound("Shopping basket");
    res.json({ ...basket, items: await loadBasketItems(basket.id) });
  }),
);

basketsRouter.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = uuidSchema.parse(req.params.id);
    const existing = await loadOwnedBasket(id, req.userId!);
    if (!existing) throw notFound("Shopping basket");

    const { name, items } = updateBasketSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (name) {
        await client.query(`UPDATE shopping_baskets SET name = $1, updated_at = now() WHERE id = $2`, [name, id]);
      }
      if (items) {
        await client.query(`DELETE FROM shopping_basket_items WHERE basket_id = $1`, [id]);
        for (const item of items) {
          await client.query(`INSERT INTO shopping_basket_items (basket_id, commodity_id, quantity) VALUES ($1, $2, $3)`, [
            id,
            item.commodityId,
            item.quantity,
          ]);
        }
        await client.query(`UPDATE shopping_baskets SET updated_at = now() WHERE id = $1`, [id]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const updated = await loadOwnedBasket(id, req.userId!);
    res.json({ ...updated, items: await loadBasketItems(id) });
  }),
);

basketsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = uuidSchema.parse(req.params.id);
    const existing = await loadOwnedBasket(id, req.userId!);
    if (!existing) throw notFound("Shopping basket");
    await pool.query(`DELETE FROM shopping_baskets WHERE id = $1`, [id]);
    res.status(204).send();
  }),
);

// Optimizes an ad-hoc item list without requiring it to be saved first —
// the "try before you save" path the app's basket-builder screen uses live
// as the user adds items.
basketsRouter.post(
  "/optimize",
  asyncHandler(async (req, res) => {
    const { items } = optimizeBasketSchema.parse(req.body);
    res.json(await optimizeBasket(items));
  }),
);

// Optimizes a previously saved basket by id.
basketsRouter.post(
  "/:id/optimize",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = uuidSchema.parse(req.params.id);
    const basket = await loadOwnedBasket(id, req.userId!);
    if (!basket) throw notFound("Shopping basket");
    const items = await loadBasketItems(id);
    res.json(await optimizeBasket(items.map((i) => ({ commodityId: i.commodityId, quantity: i.quantity }))));
  }),
);
