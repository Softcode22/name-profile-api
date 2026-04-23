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

module.exports = app;
