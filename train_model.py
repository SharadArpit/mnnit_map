import pandas as pd
import numpy as np
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

# Provided shop IDs
shop_ids = [
    "67e13cb212a99ad39a2b16ff",
    "67e1b9c512a99ad39a2b1703",
    "67e1b9c512a99ad39a2b1704",
    "67e1b9c512a99ad39a2b1705",
    "67e1b9c512a99ad39a2b1706",
    "67e1b9c512a99ad39a2b1707",
    "67e1b9c512a99ad39a2b1708",
    "67e1b9c512a99ad39a2b1709",
    "682a2c8d4ef9383cda0483ca"
]

# Generate dummy data
np.random.seed(42)
data = {
    "shop_id": np.random.choice(shop_ids, 200),
    "hour_of_day": np.random.randint(0, 24, 200),
    "day_of_week": np.random.randint(0, 7, 200),
    "status": np.random.choice(["open", "closed"], 200)
}
df = pd.DataFrame(data)

# Encode shop_id
le = LabelEncoder()
df["shop_id_encoded"] = le.fit_transform(df["shop_id"])

# Define features and labels
X = df[["shop_id_encoded", "hour_of_day", "day_of_week"]]
y = df["status"]

# Train model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

# Save model and encoder
with open("model.pkl", "wb") as f:
    pickle.dump(model, f)

with open("encoder.pkl", "wb") as f:
    pickle.dump(le, f)

print("✅ Model and encoder saved.")
