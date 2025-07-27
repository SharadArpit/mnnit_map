const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mnnit-map', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Define Route schema
const routeSchema = new mongoose.Schema({
  floor: { type: String, required: true },
  geojson: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Route = mongoose.model('Route', routeSchema);

// Load and clean GeoJSON
const filePath = path.join(__dirname, 'ground-floor.geojson'); // Adjust filename as needed
const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Extract clean parts
const floor = raw.floor || 'Ground';
const geojson = raw.geojson;

if (!geojson || geojson.type !== 'FeatureCollection') {
  console.error('❌ Invalid GeoJSON format.');
  mongoose.connection.close();
  process.exit(1);
}

// Save to DB
const routeDoc = new Route({ floor, geojson });

routeDoc.save()
  .then(() => {
    console.log('✅ Cleaned GeoJSON saved to MongoDB');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Error saving to MongoDB:', err);
    mongoose.connection.close();
  });
