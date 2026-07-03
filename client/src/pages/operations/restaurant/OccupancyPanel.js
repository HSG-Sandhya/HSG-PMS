import { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  People as PeopleIcon,
  ReceiptLong as ReceiptIcon,
  Restaurant as DishIcon,
  ShoppingBag as BagIcon,
  AccessTime as TimeIcon,
  PointOfSale as PayIcon,
  CheckCircle as ConfirmIcon,
} from '@mui/icons-material';
import OccupiedClock from './OccupiedClock';
import { computeTableBill } from './billing';
import { useBilling, useCurrency } from '../../../hooks/useBilling';

const RED = '#EF4444';
const RED_DEEP = '#F43F5E';

// Live occupancy panel for a single table card: the animated clock + a running
// dining bill (time-based minimum spend adjusted against the table's orders,
// with a guest count and optional packing charge) and a tap-to-settle action
// that collects payment and frees the table.
const OccupancyPanel = ({ startMs, guests = 2, orderCount = 0, orderTotal = 0, onGuestsChange, onSettle }) => {
  const [now, setNow] = useState(() => Date.now());
  const [packing, setPacking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef(null);
  const billing = useBilling();
  const fmt = useCurrency();

  // Single 1s heartbeat drives both the digital read-out and the live charge.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));

  const rates = useMemo(() => ({
    perPersonHour: billing.tableChargePerPersonHour,
    perPersonHalfHour: billing.tableChargePerPersonHalfHour,
    minGuests: billing.tableMinGuests,
    packingCharge: billing.tablePackingCharge,
  }), [billing]);

  const bill = computeTableBill({ elapsedSeconds: elapsed, guests, orderTotal, packing, rates });

  const basis = bill.halfBlocks > 0 ? `1 hr + ${bill.halfBlocks}×½hr` : 'First hour';
  const canStep = typeof onGuestsChange === 'function';
  const stepGuests = (delta) => {
    if (!canStep) return;
    const next = Math.min(50, Math.max(1, (Number(guests) || 0) + delta));
    if (next !== guests) onGuestsChange(next);
  };

  // First tap arms confirmation; second tap (within 3.5s) collects + frees.
  const handleSettle = () => {
    if (typeof onSettle !== 'function') return;
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3500);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirming(false);
    onSettle(bill.total);
  };

  return (
    <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
      <OccupiedClock startMs={startMs} elapsed={elapsed} />

      {/* running bill */}
      <Box sx={{
        p: 1,
        borderRadius: '14px',
        background: 'linear-gradient(160deg, rgba(239,68,68,0.10), rgba(244,63,94,0.04))',
        border: `1px solid ${RED}2e`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
        display: 'flex', flexDirection: 'column', gap: 0.85,
      }}>
        {/* header + guests stepper */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ReceiptIcon sx={{ fontSize: 15, color: RED }} />
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1px', color: RED, textTransform: 'uppercase' }}>
              Running Bill
            </Typography>
          </Box>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.4,
            px: 0.5, py: 0.2, borderRadius: '999px',
            background: 'rgba(99,102,241,0.12)',
          }}>
            <PeopleIcon sx={{ fontSize: 13, color: '#6366F1' }} />
            <StepBtn icon={<RemoveIcon sx={{ fontSize: 12 }} />} onClick={() => stepGuests(-1)} disabled={!canStep} />
            <Typography sx={{ minWidth: 12, textAlign: 'center', fontSize: '0.78rem', fontWeight: 800, color: 'text.primary' }}>
              {guests}
            </Typography>
            <StepBtn icon={<AddIcon sx={{ fontSize: 12 }} />} onClick={() => stepGuests(1)} disabled={!canStep} />
          </Box>
        </Box>

        {/* breakdown rows */}
        <Row
          icon={<TimeIcon sx={{ fontSize: 14 }} />}
          label="Table charge"
          sub={`${basis} · ${bill.people} pax`}
          value={fmt(bill.timeCharge)}
          dim={bill.orderCovers}
        />
        <Row
          icon={<DishIcon sx={{ fontSize: 14 }} />}
          label="Orders"
          sub={orderCount > 0 ? `${orderCount} active` : 'No orders yet'}
          value={fmt(bill.orderTotal)}
          dim={!bill.orderCovers}
        />

        {/* adjustment hint */}
        <Typography sx={{ fontSize: '0.56rem', color: 'text.secondary', fontStyle: 'italic', lineHeight: 1.3 }}>
          {bill.orderCovers
            ? 'Order exceeds the table minimum — billed at order value.'
            : 'Table minimum applies — orders adjust against it.'}
        </Typography>

        {/* packing toggle */}
        <Box
          role="button"
          tabIndex={0}
          onClick={() => setPacking((p) => !p)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 0.85, py: 0.5, borderRadius: '10px', cursor: 'pointer',
            border: `1px solid ${packing ? `${RED}66` : 'rgba(var(--app-primary-rgb),0.12)'}`,
            background: packing ? `${RED}14` : 'transparent',
            transition: 'all 0.2s ease',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <BagIcon sx={{ fontSize: 14, color: packing ? RED : 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: packing ? RED : 'text.secondary' }}>
              Pack leftovers
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: packing ? RED : 'text.secondary' }}>
              +{fmt(billing.tablePackingCharge)}
            </Typography>
            <Box sx={{
              width: 26, height: 15, borderRadius: '999px', flexShrink: 0,
              background: packing ? RED : 'rgba(0,0,0,0.18)',
              transition: 'background 0.2s ease', position: 'relative',
            }}>
              <Box sx={{
                position: 'absolute', top: 2, left: packing ? 13 : 2,
                width: 11, height: 11, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </Box>
          </Box>
        </Box>

        {/* tap-to-settle payable bar */}
        <Box
          role="button"
          tabIndex={0}
          onClick={handleSettle}
          sx={{
            mt: 0.25, px: 1.1, py: 0.85, borderRadius: '12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
            background: `linear-gradient(135deg, ${RED}, ${RED_DEEP})`,
            boxShadow: confirming ? `0 0 0 2px #fff6, 0 8px 22px ${RED}66` : `0 6px 16px ${RED}40`,
            transition: 'box-shadow 0.2s ease, transform 0.15s ease',
            '&:hover': { transform: 'translateY(-1px)' },
            ...(confirming && {
              '@keyframes settlePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.82 } },
              animation: 'settlePulse 1s ease-in-out infinite',
            }),
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.95)', textTransform: 'uppercase', lineHeight: 1.1 }}>
              {confirming ? 'Tap to confirm' : 'Payable'}
            </Typography>
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }} noWrap>
              {confirming ? 'Collect & free table' : 'Tap to settle & free'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Typography sx={{
              fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: '1.1rem',
              color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              textShadow: '0 1px 4px rgba(0,0,0,0.25)',
            }}>
              {fmt(bill.total)}
            </Typography>
            {confirming
              ? <ConfirmIcon sx={{ fontSize: 20, color: '#fff' }} />
              : <PayIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.92)' }} />}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

// Small round +/- button used in the guest stepper.
const StepBtn = ({ icon, onClick, disabled }) => (
  <Box
    role="button"
    tabIndex={disabled ? -1 : 0}
    onClick={onClick}
    sx={{
      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'default' : 'pointer',
      color: disabled ? 'text.disabled' : '#6366F1',
      background: 'rgba(99,102,241,0.14)',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.15s ease',
      '&:hover': disabled ? {} : { background: 'rgba(99,102,241,0.28)', transform: 'scale(1.08)' },
    }}
  >
    {icon}
  </Box>
);

// One labelled amount row in the bill breakdown.
const Row = ({ icon, label, sub, value, dim }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, opacity: dim ? 0.5 : 1 }}>
    <Box sx={{
      width: 24, height: 24, borderRadius: '8px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${RED}14`, color: RED,
    }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.56rem', color: 'text.secondary' }} noWrap>
        {sub}
      </Typography>
    </Box>
    <Typography sx={{
      fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: '0.8rem',
      color: 'text.primary', fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </Typography>
  </Box>
);

export default OccupancyPanel;
