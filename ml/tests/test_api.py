from fastapi.testclient import TestClient

from api import app

client = TestClient(app)


def test_health_returns_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_metadata_lists_known_commodities_and_markets():
    res = client.get("/metadata")
    assert res.status_code == 200
    body = res.json()
    assert len(body["commodities"]) == 25  # Cowpeas excluded — no Wholesale rows
    assert len(body["markets"]) == 20
    assert "Cowpeas" not in body["commodities"]
    assert body["model_name"] in {"linear_regression", "random_forest", "gradient_boosting"}


def test_predict_known_pair_returns_positive_price():
    res = client.post("/predict", json={"commodity": "Maize", "market": "Kumasi", "month": 7, "year": 2023})
    assert res.status_code == 200
    body = res.json()
    assert body["commodity"] == "Maize"
    assert body["market"] == "Kumasi"
    assert body["currency"] == "GHS"
    assert body["predictedPrice"] > 0
    assert "predictedAt" in body


def test_predict_is_deterministic_for_the_same_input():
    payload = {"commodity": "Rice (local)", "market": "Techiman", "month": 3, "year": 2022}
    first = client.post("/predict", json=payload).json()["predictedPrice"]
    second = client.post("/predict", json=payload).json()["predictedPrice"]
    assert first == second


def test_predict_unknown_commodity_returns_422():
    res = client.post("/predict", json={"commodity": "Unobtainium", "market": "Kumasi", "month": 7, "year": 2023})
    assert res.status_code == 422


def test_predict_cowpeas_returns_422_no_wholesale_data():
    res = client.post("/predict", json={"commodity": "Cowpeas", "market": "Obuasi", "month": 7, "year": 2023})
    assert res.status_code == 422
    assert "Cowpeas" in res.json()["detail"] or "commodity" in res.json()["detail"].lower()


def test_predict_unknown_market_returns_422():
    res = client.post("/predict", json={"commodity": "Maize", "market": "Nowhereville", "month": 7, "year": 2023})
    assert res.status_code == 422


def test_predict_month_out_of_range_returns_422():
    res = client.post("/predict", json={"commodity": "Maize", "market": "Kumasi", "month": 13, "year": 2023})
    assert res.status_code == 422


def test_predict_year_below_dataset_range_returns_422():
    res = client.post("/predict", json={"commodity": "Maize", "market": "Kumasi", "month": 7, "year": 1900})
    assert res.status_code == 422


def test_predict_missing_field_returns_422():
    res = client.post("/predict", json={"commodity": "Maize", "market": "Kumasi"})
    assert res.status_code == 422
