import { z } from "zod";

// Must stay in sync with src/types/index.ts's CATEGORY_VALUES (app) and the
// commodity_category Postgres enum (src/migrations/001_init.sql).
export const CATEGORY_VALUES = [
  "cereals and tubers",
  "vegetables and fruits",
  "meat, fish and eggs",
  "pulses and nuts",
] as const;

// Must stay in sync with the price_type Postgres enum.
export const PRICE_TYPE_VALUES = ["Wholesale", "Retail"] as const;

export const uuidSchema = z.string().uuid();
export const categorySchema = z.enum(CATEGORY_VALUES);
export const priceTypeSchema = z.enum(PRICE_TYPE_VALUES);
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
