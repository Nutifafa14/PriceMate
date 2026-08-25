"""
Future price forecasting model.

Uses a Random Forest baseline together with a controlled historical
trend adjustment for years beyond the historical dataset.

Historical data: 2015–2023
Future estimates: 2024 onward
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder

from src.data import load_wholesale_prices


MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
FORECAST_MODEL_PATH = MODELS_DIR / "future_forecast.json"

HISTORICAL_END_YEAR = 2023


def fit_forecast_model(df: pd.DataFrame) -> dict:
    """
    Train a Random Forest on the historical wholesale-price data.

    The model learns:
    - commodity
    - market
    - unit_type
    - quantity
    - year
    - month seasonality

    A controlled yearly trend adjustment is calculated from the historical
    data and capped so that future estimates do not explode unrealistically.
    """

    df = df.copy()

    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month

    df = df.dropna(subset=["price"])
    df = df[df["price"] > 0]

    # Seasonal features
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

    # Same trend feature used by the main Random Forest model
    start_year = int(df["year"].min())
    df["years_since_start"] = df["year"] - start_year

    features = [
        "commodity",
        "market",
        "unit_type",
        "year",
        "month_sin",
        "month_cos",
        "years_since_start",
        "quantity",
    ]

    categorical = ["commodity", "market", "unit_type"]
    numeric = [
        "year",
        "month_sin",
        "month_cos",
        "years_since_start",
        "quantity",
    ]

    encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)

    categorical_data = encoder.fit_transform(df[categorical])

    X = np.column_stack(
        [
            categorical_data,
            df[numeric].to_numpy(dtype=float),
        ]
    )

    y = df["price"].to_numpy(dtype=float)

    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
        min_samples_leaf=3,
    )

    model.fit(X, y)

    # ---------------------------------------------------------
    # Calculate the overall historical annual price trend.
    # ---------------------------------------------------------

    yearly = (
        df.groupby("year")["price"]
        .median()
        .sort_index()
    )

    trend_rates = []

    for previous_year, current_year in zip(
        yearly.index[:-1],
        yearly.index[1:],
    ):
        previous_price = float(yearly.loc[previous_year])
        current_price = float(yearly.loc[current_year])

        if previous_price > 0:
            rate = (current_price / previous_price) - 1
            trend_rates.append(rate)

    if trend_rates:
        median_trend = float(np.median(trend_rates))
    else:
        median_trend = 0.0

    # Prevent the historical trend from becoming an extreme
    # exponential increase/decrease.
    median_trend = float(np.clip(median_trend, -0.15, 0.15))

    return {
        "start_year": start_year,
        "historical_end_year": HISTORICAL_END_YEAR,
        "trend_rate": median_trend,
        "model": model,
        "encoder": encoder,
        "features": features,
    }


def predict_price(
    forecast_model: dict,
    commodity: str,
    market: str,
    unit_type: str,
    quantity: float,
    month: int,
    year: int,
) -> float:
    """
    Produces a future price estimate.

    The Random Forest provides the baseline estimate.
    For years after the historical dataset, a controlled trend adjustment
    is applied relative to the final historical year.
    """

    month_sin = np.sin(2 * np.pi * month / 12)
    month_cos = np.cos(2 * np.pi * month / 12)

    years_since_start = year - forecast_model["start_year"]

    row = pd.DataFrame(
        [
            {
                "commodity": commodity,
                "market": market,
                "unit_type": unit_type,
                "quantity": quantity,
                "year": year,
                "month_sin": month_sin,
                "month_cos": month_cos,
                "years_since_start": years_since_start,
            }
        ]
    )

    categorical_data = forecast_model["encoder"].transform(
        row[["commodity", "market", "unit_type"]]
    )

    X = np.column_stack(
        [
            categorical_data,
            row[
                [
                    "year",
                    "month_sin",
                    "month_cos",
                    "years_since_start",
                    "quantity",
                ]
            ].to_numpy(dtype=float),
        ]
    )

    baseline = float(forecast_model["model"].predict(X)[0])

    if year <= forecast_model["historical_end_year"]:
        return baseline

    years_forward = year - forecast_model["historical_end_year"]

    trend_rate = forecast_model["trend_rate"]

    # Controlled compounding.
    adjustment = (1 + trend_rate) ** years_forward

    predicted = baseline * adjustment

    return float(max(predicted, 0))


def backtest_forecast(df: pd.DataFrame) -> None:
    """
    Tests future predictions by pretending that later historical years
    were unknown.
    """

    print("\n=== FUTURE FORECAST BACKTEST ===")

    cutoff_years = [2020, 2021, 2022]

    for cutoff in cutoff_years:

        train = df[df["date"].dt.year <= cutoff].copy()
        actual = df[df["date"].dt.year > cutoff].copy()

        if actual.empty:
            continue

        forecast_model = fit_forecast_model(train)

        predictions = []
        actual_prices = []

        for _, row in actual.iterrows():

            try:
                predicted = predict_price(
                    forecast_model,
                    row["commodity"],
                    row["market"],
                    row["unit_type"],
                    float(row["quantity"]),
                    int(row["date"].month),
                    int(row["date"].year),
                )

                predictions.append(predicted)
                actual_prices.append(float(row["price"]))

            except Exception:
                continue

        if not predictions:
            print(f"{cutoff}: No predictions available")
            continue

        predictions = np.array(predictions)
        actual_prices = np.array(actual_prices)

        mae = np.mean(np.abs(actual_prices - predictions))
        rmse = np.sqrt(
            np.mean((actual_prices - predictions) ** 2)
        )

        print(
            f"Train through {cutoff} → "
            f"Forecast {cutoff + 1} onward | "
            f"n={len(predictions)} | "
            f"MAE=GH₵{mae:.2f} | "
            f"RMSE=GH₵{rmse:.2f}"
        )


def save_forecast_model(forecast_model: dict) -> None:
    """
    Saves the forecast model metadata.

    The actual Random Forest and encoder are stored separately using joblib.
    """

    import joblib

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODELS_DIR / "future_forecast_model.joblib"

    joblib.dump(
        {
            "model": forecast_model["model"],
            "encoder": forecast_model["encoder"],
        },
        model_path,
    )

    metadata = {
        "start_year": forecast_model["start_year"],
        "historical_end_year": forecast_model["historical_end_year"],
        "trend_rate": forecast_model["trend_rate"],
    }

    FORECAST_MODEL_PATH.write_text(
        json.dumps(metadata, indent=2)
    )

    print(
        f"Saved future forecast model to {model_path}"
    )

    print(
        f"Saved forecast metadata to {FORECAST_MODEL_PATH}"
    )


def main() -> None:

    df = load_wholesale_prices()

    # Backtest first.
    backtest_forecast(df)

    # Train final model on all available historical data.
    forecast_model = fit_forecast_model(df)

    save_forecast_model(forecast_model)


if __name__ == "__main__":
    main()