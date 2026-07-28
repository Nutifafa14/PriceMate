-- Audit log for the forecast pipeline (server/src/lib/forecast-pipeline.ts):
-- one row per POST /api/predictions call, recording every input and
-- adjustment that produced the returned range — not just the final number.
-- `signals` keeps the full disclosed signal snapshot (FX/benchmark
-- adjustments, coefficients, source freshness) as JSONB so the reasoning
-- behind a specific historical forecast can always be reconstructed, even
-- after live signal values have since moved on.
CREATE TABLE forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES predictions (id) ON DELETE CASCADE,
  commodity_id UUID NOT NULL REFERENCES commodities (id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets (id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  baseline_price NUMERIC(12, 2) NOT NULL,
  central_estimate NUMERIC(12, 2) NOT NULL,
  low_estimate NUMERIC(12, 2) NOT NULL,
  high_estimate NUMERIC(12, 2) NOT NULL,
  confidence_label TEXT NOT NULL,
  category_mape NUMERIC(6, 4),
  signals JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forecast_runs_commodity_market ON forecast_runs (commodity_id, market_id);
CREATE INDEX idx_forecast_runs_created_at ON forecast_runs (created_at);
