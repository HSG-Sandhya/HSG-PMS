import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/Close';
import { useTheme } from '@mui/material/styles';
import { dialogPaperSx, dialogBackdropSx } from '../forms/formStyles';

// Palette per severity — drives the icon, its halo and the confirm button.
const TONES = {
  error:   { main: '#ef4444', soft: 'rgba(239,68,68,0.14)',  Icon: DeleteOutlineRoundedIcon },
  warning: { main: '#f59e0b', soft: 'rgba(245,158,11,0.16)', Icon: WarningAmberRoundedIcon },
  info:    { main: 'var(--app-primary)', soft: 'rgba(var(--app-primary-rgb),0.14)', Icon: HelpOutlineRoundedIcon },
};

/**
 * ConfirmDialog — a modern, glass-styled replacement for window.confirm().
 *
 * Controlled: render it with `open`, supply `onClose` (cancel/backdrop) and
 * `onConfirm`. `severity` ('error' | 'warning' | 'info') themes the icon and
 * the confirm button. `loading` disables the buttons while an async action runs.
 */
const ConfirmDialog = ({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'warning',
  loading = false,
  onConfirm,
  onClose,
}) => {
  const tone = TONES[severity] || TONES.warning;
  const ToneIcon = tone.Icon;
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          ...dialogPaperSx(isDark),
          p: 1,
          overflow: 'visible',
          textAlign: 'center',
        },
      }}
      BackdropProps={{ sx: dialogBackdropSx }}
    >
      <IconButton
        onClick={onClose}
        disabled={loading}
        size="small"
        sx={{ position: 'absolute', top: 10, right: 10, color: 'text.secondary' }}
        aria-label="close"
      >
        <CloseRoundedIcon fontSize="small" />
      </IconButton>

      <DialogContent sx={{ pt: 4, pb: 1.5 }}>
        {/* Haloed icon */}
        <Box
          sx={{
            width: 68,
            height: 68,
            mx: 'auto',
            mb: 2,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: tone.main,
            background: tone.soft,
            boxShadow: `0 0 0 8px ${tone.soft}`,
          }}
        >
          <ToneIcon sx={{ fontSize: 34 }} />
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>
          {title}
        </Typography>
        {message && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, lineHeight: 1.5 }}>
            {message}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1.25 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          fullWidth
          variant="outlined"
          sx={{
            borderRadius: 999,
            py: 1,
            fontWeight: 600,
            textTransform: 'none',
            borderColor: 'rgba(148,163,184,0.4)',
            color: 'text.secondary',
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          fullWidth
          variant="contained"
          disableElevation
          sx={{
            borderRadius: 999,
            py: 1,
            fontWeight: 700,
            textTransform: 'none',
            color: '#fff',
            background: `linear-gradient(135deg, ${tone.main}, ${tone.main})`,
            boxShadow: `0 10px 24px -8px ${tone.main}`,
            '&:hover': { background: `linear-gradient(135deg, ${tone.main}, ${tone.main})`, filter: 'brightness(0.95)' },
          }}
        >
          {loading ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
