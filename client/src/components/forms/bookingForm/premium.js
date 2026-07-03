// Shared visual language for the premium single-page booking console.
// Palette: deep navy chrome + gold/brand accent (var(--app-primary)) + white
// surfaces + soft grey lines. Section cards are flat, rounded and minimal so the
// long reservation form reads as one calm, enterprise-grade workspace.
import { Box, Stack, Typography, useTheme } from '@mui/material';

export const NAVY = '#0f1f3d';
export const NAVY_2 = '#1b2f57';
export const NAVY_SOFT = 'rgba(15, 31, 61, 0.06)';

export const premiumCardSx = (isDark) => ({
  borderRadius: 3,
  p: { xs: 2, sm: 3 },
  background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
  border: `1px solid ${isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,31,61,0.08)'}`,
  boxShadow: isDark ? 'none' : '0 1px 2px rgba(15,31,61,0.04), 0 12px 32px -24px rgba(15,31,61,0.25)',
});

// A labelled section card with a numbered gold chip + icon, title and hint.
export const PremiumSection = ({ index, icon, title, subtitle, action, children, sx }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ ...premiumCardSx(isDark), ...(sx || {}) }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
        <Box
          sx={{
            position: 'relative',
            width: 40, height: 40, flexShrink: 0,
            borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--app-primary)',
            background: 'linear-gradient(135deg, rgba(var(--app-primary-rgb),0.16), rgba(var(--app-primary-rgb),0.04))',
            border: '1px solid rgba(var(--app-primary-rgb),0.22)',
          }}
        >
          {icon}
          {index != null && (
            <Box sx={{
              position: 'absolute', top: -7, right: -7,
              minWidth: 18, height: 18, px: 0.5,
              borderRadius: '999px',
              fontSize: 10, fontWeight: 800, lineHeight: '18px', textAlign: 'center',
              color: '#fff', background: 'var(--app-primary)',
              boxShadow: '0 2px 6px -1px rgba(var(--app-primary-rgb),0.6)',
            }}>
              {index}
            </Box>
          )}
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  );
};
