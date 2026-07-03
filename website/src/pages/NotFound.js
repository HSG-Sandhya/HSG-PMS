import React from 'react';
import { Link } from 'react-router-dom';
import { Reveal, RevealText, StaggerGroup, StaggerItem, Magnetic, FloatingOrb } from '../lib/motion';

const helpfulLinks = [
  { name: 'Rooms', path: '/rooms' },
  { name: 'Reserve a room', path: '/booking' },
  { name: 'Restaurant', path: '/restaurant' },
  { name: 'Wedding Hall', path: '/banquet' },
  { name: 'Contact', path: '/contact' },
];

const NotFound = () => (
  <main className="min-h-screen bg-bone-100 flex items-center justify-center pt-32 pb-24 relative overflow-hidden">
    <FloatingOrb size={400} className="left-[-100px] top-[20%] opacity-[0.06]" style={{ background: '#B08D57' }} duration={18} />
    <FloatingOrb size={260} className="right-[-60px] bottom-[10%] opacity-[0.06]" style={{ background: '#1A1A1A' }} duration={22} />
    <div className="edge w-full relative">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 items-end max-w-5xl mx-auto">
        <div className="md:col-span-7">
          <Reveal variant="fadeUp"><p className="eyebrow mb-8">— 404 · Lost</p></Reveal>
          <h1 className="font-serif font-light text-ink-900 text-display-lg leading-[0.95] tracking-tight">
            <RevealText text="That page" as="span" className="block" />
            <RevealText text="isn’t here." emphasis="isn’t" as="span" delay={0.4} className="block" />
          </h1>
        </div>
        <Reveal variant="fadeLeft" delay={0.5} className="md:col-span-5">
          <p className="lede mb-10">
            It may have moved, or perhaps the address slipped a letter. The
            front desk is awake — try one of these instead.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Magnetic strength={16}>
              <Link to="/" className="btn-primary">
                Return home <span aria-hidden>→</span>
              </Link>
            </Magnetic>
            <Magnetic strength={16}>
              <button onClick={() => window.history.back()} className="btn-secondary">
                Go back
              </button>
            </Magnetic>
          </div>
        </Reveal>
      </div>

      <StaggerGroup
        delay={0.1}
        delayChildren={0.6}
        className="mt-24 md:mt-32 border-t border-ink-200 pt-12 max-w-5xl mx-auto"
      >
        <p className="index-number mb-8">— Or, perhaps</p>
        <ul className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {helpfulLinks.map((l, i) => (
            <StaggerItem as="li" variant="fadeUp" key={l.name}>
              <Link to={l.path} className="group block">
                <span className="block index-number">{String(i + 1).padStart(2, '0')}</span>
                <span className="block font-serif text-2xl text-ink-900 font-light mt-2 group-hover:text-brass-500 transition-colors duration-300">{l.name}</span>
              </Link>
            </StaggerItem>
          ))}
        </ul>
      </StaggerGroup>
    </div>
  </main>
);

export default NotFound;
