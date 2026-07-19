-- Core schema for markets, commodities, prices, predictions and users.
--
-- Reconciles DATABASE_SCHEMA.md's minimal 4-table sketch with the actual
-- cleaned dataset (data/ghana_food_prices_clean.csv), per ARCHITECTURE.md
-- section 5: markets carry district/lat/long, prices carry a price_type
-- (Wholesale/Retail) plus the unit/unit_quantity/unit_measure triple, since
-- unit is NOT stable per commodity (21 of 26 commodities are sold under more
-- than one unit across markets/dates) and so cannot live on `commodities`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  district TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

CREATE TYPE commodity_category AS ENUM (
  'cereals and tubers',
  'vegetables and fruits',
  'meat, fish and eggs',
  'pulses and nuts'
);

CREATE TABLE commodities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category commodity_category NOT NULL
);

CREATE TYPE price_type AS ENUM ('Wholesale', 'Retail');

CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id UUID NOT NULL REFERENCES commodities (id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets (id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  price_type price_type NOT NULL,
  currency TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_quantity NUMERIC(10, 2) NOT NULL CHECK (unit_quantity > 0),
  unit_measure TEXT NOT NULL,
  UNIQUE (commodity_id, market_id, date, price_type, unit)
);

CREATE INDEX idx_prices_commodity ON prices (commodity_id);
CREATE INDEX idx_prices_market ON prices (market_id);
CREATE INDEX idx_prices_date ON prices (date);

CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id UUID NOT NULL REFERENCES commodities (id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets (id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL,
  predicted_price NUMERIC(12, 2) NOT NULL CHECK (predicted_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_predictions_commodity_market ON predictions (commodity_id, market_id);
