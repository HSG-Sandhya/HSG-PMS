import { useMemo } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  BarChart, Bar,
} from 'recharts';
import { InsightsOutlined } from '@mui/icons-material';
import {
  BQ, glassCard, textPrimary, textSecondary, eventColor, hallLabel, money, moneyShort, isActiveBooking,
} from './banquetDash';

const ChartCard = ({ title, subtitle, isDark, children }) => (
  <Box sx={{ ...glassCard(isDark), p: 2.25, display: 'flex', flexDirection: 'column' }}>
    <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: textPrimary(isDark) }}>{title}</Typography>
    {subtitle && <Typography sx={{ fontSize: 12, color: textSecondary(isDark), mb: 1 }}>{subtitle}</Typography>}
    <Box sx={{ flex: 1, minHeight: 190 }}>{children}</Box>
  </Box>
);

// Horizontal share bars (e.g. "Wedding ███████ 60%").
const ShareBars = ({ rows, isDark, valueFmt }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 0.5 }}>
    {rows.length === 0 && <Typography sx={{ fontSize: 12.5, color: textSecondary(isDark) }}>No data yet</Typography>}
    {rows.map((r) => (
      <Box key={r.label}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: textPrimary(isDark) }}>{r.label}</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textSecondary(isDark) }}>
            {valueFmt ? valueFmt(r.value) : `${r.pct}%`}
          </Typography>
        </Box>
        <Box sx={{ height: 8, borderRadius: 4, background: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${r.pct}%`, borderRadius: 4, background: r.color, transition: 'width 0.6s ease' }} />
        </Box>
      </Box>
    ))}
  </Box>
);

/**
 * Event performance analytics — monthly booking trend, revenue by event type,
 * bookings-by-type share and hall occupancy. All aggregated from bookings/halls.
 */
const BanquetCharts = ({ bookings = [], halls = [], isDark = false, loading = false }) => {
  const active = useMemo(() => bookings.filter(isActiveBooking), [bookings]);

  const monthly = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const count = active.filter((b) => {
        if (!b.eventDate) return false;
        const e = new Date(b.eventDate);
        return e.getFullYear() === d.getFullYear() && e.getMonth() === d.getMonth();
      }).length;
      out.push({ month: d.toLocaleDateString(undefined, { month: 'short' }), bookings: count });
    }
    return out;
  }, [active]);

  const revenueByType = useMemo(() => {
    const m = new Map();
    active.forEach((b) => m.set(b.eventType || 'Other', (m.get(b.eventType || 'Other') || 0) + (Number(b.totalAmount) || 0)));
    return Array.from(m.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [active]);

  const typeShare = useMemo(() => {
    const m = new Map();
    active.forEach((b) => m.set(b.eventType || 'Other', (m.get(b.eventType || 'Other') || 0) + 1));
    const total = active.length || 1;
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value, pct: Math.round((value / total) * 100), color: eventColor(label) }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
  }, [active]);

  const hallShare = useMemo(() => {
    const m = new Map();
    active.forEach((b) => { const n = hallLabel(b, halls); m.set(n, (m.get(n) || 0) + 1); });
    const total = active.length || 1;
    return Array.from(m.entries())
      .filter(([label]) => label !== '—')
      .map(([label, value], i) => ({ label, value, pct: Math.round((value / total) * 100), color: [BQ.primary, BQ.gold, BQ.purple, BQ.success, BQ.blue, BQ.warning][i % 6] }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
  }, [active, halls]);

  const tooltipStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.1)'}`,
    borderRadius: 10, fontSize: 12, color: isDark ? '#f1f5f9' : '#1e293b',
  };
  const axisColor = isDark ? 'rgba(226,232,240,0.55)' : 'rgba(51,65,85,0.6)';
  const gridColor = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)';

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={250} sx={{ borderRadius: '18px' }} />)}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <InsightsOutlined sx={{ color: 'var(--app-primary)' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary(isDark) }}>Event Performance</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        <ChartCard title="Monthly Booking Trend" subtitle="Bookings · last 6 months" isDark={isDark}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="bqArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BQ.primary} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={BQ.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <RTooltip contentStyle={tooltipStyle} cursor={{ stroke: BQ.primary, strokeOpacity: 0.2 }} />
              <Area type="monotone" dataKey="bookings" stroke={BQ.primary} strokeWidth={2.5} fill="url(#bqArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by Event Type" subtitle="Total contracted value" isDark={isDark}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByType} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10.5 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => moneyShort(v)} />
              <RTooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(21,152,229,0.08)' }} formatter={(v) => money(v)} />
              <Bar dataKey="revenue" fill={BQ.gold} radius={[6, 6, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Bookings by Event Type" subtitle="Share of all events" isDark={isDark}>
          <ShareBars rows={typeShare} isDark={isDark} />
        </ChartCard>

        <ChartCard title="Hall Occupancy" subtitle="Share of bookings per hall" isDark={isDark}>
          <ShareBars rows={hallShare} isDark={isDark} />
        </ChartCard>
      </Box>
    </Box>
  );
};

export default BanquetCharts;
