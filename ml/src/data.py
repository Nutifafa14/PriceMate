"""
Shared data loading and feature engineering for the wholesale price model.
Used by train.py, future_forecast.py and api.py.
"""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder


DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CSV_PATH = DATA_DIR / "ghana_food_prices_clean.csv"

CATEGORICAL_COLUMNS = [
    "commodity",
    "market",
    "unit_type",
]

NUMERIC_COLUMNS = [
    "quantity",
    "year",
    "month_sin",
    "month_cos",
    "years_since_start",
]

FEATURE_COLUMNS = CATEGORICAL_COLUMNS + NUMERIC_COLUMNS
TARGET_COLUMN = "price"


def load_wholesale_prices(
    csv_path: Path = CSV_PATH,
) -> pd.DataFrame:
    """
    Loads the cleaned dataset and keeps Wholesale observations.

    The source CSV already provides unit_quantity (numeric) and
    unit_measure (e.g. "KG", "Tubers") as separate columns, so no
    string parsing of a combined "unit" field is needed here --
    we just rename them into the feature names used throughout
    the rest of the pipeline (quantity / unit_type).
    """
    df = pd.read_csv(csv_path)

    df = df[df["price_type"] == "Wholesale"].copy()

    df["date"] = pd.to_datetime(df["date"])

    df["quantity"] = pd.to_numeric(
        df["unit_quantity"], errors="coerce"
    )

    df["unit_type"] = (
        df["unit_measure"]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    df["price"] = pd.to_numeric(df["price"], errors="coerce")

    df = df.dropna(subset=["price", "quantity"])
    df = df[df["price"] > 0]
    df = df[df["quantity"] > 0]

    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["month"] = df["date"].dt.month

    df["month_sin"] = np.sin(
        2 * np.pi * df["month"] / 12
    )

    df["month_cos"] = np.cos(
        2 * np.pi * df["month"] / 12
    )

    start_year = df["date"].dt.year.min()

    df["years_since_start"] = (
        df["date"].dt.year - start_year
    )

    return df


def build_preprocessor() -> ColumnTransformer:
    """
    Encodes commodity, market and unit type while passing quantity
    and time features through unchanged.
    """
    return ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                CATEGORICAL_COLUMNS,
            ),
            (
                "numeric",
                "passthrough",
                NUMERIC_COLUMNS,
            ),
        ]
    )


def known_categories(
    df: pd.DataFrame,
) -> dict[str, list[str]]:
    return {
        "commodities": sorted(
            df["commodity"].unique().tolist()
        ),
        "markets": sorted(
            df["market"].unique().tolist()
        ),
        "unit_types": sorted(
            df["unit_type"].unique().tolist()
        ),
    }