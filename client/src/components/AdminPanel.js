import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ToggleOff as ToggleOffIcon,
  ToggleOn as ToggleOnIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import api from '../api';
import { currencySym } from '../utils/billing';
import StaffDialog from './StaffDialog';
import RoleDialog from './RoleDialog';
import DepartmentDialog from './DepartmentDialog';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog states
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load staff, roles, departments, and permissions using authenticated api
      const [staffRes, rolesRes, permissionsRes, deptRes] = await Promise.all([
        api.get('/admin/staff'),
        api.get('/admin/roles'),
        api.get('/admin/roles/permissions'),
        api.departments.getAll()
      ]);

      setStaff(staffRes.data.data.docs || staffRes.data.data);
      setRoles(rolesRes.data.data);
      setAvailablePermissions(permissionsRes.data.data.categories);
      setDepartments(deptRes.data.data || deptRes.data || []);
    } catch (err) {
      setError('Failed to load admin data. You may not have admin privileges.');
      console.error('Admin panel load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffSuccess = (data) => {
    const employeeId = data.profile?.employeeId || data.employeeId;
    setSuccess(`Staff ${editingStaff ? 'updated' : 'created'} successfully! ${
      employeeId && employeeId !== 'N/A' ? `Employee ID: ${employeeId}, ` : ''
    }${
      data.credentials ? 
      `Username: ${data.credentials.username}, Password: ${data.credentials.password}` : 
      ''
    }`);
    setEditingStaff(null);
    loadInitialData();
  };

  const handleRoleSuccess = (data) => {
    setSuccess(editingRole ? 'Role updated successfully!' : 'Role created successfully!');
    setEditingRole(null);
    loadInitialData();
  };

  const handleDepartmentSuccess = (data) => {
    setSuccess('Department created successfully!');
    loadInitialData();
  };

  const handleToggleStaffStatus = async (staffId, currentStatus) => {
    try {
      await api.patch(`/admin/staff/${staffId}/status`, 
        { isActive: !currentStatus }
      );
      
      setSuccess(`Staff member ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
      loadInitialData(); // Reload staff list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update staff status');
    }
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (!window.confirm(`Are you sure you want to delete staff member "${staffName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/admin/staff/${staffId}`);
      setSuccess(`Staff member "${staffName}" deleted successfully!`);
      loadInitialData(); // Reload staff list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete staff member');
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (!window.confirm(`Are you sure you want to delete role "${roleName}"? This action cannot be undone and will affect all users assigned to this role.`)) {
      return;
    }

    try {
      await api.delete(`/admin/roles/${roleId}`);
      setSuccess(`Role "${roleName}" deleted successfully!`);
      loadInitialData(); // Reload roles list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const handleDeleteDepartment = async (deptId, deptName) => {
    if (!window.confirm(`Are you sure you want to delete department "${deptName}"? This action cannot be undone and will affect all staff assigned to this department.`)) {
      return;
    }

    try {
      await api.departments.delete(deptId);
      setSuccess(`Department "${deptName}" deleted successfully!`);
      loadInitialData();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to delete department';
      
      // Handle specific validation errors with better messaging
      if (err.response?.status === 400 && errorMessage.includes('staff member')) {
        setError(`Cannot delete "${deptName}": ${errorMessage} Please reassign or remove staff members first.`);
      } else if (err.response?.status === 404) {
        setError(`Department "${deptName}" not found. It may have already been deleted.`);
        loadInitialData(); // Refresh the list
      } else {
        setError(`Failed to delete department "${deptName}": ${errorMessage}`);
      }
      
      console.error('Department deletion error:', {
        departmentId: deptId,
        departmentName: deptName,
        status: err.response?.status,
        message: errorMessage,
        fullError: err
      });
    }
  };

  const handleToggleDepartmentStatus = async (deptId) => {
    try {
      await api.departments.toggleStatus(deptId);
      setSuccess('Department status updated successfully!');
      loadInitialData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update department status');
    }
  };


  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  if (loading && staff.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px"
        }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3, color: 'var(--app-primary)', fontWeight: 700 }}>
        Admin Panel
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab 
              label="Staff Management" 
              icon={<PersonIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Role Management" 
              icon={<SecurityIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Department Management" 
              icon={<BusinessIcon />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Staff Management Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setStaffDialogOpen(true)}
              sx={{ mb: 2 }}
            >
              Add New Staff
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Employee ID</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staff.map(member => (
                  <TableRow key={member._id}>
                    <TableCell>
                      {member.firstName} {member.lastName}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={member.profile?.employeeId || member.employeeId || 'N/A'} 
                        variant="outlined" 
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.role?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={member.department?.name || 'N/A'}
                        variant="outlined"
                        size="small"
                        color={member.department?.name?.includes('Test Operations Dept') ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={member.isActive ? 'Active' : 'Inactive'}
                        color={member.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit Staff">
                        <IconButton
                          onClick={() => {
                            setEditingStaff(member);
                            setStaffDialogOpen(true);
                          }}
                          color="primary"
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={member.isActive ? 'Deactivate' : 'Activate'}>
                        <IconButton
                          onClick={() => handleToggleStaffStatus(member._id, member.isActive)}
                          color={member.isActive ? 'error' : 'success'}
                          size="small"
                        >
                          {member.isActive ? <ToggleOffIcon /> : <ToggleOnIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Staff">
                        <IconButton
                          onClick={() => handleDeleteStaff(member._id, `${member.firstName} ${member.lastName}`)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Role Management Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setRoleDialogOpen(true)}
              sx={{ mb: 2 }}
            >
              Add New Role
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Hierarchy</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map(role => (
                  <TableRow key={role._id || role.id}>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>{role.description || 'N/A'}</TableCell>
                    <TableCell>{role.hierarchy}</TableCell>
                    <TableCell>{role.permissions?.length || 0} permissions</TableCell>
                    <TableCell>
                      <Chip
                        label={role.isActive ? 'Active' : 'Inactive'}
                        color={role.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit Role">
                        <IconButton
                          onClick={() => {
                            setEditingRole(role);
                            setRoleDialogOpen(true);
                          }}
                          color="primary"
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Role">
                        <IconButton
                          onClick={() => handleDeleteRole(role._id || role.id, role.name)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Department Management Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDepartmentDialogOpen(true)}
              sx={{ mb: 2 }}
            >
              Add New Department
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Head of Department</TableCell>
                  <TableCell>Budget</TableCell>
                  <TableCell>Staff Count</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {departments.map(dept => (
                  <TableRow key={dept._id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box 
                          sx={{ 
                            width: 12, 
                            height: 12, 
                            borderRadius: '50%', 
                            bgcolor: dept.color || '#6B7280' 
                          }} 
                        />
                        {dept.name}
                      </Box>
                    </TableCell>
                    <TableCell>{dept.description || 'N/A'}</TableCell>
                    <TableCell>{dept.headOfDepartment?.name || 'N/A'}</TableCell>
                    <TableCell>{currencySym()}{dept.budget?.toLocaleString() || 0}</TableCell>
                    <TableCell>{dept.staffCount || 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={dept.isActive ? 'Active' : 'Inactive'}
                        color={dept.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={dept.isActive ? 'Deactivate' : 'Activate'}>
                        <IconButton
                          onClick={() => handleToggleDepartmentStatus(dept._id)}
                          color={dept.isActive ? 'error' : 'success'}
                          size="small"
                        >
                          {dept.isActive ? <ToggleOffIcon /> : <ToggleOnIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Department">
                        <IconButton
                          onClick={() => handleDeleteDepartment(dept._id, dept.name)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Card>

      {/* Dialogs */}
      <StaffDialog
        open={staffDialogOpen}
        onClose={() => {
          setStaffDialogOpen(false);
          setEditingStaff(null);
        }}
        onSuccess={handleStaffSuccess}
        editingStaff={editingStaff}
        roles={roles}
        departments={departments}
      />
      
      <RoleDialog
        open={roleDialogOpen}
        onClose={() => {
          setRoleDialogOpen(false);
          setEditingRole(null);
        }}
        onSuccess={handleRoleSuccess}
        editingRole={editingRole}
        availablePermissions={availablePermissions}
        departments={departments}
      />
      
      <DepartmentDialog
        open={departmentDialogOpen}
        onClose={() => setDepartmentDialogOpen(false)}
        onSuccess={handleDepartmentSuccess}
      />
    </Box>
  );
};

export default AdminPanel;
