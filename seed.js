const mongoose = require('mongoose');
const { v7: uuidv7 } = require('uuid');
const Profile = require('./models/Profile');
const data = require('./seed_profiles.json');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

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

  console.log(`Done! Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
};

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
