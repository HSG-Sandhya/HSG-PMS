// Shared, glass-morphism dialog used across the app so every form looks the
// same: translucent rounded paper, an icon + eyebrow + title header, content
// laid out as labelled section-cards, and a consistent rounded action bar.
//
// Usage:
//   <FormDialog
//     open={open} onClose={close} onSubmit={handleSubmit}
//     icon={<EventIcon />} eyebrow="Banquet Hall" title="New booking"
//     submitLabel="Create booking"
//   >
//     <FormSection title="Customer Info" icon={<PeopleIcon />} iconColor="#06b6d4">
//       ...fields...
//     </FormSection>
//   </FormDialog>
//
// Pass `onSubmit` to render the children inside a <form> and wire the primary
// button to submit it. Omit `onSubmit` for read-only / action dialogs and use
// `extraActions` / `submitLabel` (the primary button then just calls onClose).

import {
  Dialog, DialogContent, DialogActions, Box, Stack, Typography, Button, useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  dialogPaperSx,
  dialogBackdropSx,
  headerWrapSx,
  sectionCardSx,
  sectionTitleSx,
  actionsBarSx,
  primaryButtonSx,
  secondaryButtonSx,
} from './formStyles';

// A labelled card that groups related fields. Drop any inputs inside it.
export const FormSection = ({ title, icon, iconColor, children, sx }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ ...sectionCardSx(isDark), ...(sx || {}) }}>
      {title && (
        <Typography sx={sectionTitleSx(isDark)}>
          {icon ? (
            <Box component="span" sx={{ color: iconColor, display: 'inline-flex', alignItems: 'center' }}>
              {icon}
            </Box>
          ) : null}
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
};

const FormDialog = ({
  open,
  onClose,
  title,
  eyebrow = '',
  icon = null,
  onSubmit = null,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitDisabled = false,
  maxWidth = 'md',
  formId = 'form-dialog',
  children,
  extraActions = null,
  hideActions = false,
  hideCancel = false,
  ...dialogProps
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      {...dialogProps}
      slotProps={{
        backdrop: { sx: dialogBackdropSx },
        paper: { sx: dialogPaperSx(isDark) }
      }}>
      {(title || icon || eyebrow) && (
        <Box sx={headerWrapSx(isDark)}>
          <Stack direction="row" spacing={2} sx={{
            alignItems: "center"
          }}>
            {icon && (
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.18), rgba(236,72,153,0.18))',
                color: 'var(--app-primary)',
              }}>
                {icon}
              </Box>
            )}
            <Box>
              {eyebrow ? (
                <Typography sx={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}>
                  {eyebrow}
                </Typography>
              ) : null}
              <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', mt: 0.25 }}>
                {title}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}
      <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
        >
          {onSubmit ? (
            <Box component="form" id={formId} onSubmit={onSubmit}>
              <Stack spacing={2.5}>{children}</Stack>
            </Box>
          ) : (
            <Stack spacing={2.5}>{children}</Stack>
          )}
        </motion.div>
      </DialogContent>
      {!hideActions && (
        <DialogActions sx={actionsBarSx(isDark)}>
          {extraActions}
          {!hideCancel && (
            <Button onClick={onClose} variant="outlined" sx={secondaryButtonSx(isDark)}>
              {cancelLabel}
            </Button>
          )}
          <Button
            type={onSubmit ? 'submit' : 'button'}
            form={onSubmit ? formId : undefined}
            onClick={onSubmit ? undefined : onClose}
            variant="contained"
            sx={primaryButtonSx}
            disabled={submitDisabled}
          >
            {submitLabel}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default FormDialog;
