import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  CircularProgress,
  RadioGroup,
  Radio,
  FormControlLabel,
  Button,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Event as EventIcon,
  Hotel as RoomIcon,
  RequestQuoteOutlined as QuoteIcon,
  ReceiptLongOutlined as InvoiceIcon,
  CelebrationOutlined as BanquetIcon,
} from '@mui/icons-material';
import api from '../../../api';
import { broadcastSettingsChange } from '../settingsEvents';

const PREVIEW_PATH = '/settings/invoice/preview';
const BANQUET_PREVIEW_PATH = '/settings/banquet/preview';

// Tactile press for the preview buttons: a soft lift on hover, a quick
// scale-down + inset "pressed in" shadow while held, then a smooth spring
// back out on release. Honours the OS reduce-motion preference.
const pressSx = {
  borderRadius: 2,
  willChange: 'transform',
  transition: 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 6px 14px -6px rgba(0, 0, 0, 0.35)',
  },
  '&:active': {
    transform: 'scale(0.9)',
    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.3)',
    transition: 'transform 80ms ease, box-shadow 80ms ease',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover, &:active': { transform: 'none', boxShadow: 'none' },
  },
};

const glassCardSx = {
  borderRadius: 2,
  background: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backgroundColor: 'rgba(255, 255, 255, var(--app-surface-alpha, 0.05))',
  backgroundImage: 'none',
  backdropFilter: 'var(--app-blur)',
  WebkitBackdropFilter: 'var(--app-blur)',
  border: '1px solid rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.05), 0 0 24px rgba(var(--app-primary-rgb), 0.08), inset 0 1px 0 rgba(255, 255, 255, var(--app-surface-border-alpha, 0.08))',
};

// One row per template with a radio, name/description and preview buttons.
const TemplateRow = ({ template, selectedId, originalId, actions }) => {
  const id = template.id || template._id;
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: id === selectedId ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        bgcolor: id === selectedId ? 'action.selected' : 'transparent',
        p: 1.5,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <FormControlLabel
          value={id}
          control={<Radio />}
          label={
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={600}>
                  {template.name || id}
                </Typography>
                {id === originalId && <Chip label="Active" color="success" size="small" />}
              </Stack>
              {template.description && (
                <Typography variant="body2" color="text.secondary">
                  {template.description}
                </Typography>
              )}
            </Box>
          }
          sx={{ m: 0, alignItems: 'flex-start', flex: 1 }}
        />
        <Stack direction="row" spacing={0.5}>{actions(id)}</Stack>
      </Stack>
    </Box>
  );
};

const InvoiceTemplateSection = ({ onNotify }) => {
  // Room / hotel invoice templates
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [originalId, setOriginalId] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);

  // Banquet quotation + invoice templates (independent selection)
  const [banquetTemplates, setBanquetTemplates] = useState([]);
  const [banquetSelectedId, setBanquetSelectedId] = useState('');
  const [banquetOriginalId, setBanquetOriginalId] = useState('');
  const [savingBanquet, setSavingBanquet] = useState(false);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, settingsRes, bqTemplatesRes, bqSettingsRes] = await Promise.all([
        api.get('/settings/invoice-templates'),
        api.get('/settings/invoice-template-settings'),
        api.get('/settings/banquet-templates'),
        api.get('/settings/banquet-template-settings'),
      ]);

      const list =
        templatesRes.data?.data ||
        templatesRes.data?.templates ||
        (Array.isArray(templatesRes.data) ? templatesRes.data : []);
      setTemplates(list);
      const current =
        settingsRes.data?.data?.selectedTemplate ||
        settingsRes.data?.data?.template ||
        list[0]?.id ||
        '';
      setSelectedId(current);
      setOriginalId(current);

      const bqList =
        bqTemplatesRes.data?.data ||
        (Array.isArray(bqTemplatesRes.data) ? bqTemplatesRes.data : []);
      setBanquetTemplates(bqList);
      const bqCurrent =
        bqSettingsRes.data?.data?.selectedTemplate ||
        bqList[0]?.id ||
        '';
      setBanquetSelectedId(bqCurrent);
      setBanquetOriginalId(bqCurrent);
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to load invoice templates', 'error');
      setTemplates([]);
      setBanquetTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveRoom = async () => {
    if (!selectedId) { onNotify?.('Pick a template first', 'error'); return; }
    setSavingRoom(true);
    try {
      await api.put('/settings/invoice-template', { templateId: selectedId });
      setOriginalId(selectedId);
      broadcastSettingsChange('invoiceTemplate', { templateId: selectedId });
      onNotify?.('Room invoice template updated', 'success');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleSaveBanquet = async () => {
    if (!banquetSelectedId) { onNotify?.('Pick a banquet template first', 'error'); return; }
    setSavingBanquet(true);
    try {
      await api.put('/settings/banquet-template', { templateId: banquetSelectedId });
      setBanquetOriginalId(banquetSelectedId);
      broadcastSettingsChange('banquetTemplate', { templateId: banquetSelectedId });
      onNotify?.('Banquet quotation & invoice template updated', 'success');
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSavingBanquet(false);
    }
  };

  const openPreview = async (path, body) => {
    const win = window.open('', '_blank');
    if (!win) { onNotify?.('Allow popups to preview the template', 'error'); return; }
    try {
      const { data } = await api.post(path, body, {
        responseType: 'text',
        transformResponse: [(v) => v],
      });
      win.document.open();
      win.document.write(data);
      win.document.close();
    } catch (err) {
      win.close();
      onNotify?.(err.response?.data?.message || 'Preview failed', 'error');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  const roomDirty = selectedId !== originalId;
  const banquetDirty = banquetSelectedId !== banquetOriginalId;

  return (
    <Stack spacing={2}>
      {/* Room / hotel invoice template */}
      <Card elevation={0} sx={glassCardSx}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h6">Room invoice template</Typography>
              <Typography variant="body2" color="text.secondary">
                Template used when generating room / hotel booking invoices.
              </Typography>
            </Box>
            <Button startIcon={<RefreshIcon />} onClick={load}>Reload</Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {templates.length === 0 ? (
            <Alert severity="info">No invoice templates are registered on the server.</Alert>
          ) : (
            <RadioGroup value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <Stack spacing={1.5}>
                {templates.map((template) => (
                  <TemplateRow
                    key={template.id || template._id}
                    template={template}
                    selectedId={selectedId}
                    originalId={originalId}
                    actions={(id) => (
                      <>
                        <Button size="small" variant="outlined" startIcon={<RoomIcon fontSize="small" />}
                          onClick={() => openPreview(PREVIEW_PATH, { templateId: id, type: 'hotel' })} sx={pressSx}>
                          Room
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<EventIcon fontSize="small" />}
                          onClick={() => openPreview(PREVIEW_PATH, { templateId: id, type: 'banquet' })} sx={pressSx}>
                          Banquet
                        </Button>
                      </>
                    )}
                  />
                ))}
              </Stack>
            </RadioGroup>
          )}
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button
              variant="contained"
              startIcon={savingRoom ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSaveRoom}
              disabled={savingRoom || !roomDirty}
            >
              {savingRoom ? 'Saving…' : 'Save room template'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Banquet quotation + invoice template */}
      <Card elevation={0} sx={glassCardSx}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <BanquetIcon fontSize="small" color="primary" />
                <Typography variant="h6">Banquet quotation &amp; invoice template</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                One design applies to both the banquet hall quotation and the invoice. Preview each mode below.
              </Typography>
            </Box>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {banquetTemplates.length === 0 ? (
            <Alert severity="info">No banquet templates are registered on the server.</Alert>
          ) : (
            <RadioGroup value={banquetSelectedId} onChange={(e) => setBanquetSelectedId(e.target.value)}>
              <Stack spacing={1.5}>
                {banquetTemplates.map((template) => (
                  <TemplateRow
                    key={template.id || template._id}
                    template={template}
                    selectedId={banquetSelectedId}
                    originalId={banquetOriginalId}
                    actions={(id) => (
                      <>
                        <Button size="small" variant="outlined" startIcon={<QuoteIcon fontSize="small" />}
                          onClick={() => openPreview(BANQUET_PREVIEW_PATH, { templateId: id, docType: 'quotation' })} sx={pressSx}>
                          Quotation
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<InvoiceIcon fontSize="small" />}
                          onClick={() => openPreview(BANQUET_PREVIEW_PATH, { templateId: id, docType: 'invoice' })} sx={pressSx}>
                          Invoice
                        </Button>
                      </>
                    )}
                  />
                ))}
              </Stack>
            </RadioGroup>
          )}
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button
              variant="contained"
              startIcon={savingBanquet ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSaveBanquet}
              disabled={savingBanquet || !banquetDirty}
            >
              {savingBanquet ? 'Saving…' : 'Save banquet template'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default InvoiceTemplateSection;
