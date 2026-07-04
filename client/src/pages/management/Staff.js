import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Grid,
  Avatar,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Badge as BadgeIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api';
import { subscribeSettingsChange } from '../../components/settings/settingsEvents';

const Staff = () => {
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadStaff();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return subscribeSettingsChange(['departments', 'roles'], () => {
      loadStaff();
    });
  }, [isAuthenticated]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/staff');
      setStaff(response.data.data.docs || response.data.data || []);
    } catch (err) {
      setError('Failed to load staff members. You may not have admin privileges.');
      console.error('Staff load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredStaff = staff.filter(member =>
    member.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.department?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px"
        }}>
        <Alert severity="warning">Please log in to access staff management.</Alert>
      </Box>
    );
  }

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
    <Box sx={{ 
      p: 3,
      minHeight: '100vh',
      background: 'transparent'
    }}>
      <Typography 
        variant="h4" 
        component="h1" 
        gutterBottom
        sx={{
          fontWeight: 700,
          color: 'var(--app-primary)',
          mb: 3,
        }}
      >
        Our Team
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {/* Search Bar */}
      <Card sx={{ 
        mb: 3,
        background: alpha(theme.palette.background.paper, 0.7),
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <CardContent>
          <Grid container spacing={2} sx={{
            alignItems: "center"
          }}>
            <Grid
              size={{
                xs: 12,
                sm: 8,
                md: 6
              }}>
              <TextField
                fullWidth
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }
                }}
              />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 4,
                md: 6
              }}>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  justifyContent: "flex-end"
                }}>
                <Chip 
                  label={`Total: ${staff.length}`} 
                  color="primary" 
                  variant="outlined"
                  sx={{
                    background: alpha(theme.palette.primary.main, 0.1),
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                  }}
                />
                <Chip 
                  label={`Active: ${staff.filter(s => s.isActive).length}`} 
                  color="success" 
                  variant="outlined"
                  sx={{
                    background: alpha(theme.palette.success.main, 0.1),
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      {/* Staff Cards Grid */}
      <Grid container spacing={3}>
        {filteredStaff.map(member => (
          <Grid
            key={member._id}
            size={{
              xs: 12,
              sm: 6,
              md: 4,
              lg: 3
            }}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: alpha(theme.palette.background.paper, 0.7),
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  background: alpha(theme.palette.background.paper, 0.8),
                  boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                {/* Avatar and Status */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 2
                  }}>
                  <Avatar 
                    sx={{ 
                      width: 60, 
                      height: 60, 
                      bgcolor: member.isActive ? 'primary.main' : 'grey.400',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      background: member.isActive 
                        ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                        : `linear-gradient(135deg, ${theme.palette.grey[400]}, ${theme.palette.grey[600]})`,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                    }}
                  >
                    {getInitials(member.firstName, member.lastName)}
                  </Avatar>
                  <Chip
                    label={member.isActive ? 'Active' : 'Inactive'}
                    color={member.isActive ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                    sx={{
                      background: alpha(
                        member.isActive ? theme.palette.success.main : theme.palette.error.main, 
                        0.1
                      ),
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${alpha(
                        member.isActive ? theme.palette.success.main : theme.palette.error.main, 
                        0.3
                      )}`
                    }}
                  />
                </Box>

                {/* Name and Employee ID */}
                <Typography variant="h6" gutterBottom sx={{
                  fontWeight: "bold"
                }}>
                  {member.firstName} {member.lastName}
                </Typography>
                <Typography variant="body2" gutterBottom sx={{
                  color: "text.secondary"
                }}>
                  ID: {member.profile?.employeeId || 'N/A'}
                </Typography>

                <Divider sx={{ my: 2 }} />

                {/* Role Information */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1.5
                  }}>
                  <BadgeIcon fontSize="small" color="primary" />
                  <Box>
                    <Typography variant="body2" sx={{
                      fontWeight: "medium"
                    }}>
                      {member.role?.name || 'No Role Assigned'}
                    </Typography>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>
                      Level {member.role?.hierarchy || 'N/A'}
                    </Typography>
                  </Box>
                </Box>

                {/* Department */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1.5
                  }}>
                  <BusinessIcon fontSize="small" color="primary" />
                  <Typography variant="body2">
                    {member.department?.name || 'No Department'}
                  </Typography>
                </Box>

                {/* Contact Information */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1
                  }}>
                  <EmailIcon fontSize="small" color="action" />
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {member.email}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1.5
                  }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {member.phone || 'No phone'}
                  </Typography>
                </Box>

                {/* Join Date */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1
                  }}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>
                    Joined: {formatDate(member.createdAt)}
                  </Typography>
                </Box>

                {/* Location if available */}
                {member.profile?.address && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 1
                    }}>
                    <LocationIcon fontSize="small" color="action" />
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>
                      {member.profile.address.city || 'Location not specified'}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
        
        {filteredStaff.length === 0 && (
          <Grid size={12}>
            <Card sx={{
              background: alpha(theme.palette.background.paper, 0.7),
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}>
              <CardContent>
                <Box
                  sx={{
                    textAlign: "center",
                    py: 4
                  }}>
                  <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{
                    color: "text.secondary"
                  }}>
                    {searchTerm ? 'No team members match your search' : 'No team members found'}
                  </Typography>
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>
                    {searchTerm ? 'Try adjusting your search terms' : 'Staff members will appear here once they are added'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Staff;
