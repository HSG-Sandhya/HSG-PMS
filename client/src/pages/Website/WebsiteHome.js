import { useState } from 'react';
import { 
  Box,  
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia,
  Divider,
  TextField,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useSettings } from '../../contexts/SettingsContext';

const WebsiteHome = () => {
  const { settings } = useSettings();
  const isDarkMode = settings?.theme?.darkMode;
  const cardStyle = settings?.theme?.cardStyle || 'rounded';
  const accentColor = settings?.theme?.accentColor || '#F59E42';
  const fontFamily = settings?.theme?.fontFamily;
  const fontSize = settings?.theme?.fontSize;
  const [checkIn, setCheckIn] = useState(null);
  const [checkOut, setCheckOut] = useState(null);

  return (
    <Box sx={{
      fontFamily,
      fontSize,
      color: isDarkMode ? '#f3f4f6' : '#23272f',
      transition: 'background 0.3s, color 0.3s',
    }}>
      {/* Hero Section with Booking Form */}
      <Box 
        sx={{ 
          height: '100vh', 
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${process.env.PUBLIC_URL}/images/hotel-exterior.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Box sx={{ position: 'relative' }}>
          {/* Booking Form */}
          <Box 
            sx={{ 
              position: 'absolute', 
              left: 0, 
              top: '50%', 
              transform: 'translateY(-50%)',
              width: '350px',
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              p: 4,
              borderRadius: 0,
              color: 'white',
            }}
          >
            <Typography variant="h5" gutterBottom sx={{
              fontWeight: "bold"
            }}>
              BOOK A ROOM ONLINE
            </Typography>
            
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ mb: 3, mt: 3 }}>
                <Typography variant="body2" gutterBottom>
                  Arrival
                </Typography>
                <DatePicker
                  value={checkIn}
                  onChange={(newValue) => setCheckIn(newValue)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      fullWidth
                      variant="outlined"
                      placeholder="dd-mm-yyyy"
                      sx={{ 
                        bgcolor: 'transparent',
                        input: { color: 'white' },
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                          '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                          '&.Mui-focused fieldset': { borderColor: 'white' },
                        },
                      }}
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <CalendarTodayIcon sx={{ color: 'white' }} />
                            </InputAdornment>
                          ),
                        }
                      }}
                    />
                  )}
                />
              </Box>
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="body2" gutterBottom>
                  Departure
                </Typography>
                <DatePicker
                  value={checkOut}
                  onChange={(newValue) => setCheckOut(newValue)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      fullWidth
                      variant="outlined"
                      placeholder="dd-mm-yyyy"
                      sx={{ 
                        bgcolor: 'transparent',
                        input: { color: 'white' },
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                          '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                          '&.Mui-focused fieldset': { borderColor: 'white' },
                        },
                      }}
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <CalendarTodayIcon sx={{ color: 'white' }} />
                            </InputAdornment>
                          ),
                        }
                      }}
                    />
                  )}
                />
              </Box>
            </LocalizationProvider>
            
            <Button 
              component={Link}
              to="/website/booking"
              variant="contained" 
              fullWidth
              sx={{ 
                py: 1.5,
                bgcolor: '#ff0000',
                borderRadius: '50px',
                '&:hover': {
                  bgcolor: '#cc0000',
                },
              }}
            >
              Book Now
            </Button>
          </Box>
        </Box>
      </Box>
      {/* About Us Section */}
      <Box sx={{ py: 8 }}>
        <Box sx={{
          maxWidth: "lg"
        }}>
          <Grid container spacing={6} sx={{
            alignItems: "center"
          }}>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <Box sx={{ position: 'relative', mb: 2 }}>
                <Typography 
                  variant="h4" 
                  component="h2" 
                  sx={{ 
                    fontWeight: 700, 
                    display: 'inline-block',
                    position: 'relative',
                    zIndex: 1,
                    '&:after': {
                      content: '""',
                      position: 'absolute',
                      width: '30px',
                      height: '3px',
                      bgcolor: '#ff0000',
                      bottom: 0,
                      right: '-40px',
                      top: '50%',
                    },
                  }}
                >
                  ABOUT US
                </Typography>
              </Box>
              <Typography variant="body1" sx={{
                marginBottom: "16px"
              }}>
                The passage experienced a surge in popularity during the 1960s when Letraset used it on their dry-transfer sheets, and again during the 90s as desktop publishers bundled the text with their software. Today it&apos;s seen all around the web; on templates, websites, and stock designs. Use our generator to get your own, or read on for the authoritative history of lorem ipsum.
              </Typography>
              <Button 
                variant="contained" 
                sx={{ 
                  mt: 2,
                  bgcolor: '#000',
                  color: '#fff',
                  borderRadius: 0,
                  px: 3,
                  py: 1,
                  '&:hover': {
                    bgcolor: '#333',
                  },
                }}
              >
                Read More
              </Button>
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <Box 
                component="img"
                src="/images/hotel-pool.jpg"
                alt="Hotel Pool"
                sx={{ 
                  width: '100%',
                  height: 'auto',
                  borderRadius: 0,
                }}
              />
            </Grid>
          </Grid>
        </Box>
      </Box>
      {/* Our Rooms Section */}
      <Box sx={{ bgcolor: '#f5f5f5', py: 8 }}>
        <Box sx={{
          maxWidth: "lg"
        }}>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography 
              variant="h4" 
              component="h2" 
              sx={{ 
                fontWeight: 700, 
                display: 'inline-block',
                position: 'relative',
                zIndex: 1,
                '&:after': {
                  content: '""',
                  position: 'absolute',
                  width: '30px',
                  height: '3px',
                  bgcolor: '#ff0000',
                  bottom: '-10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                },
              }}
            >
              OUR ROOM
            </Typography>
            <Typography variant="body2" sx={{ mt: 3 }}>
              Lorem ipsum available, but the majority have suffered
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            {[
              {
                title: 'Bed Room',
                image: '/images/standard-room.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there',
              },
              {
                title: 'Bed Room',
                image: '/images/deluxe-room.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there',
              },
              {
                title: 'Bed Room',
                image: '/images/suite.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there',
              },
            ].map((room, index) => (
              <Grid
                key={index}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4
                }}>
                <Card sx={{
                  height: '100%',
                  boxShadow: 0,
                  borderRadius: cardStyle === 'rounded' ? 16 : cardStyle === 'square' ? 0 : 16,
                  border: `2px solid ${accentColor}`,
                  fontFamily,
                  fontSize,
                }}>
                  <CardMedia
                    component="img"
                    height="220"
                    image={room.image}
                    alt={room.title}
                  />
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Typography gutterBottom variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                      {room.title}
                    </Typography>
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>
                      {room.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {[
              {
                title: 'Bed Room',
                image: '/images/family-room.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there',
              },
              {
                title: 'Bed Room',
                image: '/images/deluxe-room.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there',
              },
              {
                title: 'Bed Room',
                image: '/images/standard-room.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there',
              },
            ].map((room, index) => (
              <Grid
                key={index}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4
                }}>
                <Card sx={{
                  height: '100%',
                  boxShadow: 0,
                  borderRadius: cardStyle === 'rounded' ? 16 : cardStyle === 'square' ? 0 : 16,
                  border: `2px solid ${accentColor}`,
                  fontFamily,
                  fontSize,
                }}>
                  <CardMedia
                    component="img"
                    height="220"
                    image={room.image}
                    alt={room.title}
                  />
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Typography gutterBottom variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                      {room.title}
                    </Typography>
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>
                      {room.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
      {/* Blog Section */}
      <Box sx={{ 
        py: 8, 
        backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(/images/hotel-night.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'white',
      }}>
        <Box sx={{
          maxWidth: "lg"
        }}>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography 
              variant="h4" 
              component="h2" 
              sx={{ 
                fontWeight: 700, 
                display: 'inline-block',
                position: 'relative',
                zIndex: 1,
                '&:after': {
                  content: '""',
                  position: 'absolute',
                  width: '30px',
                  height: '3px',
                  bgcolor: '#ff0000',
                  bottom: '-10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                },
              }}
            >
              BLOG
            </Typography>
            <Typography variant="body2" sx={{ mt: 3 }}>
              Lorem ipsum available, but the majority have suffered
            </Typography>
          </Box>
          
          <Grid container spacing={4}>
            {[
              {
                title: 'Bed Room',
                subtitle: 'The standard chunk',
                image: '/images/pool-view.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there isn\'t anything embarrassing hidden in the middle of text. All the Lorem Ipsum generatorsIf you are',
              },
              {
                title: 'Bed Room',
                subtitle: 'The standard chunk',
                image: '/images/lobby.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there isn\'t anything embarrassing hidden in the middle of text. All the Lorem Ipsum generatorsIf you are',
              },
              {
                title: 'Bed Room',
                subtitle: 'The standard chunk',
                image: '/images/bedroom.jpg',
                description: 'If you are going to use a passage of Lorem Ipsum, you need to be sure there isn\'t anything embarrassing hidden in the middle of text. All the Lorem Ipsum generatorsIf you are',
              },
            ].map((blog, index) => (
              <Grid
                key={index}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4
                }}>
                <Card sx={{
                  height: '100%',
                  bgcolor: 'transparent',
                  color: 'white',
                  boxShadow: 0,
                  borderRadius: cardStyle === 'rounded' ? 16 : cardStyle === 'square' ? 0 : 16,
                  border: `2px solid ${accentColor}`,
                  fontFamily,
                  fontSize,
                }}>
                  <CardMedia
                    component="img"
                    height="220"
                    image={blog.image}
                    alt={blog.title}
                  />
                  <CardContent sx={{ p: 3, bgcolor: '#000' }}>
                    <Typography gutterBottom variant="h6" component="h3" sx={{ fontWeight: 600, color: 'white' }}>
                      {blog.title}
                    </Typography>
                    <Typography variant="body2" gutterBottom sx={{
                      color: "#ff0000"
                    }}>
                      {blog.subtitle}
                    </Typography>
                    <Typography variant="body2" sx={{
                      color: "rgba(255,255,255,0.7)"
                    }}>
                      {blog.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
      {/* Contact Us Section */}
      <Box sx={{ py: 8 }}>
        <Box sx={{
          maxWidth: "lg"
        }}>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography 
              variant="h4" 
              component="h2" 
              sx={{ 
                fontWeight: 700, 
                display: 'inline-block',
                position: 'relative',
                zIndex: 1,
                '&:after': {
                  content: '""',
                  position: 'absolute',
                  width: '30px',
                  height: '3px',
                  bgcolor: '#ff0000',
                  bottom: '-10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                },
              }}
            >
              CONTACT US
            </Typography>
            <Typography variant="body2" sx={{ mt: 3 }}>
              Lorem ipsum available, but the majority have suffered
            </Typography>
          </Box>
          
          <Grid container spacing={4}>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <Box component="form">
                <Grid container spacing={2}>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField 
                      fullWidth 
                      placeholder="Name" 
                      variant="outlined"
                      sx={{ mb: 2 }}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField 
                      fullWidth 
                      placeholder="Email" 
                      variant="outlined"
                      sx={{ mb: 2 }}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField 
                      fullWidth 
                      placeholder="Phone" 
                      variant="outlined"
                      sx={{ mb: 2 }}
                    />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      sm: 6
                    }}>
                    <TextField 
                      fullWidth 
                      placeholder="Subject" 
                      variant="outlined"
                      sx={{ mb: 2 }}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField 
                      fullWidth 
                      placeholder="Message" 
                      variant="outlined"
                      multiline
                      rows={4}
                      sx={{ mb: 2 }}
                    />
                  </Grid>
                  <Grid size={12}>
                    <Button 
                      variant="contained" 
                      sx={{ 
                        bgcolor: '#000',
                        color: '#fff',
                        borderRadius: 0,
                        px: 4,
                        py: 1.5,
                        '&:hover': {
                          bgcolor: '#333',
                        },
                      }}
                    >
                      SEND
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 6
              }}>
              <Box
                component="iframe"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3888.001696423075!2d77.59791287381694!3d12.971598987384476!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae1670c9b44e6d%3A0xf8dfc3e8517e4fe0!2sBengaluru%2C%20Karnataka%2C%20India!5e0!3m2!1sen!2sus!4v1686489913219!5m2!1sen!2sus"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                sx={{
                  width: "100%",
                  height: "450"
                }} />
            </Grid>
          </Grid>
        </Box>
      </Box>
      {/* Footer */}
      <Box sx={{ bgcolor: '#000', color: 'white', py: 6 }}>
        <Box sx={{
          maxWidth: "lg"
        }}>
          <Grid container spacing={4}>
            <Grid
              size={{
                xs: 12,
                md: 4
              }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#fff' }}>
                ABOUT HOTEL
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <IconButton size="small" sx={{ color: 'white', border: '1px solid white' }}>
                  <i className="fab fa-facebook-f"></i>
                </IconButton>
                <IconButton size="small" sx={{ color: 'white', border: '1px solid white' }}>
                  <i className="fab fa-twitter"></i>
                </IconButton>
                <IconButton size="small" sx={{ color: 'white', border: '1px solid white' }}>
                  <i className="fab fa-instagram"></i>
                </IconButton>
                <IconButton size="small" sx={{ color: 'white', border: '1px solid white' }}>
                  <i className="fab fa-linkedin-in"></i>
                </IconButton>
              </Box>
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 4
              }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#fff' }}>
                USEFUL LINKS
              </Typography>
              <Box component="ul" sx={{ pl: 0, listStyle: 'none' }}>
                <Box component="li" sx={{ mb: 1 }}>
                  <Typography 
                    component={Link} 
                    to="/website/booking" 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255,255,255,0.7)',
                      textDecoration: 'none',
                      '&:hover': { color: '#ff0000' },
                    }}
                  >
                    Book a Room
                  </Typography>
                </Box>
                <Box component="li" sx={{ mb: 1 }}>
                  <Typography 
                    component="a" 
                    href="#" 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255,255,255,0.7)',
                      textDecoration: 'none',
                      '&:hover': { color: '#ff0000' },
                    }}
                  >
                    Our Rooms
                  </Typography>
                </Box>
                <Box component="li" sx={{ mb: 1 }}>
                  <Typography 
                    component="a" 
                    href="#" 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255,255,255,0.7)',
                      textDecoration: 'none',
                      '&:hover': { color: '#ff0000' },
                    }}
                  >
                    Restaurant
                  </Typography>
                </Box>
                <Box component="li" sx={{ mb: 1 }}>
                  <Typography 
                    component="a" 
                    href="#" 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255,255,255,0.7)',
                      textDecoration: 'none',
                      '&:hover': { color: '#ff0000' },
                    }}
                  >
                    Spa & Wellness
                  </Typography>
                </Box>
                <Box component="li" sx={{ mb: 1 }}>
                  <Typography 
                    component="a" 
                    href="#" 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255,255,255,0.7)',
                      textDecoration: 'none',
                      '&:hover': { color: '#ff0000' },
                    }}
                  >
                    Contact Us
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid
              size={{
                xs: 12,
                md: 4
              }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#fff' }}>
                CONTACT INFO
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                  <strong>Address:</strong> 123 Main Street, City Center, State 12345, India
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                  <strong>Phone:</strong> +91 1234567890
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                  <strong>Email:</strong> info@hotelsandhyagrand.com
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
                  <strong>Website:</strong> www.hotelsandhyagrand.com
                </Typography>
              </Box>
            </Grid>
          </Grid>
          <Divider sx={{ my: 4, bgcolor: 'rgba(255, 255, 255, calc(var(--app-surface-alpha, 0.05) * 2))' }} />
          <Typography variant="body2" align="center" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            © {new Date().getFullYear()} Hotel Sandhya Grand. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default WebsiteHome;