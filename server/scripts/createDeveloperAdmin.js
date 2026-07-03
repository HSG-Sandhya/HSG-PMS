#!/usr/bin/env node

/**
 * Create additional developer/admin accounts
 * Usage: node scripts/createDeveloperAdmin.js [username] [password] [email]
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import User from '../models/User.js';
import Role from '../models/Role.js';
import Department from '../models/Department.js';

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function createDeveloperAdmin(username, password, email) {
  console.log(`🔧 Creating Developer Admin: ${username}`);
  
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      console.log(`⚠️  User already exists: ${existingUser.username}`);
      
      // Update existing user to be system admin
      existingUser.isSystemAdmin = true;
      existingUser.isActive = true;
      
      // Get System Administrator role
      const adminRole = await Role.findOne({ name: 'System Administrator' });
      if (adminRole) {
        existingUser.role = adminRole._id;
      }
      
      await existingUser.save();
      console.log(`✅ Updated ${existingUser.username} to System Administrator`);
      return existingUser;
    }

    // Get required references
    const adminRole = await Role.findOne({ name: 'System Administrator' });
    const adminDept = await Department.findOne({ name: 'Administration' });
    
    if (!adminRole) {
      console.error('❌ System Administrator role not found. Run setup script first.');
      process.exit(1);
    }
    
    if (!adminDept) {
      console.error('❌ Administration department not found. Run setup script first.');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create new developer admin
    const developerAdmin = await User.create({
      username,
      email,
      password: hashedPassword,
      phone: '9999999999', // Default phone
      firstName: 'Developer',
      lastName: 'Admin',
      role: adminRole._id,
      department: adminDept._id,
      isSystemAdmin: true,
      isActive: true,
      permissions: ['*'], // All permissions
      profile: {
        employeeId: `DEV${Date.now()}`,
        joiningDate: new Date()
      }
    });

    console.log('✅ Created developer admin successfully!');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: System Administrator`);
    
    return developerAdmin;
    
  } catch (error) {
    console.error('❌ Error creating developer admin:', error.message);
    throw error;
  }
}

async function listAdmins() {
  console.log('\n👥 Current System Administrators:');
  console.log('================================');
  
  const admins = await User.find({ isSystemAdmin: true })
    .populate('role', 'name')
    .select('username email firstName lastName isActive');
    
  if (admins.length === 0) {
    console.log('❌ No system administrators found!');
    return;
  }
  
  admins.forEach((admin, index) => {
    console.log(`${index + 1}. ${admin.username} (${admin.firstName} ${admin.lastName})`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role?.name || 'N/A'}`);
    console.log(`   Status: ${admin.isActive ? 'Active' : 'Inactive'}`);
    console.log('');
  });
}

async function main() {
  console.log('🚀 Developer Admin Creator');
  console.log('==========================');
  
  await connectDB();
  
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // No arguments - just list existing admins
    await listAdmins();
    console.log('💡 Usage: node scripts/createDeveloperAdmin.js [username] [password] [email]');
    console.log('💡 Example: node scripts/createDeveloperAdmin.js developer dev123 dev@example.com');
  } else if (args.length >= 2) {
    // Create new admin
    const username = args[0];
    const password = args[1];
    const email = args[2] || `${username}@hotel-sandhya-grand.com`;
    
    await createDeveloperAdmin(username, password, email);
    await listAdmins();
  } else {
    console.log('❌ Invalid arguments. Usage: node scripts/createDeveloperAdmin.js [username] [password] [email]');
  }
  
  process.exit(0);
}

// Run the script
main().catch(console.error);
