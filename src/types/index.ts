/**
 * Shared domain types, mirroring DATABASE_SCHEMA.md and, since Phase 5,
 * the real Express API responses in server/src/schemas/*.ts exactly
 * (including nullable columns coming back as `null`, not `undefined`).
 * `PriceType` is an intentional extension over the schema doc — see
 * data/reports/CLEANING_CHANGELOG.md for why wholesale/retail must stay
 * distinct.
 */
export type PriceType = "Wholesale" | "Retail";

/**
 * The 4 categories present in data/ghana_food_prices_clean.csv (verified via
 * data/scripts/01_inspect_structure.py — commodity always maps 1:1 to
 * exactly one of these). Keep this as the single source of truth rather
 * than re-typing the literals elsewhere.
 */
export const CATEGORY_VALUES = [
  "cereals and tubers",
  "vegetables and fruits",
  "meat, fish and eggs",
  "pulses and nuts",
] as const;
export type Category = (typeof CATEGORY_VALUES)[number];

export type Market = {
  id: string;
  name: string;
  region: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Commodity = {
  id: string;
  name: string;
  category: Category;
  unit?: string;
};

export type PricePoint = {
  id: string;
  commodityId: string;
  marketId: string;
  date: string; // ISO YYYY-MM-DD
  price: number;
  priceType: PriceType;
  currency: string;
  unit: string;
  unitQuantity: number;
  unitMeasure: string;
};

/**
 * A real price report from MoFA SRID (Ghana's Ministry of Food and
 * Agriculture) — a second real data source, kept deliberately separate from
 * PricePoint/`prices`. Unlike PricePoint, there is no unit — MoFA's export
 * has no documented unit for its prices, and a spot-check against the
 * WFP-derived series showed the two aren't reliably comparable. Never plot
 * this alongside PricePoint data or treat it as the same series; always
 * show `source` so the UI can label it "as reported, unit not specified".
 * See data/reports/MOFA_CLEANING_CHANGELOG.md.
 */
export type CommunityPricePoint = {
  id: string;
  commodityId: string;
  marketId: string;
  date: string; // ISO YYYY-MM-DD
  price: number;
  priceType: PriceType;
  currency: string;
  source: string;
};

export type PredictionPoint = {
  id: string;
  commodityId: string;
  marketId: string;
  predictionDate: string; // ISO YYYY-MM-DD
  predictedPrice: number;
  modelName: string | null;
  createdAt: string; // ISO datetime
};

/** A real, server-cached article from GNews (Ghana food/agriculture news) — see server/src/lib/news-client.ts. */
export type NewsArticle = {
  title: string;
  description: string | null;
  url: string;
  image: string | null;
  publishedAt: string; // ISO datetime
  sourceName: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
};
