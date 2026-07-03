import mongoose from 'mongoose';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Department from '../models/Department.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const fixUserRole = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the admin user
    const adminUser = await User.findOne({ username: 'Vikash_HSG' });
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log('📋 Current user data:');
    console.log('Role:', adminUser.role);
    console.log('Department:', adminUser.department);
    console.log('Role type:', typeof adminUser.role);

    // Find or create admin role
    let adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) {
      console.log('🔧 Creating admin role...');
      adminRole = new Role({
        name: 'admin',
        displayName: 'System Administrator',
        description: 'Full system access',
        permissions: ['*'], // All permissions
        accessLevel: {
          level: 1,
          canManageUsers: true,
          canManageRoles: true,
          canAccessSettings: true,
          canViewReports: true,
          pages: [
            { page: 'dashboard', canView: true, canEdit: true, canDelete: true },
            { page: 'rooms', canView: true, canEdit: true, canDelete: true },
            { page: 'bookings', canView: true, canEdit: true, canDelete: true },
            { page: 'guests', canView: true, canEdit: true, canDelete: true },
            { page: 'staff', canView: true, canEdit: true, canDelete: true },
            { page: 'housekeeping', canView: true, canEdit: true, canDelete: true },
            { page: 'restaurant', canView: true, canEdit: true, canDelete: true },
            { page: 'settings', canView: true, canEdit: true, canDelete: true },
            { page: 'reports', canView: true, canEdit: true, canDelete: true }
          ]
        },
        isActive: true
      });
      await adminRole.save();
      console.log('✅ Admin role created');
    }

    // Find or create admin department
    let adminDept = await Department.findOne({ name: 'Administration' });
    if (!adminDept) {
      console.log('🔧 Creating admin department...');
      adminDept = new Department({
        name: 'Administration',
        description: 'System Administration',
        isActive: true
      });
      await adminDept.save();
      console.log('✅ Admin department created');
    }

    // Update user with proper ObjectId references
    adminUser.role = adminRole._id;
    adminUser.department = adminDept._id;
    adminUser.isSystemAdmin = true;
    
    await adminUser.save();
    console.log('✅ User role and department updated successfully');

    // Verify the fix
    const updatedUser = await User.findOne({ username: 'Vikash_HSG' })
      .populate('role department');
    
    console.log('📋 Updated user data:');
    console.log('Role:', updatedUser.role?.name);
    console.log('Department:', updatedUser.department?.name);
    console.log('Is System Admin:', updatedUser.isSystemAdmin);

    console.log('🎉 User role fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing user role:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
    process.exit(0);
  }
};

fixUserRole();
