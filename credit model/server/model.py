# model.py
# End-to-end: train MLP, take user JSON payload, output credit score (300–850) + reasons.

import os, json, warnings
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import accuracy_score

# ───────────────── CONFIG / CONSTANTS ─────────────────
ART_DIR = "artifacts"
os.makedirs(ART_DIR, exist_ok=True)

# Original column layout from your dataset (indices kept for parity)
CATEGORICAL_COLS = [2, 3, 6, 12, 17, 18, 22]   # Month, Name, Job, Loans, Time(text), Status, SpendingPattern
NUMERIC_COLS     = [4, 7, 8, 9, 10, 11, 13, 14, 15, 16, 19, 20, 21, 23]
CLASS_NAMES = ["Bad", "Standard", "Good"]

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

# ───────────────── TOY TRAINING DATA (same as before) ─────────────────
# (Shortened here for brevity—use your full dataset block from earlier message)
# Paste the full `data = {...}` object you already have:
from typing import Dict, Any
# Minimal toy dataset used when the full dataset isn't pasted above.
# This must be a dict with keys "data" (list of rows) and "target" (list of class names).
data = {
    "data": [
        ["0x9c01","CUS_0xf66","June","Kevin Brooks",33,"295-77-3211","Sales Associate",5200.00,2400.00,2,3,2,3,"Auto Loan, Personal Loan",4,4,13.20,3,"Standard",710.30,35.80,"4 Years and 6 Months","No",58.20,125.40,"Medium_spent_Medium_value_payments",275.50],
        ["0x9c02","CUS_0xf77","July","Patricia Reed",40,"316-88-4520","Teacher",5800.75,2300.60,3,3,3,3,"Credit-Builder Loan, Auto Loan",3,5,12.50,3,"Standard",725.45,32.10,"8 Years and 0 Months","No",55.40,112.60,"Medium_spent_Small_value_payments",298.30],
        ["0x9c03","CUS_0xf88","August","Andre Collins",29,"427-99-5632","Graphic Designer",4900.50,2100.25,2,2,2,2,"Personal Loan, Credit Card",3,3,14.00,3,"Standard",695.25,37.40,"3 Years and 7 Months","No",61.30,132.50,"Medium_spent_Medium_value_payments",255.70],
        ["0x9c04","CUS_0xf99","September","Chloe Ramirez",35,"538-00-6743","Customer Support",5600.20,2250.75,3,3,2,3,"Auto Loan, Personal Loan, Credit-Builder Loan",4,4,12.75,3,"Standard",705.60,34.25,"5 Years and 3 Months","No",59.90,120.80,"Medium_spent_Large_value_payments",268.60],
        ["0x9c05","CUS_0xfa0","October","George Simmons",42,"649-11-7854","Restaurant Manager",6100.85,2500.40,3,3,3,3,"Home Loan, Auto Loan",2,5,11.90,3,"Standard",720.10,33.50,"7 Years and 9 Months","No",54.75,115.90,"Medium_spent_Medium_value_payments",289.45],
        ["0x9f06","CUS_0xc11","June","David Nguyen",29,"523-11-6678","Graphic Designer",5200.40,2100.30,2,3,2,3,"Auto Loan, Personal Loan",4,4,12.85,3,"Standard",710.45,34.70,"3 Years and 10 Months","No",57.25,120.50,"Medium_spent_Medium_value_payments",260.85],
        ["0x9f07","CUS_0xc22","July","Rachel Bennett",37,"614-22-7789","Account Executive",6100.75,2400.60,3,3,3,3,"Home Loan, Auto Loan",3,5,11.90,3,"Standard",725.30,32.40,"6 Years and 1 Month","No",55.90,110.20,"Medium_spent_Small_value_payments",278.40],
        ["0x9f08","CUS_0xc33","August","Jason Wu",32,"705-33-8890","Customer Support Specialist",4800.55,2000.75,2,2,2,2,"Credit-Builder Loan, Auto Loan",3,4,13.10,3,"Standard",705.15,36.25,"4 Years and 8 Months","No",60.20,125.00,"Medium_spent_Medium_value_payments",250.60],
        ["0x9f09","CUS_0xc44","September","Emily Carter",41,"796-44-9901","High School Teacher",5800.85,2200.55,3,3,3,3,"Credit-Builder Loan, Home Loan",2,5,12.40,3,"Standard",715.75,33.50,"7 Years and 5 Months","No",56.40,115.80,"Medium_spent_Large_value_payments",272.15],
        ["0x9f10","CUS_0xc55","October","Logan Scott",36,"887-55-0012","Mechanical Technician",5500.25,2300.10,3,3,2,3,"Auto Loan, Personal Loan",4,4,13.00,3,"Standard",718.90,35.60,"5 Years and 9 Months","No",58.10,118.45,"Medium_spent_Medium_value_payments",265.95],

        ["0x9b01","CUS_0xf11","January","Samantha Lewis",31,"443-21-9987","Software Engineer",8200.00,1800.00,4,4,3,4,"Auto Loan, Home Loan, Credit Card",2,8,9.75,5,"Good",815.40,25.32,"7 Years and 4 Months","No",42.50,90.20,"Low_spent_Medium_value_payments",420.75],
        ["0x9b02","CUS_0xf22","February","Daniel Kim",27,"528-33-7764","Marketing Analyst",6400.50,1700.80,3,4,3,3,"Credit-Builder Loan, Auto Loan",1,6,8.50,4,"Good",790.25,22.60,"5 Years and 11 Months","No",45.80,88.10,"Low_spent_Small_value_payments",360.40],
        ["0x9b03","CUS_0xf33","March","Linda Tran",45,"612-44-8921","Project Manager",9300.75,2000.00,4,5,4,4,"Home Equity Loan, Credit Card",1,7,7.90,4,"Good",825.15,27.10,"12 Years and 5 Months","No",40.25,75.30,"Low_spent_Medium_value_payments",480.55],
        ["0x9b04","CUS_0xf44","April","Ramon Alvarez",36,"729-55-4410","Financial Consultant",10500.25,2100.50,5,4,4,5,"Mortgage, Auto Loan, Credit Card",2,8,10.00,5,"Good",832.80,29.50,"9 Years and 2 Months","No",38.40,72.85,"Low_spent_Small_value_payments",512.90],
        ["0x9b05","CUS_0xf55","May","Jessica Owens",30,"834-66-7720","Registered Nurse",7500.40,1900.00,3,3,3,4,"Credit-Builder Loan, Auto Loan, Student Loan",2,7,9.10,4,"Good",808.70,24.45,"6 Years and 3 Months","No",44.70,85.90,"Low_spent_Medium_value_payments",395.60],
        ["0x9g06","CUS_0xd11","January","Isabella Perez",33,"295-12-7788","Data Analyst",8500.60,1900.40,4,4,3,4,"Auto Loan, Home Loan, Credit Card",2,7,9.10,5,"Good",820.75,26.30,"7 Years and 8 Months","No",43.10,82.75,"Low_spent_Medium_value_payments",440.50],
        ["0x9g07","CUS_0xd22","February","Anthony Rivera",28,"386-23-8899","Nurse Practitioner",7800.35,1800.90,3,4,3,3,"Credit-Builder Loan, Auto Loan",1,6,8.70,4,"Good",807.45,25.50,"6 Years and 3 Months","No",45.20,88.40,"Low_spent_Small_value_payments",390.60],
        ["0x9g08","CUS_0xd33","March","Sophia Gonzalez",42,"477-34-9900","Financial Advisor",9900.10,2200.80,5,4,4,4,"Mortgage, Credit Card, Auto Loan",2,8,9.30,5,"Good",835.90,28.75,"10 Years and 6 Months","No",39.40,74.80,"Low_spent_Medium_value_payments",510.25],
        ["0x9g09","CUS_0xd44","April","Michael Brown",36,"568-45-0011","Project Engineer",9100.55,2100.70,4,4,3,4,"Home Loan, Auto Loan, Credit Card",2,7,8.95,4,"Good",812.20,27.15,"9 Years and 2 Months","No",42.30,80.50,"Low_spent_Small_value_payments",455.85],
        ["0x9g10","CUS_0xd55","May","Emma Davis",31,"659-56-1122","Physician Assistant",8700.25,2000.30,3,4,3,3,"Auto Loan, Student Loan, Credit Card",2,6,8.50,4,"Good",818.60,25.90,"8 Years and 1 Month","No",44.10,83.60,"Low_spent_Medium_value_payments",430.40],

        ["0x9e01","CUS_0xb11","January","Tanya Morales",30,"293-55-4412","Restaurant Server",3300.00,2800.50,1,2,1,2,"Payday Loan, Personal Loan",8,3,24.10,1,"Poor",482.40,74.25,"1 Year and 2 Months","Yes",90.12,360.40,"High_spent_Large_value_payments",20.50],
        ["0x9e02","CUS_0xb22","February","Omar Khalid",45,"371-66-2233","Truck Driver",4200.75,3100.00,2,2,2,3,"Auto Loan, Payday Loan",10,2,26.00,2,"Poor",498.75,66.80,"2 Years and 4 Months","Yes",88.90,290.10,"High_spent_Large_value_payments",45.75],
        ["0x9e03","CUS_0xb33","March","Brianna Fox",26,"582-77-3344","Gig Worker",2600.20,2200.10,1,1,1,1,"Short-term Loan, Payday Loan",7,4,22.50,1,"Poor",465.10,78.60,"9 Months","Yes",93.50,412.00,"High_spent_Large_value_payments",15.30],
        ["0x9e04","CUS_0xb44","April","Samuel Ortiz",39,"468-88-4455","Warehouse Worker",3700.90,2900.25,2,2,2,2,"Personal Loan, Payday Loan",9,2,25.40,1,"Poor",507.20,69.10,"1 Year and 11 Months","Yes",87.20,335.60,"High_spent_Large_value_payments",38.90],
        ["0x9e05","CUS_0xb55","May","Nina Patel",33,"654-99-5566","Salon Stylist",3050.60,2550.80,1,2,1,2,"Payday Loan, Personal Loan",8,3,23.85,1,"Poor",491.00,72.45,"1 Year and 6 Months","Yes",91.05,375.25,"High_spent_Large_value_payments",27.80],
        ["0x9a06","CUS_0xaff","January","Carlos Vega",34,"672-11-9923","Ride-Share Driver",3800.00,3200.00,2,3,1,2,"Payday Loan, Personal Loan",9,2,22.50,1,"Poor",498.20,68.12,"1 Year and 6 Months","Yes",87.40,325.20,"High_spent_Large_value_payments",35.10],
        ["0x9a07","CUS_0xbee","February","Monica Ruiz",29,"781-22-1104","Retail Clerk",2900.50,2500.75,1,2,2,1,"Personal Loan, Credit-Builder Loan, Payday Loan",8,3,24.00,1,"Poor",472.85,73.45,"1 Year and 2 Months","Yes",92.10,410.00,"High_spent_Large_value_payments",22.50],
        ["0x9a08","CUS_0xc11","March","Darnell Price",41,"559-33-7744","Construction Worker",4500.00,3600.00,3,3,2,2,"Auto Loan, Payday Loan",11,1,26.75,2,"Poor",512.60,64.80,"2 Years and 0 Months","Yes",85.90,298.70,"High_spent_Large_value_payments",48.00],
        ["0x9a09","CUS_0xd22","April","Evelyn Park",26,"498-55-3321","Barista",2800.25,2300.50,1,1,1,1,"Payday Loan, Personal Loan",7,4,23.10,1,"Poor",489.40,71.20,"10 Months","Yes",90.33,365.40,"High_spent_Large_value_payments",18.75],
        ["0x9a10","CUS_0xe33","May","Marcus Hill",38,"304-66-2218","Warehouse Operative",3600.80,2900.60,2,2,2,3,"Personal Loan, Payday Loan, Short-term Loan",10,2,25.00,1,"Poor",505.95,69.77,"1 Year and 9 Months","Yes",88.55,402.10,"High_spent_Large_value_payments",40.20],
    ],
    "target": [
        "Standard","Standard","Standard","Standard","Standard","Standard","Standard","Standard","Standard","Standard",
        "Good","Good","Good","Good","Good","Good","Good","Good","Good","Good",
        "Bad","Bad","Bad","Bad","Bad","Bad","Bad","Bad","Bad","Bad"
    ]
}

# ───────────────── PREPROCESSORS ─────────────────
def make_ohe():
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)

def select_named(df: pd.DataFrame):
    """
    Returns (num_df_with_engineered, cat_df).
    Adds engineered numeric features derived from base columns:
      - DTI = expenses / income  (col 8 / col 7)
      - CashFlow = income - expenses
      - Credit mix flags from loans text (col 12)
    """
    num_df = df[NUMERIC_COLS].copy()
    cat_df = df[CATEGORICAL_COLS].copy()
    num_df.columns = [f"num_{c}" for c in NUMERIC_COLS]
    cat_df.columns = [f"cat_{c}" for c in CATEGORICAL_COLS]

    income = pd.to_numeric(df[7], errors="coerce")
    expenses = pd.to_numeric(df[8], errors="coerce")
    loans_txt = df[12].astype(str).fillna("")

    eng = pd.DataFrame(index=df.index)
    eng["eng_dti"] = (expenses / income).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    eng["eng_cash_flow"] = (income - expenses).fillna(0.0)

    lt = loans_txt.str.lower()
    eng["eng_mix_auto"]   = lt.str.contains("auto").astype(float)
    eng["eng_mix_home"]   = lt.str.contains("home|mortgage").astype(float)
    eng["eng_mix_payday"] = lt.str.contains("payday|short-term").astype(float)
    eng["eng_mix_card"]   = lt.str.contains("credit card").astype(float)

    num_df = pd.concat([num_df, eng], axis=1)
    return num_df, cat_df

# ───────────────── TRAIN PIPELINE ─────────────────
X = pd.DataFrame(data["data"])
y_str = np.array(data["target"])
name_to_idx = {n: i for i, n in enumerate(CLASS_NAMES)}
y = np.array([name_to_idx[s] for s in y_str], dtype=np.int64)

X_tr_df, X_te_df, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

ohe = make_ohe()
scaler = StandardScaler()

num_tr, cat_tr = select_named(X_tr_df)
num_te, cat_te = select_named(X_te_df)

X_tr_cat = ohe.fit_transform(cat_tr.astype(str))
X_tr_num = scaler.fit_transform(num_tr.apply(pd.to_numeric, errors="coerce").fillna(0))
X_te_cat = ohe.transform(cat_te.astype(str))
X_te_num = scaler.transform(num_te.apply(pd.to_numeric, errors="coerce").fillna(0))

X_train = np.hstack([X_tr_num, X_tr_cat]).astype(np.float32)
X_test  = np.hstack([X_te_num, X_te_cat]).astype(np.float32)

Xtr = torch.tensor(X_train, dtype=torch.float32)
ytr = torch.tensor(y_tr, dtype=torch.long)
Xte = torch.tensor(X_test,  dtype=torch.float32)
yte = torch.tensor(y_te,    dtype=torch.long)

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
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)

model.train()
for _ in range(30):
    for xb, yb in train_loader:
        logits = model(xb)
        loss = criterion(logits, yb)
        optimizer.zero_grad(); loss.backward(); optimizer.step()

model.eval()
with torch.no_grad():
    acc = accuracy_score(y_te, torch.argmax(model(Xte), dim=1).cpu().numpy())
print(f"Test accuracy: {acc:.3f}")

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

def build_field_slices(ohe_obj: OneHotEncoder):
    # numeric first (base + engineered), each as single column
    base_num_names = [f"num_{c}" for c in NUMERIC_COLS] + ENGINEERED_NUMERIC_COLS
    field_slices = [(n, (i, i+1)) for i, n in enumerate(base_num_names)]

    # categoricals grouped by original field
    start = len(base_num_names)
    cat_feature_names = ohe_obj.get_feature_names_out()
    # They look like "cat_2_January"; group by "cat_2" etc.
    prefixes = [fn.split("_")[0] + "_" + fn.split("_")[1] for fn in cat_feature_names]
    cat_cols_named = [f"cat_{c}" for c in CATEGORICAL_COLS]
    idx = start
    for cname in cat_cols_named:
        count = sum(1 for p in prefixes if p == cname)
        field_slices.append((cname, (idx, idx + count)))
        idx += count
    return field_slices

FIELD_SLICES = build_field_slices(ohe)

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
def build_row_from_user_payload(payload: Dict[str, Any]) -> list:
    """
    Build a 24-field row from user-provided form JSON. Everything not asked of the user
    is set to neutral defaults (to be replaced later via bureau/open-banking on server).
    EXPECTED keys from React:
      - income_monthly (float)
      - housing_cost_monthly (float)
      - other_expenses_monthly (float, optional)
      - employment_role (str)
      - years_at_job (float)
      - loans (list[str])  e.g., ["Auto Loan", "Credit Card"]
      - age (float)
      - application_month (str, e.g., "January") [optional]
      - spending_pattern_hint (str, optional)
      - status_hint (str in {"Good","Standard","Poor"}, optional)
    """
    from datetime import datetime
    income = float(payload.get("income_monthly", 0.0))
    housing = float(payload.get("housing_cost_monthly", 0.0))
    other  = float(payload.get("other_expenses_monthly", 0.0))
    expenses = housing + other

    job = str(payload.get("employment_role", "Unknown"))
    years_at_job = float(payload.get("years_at_job", 0.0))
    months_at_job = int(round(years_at_job * 12))

    loans_list = payload.get("loans", []) or []
    loans_str = ", ".join(loans_list) if loans_list else "Credit Card"

    age = float(payload.get("age", 0))
    app_month = payload.get("application_month") or datetime.utcnow().strftime("%B")
    spending_pattern = payload.get("spending_pattern_hint", "Medium_spent_Medium_value_payments")
    status = payload.get("status_hint", "Standard")

    # neutral defaults (replace later with verified sources)
    credit_lines_open = 0
    repayments_on_time = 0
    credit_utilization_tier = 0
    num_loans = len(loans_list) if loans_list else 1
    missed_payments = 0
    interest_rate = 12.0
    loan_grade = 3.0
    bureau_score = 700.0
    monthly_payment = 0.0
    obligations = 0.0

    row = [None] * 24
    row[0] = "USER"
    row[1] = "CUS_USER"
    row[2] = app_month
    row[3] = "REDACTED"
    row[4] = age
    row[5] = "XXX-XX-XXXX"
    row[6] = job
    row[7] = income
    row[8] = expenses
    row[9] = credit_lines_open
    row[10] = repayments_on_time
    row[11] = credit_utilization_tier
    row[12] = loans_str
    row[13] = num_loans
    row[14] = missed_payments
    row[15] = interest_rate
    row[16] = loan_grade
    row[17] = f"{months_at_job//12} Years and {months_at_job%12} Months"
    row[18] = status
    row[19] = bureau_score
    row[20] = monthly_payment
    row[21] = months_at_job
    row[22] = spending_pattern
    row[23] = obligations
    return row

# ───────────────── TRANSFORM & PREDICT ─────────────────
def transform_row_for_model(row: list):
    df = pd.DataFrame([row])
    num_df, cat_df = select_named(df)
    X_cat = ohe.transform(cat_df.astype(str))
    X_num = scaler.transform(num_df.apply(pd.to_numeric, errors="coerce").fillna(0))
    X_all = np.hstack([X_num, X_cat]).astype(np.float32)
    return torch.tensor(X_all, dtype=torch.float32), df

def predict_with_reasons(row: list):
    x, row_df = transform_row_for_model(row)
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    top_idx = int(np.argmax(probs))
    decision = CLASS_NAMES[top_idx]
    confidence = float(probs[top_idx]) * 100.0

    # --- Credit score (300–850) from P(Bad) ---
    p_default = float(probs[CLASS_NAMES.index("Bad")])
    credit_score = probability_to_score(p_default, method="linear")
    band = score_band(credit_score)

    # --- Friendly message ---
    if decision == "Good":
        message = f"✅ Score {credit_score:.0f} ({band}). Confidence {confidence:.1f}%."
    elif decision == "Standard":
        message = f"⚖️ Score {credit_score:.0f} ({band}). Confidence {confidence:.1f}%."
    else:
        message = f"⚠️ Score {credit_score:.0f} ({band}). Confidence {confidence:.1f}%."

    # ----- Patch B: Reasons (for Bad decision OR Poor band) -----
    need_reasons = (decision == "Bad") or (credit_score < 580)
    reasons = []
    if need_reasons:
        IG = try_import_captum()
        attr_ok = False
        if IG is not None:
            try:
                model.eval()
                # Attribute to the BAD class explicitly (aligns with adverse explanations)
                target_idx = CLASS_NAMES.index("Bad")
                ig = IG(model)
                baseline = torch.zeros_like(x)  # same dtype/device
                x_req = x.clone().requires_grad_(True)
                attr = ig.attribute(x_req, baseline, target=target_idx, n_steps=64)
                attr_vec = attr.detach().cpu().numpy().reshape(-1)

                # If IG produced meaningful signal, summarize it
                if np.nan_to_num(np.abs(attr_vec)).sum() > 1e-8:
                    reasons = summarize_reasons(attr_vec, row_df, top_k=4)
                    attr_ok = True
            except Exception:
                attr_ok = False

        # Fallback if IG missing/failed or produced no strings
        if (not attr_ok) or (not reasons):
            # requires fallback_reasons helper (see below if you haven't added it yet)
            reasons = fallback_reasons(row_df, top_k=4)

        # Guarantee at least 3 reasons so the UI never shows an empty list
        if len(reasons) < 3:
            extras = fallback_reasons(row_df, top_k=3)
            for r in extras:
                if r not in reasons:
                    reasons.append(r)
                if len(reasons) >= 3:
                    break

    return {
        "decision": decision,
        "confidence": round(confidence, 1),
        "probabilities": {k: float(v) for k, v in zip(CLASS_NAMES, probs)},
        "risk_probability": round(p_default, 6),
        "credit_score": round(credit_score, 0),
        "band": band,
        "message": message,
        "reasons": reasons,
    }

def fallback_reasons(row_df: pd.DataFrame, top_k: int = 4):
    """
    Rule-based reasons using raw values – used when IG is unavailable or empty.
    """
    reasons = []

    income = pd.to_numeric(row_df.iloc[0, 7], errors="coerce")
    expenses = pd.to_numeric(row_df.iloc[0, 8], errors="coerce")
    if pd.notna(income) and income < 3500:
        reasons.append("Low monthly income relative to obligations.")
    if pd.notna(expenses) and expenses > 2500:
        reasons.append("High monthly expenses reduce repayment capacity.")
    if pd.notna(income) and income > 0 and pd.notna(expenses):
        dti = expenses / income
        if dti >= 0.5:
            reasons.append("High debt-to-income ratio (DTI).")

    bureau = pd.to_numeric(row_df.iloc[0, 19], errors="coerce")
    if pd.notna(bureau) and bureau < 600:
        reasons.append("Low external bureau score.")

    obligations = pd.to_numeric(row_df.iloc[0, 23], errors="coerce")
    if pd.notna(obligations) and obligations > 300:
        reasons.append("High current obligations.")

    loans = str(row_df.iloc[0, 12] or "").lower()
    if "payday" in loans or "short-term" in loans:
        reasons.append("Recent or frequent payday/short-term loans.")

    pattern = str(row_df.iloc[0, 22] or "").lower()
    if "high_spent" in pattern:
        reasons.append("High spending pattern relative to income.")

    status = str(row_df.iloc[0, 18] or "").lower()
    if status == "poor":
        reasons.append("Reported credit status indicates elevated risk.")

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


def predict_from_user_payload(payload: Dict[str, Any]):
    row = build_row_from_user_payload(payload)
    return predict_with_reasons(row)

# ───────────────── CLI DEMO ─────────────────
if __name__ == "__main__":
    # Optional: make results a bit more repeatable during local runs
    import random
    random.seed(42); np.random.seed(42); torch.manual_seed(42)

    # ---- Bad applicant (should trigger reasons) ----
    bad_payload = {
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

    # ---- Standard-ish applicant ----
    standard_payload = {
        "income_monthly": 5600.0,
        "housing_cost_monthly": 1800.0,
        "other_expenses_monthly": 600.0,
        "employment_role": "Customer Support",
        "years_at_job": 3.0,
        "loans": ["Auto Loan", "Credit-Builder Loan"],
        "age": 35,
        "application_month": "September",
        "status_hint": "Standard",
        "spending_pattern_hint": "Medium_spent_Medium_value_payments"
    }

    # ---- Good applicant ----
    good_payload = {
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

    print("\n--- BAD EXAMPLE ---")
    out_bad = predict_from_user_payload(bad_payload)
    print(json.dumps(out_bad, indent=2))

    print("\n--- STANDARD EXAMPLE ---")
    out_std = predict_from_user_payload(standard_payload)
    print(json.dumps(out_std, indent=2))

    print("\n--- GOOD EXAMPLE ---")
    out_good = predict_from_user_payload(good_payload)
    print(json.dumps(out_good, indent=2))
