import os, json, pandas as pd

TRAIN_CSV = "../creditmodel/input/train.csv"

df = pd.read_csv(TRAIN_CSV, dtype=str, low_memory=False)
vals = df["Type_of_Loan"].astype(str).str.strip()
top = vals.value_counts().index.tolist()     # ALL, ordered by frequency
top50 = vals.value_counts().head(200).index.tolist()

print("/* ---- FULL LIST (freq desc) ---- */")
print(json.dumps(top, ensure_ascii=False, indent=2))
print("\n/* ---- TOP 50 ---- */")
print(json.dumps(top50, ensure_ascii=False, indent=2))
