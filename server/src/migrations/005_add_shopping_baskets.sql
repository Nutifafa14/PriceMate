-- Saved shopping lists for the Basket Optimiser (server/src/lib/basket-optimizer.ts).
-- One basket per named list; items reference a commodity + a quantity in
-- that commodity's own comparable unit (kg for weight-priced commodities,
-- otherwise the commodity's own standard unit — see basket-optimizer.ts's
-- module comment for the full reasoning).
CREATE TABLE shopping_baskets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shopping_basket_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id UUID NOT NULL REFERENCES shopping_baskets (id) ON DELETE CASCADE,
  commodity_id UUID NOT NULL REFERENCES commodities (id) ON DELETE CASCADE,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  UNIQUE (basket_id, commodity_id)
);

CREATE INDEX idx_shopping_baskets_user ON shopping_baskets (user_id);
CREATE INDEX idx_shopping_basket_items_basket ON shopping_basket_items (basket_id);
