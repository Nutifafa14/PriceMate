-- Tracks which model produced each prediction row — useful once the model
-- in ml/ gets retrained and old vs. new predictions need to be told apart.
ALTER TABLE predictions ADD COLUMN model_name TEXT;
