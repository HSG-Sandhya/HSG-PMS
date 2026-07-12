import React, { useState } from 'react';
import axios from 'axios';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Reveal, RevealText, FloatingOrb, DrawnRule, MarqueeStrip } from '../lib/motion';

const MAP_QUERY = 'Hotel+Sandhya+Grand+Bari+Bazaar+Munger+Bihar';
const MAP_EMBED = `https://www.google.com/maps?q=${MAP_QUERY}&output=embed`;
const MAP_LINK = `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

const Contact = () => {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  // Hero parallax — copy drifts up and fades, the image drifts down, as you scroll.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroImageY = useTransform(scrollY, [0, 800], [0, 120]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await axios.post('/api/website/contact', data);
      toast.success('Thank you for writing. We will reply shortly.');
      reset();
    } catch {
      toast.error('Could not send the message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-bone-100">
      {/* Header — contact image behind, text over (like the home hero) */}
      <section className="relative h-screen min-h-[640px] overflow-hidden">
        {/* Background image — scroll parallax + slow ken-burns drift */}
        <motion.div style={{ y: heroImageY }} className="absolute inset-0 will-change-transform">
          <div
            className="absolute inset-0 bg-cover bg-center ken-burns"
            style={{ backgroundImage: 'url(/images/contact.jpg)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/45 via-ink-900/25 to-ink-900/75" />
        </motion.div>

        {/* Top scrim so the transparent navbar stays legible */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-900/70 to-transparent pointer-events-none z-10" />

        <FloatingOrb size={300} className="right-[-60px] top-[16%] opacity-[0.12]" style={{ background: '#B08D57' }} duration={16} />

        {/* Foreground copy — drifts up and fades as you scroll */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative h-full edge flex flex-col justify-end pt-40 pb-20 md:pb-24 will-change-transform"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-8">
              <Reveal variant="fadeUp"><p className="eyebrow-on-dark mb-8">— Contact</p></Reveal>
              <h1 className="display-lg text-balance text-bone-100">
                <RevealText text="Write, call, or" as="span" className="block" />
                <RevealText text="simply walk in." emphasis="simply" as="span" delay={0.4} className="block" />
              </h1>
              <DrawnRule width={72} className="mt-8" delay={1.0} />
            </div>
            <Reveal variant="fadeLeft" delay={0.5} className="md:col-span-4 md:pb-2">
              <p className="lede text-bone-100/85">
                The reception is staffed around the clock. We answer email
                within a working day.
              </p>
            </Reveal>
          </div>
        </motion.div>
      </section>

      {/* Marquee band */}
      <section className="bg-bone-200 border-y border-ink-100 overflow-hidden py-8 md:py-10">
        <MarqueeStrip
          speed={50}
          items={['Bari Bazaar Road', 'Munger', 'Bihar', '+91 94314 19196', 'reservations@sandhyagrand.in']}
        />
      </section>

      {/* Contact details strip */}
      <section className="border-y border-ink-100 bg-bone-200">
        <div className="edge">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-ink-100">
            {[
              { label: 'Address',     value: 'Bari Bazaar Road', sub: 'Munger, Bihar 811201' },
              { label: 'Reservations',value: '+91 94314 19196',   sub: '+91 87898 96312' },
              { label: 'Email',       value: 'reservations@sandhyagrand.in', sub: '' },
              { label: 'Hours',       value: 'Reception 24h',     sub: 'Restaurant 07:00 – 23:00' },
            ].map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="px-6 md:px-8 py-10"
              >
                <p className="eyebrow mb-4">— {c.label}</p>
                <p className="font-serif text-lg md:text-xl text-ink-900 font-light leading-snug">{c.value}</p>
                {c.sub && <p className="mt-1 text-sm text-ink-500 font-light">{c.sub}</p>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form + Map */}
      <section className="section">
        <div className="edge grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Form */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="lg:col-span-7"
          >
            <p className="index-number">— 01</p>
            <h2 className="font-serif font-light text-3xl md:text-4xl text-ink-900 mt-3 mb-12">Send a message</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="label-mini">First name</label>
                  <input
                    type="text"
                    {...register('firstName', { required: 'Required' })}
                    className="input-line"
                  />
                  {errors.firstName && <p className="text-xs text-rose-700 mt-2">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="label-mini">Last name</label>
                  <input
                    type="text"
                    {...register('lastName', { required: 'Required' })}
                    className="input-line"
                  />
                  {errors.lastName && <p className="text-xs text-rose-700 mt-2">{errors.lastName.message}</p>}
                </div>
              </div>

              <div>
                <label className="label-mini">Email</label>
                <input
                  type="email"
                  {...register('email', {
                    required: 'Required',
                    pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Valid email please' },
                  })}
                  className="input-line"
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-xs text-rose-700 mt-2">{errors.email.message}</p>}
              </div>

              <div>
                <label className="label-mini">Phone (optional)</label>
                <input
                  type="tel"
                  {...register('phone', {
                    pattern: { value: /^[0-9]{10}$/, message: '10-digit number' },
                  })}
                  className="input-line"
                  placeholder="10-digit number"
                />
                {errors.phone && <p className="text-xs text-rose-700 mt-2">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="label-mini">Subject</label>
                <input
                  type="text"
                  {...register('subject', { required: 'Required' })}
                  className="input-line"
                  placeholder="A short line"
                />
                {errors.subject && <p className="text-xs text-rose-700 mt-2">{errors.subject.message}</p>}
              </div>

              <div>
                <label className="label-mini">Message</label>
                <textarea
                  {...register('message', { required: 'Required' })}
                  rows="6"
                  className="input-line resize-none"
                  placeholder="How can we help?"
                />
                {errors.message && <p className="text-xs text-rose-700 mt-2">{errors.message.message}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
                {loading ? 'Sending…' : <>Send message <span aria-hidden>→</span></>}
              </button>
            </form>
          </motion.div>

          {/* Sidebar — map + write */}
          <motion.aside
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="lg:col-span-5 space-y-10 lg:sticky lg:top-32"
          >
            <div>
              <p className="index-number">— 02</p>
              <h2 className="font-serif font-light text-3xl text-ink-900 mt-3 mb-8">Find us</h2>
              <div className="aspect-[4/3] overflow-hidden border border-ink-200 bg-ink-100 rounded-2xl shadow-[0_18px_40px_-24px_rgba(26,26,26,0.35)]">
                <iframe
                  title="Hotel Sandhya Grand on Google Maps"
                  src={MAP_EMBED}
                  className="w-full h-full grayscale"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                href={MAP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline text-ink-900 mt-6 inline-flex"
              >
                Open in Google Maps <span aria-hidden>→</span>
              </a>
            </div>

            <div className="bg-ink-900 text-bone-100 p-8 rounded-2xl shadow-[0_24px_48px_-24px_rgba(26,26,26,0.5)]">
              <p className="eyebrow-on-dark mb-4">— Reception</p>
              <p className="font-serif font-light text-2xl leading-snug">
                Always open. Always answered.
              </p>
              <div className="mt-6 pt-6 border-t border-bone-200/15 text-sm font-light space-y-2">
                <p>+91 94314 19196</p>
                <p>+91 87898 96312</p>
                <p className="text-bone-200/70">reservations@sandhyagrand.in</p>
              </div>
            </div>
          </motion.aside>
        </div>
      </section>
    </main>
  );
};

export default Contact;
