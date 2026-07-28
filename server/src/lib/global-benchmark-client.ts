import ExcelJS from "exceljs";

/**
 * Real global commodity benchmark prices, for the 2 of our 26 commodities
 * that actually have one: Maize and Rice. Source: the World Bank's
 * "Pink Sheet" (Commodity Markets historical monthly data), a real, free,
 * monthly-updated spreadsheet — no API key, no rate limit.
 *
 * Every other commodity in this app (Cassava, Yam, Gari, Plantains,
 * Tomatoes, Peppers, Millet, Sorghum, Cowpeas, Soybeans, Eggs, Meat, Fish)
 * has NO real public international benchmark — they're local/regional
 * staples, not internationally traded futures. This module deliberately
 * does not invent one; callers must treat a missing entry in
 * COMMODITY_TO_SERIES as "not applicable," not fall back to a guess.
 */

const PINK_SHEET_URL =
  "https://thedocs.worldbank.org/en/doc/18675f1d1639c7a34d463f59263ba0a2-0050012025/related/CMO-Historical-Data-Monthly.xlsx";

// Column headers in the "Monthly Prices" sheet, row 5 — verified against a
// live download. "Rice, Thai 5%" is the standard white-rice benchmark
// (f.o.b. Bangkok); our "Rice (imported)"/(local)/(paddy) commodities all
// map to it since none are separately benchmarked.
const COMMODITY_TO_SERIES: Record<string, string> = {
  Maize: "Maize",
  "Maize (yellow)": "Maize",
  "Rice (imported)": "Rice, Thai 5%",
  "Rice (local)": "Rice, Thai 5%",
  "Rice (paddy)": "Rice, Thai 5%",
};

export type GlobalBenchmarkSignal = {
  seriesName: string;
  currentValue: number;
  currentPeriod: string; // e.g. "2025M12"
  baselineValue: number;
  baselineLabel: string;
  cumulativeChangePct: number;
  fetchedAt: string;
};

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d — this file is only published monthly.
let workbookCache: { rows: Map<string, Map<string, number>>; fetchedAt: number } | null = null;

/** Parses the Pink Sheet into { seriesName -> { period -> value } }. */
async function fetchAndParse(): Promise<Map<string, Map<string, number>> | undefined> {
  try {
    const response = await fetch(PINK_SHEET_URL);
    if (!response.ok) return undefined;
    const buffer = await response.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Monthly Prices");
    if (!sheet) return undefined;

    const headerRow = sheet.getRow(5);
    const columnBySeries = new Map<string, number>();
    headerRow.eachCell((cell, col) => {
      const name = cell.value?.toString().trim();
      if (name) columnBySeries.set(name, col);
    });

    const result = new Map<string, Map<string, number>>();
    for (const seriesName of new Set(Object.values(COMMODITY_TO_SERIES))) {
      const col = columnBySeries.get(seriesName);
      if (!col) continue;
      const series = new Map<string, number>();
      for (let r = 7; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const period = row.getCell(1).value?.toString();
        const value = row.getCell(col).value;
        if (period && typeof value === "number") series.set(period, value);
      }
      result.set(seriesName, series);
    }
    return result;
  } catch {
    return undefined;
  }
}

/** Formats a "YYYY-MM-DD" date as this file's "YYYYMxx" period key. */
function toPeriodKey(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${year}M${month}`;
}

/**
 * Returns the global benchmark signal for a commodity, or undefined if
 * either this commodity has no real benchmark (most of them) or the live
 * fetch/parse failed with no usable cache — callers must treat undefined
 * as "not applicable" or "unavailable," never substitute a guess.
 */
export async function getGlobalBenchmarkSignal(
  commodityName: string,
  baselineDateIso: string,
): Promise<GlobalBenchmarkSignal | undefined> {
  const seriesName = COMMODITY_TO_SERIES[commodityName];
  if (!seriesName) return undefined;

  if (!workbookCache || Date.now() - workbookCache.fetchedAt > CACHE_TTL_MS) {
    const rows = await fetchAndParse();
    if (rows) workbookCache = { rows, fetchedAt: Date.now() };
  }
  if (!workbookCache) return undefined;

  const series = workbookCache.rows.get(seriesName);
  if (!series || series.size === 0) return undefined;

  const baselinePeriod = toPeriodKey(baselineDateIso);
  const baselineValue = series.get(baselinePeriod);
  if (baselineValue === undefined) return undefined;

  const periods = [...series.keys()].sort();
  const currentPeriod = periods[periods.length - 1];
  const currentValue = series.get(currentPeriod);
  if (currentValue === undefined) return undefined;

  return {
    seriesName,
    currentValue,
    currentPeriod,
    baselineValue,
    baselineLabel: baselinePeriod,
    cumulativeChangePct: ((currentValue - baselineValue) / baselineValue) * 100,
    fetchedAt: new Date(workbookCache.fetchedAt).toISOString(),
  };
}
