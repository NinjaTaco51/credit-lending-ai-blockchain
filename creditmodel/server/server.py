# server.py
# Flask API for your credit-scoring model (model.py)

import logging
from typing import List, Optional

from flask import Flask, request, jsonify
from flask_cors import CORS

# Pydantic for strict request validation
from pydantic import BaseModel, Field, ValidationError

# Import your model pipeline
from model import predict_from_user_payload

# ---------------- Flask setup ----------------
app = Flask(__name__)
CORS(app)  # loosen for local dev; tighten origins in prod

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("server")

# ---------------- Request schema ----------------
class ScoreRequest(BaseModel):
    income_monthly: float = Field(..., ge=0)
    housing_cost_monthly: float = Field(..., ge=0)
    other_expenses_monthly: float = Field(0.0, ge=0)
    employment_role: str
    loans: List[str] = []
    age: float = Field(..., ge=0)
    application_month: Optional[str] = None
    num_credit_cards: int = Field(..., ge=0)
    num_bank_accounts: int = Field(..., ge=0)
    num_loans: int = Field(..., ge=0)
    invested: float = Field(..., ge=0)

    # Optional hints (safe defaults if omitted)
    spending_pattern_hint: Optional[str] = None
    status_hint: Optional[str] = None

# ---------------- Routes ----------------
@app.get("/health")
def health():
    return jsonify({"status": "ok"})

@app.get("/version")
def version():
    # Lightweight metadata to confirm wiring
    return jsonify({
        "service": "credit-scoring-api",
        "framework": "flask",
        "endpoints": ["/health", "/score", "/echo", "/version"],
        "payload_required_keys": [
            "income_monthly", "housing_cost_monthly", "employment_role",
            "years_at_job", "loans", "age"
        ]
    })

@app.post("/echo")
def echo():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 400
    return jsonify({"received": request.get_json()})

@app.post("/score")
def score():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 400

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON body"}), 400

    # Validate with Pydantic
    try:
        req = ScoreRequest(**data)
    except ValidationError as ve:
        # Return field-level validation errors
        return jsonify({"error": "ValidationError", "details": ve.errors()}), 422

    try:
        # Call your model pipeline
        result = predict_from_user_payload(req.model_dump())
        # Ensure it’s JSON serializable
        return jsonify(result)
    except Exception as e:
        log.exception("Scoring error")
        return jsonify({"error": "InternalServerError", "message": str(e)}), 500

# ---------------- Entrypoint ----------------
if __name__ == "__main__":
    # Run directly: python server.py
    # For hot reload in dev, set debug=True (don’t use in prod)
    app.run(host="0.0.0.0", port=8080, debug=True)
