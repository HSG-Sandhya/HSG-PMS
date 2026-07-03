import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import axios from 'axios';
import {
  Reveal,
  StaggerGroup,
  StaggerItem,
  RevealText,
  RevealImage,
  Parallax,
  Magnetic,
  Tilt,
  FloatingOrb,
  Counter,
  GiantNumber,
  DrawnRule,
  MarqueeStrip,
  EASE,
} from '../lib/motion';
import HeroEnquiry from '../components/HeroEnquiry';
import { roomImage } from '../lib/roomImages';

const HERO_IMAGE = './images/hero-image.jpg';
const HOUSE_IMAGE = './images/house.jpg';
const DINING_IMAGE = './images/dining.jpg';
const HALL_IMAGE = './images/wedding-hall.webp';
const PLACE_IMAGE = './images/munger-fort.jpg';

const Section = ({ index, title, children, className = '', numberPosition = 'right' }) => {
  // Dark-background sections set a light text colour on the wrapper; the title
  // must follow suit or it renders near-black on near-black (invisible).
  const dark = /text-bone|text-white/.test(className);
  return (
    <section className={`section relative overflow-hidden ${className}`}>
      {/* Huge ghosted index — drifts as you scroll past the section */}
      <GiantNumber position={numberPosition} opacity={0.045}>
        {index}
      </GiantNumber>
      <div className="edge relative">
        <StaggerGroup className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 mb-16 md:mb-24">
          <StaggerItem variant="fadeRight" className="md:col-span-3">
            <p className="index-number">— {index}</p>
            <h2 className={`font-serif font-light text-4xl md:text-5xl mt-3 tracking-tight ${dark ? 'text-bone-100' : 'text-ink-900'}`}>
              <RevealText text={title} />
            </h2>
            <DrawnRule width={56} className="mt-5" delay={0.4} />
          </StaggerItem>
        </StaggerGroup>
        {children}
      </div>
    </section>
  );
};

const summariseAmenities = (amenities = []) => {
  const top = amenities.slice(0, 3).join(' · ');
  return top || 'Comfortable bedding · Daily housekeeping';
};

const Home = () => {
  const [roomTypes, setRoomTypes] = useState([]);

  // Hero parallax — title drifts up and fades as you scroll past
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroImageY = useTransform(scrollY, [0, 800], [0, 120]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get('/api/website/room-types');
        if (!cancelled && Array.isArray(data)) setRoomTypes(data);
      } catch (err) {
        console.error('Failed to load room types', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {/* ===================== HERO ===================== */}
      <section className="relative h-screen min-h-[700px] overflow-hidden">
        <motion.div
          style={{ y: heroImageY }}
          className="absolute inset-0 will-change-transform"
        >
          <div
            className="absolute inset-0 bg-cover bg-center ken-burns"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/30 via-ink-900/15 to-ink-900/60" />
        </motion.div>
        {/* Top scrim — guarantees the transparent navbar is legible over
            bright moments of the hero image. */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-900/70 to-transparent pointer-events-none z-10" />

        {/* Floating ambient orbs over the hero */}
        <FloatingOrb size={320} className="left-[-80px] top-[8%] opacity-[0.18]" style={{ background: '#B08D57' }} duration={14} />
        <FloatingOrb size={220} className="right-[-40px] bottom-[18%] opacity-[0.12]" style={{ background: '#FAF7F0' }} duration={18} />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative h-full edge flex flex-col justify-between pt-40 md:pt-48 pb-12 will-change-transform"
        >
          <div className="max-w-4xl">
            <h1 className="font-serif font-light text-bone-100 text-display-lg tracking-tight text-balance">
              <RevealText
                text="A quiet refuge,"
                as="span"
                delay={0.1}
                className="block"
              />
              <RevealText
                text="thoughtfully kept."
                emphasis="thoughtfully"
                as="span"
                delay={0.5}
                className="block"
              />
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.1, ease: EASE }}
              className="mt-8 max-w-md text-bone-100/85 font-light text-lg leading-relaxed"
            >
              Twenty-three rooms, an in-house restaurant and a wedding hall —
              tended by one family in the centre of Munger since 2019.
            </motion.p>
          </div>

          <div className="flex flex-col gap-6">
            <HeroEnquiry />
            <div className="hidden md:flex items-center gap-3 text-bone-100/60 text-xs uppercase tracking-widest self-end">
              <span className="bounce-cue">Scroll</span>
              <span className="block h-px w-12 bg-bone-100/40" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===================== Marquee accent band ===================== */}
      <section className="bg-bone-200 border-y border-ink-100 overflow-hidden py-10 md:py-12">
        <MarqueeStrip
          speed={42}
          items={['Munger', 'Bihar', 'Since 2019', 'A quiet refuge', 'Twenty-three rooms', 'One family', 'Open all day']}
        />
      </section>

      {/* ===================== Stats strip ===================== */}
      <section className="bg-ink-900 text-bone-100 py-16 md:py-20 overflow-hidden relative">
        <FloatingOrb size={260} className="right-[-60px] top-[-40px] opacity-[0.18]" style={{ background: '#B08D57' }} duration={16} />
        <div className="edge">
          <StaggerGroup
            delay={0.12}
            className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-12"
          >
            {[
              { value: 23, suffix: '', label: 'Rooms ready' },
              { value: 7,  suffix: '', label: 'Years tending guests' },
              { value: 365, suffix: '', label: 'Days a year, open' },
              { value: 500, suffix: '+', label: 'Family events hosted' },
            ].map((s) => (
              <StaggerItem variant="fadeUp" key={s.label} className="text-center md:text-left">
                <div className="font-serif font-light text-5xl md:text-6xl text-brass-300 tracking-tight">
                  <Counter to={s.value} suffix={s.suffix} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-widest text-bone-200/60">
                  {s.label}
                </p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ===================== 01 · THE HOUSE ===================== */}
      <Section index="01" title="The house">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16 items-start">
          <Reveal
            variant="fadeUp"
            className="md:col-span-7 md:col-start-1 prose-editorial"
          >
            <p className="font-serif text-2xl md:text-3xl text-ink-800 font-light leading-snug mb-10 text-balance">
              We opened in 2019, in a corner of Bari Bazaar that has known
              travellers for generations. The intent then was simple — a clean
              room, a warm meal, a hall large enough for a family wedding — and
              that intent hasn’t changed.
            </p>
            <p>
              The hotel holds twenty-three rooms in all: seventeen kept cool by
              air-conditioning, six with the unhurried calm of a quiet ceiling
              fan. A lift carries you up, the generator keeps the lights on,
              and the front desk is awake whenever you are.
            </p>
            <p>
              Below us, the restaurant cooks all day. Beside us, the hall fills
              for weddings and gatherings. Around us, the town goes on with its
              business — and we go on with ours, which is keeping things in
              order so that yours can run a little more easily.
            </p>
            <Link to="/about" className="link-underline mt-12 text-ink-900">
              Read our story
            </Link>
          </Reveal>

          <div className="md:col-span-5 md:sticky md:top-32">
            <Parallax amount={40}>
              <figure>
                <RevealImage
                  src={HOUSE_IMAGE}
                  alt="A guest corridor at Hotel Sandhya Grand"
                  aspect="aspect-[4/5]"
                  parallaxAmount={20}
                />
                <figcaption className="mt-4 text-xs uppercase tracking-widest text-ink-400">
                  Plate 01 — At the entrance, Bari Bazaar Road
                </figcaption>
              </figure>
            </Parallax>
          </div>
        </div>
      </Section>

      {/* ===================== 02 · ROOMS ===================== */}
      <Section index="02" title="Rooms & suites" className="bg-bone-200" numberPosition="left">
        <StaggerGroup
          delay={0.12}
          className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12"
        >
          {roomTypes.length === 0 ? (
            <p className="md:col-span-12 text-ink-400 font-light">
              <span className="shimmer inline-block px-6 py-1">Loading our rooms…</span>
            </p>
          ) : roomTypes.slice(0, 3).map((room, i) => (
            <StaggerItem
              as="article"
              variant="fadeUp"
              key={room.type}
              className="md:col-span-4 group"
            >
              <Tilt intensity={6} className="will-change-transform">
                <Link to="/rooms" className="block">
                  <div className="aspect-[3/4] overflow-hidden bg-ink-100 rounded-2xl shadow-[0_18px_40px_-24px_rgba(26,26,26,0.4)]">
                    {roomImage(room.type) && (
                      <motion.img
                        src={roomImage(room.type)}
                        alt={`${room.type} room`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        whileHover={{ scale: 1.06 }}
                        transition={{ duration: 1.4, ease: EASE }}
                      />
                    )}
                  </div>
                  <div className="pt-6">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-serif font-light text-2xl text-ink-900">{room.type}</h3>
                      <span className="index-number">0{i + 1}</span>
                    </div>
                    <p className="mt-3 text-ink-500 font-light leading-relaxed text-sm md:text-base">
                      {summariseAmenities(room.amenities)}
                    </p>
                    <p className="mt-4 text-xs uppercase tracking-widest text-ink-400">
                      Sleeps {room.capacity?.adults || 2}
                      {room.capacity?.children ? ` + ${room.capacity.children} child` : ''}
                      {room.price ? ` · ₹${room.price.toLocaleString('en-IN')} / night` : ''}
                    </p>
                  </div>
                </Link>
              </Tilt>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <Reveal variant="fadeUp" className="mt-16 md:mt-20 flex justify-center">
          <Magnetic strength={14}>
            <Link to="/rooms" className="btn-secondary">
              {(() => {
                // Catalog link → show the full inventory size (every room),
                // not the live-available count (r.count), so this stays stable
                // regardless of how many are occupied right now.
                const total = roomTypes.reduce((s, r) => s + (r.total || 0), 0);
                return total > 0 ? `All ${total} rooms` : 'All rooms';
              })()} <span aria-hidden>→</span>
            </Link>
          </Magnetic>
        </Reveal>
      </Section>

      {/* ===================== 03 · DINING (full-bleed) ===================== */}
      <section className="relative">
        <div className="relative h-[80vh] min-h-[600px] overflow-hidden">
          <Parallax amount={70} className="absolute inset-0">
            <img
              src={DINING_IMAGE}
              alt="The restaurant at Sandhya Grand"
              className="absolute inset-0 w-full h-full object-cover scale-[1.08]"
              loading="lazy"
            />
          </Parallax>
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/30 to-transparent" />
          <div className="relative h-full edge flex items-end pb-16 md:pb-24">
            <div className="max-w-2xl">
              <Reveal variant="fadeUp">
                <p className="index-number text-brass-300 mb-3">— 03</p>
              </Reveal>
              <h2 className="font-serif font-light text-bone-100 text-5xl md:text-7xl tracking-tight text-balance">
                <RevealText text="The Restaurant" />
              </h2>
              <h3 className="mt-5 font-serif font-light text-bone-100/90 text-2xl md:text-3xl leading-snug text-balance">
                <RevealText text="Open from breakfast" as="span" className="block" />
                <RevealText text="until the last guest leaves." as="span" delay={0.3} className="block" />
              </h3>
              <Reveal variant="fadeUp" delay={0.7}>
                <p className="mt-6 text-bone-100/85 font-light max-w-md leading-relaxed">
                  North Indian and Chinese, prepared simply with what the market
                  brought in that morning. Room service all day.
                </p>
              </Reveal>
              <Reveal variant="fadeUp" delay={0.9}>
                <Magnetic strength={14}>
                  <Link to="/restaurant" className="inline-flex items-center gap-3 mt-8 text-bone-100 link-underline">
                    See the menu <span aria-hidden>→</span>
                  </Link>
                </Magnetic>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== 04 · WEDDING HALL ===================== */}
      <Section index="04" title="Wedding hall" numberPosition="left">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16 items-center">
          <div className="md:col-span-7 order-2 md:order-1">
            <Parallax amount={40}>
              <RevealImage
                src={HALL_IMAGE}
                alt="The wedding hall"
                aspect="aspect-[4/3]"
                parallaxAmount={22}
              />
            </Parallax>
          </div>

          <Reveal
            variant="fadeLeft"
            className="md:col-span-5 order-1 md:order-2"
          >
            <p className="font-serif text-2xl md:text-3xl text-ink-800 font-light leading-snug mb-8 text-balance">
              A hall that has held weddings,
              receptions and quiet ceremonies — with room enough for all of them.
            </p>
            <p className="text-ink-500 font-light leading-relaxed">
              We host with a small in-house team that has seen most things at
              least once. Tell us what the day looks like, and we’ll keep the
              edges of it in order.
            </p>
            <Magnetic strength={12}>
              <Link to="/banquet" className="link-underline mt-10 text-ink-900">
                Plan an event
              </Link>
            </Magnetic>
          </Reveal>
        </div>
      </Section>

      {/* ===================== 05 · THE PLACE ===================== */}
      <Section index="05" title="Where we are" className="bg-ink-900 text-bone-100 overflow-hidden">
        <FloatingOrb size={300} className="left-[-100px] bottom-[-80px] opacity-[0.18]" style={{ background: '#B08D57' }} duration={20} />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16 items-end">
          <Reveal variant="fadeRight" className="md:col-span-6">
            <h3 className="font-serif font-light text-bone-100 text-3xl md:text-5xl leading-tight text-balance">
              <RevealText text="On Bari Bazaar Road," as="span" className="block" />
              <RevealText text="the centre of Munger." emphasis="the" as="span" delay={0.3} className="block" />
            </h3>
            <p className="mt-8 text-bone-200/70 font-light leading-relaxed max-w-md">
              A walk from Punjab National Bank, ten minutes from the railway
              station, an hour and change from the Ganga at Sultanganj.
            </p>
            <div className="mt-10 space-y-2 text-bone-100/90 font-light">
              <p>Bari Bazaar Road, Munger</p>
              <p>Bihar 811201, India</p>
            </div>
            <Magnetic strength={14}>
              <Link to="/contact" className="inline-flex items-center gap-3 mt-10 text-bone-100 link-underline">
                Directions & contact <span aria-hidden>→</span>
              </Link>
            </Magnetic>
          </Reveal>

          <div className="md:col-span-6">
            <Parallax amount={50}>
              <RevealImage
                src={PLACE_IMAGE}
                alt="Munger, Bihar"
                aspect="aspect-[5/4]"
                parallaxAmount={28}
                className="border border-bone-200/15"
              />
            </Parallax>
          </div>
        </div>
      </Section>

      {/* ===================== CLOSING ===================== */}
      <section className="section bg-bone-100 relative overflow-hidden">
        <FloatingOrb size={400} className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]" style={{ background: '#B08D57' }} duration={22} />
        <div className="edge text-center max-w-3xl mx-auto relative">
          <Reveal variant="scaleIn">
            <p className="eyebrow mb-8">— Be in touch</p>
          </Reveal>
          <h2 className="font-serif font-light text-4xl md:text-6xl text-ink-900 tracking-tight text-balance">
            <RevealText text="Stay with us." as="span" />
          </h2>
          <Reveal variant="fadeUp" delay={0.4}>
            <p className="mt-6 text-ink-500 font-light text-lg max-w-xl mx-auto">
              For reservations, room availability or to discuss an event — write,
              call, or simply walk in.
            </p>
          </Reveal>
          <Reveal variant="fadeUp" delay={0.6}>
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Magnetic strength={16}>
                <Link to="/booking" className="btn-primary">
                  Reserve a room <span aria-hidden>→</span>
                </Link>
              </Magnetic>
              <Magnetic strength={16}>
                <Link to="/contact" className="btn-secondary">
                  Write to us
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
};

export default Home;
