const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  gender: { type: String },
  gender_probability: { type: Number },
  sample_size: { type: Number },
  age: { type: Number },
  age_group: { type: String },
  country_id: { type: String },
  country_name: { type: String },
  country_probability: { type: Number },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Profile', profileSchema);
