const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { dijkstra, haversine } = require('./dijkstra');
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


const RouteSchema = new mongoose.Schema({
  floor: { type: String, required: true },
  geojson: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Route = mongoose.model('Route', RouteSchema);

// Classroom location data
const classroomCoords = {
  "NLHC-1": { lat:25.492956019166098, lng:81.86301248174878, flr:'Ground' },
  "NLHC-2": {lat:25.492956019166098, lng:81.86301248174878, flr:'First' },
  "GW-1": { lat: 25.493910, lng: 81.862972, flr:'Ground' },
  "GW-2": { lat: 25.493888, lng: 81.862958, flr:'Ground' },
  "GW-3": { lat: 25.493843, lng: 81.863025 , flr:'Ground'},
  "GW-4": { lat: 25.493825, lng: 81.862967 , flr:'Ground'},
  "GW-5": { lat: 25.493910, lng: 81.862972, flr:'Ground' },
  "GW-6": { lat:25.493772, lng:81.863024, flr:'Ground'},
  "GW-7": { lat:25.493747, lng: 81.862953, flr:'Ground' },
  "GW-8": { lat:25.493726, lng:81.863026, flr:'Ground'},
  "GW-9": { lat: 25.493705, lng:81.862955, flr:'Ground' },
  "GW-10": {lat: 25.493695, lng:81.863030, flr:'Ground' },
  "GW-11": {lat: 25.493662, lng: 81.862957, flr:'Ground' },
  "GW-12": { lat: 25.493639, lng: 81.863029, flr:'Ground' },
  "GS-3": { lat:25.492836, lng: 81.8634907, flr:'Ground' },
  "GS-4": { lat: 25.4927201, lng:81.8635792 , flr:'Ground'},
  "GS-5": { lat:25.4928279,lng: 81.8632600, flr:'Ground' },
  "GS-6": { lat:25.492735, lng:81.863148, flr:'Ground' },
  "GS-7": {lat:25.492829, lng:81.863045, flr:'Ground'},
  "GS-8": { lat:25.492736, lng:81.863122, flr:'Ground'},
  "FW-3": { lat: 25.493843, lng: 81.863025, flr:'First' },
  "FW-4": { lat: 25.493825, lng: 81.862967 , flr:'First'},
  "FW-5": { lat: 25.493910, lng: 81.862972, flr:'First' },
  "FW-6": { lat:25.493772, lng:81.863024, flr:'First'},
  "FEW-15": { lat:25.493514, lng: 81.863178, flr:'First'},
  "FEW-1": { lat:25.493499,lng: 81.863555, flr:'First'},
  "SEW-1": { lat:25.493514, lng: 81.863178, flr:'Second'},
  "SEW-7": { lat:25.493499,lng: 81.863555, flr:'Second'},
  "SEW-8": { lat:25.493441,lng: 81.863072, flr:'Second'},
  "SEW-9": { lat:25.493500,lng:81.8630151, flr:'Second'},
  "SEW-10": {lat:25.493439,lng: 81.862974, flr:'Second'},
  "FN-1": {lat:25.49399067, lng:81.8643610, flr:'First'},
  "FN-3": {lat:25.49399426, lng:81.8642481, flr:'First'},
  "FN-4": {lat:25.49399713,lng:81.86408672, flr:'First'},
  "FE-16": {lat: 25.4928895,lng: 81.864410, flr:'First'},
  "FE-17": {lat:25.492831694, lng:81.8644067, flr:'First'},
  "FE-18": {lat:25.492746441,lng: 81.8644151, flr:'First'},
  "FC-1": {lat:25.49318640529978, lng:81.86372195238 , flr:'First'},
  "DESIGN CENTRE": { lat:25.492028084635727, lng:81.86198122698214, flr:'Ground'},
  "IGNOU LAB":{ lat:25.491853294751916, lng:81.86201651294077, flr:'Ground'},
  "SOFTWARE TESTING LAB":{ lat:25.491978376955426, lng:81.8618226977062, flr:'Ground'},
  "IMAGE PROCESSING LAB":{ lat:25.492063585871996, lng:81.8618301896995, flr:'First'},
  "Computer Vision Lab":{ lat:25.492063585871996, lng:81.8618301896995, flr:'First'},
  "MICROPROCESSOR LAB":{lat: 25.4920635858, lng: 81.861830189, flr:'First'},
  "INFORMATION SECURITY LAB": {lat:25.491978376955426, lng:81.8618226977062, flr:'First'},
  "LHC-2":{lat:25.49168487911367, lng:81.86224075093176, flr:'Ground'},
  "LHC-3":{lat:25.491663238691423, lng:81.86237111161502, flr:'Ground'},
  "LHC-4":{lat:25.491835009435633, lng:81.862375606811, flr:'Ground'},
  "LHC-5":{lat:25.49168487911367, lng:81.86224075093176, flr:'First'},
  "LHC-6":{lat:25.491663238691423, lng:81.86237111161502, flr:'First'},
  "LHC-7":{lat:25.491835009435633, lng:81.862375606811, flr:'First'},
  "LHC-8":{lat:25.491835009435633, lng:81.862375606811, flr:'First'},
  "VERIFICATION AND VALIDATION LAB":{ lat:25.49130346213559, lng:81.86326739819306, flr:'First'},
  "COMPUTER CENTRE":{lat:25.491666626230366, lng:81.86314871042447, flr:'Ground'},
  "COMPUTING LAB":{lat:25.49130346213559, lng:81.86326739819306, flr:'First'},
  "DATA MINING LAB":{ lat:25.491318593994503, lng:81.86348532765743, flr:'Ground'},
  "COMPUTER NETWORKING LAB":{lat:25.491338568045354, lng:81.86348532765743, flr:'First'},
  "NB-1":{lat:25.49112482368182, lng:81.8634898610995, flr:'Ground'},
  "NB-2":{lat:25.49112482368182, lng:81.8634898610995, flr:'First'},
  "DISTRIBUTED COMPUTING LAB":{lat:25.491184352591855, lng:81.8634940262944, flr:'First'},
  "COMPUTER SCIENCE DEPARTMENT":{lat:25.491187434370417, lng:81.86340693424737, flr:'Ground'},
  "CC-1":{lat:25.49158328355494, lng:81.86314340723351, flr:'First'},
  "CC-2":{lat:25.49158328355494, lng:81.86314340723351, flr:'Second'},
  "RCG":{lat:25.49158328355494, lng:81.86314340723351, flr:'Ground'},
};

const stairs = [
  {
    ground: "25.4929,81.8630",
    first: "25.4929,81.8630"
  },
  {
    ground: "25.4928,81.8632",
    first: "25.4928,81.8632"
  }
];

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

app.get('/routes', async (req, res) => {
  try {
    const routes = await Route.find();
    res.json(routes); // Send all saved routes from MongoDB
  } catch (err) {
    console.error('Error fetching routes:', err);
    res.status(500).json({ error: 'Failed to fetch routes' });
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

  // Check for navigation query: "navigate me from X to Y"
const navMatch = msg.match(/(?:navigate|direction|go)\s+(?:me\s+)?from\s+([a-z0-9-]+)\s+to\s+([a-z0-9-]+)/i);
if (navMatch) {
  const fromRoom = navMatch[1].toUpperCase();
  const toRoom = navMatch[2].toUpperCase();
  const fromLoc = classroomCoords[fromRoom];
  const toLoc = classroomCoords[toRoom];

  if (!fromLoc || !toLoc) {
    return res.json({ reply: `Sorry, I don’t have location info for ${fromRoom} or ${toRoom}.` });
  }

  return res.json({
    reply: `Navigating from ${fromRoom} to ${toRoom}.`,
    from: fromRoom,
    to: toRoom,
    fromLocation: fromLoc,
    toLocation: toLoc
  });
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



app.get('/classroom/:roomId', (req, res) => {
  const room = req.params.roomId.toUpperCase();
  const coord = classroomCoords[room];
  if (!coord) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ room: room, location: coord });
});

// --- Routes (Navigation) ---
// Utility: Build floor-wise graph from GeoJSON
async function buildGraphs() {
  const routes = await Route.find();
  const graphs = {};

  for (const { floor, geojson } of routes) {
    if (!graphs[floor]) graphs[floor] = {};
      

    
    for (const feat of geojson.features) {
      if (feat.geometry.type === 'LineString') {
        const coords = feat.geometry.coordinates;
        for (let i = 0; i < coords.length - 1; i++) {
          const [lng1, lat1] = coords[i];
          const [lng2, lat2] = coords[i + 1];
          const key1 = `${lat1},${lng1}`;
          const key2 = `${lat2},${lng2}`;
          const dist = haversine([lat1, lng1], [lat2, lng2]);

          if (!graphs[floor][key1]) graphs[floor][key1] = [];
          if (!graphs[floor][key2]) graphs[floor][key2] = [];

          graphs[floor][key1].push([key2, dist]);
          graphs[floor][key2].push([key1, dist]);
        }
      }
    }
  }

  // Connect stairs between floors
  for (const stair of stairs) {
    const [gKey, fKey] = [stair.ground, stair.first];
    if (!graphs['Ground'][gKey]) graphs['Ground'][gKey] = [];
    if (!graphs['First'][fKey]) graphs['First'][fKey] = [];
    graphs['Ground'][gKey].push([fKey, 2]);
    graphs['First'][fKey].push([gKey, 2]);
  }

  return graphs;
}

// Add temporary classroom to graph
function snapToGraph(coord, floor, graph) {
  const key = `${coord.lat},${coord.lng}`;

  // ✅ Ensure floor-level graph exists
  if (!graph[floor]) graph[floor] = {};

  // ✅ Add temporary node
  graph[floor][key] = [];

  let nearest = null;
  let minDist = Infinity;

  for (const node of Object.keys(graph[floor])) {
    if (node === key) continue;
    const dist = haversine([coord.lat, coord.lng], node.split(',').map(Number));
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }

  if (nearest) {
    graph[floor][key].push([nearest, minDist]);
    graph[floor][nearest].push([key, minDist]);
  }

  return key;
}

// Navigation endpoint
app.post('/navigate', async (req, res) => {
  const { from, to } = req.body;

  const toCoord = classroomCoords[to.toUpperCase()];
  if (!toCoord) return res.status(400).json({ error: 'Invalid destination classroom name' });

  let fromCoord;
  if (typeof from === 'string') {
    const known = classroomCoords[from.toUpperCase()];
    if (!known) return res.status(400).json({ error: 'Invalid source classroom name' });
    fromCoord = known;
  } else if (typeof from === 'object' && from.lat && from.lng) {
    fromCoord = {
      lat: from.lat,
      lng: from.lng,
      flr: from.flr || 'Ground' // fallback floor
    };
  } else {
    return res.status(400).json({ error: 'Invalid "from" data' });
  }

  const graphs = await buildGraphs();

  // ✅ Use correct property name 'flr'
  const startKey = snapToGraph(fromCoord, fromCoord.flr, graphs);
  const endKey = snapToGraph(toCoord, toCoord.flr, graphs);

  // ✅ Merge all floor graphs into one
  const mergedGraph = Object.values(graphs).reduce((acc, g) => ({ ...acc, ...g }), {});

  const path = dijkstra(mergedGraph, startKey, endKey);
  res.json({ path });
});


// Classroom info route
app.get('/classroom/:id', (req, res) => {
  const room = req.params.id.toUpperCase();
  const data = classroomCoords[room];
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json({ room, location: data });
});

// Page Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.get('/marketplace', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'marketplace.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0',() => console.log(`🚀 Server running at http://localhost:${PORT}`));