import type { CommoditySeasonality } from "@/data/seasonality";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthClassification = "harvest" | "lean" | "neutral";

/** A month counts as "harvest" if any region harvests then, else "lean" if any region's lean season covers it, else "neutral". */
export function classifyMonth(
  seasonality: CommoditySeasonality | undefined,
  month: number,
): MonthClassification {
  if (!seasonality) return "neutral";
  if (seasonality.windows.some((w) => w.harvestMonths.includes(month))) return "harvest";
  if (seasonality.leanMonths?.some((l) => l.months.includes(month))) return "lean";
  return "neutral";
}

function formatMonths(months: number[]): string {
  return months.map((m) => MONTH_ABBR[m - 1]).join("/");
}

/** A short, plain-language summary of a commodity's real, sourced season pattern — built from the data, not hand-written per commodity. */
export function seasonalitySummary(seasonality: CommoditySeasonality): string {
  const byRegion = new Map<string, string[]>();
  for (const w of seasonality.windows) {
    const list = byRegion.get(w.region) ?? [];
    const qualifier = w.label.replace(/harvest/i, "").trim();
    list.push(
      qualifier
        ? `${formatMonths(w.harvestMonths)} (${qualifier.toLowerCase()})`
        : formatMonths(w.harvestMonths),
    );
    byRegion.set(w.region, list);
  }
  const harvestParts = [...byRegion.entries()].map(
    ([region, windows]) => `${windows.join(" and ")} in ${region}`,
  );
  let summary = `Typically harvested ${harvestParts.join(", and ")} — prices are often lower around these times.`;

  if (seasonality.leanMonths?.length) {
    const leanParts = seasonality.leanMonths.map((l) => `${formatMonths(l.months)} in ${l.region}`);
    summary += ` The lean season (${leanParts.join(", ")}) typically sees higher prices as stored supply runs low.`;
  }

  return summary;
}
