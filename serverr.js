const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const app = express();
const PORT = 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'mysecret';

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'public')));

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/mnnit-map')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Schemas
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const ShopSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    status: { type: String, enum: ['open', 'closed'], default: 'closed' },
    updatedBy: { type: String, default: 'Unknown' },
    updatedAt: { type: Date, default: Date.now },
    votes: { type: Number, default: 0 }
});
const Shop = mongoose.model('Shop', ShopSchema);

const lostFoundSchema = new mongoose.Schema({
    type: String,
    item: String,
    description: String,
    location: String,
    contact: String,
    timestamp: { type: Date, default: Date.now }
});
const LostFound = mongoose.model('LostFound', lostFoundSchema);

const AdvertisementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { 
        type: String, 
        required: true,
        enum: ['electronics', 'books', 'furniture', 'clothing', 'other']
    },
    contact: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Advertisement = mongoose.model('Advertisement', AdvertisementSchema);

const StatusHistorySchema = new mongoose.Schema({
    shopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['open', 'closed'], required: true },
    timestamp: { type: Date, default: Date.now }
});
const StatusHistory = mongoose.model('StatusHistory', StatusHistorySchema);

// Middleware
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

// Routes
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hash });
        await user.save();
        res.json({ message: 'Signup successful' });
    } catch (err) {
        res.status(500).json({ error: 'Signup failed' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password)))
            return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Shop Routes
app.get('/shops', async (req, res) => {
    try {
        const shops = await Shop.find();
        res.json(shops);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch shops' });
    }
});

app.post('/shops', verifyToken, async (req, res) => {
    const { name, location } = req.body;
    try {
        const shop = new Shop({
            name,
            location,
            updatedBy: req.user.username,
            updatedAt: new Date()
        });
        await shop.save();
        res.json({ message: 'Shop added', shop });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add shop' });
    }
});

app.put('/shops/:id', verifyToken, async (req, res) => {
    const { status } = req.body;
    try {
        const shop = await Shop.findById(req.params.id);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        shop.status = status;
        shop.updatedBy = req.user.username;
        shop.updatedAt = new Date();
        shop.votes = 0;

        await shop.save();
        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update shop' });
    }
});

app.post('/shops/:id/vote', verifyToken, async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.id);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        if (shop.votes === 3) {
            const historyEntry = new StatusHistory({
                shopId: shop._id,
                status: shop.status,
                timestamp: new Date()
            });
            await historyEntry.save();
        }
       
        shop.votes += 1;
        await shop.save();
        res.json({ message: 'Vote added', votes: shop.votes });
    } catch (err) {
        res.status(500).json({ error: 'Failed to vote' });
    }
});

// Lost & Found Routes
app.post('/lostfound', async (req, res) => {
    try {
        const entry = new LostFound(req.body);
        await entry.save();
        res.status(201).json({ message: 'Entry saved.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error saving entry.' });
    }
});

app.get('/lostfound', async (req, res) => {
    try {
        const entries = await LostFound.find().sort({ timestamp: -1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: 'Error retrieving entries.' });
    }
});

// Marketplace Routes
app.get('/ads', async (req, res) => {
    try {
        const ads = await Advertisement.find().sort({ createdAt: -1 });
        res.json(ads);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch ads' });
    }
});

app.post('/ads', verifyToken, async (req, res) => {
    try {
        const { title, description, price, category, contact } = req.body;
        
        const newAd = new Advertisement({
            title,
            description,
            price,
            category,
            contact,
            userId: req.user.id,
            username: req.user.username
        });

        const savedAd = await newAd.save();
        res.status(201).json(savedAd);
    } catch (err) {
        res.status(400).json({ error: 'Failed to create ad' });
    }
});

app.delete('/ads/:id', verifyToken, async (req, res) => {
    try {
        const ad = await Advertisement.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });
        
        if (!ad) return res.status(404).json({ error: 'Ad not found or unauthorized' });
        res.json({ message: 'Ad deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete ad' });
    }
});

// Prediction Route
app.get('/shops/:id/predict', async (req, res) => {
    const shopId = req.params.id;
    const now = new Date();
    const Hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    try {
        const response = await fetch('http://localhost:5003/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shop_id: shopId,
                hour: Hour,
                day_of_week: dayOfWeek
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(500).json({ error: 'Flask API error', details: errorData });
        }

        const data = await response.json();
        res.json({ predictedStatus: data.predicted_status });
    } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({ error: 'Prediction service unavailable' });
    }
});

// Chatbot Route
app.post('/chatbot', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ reply: "I didn't understand that." });
  }

  const msg = message.toLowerCase();

  // Check for classroom location query
  const match = msg.match(/where\s+(?:is|can i find)\s+(?:class\s+)?([a-z0-9-]+)/i);
  if (match) {
    const roomQuery = match[1].toUpperCase();
    const location = classroomCoords[roomQuery];
    if (location) {
      return res.json({
        reply: `Classroom ${roomQuery} is here.`,
        room: roomQuery,
        location,
      });
    } else {
      return res.json({ reply: `Sorry, I don't have location info for ${roomQuery}.` });
    }
  }

  // Fallback to shop status questions
  try {
    if (msg.includes("open shops") || msg.includes("which shops are open")) {
      const openShops = await Shop.find({ status: 'open' });
      if (openShops.length === 0) {
        return res.json({ reply: "No shops are currently open." });
      }
      const names = openShops.map(shop => shop.name).join(', ');
      return res.json({ reply: `Currently open shops: ${names}` });

    } else if (msg.includes("closed shops") || msg.includes("which shops are closed")) {
      const closedShops = await Shop.find({ status: 'closed' });
      if (closedShops.length === 0) {
        return res.json({ reply: "All shops are open right now." });
      }
      const names = closedShops.map(shop => shop.name).join(', ');
      return res.json({ reply: `Currently closed shops: ${names}` });

    } else if (msg.includes("help")) {
      return res.json({
        reply: "You can ask me things like:\n- Which shops are open?\n- Where is class LHC-1?"
      });
    }

    return res.json({ reply: "Sorry, I cannot answer that. Try asking 'which shops are open' or 'where is class LHC-1'." });

  } catch (err) {
    console.error('Chatbot error:', err);
    res.status(500).json({ reply: 'Something went wrong. Please try again later.' });
  }
});

// Classroom location data
const classroomCoords = {
  "NLHC-1": { lat:25.492956019166098, lng:81.86301248174878 },
  "NLHC-2": {lat:25.492956019166098, lng:81.86301248174878 },
  "GW-1": { lat: 25.493910, lng: 81.862972 },
  "GW-2": { lat: 25.493888, lng: 81.862958 },
  "GW-3": { lat: 25.493843, lng: 81.863025 },
  "GW-4": { lat: 25.493825, lng: 81.862967 },
  "GW-5": { lat: 25.493910, lng: 81.862972 },
  "GW-6": { lat:25.493772, lng:81.863024},
  "GW-7": { lat:25.493747, lng: 81.862953 },
  "GW-8": { lat:25.493726, lng:81.863026},
  "GW-9": { lat: 25.493705, lng:81.862955 },
  "GW-10": {lat: 25.493695, lng:81.863030 },
  "GW-11": {lat: 25.493662, lng: 81.862957 },
  "GW-12": { lat: 25.493639, lng: 81.863029 },
  "GS-3": { lat:25.492836, lng: 81.8634907 },
  "GS-4": { lat: 25.4927201, lng:81.8635792 },
  "GS-5": { lat:25.4928279,lng: 81.8632600 },
  "GS-6": { lat:25.492735, lng:81.863148 },
  "GS-7": {lat:25.492829, lng:81.863045},
  "GS-8": { lat:25.492736, lng:81.863122},
  "FW-3": { lat: 25.493843, lng: 81.863025 },
  "FW-4": { lat: 25.493825, lng: 81.862967 },
  "FW-5": { lat: 25.493910, lng: 81.862972 },
  "FW-6": { lat:25.493772, lng:81.863024},
  "FEW-15": { lat:25.493514, lng: 81.863178},
  "FEW-1": { lat:25.493499,lng: 81.863555},
  "SEW-1": { lat:25.493514, lng: 81.863178},
  "SEW-7": { lat:25.493499,lng: 81.863555},
  "SEW-8": { lat:25.493441,lng: 81.863072},
  "SEW-9": { lat:25.493500,lng:81.8630151},
  "SEW-10": {lat:25.493439,lng: 81.862974},
  "FN-1": {lat:25.49399067, lng:81.8643610},
  "FN-3": {lat:25.49399426, lng:81.8642481},
  "FN-4": {lat:25.49399713,lng:81.86408672},
  "FE-16": {lat: 25.4928895,lng: 81.864410},
  "FE-17": {lat:25.492831694, lng:81.8644067},
  "FE-18": {lat:25.492746441,lng: 81.8644151},
  "FC-1": {lat:25.49318640529978, lng:81.86372195238 },
  "DESIGN CENTRE": { lat:25.492028084635727, lng:81.86198122698214},
  "IGNOU LAB":{ lat:25.491853294751916, lng:81.86201651294077},
  "SOFTWARE TESTING LAB":{ lat:25.491978376955426, lng:81.8618226977062},
  "IMAGE PROCESSING LAB":{ lat:25.492063585871996, lng:81.8618301896995},
  "C":{ lat:25.492063585871996, lng:81.8618301896995},
  "MICROPROCESSOR LAB":{lat: 25.4920635858, lng: 81.861830189},
  "INFORMATION SECURITY LAB": {lat:25.491978376955426, lng:81.8618226977062},
  "LHC-2":{lat:25.49168487911367, lng:81.86224075093176},
  "LHC-3":{lat:25.491663238691423, lng:81.86237111161502},
  "LHC-4":{lat:25.491835009435633, lng:81.862375606811},
  "LHC-5":{lat:25.49168487911367, lng:81.86224075093176},
  "LHC-6":{lat:25.491663238691423, lng:81.86237111161502},
  "LHC-7":{lat:25.491835009435633, lng:81.862375606811},
  "LHC-8":{lat:25.491835009435633, lng:81.862375606811},
  "VERIFICATION AND VALIDATION LAB":{ lat:25.49130346213559, lng:81.86326739819306},
  "COMPUTER CENTRE":{lat:25.491666626230366, lng:81.86314871042447},
  "COMPUTING LAB":{lat:25.49130346213559, lng:81.86326739819306},
  "DATA MINING LAB":{ lat:25.491318593994503, lng:81.86348532765743},
  "COMPUTER NETWORKING LAB":{lat:25.491338568045354, lng:81.86348532765743},
  "NB-1":{lat:25.49112482368182, lng:81.8634898610995},
  "NB-2":{lat:25.49112482368182, lng:81.8634898610995},
  "DISTRIBUTED COMPUTING LAB":{lat:25.491184352591855, lng:81.8634940262944},
  "COMPUTER SCIENCE DEPARTMENT":{lat:25.491187434370417, lng:81.86340693424737},
  "CC-1":{lat:25.49158328355494, lng:81.86314340723351},
  "CC-2":{lat:25.49158328355494, lng:81.86314340723351},
  "RCG":{lat:25.49158328355494, lng:81.86314340723351},




  
  
  // Add allFWur rooms here
};

app.get('/classroom/:roomId', (req, res) => {
  const room = req.params.roomId.toUpperCase();
  const coord = classroomCoords[room];
  if (!coord) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ room: room, location: coord });
});


// Page Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.get('/marketplace', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'marketplace.html'));
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));