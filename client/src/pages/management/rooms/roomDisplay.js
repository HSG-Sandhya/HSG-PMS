// Presentation helpers for the Rooms page: the amenity → icon map and the
// status colour styles. Both are pure (no component state).
import {
  AcUnit as AcIcon,
  Star as StarIcon,
  Wifi as WifiIcon,
  Restaurant as RestaurantIcon,
  KingBed as KingBedIcon,
  SingleBed as SingleBedIcon,
  Balcony as BalconyIcon,
  Visibility as ViewIcon,
  Spa as SpaIcon,
  Security as SecurityIcon,
  LocalParking as ParkingIcon,
  Checkroom as CheckroomIcon,
  Weekend as SofaIcon,
  Groups as FamilyBedIcon,
} from '@mui/icons-material';

export const amenityIcons = {
  'Air Conditioning': <AcIcon fontSize="small" />,
  TV: <StarIcon fontSize="small" />,
  WiFi: <WifiIcon fontSize="small" />,
  'Room Service': <RestaurantIcon fontSize="small" />,
  'King Bed': <KingBedIcon fontSize="small" />,
  'Twin Beds': <SingleBedIcon fontSize="small" />,
  'Grand Family Bed': <FamilyBedIcon fontSize="small" />,
  Sofa: <SofaIcon fontSize="small" />,
  Balcony: <BalconyIcon fontSize="small" />,
  'City View': <ViewIcon fontSize="small" />,
  Bathtub: <SpaIcon fontSize="small" />,
  Shower: <SpaIcon fontSize="small" />,
  'Coffee Maker': <RestaurantIcon fontSize="small" />,
  Safe: <SecurityIcon fontSize="small" />,
  Restaurant: <RestaurantIcon fontSize="small" />,
  Parking: <ParkingIcon fontSize="small" />,
  Wardrobe: <CheckroomIcon fontSize="small" />,
};

// Background + text colour per room status (pill / card accents).
export const getStatusStyles = (status) => {
  switch (status) {
  case 'available':
    return { background: '#e0f7e9', color: '#1b5e20' }; // light green bg, dark green text
  case 'occupied':
    return { background: '#ffe0e0', color: '#b71c1c' }; // light red bg, dark red text
  case 'maintenance':
    return { background: '#fff8e1', color: '#ff6f00' }; // light yellow bg, dark orange text
  case 'cleaning':
    return { background: '#e3f2fd', color: '#1565c0' }; // light blue bg, dark blue text
  default:
    return { background: '#f5f5f5', color: '#333' };
  }
};
