import { env } from "../env";
import { HttpError } from "./http-error";

export type MlPredictInput = {
  commodity: string;
  market: string;
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
