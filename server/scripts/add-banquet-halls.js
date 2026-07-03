import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BanquetHall from '../models/BanquetHall.js';

dotenv.config();

async function addBanquetHalls() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if halls already exist
    const existingCount = await BanquetHall.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  ${existingCount} banquet halls already exist`);
    }

    const banquetHalls = [
      {
        name: 'Grand Ballroom',
        capacity: 500,
        area: 3500,
        pricePerHour: 25000,
        description: 'Spacious and elegant ballroom perfect for large weddings and corporate events',
        amenities: ['AC', 'Parking', 'WiFi', 'Catering', 'Stage', 'Sound System', 'Projection'],
        isAvailable: true,
        setupOptions: ['Theater', 'Classroom', 'Banquet', 'Conference'],
        images: ['https://via.placeholder.com/400x300?text=Grand+Ballroom'],
        location: 'Main Building - Ground Floor'
      },
      {
        name: 'Crystal Hall',
        capacity: 300,
        area: 2000,
        pricePerHour: 15000,
        description: 'Modern and sophisticated hall suitable for weddings, conferences, and exhibitions',
        amenities: ['AC', 'Parking', 'WiFi', 'Catering', 'Natural Light', 'Sound System'],
        isAvailable: true,
        setupOptions: ['Theater', 'Banquet', 'Conference', 'U-Shape'],
        images: ['https://via.placeholder.com/400x300?text=Crystal+Hall'],
        location: 'Main Building - First Floor'
      },
      {
        name: 'Garden Pavilion',
        capacity: 150,
        area: 1200,
        pricePerHour: 8000,
        description: 'Beautiful outdoor pavilion with scenic views, ideal for intimate events and receptions',
        amenities: ['Parking', 'WiFi', 'Catering', 'Natural Light', 'Bar Counter'],
        isAvailable: true,
        setupOptions: ['Cocktail', 'Banquet', 'Theater'],
        images: ['https://via.placeholder.com/400x300?text=Garden+Pavilion'],
        location: 'Garden Area'
      },
      {
        name: 'Emerald Room',
        capacity: 100,
        area: 800,
        pricePerHour: 5000,
        description: 'Intimate and cozy room perfect for small meetings, seminars, and private celebrations',
        amenities: ['AC', 'WiFi', 'Projector', 'Sound System'],
        isAvailable: true,
        setupOptions: ['Classroom', 'Conference', 'U-Shape', 'Theater'],
        images: ['https://via.placeholder.com/400x300?text=Emerald+Room'],
        location: 'Main Building - Second Floor'
      },
      {
        name: 'Sapphire Suite',
        capacity: 200,
        area: 1500,
        pricePerHour: 12000,
        description: 'Premium suite with modern amenities, ideal for product launches and corporate dinners',
        amenities: ['AC', 'Parking', 'WiFi', 'Catering', 'Stage', 'Professional Lighting'],
        isAvailable: true,
        setupOptions: ['Theater', 'Banquet', 'Conference'],
        images: ['https://via.placeholder.com/400x300?text=Sapphire+Suite'],
        location: 'Annex Building - Ground Floor'
      }
    ];

    // Add halls
    const result = await BanquetHall.insertMany(banquetHalls);
    console.log(`✅ Successfully added ${result.length} banquet halls`);
    
    // Display the added halls
    const halls = await BanquetHall.find();
    console.log('\n📋 All Banquet Halls:');
    halls.forEach((hall, index) => {
      console.log(`${index + 1}. ${hall.name} - Capacity: ${hall.capacity}, Price: ₹${hall.pricePerHour}/hr`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addBanquetHalls();
