const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27017/mnnit-map';

const ShopSchema = new mongoose.Schema({
  name: String,
  location: {
    lat: Number,
    lng: Number,
  },
  status: String,
  updatedBy: String,
  updatedAt: Date,
});

const Shop = mongoose.model('Shop', ShopSchema);

async function updateShops() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Update shops missing updatedAt or updatedBy
    const result = await Shop.updateMany(
      {
        $or: [
          { updatedAt: { $exists: false } },
          { updatedBy: { $exists: false } },
        ],
      },
      {
        $set: {
          updatedAt: new Date(),
          updatedBy: 'Unknown',
        },
      }
    );

    console.log(`${result.modifiedCount} shop documents updated.`);
  } catch (err) {
    console.error('Error updating shops:', err);
  } finally {
    mongoose.disconnect();
  }
}

updateShops();
