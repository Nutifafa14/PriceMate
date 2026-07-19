import { z } from "zod";

import { uuidSchema } from "./shared";

export const predictionQuerySchema = z.object({
  commodityId: uuidSchema.optional(),
  marketId: uuidSchema.optional(),
});

export const createPredictionSchema = z.object({
  commodityId: uuidSchema,
  marketId: uuidSchema,
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2015).max(2035),
});

export type Prediction = {
  id: string;
  commodityId: string;
  marketId: string;
  predictionDate: string;
  predictedPrice: number;
  modelName: string | null;
  createdAt: string;
};
