import pickle
import numpy as np
from datetime import datetime

# Load model and encoder
with open('shop_status_model.pkl', 'rb') as f:
    model = pickle.load(f)

with open('shop_id_encoder.pkl', 'rb') as f:
    encoder = pickle.load(f)

# Example prediction for shop2 at current time
shop_id = 'shop2'
hour = datetime.now().hour
day = datetime.now().weekday()

shop_id_encoded = encoder.transform([shop_id])[0]
features = np.array([[shop_id_encoded, hour, day]])
prediction = model.predict(features)

print("🟢 Predicted status:", "Open" if prediction[0] == 1 else "Closed")
