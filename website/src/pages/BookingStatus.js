import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { Reveal, RevealText, DrawnRule, FloatingOrb } from '../lib/motion';

/**
 * "Check your booking" — the page the tracking link in a booking email opens.
 *
 * Everything it needs is in the query string: the reference to look up and the
 * token that authorises it. There is no login, and there is deliberately no
 * form to type a reference into — a reference alone must never be enough, or we
 * are back to the enumerable lookup this endpoint used to allow.
 *
 * The API returns five fields and nothing else (see getBookingStatus), so a
 * forwarded link cannot expose the guest's ID document, phone or payment ids.
 */

const STATUS_TONE = {
  Confirmed: 'text-emerald-700',
  Pending: 'text-brass-500',
  Cancelled: 'text-rose-700',
  Rejected: 'text-rose-700',
  'Checked-In': 'text-emerald-700',
  'Checked-Out': 'text-ink-500',
};

const STATUS_NOTE = {
  Pending: 'We have your request and are confirming availability. We will be in touch shortly.',
  Confirmed: 'Your room is reserved. We look forward to welcoming you.',
  Cancelled: 'This booking has been cancelled. Call us if that is unexpected.',
  Rejected: 'We were not able to confirm this booking. Please call us and we will help.',
};

const fmt = (d) => {
  try { return format(parseISO(d), 'EEE, d MMM yyyy'); } catch { return '—'; }
};

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-6 py-4 border-b border-ink-100">
    <span className="text-xs uppercase tracking-widest text-ink-500">{label}</span>
    <span className="font-serif font-light text-lg text-ink-900 text-right">{value}</span>
  </div>
);

const BookingStatus = () => {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const token = params.get('token');

  const [booking, setBooking] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | notfound | error

  useEffect(() => {
    if (!ref || !token) { setState('notfound'); return undefined; }
    let alive = true;
    axios
      .get(`/api/website/bookings/${encodeURIComponent(ref)}/status`, { params: { token } })
      .then(({ data }) => { if (alive) { setBooking(data); setState('ok'); } })
      .catch((err) => {
        if (!alive) return;
        // 404 covers "no such booking" and "wrong token" alike — the server
        // does not distinguish them, and neither should this page.
        setState(err.response?.status === 404 ? 'notfound' : 'error');
      });
    return () => { alive = false; };
  }, [ref, token]);

  return (
    <main className="bg-bone-100 min-h-screen">
      <section className="pt-40 pb-16 md:pt-48 md:pb-20 relative overflow-hidden">
        <FloatingOrb size={260} className="right-[-60px] top-[15%] opacity-[0.07]" style={{ background: '#B08D57' }} duration={20} />
        <div className="edge">
          <Reveal variant="fadeUp"><p className="eyebrow mb-8">— Your reservation</p></Reveal>
          <h1 className="display-lg text-balance">
            <RevealText text="Booking status" as="span" className="block" />
          </h1>
          <DrawnRule width={72} className="mt-8" delay={0.8} />
        </div>
      </section>

      <section className="pb-32">
        <div className="edge">
          <div className="max-w-xl">
            {state === 'loading' && (
              <p className="lede text-ink-500">Looking up your booking…</p>
            )}

            {state === 'notfound' && (
              <Reveal variant="fadeUp">
                <p className="lede">We could not find that booking.</p>
                <p className="mt-4 text-ink-500 font-light">
                  Please open the link exactly as it appears in your booking email — it
                  carries the code that identifies your reservation. If it still does not
                  work, call the reception on{' '}
                  <a href="tel:+919431419196" className="text-ink-900 underline underline-offset-4">+91 94314 19196</a>{' '}
                  and we will look it up for you.
                </p>
              </Reveal>
            )}

            {state === 'error' && (
              <Reveal variant="fadeUp">
                <p className="lede">Something went wrong at our end.</p>
                <p className="mt-4 text-ink-500 font-light">
                  Please try again in a moment, or call{' '}
                  <a href="tel:+919431419196" className="text-ink-900 underline underline-offset-4">+91 94314 19196</a>.
                </p>
              </Reveal>
            )}

            {state === 'ok' && booking && (
              <Reveal variant="fadeUp">
                <p className={`text-xs uppercase tracking-widest mb-3 ${STATUS_TONE[booking.bookingStatus] || 'text-ink-500'}`}>
                  {booking.bookingStatus || 'Status unavailable'}
                </p>
                <p className="lede mb-10">
                  {STATUS_NOTE[booking.bookingStatus] || 'Here is the current state of your reservation.'}
                </p>

                <div className="border-t border-ink-100">
                  <Row label="Reference" value={booking.bookingReference || '—'} />
                  <Row label="Room" value={booking.roomType || '—'} />
                  <Row label="Check in" value={fmt(booking.checkIn)} />
                  <Row label="Check out" value={fmt(booking.checkOut)} />
                </div>

                <p className="mt-8 text-sm text-ink-500 font-light">
                  Anything to change? Call{' '}
                  <a href="tel:+919431419196" className="text-ink-900 underline underline-offset-4">+91 94314 19196</a>{' '}
                  and quote your reference.
                </p>
              </Reveal>
            )}

            <p className="mt-12">
              <Link to="/" className="text-xs uppercase tracking-widest text-ink-500 hover:text-ink-900">
                ← Back to the hotel
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default BookingStatus;
