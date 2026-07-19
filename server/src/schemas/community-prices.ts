import { z } from "zod";

import { paginationSchema, priceTypeSchema, uuidSchema } from "./shared";

export const communityPriceQuerySchema = z
  .object({
    commodityId: uuidSchema.optional(),
    marketId: uuidSchema.optional(),
    priceType: priceTypeSchema.optional(),
  })
  .merge(paginationSchema);

export type CommunityPrice = {
  id: string;
  commodityId: string;
  marketId: string;
  date: string;
  price: number;
  priceType: "Wholesale" | "Retail";
  currency: string;
  source: string;
};
