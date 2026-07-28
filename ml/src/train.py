"""
Trains and evaluates a wholesale-price regression model on
data/ghana_food_prices_clean.csv, then persists the winning pipeline to
ml/models/price_model.joblib (+ ml/models/metadata.json).

Usage: ml/.venv/bin/python ml/src/train.py   (run from anywhere — paths are
resolved relative to this file, matching data/scripts/'s convention)

See ml/reports/MODEL_EVALUATION.md for the full methodology writeup.
"""

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline

from data import (
    CATEGORICAL_COLUMNS,
    CSV_PATH,
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    build_preprocessor,
    engineer_features,
    known_categories,
    load_wholesale_prices,
)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_PATH = MODELS_DIR / "price_model.joblib"
METADATA_PATH = MODELS_DIR / "metadata.json"
BACKTEST_PATH = MODELS_DIR / "backtest.json"
MAX_BACKTEST_ROWS = 1000

TEST_FRACTION = 0.2
RANDOM_STATE = 42


def chronological_split(df: pd.DataFrame, test_frac: float = TEST_FRACTION) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Splits each (commodity, market) group by date — the last `test_frac` of
    each group's own points go to test, the rest to train. A single global
    date cutoff was tried first and rejected: it left 43 of the ~450
    (commodity, market) pairs with zero training rows (pairs whose price
    tracking started later than the cutoff), which is a worse evaluation
    setup than this per-group split, not a better one.
    """
    train_parts, test_parts = [], []
    for _, group in df.groupby(["commodity", "market"], sort=False):
        group = group.sort_values("date")
        n_test = max(1, round(len(group) * test_frac))
        train_parts.append(group.iloc[:-n_test])
        test_parts.append(group.iloc[-n_test:])
    train_df = pd.concat(train_parts).reset_index(drop=True)
    test_df = pd.concat(test_parts).reset_index(drop=True)
    return train_df, test_df


def evaluate(y_true, y_pred) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(mean_squared_error(y_true, y_pred) ** 0.5),
        "r2": float(r2_score(y_true, y_pred)),
        "mape": float(mean_absolute_percentage_error(y_true, y_pred)),
    }


def compute_feature_importance(pipeline: Pipeline) -> dict[str, float] | None:
    """
    Groups the fitted model's real importances back to the original
    features (commodity/market's one-hot columns summed into one figure
    each, so the result is interpretable rather than one entry per category
    value). Returns None for a model type with neither `feature_importances_`
    nor `coef_` (neither candidate here lacks both, but this keeps the
    function honest about what it can and can't report rather than
    fabricating a number).
    """
    model = pipeline.named_steps["model"]
    preprocessor = pipeline.named_steps["preprocess"]
    transformed_names = preprocessor.get_feature_names_out()

    if hasattr(model, "feature_importances_"):
        raw = model.feature_importances_
    elif hasattr(model, "coef_"):
        raw = abs(model.coef_)
    else:
        return None

    grouped: dict[str, float] = {col: 0.0 for col in FEATURE_COLUMNS}
    for name, value in zip(transformed_names, raw):
        # transformed names look like "categorical__commodity_Maize" or "numeric__year"
        original = name.split("__", 1)[1]
        matched = next((col for col in CATEGORICAL_COLUMNS if original.startswith(f"{col}_")), None)
        key = matched or original
        grouped[key] = grouped.get(key, 0.0) + float(value)

    total = sum(grouped.values()) or 1.0
    return {k: round(v / total, 4) for k, v in sorted(grouped.items(), key=lambda kv: -kv[1])}


def naive_baseline_predictions(train_df: pd.DataFrame, test_df: pd.DataFrame) -> pd.Series:
    """Predicts each row as its (commodity, market) group's training-set mean price — the bar any real model must clear."""
    group_means = train_df.groupby(["commodity", "market"])[TARGET_COLUMN].mean()
    overall_mean = train_df[TARGET_COLUMN].mean()
    return test_df.apply(
        lambda row: group_means.get((row["commodity"], row["market"]), overall_mean),
        axis=1,
    )


def main() -> None:
    df = engineer_features(load_wholesale_prices())
    train_df, test_df = chronological_split(df)
    print(f"Train rows: {len(train_df)}  Test rows: {len(test_df)}  ({len(test_df) / len(df):.1%} test)")

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df[TARGET_COLUMN]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df[TARGET_COLUMN]

    results: dict[str, dict[str, float]] = {}

    naive_preds = naive_baseline_predictions(train_df, test_df)
    results["naive_group_mean"] = evaluate(y_test, naive_preds)

    candidates = {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=100, random_state=RANDOM_STATE, n_jobs=-1),
        "gradient_boosting": GradientBoostingRegressor(n_estimators=300, random_state=RANDOM_STATE),
    }

    fitted_pipelines: dict[str, Pipeline] = {}
    for name, estimator in candidates.items():
        pipeline = Pipeline([("preprocess", build_preprocessor()), ("model", estimator)])
        pipeline.fit(X_train, y_train)
        preds = pipeline.predict(X_test)
        results[name] = evaluate(y_test, preds)
        fitted_pipelines[name] = pipeline

    for name, metrics in results.items():
        print(
            f"{name:20s} MAE={metrics['mae']:8.2f}  RMSE={metrics['rmse']:8.2f}  "
            f"R2={metrics['r2']:.3f}  MAPE={metrics['mape']:.1%}"
        )

    best_name = min(candidates.keys(), key=lambda n: results[n]["mae"])
    best_pipeline = fitted_pipelines[best_name]
    print(f"\nSelected model: {best_name} (lowest test MAE)")

    best_preds = best_pipeline.predict(X_test)
    category_breakdown: dict[str, dict[str, float]] = {}
    test_with_preds = test_df.assign(_pred=best_preds)
    for category, group in test_with_preds.groupby("category"):
        category_breakdown[category] = evaluate(group[TARGET_COLUMN], group["_pred"])
        print(
            f"  {category:24s} n={len(group):4d}  MAE={category_breakdown[category]['mae']:8.2f}  "
            f"MAPE={category_breakdown[category]['mape']:.1%}"
        )

    feature_importance = compute_feature_importance(best_pipeline)
    if feature_importance:
        print("\nFeature importance:")
        for name, value in feature_importance.items():
            print(f"  {name:12s} {value:.1%}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_pipeline, MODEL_PATH)

    metadata = {
        "model_name": best_name,
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "trained_on_rows": len(df),
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "date_range": [df["date"].min().strftime("%Y-%m-%d"), df["date"].max().strftime("%Y-%m-%d")],
        "metrics": results,
        "category_breakdown": category_breakdown,
        "feature_importance": feature_importance,
        "trained_at": pd.Timestamp.now("UTC").isoformat(),
        **known_categories(df),
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2))
    print(f"Saved model to {MODEL_PATH}")
    print(f"Saved metadata to {METADATA_PATH}")

    # A real predicted-vs-actual sample from the held-out chronological test
    # set (never trained on) — capped and shuffled-then-sorted so the saved
    # sample is spread across commodities/markets rather than just the tail
    # of the dataframe, while staying small enough to ship as a JSON file.
    backtest_sample = test_with_preds.sample(
        n=min(MAX_BACKTEST_ROWS, len(test_with_preds)), random_state=RANDOM_STATE
    ).sort_values(["commodity", "market", "date"])
    backtest_records = [
        {
            "commodity": row["commodity"],
            "market": row["market"],
            "date": row["date"].strftime("%Y-%m-%d"),
            "actual": round(float(row[TARGET_COLUMN]), 2),
            "predicted": round(float(row["_pred"]), 2),
        }
        for _, row in backtest_sample.iterrows()
    ]
    BACKTEST_PATH.write_text(json.dumps(backtest_records))
    print(f"Saved {len(backtest_records)} predicted-vs-actual backtest rows to {BACKTEST_PATH}")


if __name__ == "__main__":
    main()
