# app.py
# FastAPI server that accepts React form JSON and returns the model evaluation.

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn

# Import the in-memory model pipeline
from .model import predict_from_user_payload, load_artifacts

app = FastAPI(title="Credit Scoring API", version="1.0")

# CORS (loosen for local dev; tighten in prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # e.g., ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # Load pretrained model + preprocessors into memory
    load_artifacts()

# ----- Schema expected from React form -----
class ScoreRequest(BaseModel):
    income_monthly: float = Field(..., ge=0)
    housing_cost_monthly: float = Field(..., ge=0)
    other_expenses_monthly: float = Field(0, ge=0)
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

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/score")
def score(req: ScoreRequest):
    try:
        payload = req.model_dump()
        result = predict_from_user_payload(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
