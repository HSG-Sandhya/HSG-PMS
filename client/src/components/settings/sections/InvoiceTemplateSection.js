import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  CircularProgress,
  Radio,
  Button,
  Alert,
  Chip,
  Divider,
  Collapse,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  RequestQuoteOutlined as QuoteIcon,
  ReceiptLongOutlined as InvoiceIcon,
  CelebrationOutlined as BanquetIcon,
  TuneOutlined as TuneIcon,
  AutoAwesomeOutlined as AnimatedIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandIcon,
  OpenInNewOutlined as OpenIcon,
} from '@mui/icons-material';
import api from '../../../api';
import InvoiceTemplateTheme from './InvoiceTemplateTheme';
import { broadcastSettingsChange } from '../settingsEvents';

const PREVIEW_PATH = '/settings/invoice/preview';
const THUMBNAILS_PATH = '/settings/invoice/thumbnails';
const BANQUET_PREVIEW_PATH = '/settings/banquet/preview';

// The invoice's natural render width, and enough height to show a whole
// single-sheet bill. The card scales this down, so these are the numbers the
// thumbnail's scale factor is derived from rather than anything CSS picks.
const THUMB_W = 860;
const THUMB_H = 1180;

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

// A card's width is whatever the responsive grid gives it, and the thumbnail
// has to scale to exactly that. Measuring is the only way to know it, so the
// scale factor follows the card through every breakpoint and window resize.
const useMeasuredWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect?.width || 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};

// One design in the gallery: a real rendered thumbnail above its name.
//
// The thumbnail is the invoice itself in a sandboxed iframe, not a screenshot,
// so it always shows the current house styling and can never fall out of date.
// `sandbox=""` blocks scripts inside it, which keeps seventeen of these cheap
// and stops the fit-to-page script from re-laying-out each one.
const TemplateCard = ({ template, html, failed, selected, onSelect, onPreview }) => {
  const [boxRef, width] = useMeasuredWidth();
  const scale = width ? width / THUMB_W : 0;
  const frameHeight = scale ? Math.round(THUMB_H * scale) : 300;

  return (
    <Box
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      sx={{
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'background.paper',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:hover': {
          borderColor: selected ? 'primary.main' : 'text.disabled',
          transform: 'translateY(-2px)',
          boxShadow: '0 10px 26px -14px rgba(0,0,0,0.45)',
        },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': { '&:hover': { transform: 'none' } },
      }}
    >
      {/* Thumbnail */}
      <Box
        ref={boxRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: frameHeight,
          bgcolor: '#ffffff',
          overflow: 'hidden',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {failed && (
          <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', px: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              This design could not be rendered. Use Preview to see the error.
            </Typography>
          </Stack>
        )}
        {!failed && !html && <Skeleton variant="rectangular" width="100%" height="100%" />}
        {!failed && html && scale > 0 && (
          <iframe
            title={`${template.name} preview`}
            srcDoc={html}
            sandbox=""
            scrolling="no"
            tabIndex={-1}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: THUMB_W,
              height: THUMB_H,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          />
        )}
        {selected && (
          <CheckIcon
            color="primary"
            sx={{
              position: 'absolute', top: 8, right: 8, fontSize: 26,
              bgcolor: 'background.paper', borderRadius: '50%',
            }}
          />
        )}
      </Box>

      {/* Identity */}
      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
          <Radio checked={selected} size="small" sx={{ p: 0.5 }} tabIndex={-1} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
            {template.name || template.id}
          </Typography>
          {template.customizable && (
            <Tooltip title="Moves on screen, and follows the house styling below" arrow>
              <Chip
                icon={<AnimatedIcon sx={{ fontSize: 13 }} />}
                label="Animated"
                size="small"
                variant="outlined"
                color="primary"
              />
            </Tooltip>
          )}
        </Stack>
        {template.description && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32,
            }}
          >
            {template.description}
          </Typography>
        )}
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {template.customizable ? 'Follows house styling' : 'Fixed design'}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenIcon fontSize="small" />}
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            sx={pressSx}
          >
            Full size
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

// One row per banquet template with a radio, name/description and preview buttons.
const BanquetRow = ({ template, selectedId, originalId, actions }) => {
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
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flex: 1 }}>
          <Radio checked={id === selectedId} size="small" sx={{ p: 0.5 }} />
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {template.name || id}
              </Typography>
              {id === originalId && <Chip label="Active" color="success" size="small" />}
            </Stack>
            {template.description && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {template.description}
              </Typography>
            )}
          </Box>
        </Stack>
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

  // Rendered thumbnails, keyed by template id. Fetched in ONE request.
  const [thumbs, setThumbs] = useState({});
  const [thumbsLoading, setThumbsLoading] = useState(true);
  const [thumbsError, setThumbsError] = useState('');

  // The house styling panel, collapsed until asked for so the gallery is what
  // loads first and the styling form's own request is not made needlessly.
  const [styleOpen, setStyleOpen] = useState(false);

  // Banquet quotation + invoice templates (independent selection)
  const [banquetTemplates, setBanquetTemplates] = useState([]);
  const [banquetSelectedId, setBanquetSelectedId] = useState('');
  const [banquetOriginalId, setBanquetOriginalId] = useState('');
  const [savingBanquet, setSavingBanquet] = useState(false);

  const [loading, setLoading] = useState(true);

  // Every design rendered server-side in one call. One request rather than one
  // per card keeps the Atlas operation count down, which is what actually
  // throttles this tier.
  const loadThumbnails = useCallback(async () => {
    setThumbsLoading(true);
    setThumbsError('');
    try {
      const { data } = await api.post(THUMBNAILS_PATH, { type: 'hotel' });
      const next = {};
      for (const item of data?.data?.items || []) {
        next[item.id] = { html: item.html || '', failed: Boolean(item.error) };
      }
      setThumbs(next);
    } catch (err) {
      setThumbsError(err.response?.data?.message || 'Could not render the template previews');
    } finally {
      setThumbsLoading(false);
    }
  }, []);

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

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadThumbnails(); }, [loadThumbnails]);

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
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const roomDirty = selectedId !== originalId;
  const banquetDirty = banquetSelectedId !== banquetOriginalId;
  const themedCount = templates.filter((t) => t.customizable).length;

  return (
    <Stack spacing={2}>
      {/* House styling — one panel for every design, not one per template */}
      <Card elevation={0} sx={glassCardSx}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
          >
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TuneIcon fontSize="small" color="primary" />
                <Typography variant="h6">Invoice styling</Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                One place to set the colours, wording, blocks and background motion used by
                every design that follows the house styling. {themedCount} of {templates.length} designs
                follow it; the rest are fixed layouts.
              </Typography>
            </Box>
            <Button
              variant={styleOpen ? 'contained' : 'outlined'}
              startIcon={<TuneIcon />}
              endIcon={
                <ExpandIcon
                  sx={{
                    transform: styleOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 180ms ease',
                  }}
                />
              }
              onClick={() => setStyleOpen((v) => !v)}
              sx={{ ...pressSx, flexShrink: 0 }}
            >
              {styleOpen ? 'Close styling' : 'Customise styling'}
            </Button>
          </Stack>
          <Collapse in={styleOpen} unmountOnExit>
            <Divider sx={{ my: 2 }} />
            <InvoiceTemplateTheme
              onNotify={onNotify}
              onSaved={loadThumbnails}
              onPreview={(customization) =>
                openPreview(PREVIEW_PATH, { templateId: selectedId, type: 'hotel', customization })}
            />
          </Collapse>
        </CardContent>
      </Card>

      {/* Room / hotel invoice template gallery */}
      <Card elevation={0} sx={glassCardSx}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6">Room invoice design</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Pick the design used when generating room and hotel booking invoices. Each card is
                the real invoice, rendered with your current styling.
              </Typography>
            </Box>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => { load(); loadThumbnails(); }}
            >
              Reload
            </Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />

          {thumbsError && <Alert severity="warning" sx={{ mb: 2 }}>{thumbsError}</Alert>}

          {templates.length === 0 ? (
            <Alert severity="info">No invoice templates are registered on the server.</Alert>
          ) : (
            <Box
              role="radiogroup"
              aria-label="Room invoice design"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 2,
              }}
            >
              {templates.map((template) => {
                const id = template.id || template._id;
                const thumb = thumbs[id];
                return (
                  <TemplateCard
                    key={id}
                    template={{ ...template, id }}
                    html={thumbsLoading ? '' : thumb?.html}
                    failed={Boolean(thumb?.failed)}
                    selected={id === selectedId}
                    onSelect={() => setSelectedId(id)}
                    onPreview={() => openPreview(PREVIEW_PATH, { templateId: id, type: 'hotel' })}
                  />
                );
              })}
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mt: 2 }}>
            {roomDirty && (
              <Typography variant="body2" sx={{ color: 'warning.main' }}>
                Not saved yet
              </Typography>
            )}
            <Button
              variant="contained"
              startIcon={savingRoom ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSaveRoom}
              disabled={savingRoom || !roomDirty}
            >
              {savingRoom ? 'Saving…' : 'Save room design'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Banquet quotation + invoice template */}
      <Card elevation={0} sx={glassCardSx}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <BanquetIcon fontSize="small" color="primary" />
                <Typography variant="h6">Banquet quotation &amp; invoice template</Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                One design applies to both the banquet hall quotation and the invoice. Preview each mode below.
              </Typography>
            </Box>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {banquetTemplates.length === 0 ? (
            <Alert severity="info">No banquet templates are registered on the server.</Alert>
          ) : (
            <Stack spacing={1.5}>
              {banquetTemplates.map((template) => (
                <Box
                  key={template.id || template._id}
                  onClick={() => setBanquetSelectedId(template.id || template._id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <BanquetRow
                    template={template}
                    selectedId={banquetSelectedId}
                    originalId={banquetOriginalId}
                    actions={(id) => (
                      <>
                        <Button size="small" variant="outlined" startIcon={<QuoteIcon fontSize="small" />}
                          onClick={(e) => { e.stopPropagation(); openPreview(BANQUET_PREVIEW_PATH, { templateId: id, docType: 'quotation' }); }} sx={pressSx}>
                          Quotation
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<InvoiceIcon fontSize="small" />}
                          onClick={(e) => { e.stopPropagation(); openPreview(BANQUET_PREVIEW_PATH, { templateId: id, docType: 'invoice' }); }} sx={pressSx}>
                          Invoice
                        </Button>
                      </>
                    )}
                  />
                </Box>
              ))}
            </Stack>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
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
