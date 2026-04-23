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

    const profiles = data.profiles.map(profile => ({
      id: uuidv7(),
      ...profile,
      created_at: new Date().toISOString()
    }));

    const result = await Profile.insertMany(profiles, { ordered: false });

    return res.json({ 
      status: 'success', 
      inserted: result.length
    });
  } catch (err) {
    // ordered:false means duplicates are skipped, not crashed
    if (err.insertedDocs) {
      return res.json({ status: 'success', inserted: err.insertedDocs.length });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  }
});
