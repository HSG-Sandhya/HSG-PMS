import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Stack,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useSettings } from '../../contexts/SettingsContext';
import { money } from '../../utils/billing';
import { format } from 'date-fns';

import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import NotesIcon from '@mui/icons-material/Notes';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { IconButton, Tooltip } from '@mui/material';

import GuestPrintForm from '../forms/GuestPrintForm'; // Import the print form

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const getStatusChipColor = (status) => {
  switch (status) {
  case 'Confirmed':
    return {
      backgroundColor: 'rgba(76, 175, 80, 0.2)',
      color: '#4caf50',
      borderColor: '#4caf50',
    };
  case 'Pending':
    return {
      backgroundColor: 'rgba(255, 152, 0, 0.2)',
      color: '#ff9800',
      borderColor: '#ff9800',
    };
  case 'Cancelled':
    return {
      backgroundColor: 'rgba(244, 67, 54, 0.2)',
      color: '#f44336',
      borderColor: '#f44336',
    };
  case 'Completed':
    return {
      backgroundColor: 'rgba(33, 150, 243, 0.2)',
      color: '#2196f3',
      borderColor: '#2196f3',
    };
  default:
    return {
      backgroundColor: 'rgba(158, 158, 158, 0.2)',
      color: '#9e9e9e',
      borderColor: '#9e9e9e',
    };
  }
};

const ActionButton = ({ color, onClick, children, title }) => (
  <Tooltip title={title} placement="top">
    <IconButton
      onClick={onClick}
      sx={{
        color: `${color}.main`,
        backgroundColor: 'rgba(0,0,0,0.05)',
        transition: 'all 0.3s',
        '&:hover': {
          backgroundColor: `${color}.main`,
          color: '#fff',
          transform: 'translateY(-2px) scale(1.1)',
          boxShadow: `0px 4px 12px -2px ${color}.light`,
        },
      }}
    >
      {children}
    </IconButton>
  </Tooltip>
);

const BookingCard = React.memo(({ booking, onUpdateStatus, onEdit, onDelete, onTransfer, onSendWelcome, onRoomingList, index, isProcessingCheckout = false }) => {
  const { settings } = useSettings();
  const isDarkMode = settings.theme?.darkMode;
  const accentColor = settings.theme?.accentColor || '#F59E42';

  const [hovered, setHovered] = useState(false);
  const [guestPrintFormOpen, setGuestPrintFormOpen] = useState(false);

  const cardStyle = {
    background: isDarkMode ? 'rgba(40, 40, 50, 0.22)' : 'rgba(255, 255, 255, 0.22)',
    backdropFilter: 'var(--app-blur-strong)',
    border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.125)' : 'rgba(209, 213, 219, 0.3)'}`,
    borderRadius: '16px',
    transition: 'all 0.4s ease', // Animate all properties for smooth height change
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    opacity: isProcessingCheckout ? 0.6 : 1,
    transform: isProcessingCheckout ? 'scale(0.98)' : 'scale(1)',
    '&:hover': {
      transform: isProcessingCheckout ? 'scale(0.98)' : 'translateY(-8px)',
      boxShadow: `0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04), 0 0 15px 0 ${accentColor}33, var(--app-card-glow)`,
    },
  };
  
  const isActive = !['Completed', 'Cancelled', 'Rejected'].includes(booking.bookingStatus);
  const actionButtons = [
    {
      title: 'Check In',
      icon: <CheckCircleOutlineIcon />,
      color: 'success',
      onClick: (e) => { e.stopPropagation(); onUpdateStatus(booking._id, 'Confirmed'); },
      // Available for any reservation where the guest hasn't arrived yet.
      condition: !booking.checkedIn && isActive,
    },
    {
      title: 'Checkout',
      icon: <HighlightOffIcon />,
      color: 'error',
      onClick: (e) => { e.stopPropagation(); onUpdateStatus(booking._id, 'Completed'); },
      // Only an in-house (checked-in) guest can be checked out.
      condition: booking.checkedIn === true,
    },
    {
      title: 'Send WiFi & Menu',
      icon: <WhatsAppIcon />,
      color: 'success',
      onClick: (e) => { e.stopPropagation(); onSendWelcome?.(booking); },
      // Resend the welcome (WiFi + food menu) to an in-house guest's WhatsApp.
      condition: typeof onSendWelcome === 'function' && booking.checkedIn === true,
    },
    {
      title: 'Rooming List',
      icon: <ListAltIcon />,
      color: 'info',
      onClick: (e) => { e.stopPropagation(); onRoomingList?.(booking); },
      // Group/company clusters only — manage room assignment + status here.
      condition: typeof onRoomingList === 'function' && !!booking.groupId,
    },
    {
      title: 'Transfer Room',
      icon: <SwapHorizIcon />,
      color: 'secondary',
      onClick: (e) => { e.stopPropagation(); onTransfer?.(booking); },
      condition: typeof onTransfer === 'function'
        && booking.bookingStatus !== 'Completed'
        && booking.bookingStatus !== 'Cancelled',
    },
    {
      title: 'Edit Booking',
      icon: <EditIcon />,
      color: 'primary',
      onClick: (e) => { e.stopPropagation(); onEdit(booking); },
      condition: booking.bookingStatus !== 'Completed' && booking.bookingStatus !== 'Cancelled',
    },
    {
      title: 'Delete Booking',
      icon: <DeleteIcon />,
      color: 'error',
      onClick: (e) => { e.stopPropagation(); onDelete(booking._id); },
      condition: true,
    },
    {
      title: 'Print Guest Form',
      icon: <NotesIcon />,
      color: 'info',
      onClick: (e) => { 
        e.stopPropagation(); 
        setGuestPrintFormOpen(true); 
      },
      condition: true,
    },
  ];

  return (
    <>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ duration: 0.4, delay: index * 0.05 }}
        style={{ height: '100%' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Card sx={cardStyle}>
          {/* Processing Overlay */}
          {isProcessingCheckout && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: '16px',
              }}
            >
              <Box sx={{ textAlign: 'center', color: '#fff' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Processing Checkout...
                </Typography>
                <Typography variant="caption">
                  Please wait
                </Typography>
              </Box>
            </Box>
          )}
          <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            {/* Top Section: Header & Guest Info */}
            <Box>
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: "bold",
                      color: accentColor
                    }}>
                    {booking.roomId?.roomNumber
                      ? `Room ${booking.roomId.roomNumber}`
                      : (booking.roomType || booking.roomId?.type || 'Room')}
                  </Typography>
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>
                    {booking.roomId?.roomNumber
                      ? (booking.roomId?.type || booking.roomType)
                      : 'Room assigned at check-in'}
                  </Typography>
                  {/* Multi-room reservation */}
                  {booking.roomCount > 1 && (
                    <Chip
                      size="small"
                      label={`× ${booking.roomCount} rooms`}
                      sx={{ mt: 0.75, height: 22, fontSize: 11, fontWeight: 700,
                        background: 'rgba(245,158,11,0.16)', color: '#b45309' }}
                    />
                  )}
                  {/* Booking-type badges */}
                  {booking.bookingType === 'group' && (
                    <Chip
                      size="small" icon={<GroupsIcon sx={{ fontSize: 14 }} />}
                      label={booking.isGroupMaster ? `Group · master${booking.groupRoomCount ? ` (${booking.groupRoomCount})` : ''}` : 'Group'}
                      sx={{ mt: 0.75, height: 22, fontSize: 11, fontWeight: 700,
                        background: 'rgba(var(--app-primary-rgb,99,102,241),0.12)', color: 'var(--app-primary)' }}
                    />
                  )}
                  {booking.bookingType === 'company' && (
                    <Chip
                      size="small" icon={<BusinessIcon sx={{ fontSize: 14 }} />}
                      label={booking.company?.name || 'Company'}
                      sx={{ mt: 0.75, height: 22, fontSize: 11, fontWeight: 700, maxWidth: 180,
                        background: 'rgba(16,185,129,0.14)', color: '#059669' }}
                    />
                  )}
                  {booking.transferHistory?.length > 0 && (
                    <Chip
                      size="small" icon={<SwapHorizIcon sx={{ fontSize: 14 }} />}
                      label={`Moved ${booking.transferHistory.length}×`}
                      sx={{ mt: 0.75, ml: 0.5, height: 22, fontSize: 11, fontWeight: 700,
                        background: 'rgba(245,158,11,0.14)', color: '#b45309' }}
                    />
                  )}
                </Box>
                <Stack direction="column" spacing={0.75} sx={{
                  alignItems: "flex-end"
                }}>
                  <Chip
                    label={booking.bookingStatus}
                    size="small"
                    sx={{
                      ...getStatusChipColor(booking.bookingStatus),
                      border: '1px solid',
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                      height: '26px',
                      borderRadius: '8px',
                    }}
                  />
                  {/* Presence: reserved vs physically in-house */}
                  {isActive && (
                    booking.checkedIn ? (
                      <Chip
                        label="In-house"
                        size="small"
                        sx={{
                          height: 20, fontSize: 11, fontWeight: 700, borderRadius: '6px',
                          backgroundColor: 'rgba(16,185,129,0.18)', color: '#059669',
                        }}
                      />
                    ) : (
                      <Chip
                        label="Reserved"
                        size="small"
                        sx={{
                          height: 20, fontSize: 11, fontWeight: 700, borderRadius: '6px',
                          backgroundColor: 'rgba(99,102,241,0.16)', color: 'var(--app-primary)',
                        }}
                      />
                    )
                  )}
                </Stack>
              </Box>

              {/* Guest Info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="subtitle1" sx={{
                  fontWeight: 600
                }}>
                  {booking.guestName}
                </Typography>
              </Box>
            </Box>

            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />

            {/* Bottom Section: Dates and Amounts */}
            <Box sx={{ mt: 'auto' }}>
              {/* Dates */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <EventIcon fontSize="small" color="action" />
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>
                  {format(new Date(booking.checkIn), 'dd MMM yyyy')} - {format(new Date(booking.checkOut), 'dd MMM yyyy')}
                </Typography>
              </Box>
              {/* Time and Amounts */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 8px' }}>
                <DetailItem icon={<AccessTimeIcon />} label="Check-in:" value={booking.checkInTime || 'N/A'} />
                <DetailItem icon={<MonetizationOnIcon />} label="Base:" value={money(booking.baseAmount || 0)} />
                <DetailItem icon={<MonetizationOnIcon />} label="GST:" value={money(booking.gstAmount || 0)} />
                <DetailItem icon={<MonetizationOnIcon />} label="Total:" value={money(booking.totalAmount || 0)} isTotal />
              </Box>
            </Box>

            {/* Action buttons container that animates on hover */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 1.5,
              pt: hovered ? 2 : 0,
              maxHeight: hovered ? '100px' : '0px',
              opacity: hovered ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.4s ease-in-out, opacity 0.3s ease-in-out 0.1s, padding-top 0.4s ease-in-out',
            }}>
              {actionButtons.filter(btn => btn.condition).map((btn, _i) => (
                <ActionButton key={btn.title} color={btn.color} onClick={btn.onClick} title={btn.title}>
                  {btn.icon}
                </ActionButton>
              ))}
            </Box>
          </CardContent>
        </Card>
      </motion.div>
      {/* Guest Print Form Dialog */}
      <GuestPrintForm
        open={guestPrintFormOpen}
        onClose={() => setGuestPrintFormOpen(false)}
        booking={booking}
        room={booking?.roomId || null}
      />
    </>
  );
});

const DetailItem = ({ icon, label, value, isTotal = false }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    {React.cloneElement(icon, { sx: { fontSize: '14px', color: 'text.secondary' } })}
    <Typography variant="caption" sx={{
      color: "text.secondary"
    }}>{label}</Typography>
    <Typography
      variant="caption"
      color={isTotal ? 'primary.main' : 'text.primary'}
      sx={{
        fontWeight: isTotal ? 'bold' : 'medium',
        ml: 'auto'
      }}>
      {value}
    </Typography>
  </Box>
);

export default BookingCard;