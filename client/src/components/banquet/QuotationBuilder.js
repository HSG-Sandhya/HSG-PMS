import { useState, useEffect, useCallback, memo } from 'react';
import {
  Box, Grid, Typography, Button, IconButton, Chip, Stack, Divider,
  TextField, MenuItem, Tooltip, InputAdornment, Autocomplete, Switch, FormControlLabel,
} from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { format, parseISO } from 'date-fns';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import FormDialog, { FormSection } from '../forms/FormDialog';
import api from '../../api';
import { currencySym } from '../../utils/billing';
import {
  QUOTATION_PRESETS, PRICE_BASES, QUOTATION_STATUSES,
  emptyPackage, emptySection, emptyAddOn, emptyQuotation, packageTotal, addOnTotal,
} from './quotationPresets';

const EVENT_TYPES = ['Conference', 'Meeting', 'Corporate', 'Wedding', 'Engagement', 'Reception', 'Anniversary', 'Birthday', 'Party', 'Other'];
const SEATING_STYLES = ['Theater', 'Round Table', 'Classroom', 'U-Shape', 'Cluster', 'Banquet', 'Cocktail'];

// Common inclusion-block headings — staff pick one or type their own.
const SECTION_TITLE_SUGGESTIONS = [
  'Hall & Setup', 'Welcome (3 items)', 'Main Course (9 items)', 'Refreshments (2 breaks)',
  'Lunch (Buffet)', 'Dinner (Buffet)', 'Audio Visual', 'Accommodation', 'Decoration',
];

// Hoisted so they keep a stable identity across renders — a fresh object or
// array literal on every render makes MUI re-render the whole picker/
// autocomplete underneath it, which is what made this form stutter while typing.
const POPPER_SX = { sx: { '& .MuiPaper-root': { backgroundColor: 'white', opacity: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' } } };
const DATE_SLOTS = { textField: { fullWidth: true }, popper: POPPER_SX };
const NO_OPTIONS = [];

const datePickerSlots = (extra) => (extra
  ? { textField: { fullWidth: true, ...extra }, popper: POPPER_SX }
  : DATE_SLOTS);

// Dates round-trip as ISO strings from the API and as Date objects from the
// pickers — normalise both ways at the edges.
const toDate = (v) => (!v ? null : typeof v === 'string' ? parseISO(v) : v);
const toISO = (d) => (d ? format(d, 'yyyy-MM-dd') : null);

/**
 * One package column in the builder. Memoised and driven by index-based
 * callbacks that never change identity, so typing in the client details — or in
 * a *different* package — does not re-render this card. Without this the dialog
 * re-rendered every Autocomplete in the form on each keystroke.
 */
const PackageCard = memo(function PackageCard({
  pkg, index, guests, onPatch, onClone, onRemove, onPatchSection, onAddSection, onRemoveSection,
}) {
  const sections = pkg.sections || [];
  return (
    <Box sx={{ border: '1px solid', borderColor: pkg.recommended ? 'warning.main' : 'divider', borderRadius: 3, p: 2 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 800, color: 'var(--app-primary)' }}>Package {index + 1}</Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Duplicate package" arrow>
            <IconButton size="small" onClick={() => onClone(index)}><ContentCopyIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Remove package" arrow>
            <IconButton size="small" onClick={() => onRemove(index)} sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextField fullWidth required label="Package name" value={pkg.name}
            onChange={(e) => onPatch(index, { name: e.target.value })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 7 }}>
          <TextField fullWidth label="Tagline" value={pkg.tagline}
            onChange={(e) => onPatch(index, { tagline: e.target.value })}
            placeholder="8 hours · 09:30 AM – 05:30 PM" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField fullWidth type="number" label="Price" value={pkg.price}
            onChange={(e) => onPatch(index, { price: e.target.value })}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField select fullWidth label="Charged" value={pkg.priceBasis}
            onChange={(e) => onPatch(index, { priceBasis: e.target.value })}>
            {PRICE_BASES.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth type="number" label="Qty" value={pkg.quantity}
            onChange={(e) => onPatch(index, { quantity: e.target.value })}
            disabled={pkg.priceBasis === 'lump sum'}
            helperText={pkg.priceBasis === 'lump sum' ? 'n/a' : `default ${guests || 0}`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth type="number" label="Days" value={pkg.days}
            onChange={(e) => onPatch(index, { days: e.target.value })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <FormControlLabel
            control={<Switch checked={!!pkg.recommended} onChange={(e) => onPatch(index, { recommended: e.target.checked })} />}
            label={<Typography variant="caption" sx={{ fontWeight: 700 }}>Recommend</Typography>}
          />
        </Grid>
      </Grid>

      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 1.5, mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'text.secondary' }}>
          Inclusions
        </Typography>
        <Chip size="small" label={`Estimate ${currencySym()}${packageTotal(pkg, guests).toLocaleString('en-IN')}`}
          sx={{ fontWeight: 800, bgcolor: 'rgba(16,185,129,.12)', color: '#059669' }} />
      </Stack>
      <Stack spacing={1.5}>
        {sections.map((sec, si) => (
          <Grid container spacing={1.5} key={si} sx={{ alignItems: 'flex-start' }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Autocomplete
                freeSolo options={SECTION_TITLE_SUGGESTIONS}
                inputValue={sec.title || ''}
                onInputChange={(e, val) => onPatchSection(index, si, { title: val })}
                renderInput={(params) => <TextField {...params} fullWidth size="small" label="Block title" />}
              />
            </Grid>
            <Grid size={{ xs: 11, sm: 7 }}>
              <Autocomplete
                multiple freeSolo options={NO_OPTIONS}
                value={sec.items || NO_OPTIONS}
                onChange={(e, val) => onPatchSection(index, si, { items: val })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth size="small" label="Items" placeholder="Type an item, press Enter" />
                )}
              />
            </Grid>
            <Grid size={{ xs: 1 }}>
              <IconButton size="small" onClick={() => onRemoveSection(index, si)} sx={{ color: '#ef4444', mt: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Grid>
          </Grid>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center' }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onAddSection(index)} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Add inclusion block
        </Button>
      </Stack>
      <TextField fullWidth size="small" label="Package note" value={pkg.notes} sx={{ mt: 1.5 }}
        onChange={(e) => onPatch(index, { notes: e.target.value })}
        placeholder="e.g. Above 25 pax billed at ₹450 per additional delegate." />
    </Box>
  );
});

/** One optional-facility row. Memoised for the same reason as PackageCard. */
const AddOnRow = memo(function AddOnRow({ addOn, index, onPatch, onRemove }) {
  return (
    <Grid container spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Grid size={{ xs: 12, sm: 3 }}>
        <TextField fullWidth size="small" label="Facility" value={addOn.name}
          onChange={(e) => onPatch(index, { name: e.target.value })} />
      </Grid>
      <Grid size={{ xs: 6, sm: 2 }}>
        <TextField fullWidth size="small" type="number" label="Price" value={addOn.price}
          onChange={(e) => onPatch(index, { price: e.target.value })}
          slotProps={{ input: { startAdornment: <InputAdornment position="start">{currencySym()}</InputAdornment> } }} />
      </Grid>
      <Grid size={{ xs: 6, sm: 2 }}>
        <TextField fullWidth size="small" label="Unit" value={addOn.unit}
          onChange={(e) => onPatch(index, { unit: e.target.value })} placeholder="per event" />
      </Grid>
      <Grid size={{ xs: 4, sm: 1.5 }}>
        <TextField fullWidth size="small" type="number" label="Qty" value={addOn.quantity}
          onChange={(e) => onPatch(index, { quantity: e.target.value })} />
      </Grid>
      <Grid size={{ xs: 4, sm: 1.5 }}>
        <TextField fullWidth size="small" type="number" label="GST %" value={addOn.gstPercent}
          onChange={(e) => onPatch(index, { gstPercent: e.target.value })} />
      </Grid>
      <Grid size={{ xs: 3, sm: 1.5 }}>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.2, fontWeight: 700 }}>
          {currencySym()}{addOnTotal(addOn).toLocaleString('en-IN')}
        </Typography>
      </Grid>
      <Grid size={{ xs: 1, sm: 0.5 }}>
        <IconButton size="small" onClick={() => onRemove(index)} sx={{ color: '#ef4444', mt: 0.5 }}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Grid>
    </Grid>
  );
});

const QuotationBuilder = ({ open, onClose, onSaved, editing, halls = [], onNotify }) => {
  const [form, setForm] = useState(emptyQuotation);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing
      ? {
        ...emptyQuotation(),
        ...editing,
        hallId: editing.hallId?._id || editing.hallId || '',
        packages: editing.packages || [],
        addOns: editing.addOns || [],
        complimentary: editing.complimentary || [],
        terms: editing.terms || [],
      }
      : emptyQuotation());
  }, [open, editing]);

  const set = useCallback((k, v) => setForm((p) => ({ ...p, [k]: v })), []);

  // Applying a preset replaces the offer (packages / add-ons / terms) but keeps
  // whatever client and event details have already been typed.
  const applyPreset = (preset) => {
    setForm((p) => ({
      ...p,
      eventType: preset.eventType,
      seatingStyle: p.seatingStyle || preset.seatingStyle,
      startTime: p.startTime || preset.startTime,
      endTime: p.endTime || preset.endTime,
      packages: preset.packages.map((pkg) => ({ ...pkg, sections: pkg.sections.map((s) => ({ ...s, items: [...s.items] })) })),
      addOns: preset.addOns.map((a) => ({ ...a })),
      complimentary: [...preset.complimentary],
      terms: [...preset.terms],
    }));
    onNotify?.(`${preset.label} package template applied`, 'info');
  };

  // ── Package list helpers ──────────────────────────────────────────────────
  // All of these update through the functional form of setForm and capture
  // nothing, so their identity is stable for the life of the dialog. That is
  // what lets PackageCard's memo skip untouched cards while typing.
  const patchPackage = useCallback((i, patch) => setForm((p) => ({
    ...p, packages: p.packages.map((pkg, idx) => (idx === i ? { ...pkg, ...patch } : pkg)),
  })), []);
  const addPackage = useCallback(() => setForm((p) => ({ ...p, packages: [...p.packages, emptyPackage()] })), []);
  const clonePackage = useCallback((i) => setForm((p) => {
    const copy = { ...p.packages[i], name: `${p.packages[i].name} (copy)`, recommended: false };
    copy.sections = (copy.sections || []).map((s) => ({ ...s, items: [...s.items] }));
    return { ...p, packages: [...p.packages.slice(0, i + 1), copy, ...p.packages.slice(i + 1)] };
  }), []);
  const removePackage = useCallback((i) => setForm((p) => ({
    ...p, packages: p.packages.filter((_, idx) => idx !== i),
  })), []);

  const patchSection = useCallback((pi, si, patch) => setForm((p) => ({
    ...p,
    packages: p.packages.map((pkg, idx) => (idx !== pi ? pkg : {
      ...pkg, sections: (pkg.sections || []).map((s, sIdx) => (sIdx === si ? { ...s, ...patch } : s)),
    })),
  })), []);
  const addSection = useCallback((pi) => setForm((p) => ({
    ...p,
    packages: p.packages.map((pkg, idx) => (idx !== pi ? pkg : {
      ...pkg, sections: [...(pkg.sections || []), emptySection()],
    })),
  })), []);
  const removeSection = useCallback((pi, si) => setForm((p) => ({
    ...p,
    packages: p.packages.map((pkg, idx) => (idx !== pi ? pkg : {
      ...pkg, sections: (pkg.sections || []).filter((_, sIdx) => sIdx !== si),
    })),
  })), []);

  // ── Add-on helpers ────────────────────────────────────────────────────────
  const patchAddOn = useCallback((i, patch) => setForm((p) => ({
    ...p, addOns: p.addOns.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
  })), []);
  const addAddOn = useCallback(() => setForm((p) => ({ ...p, addOns: [...p.addOns, emptyAddOn()] })), []);
  const removeAddOn = useCallback((i) => setForm((p) => ({
    ...p, addOns: p.addOns.filter((_, idx) => idx !== i),
  })), []);

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.clientName?.trim()) { onNotify?.('Client name is required', 'error'); return; }
    if (!form.packages.length) { onNotify?.('Add at least one package to quote', 'error'); return; }
    if (form.packages.some((p) => !p.name?.trim())) { onNotify?.('Every package needs a name', 'error'); return; }

    setSaving(true);
    try {
      // Send only the fields staff edit here. The loaded document carries
      // server-owned fields (_id, timestamps, conversion state) that must not
      // be echoed back — the server drops them too, but not sending them keeps
      // a stale form from ever competing with the record.
      const payload = {
        clientName: form.clientName, clientCompany: form.clientCompany,
        clientPhone: form.clientPhone, clientEmail: form.clientEmail,
        clientAddress: form.clientAddress, clientGstin: form.clientGstin,
        eventType: form.eventType, eventTitle: form.eventTitle,
        startTime: form.startTime, endTime: form.endTime,
        seatingStyle: form.seatingStyle, notes: form.notes,
        preparedBy: form.preparedBy, contactNumber: form.contactNumber,
        complimentary: form.complimentary, terms: form.terms,
        status: form.status,
        hallId: form.hallId || null,
        hallName: halls.find((h) => h._id === form.hallId)?.name || form.hallName || '',
        expectedGuests: Number(form.expectedGuests) || 0,
        quotationDate: toISO(toDate(form.quotationDate)) || undefined,
        validUpto: toISO(toDate(form.validUpto)),
        eventDate: toISO(toDate(form.eventDate)),
        endDate: toISO(toDate(form.endDate)),
        packages: form.packages.map((p) => ({
          ...p,
          price: Number(p.price) || 0,
          quantity: Number(p.quantity) || 0,
          days: Number(p.days) || 1,
          sections: (p.sections || []).filter((s) => s.title?.trim() || s.items?.length),
        })),
        addOns: form.addOns.filter((a) => a.name?.trim()).map((a) => ({
          ...a,
          price: Number(a.price) || 0,
          quantity: Number(a.quantity) || 1,
          gstPercent: Number(a.gstPercent) || 0,
        })),
      };
      const { data } = editing
        ? await api.banquet.updateQuotation(editing._id, payload)
        : await api.banquet.createQuotation(payload);
      onNotify?.(`Quotation ${editing ? 'updated' : 'created'}`, 'success');
      onSaved?.(data?.data);
      onClose?.();
    } catch (err) {
      onNotify?.(err.response?.data?.message || err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const guests = Number(form.expectedGuests) || 0;

  return (
    <FormDialog
      open={open}
      onClose={saving ? undefined : onClose}
      onSubmit={handleSave}
      maxWidth="lg"
      icon={<RequestQuoteOutlinedIcon />}
      eyebrow="Banquet Sales"
      title={editing ? `Edit quotation ${editing.quotationNumber || ''}` : 'New event quotation'}
      submitDisabled={saving}
      submitLabel={saving ? 'Saving…' : (editing ? 'Save changes' : 'Create quotation')}
    >
      {!editing && (
        <FormSection title="Start from a template" icon={<Inventory2OutlinedIcon fontSize="small" />} iconColor="#8b5cf6">
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {QUOTATION_PRESETS.map((preset) => (
              <Tooltip key={preset.id} title={preset.description} arrow>
                <Chip
                  label={preset.label}
                  onClick={() => applyPreset(preset)}
                  clickable
                  sx={{ fontWeight: 700, borderRadius: '999px' }}
                />
              </Tooltip>
            ))}
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Templates fill the packages, optional facilities and terms below — every field stays editable.
          </Typography>
        </FormSection>
      )}

      <FormSection title="Prepared For" icon={<PersonOutlineIcon fontSize="small" />} iconColor="#0ea5e9">
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth required label="Client name" value={form.clientName}
              onChange={(e) => set('clientName', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Company / organisation" value={form.clientCompany}
              onChange={(e) => set('clientCompany', e.target.value)}
              helperText="Printed as the client name when set" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Mobile" value={form.clientPhone}
              onChange={(e) => set('clientPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Email" type="email" value={form.clientEmail}
              onChange={(e) => set('clientEmail', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField fullWidth label="Address" value={form.clientAddress}
              onChange={(e) => set('clientAddress', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth label="GSTIN" value={form.clientGstin}
              onChange={(e) => set('clientGstin', e.target.value.toUpperCase())} />
          </Grid>
        </Grid>
      </FormSection>

      <FormSection title="Event Details" icon={<EventNoteOutlinedIcon fontSize="small" />} iconColor="#f59e0b">
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select fullWidth label="Event type" value={form.eventType}
              onChange={(e) => set('eventType', e.target.value)}>
              {EVENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField fullWidth label="Event title" value={form.eventTitle}
              onChange={(e) => set('eventTitle', e.target.value)}
              helperText="Prints as the sheet heading, e.g. “Annual Sales Conference”" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select fullWidth label="Hall" value={form.hallId}
              onChange={(e) => set('hallId', e.target.value)}>
              <MenuItem value=""><em>— Not fixed yet —</em></MenuItem>
              {halls.map((h) => <MenuItem key={h._id} value={h._id}>{h.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <DatePicker format="dd/MM/yyyy" label="Event date" value={toDate(form.eventDate)}
              onChange={(d) => set('eventDate', d)} slotProps={datePickerSlots()} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <DatePicker format="dd/MM/yyyy" label="End date" value={toDate(form.endDate)}
              onChange={(d) => set('endDate', d)} slotProps={datePickerSlots()}
              minDate={toDate(form.eventDate) || undefined} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TimePicker label="Start time" value={form.startTime ? new Date(`1970-01-01T${form.startTime}`) : null}
              onChange={(d) => set('startTime', d ? format(d, 'HH:mm') : '')}
              slotProps={datePickerSlots()} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TimePicker label="End time" value={form.endTime ? new Date(`1970-01-01T${form.endTime}`) : null}
              onChange={(d) => set('endTime', d ? format(d, 'HH:mm') : '')}
              slotProps={datePickerSlots()} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth type="number" label="Expected guests" value={form.expectedGuests}
              onChange={(e) => set('expectedGuests', e.target.value)}
              helperText="Used for per-person estimates" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField select fullWidth label="Seating style" value={form.seatingStyle}
              onChange={(e) => set('seatingStyle', e.target.value)}>
              <MenuItem value=""><em>—</em></MenuItem>
              {SEATING_STYLES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </FormSection>

      <FormSection title="Packages Quoted" icon={<Inventory2OutlinedIcon fontSize="small" />} iconColor="#10b981">
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          Each package prints as one column on the quotation sheet — clients compare them side by side.
        </Typography>
        <Stack spacing={2}>
          {form.packages.map((pkg, pi) => (
            <PackageCard
              key={pi}
              pkg={pkg}
              index={pi}
              guests={guests}
              onPatch={patchPackage}
              onClone={clonePackage}
              onRemove={removePackage}
              onPatchSection={patchSection}
              onAddSection={addSection}
              onRemoveSection={removeSection}
            />
          ))}
        </Stack>
        <Button startIcon={<AddIcon />} onClick={addPackage} sx={{ mt: 2, textTransform: 'none', fontWeight: 700 }}>
          Add package option
        </Button>
      </FormSection>

      <FormSection title="Additional Facilities (Optional)" icon={<TuneOutlinedIcon fontSize="small" />} iconColor="#6366f1">
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          Chargeable extras quoted exclusive of GST. The client picks these at acceptance and they carry into the bill.
        </Typography>
        <Stack spacing={1.5}>
          {form.addOns.map((a, i) => (
            <AddOnRow key={i} addOn={a} index={i} onPatch={patchAddOn} onRemove={removeAddOn} />
          ))}
        </Stack>
        <Button startIcon={<AddIcon />} onClick={addAddOn} sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700 }}>
          Add facility
        </Button>
      </FormSection>

      <FormSection title="Complimentary, Terms & Validity" icon={<CardGiftcardOutlinedIcon fontSize="small" />} iconColor="#f43f5e">
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={12}>
            <Autocomplete
              multiple freeSolo options={NO_OPTIONS}
              value={form.complimentary}
              onChange={(e, val) => set('complimentary', val)}
              renderInput={(params) => (
                <TextField {...params} fullWidth label="Complimentary services"
                  placeholder="Type a service, press Enter"
                  helperText="Printed as the free-inclusions strip" />
              )}
            />
          </Grid>
          <Grid size={12}>
            <Autocomplete
              multiple freeSolo options={NO_OPTIONS}
              value={form.terms}
              onChange={(e, val) => set('terms', val)}
              renderInput={(params) => (
                <TextField {...params} fullWidth label="Terms & conditions"
                  placeholder="Type a term, press Enter"
                  helperText="Leave empty to print the standard terms" />
              )}
            />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline rows={2} label="Note to client" value={form.notes}
              onChange={(e) => set('notes', e.target.value)} />
          </Grid>
          <Divider sx={{ width: '100%', my: 1 }} />
          <Grid size={{ xs: 12, sm: 3 }}>
            <DatePicker format="dd/MM/yyyy" label="Quotation date" value={toDate(form.quotationDate)}
              onChange={(d) => set('quotationDate', d)} slotProps={datePickerSlots()} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <DatePicker format="dd/MM/yyyy" label="Valid upto" value={toDate(form.validUpto)}
              onChange={(d) => set('validUpto', d)} slotProps={datePickerSlots({ helperText: 'Blank = 15 days' })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth label="Prepared by" value={form.preparedBy}
              onChange={(e) => set('preparedBy', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField select fullWidth label="Status" value={form.status}
              onChange={(e) => set('status', e.target.value)}>
              {QUOTATION_STATUSES.filter((s) => s !== 'Converted').map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </FormSection>
    </FormDialog>
  );
};

export default QuotationBuilder;
