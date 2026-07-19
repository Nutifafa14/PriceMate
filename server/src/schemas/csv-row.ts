import { z } from "zod";

import { categorySchema, isoDateSchema, priceTypeSchema } from "./shared";

// Validates each row of data/ghana_food_prices_clean.csv at the import
// boundary. The CSV was already fully cleaned in Phase 0 (see
// data/reports/CLEANING_CHANGELOG.md) so this is expected to accept every
// row — it exists to catch drift if the CSV is ever regenerated or edited
// without re-running the cleaning pipeline, not to redo that cleaning here.
export const csvRowSchema = z.object({
  country_iso3: z.string().length(3),
  date: isoDateSchema,
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  region: z.string().trim().min(1),
  district: z.string().trim().min(1),
  market: z.string().trim().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  category: categorySchema,
  commodity: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  unit_quantity: z.coerce.number().positive(),
  unit_measure: z.string().trim().min(1),
  price_type: priceTypeSchema,
  currency: z.string().trim().min(1),
  price: z.coerce.number().min(0),
});

export type CsvRow = z.infer<typeof csvRowSchema>;
