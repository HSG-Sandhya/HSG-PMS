import { Box, Typography, LinearProgress, Skeleton } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { glassCard, textPrimary, textSecondary } from './hkConstants';

/**
 * Operational KPI card for the Housekeeping dashboard.
 *
 * Left-aligned coloured icon, big animated-feel number, supporting subtext, a
 * mini progress bar and an optional trend chip — the enterprise "stat tile"
 * look used across modern PMS software. Elevates on hover.
 */
const HkKpiCard = ({
  icon,
  label,
  value,
  subtext,
  color,
  progress,            // 0–100, drives the mini bar (optional)
  trend,               // e.g. "+12%" (optional)
  trendUp = true,
  isDark = false,
  loading = false,
  delay = 0,
  onClick,
}) => {
  if (loading) {
    return (
      <Box sx={{ ...glassCard(isDark), p: 2.25, height: '100%' }}>
        <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2, mb: 1.5 }} />
        <Skeleton variant="text" width="55%" height={40} />
        <Skeleton variant="text" width="80%" height={20} />
        <Skeleton variant="rounded" width="100%" height={6} sx={{ mt: 1.5 }} />
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      onClick={onClick}
      sx={{
        ...glassCard(isDark),
        p: 2.25,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
        '&:hover': {
          boxShadow: `0 20px 44px -20px ${color}66, 0 8px 24px -14px rgba(15,23,42,0.3)`,
          borderColor: `${color}55`,
        },
      }}
    >
      {/* Soft colour bloom in the corner */}
      <Box aria-hidden sx={{
        position: 'absolute', top: -34, right: -34, width: 110, height: 110,
        borderRadius: '50%', background: color, opacity: 0.12, filter: 'blur(6px)',
      }} />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', zIndex: 1 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '12px',
          display: 'grid', placeItems: 'center',
          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          color: '#fff',
          boxShadow: `0 8px 18px -8px ${color}`,
        }}>
          {icon}
        </Box>
        {trend != null && (
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.4,
            px: 0.9, py: 0.3, borderRadius: '999px',
            background: trendUp ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
            color: trendUp ? '#059669' : '#dc2626',
            fontSize: 12, fontWeight: 700,
          }}>
            {trendUp ? <TrendingUp sx={{ fontSize: 15 }} /> : <TrendingDown sx={{ fontSize: 15 }} />}
            {trend}
          </Box>
        )}
      </Box>

      <Typography sx={{ mt: 0.5, fontSize: 30, fontWeight: 800, lineHeight: 1, color: textPrimary(isDark), letterSpacing: '-1px', zIndex: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: textPrimary(isDark), zIndex: 1 }}>
        {label}
      </Typography>
      {subtext && (
        <Typography sx={{ fontSize: 12, color: textSecondary(isDark), zIndex: 1 }}>
          {subtext}
        </Typography>
      )}

      {typeof progress === 'number' && (
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          sx={{
            mt: 'auto', height: 6, borderRadius: 3, zIndex: 1,
            backgroundColor: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)',
            '& .MuiLinearProgress-bar': { borderRadius: 3, backgroundColor: color },
          }}
        />
      )}
    </Box>
  );
};

export default HkKpiCard;
