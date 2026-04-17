const express = require('express');
const router = express.Router();
const { v7: uuidv7 } = require('uuid');
const Profile = require('../models/Profile');

// Helper: classify age group
const getAgeGroup = (age) => {
  if (age <= 12) return 'child';
  if (age <= 19) return 'teenager';
  if (age <= 59) return 'adult';
  return 'senior';
};

// POST /api/profiles
router.post('/', async (req, res) => {
  const { name } = req.body;

  // Validation
  if (!name || name === '') {
    return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
  }
  if (typeof name !== 'string') {
    return res.status(422).json({ status: 'error', message: 'Name must be a string' });
  }

  // Check for duplicate
  const existing = await Profile.findOne({ name: name.toLowerCase() });
  if (existing) {
    return res.status(200).json({
      status: 'success',
      message: 'Profile already exists',
      data: existing
    });
  }

  // Call all 3 APIs simultaneously
  try {
    const [genderRes, ageRes, nationRes] = await Promise.all([
      fetch(`https://api.genderize.io?name=${encodeURIComponent(name)}`),
      fetch(`https://api.agify.io?name=${encodeURIComponent(name)}`),
      fetch(`https://api.nationalize.io?name=${encodeURIComponent(name)}`)
    ]);

    const [genderData, ageData, nationData] = await Promise.all([
      genderRes.json(),
      ageRes.json(),
      nationRes.json()
    ]);

    // Edge cases
    if (!genderData.gender || genderData.count === 0) {
      return res.status(502).json({ status: 'error', message: 'Genderize returned an invalid response' });
    }
    if (!ageData.age) {
      return res.status(502).json({ status: 'error', message: 'Agify returned an invalid response' });
    }
    if (!nationData.country || nationData.country.length === 0) {
      return res.status(502).json({ status: 'error', message: 'Nationalize returned an invalid response' });
    }

    // Pick country with highest probability
    const topCountry = nationData.country.reduce((a, b) =>
      a.probability > b.probability ? a : b
    );

    // Build profile
    const profile = new Profile({
      id: uuidv7(),
      name: name.toLowerCase(),
      gender: genderData.gender,
      gender_probability: genderData.probability,
      sample_size: genderData.count,
      age: ageData.age,
      age_group: getAgeGroup(ageData.age),
      country_id: topCountry.country_id,
      country_probability: topCountry.probability,
      created_at: new Date().toISOString()
    });

    await profile.save();

    return res.status(201).json({ status: 'success', data: profile });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// GET /api/profiles
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.gender) filter.gender = req.query.gender.toLowerCase();
    if (req.query.country_id) filter.country_id = req.query.country_id.toLowerCase();
    if (req.query.age_group) filter.age_group = req.query.age_group.toLowerCase();

    const profiles = await Profile.find(filter);
    return res.status(200).json({
      status: 'success',
      count: profiles.length,
      data: profiles
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// GET /api/profiles/:id
router.get('/:id', async (req, res) => {
  try {
    const profile = await Profile.findOne({ id: req.params.id });
    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.status(200).json({ status: 'success', data: profile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// DELETE /api/profiles/:id
router.delete('/:id', async (req, res) => {
  try {
    const profile = await Profile.findOneAndDelete({ id: req.params.id });
    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

module.exports = router;
