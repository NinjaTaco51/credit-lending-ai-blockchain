# model.py
# End-to-end: train MLP, take user JSON payload, output credit score (300–850) + reasons.

import os, json, warnings
import numpy as np
import pandas as pd
import pickle
import re
import torch
from collections import Counter
from datetime import datetime
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from typing import Tuple, Dict, Any
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import accuracy_score

model = None
# Optional fuzzy fallback
try:
    from rapidfuzz import process, fuzz
    HAVE_FUZZ = True
except Exception:
    HAVE_FUZZ = False

# ───────────────── CONFIG / CONSTANTS ─────────────────
ART_DIR = "artifacts"
os.makedirs(ART_DIR, exist_ok=True)

CLASS_NAMES = ["Poor", "Standard", "Good"]

# Engineered numeric features (appended in select_named)
ENGINEERED_NUMERIC_COLS = [
    "eng_dti", "eng_cash_flow",
    "eng_mix_auto", "eng_mix_home", "eng_mix_payday", "eng_mix_card",
]

# Credit score mapping (300–850)
SCORE_MIN, SCORE_MAX = 300, 850
def probability_to_score(p_default: float, method: str = "linear") -> float:
    p = max(0.0, min(1.0, float(p_default)))
    if method == "linear":
        return SCORE_MAX - (SCORE_MAX - SCORE_MIN) * p  # 0→850, 1→300
    else:
        raise ValueError("Only 'linear' is enabled for now.")

def score_band(score: float) -> str:
    if score < 580: return "Poor"
    if score < 670: return "Fair"
    if score < 740: return "Good"
    if score < 800: return "Very Good"
    return "Excellent"

 # ───────────────── LOAN TYPE NORMALIZATION ─────────────────
CANONICAL_TYPES = [
    "Mortgage Loan",
    "Home Equity Loan",
    "Auto Loan",
    "Student Loan",
    "Personal Loan",
    "Debt Consolidation Loan",
    "Payday Loan",
    "Credit-Builder Loan",
]

# ───────────────── OCCUPATION WEIGHTS ─────────────────
# Risk weights are in [0, 1]. Higher = riskier.
# Keys match your TRAIN/CSV occupation values (e.g., "Lawyer", "Engineer", "_______", etc.)
OCC_RISK = {
    "_______": 0.08,        # neutral/unknown placeholder
    "Lawyer": 0.10,
    "Architect": 0.08,
    "Engineer": 0.06,
    "Scientist": 0.05,
    "Mechanic": 0.12,
    "Accountant": 0.07,
    "Developer": 0.06,
    "Media_Manager": 0.10,
    "Teacher": 0.07,
    "Entrepreneur": 0.14,
    "Doctor": 0.04,
    "Journalist": 0.10,
    "Manager": 0.09,
    "Musician": 0.16,
    "Writer": 0.12,
}

# Global knobs for how strongly occupation affects score
OCC_RULE_MULT   = 0.90   # rule-layer impact; raise to increase occupation influence
OCC_FEATURE_MULT = 2.50  # model feature gain; raise to make the NN “feel” it more

def occupation_risk_value(occ_label: str) -> float:
    """Return a bounded risk weight for an occupation label present in TRAIN CSV."""
    if not isinstance(occ_label, str):
        return OCC_RISK.get("_______", 0.08)
    return float(OCC_RISK.get(occ_label.strip(), OCC_RISK.get("_______", 0.08)))

LOAN_REGEX = {
    "Mortgage Loan":           re.compile(r"\b(mortgage|home\s*loan)\b", re.I),
    "Home Equity Loan":        re.compile(r"\b(home\s*equity)\b", re.I),
    "Auto Loan":               re.compile(r"\b(auto|car|vehicle)\s*loan\b|\b(auto|car)\b", re.I),
    "Student Loan":            re.compile(r"\b(student|education|tuition)\s*loan\b|\bstudent\b", re.I),
    "Personal Loan":           re.compile(r"\b(personal)\s*loan\b|\bpersonal\b", re.I),
    "Debt Consolidation Loan": re.compile(r"\b(debt\s*consol(idation)?)\b|\bconsolidat(e|ion)\b", re.I),
    "Payday Loan":             re.compile(r"\b(pay\s*day|payday)\b", re.I),
    "Credit-Builder Loan":     re.compile(r"\b(credit[-\s]*builder)\b", re.I),
}

IGNORE_PAT = re.compile(r"\b(not\s*specified|unknown|n/?a|none)\b", re.I)

def _fuzzy_canonical(tok, threshold=85):
    if not HAVE_FUZZ:
        return None
    choices = list(LOAN_REGEX.keys())
    best, score, _ = process.extractOne(tok, choices, scorer=fuzz.WRatio)
    return best if score >= threshold else None

def normalize_loan_types(loan_value):
    """
    Accepts: string ("Auto Loan, and Mortgage Loan") or list of strings.
    Returns: (matched_set, unmatched_tokens_list)
    """
    def split_tokens(s):
        parts = re.split(r",|\band\b", str(s), flags=re.I)
        return [p.strip() for p in parts if p and p.strip()]

    if loan_value is None:
        tokens = []
    elif isinstance(loan_value, (list, tuple, set)):
        tokens = []
        for item in loan_value:
            tokens.extend(split_tokens(item))
    else:
        tokens = split_tokens(loan_value)

    matched, unmatched = set(), []
    for tok in tokens:
        if not tok or IGNORE_PAT.search(tok):
            continue
        low = tok.lower()
        found = False
        for canon, rx in LOAN_REGEX.items():
            if rx.search(low):
                matched.add(canon); found = True; break
        if not found and HAVE_FUZZ:
            guess = _fuzzy_canonical(tok)
            if guess:
                matched.add(guess); found = True
        if not found:
            unmatched.append(tok)
    return matched, unmatched

CANONICAL_FLAGS = {
    "Mortgage Loan": "eng_has_mortgage",
    "Home Equity Loan": "eng_has_home_equity",
    "Auto Loan": "eng_has_auto",
    "Student Loan": "eng_has_student",
    "Personal Loan": "eng_has_personal",
    "Debt Consolidation Loan": "eng_has_debt_cons",
    "Payday Loan": "eng_has_payday",
    "Credit-Builder Loan": "eng_has_credit_builder",
}

# ───────────────── OCCUPATION NORMALIZATION ─────────────────
OCCUPATION_MAP = {
    "professional": "Engineer",             # or "Developer" / "Scientist"
    "management": "Manager",
    "sales": "Entrepreneur",                # closest equivalent in dataset
    "administrative": "Accountant",         # white-collar / office type
    "service": "Mechanic",                  # blue-collar or customer service
    "manufacturing": "Mechanic",            # also blue-collar
    "healthcare": "Doctor",
    "education": "Teacher",
    "government": "Lawyer",                 # proxy for civil/official roles
    "self-employed": "Entrepreneur",
    "retired": "_______",                   # special neutral placeholder
    "student": "_______",                   # low experience placeholder
    "other": "Writer"                       # generic catch-all
}

# Hand-tuned occupation risk weights (0 = neutral, higher = riskier)
# Use the dataset-side occupation labels (the values produced by OCCUPATION_MAP).
OCC_RISK = {
    "_______": 0.10,       # neutral / unknown
    "Engineer": 0.05,
    "Developer": 0.05,
    "Scientist": 0.05,
    "Accountant": 0.08,
    "Teacher": 0.07,
    "Doctor": 0.04,
    "Lawyer": 0.07,
    "Architect": 0.06,
    "Manager": 0.08,
    "Entrepreneur": 0.12,
    "Journalist": 0.10,
    "Musician": 0.14,
    "Writer": 0.10,
    "Mechanic": 0.11,
    "Media_Manager": 0.09,
}

def occupation_risk_value(occ_label: str) -> float:
    return float(OCC_RISK.get(str(occ_label).strip(), OCC_RISK["_______"]))


def loan_flags_from_series(type_of_loan_series: pd.Series) -> pd.DataFrame:
    """
    For each row, parse the normalized Type_of_Loan string and emit 0/1 flags per canonical type
    plus a couple of counts that are often predictive.
    """
    flags = {v: [] for v in CANONICAL_FLAGS.values()}
    counts_all, counts_risky = [], []

    for val in type_of_loan_series.astype(str):
        matched, _ = normalize_loan_types(val)
        present = set(matched)
        for canon, col in CANONICAL_FLAGS.items():
            flags[col].append(1.0 if canon in present else 0.0)
        counts_all.append(float(len(present)))
        # define “risky” bucket; tweak as you like
        risky = {"Payday Loan", "Debt Consolidation Loan"}
        counts_risky.append(float(len(present & risky)))

    out = pd.DataFrame(flags, index=type_of_loan_series.index)
    out["eng_loan_count"] = counts_all
    out["eng_risky_loan_count"] = counts_risky
    return out

# ───────────────── TRAIN / TEST METADATA FOR INFERENCE ─────────────────
TARGET_COL = "Credit_Score"

TRAIN_COLUMNS = [
    'ID', 
    'Customer_ID', 
    'Month', 
    'Name', 
    'Age', 
    'SSN', 
    'Occupation', 
    'Annual_Income', 
    'Monthly_Inhand_Salary', 
    'Num_Bank_Accounts', 
    'Num_Credit_Card', 
    'Interest_Rate', 
    'Num_of_Loan', 
    'Type_of_Loan', 
    'Delay_from_due_date', 
    'Num_of_Delayed_Payment', 
    'Changed_Credit_Limit', 
    'Num_Credit_Inquiries', 
    'Credit_Mix', 
    'Outstanding_Debt', 
    'Credit_Utilization_Ratio', 
    'Credit_History_Age', 
    'Payment_of_Min_Amount', 
    'Total_EMI_per_month', 
    'Amount_invested_monthly', 
    'Payment_Behaviour', 
    'Monthly_Balance', 
]

# 2) Globals used at inference time.
#    They start as lightweight placeholders and are populated by load_pickle_bundle().
ohe = None              # OneHotEncoder (loaded from pickle)
scaler = None           # StandardScaler (loaded from pickle)
NUM_COLS_FIT = []       # type: list[str]
CAT_COLS_FIT = []       # type: list[str]


class MLP(nn.Module):
    def __init__(self, in_dim, hidden=(128, 64), p=0.2, n_classes=3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden[0]), nn.ReLU(), nn.BatchNorm1d(hidden[0]), nn.Dropout(p),
            nn.Linear(hidden[0], hidden[1]), nn.ReLU(), nn.BatchNorm1d(hidden[1]), nn.Dropout(p),
            nn.Linear(hidden[1], n_classes)
        )
    def forward(self, x): return self.net(x)


# ────────────────────────────────────────────────
# ARTIFACT SAVE / LOAD HELPERS
# ────────────────────────────────────────────────

import joblib

BUNDLE_PATH = os.path.join(ART_DIR, "model_bundle.pkl")

def save_pickle_bundle(model, ohe, scaler, num_cols, cat_cols):
    """
    Optional: store everything in one pickle file.
    """
    bundle = {
        "state_dict": model.state_dict(),
        "class_names": CLASS_NAMES,
        "num_cols": list(num_cols),
        "cat_cols": list(cat_cols),
        "ohe": ohe,
        "scaler": scaler,
    }
    with open(BUNDLE_PATH, "wb") as f:
        pickle.dump(bundle, f)

    print("✔ Saved full model bundle to", BUNDLE_PATH)

def load_pickle_bundle(device: str = "cpu"):
    """
    Alternative to load_artifacts(): load everything from a single pickle file.
    """
    global model, ohe, scaler, CLASS_NAMES, NUM_COLS_FIT, CAT_COLS_FIT

    with open(BUNDLE_PATH, "rb") as f:
        bundle = pickle.load(f)

    CLASS_NAMES  = bundle["class_names"]
    NUM_COLS_FIT = bundle["num_cols"]
    CAT_COLS_FIT = bundle["cat_cols"]
    ohe          = bundle["ohe"]
    scaler       = bundle["scaler"]

    # rebuild model
    try:
        ohe_feature_count = len(ohe.get_feature_names_out())
    except Exception:
        ohe_feature_count = ohe.transform(
            pd.DataFrame({c: ["DUMMY"] for c in CAT_COLS_FIT})
        ).shape[1]

    in_dim = len(NUM_COLS_FIT) + ohe_feature_count
    model = MLP(in_dim=in_dim, n_classes=len(CLASS_NAMES))
    model.load_state_dict(bundle["state_dict"])
    model.to(device)
    model.eval()

    print("✔ Loaded full model bundle from", BUNDLE_PATH)

def split_num_cat(df: pd.DataFrame):
    """
    Split a DataFrame into numeric and non-numeric (categorical) parts.

    Returns:
        num_df: DataFrame with only numeric columns
        cat_df: DataFrame with only non-numeric columns
    """
    num_df = df.select_dtypes(include=[np.number]).copy()
    cat_df = df.select_dtypes(exclude=[np.number]).copy()
    return num_df, cat_df

def rule_risk_from_df(df: pd.DataFrame) -> float:
    row = df.iloc[0]

    income = float(row.get("income_monthly", 0) or 0)
    housing = float(row.get("housing_cost_monthly", 0) or 0)
    other = float(row.get("other_expenses_monthly", 0) or 0)
    num_loans = float(row.get("num_loans", 0) or 0)
    num_credit_cards = float(row.get("num_credit_cards", 0) or 0)

    total_expenses = housing + other
    dti = total_expenses / max(income, 1.0)

    loan_factor = min(num_loans / 10.0, 1.0)
    card_factor = min(num_credit_cards / 10.0, 1.0)

    risk = 0.6 * dti + 0.25 * loan_factor + 0.15 * card_factor
    return float(np.clip(risk, 0.0, 1.0))

# ───────────────── EXPLANATION (optional via Captum) ─────────────────
def try_import_captum():
    try:
        from captum.attr import IntegratedGradients
        return IntegratedGradients
    except Exception:
        return None
def fallback_reasons_dynamic(df: pd.DataFrame, top_k: int = 4):
    """
    Rule-based reasons using CSV headers. Works even if Captum fails or is absent.
    """
    reasons = []
    row = df.iloc[0]

    # Numeric pulls (coerce safely)
    inc = pd.to_numeric(row.get("Monthly_Inhand_Salary"), errors="coerce")
    emi = pd.to_numeric(row.get("Total_EMI_per_month"), errors="coerce")
    inv = pd.to_numeric(row.get("Amount_invested_monthly"), errors="coerce")
    util = pd.to_numeric(row.get("Credit_Utilization_Ratio"), errors="coerce")
    debt = pd.to_numeric(row.get("Outstanding_Debt"), errors="coerce")

    # Cash flow
    if pd.notna(inc) and pd.notna(emi) and pd.notna(inv):
        cash_flow = inc - (emi + inv)
        if cash_flow < 0:
            reasons.append("Negative monthly cash flow (expenses exceed income).")

    # Monthly burden & DTI (uses only what the user would normally provide)
    if pd.notna(inc) and inc > 0:
        if pd.notna(emi):
            burden = emi / inc
            if burden >= 0.5:
                reasons.append("High monthly burden relative to income (EMI/income).")
        if pd.notna(inv):
            dti_m = ((emi or 0.0) + (inv or 0.0)) / inc
            if dti_m >= 0.5:
                reasons.append("High debt-to-income ratio (monthly).")

    # Utilization (if present)
    if pd.notna(util) and util >= 0.6:
        reasons.append("High credit utilization ratio.")

    # Heuristics from categoricals
    credit_mix = str(row.get("Credit_Mix", "")).strip().lower()
    if credit_mix == "poor":
        reasons.append("Bureau-reported credit mix indicates elevated risk.")

    behaviour = str(row.get("Payment_Behaviour", "")).lower()
    if "high_spent" in behaviour:
        reasons.append("High spending pattern relative to income.")

    loan_types = str(row.get("Type_of_Loan", "")).lower()
    if "payday" in loan_types or "short-term" in loan_types:
        reasons.append("Recent or frequent payday/short-term loans.")

    # De-dup + cap
    out, seen = [], set()
    for r in reasons:
        if r not in seen:
            out.append(r); seen.add(r)
        if len(out) >= top_k:
            break

    if not out:
        out = [
            "Unfavorable income-to-expense balance.",
            "Insufficient verified credit history.",
            "Additional documentation required to assess affordability.",
        ][:top_k]
    return out

def summarize_reasons(row_df: pd.DataFrame, top_k: int = 4):
    """
    Model-agnostic, column-agnostic reason generator.
    It derives interpretable signals directly from the input row (no reliance on
    fitted column orders or OHE feature names). Returns top_k reason strings.
    """
    row = row_df.iloc[0]

    # Safe pulls
    inc  = pd.to_numeric(row.get("Monthly_Inhand_Salary"), errors="coerce")
    emi  = pd.to_numeric(row.get("Total_EMI_per_month"), errors="coerce")
    inv  = pd.to_numeric(row.get("Amount_invested_monthly"), errors="coerce")
    util = pd.to_numeric(row.get("Credit_Utilization_Ratio"), errors="coerce")
    debt = pd.to_numeric(row.get("Outstanding_Debt"), errors="coerce")

    n_acc   = pd.to_numeric(row.get("Num_Bank_Accounts"), errors="coerce")
    n_cc    = pd.to_numeric(row.get("Num_Credit_Card"), errors="coerce")
    n_loans = pd.to_numeric(row.get("Num_of_Loan"), errors="coerce")

    credit_mix = str(row.get("Credit_Mix", "")).strip().lower()
    behaviour  = str(row.get("Payment_Behaviour", "")).lower()
    tol_raw    = row.get("Type_of_Loan", "")

    # Helper to push a (score, text) entry if score > 0
    reasons_scored = []
    def add(score, text):
        s = float(max(0.0, min(1.0, score)))
        if s > 0:
            reasons_scored.append((s, text))

    # ---- Burden / DTI ----
    if pd.notna(inc) and inc > 0 and pd.notna(emi):
        burden = float(emi) / float(inc)
        # scale: 0 at 0.3 → 1 at 0.9+
        add(np.clip((burden - 0.3) / 0.6, 0.0, 1.0),
            "High monthly payment burden relative to income (EMI/income).")
    else:
        add(0.7, "Income information is missing/zero, increasing uncertainty and risk.")

    if pd.notna(inc) and pd.notna(emi) and pd.notna(inv) and inc > 0:
        dti_m = (float(emi) + float(inv)) / float(inc)
        add(np.clip((dti_m - 0.3) / 0.6, 0.0, 1.0),
            "Elevated monthly debt-to-income ratio.")

    # ---- Cash flow ----
    if pd.notna(inc) and pd.notna(emi) and pd.notna(inv):
        cash_flow = float(inc) - (float(emi) + float(inv))
        add(0.9 if cash_flow < 0 else (0.6 if cash_flow < 300 else 0.0),
            "Weak monthly cash flow after obligations.")

    # ---- Utilization ----
    if pd.notna(util):
        add(np.clip((float(util) - 0.3) / 0.5, 0.0, 1.0),
            "High credit utilization ratio.")

    # ---- Loan types (normalized) ----
    matched_types, _ = normalize_loan_types(tol_raw)
    type_penalties = {
        "Payday Loan":              0.35,
        "Debt Consolidation Loan":  0.15,
        "Personal Loan":            0.08,
        "Student Loan":             0.05,
        "Auto Loan":                0.04,
        "Home Equity Loan":         0.03,
        "Mortgage Loan":            0.02,
        "Credit-Builder Loan":      0.00,
    }
    if matched_types:
        loan_risk = min(0.5, sum(type_penalties.get(t, 0.05) for t in matched_types))
        # Build a readable phrase of risky types first
        sorted_types = sorted(matched_types, key=lambda t: type_penalties.get(t, 0.05), reverse=True)
        add(loan_risk, f"Loan portfolio includes higher-risk products: {', '.join(sorted_types)}.")

    # ---- Behaviour / Mix ----
    if "high_spent" in behaviour:
        add(0.6, "Spending pattern indicates high outflows relative to income.")
    if credit_mix in {"bad", "poor"}:
        add(0.7, "Reported credit mix is unfavorable.")

    # ---- Debt level ----
    if pd.notna(debt):
        add(np.clip(float(debt) / 15000.0, 0.0, 1.0),
            "High outstanding debt relative to heuristic threshold.")

    # ---- Counts (accounts/cards/loans) ----
    if pd.notna(n_acc):
        if n_acc <= 0:
            add(0.3, "Very thin banking profile (no bank accounts).")
        elif n_acc >= 9:
            add(0.2, "Many bank accounts may add complexity to obligations.")
    if pd.notna(n_cc):
        if n_cc >= 8:
            add(0.45, "Many credit cards may indicate elevated revolving exposure.")
        elif n_cc >= 5:
            add(0.30, "Several credit cards increase potential utilization/inquiries.")
        elif n_cc == 0:
            add(0.15, "No credit cards: thin revolving history.")
    if pd.notna(n_loans):
        if n_loans >= 6:
            add(0.65, "Many concurrent loans increase affordability pressure.")
        elif n_loans >= 4:
            add(0.40, "Multiple concurrent loans increase affordability pressure.")
        elif n_loans == 0:
            add(0.08, "No active loans: limited installment credit history.")

    # Rank by score, then de-duplicate by message
    reasons_scored.sort(key=lambda x: x[0], reverse=True)
    out, seen = [], set()
    for _, text in reasons_scored:
        if text not in seen:
            out.append(text)
            seen.add(text)
        if len(out) >= top_k:
            break

    # Fallback if empty
    if not out:
        out = [
            "Insufficient data to identify strong drivers; additional information may improve assessment."
        ]
    return out

# ───────────────── USER PAYLOAD → ROW ─────────────────
def build_df_from_user_payload(payload: Dict[str, Any]) -> pd.DataFrame:
    """
    Construct a single-row DataFrame with the SAME COLUMNS as train.csv.
    Fill user-provided fields; leave others as safe defaults.
    """
    row = {c: "UNKNOWN" for c in TRAIN_COLUMNS}

    # Pull user inputs
    income          = float(payload.get("income_monthly", 0.0))
    housing         = float(payload.get("housing_cost_monthly", 0.0))
    other           = float(payload.get("other_expenses_monthly", 0.0))
    loans           = payload.get("loans", []) or []
    role            = payload.get("employment_role", "Unknown")
    age             = payload.get("age", 0)
    month           = payload.get("application_month") or datetime.utcnow().strftime("%B")
    paying          = payload.get("spending_pattern_hint", None)  # e.g. Payment_Behaviour
    status          = payload.get("status_hint", None)            # e.g. Credit_Mix
    numCC           = payload.get("num_credit_cards", 0)
    numAcc          = payload.get("num_bank_accounts", 0)
    numLoans        = payload.get("num_loans", 0)
    investedAmount  = payload.get("invested", 0.0)

    if status:
        s = str(status).strip().title()
        # normalize a few synonyms if they ever appear
        if s == "Bad":
            s = "Poor"
        elif s == "Average":
            s = "Standard"
        elif s not in {"Poor", "Standard", "Good"}:
            s = "Standard"
        if "Credit_Mix" in row:
            row["Credit_Mix"] = s

    # Normalize occupation (client sends short categories)
    occ = str(payload.get("employment_role", "Unknown")).strip().lower()
    if occ in OCCUPATION_MAP:
        mapped_occ = OCCUPATION_MAP[occ]
    else:
        mapped_occ = "_______"  # default neutral placeholder

    if "Occupation" in row:
        row["Occupation"] = mapped_occ

    if "Payment_of_Min_Amount" in row and not row.get("Payment_of_Min_Amount"):
        row["Payment_of_Min_Amount"] = "No"  # conservative

    if "Payment_Behaviour" in row and not row.get("Payment_Behaviour"):
        row["Payment_Behaviour"] = "High_spent_Large_value_payments"  # conservative default

    # Map into your CSV headers when present
    if "Monthly_Inhand_Salary" in row:        row["Monthly_Inhand_Salary"] = income
    if "Annual_Income" in row:                row["Annual_Income"] = income * 12.0
    if "Total_EMI_per_month" in row:          row["Total_EMI_per_month"] = housing + other
    if "Amount_invested_monthly" in row:      row["Amount_invested_monthly"] = investedAmount
    if "Outstanding_Debt" in row:             row["Outstanding_Debt"] = float(payload.get("obligations", 0.0))
    if "Age" in row:                          row["Age"] = age
    if "Month" in row:                        row["Month"] = month
    if "Type_of_Loan" in row:
        matched, _ = normalize_loan_types(loans)
        row["Type_of_Loan"] = ", ".join(sorted(matched)) if matched else "Not Specified"
    if "Num_Credit_Card" in row:              row["Num_Credit_Card"] = numCC
    if "Num_Bank_Accounts" in row:            row["Num_Bank_Accounts"] = numAcc
    if "Num_of_Loan" in row:                  row["Num_of_Loan"] = numLoans
    if "Amount_invested_monthly" in row:      row["Amount_invested_monthly"] = investedAmount
    if paying and "Payment_Behaviour" in row: row["Payment_Behaviour"] = paying
    if status and "Credit_Mix" in row:        row["Credit_Mix"] = status  # Good/Standard/Bad per your data
    # Defaults that don’t over-reward



    return pd.DataFrame([row], columns=TRAIN_COLUMNS)

def featurize(df: pd.DataFrame) -> np.ndarray:
    # uses your existing split_num_cat, NUM_COLS_FIT, CAT_COLS_FIT, ohe, scaler
    num_df, cat_df = split_num_cat(df)
    num_aligned = num_df.reindex(columns=NUM_COLS_FIT, fill_value=0.0).values
    cat_aligned = cat_df.reindex(columns=CAT_COLS_FIT, fill_value="UNKNOWN")
    X_num = scaler.transform(num_aligned)
    X_cat = ohe.transform(cat_aligned)
    return np.hstack([X_num, X_cat]).astype(np.float32)

def transform_df_for_model(df: pd.DataFrame) -> torch.Tensor:
    X_all = featurize(df)
    return torch.tensor(X_all, dtype=torch.float32)

def predict_with_reasons_df(df: pd.DataFrame):
    # 1. Access the global model variable
    global model
    
    # 2. CHECK: If the model is empty, load it now!
    if model is None:
        print("⚠️ Model not found in memory. Loading artifacts now...")
        load_pickle_bundle()
    
    # 3. Proceed with prediction
    x = transform_df_for_model(df)
    with torch.no_grad():
        logits = model(x)  # Now this will work because model is loaded
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    # Raw NN view (still useful to return and to gate Captum)
    top_idx = int(np.argmax(probs))
    nn_decision = CLASS_NAMES[top_idx]
    confidence = float(probs[top_idx]) * 100.0
    p_nn_poor = float(probs[CLASS_NAMES.index("Poor")])

    # ---- Hybrid risk: combine calibrated NN risk with rule risk ----
    # Use probabilistic OR so a strong rule-based signal will produce a high blended risk:
    #   p_combined = 1 - (1 - p_nn) * (1 - p_rule)  => p_nn + p_rule - p_nn*p_rule
    p_rule_poor = rule_risk_from_df(df)           # in [0,1]
    p_poor = float(p_nn_poor + p_rule_poor - (p_nn_poor * p_rule_poor))
    p_poor = max(0.0, min(1.0, p_poor))

    # Map blended risk to score/band
    credit_score = probability_to_score(p_poor, method="linear")
    band = score_band(credit_score)

    # User-facing decision aligned with band
    if band in {"Poor"}:
        decision = "Poor"
    elif band in {"Fair"}:
        decision = "Standard"
    else:
        # keep non-adverse classes simple
        decision = "Good" if nn_decision == "Good" and band in {"Very Good","Excellent"} else "Standard"

    # Icon by band (not by raw NN class)
    icon = "⚠️" if band in {"Poor","Fair"} else ("✅" if band in {"Very Good","Excellent"} else "⚖️")
    message = f"{icon} Score {credit_score:.0f} ({band}). Confidence {confidence:.1f}%."

    # ----- Reasons (always for risky cases) -----
    reasons = []
    need_reasons = (band in {"Poor","Fair"}) or (p_poor >= 0.5)
    if need_reasons:
        IG = try_import_captum()
        attr_ok = False
        if IG is not None:
            try:
                model.eval()
                target_idx = CLASS_NAMES.index("Poor")
                ig = IG(model)
                baseline = torch.zeros_like(x)
                x_req = x.clone().requires_grad_(True)
                attr = ig.attribute(x_req, baseline, target=target_idx, n_steps=64)
                attr_vec = attr.detach().cpu().numpy().reshape(-1)
                # (Optional) summarize attributions if you implemented a dynamic summarizer.
                # reasons = summarize_reasons_dynamic(attr_vec, df, top_k=4)
                attr_ok = True
            except Exception:
                attr_ok = False

        if (not attr_ok) or (not reasons):
            reasons = fallback_reasons_dynamic(df, top_k=4)

        if len(reasons) < 3:
            extras = fallback_reasons_dynamic(df, top_k=3)
            for r in extras:
                if r not in reasons:
                    reasons.append(r)
                if len(reasons) >= 3:
                    break

    return {
        "decision": decision,                                   # user-facing (band-aligned)
        "confidence": round(confidence, 1),
        "probabilities": {k: float(v) for k, v in zip(CLASS_NAMES, probs)},  # raw NN probs
        "risk_probability": round(p_poor, 6),                   # blended risk
        "credit_score": round(credit_score, 0),
        "band": band,
        "message": message,
        "reasons": reasons,
    }

def predict_from_user_payload(payload: Dict[str, Any]):
    df = build_df_from_user_payload(payload)
    return predict_with_reasons_df(df)