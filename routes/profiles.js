const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Profile = require('../models/Profile');

const getAgeGroup = (age) => {
  if (age <= 12) return 'child';
  if (age <= 19) return 'teenager';
  if (age <= 59) return 'adult';
  return 'senior';
};

const COUNTRY_MAP = {
  'nigeria': 'NG', 'ghana': 'GH', 'kenya': 'KE', 'uganda': 'UG',
  'tanzania': 'TZ', 'ethiopia': 'ET', 'angola': 'AO', 'cameroon': 'CM',
  'senegal': 'SN', 'mali': 'ML', 'niger': 'NE', 'chad': 'TD',
  'sudan': 'SD', 'egypt': 'EG', 'morocco': 'MA', 'tunisia': 'TN',
  'algeria': 'DZ', 'libya': 'LY', 'somalia': 'SO', 'rwanda': 'RW',
  'zambia': 'ZM', 'zimbabwe': 'ZW', 'mozambique': 'MZ', 'madagascar': 'MG',
  'south africa': 'ZA', 'botswana': 'BW', 'namibia': 'NA', 'malawi': 'MW',
  'congo': 'CG', 'drc': 'CD', 'ivory coast': 'CI', 'burkina faso': 'BF',
  'togo': 'TG', 'benin': 'BJ', 'liberia': 'LR', 'sierra leone': 'SL',
  'guinea': 'GN', 'gambia': 'GM', 'gabon': 'GA', 'eritrea': 'ER',
  'cape verde': 'CV', 'mauritius': 'MU'
};

const parseNaturalQuery = (q) => {
  const text = q.toLowerCase();
  const filter = {};
  let interpreted = false;

  // Gender
  if (text.includes('female')) { 
    filter.gender = 'female'; 
    interpreted = true; 
  } else if (text.includes('male')) { 
    filter.gender = 'male'; 
    interpreted = true; 
  }

  // Age groups - don't use else if to allow combinations with age ranges
  if (text.includes('young')) {
    filter.age = { $gte: 16, $lte: 24 };
    interpreted = true;
  } else if (text.includes('child')) {
    filter.age_group = 'child'; 
    interpreted = true;
  } else if (text.includes('teenager')) {
    filter.age_group = 'teenager'; 
    interpreted = true;
  } else if (text.includes('adult')) {
    filter.age_group = 'adult'; 
    interpreted = true;
  } else if (text.includes('senior')) {
    filter.age_group = 'senior'; 
    interpreted = true;
  }

  // above/below patterns - these can combine with age groups
  const aboveMatch = text.match(/above\s+(\d+)/);
  if (aboveMatch) {
    if (!filter.age) {
      filter.age = {};
    }
    filter.age.$gte = Number(aboveMatch[1]);
    interpreted = true;
  }
  
  const belowMatch = text.match(/below\s+(\d+)/);
  if (belowMatch) {
    if (!filter.age) {
      filter.age = {};
    }
    filter.age.$lte = Number(belowMatch[1]);
    interpreted = true;
  }

  // Country - check multi-word first
  for (const [country, code] of Object.entries(COUNTRY_MAP)) {
    if (text.includes(country)) {
      filter.country_id = code;
      interpreted = true;
      break;
    }
  }

  return interpreted ? filter : null;
};

// POST /api/profiles
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (name === undefined || name === '') {
    return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
  }
  if (typeof name !== 'string') {
    return res.status(422).json({ status: 'error', message: 'Name must be a string' });
  }

  try {
    const existing = await Profile.findOne({ name: name.toLowerCase() });
    if (existing) {
      return res.status(200).json({ status: 'success', message: 'Profile already exists', data: existing });
    }

    const [genderRes, ageRes, nationRes] = await Promise.all([
      fetch(`https://api.genderize.io?name=${encodeURIComponent(name)}`),
      fetch(`https://api.agify.io?name=${encodeURIComponent(name)}`),
      fetch(`https://api.nationalize.io?name=${encodeURIComponent(name)}`)
    ]);

    const [genderData, ageData, nationData] = await Promise.all([
      genderRes.json(), ageRes.json(), nationRes.json()
    ]);

    if (!genderData.gender || genderData.count === 0) {
      return res.status(502).json({ status: 'error', message: 'Genderize returned an invalid response' });
    }
    if (!ageData.age) {
      return res.status(502).json({ status: 'error', message: 'Agify returned an invalid response' });
    }
    if (!nationData.country || nationData.country.length === 0) {
      return res.status(502).json({ status: 'error', message: 'Nationalize returned an invalid response' });
    }

    const topCountry = nationData.country.reduce((a, b) =>
      a.probability > b.probability ? a : b
    );

    const profile = new Profile({
      id: uuidv4(),
      name: name.toLowerCase(),
      gender: genderData.gender,
      gender_probability: genderData.probability,
      sample_size: genderData.count,
      age: ageData.age,
      age_group: getAgeGroup(ageData.age),
      country_id: topCountry.country_id,
      country_name: '',
      country_probability: topCountry.probability,
      created_at: new Date().toISOString()
    });

    await profile.save();
    return res.status(201).json({ status: 'success', data: profile });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/profiles/search
router.get('/search', async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;

  if (!q || q.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Missing or empty query' });
  }

  const filter = parseNaturalQuery(q);
  if (!filter) {
    return res.status(400).json({ status: 'error', message: 'Unable to interpret query' });
  }

  try {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await Profile.countDocuments(filter);
    const profiles = await Profile.find(filter).skip(skip).limit(limitNum);

    return res.status(200).json({
      status: 'success',
      page: pageNum,
      limit: limitNum,
      total,
      data: profiles
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/profiles
router.get('/', async (req, res) => {
  try {
    const {
      gender, age_group, country_id,
      min_age, max_age,
      min_gender_probability, min_country_probability,
      sort_by, order,
      page = 1, limit = 10
    } = req.query;

    // Validate sort_by
    const allowedSortFields = ['age', 'created_at', 'gender_probability'];
    if (sort_by && !allowedSortFields.includes(sort_by)) {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }

    const filter = {};
    if (gender) filter.gender = gender.toLowerCase();
    if (age_group) filter.age_group = age_group.toLowerCase();
    if (country_id) filter.country_id = country_id.toUpperCase();

    if (min_age || max_age) {
      filter.age = {};
      if (min_age) filter.age.$gte = Number(min_age);
      if (max_age) filter.age.$lte = Number(max_age);
    }
    if (min_gender_probability) {
      filter.gender_probability = { $gte: Number(min_gender_probability) };
    }
    if (min_country_probability) {
      filter.country_probability = { $gte: Number(min_country_probability) };
    }

    const sortField = sort_by || 'created_at';
    const sortOrder = order === 'desc' ? -1 : 1;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await Profile.countDocuments(filter);
    const profiles = await Profile.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      status: 'success',
      page: pageNum,
      limit: limitNum,
      total,
      data: profiles
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
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
    return res.status(500).json({ status: 'error', message: err.message });
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
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
