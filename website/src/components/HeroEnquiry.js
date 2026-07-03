import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  format, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, isBefore, startOfToday, addDays,
  differenceInCalendarDays,
} from 'date-fns';

const EASE = [0.22, 1, 0.36, 1];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/* ───────────────────────── Animated month calendar ───────────────────────── */
const Calendar = ({ selected, onSelect, minDate }) => {
  const base = selected || minDate || startOfToday();
  const [view, setView] = useState(startOfMonth(base));
  const [dir, setDir] = useState(0);

  const go = (n) => { setDir(n); setView((v) => addMonths(v, n)); };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(view)),
    end: endOfWeek(endOfMonth(view)),
  });

  const slide = {
    enter: (d) => ({ x: d > 0 ? 36 : -36, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d) => ({ x: d > 0 ? -36 : 36, opacity: 0 }),
  };

  return (
    <div className="w-[272px] select-none">
      <div className="flex items-center justify-between mb-3">
        <motion.button
          type="button" onClick={() => go(-1)} whileTap={{ scale: 0.85 }}
          className="w-8 h-8 rounded-full border border-ink-200 text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors flex items-center justify-center"
          aria-label="Previous month"
        >‹</motion.button>
        <div className="relative h-6 overflow-hidden flex-1 text-center">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.span
              key={format(view, 'yyyy-MM')}
              custom={dir} variants={slide} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.26, ease: EASE }}
              className="absolute inset-0 font-serif text-base text-ink-900"
            >
              {format(view, 'MMMM yyyy')}
            </motion.span>
          </AnimatePresence>
        </div>
        <motion.button
          type="button" onClick={() => go(1)} whileTap={{ scale: 0.85 }}
          className="w-8 h-8 rounded-full border border-ink-200 text-ink-700 hover:border-ink-900 hover:text-ink-900 transition-colors flex items-center justify-center"
          aria-label="Next month"
        >›</motion.button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className="h-6 grid place-items-center text-[10px] uppercase tracking-widest text-ink-400">{d}</span>
        ))}
      </div>

      <div className="relative overflow-hidden min-h-[216px]">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={format(view, 'yyyy-MM')}
            custom={dir} variants={slide} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.28, ease: EASE }}
            className="grid grid-cols-7 gap-1"
          >
            {days.map((day) => {
              const disabled = minDate && isBefore(day, minDate);
              const isSel = selected && isSameDay(day, selected);
              const out = !isSameMonth(day, view);
              return (
                <motion.button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(day)}
                  whileHover={!disabled ? { scale: 1.14 } : undefined}
                  whileTap={!disabled ? { scale: 0.88 } : undefined}
                  className={[
                    'h-8 w-8 mx-auto rounded-full text-sm font-light tabular-nums transition-colors flex items-center justify-center',
                    isSel ? 'bg-ink-900 text-bone-100 font-normal shadow-md' : 'text-ink-700 hover:bg-ink-100',
                    out && !isSel ? 'text-ink-300' : '',
                    disabled ? 'opacity-25 cursor-not-allowed hover:bg-transparent' : '',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ───────────────────────── ± guest stepper ───────────────────────── */
const Stepper = ({ label, hint, value, onChange, min = 0, max = 12 }) => (
  <div className="flex items-center justify-between gap-6 py-3">
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-widest font-medium text-ink-600">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-400 font-light">{hint}</p>}
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <motion.button
        type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        whileTap={{ scale: 0.85 }}
        className="w-8 h-8 rounded-full border border-ink-300 text-ink-700 hover:border-ink-900 hover:text-ink-900 disabled:opacity-25 transition-colors flex items-center justify-center"
        aria-label={`Decrease ${label}`}
      >−</motion.button>
      <div className="relative w-7 h-7 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inset-0 grid place-items-center font-serif text-xl text-ink-900 tabular-nums"
          >{value}</motion.span>
        </AnimatePresence>
      </div>
      <motion.button
        type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        whileTap={{ scale: 0.85 }}
        className="w-8 h-8 rounded-full border border-ink-300 text-ink-700 hover:border-ink-900 hover:text-ink-900 disabled:opacity-25 transition-colors flex items-center justify-center"
        aria-label={`Increase ${label}`}
      >+</motion.button>
    </div>
  </div>
);

/* ───────────────────────── A trigger cell + its popover ───────────────────────── */
const Cell = ({ label, value, placeholder, active, onToggle, children, className = '' }) => (
  <div className={`relative ${className}`}>
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left px-5 py-4 group"
    >
      <span className="block text-[10px] uppercase tracking-widest text-ink-400 mb-1">{label}</span>
      <span className={`block font-serif text-lg leading-none ${value ? 'text-ink-900' : 'text-ink-400'}`}>
        {value || placeholder}
      </span>
      <span className={`block h-px mt-2 bg-brass-500 transition-all duration-500 ${active ? 'w-full' : 'w-0 group-hover:w-6'}`} />
    </button>
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="absolute left-0 bottom-[calc(100%+10px)] z-[60] origin-bottom-left rounded-2xl bg-bone-100 p-5 shadow-[0_-30px_60px_-20px_rgba(26,26,26,0.45)] border border-ink-100"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/* ───────── Animated status icons (stroke draws itself on mount) ───────── */
const drawCircle = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1, transition: { duration: 0.5, ease: EASE } },
};
const drawMark = (delay) => ({
  initial: { pathLength: 0 },
  animate: { pathLength: 1, transition: { duration: 0.35, delay, ease: EASE } },
});

const CheckIcon = () => (
  <svg viewBox="0 0 52 52" className="w-full h-full text-emerald-500">
    <motion.circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5" variants={drawCircle} />
    <motion.path d="M15 27 l7.5 7.5 L38 18" fill="none" stroke="currentColor" strokeWidth="3.5"
      strokeLinecap="round" strokeLinejoin="round" variants={drawMark(0.45)} />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 52 52" className="w-full h-full text-rose-400">
    <motion.circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5" variants={drawCircle} />
    <motion.path d="M19 19 L33 33" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" variants={drawMark(0.45)} />
    <motion.path d="M33 19 L19 33" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" variants={drawMark(0.6)} />
  </svg>
);

/* ───────────── Floating availability card (shown after “Enquire”) ───────────── */
const ResultCard = ({ available, range, onReserve, onChangeDates }) => (
  <motion.div
    initial={{ opacity: 0, y: 18, scale: 0.94 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 12, scale: 0.96 }}
    transition={{ duration: 0.3, ease: EASE }}
    className="relative w-[min(92vw,380px)] rounded-3xl bg-bone-100 p-8 text-center shadow-[0_40px_90px_-25px_rgba(0,0,0,0.6)] border border-ink-100"
  >
    <motion.div
      initial="initial" animate="animate"
      className="mx-auto mb-5 w-20 h-20"
    >
      {available ? <CheckIcon /> : <CrossIcon />}
    </motion.div>

    <motion.h3
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5, ease: EASE }}
      className="font-serif text-2xl text-ink-900"
    >
      {available ? 'Rooms available' : 'No rooms available'}
    </motion.h3>

    <motion.p
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.62, ease: EASE }}
      className="mt-2 text-sm text-ink-500 font-light"
    >
      {available
        ? <>We have rooms open for <span className="text-ink-700">{range}</span>.</>
        : <>Nothing is open for <span className="text-ink-700">{range}</span>. Try other dates.</>}
    </motion.p>

    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.72, ease: EASE }}
      className="mt-7 flex flex-col gap-2.5"
    >
      {available ? (
        <>
          <motion.button
            type="button" onClick={onReserve}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full px-6 py-3.5 rounded-xl bg-ink-900 text-bone-100 text-sm uppercase tracking-widest font-medium shadow-lg hover:bg-brass-500 hover:text-ink-900 transition-colors"
          >
            Reserve a room <span aria-hidden>→</span>
          </motion.button>
          <button
            type="button" onClick={onChangeDates}
            className="w-full py-2 text-xs uppercase tracking-widest text-ink-500 hover:text-ink-900 transition-colors"
          >
            Change dates
          </button>
        </>
      ) : (
        <motion.button
          type="button" onClick={onChangeDates}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="w-full px-6 py-3.5 rounded-xl bg-ink-900 text-bone-100 text-sm uppercase tracking-widest font-medium shadow-lg hover:bg-brass-500 hover:text-ink-900 transition-colors"
        >
          Change dates <span aria-hidden>→</span>
        </motion.button>
      )}
    </motion.div>
  </motion.div>
);

/* ───────────────────────── The hero enquiry widget ───────────────────────── */
const HeroEnquiry = () => {
  const navigate = useNavigate();
  const today = startOfToday();

  const [open, setOpen] = useState(null); // 'in' | 'out' | 'guests' | 'rooms' | null
  const [checkIn, setCheckIn] = useState(null);
  const [checkOut, setCheckOut] = useState(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomsCount, setRoomsCount] = useState(1);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null); // availability response, or null

  const toggle = (k) => { setResult(null); setOpen((o) => (o === k ? null : k)); };
  const close = () => setOpen(null);

  const pickCheckIn = (d) => {
    setResult(null);
    setCheckIn(d);
    if (checkOut && !isBefore(d, checkOut)) setCheckOut(null);
    setOpen('out');
  };
  const pickCheckOut = (d) => { setResult(null); setCheckOut(d); close(); };

  const nights = checkIn && checkOut ? differenceInCalendarDays(checkOut, checkIn) : 0;
  const guestLabel =
    `${adults} adult${adults !== 1 ? 's' : ''} · ${children} child${children !== 1 ? 'ren' : ''}`;
  const roomsLabel = `${roomsCount} room${roomsCount !== 1 ? 's' : ''}`;

  // Clear the bar back to its defaults (called right after an enquiry).
  const resetEnquiry = () => {
    setCheckIn(null);
    setCheckOut(null);
    setAdults(2);
    setChildren(0);
    setRoomsCount(1);
  };

  // Reserve uses the snapshot taken at enquiry time — the live bar is reset by then.
  const goReserve = (type) => {
    if (!result) return;
    const params = new URLSearchParams();
    params.set('checkIn', result.checkIn);
    params.set('checkOut', result.checkOut);
    params.set('adults', String(result.adults));
    params.set('children', String(result.children));
    params.set('rooms', String(result.rooms));
    if (type) params.set('type', type);
    navigate(`/booking?${params.toString()}`);
  };

  const enquire = async () => {
    if (!checkIn || !checkOut) {
      toast.info('Please choose your check-in and check-out dates.');
      setOpen(!checkIn ? 'in' : 'out');
      return;
    }

    const snapshot = {
      checkIn: format(checkIn, 'yyyy-MM-dd'),
      checkOut: format(checkOut, 'yyyy-MM-dd'),
      adults,
      children,
      rooms: roomsCount,
      range: `${format(checkIn, 'EEE, d MMM')} → ${format(checkOut, 'EEE, d MMM')}`,
    };

    setOpen(null);
    setChecking(true);
    try {
      const { data } = await axios.get('/api/website/availability', {
        params: { checkIn: snapshot.checkIn, checkOut: snapshot.checkOut },
      });
      setResult({ ...snapshot, available: !!data?.available });
      resetEnquiry(); // clear check-in/out, guests, rooms after enquiring
    } catch (err) {
      console.error('Availability check failed:', err);
      toast.error('Could not check availability just now. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 1.3, ease: EASE }}
      className="w-full"
    >
      {/* Click-catcher closes any open popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Floating availability result, shown after Enquire */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] grid place-items-center p-4"
          >
            <div
              onClick={() => setResult(null)}
              className="absolute inset-0 bg-ink-900/45 backdrop-blur-sm cursor-default"
              aria-hidden
            />
            <ResultCard
              available={result.available}
              range={result.range}
              onReserve={() => goReserve(null)}
              onChangeDates={() => { setResult(null); setOpen('in'); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-50 rounded-2xl bg-bone-100/95 backdrop-blur-md shadow-[0_30px_70px_-25px_rgba(0,0,0,0.6)] ring-1 ring-bone-100/40">
        <div className="flex flex-col md:flex-row md:items-stretch divide-y md:divide-y-0 md:divide-x divide-ink-100">
          {/* Check-in */}
          <Cell
            label="Check-in" placeholder="Add date" active={open === 'in'}
            value={checkIn ? format(checkIn, 'EEE, d MMM') : ''}
            onToggle={() => toggle('in')}
            className="md:flex-1"
          >
            <Calendar selected={checkIn} onSelect={pickCheckIn} minDate={today} />
          </Cell>

          {/* Check-out */}
          <Cell
            label="Check-out" placeholder="Add date" active={open === 'out'}
            value={checkOut ? format(checkOut, 'EEE, d MMM') : ''}
            onToggle={() => toggle('out')}
            className="md:flex-1"
          >
            <Calendar
              selected={checkOut}
              onSelect={pickCheckOut}
              minDate={checkIn ? addDays(checkIn, 1) : addDays(today, 1)}
            />
            {nights > 0 && (
              <p className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500 text-center font-light">
                {nights} night{nights !== 1 ? 's' : ''}
              </p>
            )}
          </Cell>

          {/* Guests */}
          <Cell
            label="Guests" placeholder="Add guests" active={open === 'guests'}
            value={guestLabel}
            onToggle={() => toggle('guests')}
            className="md:flex-1"
          >
            <div className="w-[248px]">
              <Stepper label="Adults" hint="Age 9+" value={adults} onChange={setAdults} min={1} />
              <div className="border-t border-ink-100" />
              <Stepper label="Children" hint="Age 0–8" value={children} onChange={setChildren} />
              <button
                type="button" onClick={close}
                className="mt-3 w-full text-center text-xs uppercase tracking-widest text-ink-500 hover:text-ink-900 transition-colors"
              >Done</button>
            </div>
          </Cell>

          {/* Rooms */}
          <Cell
            label="Rooms" placeholder="How many" active={open === 'rooms'}
            value={roomsLabel}
            onToggle={() => toggle('rooms')}
            className="md:flex-1"
          >
            <div className="w-[248px]">
              <Stepper label="Rooms" hint="How many rooms" value={roomsCount} onChange={setRoomsCount} min={1} max={10} />
              <button
                type="button" onClick={close}
                className="mt-3 w-full text-center text-xs uppercase tracking-widest text-ink-500 hover:text-ink-900 transition-colors"
              >Done</button>
            </div>
          </Cell>

          {/* Submit */}
          <div className="p-3 md:flex md:items-center">
            <Magnetic>
              <motion.button
                type="button"
                onClick={enquire}
                disabled={checking}
                whileHover={!checking ? { scale: 1.03 } : undefined}
                whileTap={!checking ? { scale: 0.97 } : undefined}
                className="w-full md:w-auto h-full md:h-auto px-7 py-4 rounded-xl bg-ink-900 text-bone-100 text-sm uppercase tracking-widest font-medium whitespace-nowrap shadow-lg hover:bg-brass-500 hover:text-ink-900 transition-colors disabled:opacity-60 disabled:hover:bg-ink-900 disabled:hover:text-bone-100"
              >
                {checking ? 'Checking…' : <>Enquire <span aria-hidden>→</span></>}
              </motion.button>
            </Magnetic>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* tiny inline magnetic wrapper to avoid an extra import cycle */
const Magnetic = ({ children }) => <div className="inline-block w-full md:w-auto h-full">{children}</div>;

export default HeroEnquiry;
