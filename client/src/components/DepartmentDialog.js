import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import api from '../api';
import { currencySym } from '../utils/billing';
import AppTimePicker from './forms/AppTimePicker';

const DepartmentDialog = ({ open, onClose, onSuccess, editingDepartment = null }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    headOfDepartment: '',
    budget: 0,
    staffCount: 0,
    color: '#6B7280',
    isActive: true,
    permissions: [],
    settings: {
      maxStaff: null,
      workingHours: {
        start: '09:00',
        end: '17:00'
      },
      breakDuration: 30
    }
  });

  const defaultColors = [
    'var(--app-primary)', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6B7280'
  ];

  const availablePermissions = [
    'view_reports', 'manage_staff', 'approve_expenses', 'schedule_shifts',
    'access_inventory', 'customer_service', 'financial_access', 'admin_access'
  ];

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (editingDepartment) {
        setFormData({
          name: editingDepartment.name || '',
          description: editingDepartment.description || '',
          headOfDepartment: editingDepartment.headOfDepartment?._id || '',
          budget: editingDepartment.budget || 0,
          staffCount: editingDepartment.staffCount || 0,
          color: editingDepartment.color || '#6B7280',
          isActive: editingDepartment.isActive !== undefined ? editingDepartment.isActive : true,
          permissions: editingDepartment.permissions || [],
          settings: {
            maxStaff: editingDepartment.settings?.maxStaff || null,
            workingHours: {
              start: editingDepartment.settings?.workingHours?.start || '09:00',
              end: editingDepartment.settings?.workingHours?.end || '17:00'
            },
            breakDuration: editingDepartment.settings?.breakDuration || 30
          }
        });
      } else {
        resetForm();
      }
    }
  }, [open, editingDepartment]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      headOfDepartment: '',
      budget: 0,
      staffCount: 0,
      color: '#6B7280',
      isActive: true,
      permissions: [],
      settings: {
        maxStaff: null,
        workingHours: {
          start: '09:00',
          end: '17:00'
        },
        breakDuration: 30
      }
    });
    setError('');
  };

  const fetchUsers = async () => {
    try {
      const response = await api.users.getAll();
      let usersData = response?.data?.data || response?.data || response;
      if (Array.isArray(usersData)) {
        setUsers(usersData);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child, grandchild] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: grandchild ? {
            ...prev[parent][child],
            [grandchild]: value
          } : value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handlePermissionChange = (permission, checked) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permission]
        : prev.permissions.filter(p => p !== permission)
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!formData.name.trim()) {
        setError('Department name is required');
        return;
      }

      const departmentData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
        headOfDepartment: formData.headOfDepartment || null,
        budget: parseFloat(formData.budget) || 0,
        staffCount: parseInt(formData.staffCount) || 0
      };

      if (editingDepartment) {
        await api.departments.update(editingDepartment._id, departmentData);
      } else {
        await api.departments.create(departmentData);
      }

      onSuccess(departmentData);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving department:', error);
      setError(error.response?.data?.message || 'Failed to save department');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
        display: open ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <Box
        sx={{
          backgroundColor: '#ffffff',
          borderRadius: 2,
          boxShadow: 24,
          maxWidth: 800,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid #e0e0e0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Title */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <BusinessIcon color="primary" />
          <Typography variant="h6">
            {editingDepartment ? 'Edit Department' : 'Add Department'}
          </Typography>
        </Box>

        {/* Dialog Content */}
        <Box sx={{ p: 3, backgroundColor: '#ffffff' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Department Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Head of Department</InputLabel>
              <Select
                value={formData.headOfDepartment}
                onChange={(e) => handleInputChange('headOfDepartment', e.target.value)}
                label="Head of Department"
              >
                <MenuItem value="">None</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user._id} value={user._id}>
                    {user.name || `${user.firstName} ${user.lastName}`} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              multiline
              rows={3}
            />
          </Grid>

          {/* Financial & Staffing */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Financial & Staffing
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Budget"
              type="number"
              value={formData.budget}
              onChange={(e) => handleInputChange('budget', e.target.value)}
              InputProps={{ startAdornment: currencySym() }}
            />
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Current Staff Count"
              type="number"
              value={formData.staffCount}
              onChange={(e) => handleInputChange('staffCount', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Max Staff"
              type="number"
              value={formData.settings.maxStaff || ''}
              onChange={(e) => handleInputChange('settings.maxStaff', e.target.value || null)}
              placeholder="No limit"
            />
          </Grid>

          {/* Working Hours */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Working Hours
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <AppTimePicker
              label="Start Time"
              value={formData.settings.workingHours.start}
              onChange={(v) => handleInputChange('settings.workingHours.start', v)}
            />
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <AppTimePicker
              label="End Time"
              value={formData.settings.workingHours.end}
              onChange={(v) => handleInputChange('settings.workingHours.end', v)}
            />
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Break Duration (minutes)"
              type="number"
              value={formData.settings.breakDuration}
              onChange={(e) => handleInputChange('settings.breakDuration', e.target.value)}
            />
          </Grid>

          {/* Appearance & Status */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Appearance & Status
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" gutterBottom>
              Department Color
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {defaultColors.map((color) => (
                <Box
                  key={color}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: color,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: formData.color === color ? '3px solid #000' : '1px solid #ddd'
                  }}
                  onClick={() => handleInputChange('color', color)}
                />
              ))}
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                />
              }
              label="Active Department"
            />
          </Grid>

          {/* Permissions */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Permissions
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {availablePermissions.map((permission) => (
                <FormControlLabel
                  key={permission}
                  control={
                    <Switch
                      checked={formData.permissions.includes(permission)}
                      onChange={(e) => handlePermissionChange(permission, e.target.checked)}
                      size="small"
                    />
                  }
                  label={permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
        </Box>

        {/* Dialog Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#ffffff',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
          }}
        >
          <Button onClick={handleClose} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default DepartmentDialog;
