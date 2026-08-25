import { env } from "../env";
import { HttpError } from "./http-error";

export type MlPredictInput = {
  commodity: string;
  market: string;
  unit_type: string;
  quantity: number;
  month: number;
  year: number;
};

export type MlPredictResult = {
  predictedPrice: number;
  modelName: string;
};

/**
 * Calls the Phase 4 FastAPI prediction service (ml/src/api.py). Its own
 * 422 (unknown commodity/market — e.g. Cowpeas, which has no Wholesale
 * data) is forwarded as a 422 here rather than a generic 500, since it's a
 * legitimate "can't predict this" response, not a server failure.
 */
export async function predictPrice(input: MlPredictInput): Promise<MlPredictResult> {
  let response: Response;
  try {
    response = await fetch(`${env.mlApiUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new HttpError(502, "Prediction service is unreachable");
  }

  if (response.status === 422) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = body?.detail;
    throw new HttpError(422, typeof detail === "string" ? detail : "Prediction not available for this input");
  }

  if (!response.ok) {
    throw new HttpError(502, `Prediction service returned ${response.status}`);
  }

  const body = (await response.json()) as { predictedPrice: number; modelName: string };
  return { predictedPrice: body.predictedPrice, modelName: body.modelName };
}

export type MlMetadata = {
  modelName: string;
  dateRange: [string, string];
  /** Real chronological-split backtest MAPE per category (ml/src/train.py's `chronological_split` — last 20% of each series' own dates held out, not shuffled). */
  categoryMape: Record<string, number>;
  /** Real feature importances from the fitted model, grouped back to original features and normalized to sum to 1 — undefined for a model/metadata predating this field. */
  featureImportance: Record<string, number> | undefined;
  trainedAt: string | undefined;
  trainedOnRows: number;
};

const METADATA_CACHE_TTL_MS = 60 * 60 * 1000; // 1h — metadata.json only changes when someone retrains; /reload (see below) invalidates this cache immediately instead of waiting out the TTL.
let metadataCache: { value: MlMetadata; fetchedAt: number } | null = null;

function shapeMetadata(body: {
  model_name: string;
  date_range: [string, string];
  category_breakdown: Record<string, { mape: number }>;
  feature_importance?: Record<string, number>;
  trained_at?: string;
  trained_on_rows?: number;
}): MlMetadata {
  return {
    modelName: body.model_name,
    dateRange: body.date_range,
    categoryMape: Object.fromEntries(Object.entries(body.category_breakdown).map(([k, v]) => [k, v.mape])),
    featureImportance: body.feature_importance,
    trainedAt: body.trained_at,
    trainedOnRows: body.trained_on_rows ?? 0,
  };
}

/**
 * Fetches ml/'s GET /metadata (the real backtest results computed by
 * train.py's chronological split, not a synthetic figure) and shapes it
 * into the per-category MAPE the forecast pipeline uses as its uncertainty
 * band, plus feature importance and training provenance. Returns the last
 * good cached value on a transient failure, or undefined if there's no
 * cache yet.
 */
export async function getMlMetadata(): Promise<MlMetadata | undefined> {
  if (metadataCache && Date.now() - metadataCache.fetchedAt < METADATA_CACHE_TTL_MS) {
    return metadataCache.value;
  }
  try {
    const response = await fetch(`${env.mlApiUrl}/metadata`);
    if (!response.ok) return metadataCache?.value;
    const body = (await response.json()) as Parameters<typeof shapeMetadata>[0];
    const value = shapeMetadata(body);
    metadataCache = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return metadataCache?.value;
  }
}

export type BacktestRow = { commodity: string; market: string; date: string; actual: number; predicted: number };

/** A real sample of held-out test-set predictions vs. actual recorded prices — see ml/src/train.py and GET /backtest. */
export async function getBacktestSample(): Promise<BacktestRow[]> {
  try {
    const response = await fetch(`${env.mlApiUrl}/backtest`);
    if (!response.ok) return [];
    return (await response.json()) as BacktestRow[];
  } catch {
    return [];
  }
}

/**
 * Triggers a full retrain (spawns `python train.py` as a child process) then
 * hot-reloads the running ml/ API via POST /reload once it finishes, and
 * invalidates this module's own metadata cache so the next request picks up
 * the fresh values immediately rather than waiting out METADATA_CACHE_TTL_MS.
 * Retraining stays an explicit, on-demand action a user triggers — never an
 * automatic background job — per this app's existing "no CI/CD, changes are
 * reviewed" posture (see DEPLOYMENT.md).
 */
export async function retrainModel(): Promise<{ modelName: string; trainedAt: string }> {
  const { spawn } = await import("node:child_process");
  const path = await import("node:path");

  const mlDir = path.resolve(__dirname, "../../../ml");
  const pythonBin = path.join(mlDir, ".venv", "bin", "python");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(pythonBin, ["src/train.py"], { cwd: mlDir });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`train.py exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });

  const response = await fetch(`${env.mlApiUrl}/reload`, { method: "POST" });
  if (!response.ok) throw new Error(`ml/ reload failed with status ${response.status}`);
  const body = (await response.json()) as { modelName: string; trainedAt: string };

  metadataCache = null;
  return body;
}
