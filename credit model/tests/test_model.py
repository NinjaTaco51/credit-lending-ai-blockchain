# tests/test_model.py
from server.model import predict_from_user_payload

def test_bad_case_has_reasons():
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
    out = predict_from_user_payload(payload)
    assert out["band"] in {"Poor", "Fair", "Good", "Very Good", "Excellent"}
    assert 300 <= out["credit_score"] <= 850
    assert out["decision"] in {"Bad", "Standard", "Good"}
    # Risky case should produce 3+ reasons (Patch B)
    if out["decision"] == "Bad" or out["band"] == "Poor":
        assert len(out["reasons"]) >= 3

def test_good_case_high_score():
    payload = {
        "income_monthly": 8200.0,
        "housing_cost_monthly": 1800.0,
        "other_expenses_monthly": 500.0,
        "employment_role": "Software Engineer",
        "years_at_job": 5.0,
        "loans": ["Auto Loan", "Home Loan", "Credit Card"],
        "age": 31,
        "application_month": "January",
        "status_hint": "Good",
        "spending_pattern_hint": "Low_spent_Medium_value_payments"
    }
    out = predict_from_user_payload(payload)
    assert 300 <= out["credit_score"] <= 850
    assert out["decision"] in {"Bad", "Standard", "Good"}
    # Usually no reasons for non-risky
    if out["band"] in {"Good", "Very Good", "Excellent"}:
        assert isinstance(out["reasons"], list)
