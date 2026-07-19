import { z } from "zod";

import { isoDateSchema, priceTypeSchema } from "./shared";

// Validates each row of data/mofa_community_prices_clean.csv at the import
// boundary — mirrors csv-row.ts's role for the WFP-derived CSV. See
// data/reports/MOFA_CLEANING_CHANGELOG.md: this data has no unit, so unlike
// csvRowSchema there is no unit/unit_quantity/unit_measure here at all.
export const communityPriceRowSchema = z.object({
  market: z.string().trim().min(1),
  region: z.string().trim().min(1),
  district: z.string().trim().min(1),
  date: isoDateSchema,
  commodity: z.string().trim().min(1),
  price_type: priceTypeSchema,
  price: z.coerce.number().min(0),
  currency: z.string().trim().min(1),
  source: z.string().trim().min(1),
});

export type CommunityPriceRow = z.infer<typeof communityPriceRowSchema>;
