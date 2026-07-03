import { Box } from '@mui/material';
import { BQ, glassCard, textPrimary, textSecondary } from './banquetDash';

/**
 * Icon tab bar with active state + count badges.
 * `tabs`: [{ value, label, icon, count? }]. Horizontally scrollable on narrow
 * screens so all modules stay reachable.
 */
const BanquetTabs = ({ tabs = [], value, onChange, isDark = false }) => (
  <Box sx={{
    ...glassCard(isDark),
    p: 0.75,
    display: 'flex',
    gap: 0.5,
    overflowX: 'auto',
    '&::-webkit-scrollbar': { height: 5 },
    '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.4)', borderRadius: 3 },
  }}>
    {tabs.map((t) => {
      const active = t.value === value;
      return (
        <Box
          key={t.value}
          component="button"
          type="button"
          onClick={() => onChange?.(t.value)}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75,
            px: 1.75, py: 1, borderRadius: '12px', border: 'none', cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            color: active ? '#fff' : textSecondary(isDark),
            background: active ? `linear-gradient(135deg, ${BQ.primary}, #0f7fc9)` : 'transparent',
            boxShadow: active ? `0 8px 18px -8px ${BQ.primary}` : 'none',
            transition: 'background 0.2s ease, color 0.2s ease, transform 0.15s ease',
            '&:hover': { color: active ? '#fff' : textPrimary(isDark), background: active ? undefined : (isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.05)') },
          }}
        >
          <Box sx={{ display: 'grid', placeItems: 'center', '& svg': { fontSize: 18 } }}>{t.icon}</Box>
          {t.label}
          {t.count != null && t.count > 0 && (
            <Box sx={{
              ml: 0.25, px: 0.7, minWidth: 20, height: 20, borderRadius: '999px',
              display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 800,
              background: active ? 'rgba(255,255,255,0.28)' : (isDark ? 'rgba(148,163,184,0.22)' : 'rgba(21,152,229,0.14)'),
              color: active ? '#fff' : BQ.primary,
            }}>
              {t.count}
            </Box>
          )}
        </Box>
      );
    })}
  </Box>
);

export default BanquetTabs;
