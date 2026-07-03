import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-toastify';
import { parseISO, format, addDays } from 'date-fns';
import { useLocation } from 'react-router-dom';
import PaymentGateway from '../components/PaymentGateway';
import OptionSelect from '../components/OptionSelect';
import { roomImage } from '../lib/roomImages';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Editorial category picker. Replaces the native <select> with a panel
 * showing type name, sleeps/count and price-from for each room category.
 * Closes on outside-click or Escape; value is just the category's
 * sample-room id so the rest of the booking flow stays unchanged.
 */
const CategorySelect = ({ categories, value, onChange, error }) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const rootRef = useRef(null);
  const selected = categories.find((c) => c.sampleRoom._id === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const baseTrigger =
    'group w-full text-left flex items-center justify-between gap-4 ' +
    'py-4 pl-0 pr-4 border-b transition-colors duration-300';
  const triggerState = error
    ? 'border-rose-400'
    : open
      ? 'border-ink-900'
      : 'border-ink-300 hover:border-ink-900';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${baseTrigger} ${triggerState}`}
      >
        <span className="flex flex-col min-w-0">
          {selected ? (
            <>
              <span className="font-serif text-xl md:text-2xl text-ink-900 leading-tight truncate">
                The {selected.type} Room
              </span>
              <span className="mt-1 text-[11px] uppercase tracking-widest text-ink-400">
                {selected.sampleRoom.capacity
                  ? `Sleeps ${selected.sampleRoom.capacity}`
                  : 'Comfortable for two'}
                {selected.count > 1 ? ` · ${selected.count} available` : ''}
              </span>
            </>
          ) : (
            <>
              <span className="font-serif text-xl md:text-2xl text-ink-400 leading-tight">
                Choose a category
              </span>
              <span className="mt-1 text-[11px] uppercase tracking-widest text-ink-400">
                {categories.length} categories · from ₹{categories[0]?.price?.toLocaleString('en-IN') || '—'}
              </span>
            </>
          )}
        </span>
        <span className="flex items-center gap-4 shrink-0">
          {selected && (
            <span className="text-right hidden sm:block">
              <span className="block text-[10px] uppercase tracking-widest text-ink-400">From</span>
              <span className="block font-serif text-lg text-ink-900">
                ₹{selected.price?.toLocaleString('en-IN')}
              </span>
            </span>
          )}
          <motion.svg
            width="14" height="14" viewBox="0 0 14 14" aria-hidden
            className="text-brass-500"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <path d="M3 5 L7 9 L11 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute left-0 right-0 mt-3 bg-bone-100 border border-ink-100 rounded-2xl z-30 origin-top overflow-hidden"
            style={{ boxShadow: '0 24px 60px -20px rgba(20, 20, 20, 0.18)' }}
          >
            {categories.map((c, i) => {
              const isSelected = selected?.type === c.type;
              const isHover = hovered === c.type;
              return (
                <motion.li
                  key={c.type}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.04 * i, ease: EASE }}
                  onMouseEnter={() => setHovered(c.type)}
                  onMouseLeave={() => setHovered(null)}
                  className="relative border-b border-ink-100 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => { onChange(c.sampleRoom._id); setOpen(false); }}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full text-left flex items-center justify-between gap-4 pl-6 pr-5 py-4 transition-colors duration-300 ${
                      isSelected ? 'bg-bone-200/70' : 'hover:bg-bone-200/50'
                    }`}
                  >
                    {/* Gold accent bar that slides in on hover/selected */}
                    <motion.span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-[2px] bg-brass-500"
                      initial={false}
                      animate={{ scaleY: isHover || isSelected ? 1 : 0 }}
                      style={{ originY: 0.5 }}
                      transition={{ duration: 0.35, ease: EASE }}
                    />
                    <span className="flex items-baseline gap-3 min-w-0">
                      <span className="index-number shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex flex-col min-w-0">
                        <span className="font-serif text-lg md:text-xl text-ink-900 truncate">
                          The {c.type} Room
                        </span>
                        <span className="mt-1 text-[10px] uppercase tracking-widest text-ink-400">
                          {c.sampleRoom.capacity ? `Sleeps ${c.sampleRoom.capacity}` : 'Sleeps 2'}
                          {c.count > 1 ? ` · ${c.count} available` : ' · 1 available'}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-4 shrink-0">
                      <span className="text-right">
                        <span className="block text-[10px] uppercase tracking-widest text-ink-400">From</span>
                        <span className="block font-serif text-lg text-ink-900">
                          ₹{c.price?.toLocaleString('en-IN')}
                        </span>
                      </span>
                      <span className={`w-5 h-5 flex items-center justify-center transition-colors duration-300 ${
                        isSelected ? 'text-brass-500' : 'text-transparent'
                      }`}>
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                          <path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};


/**
 * Editorial ±/value/+ stepper. Two side-by-side instances drive the
 * adults & children counts on the booking form.
 */
const Stepper = ({ value, onChange, min = 0, max = 10, label, hint }) => {
  const v = Number.isFinite(value) ? value : min;
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-ink-200">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-widest font-medium text-ink-500">{label}</p>
        {hint && <p className="mt-1 text-xs text-ink-400 font-light">{hint}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <motion.button
          type="button"
          onClick={() => onChange(Math.max(min, v - 1))}
          disabled={v <= min}
          whileTap={{ scale: 0.9 }}
          className="w-9 h-9 rounded-full border border-ink-300 text-ink-700 hover:border-ink-900 hover:text-ink-900 disabled:opacity-30 disabled:hover:border-ink-300 disabled:hover:text-ink-700 transition-colors flex items-center justify-center"
          aria-label={`Decrease ${label}`}
        >−</motion.button>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={v}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="w-8 text-center font-serif text-2xl text-ink-900 tabular-nums"
          >
            {v}
          </motion.span>
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={() => onChange(Math.min(max, v + 1))}
          disabled={v >= max}
          whileTap={{ scale: 0.9 }}
          className="w-9 h-9 rounded-full border border-ink-300 text-ink-700 hover:border-ink-900 hover:text-ink-900 disabled:opacity-30 disabled:hover:border-ink-300 disabled:hover:text-ink-700 transition-colors flex items-center justify-center"
          aria-label={`Increase ${label}`}
        >+</motion.button>
      </div>
    </div>
  );
};

const Section = ({ index, title, children }) => (
  <div>
    <div className="flex items-baseline gap-4 mb-8 pb-4 border-b border-ink-100">
      <span className="index-number">— {index}</span>
      <h3 className="font-serif font-light text-2xl text-ink-900">{title}</h3>
    </div>
    <div className="space-y-8">{children}</div>
  </div>
);

const Field = ({ label, error, children }) => (
  <div>
    <label className="label-mini">{label}</label>
    {children}
    {error && <p className="text-xs text-rose-700 mt-2 font-light">{error}</p>}
  </div>
);

const Booking = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [nights, setNights] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('pay_at_hotel');
  const [showPaymentGateway, setShowPaymentGateway] = useState(false);
  const [currentBookingData, setCurrentBookingData] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Hero parallax — copy drifts up and fades, the image drifts down, as you scroll.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroImageY = useTransform(scrollY, [0, 800], [0, 120]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { adults: 1, children: 0, rooms: 1 },
  });
  const checkInDate = watch('checkInDate');
  const checkOutDate = watch('checkOutDate');
  const selectedRoomId = watch('roomId');
  const adults = watch('adults');
  const childrenCount = watch('children');
  const roomCount = Math.max(1, Number(watch('rooms')) || 1);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/website/rooms');
        setRooms(data.filter((r) => r.status && r.status.toLowerCase() === 'available'));
      } catch (err) {
        console.error('Error fetching rooms:', err);
        toast.error('Failed to load available rooms');
      }
      try {
        const { data } = await axios.get('/api/website/payment/config');
        setIsDemoMode(data.keyId === 'rzp_test_demo_key');
      } catch (err) { console.error('Error checking demo mode:', err); }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlRoomId = params.get('roomId');
    const urlType = params.get('type');
    if (rooms.length === 0) return;
    // Resolve a deep-link (?roomId=… or ?type=…) to that category's sample
    // room — the form only stores the category-level sample id.
    let target = null;
    if (urlRoomId) target = rooms.find((r) => r._id === urlRoomId);
    else if (urlType) target = rooms.find((r) => r.type === urlType);
    if (!target) return;
    const sample = rooms
      .filter((r) => r.type === target.type)
      .sort((a, b) => a.price - b.price)[0];
    if (sample) setValue('roomId', sample._id);
  }, [location.search, rooms, setValue]);

  // Prefill dates & guest counts from a home-page enquiry (?checkIn=…&adults=…)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ci = params.get('checkIn');
    const co = params.get('checkOut');
    const ad = params.get('adults');
    const ch = params.get('children');
    const rm = params.get('rooms');
    if (ci) setValue('checkInDate', ci);
    if (co) setValue('checkOutDate', co);
    if (ad) setValue('adults', Math.max(1, Number(ad) || 1));
    if (ch) setValue('children', Math.max(0, Number(ch) || 0));
    if (rm) setValue('rooms', Math.max(1, Number(rm) || 1));
  }, [location.search, setValue]);

  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const diff = Math.ceil(Math.abs(parseISO(checkOutDate) - parseISO(checkInDate)) / 86400000);
      setNights(diff);
    }
  }, [checkInDate, checkOutDate]);

  useEffect(() => {
    if (selectedRoomId) {
      const room = rooms.find((r) => r._id === selectedRoomId);
      if (room) setSelectedRoom(room);
    }
  }, [selectedRoomId, rooms]);

  // Group available rooms by category so the guest picks a category
  // (not a specific room number). Price is the lowest price in the
  // category; the booking is assigned to the first available room of
  // that type behind the scenes.
  const categories = React.useMemo(() => {
    const map = new Map();
    rooms.forEach((r) => {
      const key = r.type || 'Room';
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { type: key, price: r.price, count: 1, sampleRoom: r });
      } else {
        existing.count += 1;
        if (r.price < existing.price) {
          existing.price = r.price;
          existing.sampleRoom = r;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.price - b.price);
  }, [rooms]);

  // Derived totals — keep base / GST / grand total in sync with the room
  // selection and the number of rooms so the summary and payment reconcile.
  const perRoomBase = selectedRoom && nights > 0 ? selectedRoom.price * nights : 0;
  const baseAmount = perRoomBase * roomCount;
  const gstAmount = Math.round(baseAmount * 0.05);
  const grandTotal = baseAmount + gstAmount;

  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const origin = (data.origin || '').trim();
      const bookingData = {
        guest: {
          firstName: (data.guestName || '').split(' ')[0] || '',
          lastName: (data.guestName || '').split(' ').slice(1).join(' ') || '',
          email: data.guestEmail,
          phone: data.guestPhone,
          ...(origin ? { address: origin, district: origin } : {}),
        },
        // Reserve the category only — staff assign the specific room at check-in.
        roomType: (rooms.find((r) => r._id === data.roomId)?.type) || selectedRoom?.type || '',
        checkIn: data.checkInDate,
        checkOut: data.checkOutDate,
        adults: Math.max(1, Number(data.adults) || 1),
        children: Math.max(0, Number(data.children) || 0),
        roomCount,
        baseAmount,
        gstAmount,
        totalAmount: grandTotal,
        specialRequests: data.specialRequests || '',
        paymentMethod,
      };

      if (paymentMethod === 'online') {
        setCurrentBookingData(bookingData);
        setShowPaymentGateway(true);
        setLoading(false);
        return;
      }

      await axios.post('/api/website/bookings', bookingData);
      toast.success('Reservation received. Settle at reception on arrival.');
      resetForm();
    } catch (err) {
      console.error('Error creating booking:', err);
      toast.error(err.response?.data?.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    ['guestName', 'guestPhone', 'guestEmail', 'origin', 'roomId', 'checkInDate', 'checkOutDate', 'specialRequests']
      .forEach((f) => setValue(f, ''));
    setValue('adults', 1);
    setValue('children', 0);
    setSelectedRoom(null);
    setNights(1);
    setPaymentMethod('pay_at_hotel');
  };

  const handlePaymentSuccess = async (paymentInfo) => {
    try {
      setLoading(true);
      await axios.post('/api/website/bookings', {
        ...currentBookingData,
        paymentMethod: 'online',
        paymentStatus: 'Paid',
        razorpayPaymentId: paymentInfo.paymentId,
        razorpayOrderId: paymentInfo.orderId,
        razorpaySignature: paymentInfo.signature,
        paidAmount: paymentInfo.amount,
        paymentGateway: 'razorpay',
        paymentDate: paymentInfo.paymentDate,
      });
      toast.success('Payment received. Reservation confirmed.');
      setShowPaymentGateway(false);
      setCurrentBookingData(null);
      resetForm();
    } catch (err) {
      console.error('Error creating booking after payment:', err);
      toast.error('Payment succeeded but reservation failed. Please contact us.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentFailure = (error) => {
    console.error('Payment failed:', error);
    toast.error(`Payment failed: ${error.description || 'Please try again'}`);
    setShowPaymentGateway(false);
  };

  const handlePaymentCancel = () => {
    setShowPaymentGateway(false);
    setCurrentBookingData(null);
    toast.info('Payment cancelled.');
  };

  const getMinCheckOutDate = () =>
    !checkInDate ? '' : format(addDays(parseISO(checkInDate), 1), 'yyyy-MM-dd');

  return (
    <main className="bg-bone-100">
      {/* Page header — reservation image behind, text over (like the home hero) */}
      <section className="relative h-screen min-h-[640px] overflow-hidden">
        {/* Background image — scroll parallax + slow ken-burns drift */}
        <motion.div style={{ y: heroImageY }} className="absolute inset-0 will-change-transform">
          <div
            className="absolute inset-0 bg-cover bg-center ken-burns"
            style={{ backgroundImage: 'url(/images/reservation.jpg)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/45 via-ink-900/25 to-ink-900/75" />
        </motion.div>

        {/* Top scrim so the transparent navbar stays legible */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-900/70 to-transparent pointer-events-none z-10" />

        {/* Foreground copy — drifts up and fades as you scroll */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative h-full edge flex flex-col justify-end pt-40 pb-20 md:pb-24 will-change-transform"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end"
          >
            <div className="md:col-span-8">
              <p className="eyebrow-on-dark mb-8">— Reservations</p>
              <h1 className="display-lg text-balance text-bone-100">
                A few details,<br /> and the room is<em className="not-italic text-brass-400"> yours.</em>
              </h1>
            </div>
            <div className="md:col-span-4 md:pb-2">
              <p className="lede text-bone-100/85">
                Pay online by card or UPI, or simply settle at the front desk
                when you arrive. We confirm by email shortly after.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section className="section-tight">
        <div className="edge grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-16">
              <Section index="01" title="Your details">
                <Field label="Full name" error={errors.guestName?.message}>
                  <input
                    type="text"
                    {...register('guestName', { required: 'Please enter your name' })}
                    className="input-line"
                    placeholder="As on a government ID"
                  />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field label="Phone" error={errors.guestPhone?.message}>
                    <input
                      type="tel"
                      {...register('guestPhone', {
                        required: 'Phone is required',
                        pattern: { value: /^[0-9]{10}$/, message: '10-digit phone number' },
                      })}
                      className="input-line"
                      placeholder="10-digit number"
                    />
                  </Field>
                  <Field label="Email" error={errors.guestEmail?.message}>
                    <input
                      type="email"
                      {...register('guestEmail', {
                        pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Valid email please' },
                      })}
                      className="input-line"
                      placeholder="you@example.com"
                    />
                  </Field>
                </div>
                <Field label="Coming from" error={errors.origin?.message}>
                  <input
                    type="text"
                    {...register('origin')}
                    className="input-line"
                    placeholder="City, state or country"
                  />
                </Field>
              </Section>

              <Section index="02" title="The room">
                <Field label="Choose a category" error={errors.roomId?.message}>
                  {/* Hidden input keeps react-hook-form validation in place
                      while the custom CategorySelect drives the value. */}
                  <input
                    type="hidden"
                    {...register('roomId', { required: 'Please select a category' })}
                  />
                  <CategorySelect
                    categories={categories}
                    value={selectedRoomId || ''}
                    error={errors.roomId?.message}
                    onChange={(id) => setValue('roomId', id, { shouldValidate: true, shouldDirty: true })}
                  />
                  {selectedRoom && (
                    <p className="text-xs text-ink-500 font-light mt-3">
                      Room number is assigned at the front desk on arrival.
                    </p>
                  )}
                </Field>

                {/* Number of rooms — guests can reserve several of the same
                    category in one booking. */}
                <input type="hidden" {...register('rooms')} />
                <Field label="How many rooms">
                  <div className="max-w-sm">
                    <Stepper
                      label="Rooms"
                      hint="All in the chosen category"
                      value={roomCount}
                      min={1}
                      max={10}
                      onChange={(v) => setValue('rooms', v, { shouldDirty: true })}
                    />
                  </div>
                  {roomCount > 1 && (
                    <p className="text-xs text-ink-500 font-light mt-3">
                      {roomCount} rooms held under one reservation — room numbers assigned at check-in.
                    </p>
                  )}
                </Field>

                {/* Hidden inputs keep adults/children in the form payload;
                    the visible UI is the Stepper pair below. */}
                <input type="hidden" {...register('adults')} />
                <input type="hidden" {...register('children')} />
                <Field label="Who's coming">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                    <Stepper
                      label="Adults"
                      hint="Ages 13 and over"
                      value={Number(adults)}
                      min={1}
                      max={selectedRoom?.capacity ? Math.max(1, selectedRoom.capacity) : 6}
                      onChange={(v) => setValue('adults', v, { shouldDirty: true })}
                    />
                    <Stepper
                      label="Children"
                      hint="Under 12 · stay free with parents"
                      value={Number(childrenCount)}
                      min={0}
                      max={4}
                      onChange={(v) => setValue('children', v, { shouldDirty: true })}
                    />
                  </div>
                  {selectedRoom?.capacity && (Number(adults) + Number(childrenCount)) > selectedRoom.capacity && (
                    <p className="text-xs text-brass-600 font-light mt-3">
                      The {selectedRoom.type} room is set for {selectedRoom.capacity} guests. Let us know at the desk and we'll add a bed.
                    </p>
                  )}
                </Field>
              </Section>

              <Section index="03" title="Dates">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field label="Check-in" error={errors.checkInDate?.message}>
                    <input
                      type="date"
                      {...register('checkInDate', { required: 'Required' })}
                      className="input-line"
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </Field>
                  <Field label="Check-out" error={errors.checkOutDate?.message}>
                    <input
                      type="date"
                      {...register('checkOutDate', { required: 'Required' })}
                      className="input-line"
                      min={getMinCheckOutDate()}
                    />
                  </Field>
                </div>
              </Section>

              <Section index="04" title="Anything else">
                <Field label="Notes for the front desk">
                  <textarea
                    {...register('specialRequests')}
                    rows="4"
                    className="input-line resize-none"
                    placeholder="Early check-in, airport pickup, dietary notes…"
                  />
                </Field>
              </Section>

              <Section index="05" title="How you’d like to pay">
                <Field label="Payment">
                  <OptionSelect
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    placeholder="Pick a payment method"
                    options={[
                      {
                        value: 'pay_at_hotel',
                        title: 'Pay at the front desk',
                        hint: 'Settle on arrival · Cash, card or UPI',
                      },
                      {
                        value: 'online',
                        title: 'Pay online now',
                        hint: 'Card or UPI · Secured by Razorpay',
                      },
                    ]}
                  />
                </Field>
                {paymentMethod === 'online' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-l-2 border-brass-400 pl-5 py-2 text-sm text-ink-600 font-light"
                  >
                    Secured by Razorpay · All major cards and UPI accepted.
                    {isDemoMode && (
                      <span className="block mt-2 text-xs uppercase tracking-widest text-brass-600">Demo mode — no real charges</span>
                    )}
                  </motion.div>
                )}
              </Section>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full md:w-auto disabled:opacity-50"
              >
                {loading
                  ? 'Working…'
                  : paymentMethod === 'online'
                    ? <>Continue to payment <span aria-hidden>→</span></>
                    : <>Confirm reservation <span aria-hidden>→</span></>}
              </button>
            </form>
          </motion.div>

          {/* Summary */}
          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 lg:sticky lg:top-32 space-y-10"
          >
            {/* Selected room preview */}
            {selectedRoom ? (
              <div>
                <p className="eyebrow mb-4">— You’ve chosen</p>
                <div className="aspect-[4/3] overflow-hidden bg-ink-100 rounded-2xl shadow-[0_18px_40px_-24px_rgba(26,26,26,0.4)]">
                  {roomImage(selectedRoom.type) && (
                    <img
                      src={roomImage(selectedRoom.type)}
                      alt={`${selectedRoom.type} room ${selectedRoom.roomNumber}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="pt-5">
                  <h3 className="font-serif font-light text-2xl text-ink-900">The {selectedRoom.type} Room</h3>
                  <p className="mt-2 text-sm text-ink-500 font-light">
                    Sleeps {selectedRoom.capacity} · ₹{selectedRoom.price?.toLocaleString('en-IN')}/night
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-t border-ink-200 pt-6">
                <p className="eyebrow mb-2">— A note</p>
                <p className="font-serif font-light text-xl text-ink-700">Select a room and dates to see the summary.</p>
              </div>
            )}

            {/* Summary */}
            <div className="border-t border-ink-200 pt-6 space-y-4">
              <p className="eyebrow mb-2">— Summary</p>

              {checkInDate && checkOutDate ? (
                <>
                  <Row label="Arriving" value={format(parseISO(checkInDate), 'EEE, d MMM yyyy')} />
                  <Row label="Departing" value={format(parseISO(checkOutDate), 'EEE, d MMM yyyy')} />
                  <Row label="Length of stay" value={`${nights} night${nights > 1 ? 's' : ''}`} />
                </>
              ) : (
                <p className="text-sm text-ink-500 font-light">Dates not chosen yet.</p>
              )}

              {(Number(adults) > 0 || Number(childrenCount) > 0) && (
                <Row
                  label="Guests"
                  value={
                    `${adults} adult${Number(adults) > 1 ? 's' : ''}` +
                    (Number(childrenCount) > 0
                      ? `, ${childrenCount} child${Number(childrenCount) > 1 ? 'ren' : ''}`
                      : '')
                  }
                />
              )}

              <Row label="Rooms" value={`${roomCount} room${roomCount > 1 ? 's' : ''}`} />

              {selectedRoom && (
                <>
                  <Row label="Per room / night" value={`₹${selectedRoom.price?.toLocaleString('en-IN')}`} />
                  {nights > 0 && (
                    <Row
                      label={`Room base (${nights} night${nights > 1 ? 's' : ''}${roomCount > 1 ? ` × ${roomCount} rooms` : ''})`}
                      value={`₹${baseAmount.toLocaleString('en-IN')}`}
                    />
                  )}
                  <Row label="GST (5%)" value={`₹${gstAmount.toLocaleString('en-IN')}`} />
                </>
              )}

              <div className="pt-4 border-t border-ink-100 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-widest text-ink-500">Total</span>
                <span className="font-serif font-light text-3xl text-ink-900">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Contact panel */}
            <div className="bg-ink-900 text-bone-100 p-8 rounded-2xl shadow-[0_24px_48px_-24px_rgba(26,26,26,0.5)]">
              <p className="eyebrow-on-dark mb-4">— Or, simply</p>
              <p className="font-serif font-light text-xl leading-snug mb-6">
                Call the reception. Someone is at the desk now.
              </p>
              <div className="space-y-1 text-sm font-light text-bone-200">
                <p className="text-bone-100">+91 94314 19196</p>
                <p>+91 87898 96312</p>
                <p className="pt-3 border-t border-bone-200/15 mt-3">Bari Bazaar Road, Munger, Bihar 811201</p>
              </div>
            </div>
          </motion.aside>
        </div>
      </section>

      {/* Payment modal */}
      <AnimatePresence>
        {showPaymentGateway && currentBookingData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && handlePaymentCancel()}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="bg-bone-100 max-w-md w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-[0_40px_80px_-24px_rgba(26,26,26,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="eyebrow mb-2">— Complete payment</p>
                    <h2 className="font-serif font-light text-2xl text-ink-900">Final step</h2>
                  </div>
                  <button onClick={handlePaymentCancel} className="text-xs uppercase tracking-widest text-ink-500 hover:text-ink-900">Close</button>
                </div>
                <PaymentGateway
                  amount={grandTotal}
                  currency="INR"
                  bookingData={currentBookingData}
                  onSuccess={handlePaymentSuccess}
                  onFailure={handlePaymentFailure}
                  onCancel={handlePaymentCancel}
                  customerInfo={{
                    name: `${currentBookingData?.guest?.firstName || ''} ${currentBookingData?.guest?.lastName || ''}`.trim(),
                    email: currentBookingData?.guest?.email,
                    phone: currentBookingData?.guest?.phone,
                  }}
                  description={`Hotel Booking — ${selectedRoom?.type} Room`}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between text-sm">
    <span className="text-ink-500 font-light">{label}</span>
    <span className="text-ink-900 font-light">{value}</span>
  </div>
);

export default Booking;
