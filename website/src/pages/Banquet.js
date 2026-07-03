import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Reveal, RevealText, Magnetic, DrawnRule, MarqueeStrip } from '../lib/motion';
import OptionSelect from '../components/OptionSelect';

const HALL_HERO = '/images/wedding-hall.webp';
const HALL_FALLBACK = '/images/wedding-hall.webp';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

// The eventType values map 1:1 to the BanquetBooking model's enum so the
// back-office sees an accurate event tag, not just "Other".
const EVENT_TYPES = [
  { value: 'Wedding',     label: 'Wedding',                 blurb: 'A full day — mandap, mehndi, reception, all of it.' },
  { value: 'Reception',   label: 'Reception',               blurb: 'An evening of dinner, photographs and family.' },
  { value: 'Engagement',  label: 'Engagement / Ring Ceremony', blurb: 'A close gathering for the exchange of rings.' },
  { value: 'Anniversary', label: 'Anniversary',             blurb: 'Marking the year — quiet or grand.' },
  { value: 'Birthday',    label: 'Birthday',                blurb: 'Cake, music, a room set for it.' },
  { value: 'Meeting',     label: 'Meeting',                 blurb: 'A boardroom kept private, tea on time.' },
  { value: 'Conference',  label: 'Conference',              blurb: 'Larger groups, projector, breakouts.' },
  { value: 'Party',       label: 'Party',                   blurb: 'Whatever shape the evening takes.' },
];

const SETUP_OPTIONS = ['Banquet', 'Theater', 'Classroom', 'Conference', 'U-Shape', 'Cocktail'];

// Venue-wide facilities shared by both halls — the things worth highlighting.
const FACILITIES = [
  { title: 'Lift to every floor', body: 'A lift carries elders and guests straight up — no stairs to manage on the big day.' },
  { title: '71 KVA power backup', body: 'A 71 KVA DG set keeps the lights, air-conditioning and sound on, whatever the grid does.' },
  { title: 'In-house catering', body: 'Our own kitchen caters the menu — vegetarian and non-veg, tasted with you in advance.' },
  { title: 'Rooms at the venue', body: 'Twenty-three rooms upstairs for the family and guests who travel from out of town.' },
  { title: 'Air-conditioned halls', body: 'Both halls are fully air-conditioned and column-free, set up the way you like.' },
  { title: 'Parking on site', body: 'Parking beside the hall for cars and the baraat, with staff to help direct it.' },
];

const emptyEnquiry = {
  hallId: '',
  guestName: '',
  guestEmail: '',
  guestPhone: '',
  eventType: 'Wedding',
  eventDate: '',
  guestCount: '',
  setupType: 'Banquet',
  notes: '',
};

const Banquet = () => {
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inline enquiry (no specific hall required)
  const [enquiry, setEnquiry] = useState(emptyEnquiry);
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);

  // Drawer enquiry (per-hall)
  const [selectedHall, setSelectedHall] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [drawerForm, setDrawerForm] = useState(emptyEnquiry);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get('/api/website/banquet-halls');
        setHalls(data);
      } catch (err) {
        console.error('Error fetching halls:', err);
        toast.error('Failed to load halls');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectHall = (hall) => {
    setSelectedHall(hall);
    setDrawerForm({ ...emptyEnquiry, hallId: hall._id });
    setShowBookingForm(true);
  };

  const submitToServer = async (payload) => {
    const { data } = await axios.post('/api/website/banquet-bookings', payload);
    return data;
  };

  // Per-hall drawer submit
  const handleDrawerSubmit = async (e) => {
    e.preventDefault();
    if (!drawerForm.guestName || !drawerForm.guestPhone || !drawerForm.eventDate || !drawerForm.guestCount) {
      return toast.error('Please fill in name, phone, date and guest count');
    }
    try {
      const data = await submitToServer({
        hallId: selectedHall._id,
        guestName: drawerForm.guestName,
        guestEmail: drawerForm.guestEmail,
        guestPhone: drawerForm.guestPhone,
        eventType: drawerForm.eventType,
        eventDate: drawerForm.eventDate,
        guestCount: parseInt(drawerForm.guestCount, 10),
        setupType: drawerForm.setupType,
        notes: drawerForm.notes,
      });
      if (data.success) {
        toast.success('Enquiry received — we will be in touch soon.');
        setDrawerForm(emptyEnquiry);
        setShowBookingForm(false);
        setSelectedHall(null);
      }
    } catch (err) {
      console.error('Drawer enquiry failed:', err);
      toast.error(err.response?.data?.message || 'Failed to send enquiry');
    }
  };

  // Inline form submit
  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    if (!enquiry.guestName || !enquiry.guestPhone || !enquiry.eventDate || !enquiry.guestCount) {
      return toast.error('Please fill in name, phone, date and guest count');
    }
    // If the guest didn't pick a hall, default to the first listed one so the
    // back-office still gets a real BanquetBooking record to act on.
    const hallId = enquiry.hallId || halls[0]?._id;
    if (!hallId) return toast.error('No halls are available right now — please call us.');

    setSubmittingEnquiry(true);
    try {
      const data = await submitToServer({
        hallId,
        guestName: enquiry.guestName,
        guestEmail: enquiry.guestEmail,
        guestPhone: enquiry.guestPhone,
        eventType: enquiry.eventType,
        eventDate: enquiry.eventDate,
        guestCount: parseInt(enquiry.guestCount, 10),
        setupType: enquiry.setupType,
        notes: enquiry.hallId
          ? enquiry.notes
          : `${enquiry.notes}${enquiry.notes ? '\n\n' : ''}(Hall preference: no preference — please advise)`,
      });
      if (data.success) {
        toast.success('Enquiry received — we will be in touch within a day.');
        setEnquiry(emptyEnquiry);
      }
    } catch (err) {
      console.error('Inline enquiry failed:', err);
      toast.error(err.response?.data?.message || 'Failed to send enquiry');
    } finally {
      setSubmittingEnquiry(false);
    }
  };

  const onEnquiryChange = (e) => setEnquiry({ ...enquiry, [e.target.name]: e.target.value });
  const onDrawerChange = (e) => setDrawerForm({ ...drawerForm, [e.target.name]: e.target.value });
  const setEnquiryField = (name, value) => setEnquiry((prev) => ({ ...prev, [name]: value }));
  const setDrawerField = (name, value) => setDrawerForm((prev) => ({ ...prev, [name]: value }));

  // Options shaped for OptionSelect ({ value, title, hint? }).
  const eventTypeOptions = React.useMemo(
    () => EVENT_TYPES.map((ev) => ({ value: ev.value, title: ev.label, hint: ev.blurb })),
    [],
  );
  const setupOptions = React.useMemo(
    () => SETUP_OPTIONS.map((s) => ({ value: s, title: s })),
    [],
  );
  const drawerSetupOptions = React.useMemo(() => {
    const source = (selectedHall?.setupOptions && selectedHall.setupOptions.length > 0)
      ? selectedHall.setupOptions
      : SETUP_OPTIONS;
    return source.map((s) => ({ value: s, title: s }));
  }, [selectedHall]);
  const hallOptions = React.useMemo(
    () => [
      { value: '', title: 'No preference', hint: 'Help me choose a hall' },
      ...halls.map((h) => ({
        value: h._id,
        title: h.name,
        hint: `Up to ${h.capacity} guests · ${h.area} sq ft`,
      })),
    ],
    [halls],
  );

  return (
    <main className="bg-bone-100">
      {/* Hero */}
      <section className="relative h-[88vh] min-h-[720px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center ken-burns"
          style={{ backgroundImage: `url(${HALL_HERO})` }}
        />
        {/* Body overlay: keeps the lower copy legible over busy interiors. */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900/30 via-ink-900/15 to-ink-900/75" />
        {/* Top scrim: guarantees the transparent navbar stays readable even
            when the hero image is bright (chandeliers, cream walls, etc.). */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-900/70 to-transparent pointer-events-none" />
        <div className="relative h-full edge flex flex-col justify-end pb-16 md:pb-24 pt-40 md:pt-48">
          <div className="max-w-3xl">
            <Reveal variant="fadeRight"><p className="eyebrow-on-dark mb-6">— Events</p></Reveal>
            <h1 className="font-serif font-light text-bone-100 text-display tracking-tight text-balance">
              <RevealText text="Weddings, gatherings," as="span" className="block" />
              <RevealText text="and quiet rooms for working." as="span" delay={0.4} className="block" />
            </h1>
            <Reveal variant="fadeUp" delay={0.9}>
              <p className="mt-8 max-w-xl text-bone-100/85 font-light text-lg leading-relaxed">
                From a ring ceremony to a Monday meeting — held with the same care
                we keep the hotel. Tell us what you have in mind; we’ll plan the day around it.
              </p>
            </Reveal>
            <Reveal variant="fadeUp" delay={1.1}>
              <Magnetic strength={14}>
                <a
                  href="#plan"
                  className="mt-10 inline-flex items-center gap-3 px-6 py-3 rounded-full press-3d border border-bone-100/60 text-bone-100 text-xs uppercase tracking-widest font-medium hover:bg-bone-100 hover:text-ink-900 transition-colors"
                >
                  Send an enquiry <span aria-hidden>↓</span>
                </a>
              </Magnetic>
            </Reveal>
            <Reveal variant="fadeUp" delay={1.3}>
              <div className="mt-8"><DrawnRule width={64} color="#B08D57" /></div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Marquee band */}
      <section className="bg-bone-200 border-y border-ink-100 overflow-hidden py-8 md:py-10">
        <MarqueeStrip
          speed={50}
          items={['Weddings', 'Receptions', 'Engagements', 'Birthdays', 'Anniversaries', 'Meetings', 'A-V & stage']}
        />
      </section>

      {/* 01 — What we host */}
      <section className="section">
        <div className="edge">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16 md:mb-20">
            <div className="md:col-span-4">
              <p className="index-number">— 01</p>
              <h2 className="font-serif font-light text-3xl text-ink-900 mt-3">What we host</h2>
            </div>
            <div className="md:col-span-8 prose-editorial">
              <p className="font-serif text-2xl md:text-3xl text-ink-800 font-light leading-snug text-balance">
                The hall sits beside the hotel, with parking nearby and rooms upstairs for guests who travel from out of town.
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {EVENT_TYPES.map((ev, i) => (
              <motion.button
                key={ev.value}
                type="button"
                onClick={() => {
                  setEnquiry((prev) => ({ ...prev, eventType: ev.value }));
                  const target = document.getElementById('plan');
                  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: (i % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                className="group text-left p-6 md:p-7 rounded-2xl border border-ink-100 bg-bone-100 hover:bg-bone-200 hover:border-ink-200 hover:shadow-[0_24px_48px_-20px_rgba(26,26,26,0.2)] transition-[background-color,border-color,box-shadow] duration-500"
              >
                <p className="index-number">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-serif font-light text-xl md:text-2xl text-ink-900 mt-2">{ev.label}</h3>
                <p className="mt-3 text-sm text-ink-500 font-light leading-relaxed">{ev.blurb}</p>
                <span className="mt-5 inline-block text-[10px] uppercase tracking-widest text-ink-400 group-hover:text-ink-900 transition-colors">
                  Enquire →
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* 02 — The halls */}
      <section className="section-tight bg-bone-200 border-y border-ink-100">
        <div className="edge">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="mb-16">
            <p className="index-number">— 02</p>
            <h2 className="font-serif font-light text-3xl text-ink-900 mt-3">The halls</h2>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-32">
              <div className="w-12 h-12 border border-ink-200 border-t-ink-900 rounded-full animate-spin" />
            </div>
          ) : halls.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-serif text-2xl text-ink-700 font-light">No halls listed at the moment.</p>
              <p className="mt-4 text-ink-500">Please write to us — we’ll send full details by email.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
              {halls.map((hall, i) => (
                <motion.article
                  key={hall._id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.9, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="group"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-ink-100 rounded-2xl shadow-[0_18px_40px_-24px_rgba(26,26,26,0.4)]">
                    <img
                      src={(hall.images && hall.images[0]) || HALL_FALLBACK}
                      alt={hall.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-[1.4s] ease-editorial group-hover:scale-[1.04]"
                    />
                  </div>

                  <div className="pt-6">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-serif font-light text-2xl md:text-3xl text-ink-900">{hall.name}</h3>
                      <span className="index-number">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    {hall.description && (
                      <p className="mt-3 text-ink-500 font-light leading-relaxed">{hall.description}</p>
                    )}

                    <dl className="mt-6 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-ink-400">Capacity</dt>
                        <dd className="font-serif text-lg text-ink-900 mt-1">{hall.capacity} guests</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-ink-400">Area</dt>
                        <dd className="font-serif text-lg text-ink-900 mt-1">{hall.area} sq ft</dd>
                      </div>
                      {hall.pricePerDay ? (
                        <div className="col-span-2">
                          <dt className="text-[10px] uppercase tracking-widest text-ink-400">Full-day hire</dt>
                          <dd className="font-serif text-lg text-ink-900 mt-1">
                            ₹{hall.pricePerDay.toLocaleString('en-IN')} <span className="text-sm text-ink-500">per day</span>
                            <span className="block text-[11px] tracking-wide text-ink-400 mt-0.5">10:00 AM – 10:00 PM, same day</span>
                          </dd>
                        </div>
                      ) : null}
                      {hall.pricePerHour ? (
                        <div className="col-span-2">
                          <dt className="text-[10px] uppercase tracking-widest text-ink-400">Birthday bookings</dt>
                          <dd className="font-serif text-lg text-ink-900 mt-1">
                            ₹{hall.pricePerHour.toLocaleString('en-IN')} <span className="text-sm text-ink-500">per hour</span>
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {hall.amenities && hall.amenities.length > 0 && (
                      <ul className="mt-6 flex flex-wrap gap-x-3 gap-y-2 text-xs uppercase tracking-widest text-ink-500">
                        {hall.amenities.slice(0, 6).map((a) => (
                          <li key={a} className="border border-ink-200 px-3 py-1 rounded-full">{a}</li>
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() => handleSelectHall(hall)}
                      className="mt-8 link-underline text-ink-900"
                    >
                      Enquire about this hall <span aria-hidden>→</span>
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          )}

          {/* Ground-floor restaurant — extra dining space */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 md:mt-20 rounded-2xl border border-ink-200 bg-bone-100 p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8 md:gap-12"
          >
            <div className="md:flex-1">
              <p className="eyebrow mb-3">— Also at the venue</p>
              <h3 className="font-serif font-light text-2xl md:text-3xl text-ink-900">
                A ground-floor restaurant that seats 100
              </h3>
              <p className="mt-3 text-ink-500 font-light leading-relaxed max-w-2xl">
                Beyond the two halls, our in-house restaurant on the ground floor seats up
                to 100 guests for sit-down dining — handy for a smaller function, an
                overflow, or a meal before and after the main event.
              </p>
            </div>
            <div className="shrink-0 flex md:flex-col gap-8 md:gap-4 md:text-right">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ink-400">Seats</p>
                <p className="font-serif text-2xl text-ink-900 mt-1">100 guests</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ink-400">Where</p>
                <p className="font-serif text-lg text-ink-900 mt-1">Ground floor</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 03 — Venue facilities */}
      <section className="section">
        <div className="edge">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16 md:mb-20">
            <div className="md:col-span-4">
              <p className="index-number">— 03</p>
              <h2 className="font-serif font-light text-3xl text-ink-900 mt-3">Everything the day needs</h2>
            </div>
            <div className="md:col-span-8 prose-editorial">
              <p className="font-serif text-2xl md:text-3xl text-ink-800 font-light leading-snug text-balance">
                Both halls share the hotel’s services — a lift to every floor, power that
                doesn’t drop, our own kitchen, and rooms upstairs for the family.
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-12">
            {FACILITIES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: (i % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="border-t border-ink-200 pt-6"
              >
                <p className="index-number">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-serif font-light text-xl md:text-2xl text-ink-900 mt-2">{f.title}</h3>
                <p className="mt-3 text-sm text-ink-500 font-light leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 — Inline enquiry form */}
      <section id="plan" className="section border-t border-ink-100">
        <div className="edge grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="lg:col-span-5 lg:sticky lg:top-32"
          >
            <p className="index-number">— 04</p>
            <h2 className="font-serif font-light text-3xl md:text-4xl text-ink-900 mt-3">
              Plan your event
            </h2>
            <p className="mt-6 text-ink-500 font-light text-lg leading-relaxed">
              Tell us the date, the count, and the kind of day you’d like. We’ll
              come back with a setup, a menu, and a quiet pair of hands to keep
              the schedule on time.
            </p>

            <div className="mt-10 pt-8 border-t border-ink-200 space-y-3 text-sm font-light">
              <p className="eyebrow mb-3">— Or call us</p>
              <p className="text-ink-900">+91 94314 19196</p>
              <p className="text-ink-500">+91 87898 96312</p>
              <p className="text-ink-500 pt-3">Bari Bazaar Road, Munger · Bihar 811201</p>
            </div>
          </motion.div>

          <motion.form
            onSubmit={handleEnquirySubmit}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 bg-bone-200 border border-ink-100 rounded-3xl p-8 md:p-12 space-y-8"
          >
            <div>
              <label className="label-mini">Event type</label>
              <OptionSelect
                options={eventTypeOptions}
                value={enquiry.eventType}
                onChange={(v) => setEnquiryField('eventType', v)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="label-mini">Event date</label>
                <input
                  type="date"
                  name="eventDate"
                  value={enquiry.eventDate}
                  onChange={onEnquiryChange}
                  className="input-line"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="label-mini">Guest count</label>
                <input
                  type="number"
                  name="guestCount"
                  value={enquiry.guestCount}
                  onChange={onEnquiryChange}
                  className="input-line"
                  placeholder="Approximate"
                  min="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="label-mini">Hall preference</label>
                <OptionSelect
                  options={hallOptions}
                  value={enquiry.hallId}
                  onChange={(v) => setEnquiryField('hallId', v)}
                  placeholder="No preference — help me choose"
                />
              </div>
              <div>
                <label className="label-mini">Setup</label>
                <OptionSelect
                  options={setupOptions}
                  value={enquiry.setupType}
                  onChange={(v) => setEnquiryField('setupType', v)}
                />
              </div>
            </div>

            <div className="pt-8 border-t border-ink-200 space-y-8">
              <div>
                <label className="label-mini">Your name</label>
                <input
                  type="text"
                  name="guestName"
                  value={enquiry.guestName}
                  onChange={onEnquiryChange}
                  className="input-line"
                  placeholder="Full name"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="label-mini">Phone</label>
                  <input
                    type="tel"
                    name="guestPhone"
                    value={enquiry.guestPhone}
                    onChange={onEnquiryChange}
                    className="input-line"
                    placeholder="+91"
                  />
                </div>
                <div>
                  <label className="label-mini">Email</label>
                  <input
                    type="email"
                    name="guestEmail"
                    value={enquiry.guestEmail}
                    onChange={onEnquiryChange}
                    className="input-line"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="label-mini">Anything else we should know?</label>
                <textarea
                  name="notes"
                  rows="4"
                  value={enquiry.notes}
                  onChange={onEnquiryChange}
                  className="input-line resize-none"
                  placeholder="Catering preferences, music, decor, timings…"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingEnquiry}
              className="btn-primary w-full md:w-auto disabled:opacity-50"
            >
              {submittingEnquiry ? 'Sending…' : <>Send enquiry <span aria-hidden>→</span></>}
            </button>
          </motion.form>
        </div>
      </section>

      {/* Drawer enquiry — per-hall */}
      <AnimatePresence>
        {showBookingForm && selectedHall && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-40"
              onClick={() => setShowBookingForm(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-bone-100 z-50 overflow-y-auto rounded-l-3xl shadow-[-24px_0_60px_-20px_rgba(26,26,26,0.35)]"
            >
              <form onSubmit={handleDrawerSubmit} className="p-8 md:p-12 min-h-full flex flex-col">
                <div className="flex items-start justify-between mb-12">
                  <div>
                    <p className="eyebrow">— Enquiry</p>
                    <h3 className="font-serif font-light text-3xl md:text-4xl text-ink-900 mt-2">{selectedHall.name}</h3>
                    <p className="mt-2 text-sm text-ink-500">Up to {selectedHall.capacity} guests · {selectedHall.area} sq ft</p>
                  </div>
                  <button type="button" onClick={() => setShowBookingForm(false)} className="text-xs uppercase tracking-widest text-ink-500 hover:text-ink-900">Close</button>
                </div>

                <div className="space-y-8 flex-1">
                  <div>
                    <label className="label-mini">Event type</label>
                    <OptionSelect
                      options={eventTypeOptions}
                      value={drawerForm.eventType}
                      onChange={(v) => setDrawerField('eventType', v)}
                    />
                  </div>

                  <div>
                    <label className="label-mini">Your name</label>
                    <input type="text" name="guestName" value={drawerForm.guestName} onChange={onDrawerChange} className="input-line" placeholder="Full name" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="label-mini">Email</label>
                      <input type="email" name="guestEmail" value={drawerForm.guestEmail} onChange={onDrawerChange} className="input-line" placeholder="you@example.com" />
                    </div>
                    <div>
                      <label className="label-mini">Phone</label>
                      <input type="tel" name="guestPhone" value={drawerForm.guestPhone} onChange={onDrawerChange} className="input-line" placeholder="+91" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="label-mini">Event date</label>
                      <input type="date" name="eventDate" value={drawerForm.eventDate} onChange={onDrawerChange} className="input-line" min={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div>
                      <label className="label-mini">Guest count</label>
                      <input type="number" name="guestCount" value={drawerForm.guestCount} onChange={onDrawerChange} max={selectedHall.capacity} className="input-line" placeholder={`Up to ${selectedHall.capacity}`} />
                    </div>
                  </div>

                  <div>
                    <label className="label-mini">Setup</label>
                    <OptionSelect
                      options={drawerSetupOptions}
                      value={drawerForm.setupType}
                      onChange={(v) => setDrawerField('setupType', v)}
                    />
                  </div>

                  <div>
                    <label className="label-mini">Anything else we should know?</label>
                    <textarea name="notes" rows="4" value={drawerForm.notes} onChange={onDrawerChange} className="input-line resize-none" placeholder="Catering preferences, music, decor, timings…" />
                  </div>
                </div>

                <div className="mt-12 flex flex-col gap-3">
                  <button type="submit" className="btn-primary w-full">
                    Send enquiry <span aria-hidden>→</span>
                  </button>
                  <button type="button" onClick={() => setShowBookingForm(false)} className="text-xs uppercase tracking-widest text-ink-500 hover:text-ink-900 py-2">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
};

export default Banquet;
