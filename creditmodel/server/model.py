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

def clean_train_type_of_loan_col(df: pd.DataFrame) -> pd.DataFrame:
    if "Type_of_Loan" not in df.columns:
        return df
    cleaned = []
    for val in df["Type_of_Loan"].astype(str).tolist():
        matched, _ = normalize_loan_types(val)
        cleaned.append(", ".join(sorted(matched)) if matched else "Not Specified")
    out = df.copy()
    out["Type_of_Loan"] = cleaned
    return out

# Clean both train and test frames so OHE sees the same vocabulary
X_tr_df = clean_train_type_of_loan_col(X_tr_df)
X_te_df = clean_train_type_of_loan_col(X_te_df)

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

    # ---- Engineered: numeric occupation risk feature ----
    if "Occupation" in raw.columns:
        occ_series = raw["Occupation"].astype(str)
        occ_risk = occ_series.map(occupation_risk_value).astype(float).fillna(OCC_RISK.get("_______", 0.08))
        # Amplify so the scaler/NN sees meaningful variance
        num_df["eng_occ_risk"] = occ_risk * OCC_FEATURE_MULT

    # ---- Add multi-hot loan flags as numeric features ----
    if "Type_of_Loan" in raw.columns:
        loan_flags = loan_flags_from_series(raw["Type_of_Loan"])
        # numeric features must be numeric (float), aligned by index
        num_df = pd.concat([num_df, loan_flags], axis=1)

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
    # Cap ratios to avoid tiny-income -> enormous ratios and make zero-income clearly extreme.
    # Clip very large ratios to a bounded upper value and use a large fill for missing/zero income.
    num_df["eng_burden"] = (
        (emi / denom)
        .replace([np.inf, -np.inf], np.nan)
        .clip(upper=10.0)
        .fillna(10.0)
    )
    num_df["eng_dti_monthly"] = (
        ((emi + inv) / denom)
        .replace([np.inf, -np.inf], np.nan)
        .clip(upper=10.0)
        .fillna(10.0)
    )

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
    Uses income/DTI/cashflow/utilization + loan-type penalties + counts.
    """
    row = df.iloc[0]

    # Safe coercions
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

    pieces = []

    # Occupation penalty (interpretable rule)
    occ_label = str(row.get("Occupation", "_______"))
    occ_pen = OCC_RULE_MULT * occupation_risk_value(occ_label)
    if occ_pen > 0:
        pieces.append(occ_pen)

    # Monthly burden and DTI
    if pd.notna(inc) and inc > 0 and pd.notna(emi):
        burden = float(emi) / float(inc)
        pieces.append(np.clip((burden - 0.3) / 0.6, 0.0, 1.0))
    else:
        pieces.append(0.7)  # missing/zero income → elevated but not max

    if pd.notna(inc) and pd.notna(emi) and pd.notna(inv) and inc > 0:
        dti_m = (float(emi) + float(inv)) / float(inc)
        pieces.append(np.clip((dti_m - 0.3) / 0.6, 0.0, 1.0))

    # Cash flow
    if pd.notna(inc) and pd.notna(emi) and pd.notna(inv):
        cash_flow = float(inc) - (float(emi) + float(inv))
        pieces.append(0.9 if cash_flow < 0 else (0.6 if cash_flow < 300 else 0.1))

    # Utilization
    if pd.notna(util):
        pieces.append(np.clip((float(util) - 0.3) / 0.5, 0.0, 1.0))

    # ── Loan-type penalties (normalized) ──
    matched, _ = normalize_loan_types(row.get("Type_of_Loan", ""))

    # Per-type base risk weights
    type_penalties = {
        "Payday Loan":              0.50,
        "Debt Consolidation Loan":  0.25,
        "Personal Loan":            0.15,
        "Student Loan":             0.10,
        "Auto Loan":                0.05,
        "Home Equity Loan":         0.04,
        "Mortgage Loan":            0.03,
        "Credit-Builder Loan":      0.00
    }

    # Calculate total risk sum and diversity
    loan_risk = sum(type_penalties.get(t, 0.05) for t in matched)
    n_types = len(matched)

    # Reward diversity (more unique safe types)
    if n_types > 1:
        diversity_bonus = min(0.15 * np.log1p(n_types), 0.25)  # cap benefit
    else:
        diversity_bonus = 0.0

    # Combine: more types = slightly less risk (but never negative)
    loan_risk = max(0.0, loan_risk - diversity_bonus)

    # Soft cap
    loan_risk = min(0.7, loan_risk)
    if loan_risk > 0:
        pieces.append(loan_risk)

    # Behaviour, credit mix, debt
    if "high_spent" in behaviour:
        pieces.append(0.6)
    if credit_mix in {"bad", "poor"}:
        pieces.append(0.7)
    if pd.notna(debt):
        pieces.append(np.clip(float(debt) / 15000.0, 0.0, 1.0))

    # Counts
    if pd.notna(n_acc):
        if n_acc <= 0:
            pieces.append(0.2)
        elif n_acc >= 9:
            pieces.append(0.15)
    if pd.notna(n_cc):
        if n_cc >= 8:
            pieces.append(0.35)
        elif n_cc >= 5:
            pieces.append(0.2)
        elif n_cc == 0:
            pieces.append(0.1)
    if pd.notna(n_loans):
        if n_loans >= 6:
            pieces.append(0.5)
        elif n_loans >= 4:
            pieces.append(0.3)
        elif n_loans == 0:
            pieces.append(0.05)

    if not pieces:
        return 0.3

    # Emphasize worst half
    k = max(1, int(len(pieces) * 0.5))
    return float(np.mean(sorted(pieces)[-k:]))


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


# ────────────────────────────────────────────────
# ARTIFACT SAVE / LOAD HELPERS
# ────────────────────────────────────────────────

import joblib

MODEL_STATE_PATH   = os.path.join(ART_DIR, "model_state.pt")
OHE_PATH           = os.path.join(ART_DIR, "ohe.joblib")
SCALER_PATH        = os.path.join(ART_DIR, "scaler.joblib")
CLASS_NAMES_PATH   = os.path.join(ART_DIR, "class_names.json")
NUM_COLS_PATH      = os.path.join(ART_DIR, "num_cols.json")
CAT_COLS_PATH      = os.path.join(ART_DIR, "cat_cols.json")


def save_artifacts(model, ohe, scaler, num_cols, cat_cols):
    """
    Save model weights + preprocessors + column metadata.
    Call this AFTER training is complete (in the __main__ block).
    """
    # 1) model weights
    torch.save(model.state_dict(), MODEL_STATE_PATH)

    # 2) preprocessors
    joblib.dump(ohe, OHE_PATH)
    joblib.dump(scaler, SCALER_PATH)

    # 3) metadata
    with open(CLASS_NAMES_PATH, "w") as f:
        json.dump(CLASS_NAMES, f)

    with open(NUM_COLS_PATH, "w") as f:
        json.dump(list(num_cols), f)

    with open(CAT_COLS_PATH, "w") as f:
        json.dump(list(cat_cols), f)

    print("✔ Saved model + preprocessors + column metadata to 'artifacts/'.")


def load_artifacts(device: str = "cpu"):
    """
    Load saved model + preprocessors.
    Call this ONCE at API startup (e.g., in app.py @app.on_event('startup')).
    """
    global model, ohe, scaler, CLASS_NAMES, NUM_COLS_FIT, CAT_COLS_FIT

    # 1) preprocessors
    ohe = joblib.load(OHE_PATH)
    scaler = joblib.load(SCALER_PATH)

    # 2) metadata
    with open(CLASS_NAMES_PATH, "r") as f:
        CLASS_NAMES = json.load(f)

    with open(NUM_COLS_PATH, "r") as f:
        NUM_COLS_FIT = json.load(f)

    with open(CAT_COLS_PATH, "r") as f:
        CAT_COLS_FIT = json.load(f)

    # 3) rebuild model with correct input dimension
    #    in_dim = number of numeric features + number of OHE output columns
    try:
        ohe_feature_count = len(ohe.get_feature_names_out())
    except Exception:
        # Very old sklearn fallback (shouldn't be needed, but just in case)
        ohe_feature_count = ohe.transform(
            pd.DataFrame({c: ["DUMMY"] for c in CAT_COLS_FIT})
        ).shape[1]

    in_dim = len(NUM_COLS_FIT) + ohe_feature_count

    model = MLP(in_dim=in_dim, n_classes=len(CLASS_NAMES))
    state = torch.load(MODEL_STATE_PATH, map_location=device)
    model.load_state_dict(state)
    model.eval()

    print("✔ Loaded pretrained model + preprocessors from 'artifacts/'.")

if __name__ == "__main__":
    # ───────────────── TRAIN PREP (dynamic, one-time) ─────────────────
    # We already built: ohe, scaler, NUM_COLS_FIT, CAT_COLS_FIT, X_train, X_test
    model = MLP(in_dim=X_train.shape[1], n_classes=len(CLASS_NAMES))

    # Class weights to handle imbalance
    counts = Counter(y_tr)  # {0: #Poor, 1: #Standard, 2: #Good}
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
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

    model.eval()
    if yte is not None:
        with torch.no_grad():
            preds = torch.argmax(model(Xte), dim=1).cpu().numpy()
        print("Test accuracy:", accuracy_score(yte, preds))
    else:
        print("Test set has no labels; skipping accuracy.")

    # Save everything needed for inference
    save_artifacts(model, ohe, scaler, NUM_COLS_FIT, CAT_COLS_FIT)

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
# Use the columns from train.csv (already loaded as X_tr_df above)
TRAIN_COLUMNS = list(X_tr_df.columns)

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
    x = transform_df_for_model(df)
    with torch.no_grad():
        logits = model(x)
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