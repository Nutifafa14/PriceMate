-- Real, dated price reports from a second real data source (MoFA SRID,
-- Ghana's Ministry of Food and Agriculture) that has no documented unit for
-- its prices and is not verified as comparable with the WFP-derived `prices`
-- table's units — see data/reports/MOFA_CLEANING_CHANGELOG.md for the full
-- reasoning. Kept in its own table, deliberately without a unit column
-- (there is none to record), so it can never be silently blended into the
-- wholesale trend chart or the ML training data. `source` is always
-- 'MoFA SRID' today but kept as a column rather than a hardcoded UI string
-- so the app surfaces exactly what backs each row, and a future second
-- community source doesn't need a schema change.
CREATE TABLE community_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id UUID NOT NULL REFERENCES commodities (id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets (id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  price_type price_type NOT NULL,
  currency TEXT NOT NULL,
  source TEXT NOT NULL,
  UNIQUE (commodity_id, market_id, date, price_type, source)
);

CREATE INDEX idx_community_prices_market ON community_prices (market_id);
CREATE INDEX idx_community_prices_commodity ON community_prices (commodity_id);
