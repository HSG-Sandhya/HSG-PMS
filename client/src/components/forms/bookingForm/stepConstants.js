// Shared constants for the BookingForm wizard steps.
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import TrainIcon from '@mui/icons-material/Train';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocationOnIcon from '@mui/icons-material/LocationOn';

// Entry animation each step's content fades up with.
export const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// Current wall-clock time as 'HH:mm'. A new (walk-in) booking should default the
// check-in time to when the guest is actually being booked in, not a fixed noon.
export const currentTimeHHmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const purposeOfVisitOptions = [
  'Business',
  'Leisure/Tourism',
  'Medical Treatment',
  'Family Visit',
  'Wedding/Event',
  'Conference/Meeting',
  'Official Work',
  'Transit/Stopover',
  'Education/Training',
  'Other',
];

export const travelModes = [
  { value: 'flight', label: 'Flight', icon: <FlightTakeoffIcon /> },
  { value: 'train', label: 'Train', icon: <TrainIcon /> },
  { value: 'bus', label: 'Bus', icon: <DirectionsBusIcon /> },
  { value: 'car', label: 'Car', icon: <DirectionsCarIcon /> },
  { value: 'other', label: 'Other', icon: <LocationOnIcon /> },
];
