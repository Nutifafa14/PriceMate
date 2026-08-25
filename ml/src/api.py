"""
FastAPI prediction service for the wholesale price model trained by
train.py and the future forecasting model trained by future_forecast.py.

Run from the ml/ directory:
    uvicorn src.api:app --reload --port 8000

Docs:
    http://127.0.0.1:8000/docs
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.data import FEATURE_COLUMNS
from src.future_forecast import predict_price


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

MODEL_PATH = MODELS_DIR / "price_model.joblib"
METADATA_PATH = MODELS_DIR / "metadata.json"
BACKTEST_PATH = MODELS_DIR / "backtest.json"

FUTURE_FORECAST_MODEL_PATH = (
    MODELS_DIR / "future_forecast_model.joblib"
)

FUTURE_FORECAST_METADATA_PATH = (
    MODELS_DIR / "future_forecast.json"
)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

logger = logging.getLogger("pricemate.ml")

app = FastAPI(
    title="PriceMate Prediction API",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """
    Catches unexpected errors so they do not reach the client as
    raw tracebacks. Full details are written to the server log.
    """

    logger.exception(
        "Unhandled error on %s %s",
        request.method,
        request.url.path,
    )

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def _load_artifacts() -> tuple[
    Any,
    dict[str, Any],
    list[dict[str, Any]],
    dict[str, Any],
    dict[str, Any],
]:
    """
    Loads all persisted prediction artifacts.

    Returns:

        model:
            Main historical Random Forest pipeline.

        metadata:
            Metadata for the main historical model.

        backtest:
            Historical model backtest results.

        future_forecast:
            Future forecasting model + its required metadata.

        future_forecast_metadata:
            Metadata describing the future forecasting model.
    """

    required_files = [
        MODEL_PATH,
        METADATA_PATH,
        FUTURE_FORECAST_MODEL_PATH,
        FUTURE_FORECAST_METADATA_PATH,
    ]

    missing_files = [
        str(path)
        for path in required_files
        if not path.exists()
    ]

    if missing_files:
        raise RuntimeError(
            "Model artifacts not found. Missing files:\n"
            + "\n".join(missing_files)
            + "\n\nRun:\n"
            "python src/train.py\n"
            "python src/future_forecast.py"
        )

    # ------------------------------------------------------------------
    # Main historical model
    # ------------------------------------------------------------------

    model = joblib.load(MODEL_PATH)

    metadata = json.loads(
        METADATA_PATH.read_text()
    )

    # ------------------------------------------------------------------
    # Future forecasting model
    # ------------------------------------------------------------------

    # The .joblib file contains:
    #   model
    #   encoder
    #
    # The .json file contains:
    #   start_year
    #   historical_end_year
    #   trend_rate
    #
    # We combine them here so predict_price() receives everything it needs.

    future_forecast = joblib.load(
        FUTURE_FORECAST_MODEL_PATH
    )

    future_forecast_metadata = json.loads(
        FUTURE_FORECAST_METADATA_PATH.read_text()
    )

    future_forecast["start_year"] = (
        future_forecast_metadata["start_year"]
    )

    future_forecast["historical_end_year"] = (
        future_forecast_metadata["historical_end_year"]
    )

    future_forecast["trend_rate"] = (
        future_forecast_metadata["trend_rate"]
    )

    # ------------------------------------------------------------------
    # Backtest
    # ------------------------------------------------------------------

    backtest = (
        json.loads(BACKTEST_PATH.read_text())
        if BACKTEST_PATH.exists()
        else []
    )

    return (
        model,
        metadata,
        backtest,
        future_forecast,
        future_forecast_metadata,
    )


# ---------------------------------------------------------------------------
# Load models once when the API starts
# ---------------------------------------------------------------------------

(
    _model,
    _metadata,
    _backtest,
    _future_forecast,
    _future_forecast_metadata,
) = _load_artifacts()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class PredictRequest(BaseModel):
    commodity: str
    market: str
    unit_type: str
    quantity: float = Field(gt=0)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2015, le=2035)


class PredictResponse(BaseModel):
    commodity: str
    market: str
    unitType: str
    quantity: float
    month: int
    year: int
    predictedPrice: float
    currency: str = "GHS"
    modelName: str
    predictedAt: str


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Metadata endpoint
# ---------------------------------------------------------------------------

@app.get("/metadata")
def metadata() -> dict[str, Any]:
    return _metadata


# ---------------------------------------------------------------------------
# Backtest endpoint
# ---------------------------------------------------------------------------

@app.get("/backtest")
def backtest() -> list[dict[str, Any]]:
    """
    Returns a sample of the chronological test-set predictions
    generated by train.py.
    """

    return _backtest


# ---------------------------------------------------------------------------
# Reload endpoint
# ---------------------------------------------------------------------------

@app.post("/reload")
def reload_artifacts() -> dict[str, str]:
    """
    Reloads all model artifacts from disk without restarting
    the API process.

    Useful after running train.py or future_forecast.py.
    """

    global _model
    global _metadata
    global _backtest
    global _future_forecast
    global _future_forecast_metadata

    try:
        (
            _model,
            _metadata,
            _backtest,
            _future_forecast,
            _future_forecast_metadata,
        ) = _load_artifacts()

    except RuntimeError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    logger.info(
        "Reloaded model artifacts: model=%s trained_at=%s",
        _metadata.get("model_name"),
        _metadata.get("trained_at"),
    )

    return {
        "status": "reloaded",
        "modelName": _metadata["model_name"],
        "trainedAt": _metadata.get(
            "trained_at",
            "unknown",
        ),
    }


# ---------------------------------------------------------------------------
# Prediction endpoint
# ---------------------------------------------------------------------------

@app.post(
    "/predict",
    response_model=PredictResponse,
)
def predict(
    body: PredictRequest,
) -> PredictResponse:

    # ---------------------------------------------------------------
    # Validate commodity
    # ---------------------------------------------------------------

    if body.commodity not in _metadata["commodities"]:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown commodity '{body.commodity}'. "
                "This model is trained on Wholesale prices only. "
                "See GET /metadata for the supported list."
            ),
        )

    # ---------------------------------------------------------------
    # Validate market
    # ---------------------------------------------------------------

    if body.market not in _metadata["markets"]:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown market '{body.market}'. "
                "See GET /metadata for the supported list."
            ),
        )

    # ---------------------------------------------------------------
    # Validate unit_type
    # ---------------------------------------------------------------

    if body.unit_type not in _metadata["unit_types"]:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown unit_type '{body.unit_type}'. "
                "See GET /metadata for the supported list."
            ),
        )

    # ---------------------------------------------------------------
    # Build prediction row
    # ---------------------------------------------------------------

    row = pd.DataFrame(
        [
            {
                "commodity": body.commodity,
                "market": body.market,
                "unit_type": body.unit_type,
                "quantity": body.quantity,
                "year": body.year,
                "years_since_start": body.year - 2015,
                "month_sin": np.sin(
                    2 * np.pi * body.month / 12
                ),
                "month_cos": np.cos(
                    2 * np.pi * body.month / 12
                ),
            }
        ]
    )[FEATURE_COLUMNS]

    # ---------------------------------------------------------------
    # Determine historical cutoff
    # ---------------------------------------------------------------

    historical_end_year = (
        _future_forecast_metadata["historical_end_year"]
    )

    # ---------------------------------------------------------------
    # Historical prediction
    # ---------------------------------------------------------------

    if body.year <= historical_end_year:

        predicted_price = float(
            _model.predict(row)[0]
        )

        model_name = _metadata["model_name"]

    # ---------------------------------------------------------------
    # Future prediction
    # ---------------------------------------------------------------

    else:

        predicted_price = predict_price(
            _future_forecast,
            body.commodity,
            body.market,
            body.unit_type,
            body.quantity,
            body.month,
            body.year,
        )

        model_name = "future_forecast"

    # ---------------------------------------------------------------
    # Return response
    # ---------------------------------------------------------------

    return PredictResponse(
        commodity=body.commodity,
        market=body.market,
        unitType=body.unit_type,
        quantity=body.quantity,
        month=body.month,
        year=body.year,
        predictedPrice=round(
            predicted_price,
            2,
        ),
        modelName=model_name,
        predictedAt=datetime.now(
            UTC
        ).isoformat(),
    )