import { z } from "zod";

import { isoDateSchema, paginationSchema, priceTypeSchema, uuidSchema } from "./shared";

export const priceQuerySchema = z
  .object({
    commodityId: uuidSchema.optional(),
    marketId: uuidSchema.optional(),
    priceType: priceTypeSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .merge(paginationSchema);

export const latestPriceQuerySchema = z.object({
  commodityId: uuidSchema.optional(),
  marketId: uuidSchema.optional(),
});

export type Price = {
  id: string;
  commodityId: string;
  marketId: string;
  date: string;
  price: number;
  priceType: "Wholesale" | "Retail";
  currency: string;
  unit: string;
  unitQuantity: number;
  unitMeasure: string;
};
