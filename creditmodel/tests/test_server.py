# tests/test_server.py
from fastapi.testclient import TestClient
from server.app import app

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"

def test_score_bad_case_returns_reasons():
    payload = {
        "income_monthly": 2500.0,
        "housing_cost_monthly": 1300.0,
        "other_expenses_monthly": 700.0,
        "employment_role": "Retail Clerk",
        "years_at_job": 0.4,
        "loans": ["Payday Loan", "Personal Loan"],
        "age": 24,
        "application_month": "March",
        "status_hint": "Poor",
        "spending_pattern_hint": "High_spent_Large_value_payments"
    }
    r = client.post("/score", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "credit_score" in data and 300 <= data["credit_score"] <= 850
    assert data["band"] in {"Poor","Fair","Good","Very Good","Excellent"}
    if data["decision"] == "Bad" or data["band"] == "Poor":
        assert len(data["reasons"]) >= 3

def test_score_schema_and_types():
    payload = {
        "income_monthly": 5600.0,
        "housing_cost_monthly": 1800.0,
        "other_expenses_monthly": 600.0,
        "employment_role": "Customer Support",
        "years_at_job": 3.0,
        "loans": ["Auto Loan", "Credit-Builder Loan"],
        "age": 35,
        "application_month": "September"
    }
    r = client.post("/score", json=payload)
    assert r.status_code == 200
    data = r.json()
    for k in ["decision","confidence","probabilities","risk_probability","credit_score","band","message","reasons"]:
        assert k in data
    assert isinstance(data["probabilities"], dict)
    assert isinstance(data["reasons"], list)
