import React from 'react';
import { Link } from 'react-router-dom';
import { Reveal, RevealText, DrawnRule, FloatingOrb } from '../../lib/motion';

/**
 * Shared layout for the Refund, Privacy and Terms pages. Keeps the
 * editorial chrome (page header, numbered sections, contact strip)
 * in one place so all three pages share visual language.
 *
 * Props:
 *   eyebrow:       string  — small label above the title
 *   title:         string  — page title (rendered with RevealText)
 *   lede:          string  — opening paragraph
 *   lastUpdated:   string  — short ISO-style date string
 *   sections:      Array<{ heading, body }>
 */
const LegalPage = ({ eyebrow, title, lede, lastUpdated, sections = [] }) => (
  <main className="bg-bone-100">
    {/* Page header */}
    <section className="pt-40 pb-16 md:pt-48 md:pb-20 relative overflow-hidden">
      <FloatingOrb size={260} className="right-[-60px] top-[15%] opacity-[0.07]" style={{ background: '#B08D57' }} duration={20} />
      <div className="edge">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <Reveal variant="fadeUp"><p className="eyebrow mb-8">{eyebrow}</p></Reveal>
            <h1 className="display-lg text-balance">
              <RevealText text={title} as="span" className="block" />
            </h1>
            <DrawnRule width={72} className="mt-8" delay={0.8} />
          </div>
          <Reveal variant="fadeLeft" delay={0.5} className="md:col-span-4 md:pb-4">
            <p className="lede">{lede}</p>
            <p className="mt-6 text-xs uppercase tracking-widest text-ink-400">
              Last updated · {lastUpdated}
            </p>
          </Reveal>
        </div>
      </div>
    </section>

    {/* Body */}
    <section className="section-tight">
      <div className="edge">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16">
          {/* Side anchor — quick jump list */}
          <Reveal variant="fadeUp" className="md:col-span-4 lg:col-span-3">
            <div className="md:sticky md:top-32">
              <p className="eyebrow mb-6">— Sections</p>
              <ul className="space-y-3">
                {sections.map((s, i) => (
                  <li key={s.heading}>
                    <a
                      href={`#sec-${i + 1}`}
                      className="group inline-flex items-baseline gap-3 text-sm text-ink-700 hover:text-ink-900 transition-colors duration-300"
                    >
                      <span className="index-number">{String(i + 1).padStart(2, '0')}</span>
                      <span className="link-underline">{s.heading}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-10 pt-8 border-t border-ink-200 space-y-3 text-sm font-light">
                <p className="eyebrow mb-3">— Questions?</p>
                <p className="text-ink-900">+91 94314 19196</p>
                <p className="text-ink-500">reservations@sandhyagrand.in</p>
                <p className="text-ink-500 pt-2">Bari Bazaar Road, Munger · Bihar 811201</p>
              </div>
            </div>
          </Reveal>

          {/* Body sections */}
          <div className="md:col-span-8 lg:col-span-9 space-y-16">
            {sections.map((s, i) => (
              <Reveal key={s.heading} variant="fadeUp" delay={0.05 * i}>
                <article id={`sec-${i + 1}`} className="scroll-mt-32">
                  <div className="flex items-baseline gap-4 mb-6 pb-4 border-b border-ink-100">
                    <span className="index-number">— {String(i + 1).padStart(2, '0')}</span>
                    <h2 className="font-serif font-light text-2xl md:text-3xl text-ink-900">
                      {s.heading}
                    </h2>
                  </div>
                  <div className="prose-editorial space-y-5 text-ink-600 font-light leading-relaxed">
                    {s.body}
                  </div>
                </article>
              </Reveal>
            ))}

            {/* Trailing note */}
            <Reveal variant="fadeUp">
              <div className="mt-4 border-t border-ink-200 pt-8 text-sm text-ink-500 font-light">
                <p>
                  If anything on this page is unclear or you'd like to talk to
                  someone, please <Link to="/contact" className="link-underline text-ink-900">write to us</Link> or
                  call the front desk on +91 94314 19196. We'll respond within a working day.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  </main>
);

export default LegalPage;
