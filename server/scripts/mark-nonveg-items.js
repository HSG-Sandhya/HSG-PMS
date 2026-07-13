import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MenuItem from '../models/MenuItem.js';

dotenv.config();

// The menu was imported with isVeg defaulting to true, so every item shows the
// green (veg) marker. This one-off backfill flips isVeg=false for items whose
// NAME clearly indicates non-veg. The list is deliberately CONSERVATIVE — it only
// matches unambiguous meat/seafood/egg words, so it will never turn a genuine veg
// dish red. Anything it does NOT catch (e.g. "Seekh Kebab", "Tandoori …") stays
// green — review those in the UI and toggle them by hand. Fully reversible.
const NON_VEG = /(chicken|mutton|fish|prawn|keema|kheema|qeema|meat|lamb|goat|crab|shrimp|seafood|rogan\s*josh|\begg\b)/i;

async function run() {
  try {
    console.log('Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');

    const items = await MenuItem.find({});
    const toFlip = items.filter((i) => NON_VEG.test(i.name || '') && i.isVeg !== false);

    if (toFlip.length === 0) {
      console.log('Nothing to change — no veg-flagged items match the non-veg word list.');
    } else {
      console.log(`\nMarking ${toFlip.length} item(s) as NON-VEG (red):`);
      toFlip.forEach((i) => console.log(`   • ${i.name}`));
      await MenuItem.updateMany(
        { _id: { $in: toFlip.map((i) => i._id) } },
        { $set: { isVeg: false } },
      );
      console.log(`\n✅ Updated ${toFlip.length} item(s).`);
    }

    const stillVeg = await MenuItem.countDocuments({ isVeg: { $ne: false } });
    console.log(`\n${stillVeg} item(s) remain marked VEG (green) — review these in the UI and`);
    console.log('toggle any missed non-veg dishes by hand (pencil icon → Veg/Non-veg).');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

run();
