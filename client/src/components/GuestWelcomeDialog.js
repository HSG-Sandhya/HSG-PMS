// Shown right after a guest is checked in. Lets the front desk send the WiFi
// password + room-service menu link to the guest's WhatsApp in one tap
// (click-to-send via wa.me), and shows a scannable QR of the menu for print/display.
import { useEffect, useState } from 'react';
import {
  Box, Stack, Typography, TextField, Button, IconButton, Tooltip, Alert, Divider, InputAdornment,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WifiIcon from '@mui/icons-material/Wifi';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import PersonIcon from '@mui/icons-material/Person';
import QRCode from 'qrcode';
import FormDialog, { FormSection } from './forms/FormDialog';
import { buildGuestWelcome } from '../utils/guestWelcome';

const GuestWelcomeDialog = ({ open, onClose, booking, room, settings, onNotify }) => {
  const [phone, setPhone] = useState('');
  const [qr, setQr] = useState('');

  const welcome = booking ? buildGuestWelcome({ booking, room, settings }) : null;

  // Prefill the editable phone whenever a new booking is checked in.
  useEffect(() => {
    if (welcome) setPhone(welcome.phoneDigits || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?._id]);

  // Render the menu QR.
  useEffect(() => {
    let alive = true;
    if (open && welcome?.menuUrl) {
      QRCode.toDataURL(welcome.menuUrl, { width: 240, margin: 1 })
        .then((url) => { if (alive) setQr(url); })
        .catch(() => { if (alive) setQr(''); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, welcome?.menuUrl]);

  if (!booking || !welcome) return null;

  const waLink = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(welcome.message)}` : '';
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); onNotify?.(msg, 'success'); }
    catch { onNotify?.('Could not copy — please copy manually', 'warning'); }
  };

  const CopyBtn = ({ value, label }) => (
    <Tooltip title={`Copy ${label}`}>
      <IconButton size="small" onClick={() => copy(value, `${label} copied`)}><ContentCopyIcon fontSize="small" /></IconButton>
    </Tooltip>
  );

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      icon={<WhatsAppIcon />}
      eyebrow="Guest checked in"
      title="Send WiFi & menu on WhatsApp"
      submitLabel="Done"
      hideCancel
    >
      <FormSection title="Guest" icon={<PersonIcon fontSize="small" />} iconColor="#6366f1">
        <Stack
          direction="row"
          useFlexGap
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap"
          }}>
          <Typography variant="body1" sx={{
            fontWeight: 700
          }}>{booking.guestName}</Typography>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            Room {welcome.roomNumber || '—'}
          </Typography>
        </Stack>
      </FormSection>
      {welcome.wifiConfigured ? (
        <FormSection title="WiFi" icon={<WifiIcon fontSize="small" />} iconColor="#0ea5e9">
          <Stack spacing={1}>
            {welcome.wifiMatched && (
              <Typography variant="caption" sx={{ color: '#0ea5e9', fontWeight: 600 }}>
                Nearest network for Room {welcome.roomNumber} — strongest signal
              </Typography>
            )}
            {welcome.wifiSsid && (
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                <Box><Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>Network</Typography>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontFamily: 'monospace'
                    }}>{welcome.wifiSsid}</Typography></Box>
                <CopyBtn value={welcome.wifiSsid} label="Network" />
              </Stack>
            )}
            {welcome.wifiPassword && (
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                <Box><Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>Password</Typography>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontFamily: 'monospace'
                    }}>{welcome.wifiPassword}</Typography></Box>
                <CopyBtn value={welcome.wifiPassword} label="Password" />
              </Stack>
            )}
          </Stack>
        </FormSection>
      ) : (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No WiFi set yet — add it in <strong>Settings → Guest Welcome</strong> and it'll be included automatically.
        </Alert>
      )}
      <FormSection title="Food menu / room service" icon={<RestaurantMenuIcon fontSize="small" />} iconColor="#10b981">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{
          alignItems: "center"
        }}>
          {qr ? (
            <Box component="img" src={qr} alt="Menu QR code"
              sx={{ width: 132, height: 132, borderRadius: 2, border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
          ) : (
            <Box sx={{ width: 132, height: 132, borderRadius: 2, border: '1px dashed', borderColor: 'divider', flexShrink: 0 }} />
          )}
          <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>Scan to open, or send the link below.</Typography>
            <Stack direction="row" spacing={0.5} sx={{
              alignItems: "center"
            }}>
              <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{welcome.menuUrl}</Typography>
              <CopyBtn value={welcome.menuUrl} label="Menu link" />
            </Stack>
            {!welcome.websiteConfigured && (
              <Typography variant="caption" sx={{
                color: "warning.main"
              }}>
                Set your website address in Settings → Guest Welcome so this link works for guests.
              </Typography>
            )}
          </Stack>
        </Stack>
      </FormSection>
      <Divider />
      <Stack spacing={1.5}>
        <TextField
          label="Guest WhatsApp number" value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          helperText="Include country code (e.g. 91 for India). Pulled from the booking."
          fullWidth
          slotProps={{
            input: { startAdornment: <InputAdornment position="start">+</InputAdornment> }
          }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            component="a" href={waLink || undefined} target="_blank" rel="noopener noreferrer"
            disabled={!phone}
            onClick={() => { if (phone) onNotify?.('Opening WhatsApp…', 'info'); }}
            variant="contained" startIcon={<WhatsAppIcon />} fullWidth
            sx={{
              borderRadius: '999px', fontWeight: 800, py: 1.2,
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' },
            }}
          >
            Send on WhatsApp
          </Button>
          <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copy(welcome.message, 'Message copied')}
            sx={{ borderRadius: '999px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Copy message
          </Button>
        </Stack>
        {!phone && (
          <Typography variant="caption" sx={{
            color: "warning.main"
          }}>
            No phone number on this booking — enter one above to send.
          </Typography>
        )}
      </Stack>
    </FormDialog>
  );
};

export default GuestWelcomeDialog;
