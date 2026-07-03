import { Box, Typography, Skeleton } from '@mui/material';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { InsightsOutlined } from '@mui/icons-material';
import { HK, glassCard, textPrimary, textSecondary } from './hkConstants';

const ChartCard = ({ title, subtitle, isDark, children }) => (
  <Box sx={{ ...glassCard(isDark), p: 2.25, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: textPrimary(isDark) }}>{title}</Typography>
    {subtitle && <Typography sx={{ fontSize: 12, color: textSecondary(isDark), mb: 1 }}>{subtitle}</Typography>}
    <Box sx={{ flex: 1, minHeight: 170 }}>{children}</Box>
  </Box>
);

/**
 * Analytics strip: a completion gauge, a 7-day completion trend and a staff
 * productivity bar chart, all fed pre-aggregated data from the parent.
 */
const HkCharts = ({
  isDark = false,
  loading = false,
  completionRate = 0,
  turnaroundMin = 0,
  weekly = [],
  staffProductivity = [],
}) => {
  const tooltipStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.1)'}`,
    borderRadius: 10,
    fontSize: 12,
    color: isDark ? '#f1f5f9' : '#1e293b',
  };
  const axisColor = isDark ? 'rgba(226,232,240,0.55)' : 'rgba(51,65,85,0.6)';
  const gridColor = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)';

  const donut = [
    { name: 'Completed', value: Math.max(0, Math.min(100, completionRate)) },
    { name: 'Remaining', value: 100 - Math.max(0, Math.min(100, completionRate)) },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={230} sx={{ borderRadius: '16px' }} />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <InsightsOutlined sx={{ color: 'var(--app-primary)' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark) }}>Housekeeping Analytics</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {/* Completion gauge */}
        <ChartCard title="Cleaning Completion Rate" subtitle="Tasks completed vs scheduled" isDark={isDark}>
          <Box sx={{ position: 'relative', height: '100%', minHeight: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="value"
                  innerRadius="70%"
                  outerRadius="92%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  paddingAngle={donut[0].value > 0 && donut[1].value > 0 ? 2 : 0}
                >
                  <Cell fill={HK.success} />
                  <Cell fill={isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)'} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: 30, fontWeight: 800, color: textPrimary(isDark), lineHeight: 1 }}>
                  {Math.round(completionRate)}%
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: textSecondary(isDark) }}>
                  ~{turnaroundMin || 0}m avg turnaround
                </Typography>
              </Box>
            </Box>
          </Box>
        </ChartCard>

        {/* Weekly trend */}
        <ChartCard title="Daily Performance" subtitle="Tasks completed · last 7 days" isDark={isDark}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weekly} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="hkArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={HK.primary} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={HK.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="day" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <RTooltip contentStyle={tooltipStyle} cursor={{ stroke: HK.primary, strokeOpacity: 0.2 }} />
              <Area type="monotone" dataKey="completed" stroke={HK.primary} strokeWidth={2.5} fill="url(#hkArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Staff productivity */}
        <ChartCard title="Staff Productivity" subtitle="Completed tasks per member" isDark={isDark}>
          {staffProductivity.length === 0 ? (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
              <Typography sx={{ fontSize: 12.5, color: textSecondary(isDark) }}>No completed tasks yet</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffProductivity} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <RTooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(22,143,229,0.08)' }} />
                <Bar dataKey="completed" fill={HK.primary} radius={[6, 6, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </Box>
    </Box>
  );
};

export default HkCharts;
