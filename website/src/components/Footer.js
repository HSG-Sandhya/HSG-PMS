import React from 'react';
import { Link } from 'react-router-dom';
import { Reveal, RevealText, StaggerGroup, StaggerItem, FloatingOrb, DrawnRule } from '../lib/motion';

const Footer = () => {
  const year = new Date().getFullYear();

  const cols = [
    {
      title: 'Stay',
      links: [
        { name: 'Rooms', path: '/rooms' },
        { name: 'Reserve', path: '/booking' },
        { name: 'Room Service', path: '/contact' },
      ],
    },
    {
      title: 'Experience',
      links: [
        { name: 'Restaurant', path: '/restaurant' },
        { name: 'Events', path: '/banquet' },
        { name: 'Our Story', path: '/about' },
      ],
    },
    {
      title: 'House',
      links: [
        { name: 'Contact', path: '/contact' },
        { name: 'Directions', path: '/contact' },
        { name: 'Press', path: '/about' },
      ],
    },
  ];

  return (
    <footer className="bg-ink-900 text-bone-200 relative overflow-hidden">
      <FloatingOrb size={400} className="left-[-120px] top-[10%] opacity-[0.10]" style={{ background: '#B08D57' }} duration={22} />
      <FloatingOrb size={280} className="right-[-80px] bottom-[20%] opacity-[0.08]" style={{ background: '#B08D57' }} duration={18} />
      <div className="edge relative">
        {/* Top: gold crest + large wordmark + mission, balanced across the row */}
        <div className="pt-24 pb-16 md:pt-32 md:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-16 items-center border-b border-bone-200/10">
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex flex-col w-fit items-center text-center">
              <Reveal variant="scaleIn" className="self-center">
                <img
                  src="/images/sandhya-logo.webp"
                  alt="Sandhya Hotel Grand Marriage Hall"
                  className="h-28 md:h-36 w-auto object-contain select-none"
                  style={{
                    filter:
                      'brightness(1.2) saturate(1.55) drop-shadow(0 8px 24px rgba(0,0,0,0.4)) drop-shadow(0 0 24px rgba(176,141,87,0.45))',
                  }}
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </Reveal>
              <Reveal variant="fadeUp">
                <span className="eyebrow-on-dark mt-10 mb-4 block">— Hospitality, kept simply</span>
              </Reveal>
              <h2 className="font-serif font-light text-5xl md:text-7xl lg:text-8xl text-bone-100 leading-[0.95] tracking-tight mt-2">
                <RevealText text="Sandhya" as="span" className="block" />
                <RevealText text="Grand." as="span" delay={0.3} className="block" />
              </h2>
              <DrawnRule width={120} color="#C9A56A" className="mt-10 self-center" delay={0.7} />
            </div>
          </div>

          <Reveal variant="fadeLeft" delay={0.4} className="lg:col-span-5 flex flex-col">
            {/* Gold accent + mission */}
            <DrawnRule width={56} color="#C9A56A" className="mb-7" delay={0.5} />
            <p className="font-serif font-light text-2xl md:text-3xl text-bone-100 leading-snug text-balance max-w-md">
              A small family-run hotel and wedding hall in the heart of Munger.
            </p>
            <p className="mt-5 text-bone-200/65 font-light leading-relaxed max-w-md">
              Tending to travellers, families and gatherings since 2019.
            </p>

            {/* Signature list — what the house keeps */}
            <ul className="mt-10 space-y-4">
              {[
                'Twenty-three rooms, kept simply',
                'An in-house kitchen, open all day',
                'A wedding hall for the big days',
              ].map((line) => (
                <li key={line} className="group flex items-start gap-4">
                  <span className="mt-[0.55rem] h-1.5 w-1.5 rounded-full bg-brass-300 shrink-0 shadow-[0_0_10px_rgba(201,165,106,0.6)] transition-transform duration-300 group-hover:scale-150" />
                  <span className="text-bone-100/85 font-light text-base md:text-lg">{line}</span>
                </li>
              ))}
            </ul>

            {/* Location tag */}
            <p className="eyebrow-on-dark mt-10 flex items-center gap-3">
              Est. 2019
              <span className="inline-block h-px w-6 bg-brass-300/60" />
              Munger, Bihar
            </p>
          </Reveal>
        </div>

        {/* Middle: contact + columns */}
        <div className="py-16 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 space-y-8">
            <div>
              <p className="eyebrow-on-dark mb-4">Visit</p>
              <p className="text-bone-100 font-light leading-relaxed">
                Bari Bazaar Road, Near Punjab National Bank<br />
                Munger, Bihar 811201 · India
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="eyebrow-on-dark mb-4">Reservations</p>
                <p className="text-bone-100 font-light">+91 94314 19196</p>
                <p className="text-bone-200/60 font-light">+91 87898 96312</p>
              </div>
              <div>
                <p className="eyebrow-on-dark mb-4">Write</p>
                <p className="text-bone-100 font-light text-sm md:text-base">reservations@sandhyagrand.in</p>
              </div>
            </div>
          </div>

          <StaggerGroup delay={0.1} className="lg:col-span-7 grid grid-cols-3 gap-6 md:gap-12">
            {cols.map((col) => (
              <StaggerItem variant="fadeUp" key={col.title}>
                <p className="eyebrow-on-dark mb-6">{col.title}</p>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l.name}>
                      <Link
                        to={l.path}
                        className="group inline-flex items-center text-bone-100/85 hover:text-bone-100 text-sm md:text-base font-light transition-colors duration-300"
                      >
                        <span className="inline-block h-px w-0 bg-current group-hover:w-4 group-hover:mr-3 transition-all duration-500 ease-editorial" />
                        {l.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>

        {/* Bottom: colophon */}
        <div className="border-t border-bone-200/10 pt-8 pb-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <p className="text-xs uppercase tracking-widest text-bone-200/50">
            © {year} Hotel Sandhya Grand & Marriage Hall
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-bone-200/50">
            <Link to="/refund-policy" className="hover:text-bone-100 transition-colors duration-300">Refund policy</Link>
            <Link to="/privacy" className="hover:text-bone-100 transition-colors duration-300">Privacy</Link>
            <Link to="/terms" className="hover:text-bone-100 transition-colors duration-300">Terms</Link>
            <span aria-hidden className="w-px h-3 bg-bone-200/15" />
            <a href="https://www.instagram.com/sandhyagrand" target="_blank" rel="noopener noreferrer" className="hover:text-bone-100 transition-colors duration-300">Instagram</a>
            <a href="https://www.facebook.com/sandhyagrand" target="_blank" rel="noopener noreferrer" className="hover:text-bone-100 transition-colors duration-300">Facebook</a>
            <a href="https://www.google.com/maps/search/?api=1&query=Hotel+Sandhya+Grand+Munger" target="_blank" rel="noopener noreferrer" className="hover:text-bone-100 transition-colors duration-300">Map</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
