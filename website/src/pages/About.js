import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';

const FOUNDER_IMAGE = '/images/Founder.jpg';
const HOUSE_IMAGE = '/images/house.jpg';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

const facts = [
  { number: '23',   label: 'Rooms in total' },
  { number: '17',   label: 'Air-conditioned' },
  { number: '06',   label: 'Quiet ceiling-fan rooms' },
  { number: '24h',  label: 'Front desk & room service' },
  { number: '2019', label: 'Year we opened our doors' },
  { number: '01',   label: 'Family running it all' },
];

const About = () => {
  // Hero parallax — copy drifts up and fades, the image drifts down, as you scroll.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroImageY = useTransform(scrollY, [0, 800], [0, 120]);

  return (
    <main className="bg-bone-100">
      {/* Hero — house image behind, text over (like the home hero) */}
      <section className="relative h-screen min-h-[640px] overflow-hidden">
        {/* Background image — scroll parallax + slow ken-burns drift */}
        <motion.div style={{ y: heroImageY }} className="absolute inset-0 will-change-transform">
          <div
            className="absolute inset-0 bg-cover bg-center ken-burns"
            style={{ backgroundImage: `url(${HOUSE_IMAGE})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/55 via-ink-900/35 to-ink-900/80" />
        </motion.div>

        {/* Top scrim so the transparent navbar stays legible */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-900/70 to-transparent pointer-events-none z-10" />

        {/* Foreground copy — drifts up and fades as you scroll */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative h-full edge flex flex-col justify-end pt-40 pb-20 md:pb-24 will-change-transform"
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end"
          >
            <div className="md:col-span-3">
              <p className="eyebrow-on-dark">— Our story</p>
            </div>
            <div className="md:col-span-9">
              <h1 className="font-serif font-light text-bone-100 text-display-lg leading-[0.95] tracking-tight text-balance">
                We opened in <em className="not-italic text-brass-400">2019</em>, with the idea that a small hotel could simply be a well-kept one.
              </h1>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Narrative — long-form */}
      <section className="section">
        <div className="edge grid grid-cols-1 md:grid-cols-12 gap-12">
          <motion.aside
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="md:col-span-3"
          >
            <p className="index-number">— 01</p>
            <h2 className="font-serif font-light text-3xl text-ink-900 mt-3">The beginning</h2>
          </motion.aside>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="md:col-span-9 prose-editorial"
          >
            <p className="font-serif text-2xl md:text-3xl text-ink-800 font-light leading-snug mb-10 text-balance">
              Hotel Sandhya Grand &amp; Marriage Hall was opened by Mr. Dharmendra
              Mandal in 2019, on Bari Bazaar Road in Munger — a small,
              well-considered hotel for travellers, families and gatherings.
            </p>
            <p>
              Five years on, the principle is unchanged. Twenty-three rooms,
              an in-house restaurant, a hall large enough for a family wedding,
              and a front desk that doesn’t close. The lift works, the
              generator catches when the power doesn’t, and the staff have, for
              the most part, been here from the beginning.
            </p>
            <p>
              We are a family business in the proper sense — Dharmendra-ji is
              usually somewhere on the property, the same way his guests are
              usually familiar faces. There’s a particular calm that comes from
              that arrangement, and we try to keep it.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Facts grid */}
      <section className="section-tight bg-bone-200 border-y border-ink-100">
        <div className="edge">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="mb-16"
          >
            <p className="index-number">— 02</p>
            <h2 className="font-serif font-light text-3xl text-ink-900 mt-3">The numbers, plainly</h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-12 gap-y-12 md:gap-y-16">
            {facts.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="border-t border-ink-200 pt-6"
              >
                <p className="font-serif font-light text-5xl md:text-7xl text-ink-900 leading-none tracking-tight">
                  {f.number}
                </p>
                <p className="mt-4 text-xs uppercase tracking-widest text-ink-500">{f.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="section">
        <div className="edge grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16 items-start">
          <motion.figure
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="md:col-span-5"
          >
            <div className="aspect-[4/5] overflow-hidden rounded-2xl shadow-[0_24px_48px_-28px_rgba(26,26,26,0.4)]">
              <img
                src={FOUNDER_IMAGE}
                alt="Mr. Dharmendra Mandal"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <figcaption className="mt-4 text-xs uppercase tracking-widest text-ink-400">
              Plate 02 — Mr. Dharmendra Mandal, founder
            </figcaption>
          </motion.figure>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="md:col-span-7 md:pt-8"
          >
            <p className="index-number">— 03</p>
            <h2 className="font-serif font-light text-3xl md:text-4xl text-ink-900 mt-3 mb-10">A word from the founder</h2>
            <blockquote className="font-serif text-2xl md:text-3xl text-ink-800 font-light leading-snug text-balance">
              “The hotel was meant to be simple. Clean rooms, warm meals, a hall
              big enough for everyone at the wedding. After five years that is
              still the work — we just try to do it a little better each year.”
            </blockquote>
            <p className="mt-8 text-sm uppercase tracking-widest text-ink-500">
              — Dharmendra Mandal, Founder &amp; Proprietor
            </p>
          </motion.div>
        </div>
      </section>

      {/* House values */}
      <section className="section bg-ink-900 text-bone-100">
        <div className="edge">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="mb-16 md:mb-20 max-w-3xl"
          >
            <p className="eyebrow-on-dark mb-6">— 04 · The house, in four words</p>
            <h2 className="font-serif font-light text-bone-100 text-4xl md:text-6xl leading-tight tracking-tight text-balance">
              How we keep things.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-16">
            {[
              {
                word: 'Considered',
                body: 'Nothing flashy, nothing added for the sake of it. The room you’re given is the room we’d want.'
              },
              {
                word: 'Attended',
                body: 'A front desk that’s always staffed, room service through the day, repairs handled before you ask.'
              },
              {
                word: 'Local',
                body: 'We are of Munger and for it — most of our team has lived around the corner for years.'
              },
              {
                word: 'Quiet',
                body: 'The lobby is calm, the corridors are quiet, the staff don’t hover. You get to choose your day.'
              }
            ].map((v, i) => (
              <motion.div
                key={v.word}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="border-t border-bone-200/15 pt-8"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif font-light text-3xl md:text-4xl text-bone-100">{v.word}.</h3>
                  <span className="index-number text-bone-200/40">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <p className="mt-6 text-bone-200/70 font-light leading-relaxed max-w-md">{v.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="section">
        <div className="edge text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow mb-8">— Visit</p>
            <h2 className="font-serif font-light text-4xl md:text-6xl text-ink-900 tracking-tight text-balance">
              We’d be glad to have you.
            </h2>
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/booking" className="btn-primary">
                Reserve a room <span aria-hidden>→</span>
              </Link>
              <Link to="/contact" className="btn-secondary">
                Get in touch
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default About;
