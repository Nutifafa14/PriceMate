"""
Shared data loading and feature engineering for the wholesale price model.
Used by both train.py (training/evaluation) and api.py (live inference), so
the exact same transformations are applied in both places.
"""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CSV_PATH = DATA_DIR / "ghana_food_prices_clean.csv"

CATEGORICAL_COLUMNS = ["commodity", "market"]
NUMERIC_COLUMNS = ["year", "month_sin", "month_cos"]
FEATURE_COLUMNS = CATEGORICAL_COLUMNS + NUMERIC_COLUMNS
TARGET_COLUMN = "price"


def load_wholesale_prices(csv_path: Path = CSV_PATH) -> pd.DataFrame:
    """
    Loads data/ghana_food_prices_clean.csv and filters to Wholesale rows —
    the build prompt asks specifically for wholesale price prediction, and
    one commodity (Cowpeas) has no Wholesale rows at all in the cleaned
    dataset, so it is excluded from training as a direct consequence (see
    ml/reports/MODEL_EVALUATION.md).
    """
    df = pd.read_csv(csv_path)
    df = df[df["price_type"] == "Wholesale"].copy()
    df["date"] = pd.to_datetime(df["date"])
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds cyclical month encoding (sin/cos) so December and January are
    numerically adjacent instead of 11 apart, which a raw 1-12 integer would
    imply to a model that has no other notion of cyclicality.
    """
    df = df.copy()
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    return df


def build_preprocessor() -> ColumnTransformer:
    """
    One-hot encodes commodity/market (handle_unknown="ignore" so a market or
    commodity absent from a given training fold doesn't crash inference —
    it just contributes no categorical signal for that row) and passes
    numeric features through unchanged.
    """
    return ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLUMNS),
            ("numeric", "passthrough", NUMERIC_COLUMNS),
        ]
    )


def known_categories(df: pd.DataFrame) -> dict[str, list[str]]:
    """Sorted list of commodities/markets actually present in the training data — used by the API to validate inputs and by /metadata."""
    return {
        "commodities": sorted(df["commodity"].unique().tolist()),
        "markets": sorted(df["market"].unique().tolist()),
    }
