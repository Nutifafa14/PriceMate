import { z } from "zod";

import { uuidSchema } from "./shared";

export const basketItemInputSchema = z.object({
  commodityId: uuidSchema,
  quantity: z.coerce.number().positive(),
});

export const createBasketSchema = z.object({
  name: z.string().trim().min(1).max(100),
  items: z.array(basketItemInputSchema).min(1),
});

export const updateBasketSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  items: z.array(basketItemInputSchema).min(1).optional(),
});

export const optimizeBasketSchema = z.object({
  items: z.array(basketItemInputSchema).min(1).max(30),
});

export type BasketSummary = {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BasketDetail = BasketSummary & {
  items: { commodityId: string; commodityName: string; quantity: number }[];
};
