from flask import Flask, request, jsonify
import pickle
import numpy as np
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Load model and encoder
with open('model.pkl', 'rb') as f:
    model = pickle.load(f)

with open('encoder.pkl', 'rb') as f:
    encoder = pickle.load(f)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    shop_id = data.get('shop_id')
    hour = data.get('hour')
    day = data.get('day_of_week')

    if not all([shop_id, hour is not None, day is not None]):
        return jsonify({'error': 'Missing data'}), 400

    try:
        shop_id_encoded = encoder.transform([shop_id])[0]
    except:
        return jsonify({'error': 'Unknown shop_id'}), 400

    input_data = np.array([[shop_id_encoded, hour, day]])
    prediction = model.predict(input_data)[0]

    return jsonify({'predicted_status': prediction})

if __name__ == '__main__':
    app.run(port=5003)
