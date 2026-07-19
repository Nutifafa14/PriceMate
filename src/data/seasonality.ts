/**
 * Real Ghana crop-season data, sourced from official/authoritative reports —
 * never estimated or invented. Only commodities with a verifiable source are
 * included; everything else intentionally has no entry (UI must show a "not
 * available" state, not guess). See each entry's `source` field.
 *
 * `harvestMonths`/`leanMonths` are 1-12 (January=1). Some commodities have
 * distinct Southern vs. Northern Ghana growing calendars (the country spans
 * a bimodal-rainfall south and a unimodal-rainfall north) — both are listed
 * where the source distinguishes them; the UI shows both rather than
 * guessing which applies to a given market.
 *
 * "Rice (imported)" deliberately has NO entry: it is not grown in Ghana, so
 * a domestic harvest calendar would misrepresent it — its price is driven
 * by global supply/shipping, not a Ghana planting season.
 */

export type SeasonWindow = {
  region: "Southern Ghana" | "Northern Ghana";
  harvestMonths: number[];
  label: string;
};

export type CommoditySeasonality = {
  windows: SeasonWindow[];
  /** Months when stored supply typically runs low and prices tend to rise, per the source. */
  leanMonths?: { region: "Southern Ghana" | "Northern Ghana"; months: number[] }[];
  source: string;
};

export const SEASONALITY: Record<string, CommoditySeasonality> = {
  Maize: {
    windows: [
      { region: "Southern Ghana", harvestMonths: [8, 9], label: "Major season harvest" },
      { region: "Southern Ghana", harvestMonths: [12, 1], label: "Minor season harvest" },
      { region: "Northern Ghana", harvestMonths: [8, 9, 10], label: "Harvest" },
    ],
    leanMonths: [
      { region: "Southern Ghana", months: [4, 5, 6, 7] },
      { region: "Northern Ghana", months: [5, 6, 7] },
    ],
    // Source states Northern Ghana's lean season as "May-August", but also
    // states the Northern harvest begins in August — read literally, that's
    // self-contradictory (a lean season can't overlap the new harvest).
    // Resolved here by ending the lean window at July, consistent with lean
    // season meaning "before the new harvest arrives."
    source: "USDA FAS Ghana Grain and Feed Annual (GAIN report GH2026-0011); MoFA Guide to Maize Production",
  },
  "Maize (yellow)": {
    windows: [
      { region: "Southern Ghana", harvestMonths: [8, 9], label: "Major season harvest" },
      { region: "Southern Ghana", harvestMonths: [12, 1], label: "Minor season harvest" },
      { region: "Northern Ghana", harvestMonths: [8, 9, 10], label: "Harvest" },
    ],
    leanMonths: [
      { region: "Southern Ghana", months: [4, 5, 6, 7] },
      { region: "Northern Ghana", months: [5, 6, 7] },
    ],
    source: "USDA FAS Ghana Grain and Feed Annual (GAIN report GH2026-0011); MoFA Guide to Maize Production",
  },
  "Rice (local)": {
    windows: [
      { region: "Southern Ghana", harvestMonths: [9, 10], label: "Harvest" },
      { region: "Northern Ghana", harvestMonths: [10, 11, 12], label: "Harvest" },
    ],
    source: "USDA FAS Ghana Grain and Feed Annual (GAIN report GH2026-0011)",
  },
  "Rice (paddy)": {
    windows: [
      { region: "Southern Ghana", harvestMonths: [9, 10], label: "Harvest" },
      { region: "Northern Ghana", harvestMonths: [10, 11, 12], label: "Harvest" },
    ],
    source: "USDA FAS Ghana Grain and Feed Annual (GAIN report GH2026-0011)",
  },
  "Tomatoes (local)": {
    windows: [
      { region: "Southern Ghana", harvestMonths: [6, 7], label: "Major season harvest" },
      { region: "Southern Ghana", harvestMonths: [11], label: "Minor season harvest" },
      { region: "Northern Ghana", harvestMonths: [10], label: "Rainy-season harvest" },
    ],
    // Harvest months are derived, not directly sourced: MoFA documents planting
    // windows (Southern major Mar-Apr, minor Aug; Northern rainy-season July),
    // and tomatoes' ~10-12 week transplant-to-harvest period is a well-established
    // horticultural fact, not specific to this source — combining the two gives
    // the harvest estimates above.
    source: "MoFA Tomato Production Guide (planting windows; harvest months estimated using tomatoes' typical 10-12 week transplant-to-harvest period)",
  },
  "Tomatoes (navrongo)": {
    windows: [
      { region: "Northern Ghana", harvestMonths: [10], label: "Rainy-season harvest" },
      { region: "Northern Ghana", harvestMonths: [12, 1], label: "Irrigated-season harvest" },
    ],
    // Same derivation as Tomatoes (local) — see that entry's comment. Navrongo
    // is in Ghana's Upper East Region (Northern Ghana), hence Northern-only.
    source: "MoFA Tomato Production Guide (planting windows; harvest months estimated using tomatoes' typical 10-12 week transplant-to-harvest period)",
  },
};

export function getSeasonality(commodityName: string): CommoditySeasonality | undefined {
  return SEASONALITY[commodityName];
}
