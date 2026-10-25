const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Serve Static Frontend Files
app.use(express.static(__dirname));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// User Schema (For Cross-Device Accounts)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password: { type: String, required: true }
});

// Operational Data Schema (For Dashboard Records)
const dataSchema = new mongoose.Schema({
  store: { type: Object, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const DashboardData = mongoose.model('DashboardData', dataSchema);

// --- API ENDPOINTS ---

// Serve Main Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. REGISTER ACCOUNT
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    const cleanUsername = username.toLowerCase().trim();
    
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username is already taken.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, username: cleanUsername, password: hashedPassword });
    await newUser.save();

    res.json({ success: true, message: 'Account registered successfully!' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// 2. LOGIN ACCOUNT
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username and password.' });
    }
    const cleanUsername = username.toLowerCase().trim();

    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    res.json({ success: true, name: user.name, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// 3. GET ALL DASHBOARD DATA
app.get('/api/data', async (req, res) => {
  try {
    let doc = await DashboardData.findOne();
    if (!doc) {
      doc = await DashboardData.create({ store: {} });
    }
    res.json(doc.store || {});
  } catch (err) {
    console.error('Fetch data error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

// 4. SAVE DASHBOARD DATA
app.post('/api/data', async (req, res) => {
  try {
    const newStore = req.body;
    await DashboardData.findOneAndUpdate(
      {}, 
      { store: newStore, updatedAt: Date.now() }, 
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Data synced with MongoDB!' });
  } catch (err) {
    console.error('Sync data error:', err);
    res.status(500).json({ error: 'Failed to sync data.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
