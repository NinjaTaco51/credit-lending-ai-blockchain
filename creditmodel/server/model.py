# model.py
# End-to-end: train MLP, take user JSON payload, output credit score (300–850) + reasons.

import os, json, warnings
import numpy as np
import pandas as pd
import torch
from collections import Counter
from datetime import datetime
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from typing import Tuple, Dict, Any
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import accuracy_score


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

# ───────────────── LOAD TRAIN / TEST CSV (use CSV headers directly) ─────────────────
TRAIN_CSV = "../creditmodel/input/train.csv"
TEST_CSV  = "../creditmodel/input/test.csv"
TARGET_COL = "Credit_Score"  # train.csv last column

def load_dataset(path: str):
    if not os.path.exists(path):
        raise FileNotFoundError(os.path.abspath(path))

    # Read as strings (robust), we’ll coerce numerics later
    df = pd.read_csv(path, dtype=str, low_memory=False)

    # Detect whether this file has labels
    has_target = TARGET_COL in df.columns

    if has_target:
        # Normalize label capitalization/whitespace to avoid stray categories
        y = (
            df[TARGET_COL]
            .astype(str)
            .str.strip()
            .str.title()      # "good" -> "Good", " BAD " -> "Bad"
            .to_numpy()
        )
        X = df.drop(columns=[TARGET_COL]).copy()
    else:
        X, y = df.copy(), None

    return X, y


# Load train and test
X_tr_df, y_tr_str = load_dataset(TRAIN_CSV)
X_te_df, y_te_str = load_dataset(TEST_CSV)

CLASS_NAMES = ["Poor", "Standard", "Good"]   # keep this order stable
name_to_idx = {n: i for i, n in enumerate(CLASS_NAMES)}

# After loading train:
X_tr_df, y_tr_str = load_dataset(TRAIN_CSV)
if y_tr_str is None:
    raise ValueError("train.csv must include the 'Credit_Score' column.")

# Map labels → integers (default to Standard if an odd label sneaks in)
y_tr = np.array([name_to_idx.get(s, 1) for s in y_tr_str], dtype=np.int64)

# Load test (may be unlabeled)
X_te_df, y_te_str = load_dataset(TEST_CSV)
y_te = None if y_te_str is None else np.array([name_to_idx.get(s, 1) for s in y_te_str], dtype=np.int64)


# ───────────────── PREPROCESSORS ─────────────────
def make_ohe():
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)

def parse_history_months(s: pd.Series) -> pd.Series:
    """
    Convert strings like '17 Years and 4 Months' to numeric months (17*12+4=208).
    Returns a numeric Series with NaNs replaced by 0.0.
    """
    out = []
    for x in s.astype(str):
        xl = x.lower()
        yrs = 0
        mos = 0
        try:
            if "year" in xl:
                # grab number before 'year'
                parts = xl.split("year")[0].strip().split()
                if parts:
                    yrs = int(parts[-1])
            if "month" in xl:
                # grab number before 'month'
                parts = xl.split("month")[0].strip().split()
                if parts:
                    mos = int(parts[-1])
        except Exception:
            yrs, mos = 0, 0
        out.append(yrs * 12 + mos)
    return pd.to_numeric(pd.Series(out), errors="coerce").fillna(0.0)

# Keep only low/medium-cardinality categorical columns (to avoid memory blow-up)
CAT_WHITELIST = {
    "Month",                    # 12 months
    "Occupation",               # job titles (moderate variety)
    "Type_of_Loan",             # e.g., Auto, Home, Credit Card, etc.
    "Credit_Mix",               # Good / Standard / Bad
    "Payment_Behaviour",        # spending pattern tags
    "Payment_of_Min_Amount",    # Yes / No
}

def collapse_rare(df: pd.DataFrame, col: str, top_n: int = 50) -> pd.Series:
    """
    Keep only the top_n most common categories, replace others with '__OTHER__'.
    """
    if col not in df.columns:
        return pd.Series([], dtype=str)
    vc = df[col].astype(str).value_counts()
    keep = set(vc.head(top_n).index)
    s = df[col].astype(str).where(df[col].astype(str).isin(keep), other="__OTHER__")
    return s

def split_num_cat(df: pd.DataFrame):
    raw = df.copy()

    # ---- Build engineered numerics (before dtype split) ----
    # Credit_History_Age -> numeric months
    if "Credit_History_Age" in raw.columns:
        raw["eng_history_months"] = parse_history_months(raw["Credit_History_Age"])

    # Try to create a monthly income (if both present we still keep both)
    # This is just for derived features; we won't drop originals
    income_m = None
    if "Monthly_Inhand_Salary" in raw.columns:
        # already monthly
        pass
    elif "Annual_Income" in raw.columns:
        # create an auxiliary monthly estimate
        raw["Monthly_Inhand_Salary"] = (
            pd.to_numeric(raw["Annual_Income"], errors="coerce") / 12.0
        )

    # Coerce numerics
    num_coerced = raw.apply(pd.to_numeric, errors="coerce")

    # Numeric = columns that convert to at least some numbers
    numeric_cols = [c for c in raw.columns if not num_coerced[c].isna().all()]
    num_df = num_coerced[numeric_cols].fillna(0.0)

    # inside split_num_cat(df) after you build num_df
    # Be robust to missing columns
    inc = num_df.get("Monthly_Inhand_Salary", pd.Series(0.0, index=num_df.index))
    emi = num_df.get("Total_EMI_per_month", pd.Series(0.0, index=num_df.index))
    inv = num_df.get("Amount_invested_monthly", pd.Series(0.0, index=num_df.index))
    debt = num_df.get("Outstanding_Debt", pd.Series(0.0, index=num_df.index))
    util = num_df.get("Credit_Utilization_Ratio", pd.Series(np.nan, index=num_df.index))

    # Positive cash flow is good; negative is bad
    num_df["eng_cash_flow"] = (inc - (emi + inv)).astype(float)

    # Monthly burden ratios (bad when high)
    denom = inc.replace(0, np.nan)
    num_df["eng_burden"] = (emi / denom).replace([np.inf, -np.inf], np.nan).fillna(1.0)  # if income=0 → very risky
    num_df["eng_dti_monthly"] = ((emi + inv) / denom).replace([np.inf, -np.inf], np.nan).fillna(1.0)

    # If utilization exists, keep it (bad when high)
    if util.notna().any():
        num_df["eng_utilization"] = util.clip(lower=0).fillna(0.0)


    # ---- Categorical whitelist only (avoid ID/SSN/Name!) ----
    cat_candidates = [c for c in raw.columns if c not in numeric_cols]
    cat_keep = [c for c in cat_candidates if c in CAT_WHITELIST]

    # Collapse very wide columns (like Occupation) to top-N
    cat_df = pd.DataFrame(index=raw.index)
    for c in cat_keep:
        s = raw[c].astype(str).fillna("UNKNOWN")
        if c in ("Occupation", "Type_of_Loan"):
            s = collapse_rare(raw, c, top_n=50)
        cat_df[c] = s

    # If nothing left (edge case), return empty cat df with 0 columns
    if cat_df.shape[1] == 0:
        cat_df = pd.DataFrame(index=raw.index)

    return num_df, cat_df

def rule_risk_from_df(df: pd.DataFrame) -> float:
    """
    Return a risk probability in [0,1] built from interpretable heuristics.
    Uses only columns that we populate from the React payload.
    """
    row = df.iloc[0]
    # Safe coercions
    inc = pd.to_numeric(row.get("Monthly_Inhand_Salary"), errors="coerce")
    emi = pd.to_numeric(row.get("Total_EMI_per_month"), errors="coerce")
    inv = pd.to_numeric(row.get("Amount_invested_monthly"), errors="coerce")
    util = pd.to_numeric(row.get("Credit_Utilization_Ratio"), errors="coerce")
    debt = pd.to_numeric(row.get("Outstanding_Debt"), errors="coerce")

    credit_mix = str(row.get("Credit_Mix", "")).strip().lower()
    behaviour  = str(row.get("Payment_Behaviour", "")).lower()
    loan_types = str(row.get("Type_of_Loan", "")).lower()

    # Score pieces (0..1)
    pieces = []

    # Monthly burden and DTI
    if pd.notna(inc) and inc > 0 and pd.notna(emi):
        burden = float(emi) / float(inc)
        # gentle curve: 0.3 -> 0.0, 0.5 -> 0.5, 0.9+ -> ~1.0
        pieces.append(np.clip((burden - 0.3) / 0.6, 0.0, 1.0))
    else:
        # No income → risky
        pieces.append(0.8)

    if pd.notna(inc) and pd.notna(emi) and pd.notna(inv) and inc > 0:
        dti_m = (float(emi) + float(inv)) / float(inc)
        pieces.append(np.clip((dti_m - 0.3) / 0.6, 0.0, 1.0))

    # Cash flow
    if pd.notna(inc) and pd.notna(emi) and pd.notna(inv):
        cash_flow = float(inc) - (float(emi) + float(inv))
        if cash_flow < 0:
            pieces.append(0.9)
        elif cash_flow < 300:
            pieces.append(0.6)
        else:
            pieces.append(0.1)

    # Utilization (if present)
    if pd.notna(util):
        pieces.append(np.clip((float(util) - 0.3) / 0.5, 0.0, 1.0))

    # Payday / short-term loans
    if "payday" in loan_types or "short-term" in loan_types:
        pieces.append(0.9)

    # High-spend behaviour
    if "high_spent" in behaviour:
        pieces.append(0.6)

    # Credit mix “bad”
    if credit_mix == "bad" or credit_mix == "poor":
        pieces.append(0.7)

    # Outstanding debt (scaled softly)
    if pd.notna(debt):
        pieces.append(np.clip(float(debt) / 15000.0, 0.0, 1.0))

    # Combine by a soft max-ish mean: emphasize higher risks
    if not pieces:
        return 0.3
    return float(np.mean(sorted(pieces)[-max(1, int(len(pieces)*0.5)):]))  # mean of top half


# ───────────────── TRAIN PREP (dynamic) ─────────────────
ohe = make_ohe()
scaler = StandardScaler()

# Split using current CSV headers
num_tr, cat_tr = split_num_cat(X_tr_df)
num_te, cat_te = split_num_cat(X_te_df)

# Remember the exact column order we fit on (important for inference)
NUM_COLS_FIT = list(num_tr.columns)
CAT_COLS_FIT = list(cat_tr.columns)

# Fit on train, transform both
X_tr_cat = ohe.fit_transform(cat_tr)
X_tr_num = scaler.fit_transform(num_tr.values)

X_te_cat = ohe.transform(cat_te.reindex(columns=CAT_COLS_FIT, fill_value="UNKNOWN"))
X_te_num = scaler.transform(
    num_te.reindex(columns=NUM_COLS_FIT, fill_value=0.0).values
)

X_train = np.hstack([X_tr_num, X_tr_cat]).astype(np.float32)
X_test  = np.hstack([X_te_num, X_te_cat]).astype(np.float32)

Xtr = torch.tensor(X_train, dtype=torch.float32)
ytr = torch.tensor(y_tr, dtype=torch.long)
Xte = torch.tensor(X_test, dtype=torch.float32)
yte = torch.tensor(y_te, dtype=torch.long) if y_te is not None else None

train_loader = DataLoader(TensorDataset(Xtr, ytr), batch_size=16, shuffle=True)


class MLP(nn.Module):
    def __init__(self, in_dim, hidden=(128, 64), p=0.2, n_classes=3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden[0]), nn.ReLU(), nn.BatchNorm1d(hidden[0]), nn.Dropout(p),
            nn.Linear(hidden[0], hidden[1]), nn.ReLU(), nn.BatchNorm1d(hidden[1]), nn.Dropout(p),
            nn.Linear(hidden[1], n_classes)
        )
    def forward(self, x): return self.net(x)

model = MLP(in_dim=X_train.shape[1], n_classes=len(CLASS_NAMES))
# y_tr is your numpy array of class indices
counts = Counter(y_tr)  # {0: #Bad, 1: #Standard, 2: #Good}
total = sum(counts.values())
weights = torch.tensor(
    [total / counts.get(i, 1) for i in range(len(CLASS_NAMES))],
    dtype=torch.float32
)
criterion = nn.CrossEntropyLoss(weight=weights)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)

model.train()
for _ in range(30):
    for xb, yb in train_loader:
        logits = model(xb)
        loss = criterion(logits, yb)
        optimizer.zero_grad(); loss.backward(); optimizer.step()

model.eval()
if yte is not None:
    with torch.no_grad():
        preds = torch.argmax(model(Xte), dim=1).cpu().numpy()
    print("Test accuracy:", accuracy_score(y_te, preds))
else:
    print("Test set has no labels; skipping accuracy.")

# Save lightweight artifacts (optional, in-memory is fine too)
try:
    import joblib
    joblib.dump(ohe, os.path.join(ART_DIR, "ohe.joblib"))
    joblib.dump(scaler, os.path.join(ART_DIR, "scaler.joblib"))
    with open(os.path.join(ART_DIR, "class_names.json"), "w") as f:
        json.dump(CLASS_NAMES, f)
except Exception as e:
    warnings.warn(f"Could not save preprocessors: {e}")

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

def summarize_reasons(attr_vec: np.ndarray, row_df: pd.DataFrame, top_k=4):
    """
    Turn per-feature attributions into human-readable reasons.
    Supports base numeric indices and engineered features:
      eng_dti, eng_cash_flow, eng_mix_auto/home/payday/card
    """
    # Build aligned feature name list used in transform order
    base_num_names = [f"num_{c}" for c in NUMERIC_COLS] + ENGINEERED_NUMERIC_COLS
    field_slices = []
    for i, n in enumerate(base_num_names):
        field_slices.append((n, (i, i+1)))

    # Add categorical groups (keep coarse grouping for reasons)
    start = len(base_num_names)
    cat_feature_names = ohe.get_feature_names_out()  # like 'cat_2_January'
    prefixes = [fn.split("_")[0] + "_" + fn.split("_")[1] for fn in cat_feature_names]
    cat_cols_named = [f"cat_{c}" for c in CATEGORICAL_COLS]
    idx = start
    for cname in cat_cols_named:
        count = sum(1 for p in prefixes if p == cname)
        field_slices.append((cname, (idx, idx + count)))
        idx += count

    # Rank fields by ABS attribution
    scores = []
    for fname, (s, e) in field_slices:
        contrib = attr_vec[s:e]
        score = float(np.sum(np.abs(contrib)))
        signed = float(np.sum(contrib))
        scores.append((fname, score, signed, (s, e)))
    scores.sort(key=lambda x: x[1], reverse=True)

    # Helpers to read raw values from original row_df
    def num(col): 
        return pd.to_numeric(row_df.iloc[0, col], errors="coerce")

    reasons = []
    for fname, _, signed, _ in scores:
        # Engineered numeric features
        if fname == "eng_dti":
            inc, exp = num(7), num(8)
            if pd.notna(inc) and inc > 0 and pd.notna(exp):
                dti = exp / inc
                if dti >= 0.5:
                    reasons.append("High debt-to-income ratio (DTI).")
                elif dti >= 0.35:
                    reasons.append("Elevated debt-to-income ratio.")
        elif fname == "eng_cash_flow":
            inc, exp = num(7), num(8)
            if pd.notna(inc) and pd.notna(exp) and (inc - exp) < 0:
                reasons.append("Negative monthly cash flow (expenses exceed income).")
        elif fname == "eng_mix_payday":
            loans = str(row_df.iloc[0, 12] or "").lower()
            if "payday" in loans or "short-term" in loans:
                reasons.append("Recent or frequent payday/short-term loans.")
        elif fname in ("eng_mix_auto", "eng_mix_card", "eng_mix_home"):
            # usually not adverse, skip unless you want to phrase neutrally
            pass

        # Base numeric columns
        elif fname == "num_7":   # income
            v = num(7)
            if pd.notna(v) and v < 3500:
                reasons.append("Low monthly income relative to obligations.")
        elif fname == "num_8":   # expenses
            v = num(8)
            if pd.notna(v) and v > 2500:
                reasons.append("High monthly expenses reduce repayment capacity.")
        elif fname == "num_19":  # bureau score
            v = num(19)
            if pd.notna(v) and v < 600:
                reasons.append("Low external bureau score.")
        elif fname == "num_23":  # obligations
            v = num(23)
            if pd.notna(v) and v > 300:
                reasons.append("High current obligations.")

        # Categoricals (coarse)
        elif fname == "cat_12":
            s = str(row_df.iloc[0, 12] or "").lower()
            if "payday" in s or "short-term" in s:
                reasons.append("Recent or frequent payday/short-term loans.")
        elif fname == "cat_22":
            s = str(row_df.iloc[0, 22] or "").lower()
            if "high_spent" in s:
                reasons.append("High spending pattern relative to income.")
        elif fname == "cat_18":
            s = str(row_df.iloc[0, 18] or "").lower()
            if s == "poor":
                reasons.append("Reported credit status indicates elevated risk.")

        if len(reasons) >= top_k:
            break

    # De-dup & cap
    out, seen = [], set()
    for r in reasons:
        if r not in seen:
            out.append(r); seen.add(r)
        if len(out) >= top_k:
            break
    return out

# ───────────────── USER PAYLOAD → ROW ─────────────────
# Use the columns from train.csv (already loaded as X_tr_df above)
TRAIN_COLUMNS = list(X_tr_df.columns)

def build_df_from_user_payload(payload: Dict[str, Any]) -> pd.DataFrame:
    """
    Construct a single-row DataFrame with the SAME COLUMNS as train.csv.
    Fill user-provided fields; leave others as safe defaults.
    """
    row = {c: "UNKNOWN" for c in TRAIN_COLUMNS}

    # Pull user inputs
    income = float(payload.get("income_monthly", 0.0))
    housing = float(payload.get("housing_cost_monthly", 0.0))
    other   = float(payload.get("other_expenses_monthly", 0.0))
    loans   = payload.get("loans", []) or []
    role    = payload.get("employment_role", "Unknown")
    age     = payload.get("age", 0)
    month   = payload.get("application_month") or datetime.utcnow().strftime("%B")
    paying  = payload.get("spending_pattern_hint", None)  # e.g. Payment_Behaviour
    status  = payload.get("status_hint", None)            # e.g. Credit_Mix

    # NEW (keep Poor)
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


    if "Payment_of_Min_Amount" in row and not row.get("Payment_of_Min_Amount"):
        row["Payment_of_Min_Amount"] = "No"  # conservative

    if "Payment_Behaviour" in row and not row.get("Payment_Behaviour"):
        row["Payment_Behaviour"] = "High_spent_Large_value_payments"  # conservative default

    # Map into your CSV headers when present
    if "Monthly_Inhand_Salary" in row:        row["Monthly_Inhand_Salary"] = income
    if "Annual_Income" in row:                row["Annual_Income"] = income * 12.0
    if "Total_EMI_per_month" in row:          row["Total_EMI_per_month"] = housing + other
    if "Amount_invested_monthly" in row:      row["Amount_invested_monthly"] = 0.0
    if "Outstanding_Debt" in row:             row["Outstanding_Debt"] = float(payload.get("obligations", 0.0))
    if "Occupation" in row:                   row["Occupation"] = role
    if "Age" in row:                          row["Age"] = age
    if "Month" in row:                        row["Month"] = month
    if "Type_of_Loan" in row:                 row["Type_of_Loan"] = ", ".join(loans) if loans else "Credit Card"
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
    x = transform_df_for_model(df)
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    # Raw NN view (still useful to return and to gate Captum)
    top_idx = int(np.argmax(probs))
    nn_decision = CLASS_NAMES[top_idx]
    confidence = float(probs[top_idx]) * 100.0
    p_nn_poor = float(probs[CLASS_NAMES.index("Poor")])

    # ---- Hybrid risk: blend model risk with transparent rule risk ----
    p_rule_poor = rule_risk_from_df(df)           # in [0,1]
    ALPHA = 0.6                                    # weight on NN
    p_poor = ALPHA * p_nn_poor + (1.0 - ALPHA) * p_rule_poor

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

# ───────────────── CLI DEMO ─────────────────
if __name__ == "__main__":
    # Optional: make results a bit more repeatable during local runs
    import random
    random.seed(42); np.random.seed(42); torch.manual_seed(42)

    # ---- Bad applicant (should trigger reasons) ----
    bad_payload = {
        "income_monthly": 2400.0,                   # very low income
        "housing_cost_monthly": 1400.0,             # high fixed expense
        "other_expenses_monthly": 800.0,
        "employment_role": "Retail Cashier",        # low-wage occupation
        "years_at_job": 0.4,                        # < 6 months
        "loans": ["Payday Loan", "Personal Loan"],
        "age": 22,
        "application_month": "March",
        "status_hint": "Poor",
        "spending_pattern_hint": "High_spent_Large_value_payments",
        "obligations": 12000.0                      # large debt load
    }

    # ---- Standard-ish applicant (replaced with bad profile) ----
    standard_payload = {
        "income_monthly": 5200.0,                   # moderate income
        "housing_cost_monthly": 1700.0,
        "other_expenses_monthly": 700.0,
        "employment_role": "Customer Support Representative",
        "years_at_job": 2.0,                        # steady job
        "loans": ["Auto Loan", "Credit-Builder Loan"],
        "age": 32,
        "application_month": "September",
        "status_hint": "Standard",
        "spending_pattern_hint": "Medium_spent_Medium_value_payments",
        "obligations": 6000.0                       # moderate debt
    }


    # ---- Good applicant (replaced with bad profile) ----
    good_payload = {
        "income_monthly": 8300.0,                   # strong income
        "housing_cost_monthly": 1900.0,
        "other_expenses_monthly": 700.0,
        "employment_role": "Registered Nurse",
        "years_at_job": 5.5,                        # long tenure
        "loans": ["Home Loan", "Auto Loan", "Credit Card"],
        "age": 36,
        "application_month": "January",
        "status_hint": "Good",
        "spending_pattern_hint": "Low_spent_Medium_value_payments",
        "obligations": 3800.0                       # manageable obligations
    }


    # ---- Edge applicant (replaced with bad profile) ----
    edge_payload = {
        "income_monthly": 9500.0,
        "housing_cost_monthly": 2000.0,
        "other_expenses_monthly": 900.0,
        "employment_role": "High School Teacher",
        "years_at_job": 7.0,
        "loans": ["Auto Loan", "Credit Card"],
        "age": 42,
        "application_month": "June",
        "status_hint": "Good",
        "spending_pattern_hint": "Low_spent_Small_value_payments",
        "obligations": 2800.0
    }


    # ---- Excellent applicant (replaced with bad profile) ----
    excellent_payload = {
        "income_monthly": 12500.0,                  # high, stable income
        "housing_cost_monthly": 2200.0,
        "other_expenses_monthly": 900.0,
        "employment_role": "Senior Financial Analyst",
        "years_at_job": 10.0,
        "loans": ["Mortgage", "Auto Loan"],
        "age": 46,
        "application_month": "November",
        "status_hint": "Good",
        "spending_pattern_hint": "Low_spent_Small_value_payments",
        "obligations": 1800.0                       # minimal debt
    }


 
    test_payloads = {
        "BAD": bad_payload,
        "STANDARD": standard_payload,
        "GOOD": good_payload,
        "EDGE": edge_payload,
        "EXCELLENT": excellent_payload
    }

    for label, payload in test_payloads.items():
        print(f"\n--- {label} EXAMPLE ---")
        out = predict_from_user_payload(payload)
        print(json.dumps(out, indent=2))
