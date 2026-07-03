import React, { useState, useEffect } from 'react';
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Alert,
  Box,
  Chip,
  FormGroup,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Security as SecurityIcon,
  VpnKey as VpnKeyIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import FormDialog, { FormSection } from './forms/FormDialog';
import api from '../api';

const RoleDialog = ({ open, onClose, onSuccess, editingRole, availablePermissions: propPermissions, departments: propDepartments }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState(propDepartments || []);
  const [availablePermissions, setAvailablePermissions] = useState(propPermissions || []);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    departmentId: '',
    permissions: [],
    hierarchy: 1,
    accessLevel: {
      departments: [],
      rooms: 'limited',
      reports: 'limited',
      pages: []
    },
    settings: {
      canManageStaff: false,
      canViewReports: false,
      canManageBookings: false,
      maxApprovalAmount: 0,
      canCreateUsers: false,
      canAssignRoles: false,
      canManageSettings: false,
      canAccessSettings: false,
      canManageRoles: false,
      canViewAllStaff: false,
      canEditStaffProfiles: false,
      canDeactivateStaff: false
    },
    userAccountSettings: {
      canHaveUserAccount: true,
      defaultPasswordPattern: '[firstName][0-3][random4]',
      forcePasswordChange: true,
      passwordExpiryDays: 90,
      usernamePattern: '[firstName].[lastName]'
    }
  });

  useEffect(() => {
    if (open) {
      if (propDepartments && propPermissions) {
        setDepartments(propDepartments);
        setAvailablePermissions(propPermissions);
      } else {
        loadInitialData();
      }
      
      // If editing, populate form with role data
      if (editingRole) {
        setFormData({
          name: editingRole.name || '',
          description: editingRole.description || '',
          departmentId: editingRole.department?._id || editingRole.department?.id || editingRole.departmentId || '',
          permissions: editingRole.permissions || [],
          hierarchy: editingRole.hierarchy || 1,
          accessLevel: {
            departments: editingRole.accessLevel?.departments || [],
            rooms: editingRole.accessLevel?.rooms || 'limited',
            reports: editingRole.accessLevel?.reports || 'limited',
            pages: editingRole.accessLevel?.pages || []
          },
          settings: {
            canManageStaff: editingRole.settings?.canManageStaff || false,
            canViewReports: editingRole.settings?.canViewReports || false,
            canManageBookings: editingRole.settings?.canManageBookings || false,
            maxApprovalAmount: editingRole.settings?.maxApprovalAmount || 0,
            canCreateUsers: editingRole.settings?.canCreateUsers || false,
            canAssignRoles: editingRole.settings?.canAssignRoles || false,
            canManageSettings: editingRole.settings?.canManageSettings || false,
            canAccessSettings: editingRole.settings?.canAccessSettings || false,
            canManageRoles: editingRole.settings?.canManageRoles || false,
            canViewAllStaff: editingRole.settings?.canViewAllStaff || false,
            canEditStaffProfiles: editingRole.settings?.canEditStaffProfiles || false,
            canDeactivateStaff: editingRole.settings?.canDeactivateStaff || false
          },
          userAccountSettings: {
            canHaveUserAccount: editingRole.userAccountSettings?.canHaveUserAccount ?? true,
            defaultPasswordPattern: editingRole.userAccountSettings?.defaultPasswordPattern || '[firstName][0-3][random4]',
            forcePasswordChange: editingRole.userAccountSettings?.forcePasswordChange ?? true,
            passwordExpiryDays: editingRole.userAccountSettings?.passwordExpiryDays || 90,
            usernamePattern: editingRole.userAccountSettings?.usernamePattern || '[firstName].[lastName]'
          }
        });
      } else {
        // Reset form for new role
        setFormData({
          name: '',
          description: '',
          departmentId: '',
          permissions: [],
          hierarchy: 1,
          accessLevel: {
            departments: [],
            rooms: 'limited',
            reports: 'limited',
            pages: []
          },
          settings: {
            canManageStaff: false,
            canViewReports: false,
            canManageBookings: false,
            maxApprovalAmount: 0,
            canCreateUsers: false,
            canAssignRoles: false,
            canManageSettings: false,
            canAccessSettings: false,
            canManageRoles: false,
            canViewAllStaff: false,
            canEditStaffProfiles: false,
            canDeactivateStaff: false
          },
          userAccountSettings: {
            canHaveUserAccount: true,
            defaultPasswordPattern: '[firstName][0-3][random4]',
            forcePasswordChange: true,
            passwordExpiryDays: 90,
            usernamePattern: '[firstName].[lastName]'
          }
        });
      }
    }
  }, [open, editingRole, propDepartments, propPermissions]);

  const loadInitialData = async () => {
    try {
      const [deptsRes, permissionsRes] = await Promise.all([
        api.get('/settings/departments'),
        api.get('/admin/roles/permissions')
      ]);
      
      setDepartments(deptsRes.data.data || []);
      setAvailablePermissions(permissionsRes.data.data?.categories || []);
    } catch (err) {
      setError('Failed to load departments and permissions');
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handlePermissionChange = (permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      setError('Role name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Clean the form data before sending
      const cleanFormData = {
        ...formData,
        // Remove empty departmentId to avoid ObjectId cast error
        departmentId: formData.departmentId || undefined
      };

      // Remove undefined values
      Object.keys(cleanFormData).forEach(key => {
        if (cleanFormData[key] === undefined) {
          delete cleanFormData[key];
        }
      });

      const response = editingRole 
        ? await api.put(`/admin/roles/${editingRole._id || editingRole.id}`, cleanFormData)
        : await api.post('/admin/roles', cleanFormData);
      
      if (response.data.success) {
        onSuccess(response.data.data);
        handleClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${editingRole ? 'update' : 'create'} role`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      departmentId: '',
      permissions: [],
      hierarchy: 1,
      accessLevel: {
        departments: [],
        rooms: 'limited',
        reports: 'limited',
        pages: []
      },
      settings: {
        canManageStaff: false,
        canViewReports: false,
        canManageBookings: false,
        maxApprovalAmount: 0,
        canCreateUsers: false,
        canAssignRoles: false,
        canManageSettings: false,
        canAccessSettings: false,
        canManageRoles: false,
        canViewAllStaff: false,
        canEditStaffProfiles: false,
        canDeactivateStaff: false
      },
      userAccountSettings: {
        canHaveUserAccount: true,
        defaultPasswordPattern: '[firstName][0-3][random4]',
        forcePasswordChange: true,
        passwordExpiryDays: 90,
        usernamePattern: '[firstName].[lastName]'
      }
    });
    setError('');
    onClose();
  };

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit}
      maxWidth="lg"
      icon={<SecurityIcon />}
      eyebrow="Access Control"
      title={editingRole ? 'Edit Role' : 'Create New Role'}
      submitDisabled={loading}
      submitLabel={loading ? (editingRole ? 'Updating...' : 'Creating...') : (editingRole ? 'Update Role' : 'Create Role')}
    >
        {error && (
          <Alert severity="error">
            {error}
          </Alert>
        )}

        <FormSection title="Basic Information" icon={<SecurityIcon fontSize="small" />} iconColor="#6366f1">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Role Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Hierarchy Level"
                type="number"
                value={formData.hierarchy}
                onChange={(e) => handleInputChange('hierarchy', parseInt(e.target.value))}
                required
                inputProps={{ min: 1, max: 10 }}
                helperText="1 = Lowest, 10 = Highest"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Department (Optional)</InputLabel>
                <Select
                  value={formData.departmentId}
                  onChange={(e) => handleInputChange('departmentId', e.target.value)}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: '#ffffff',
                        backgroundImage: 'none',
                        boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)'
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>No specific department</em>
                  </MenuItem>
                  {departments?.map(dept => (
                    <MenuItem key={dept._id || dept.id} value={dept._id || dept.id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </FormSection>

        <FormSection title="Permissions" icon={<VpnKeyIcon fontSize="small" />} iconColor="#10b981">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Array.isArray(availablePermissions) && availablePermissions.map(category =>
              Array.isArray(category.permissions) && category.permissions.map(permission => (
                <Chip
                  key={`${category.name}-${permission}`}
                  label={permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  clickable
                  color={formData.permissions.includes(permission) ? 'primary' : 'default'}
                  onClick={() => handlePermissionChange(permission)}
                  variant={formData.permissions.includes(permission) ? 'filled' : 'outlined'}
                />
              ))
            )}
          </Box>
        </FormSection>

        <Accordion sx={{ borderRadius: 3, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Advanced Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Role Capabilities
                  </Typography>
                  <FormGroup>
                    <Grid container spacing={1}>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.settings.canManageStaff}
                              onChange={(e) => handleInputChange('settings.canManageStaff', e.target.checked)}
                            />
                          }
                          label="Can Manage Staff"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.settings.canViewReports}
                              onChange={(e) => handleInputChange('settings.canViewReports', e.target.checked)}
                            />
                          }
                          label="Can View Reports"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.settings.canManageBookings}
                              onChange={(e) => handleInputChange('settings.canManageBookings', e.target.checked)}
                            />
                          }
                          label="Can Manage Bookings"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.settings.canCreateUsers}
                              onChange={(e) => handleInputChange('settings.canCreateUsers', e.target.checked)}
                            />
                          }
                          label="Can Create Users"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.settings.canManageSettings}
                              onChange={(e) => handleInputChange('settings.canManageSettings', e.target.checked)}
                            />
                          }
                          label="Can Manage Settings"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.settings.canManageRoles}
                              onChange={(e) => handleInputChange('settings.canManageRoles', e.target.checked)}
                            />
                          }
                          label="Can Manage Roles"
                        />
                      </Grid>
                    </Grid>
                  </FormGroup>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Max Approval Amount"
                    type="number"
                    value={formData.settings.maxApprovalAmount}
                    onChange={(e) => handleInputChange('settings.maxApprovalAmount', parseFloat(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Room Access Level</InputLabel>
                    <Select
                      value={formData.accessLevel.rooms}
                      onChange={(e) => handleInputChange('accessLevel.rooms', e.target.value)}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            backgroundColor: '#ffffff',
                            backgroundImage: 'none',
                            boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)'
                          }
                        }
                      }}
                    >
                      <MenuItem value="limited">Limited</MenuItem>
                      <MenuItem value="assigned">Assigned Only</MenuItem>
                      <MenuItem value="department">Department</MenuItem>
                      <MenuItem value="all">All Rooms</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    User Account Settings
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.userAccountSettings.canHaveUserAccount}
                        onChange={(e) => handleInputChange('userAccountSettings.canHaveUserAccount', e.target.checked)}
                      />
                    }
                    label="Can Have User Account"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.userAccountSettings.forcePasswordChange}
                        onChange={(e) => handleInputChange('userAccountSettings.forcePasswordChange', e.target.checked)}
                      />
                    }
                    label="Force Password Change on First Login"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Username Pattern"
                    value={formData.userAccountSettings.usernamePattern}
                    onChange={(e) => handleInputChange('userAccountSettings.usernamePattern', e.target.value)}
                    helperText="Use [firstName], [lastName] placeholders"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Password"
                    value="Auto-generated (secure & unique)"
                    helperText="New logins get a random unique password — never based on the staff name. Shown once on creation."
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Password Expiry Days"
                    type="number"
                    value={formData.userAccountSettings.passwordExpiryDays}
                    onChange={(e) => handleInputChange('userAccountSettings.passwordExpiryDays', parseInt(e.target.value))}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
        </Accordion>
    </FormDialog>
  );
};

export default RoleDialog;
