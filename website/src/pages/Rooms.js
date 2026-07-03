import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Reveal, RevealText, Tilt, Magnetic, FloatingOrb, DrawnRule, MarqueeStrip, EASE } from '../lib/motion';
import { roomImage } from '../lib/roomImages';

const BASE_FILTERS = [
  { key: 'all',       label: 'All rooms' },
  { key: 'available', label: 'Available' },
];

const isAvailable = (room) => {
  const s = String(room.status || '').toLowerCase();
  return s === 'available' || room.isAvailable === true;
};

// Room numbers in the DB can be plain ("302") or prefixed ("R-302", "F-101A").
// parseInt on the raw string returns NaN for the prefixed form, which would
// collapse every room to the same sort key and leave them in DB order.
// Extract the first digit run and use that as the numeric key.
const roomNumberValue = (r) => {
  const m = String(r.roomNumber ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
};
const compareRooms = (a, b) => {
  const d = roomNumberValue(a) - roomNumberValue(b);
  if (d !== 0) return d;
  // Tie-break on the full string so e.g. "R-302" and "C-302" stay stable.
  return String(a.roomNumber ?? '').localeCompare(String(b.roomNumber ?? ''));
};

// Parent-variants stagger so cards arrive one after another even when many
// share the viewport at once. Children inherit the trigger from the parent.
const GRID_PARENT = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const CARD_VARIANT = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,
            transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] } },
};

// Available rooms link into the booking flow; non-available rooms (occupied,
// maintenance, cleaning) render the identical card but non-interactive, so a
// guest can still see the room exists without being able to book it.
const RoomCardShell = ({ available, roomId, children }) =>
  available ? (
    <Link to={`/booking?roomId=${roomId}`} className="block">
      {children}
    </Link>
  ) : (
    <div className="block cursor-not-allowed" aria-disabled="true">
      {children}
    </div>
  );

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Hero parallax — copy drifts up and fades, the image drifts down, as you scroll.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroImageY = useTransform(scrollY, [0, 800], [0, 120]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/website/rooms');
        const list = Array.isArray(data) ? [...data] : [];
        list.sort(compareRooms);
        setRooms(list);
      } catch (err) {
        console.error('Error fetching rooms:', err);
        toast.error('Failed to load rooms');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build the filter bar from the real categories that exist in the DB,
  // not a hardcoded list, so the website always mirrors the back-office.
  const typeFilters = Array.from(
    new Set(rooms.map((r) => (r.type || '').trim()).filter(Boolean)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({ key: type, label: type }));

  const FILTERS = [...BASE_FILTERS, ...typeFilters];

  const filtered = useMemo(() => {
    const list = rooms.filter((room) => {
      if (filter === 'all') return true;
      if (filter === 'available') return isAvailable(room);
      return room.type === filter;
    });
    // Defensive re-sort — keeps order stable even if upstream order shifts.
    return [...list].sort(compareRooms);
  }, [rooms, filter]);

  return (
    <main className="bg-bone-100">
      {/* Page header — room image behind, text over (like the home hero) */}
      <section className="relative h-screen min-h-[640px] overflow-hidden">
        {/* Background image — scroll parallax + slow ken-burns drift */}
        <motion.div style={{ y: heroImageY }} className="absolute inset-0 will-change-transform">
          <div
            className="absolute inset-0 bg-cover bg-center ken-burns"
            style={{ backgroundImage: 'url(/images/room-hero.jpg)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/45 via-ink-900/25 to-ink-900/75" />
        </motion.div>

        {/* Top scrim so the transparent navbar stays legible */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-900/70 to-transparent pointer-events-none z-10" />

        <FloatingOrb size={300} className="right-[-60px] top-[16%] opacity-[0.12]" style={{ background: '#B08D57' }} duration={18} />

        {/* Foreground copy — drifts up and fades as you scroll */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative h-full edge flex flex-col justify-end pt-40 pb-20 md:pb-24 will-change-transform"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-8">
              <Reveal variant="fadeUp"><p className="eyebrow-on-dark mb-8">— The rooms</p></Reveal>
              <h1 className="display-lg text-balance text-bone-100">
                <RevealText
                  text={rooms.length > 0 ? `${rooms.length} rooms,` : 'Our rooms,'}
                  as="span"
                  className="block"
                />
                <RevealText
                  text="each kept simply."
                  emphasis="simply."
                  as="span"
                  delay={0.4}
                  className="block"
                />
              </h1>
              <DrawnRule width={72} className="mt-8" delay={1.0} />
            </div>
            <Reveal variant="fadeLeft" delay={0.6} className="md:col-span-4 md:pb-2">
              <p className="lede text-bone-100/85">
                Seventeen with air-conditioning, six with quiet ceiling fans.
                Every room linens fresh, the lift working, the night desk
                attended.
              </p>
            </Reveal>
          </div>
        </motion.div>
      </section>

      {/* Marquee band */}
      <section className="bg-bone-200 border-y border-ink-100 overflow-hidden py-8 md:py-10">
        <MarqueeStrip
          speed={48}
          items={['Twenty-three rooms', 'Linens fresh', 'Lift to every floor', 'Power backup', 'Hot water always', '24-hour front desk']}
        />
      </section>

      {/* Filter bar */}
      <section className="border-y border-ink-100 bg-bone-100 sticky top-20 md:top-24 z-30 backdrop-blur-md bg-bone-100/85">
        <div className="edge">
          <div className="flex items-center gap-2 md:gap-6 overflow-x-auto py-5 -mx-1 px-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`relative whitespace-nowrap text-xs uppercase tracking-widest font-medium px-3 py-2 transition-colors duration-300 ${
                    active ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700'
                  }`}
                >
                  {f.label}
                  {active && (
                    <motion.span
                      layoutId="rooms-filter-underline"
                      className="absolute -bottom-0.5 left-3 right-3 h-px bg-ink-900"
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="section">
        <div className="edge">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="w-12 h-12 border border-ink-200 border-t-ink-900 rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={filter}
                variants={GRID_PARENT}
                initial="hidden"
                whileInView="show"
                /* `amount: 'some'` (any pixel visible) — a numeric ratio like 0.1
                   can never be met on mobile, where the single-column grid is
                   far taller than the viewport, leaving every card at opacity 0. */
                viewport={{ once: true, amount: 'some' }}
                exit={{ opacity: 0, transition: { duration: 0.3 } }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14 md:gap-y-16"
              >
                {filtered.map((room, i) => {
                  const available = isAvailable(room);
                  return (
                    <motion.article
                      key={room._id}
                      variants={CARD_VARIANT}
                      whileHover={{ y: -6 }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="group"
                    >
                      <Tilt intensity={3}>
                      <RoomCardShell available={available} roomId={room._id}>
                        <div className="relative aspect-[3/4] overflow-hidden bg-ink-100 rounded-2xl shadow-[0_18px_40px_-24px_rgba(26,26,26,0.45)]">
                          {roomImage(room.type) && (
                            <motion.img
                              src={roomImage(room.type)}
                              alt={`${room.type} room ${room.roomNumber}`}
                              loading="lazy"
                              className={`w-full h-full object-cover ${!available ? 'opacity-60 grayscale-[35%]' : ''}`}
                              whileHover={available ? { scale: 1.08 } : undefined}
                              transition={{ duration: 1.6, ease: EASE }}
                            />
                          )}
                          {/* Hover tint that fades up from the bottom */}
                          <motion.div
                            aria-hidden
                            className="absolute inset-0 pointer-events-none"
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            transition={{ duration: 0.5, ease: EASE }}
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)',
                            }}
                          />
                          {/* Animated room-number badge */}
                          <motion.div
                            className="absolute top-3 left-3"
                            initial={{ opacity: 0, y: -8, scale: 0.92 }}
                            whileInView={{ opacity: 1, y: 0, scale: 1 }}
                            viewport={{ once: true, amount: 0.6 }}
                            transition={{ duration: 0.6, delay: 0.15 + (i % 6) * 0.04, ease: EASE }}
                          >
                            <span className="text-[9px] uppercase tracking-widest text-bone-100 bg-ink-900/75 backdrop-blur-sm px-2.5 py-1">
                              No. {room.roomNumber}
                            </span>
                          </motion.div>
                          {/* Status badge — animates in from the right */}
                          {!available && (
                            <motion.div
                              className="absolute top-3 right-3"
                              initial={{ opacity: 0, x: 8 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true, amount: 0.6 }}
                              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
                            >
                              <span className="text-[9px] uppercase tracking-widest text-ink-900 bg-bone-100/90 backdrop-blur-sm px-2.5 py-1">
                                {room.status}
                              </span>
                            </motion.div>
                          )}
                          {/* "View" overlay that slides up on hover */}
                          <div className="absolute inset-x-0 bottom-0 p-4 pointer-events-none overflow-hidden">
                            <motion.span
                              initial={{ y: 30, opacity: 0 }}
                              whileHover={{ y: 0, opacity: 1 }}
                              transition={{ duration: 0.5, ease: EASE }}
                              className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-bone-100 opacity-0 group-hover:opacity-100"
                            >
                              View room <span aria-hidden>→</span>
                            </motion.span>
                          </div>
                        </div>

                        <div className="pt-5">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="min-w-0">
                              <p className="index-number truncate">{String(i + 1).padStart(2, '0')} — {room.type}</p>
                              <motion.h3
                                className="font-serif font-light text-xl md:text-2xl text-ink-900 mt-1 truncate"
                                whileHover={{ x: 2 }}
                                transition={{ duration: 0.4, ease: EASE }}
                              >
                                The {room.type} Room
                              </motion.h3>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] uppercase tracking-widest text-ink-400">From</p>
                              <p className="font-serif text-lg md:text-xl text-ink-900 mt-0.5">₹{room.price?.toLocaleString('en-IN')}</p>
                              <p className="text-[10px] text-ink-400">per night</p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-widest text-ink-400">
                            <span>Sleeps {room.capacity || 2}</span>
                            <span aria-hidden>·</span>
                            <span>Floor {room.floor}</span>
                          </div>

                          {available ? (
                            <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ink-900 relative overflow-hidden">
                              <span className="relative">
                                Reserve
                                <span className="absolute left-0 -bottom-0.5 h-px w-full bg-ink-900 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />
                              </span>
                              <motion.span
                                aria-hidden
                                className="inline-block"
                                initial={{ x: 0 }}
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.4, ease: EASE }}
                              >
                                →
                              </motion.span>
                            </div>
                          ) : (
                            <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ink-400">
                              Not available to book
                            </div>
                          )}
                        </div>
                      </RoomCardShell>
                      </Tilt>
                    </motion.article>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {!loading && filtered.length === 0 && (
            <div className="py-32 text-center">
              <p className="font-serif text-2xl text-ink-700 font-light">Nothing matches that selection.</p>
              <button
                onClick={() => setFilter('all')}
                className="link-underline mt-6 text-ink-900"
              >
                Show all rooms
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Closing strip */}
      <section className="section-tight bg-ink-900 text-bone-100 relative overflow-hidden">
        <FloatingOrb size={300} className="left-[-80px] bottom-[-60px] opacity-[0.18]" style={{ background: '#B08D57' }} duration={20} />
        <div className="edge flex flex-col md:flex-row items-start md:items-end justify-between gap-8 relative">
          <Reveal variant="fadeRight" className="max-w-xl">
            <p className="eyebrow-on-dark mb-4">— A note</p>
            <h3 className="font-serif font-light text-3xl md:text-4xl text-bone-100 text-balance">
              <RevealText
                text="Group stays, weddings, longer visits — we keep a few rooms aside for these. Write to us."
                as="span"
              />
            </h3>
          </Reveal>
          <Reveal variant="fadeLeft" delay={0.3}>
            <Magnetic strength={16}>
              <Link to="/contact" className="btn-ghost-light">Write to reception</Link>
            </Magnetic>
          </Reveal>
        </div>
      </section>
    </main>
  );
};

export default Rooms;
