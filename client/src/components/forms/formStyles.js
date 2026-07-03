// Shared visual language for the booking/checkout/guest forms.
// Solid, opaque surfaces (no see-through) that match the app's slate theme,
// with generous spacing and a single accent.

const ACCENT = 'var(--app-primary)';
const ACCENT_SOFT = 'rgba(var(--app-primary-rgb), 0.18)';

export const dialogPaperSx = (isDarkMode) => ({
  borderRadius: 4,
  overflow: 'hidden',
  // Fully opaque so the page behind never shows through the form.
  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
  backgroundImage: 'none',
  border: isDarkMode ? '1px solid rgba(148, 163, 184, 0.22)' : '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: isDarkMode
    ? '0 30px 80px -20px rgba(0, 0, 0, 0.7)'
    : '0 30px 80px -20px rgba(15, 23, 42, 0.28)',
});

export const dialogBackdropSx = {
  backgroundColor: 'rgba(15, 23, 42, 0.45)',
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
};

export const headerWrapSx = (isDarkMode) => ({
  position: 'relative',
  px: { xs: 3, sm: 4 },
  pt: { xs: 3, sm: 4 },
  pb: 2,
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '1px',
    background: isDarkMode
      ? 'linear-gradient(90deg, transparent, rgba(148,163,184,0.25), transparent)'
      : 'linear-gradient(90deg, transparent, rgba(15,23,42,0.12), transparent)',
  },
});

export const sectionCardSx = (isDarkMode) => ({
  p: { xs: 2.5, sm: 3 },
  borderRadius: 3,
  // Opaque inner panel, a touch off from the dialog surface for hierarchy.
  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
  border: isDarkMode ? '1px solid rgba(148, 163, 184, 0.16)' : '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: 'none',
});

export const sectionTitleSx = (isDarkMode) => ({
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: isDarkMode ? 'rgba(226, 232, 240, 0.75)' : 'rgba(71, 85, 105, 0.85)',
  mb: 1.5,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
});

export const labelSx = (isDarkMode) => ({
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: isDarkMode ? 'rgba(148, 163, 184, 0.9)' : 'rgba(100, 116, 139, 0.9)',
});

export const valueSx = (isDarkMode) => ({
  fontSize: 14,
  fontWeight: 500,
  color: isDarkMode ? 'rgba(241, 245, 249, 0.95)' : 'rgba(15, 23, 42, 0.92)',
});

export const actionsBarSx = (isDarkMode) => ({
  px: { xs: 3, sm: 4 },
  py: 2.5,
  gap: 1.5,
  borderTop: isDarkMode ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid rgba(226, 232, 240, 0.9)',
  // Opaque footer that grounds the form.
  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
});

export const primaryButtonSx = {
  borderRadius: 999,
  px: 4,
  py: 1.1,
  fontWeight: 600,
  letterSpacing: '0.02em',
  textTransform: 'none',
  boxShadow: '0 8px 24px -10px rgba(var(--app-primary-rgb), 0.65)',
  background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-primary) 100%)',
  '&:hover': {
    boxShadow: '0 12px 28px -10px rgba(var(--app-primary-rgb), 0.75)',
    background: 'linear-gradient(135deg, var(--app-primary) 0%, var(--app-primary) 100%)',
  },
};

export const secondaryButtonSx = (isDarkMode) => ({
  borderRadius: 999,
  px: 4,
  py: 1.1,
  fontWeight: 600,
  letterSpacing: '0.02em',
  textTransform: 'none',
  color: isDarkMode ? 'rgba(241, 245, 249, 0.9)' : 'rgba(51, 65, 85, 0.95)',
  borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.5)',
  '&:hover': {
    borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.6)' : 'rgba(51, 65, 85, 0.6)',
    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.7)',
  },
});

export const dangerButtonSx = {
  borderRadius: 999,
  px: 4,
  py: 1.1,
  fontWeight: 600,
  textTransform: 'none',
  color: '#dc2626',
  borderColor: 'rgba(220, 38, 38, 0.45)',
  '&:hover': {
    borderColor: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.06)',
  },
};

export const tokens = {
  ACCENT,
  ACCENT_SOFT,
};
