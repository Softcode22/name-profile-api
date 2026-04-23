const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const profileRoutes = require('./routes/profiles');

const app = express();

app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.use('/api/profiles', profileRoutes);

app.get('/seed', async (req, res) => {
  try {
    const { v7: uuidv7 } = require('uuid');
    const Profile = require('./models/Profile');
    const data = require('./seed_profiles.json');

    let inserted = 0;
    let skipped = 0;

    for (const profile of data.profiles) {
      const exists = await Profile.findOne({ name: profile.name });
      if (exists) { skipped++; continue; }
      await Profile.create({
        id: uuidv7(),
        ...profile,
        created_at: new Date().toISOString()
      });
      inserted++;
    }

    return res.json({ status: 'success', inserted, skipped });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = app;
