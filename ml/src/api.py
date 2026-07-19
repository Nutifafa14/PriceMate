"""
FastAPI prediction service for the wholesale price model trained by
train.py. Loads the persisted pipeline once at startup; does not retrain.

Run: ml/.venv/bin/uvicorn api:app --reload --port 8000   (from ml/src/)
Docs: http://localhost:8000/docs (FastAPI's auto-generated OpenAPI UI)

Called by the Express API's POST /api/predictions (server/src/lib/ml-client.ts).
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

from data import FEATURE_COLUMNS

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_PATH = MODELS_DIR / "price_model.joblib"
METADATA_PATH = MODELS_DIR / "metadata.json"

logger = logging.getLogger("pricemate.ml")

app = FastAPI(title="PriceMate Prediction API", version="1.0.0")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches anything that isn't an intentional HTTPException (a bug, a malformed model
    input) so it never reaches the client as a raw traceback — full detail goes to the
    server log only."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


def _load_artifacts() -> tuple[Any, dict[str, Any]]:
    if not MODEL_PATH.exists() or not METADATA_PATH.exists():
        raise RuntimeError(f"Model artifacts not found at {MODELS_DIR}. Run `python train.py` first.")
    model = joblib.load(MODEL_PATH)
    metadata = json.loads(METADATA_PATH.read_text())
    return model, metadata


# Loaded once at process start (module import), not per-request or via a
# startup event — simpler, and just as effective since a FastAPI/uvicorn
# process only imports this module once.
_model, _metadata = _load_artifacts()


class PredictRequest(BaseModel):
    commodity: str
    market: str
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2015, le=2035)


class PredictResponse(BaseModel):
    commodity: str
    market: str
    month: int
    year: int
    predictedPrice: float
    currency: str = "GHS"
    modelName: str
    predictedAt: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metadata")
def metadata() -> dict[str, Any]:
    return _metadata


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    if body.commodity not in _metadata["commodities"]:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown commodity '{body.commodity}'. This model is trained on Wholesale "
                "prices only — commodities that only have Retail data (e.g. Cowpeas) have no "
                "wholesale model to predict from. See GET /metadata for the supported list."
            ),
        )
    if body.market not in _metadata["markets"]:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown market '{body.market}'. See GET /metadata for the supported list.",
        )

    row = pd.DataFrame(
        [
            {
                "commodity": body.commodity,
                "market": body.market,
                "year": body.year,
                "month_sin": np.sin(2 * np.pi * body.month / 12),
                "month_cos": np.cos(2 * np.pi * body.month / 12),
            }
        ]
    )[FEATURE_COLUMNS]

    predicted_price = float(_model.predict(row)[0])

    return PredictResponse(
        commodity=body.commodity,
        market=body.market,
        month=body.month,
        year=body.year,
        predictedPrice=round(predicted_price, 2),
        modelName=_metadata["model_name"],
        predictedAt=datetime.now(UTC).isoformat(),
    )
