import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BanquetHall from '../models/BanquetHall.js';
import BanquetBooking from '../models/BanquetBooking.js';

dotenv.config();

// The venue actually has two halls. This script removes the placeholder/demo
// halls and seeds the real two. Amenities are ordered with the headline
// facilities first (the website shows them in order).
const SHARED_AMENITIES = [
  'Lift Access',
  '71 KVA DG Power Backup',
  'In-house Catering',
  'Guest Rooms at Venue',
  'Air Conditioning',
  'Ample Parking',
  'Sound System',
  'Stage & Décor',
];

const SETUP_OPTIONS = ['Banquet', 'Theater', 'Conference', 'U-Shape', 'Classroom', 'Cocktail'];

const realHalls = [
  {
    name: 'Grand Hall',
    capacity: 200,
    area: 1500,
    pricePerDay: 60000, // full-day function, 10:00 AM – 10:00 PM
    pricePerHour: 2000, // birthday / hourly bookings
    description:
      'Our larger hall for weddings and big receptions — air-conditioned and column-free, with a stage, in-house catering, lift access and guest rooms upstairs.',
    amenities: SHARED_AMENITIES,
    isAvailable: true,
    setupOptions: SETUP_OPTIONS,
    images: ['/images/grand-hall.jpg'],
    location: 'Hotel Sandhya Grand, Bari Bazaar Road, Munger',
  },
  {
    name: 'Crystal Hall',
    capacity: 100,
    area: 1000,
    pricePerDay: 40000, // full-day function, 10:00 AM – 10:00 PM
    pricePerHour: 2000, // birthday / hourly bookings
    description:
      'An intimate, air-conditioned hall for engagements, birthdays and smaller gatherings — the same catering, parking, lift and rooms, on a cosier scale.',
    amenities: SHARED_AMENITIES,
    isAvailable: true,
    setupOptions: SETUP_OPTIONS,
    images: [],
    location: 'Hotel Sandhya Grand, Bari Bazaar Road, Munger',
  },
];

async function run() {
  try {
    console.log('Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');

    const refCount = await BanquetBooking.countDocuments();
    if (refCount > 0) {
      console.log(`⚠️  ${refCount} banquet booking(s) exist — aborting to avoid orphaning them.`);
      console.log('   Re-run only after confirming no bookings reference the demo halls.');
      process.exit(1);
    }

    const before = await BanquetHall.find().select('name');
    console.log(`Removing ${before.length} existing hall(s): ${before.map((h) => h.name).join(', ')}`);
    await BanquetHall.deleteMany({});

    const created = await BanquetHall.insertMany(realHalls);
    console.log(`✅ Inserted ${created.length} real halls:`);
    created.forEach((h) =>
      console.log(`   • ${h.name} — ${h.capacity} guests · ${h.area} sq ft · ₹${h.pricePerDay.toLocaleString('en-IN')}/day`),
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

run();
