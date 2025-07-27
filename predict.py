from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

# Load the model and encoders
model = joblib.load('shop_status_model.pkl')
le_day = joblib.load('day_encoder.pkl')
le_status = joblib.load('status_encoder.pkl')
le_shop = joblib.load('shop_encoder.pkl')  # Added shop encoder

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        shop_id = data['shop_id']
        day = data['day_of_week']
        hour = int(data['hour'])

        # Encode categorical variables
        shop_encoded = le_shop.transform([shop_id])[0]
        day_encoded = le_day.transform([day])[0]

        # Make prediction
        features = np.array([[shop_encoded, day_encoded, hour]])
        pred = model.predict(features)[0]
        status = le_status.inverse_transform([pred])[0]

        return jsonify({'predicted_status': status})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5003, debug=True)
