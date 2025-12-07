import pandas as pd
df = pd.read_csv("../creditmodel/input/train.csv", dtype=str, low_memory=False)
print(list(df.columns))
