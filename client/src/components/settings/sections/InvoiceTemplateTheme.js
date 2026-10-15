import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Switch,
  Slider,
  Button,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  VisibilityOutlined as PreviewIcon,
} from '@mui/icons-material';
import api from '../../../api';

// The hotel's ONE house styling for invoices.
//
// There is deliberately no per-template copy of this panel: a brand colour is a
// property of the hotel, not of a layout, so it is set once here and every
// themed design follows it. Fields left untouched keep each design's own
// default, which is what stops the four designs collapsing into one look.
//
// Every control is built from the field descriptors the server returns
// (/settings/invoice-theme), not from a list hardcoded in the client — adding a
// knob to services/invoiceTemplates/theme.js is enough to make it appear here,
// with its own label, help text and limits.

const GROUP_ORDER = ['Colours', 'Wording', 'Blocks', 'Motion', 'Layout'];

const ColorControl = ({ field, value, onChange }) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
    <Box
      component="input"
      type="color"
      value={value || '#000000'}
      onChange={(e) => onChange(e.target.value)}
      aria-label={field.label}
      sx={{
        width: 38,
        height: 38,
        flexShrink: 0,
        border: '1px solid rgba(148,163,184,0.35)',
        borderRadius: 1.5,
        background: 'transparent',
        cursor: 'pointer',
        padding: 0,
      }}
    />
    <TextField
      size="small"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{ htmlInput: { maxLength: 9, spellCheck: false } }}
      sx={{ width: 110, '& input': { fontFamily: 'monospace', fontSize: 13 } }}
    />
  </Stack>
);

const FieldControl = ({ field, value, onChange }) => {
  switch (field.type) {
    case 'color':
      return <ColorControl field={field} value={value} onChange={onChange} />;
    case 'text':
      return (
        <TextField
          size="small"
          fullWidth
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ htmlInput: { maxLength: field.max || 200 } }}
        />
      );
    case 'multiline':
      return (
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={4}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ htmlInput: { maxLength: field.max || 1200 } }}
        />
      );
    case 'toggle':
      return (
        <Switch
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          slotProps={{ input: { 'aria-label': field.label } }}
        />
      );
    case 'number':
      return (
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 210 }}>
          <Slider
            size="small"
            value={Number(value) || field.min}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            onChange={(_, v) => onChange(v)}
            aria-label={field.label}
            sx={{ flex: 1 }}
          />
          <Typography variant="body2" sx={{ width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {Number(value) || field.min}
          </Typography>
        </Stack>
      );
    case 'select':
      return (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={value}
          onChange={(_, v) => { if (v !== null) onChange(v); }}
        >
          {field.options.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={{ px: 1.5, textTransform: 'none' }}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      );
    default:
      return null;
  }
};

const InvoiceTemplateTheme = ({ onNotify, onPreview, onSaved }) => {
  const [fields, setFields] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [values, setValues] = useState({});
  const [baseline, setBaseline] = useState({});
  const [seededFrom, setSeededFrom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/settings/invoice-theme');
      const payload = data?.data || {};
      setFields(payload.fields || []);
      setDefaults(payload.defaults || {});
      setSeededFrom(payload.seededFrom || null);
      // `resolved` is exactly what an invoice renders with today, so the form
      // opens showing the real current state rather than bare defaults.
      setValues(payload.resolved || {});
      setBaseline(payload.resolved || {});
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the invoice styling');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  // Only what differs from the seed is stored, and that is the whole mechanism
  // behind "one styling, four designs": a field the admin never touched is
  // absent from the delta, so each design falls back to its own default for it.
  // It also means a later improvement to a default still reaches hotels that
  // never overrode that particular field.
  const delta = useMemo(() => {
    const out = {};
    for (const field of fields) {
      const v = values[field.key];
      if (v !== undefined && v !== defaults[field.key]) out[field.key] = v;
    }
    return out;
  }, [fields, values, defaults]);

  const dirty = useMemo(
    () => fields.some((f) => values[f.key] !== baseline[f.key]),
    [fields, values, baseline],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings/invoice-theme', {
        customization: delta,
      });
      // Show back what was actually stored, not what was typed. A half-typed
      // colour like "#ab" is rejected server-side and falls back to the
      // template default — leaving it on screen would claim a value that no
      // invoice will ever render with.
      const resolved = data?.data?.resolved || values;
      setValues(resolved);
      setBaseline(resolved);
      onNotify?.('Invoice styling saved', 'success');
      onSaved?.();   // let the gallery re-render its thumbnails in the new colours
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValues({ ...defaults });
    onNotify?.('Reverted to the design defaults. Save to apply.', 'info');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>;
  }

  const grouped = GROUP_ORDER
    .map((group) => ({ group, items: fields.filter((f) => f.group === group) }))
    .filter((g) => g.items.length);

  return (
    <Box sx={{ mt: 1.5 }}>
      <Alert severity="info" variant="outlined" sx={{ mb: 2, py: 0.5 }}>
        These settings apply to every design that follows the house styling.
        Anything you leave alone keeps that design&rsquo;s own default, so the designs stay
        distinct until you change a value.
        {seededFrom ? ` The pickers are seeded from ${seededFrom.name}, your selected design.` : ''}
        {' '}The moving background plays on screen only. Printing and PDF always freeze it
        to a still, light background.
      </Alert>

      <Stack spacing={2.5}>
        {grouped.map(({ group, items }) => (
          <Box key={group}>
            <Typography
              variant="overline"
              sx={{ color: 'primary.main', letterSpacing: '0.14em', fontWeight: 700 }}
            >
              {group}
            </Typography>
            <Divider sx={{ mb: 1.5, mt: 0.5 }} />
            <Stack spacing={1.5}>
              {items.map((field) => (
                <Stack
                  key={field.key}
                  direction={{ xs: 'column', sm: field.type === 'multiline' ? 'column' : 'row' }}
                  spacing={1}
                  sx={{
                    alignItems: { xs: 'stretch', sm: field.type === 'multiline' ? 'stretch' : 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ minWidth: 190, pr: 1 }}>
                    <Tooltip title={field.help || ''} placement="top-start" arrow>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {field.label}
                      </Typography>
                    </Tooltip>
                    {field.help && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {field.help}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ flexShrink: 0, width: field.type === 'text' || field.type === 'multiline' ? '100%' : 'auto', maxWidth: field.type === 'text' ? 360 : 'none' }}>
                    <FieldControl
                      field={field}
                      value={values[field.key]}
                      onChange={(v) => setField(field.key, v)}
                    />
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'flex-end', mt: 2.5, flexWrap: 'wrap', gap: 1 }}
      >
        <Button size="small" startIcon={<ResetIcon />} onClick={handleReset}>
          Reset to defaults
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PreviewIcon />}
          onClick={() => onPreview?.(delta)}
        >
          Preview these settings
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? 'Saving…' : 'Save styling'}
        </Button>
      </Stack>
    </Box>
  );
};

export default InvoiceTemplateTheme;
