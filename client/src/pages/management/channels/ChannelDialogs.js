import { useState, useEffect } from 'react';
import { Box, Button, Chip, Divider, FormControl, Grid, IconButton, InputAdornment, InputLabel, List, ListItem, MenuItem, Paper, Select, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, AttachMoney as MoneyIcon, Room as RoomIcon, Storefront as StorefrontIcon } from '@mui/icons-material';
import FormDialog, { FormSection } from '../../../components/forms/FormDialog';
import api from '../../../api';
import { GLASS, typeLabel, statusMeta, channelColor, formatDate, inr } from './channelHelpers';
import { currencySym } from '../../../utils/billing';

const ChannelDetailsDialog = ({ channel, stats, onClose }) => {
  if (!channel) return null;
  const color = channelColor(channel);
  const sm = statusMeta(channel.status);
  const yearTotal = stats ? Object.values(stats.monthlyBookings || {}).reduce((a, b) => a + b, 0) : 0;

  return (
    <FormDialog
      open={!!channel}
      onClose={onClose}
      maxWidth="md"
      icon={<StorefrontIcon />}
      eyebrow={typeLabel(channel.type)}
      title={channel.name}
      hideCancel
      submitLabel="Close"
      extraActions={<Chip size="small" label={sm.label} color={sm.color} sx={{ mr: 'auto' }} />}
    >
      <FormSection title="Channel Overview" icon={<StorefrontIcon fontSize="small" />} iconColor={color}>
        <Grid container spacing={3}>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
              Commercials
            </Typography>
            <List dense disablePadding>
              <DetailRow label="Commission" value={`${channel.settings?.commission ?? 0}%`} />
              <DetailRow label="Markup" value={`${channel.settings?.markup ?? 0}%`} />
              <DetailRow label="Currency" value={channel.settings?.currency} />
              <DetailRow label="Rate multiplier" value={`× ${channel.rateSettings?.baseRateMultiplier ?? 1}`} />
            </List>
          </Grid>
          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
              Sync & connection
            </Typography>
            <List dense disablePadding>
              <DetailRow label="API" value={channel.apiConfig?.isActive ? 'Connected' : 'Not connected'} />
              <DetailRow label="Auto sync" value={channel.syncSettings?.autoSync ? `Every ${channel.syncSettings.syncInterval} min` : 'Off'} />
              <DetailRow label="Last sync" value={formatDate(channel.syncSettings?.lastSync)} />
              <DetailRow label="Rooms mapped" value={channel.roomMappings?.length ?? 0} />
            </List>
          </Grid>

          {channel.contact?.name || channel.contact?.email || channel.contact?.phone ? (
            <Grid size={12}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
                Contact
              </Typography>
              <Typography variant="body2">
                {[channel.contact.name, channel.contact.email, channel.contact.phone].filter(Boolean).join(' · ')}
              </Typography>
            </Grid>
          ) : null}

          <Grid size={12}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Performance
            </Typography>
            <Grid container spacing={2}>
              <PerfCard value={stats?.totalBookings ?? channel.metrics?.totalBookings ?? 0} label="Total Bookings" />
              <PerfCard value={inr(stats?.totalRevenue ?? channel.metrics?.totalRevenue ?? 0)} label="Revenue" />
              <PerfCard value={(stats?.averageRating ?? channel.metrics?.averageRating ?? 0).toFixed(1)} label="Avg Rating" />
              <PerfCard value={yearTotal} label="Bookings this year" />
            </Grid>
          </Grid>
        </Grid>
      </FormSection>
    </FormDialog>
  );
};

const DetailRow = ({ label, value }) => (
  <ListItem disableGutters sx={{ py: 0.5, display: 'flex', justifyContent: 'space-between' }}>
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {value}
    </Typography>
  </ListItem>
);

const PerfCard = ({ value, label }) => (
  <Grid
    size={{
      xs: 6,
      md: 3
    }}>
    <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 3, ...GLASS }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--app-primary)' }} noWrap>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Paper>
  </Grid>
);

// ---------------------------------------------------------------------------
// Room mapping dialog
// ---------------------------------------------------------------------------
const RoomMappingDialog = ({ channel, availableRooms, onClose, onSaved }) => {
  const [mappings, setMappings] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (channel) {
      setMappings(
        (channel.roomMappings || []).map((m) => ({
          internalRoomId: m.internalRoomId?._id || m.internalRoomId || '',
          externalRoomId: m.externalRoomId || '',
          externalRoomName: m.externalRoomName || '',
          isActive: m.isActive !== false,
        }))
      );
    }
  }, [channel]);

  if (!channel) return null;

  const update = (i, field, value) => setMappings((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  const add = () => setMappings((prev) => [...prev, { internalRoomId: '', externalRoomId: '', externalRoomName: '', isActive: true }]);
  const remove = (i) => setMappings((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    await onSaved(channel._id, mappings.filter((m) => m.internalRoomId));
    setSaving(false);
  };

  return (
    <FormDialog
      open={!!channel}
      onClose={saving ? undefined : onClose}
      onSubmit={(e) => { if (e?.preventDefault) e.preventDefault(); save(); }}
      maxWidth="md"
      icon={<RoomIcon />}
      eyebrow={channel.name}
      title="Room Mapping"
      submitDisabled={saving}
      submitLabel={saving ? 'Saving…' : 'Save Mappings'}
    >
      <FormSection title="Room Mappings" icon={<RoomIcon fontSize="small" />} iconColor="#6366f1">
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Map your internal rooms to this channel's room codes so inventory stays in sync.
        </Typography>

        {mappings.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No room mappings yet.</Box>
        )}

        {mappings.map((m, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
            <Grid container spacing={2} sx={{
              alignItems: "center"
            }}>
              <Grid
                size={{
                  xs: 12,
                  md: 4
                }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Internal Room</InputLabel>
                  <Select label="Internal Room" value={m.internalRoomId} onChange={(e) => update(i, 'internalRoomId', e.target.value)}>
                    {availableRooms.map((room) => (
                      <MenuItem key={room._id} value={room._id}>
                        {room.number} — {room.type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid
                size={{
                  xs: 6,
                  md: 3
                }}>
                <TextField fullWidth size="small" label="External Room ID" value={m.externalRoomId} onChange={(e) => update(i, 'externalRoomId', e.target.value)} />
              </Grid>
              <Grid
                size={{
                  xs: 6,
                  md: 3
                }}>
                <TextField fullWidth size="small" label="External Name" value={m.externalRoomName} onChange={(e) => update(i, 'externalRoomName', e.target.value)} />
              </Grid>
              <Grid
                size={{
                  xs: 8,
                  md: 1
                }}>
                <Tooltip title={m.isActive ? 'Active' : 'Inactive'}>
                  <Switch checked={m.isActive} onChange={(e) => update(i, 'isActive', e.target.checked)} size="small" />
                </Tooltip>
              </Grid>
              <Grid
                size={{
                  xs: 4,
                  md: 1
                }}>
                <IconButton size="small" color="error" onClick={() => remove(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          </Paper>
        ))}

        <Button startIcon={<AddIcon />} onClick={add} variant="outlined" sx={{ mt: 1, borderRadius: 2 }}>
          Add mapping
        </Button>
      </FormSection>
    </FormDialog>
  );
};

// ---------------------------------------------------------------------------
// Rate calculator dialog
// ---------------------------------------------------------------------------
const RateCalculatorDialog = ({ channel, onClose, notify }) => {
  const [baseRate, setBaseRate] = useState('');
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (channel) {
      setBaseRate('');
      setResult(null);
    }
  }, [channel]);

  if (!channel) return null;

  // live client-side estimate mirroring the server formula
  const estimate = (() => {
    const base = Number(baseRate);
    if (!base) return null;
    let r = base;
    if (channel.settings?.markup) r += (base * channel.settings.markup) / 100;
    if (channel.settings?.commission) r = r / (1 - channel.settings.commission / 100);
    return Math.round(r);
  })();

  const calculate = async () => {
    if (!baseRate) return;
    setCalculating(true);
    try {
      const res = await api.channels.calculateRates(channel._id, { baseRate: Number(baseRate) });
      setResult(res.data);
    } catch {
      notify('Error calculating rate', 'error');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <FormDialog
      open={!!channel}
      onClose={onClose}
      onSubmit={(e) => { if (e?.preventDefault) e.preventDefault(); calculate(); }}
      maxWidth="sm"
      icon={<MoneyIcon />}
      eyebrow={channel.name}
      title="Rate Calculator"
      cancelLabel="Close"
      submitDisabled={!baseRate || calculating}
      submitLabel={calculating ? 'Calculating…' : 'Calculate'}
    >
      <FormSection title="Rate Preview" icon={<MoneyIcon fontSize="small" />} iconColor="#10b981">
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Preview the sell rate after applying this channel's markup and commission.
        </Typography>
        <TextField
          fullWidth
          autoFocus
          type="number"
          label="Base room rate"
          value={baseRate}
          onChange={(e) => setBaseRate(e.target.value)}
          sx={{ mb: 2 }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> }
          }}
        />
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>Commission</Typography>
            <Typography variant="body2">{channel.settings?.commission ?? 0}%</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>Markup</Typography>
            <Typography variant="body2">{channel.settings?.markup ?? 0}%</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>Currency</Typography>
            <Typography variant="body2">{channel.settings?.currency}</Typography>
          </Box>
        </Paper>

        {(result || estimate) && (
          <Box
            sx={{
              p: 2.5,
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'rgba(var(--app-primary-rgb),0.06)',
              border: '1px dashed rgba(var(--app-primary-rgb),0.3)',
            }}
          >
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              {result ? 'Sell rate' : 'Estimated sell rate'}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'var(--app-primary)' }}>
              {inr(result ? result.finalRate : estimate)}
            </Typography>
          </Box>
        )}
      </FormSection>
    </FormDialog>
  );
};


export { ChannelDetailsDialog, RoomMappingDialog, RateCalculatorDialog };
