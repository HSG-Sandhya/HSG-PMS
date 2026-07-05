import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Department from '../models/Department.js';
import dotenv from 'dotenv';

dotenv.config();

// Credentials for the admin to create. Override any of these from the shell so
// you can seed a fresh database with your own login, e.g.
//   ADMIN_USERNAME='Manager' ADMIN_PASSWORD='Secret123@' node scripts/createAdmin.js
// (falls back to the original values when not provided).
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Vikash_HSG';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Nakedeyes25@';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kushvik0908@gmail.com';

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Option to clear existing users (uncomment if needed for fresh start)
    // await User.deleteMany({});
    // console.log('Cleared existing users');

    // Check if admin role exists, create if not
    let adminRole = await Role.findOne({ name: 'System Administrator' });
    if (!adminRole) {
      console.log('Creating System Administrator role...');
      adminRole = new Role({
        name: 'System Administrator',
        description: 'Full system access with all administrative privileges',
        hierarchy: 10,
        permissions: [
          'admin_access', 'system_admin', 'manage_settings', 'manage_staff', 
          'manage_roles', 'manage_users', 'view_dashboard', 'manage_bookings',
          'manage_rooms', 'manage_guests', 'manage_payments', 'manage_housekeeping',
          'manage_restaurant', 'manage_pos', 'manage_events', 'manage_channels'
        ],
        accessLevel: {
          canViewAll: true,
          canEditAll: true,
          canDeleteAll: true,
          canManageUsers: true,
          canManageRoles: true,
          canAccessSettings: true,
          canViewReports: true,
          canManageSystem: true
        },
        settings: {
          canManageSettings: true,
          canManageRoles: true,
          canManageStaff: true,
          canAccessAdminPanel: true,
          canViewSystemLogs: true,
          canManageBackups: true
        },
        isActive: true
      });
      await adminRole.save();
      console.log('System Administrator role created');
    }

    // Check if management department exists, create if not
    let department = await Department.findOne({ name: 'Management' });
    if (!department) {
      console.log('Creating Management department...');
      department = new Department({
        name: 'Management',
        description: 'Executive and administrative management',
        isActive: true,
        color: '#EC4899'
      });
      await department.save();
      console.log('Management department created');
    }

    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      $or: [
        { username: ADMIN_USERNAME },
        { email: ADMIN_EMAIL }
      ]
    });

    if (existingAdmin) {
      console.log('Updating existing user to admin...');
      existingAdmin.role = adminRole._id;
      existingAdmin.department = department._id;
      existingAdmin.isActive = true;
      existingAdmin.isSystemAdmin = true;
      await existingAdmin.save();
      console.log(`User ${existingAdmin.username} updated to admin`);
    } else {
      console.log('Creating new admin user...');
      
      const adminUser = new User({
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD, // Let the model hash it with correct rounds
        firstName: 'System',
        lastName: 'Administrator',
        phone: '9931567123',
        role: adminRole._id,
        department: department._id,
        profile: {
          employeeId: 'ADMIN001',
          joiningDate: new Date()
        },
        isActive: true,
        isSystemAdmin: true
      });

      await adminUser.save();
      console.log('✅ Admin user created successfully!');
      console.log(`Username: ${ADMIN_USERNAME}`);
      console.log(`Password: ${ADMIN_PASSWORD}`);

      // Verify the user was created with proper password hash
      const savedUser = await User.findOne({ username: ADMIN_USERNAME }).select('+password');
      console.log('User saved with password hash:', savedUser.password.substring(0, 20) + '...');
    }

    // Also update any existing users to have admin access if needed
    const allUsers = await User.find({}).populate('role');
    console.log(`\nFound ${allUsers.length} users in database:`);
    
    for (const user of allUsers) {
      console.log(`- ${user.username} (${user.email}) - Role: ${user.role?.name || 'No Role'}`);
      
      // If user has no role or a basic role, offer to make them admin
      if (!user.role || user.role.hierarchy < 5) {
        user.role = adminRole._id;
        user.department = department._id;
        await user.save();
        console.log(`  → Updated ${user.username} to admin role`);
      }
    }

    console.log('\n✅ Admin setup complete!');
    console.log('You can now login with:');
    console.log(`Username: ${ADMIN_USERNAME}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log('\nOr use any existing user - they now have admin privileges.');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

createAdminUser();
