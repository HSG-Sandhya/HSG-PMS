import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Magnetic, EASE } from '../lib/motion';

const navItems = [
  { name: 'Rooms',      path: '/rooms' },
  { name: 'Dining',     path: '/restaurant' },
  { name: 'Events', path: '/banquet' },
  { name: 'Journal',    path: '/about' },
  { name: 'Contact',    path: '/contact' },
];

// Pages that open with a full-bleed dark hero image; the navbar
// sits transparently over them until the user scrolls past the hero.
const DARK_HERO_PATHS = new Set([
  '/',
  '/rooms',
  '/restaurant',
  '/banquet',
  '/about',
  '/contact',
  '/booking',
  '/room-service',
]);

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reset the scroll state on route change so the navbar re-evaluates
  // its transparent/solid mode for the new page from the top.
  useEffect(() => {
    setIsOpen(false);
    setIsScrolled(window.scrollY > 40);
  }, [location.pathname]);

  // Transparent over any page that opens with a dark hero, until scrolled.
  const transparent = DARK_HERO_PATHS.has(location.pathname) && !isScrolled;

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-500 ${
          transparent
            ? 'bg-transparent'
            : 'bg-bone-100/90 backdrop-blur-md border-b border-ink-100'
        }`}
      >
        <div className="edge">
          <div className="flex items-center justify-between h-20 md:h-24">
            {/* Wordmark — gold crest beside the serif name, centered as a unit */}
            <Magnetic strength={10}>
              <Link to="/" className="group inline-flex items-center gap-3 md:gap-4 leading-none">
                <motion.img
                  src="/images/sandhya-logo.webp"
                  alt="Sandhya Grand crest"
                  className="h-14 md:h-16 w-auto object-contain shrink-0 select-none"
                  style={{
                    filter: transparent
                      ? 'brightness(1.25) saturate(1.5) drop-shadow(0 2px 6px rgba(0,0,0,0.6))'
                      : 'contrast(1.25) saturate(1.55) drop-shadow(0 2px 6px rgba(176,141,87,0.35))',
                  }}
                  whileHover={{ rotate: -2, scale: 1.06 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="flex flex-col justify-center leading-none">
                  <motion.span
                    whileHover={{ letterSpacing: '0.01em' }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className={`font-serif text-xl md:text-2xl font-normal tracking-tight transition-colors duration-500 ${
                      transparent ? 'text-bone-100' : 'text-ink-900'
                    }`}
                  >
                    Sandhya Grand
                  </motion.span>
                  <span
                    className={`mt-1.5 text-[10px] tracking-[0.22em] uppercase font-medium transition-colors duration-500 ${
                      transparent ? 'text-bone-100/75' : 'text-ink-400'
                    }`}
                  >
                    Munger · Est. 2019
                  </span>
                </div>
              </Link>
            </Magnetic>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-10">
              {navItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`group relative text-sm font-medium tracking-wide transition-colors duration-300 ${
                      transparent
                        ? 'text-bone-100/90 hover:text-bone-100'
                        : 'text-ink-700 hover:text-ink-900'
                    }`}
                  >
                    <span className="inline-block transition-transform duration-500 ease-editorial group-hover:-translate-y-px">
                      {item.name}
                    </span>
                    {/* Hover underline drawing in from left */}
                    <span
                      className={`absolute -bottom-1.5 left-0 h-px w-0 group-hover:w-full transition-all duration-500 ease-editorial ${
                        transparent ? 'bg-bone-100/60' : 'bg-ink-900/60'
                      }`}
                    />
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className={`absolute -bottom-1.5 left-0 right-0 h-px ${
                          transparent ? 'bg-bone-100' : 'bg-ink-900'
                        }`}
                        transition={{ duration: 0.5, ease: EASE }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* CTA */}
            <div className="hidden lg:block">
              <Magnetic strength={14}>
                <Link
                  to="/booking"
                  className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-sm bg-gradient-to-r from-brass-400 via-brass-500 to-brass-600 px-7 py-3 text-xs uppercase tracking-widest font-medium text-bone-50 shadow-lg shadow-brass-600/25 ring-1 ring-inset ring-bone-50/15 transition-all duration-500 ease-editorial hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brass-600/40"
                >
                  {/* Sheen sweep on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-bone-50/40 to-transparent transition-transform duration-700 ease-editorial group-hover:translate-x-full"
                  />
                  <span className="relative">Reserve</span>
                  <span
                    aria-hidden
                    className="relative transition-transform duration-500 ease-editorial group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </Magnetic>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setIsOpen((v) => !v)}
              aria-label="Toggle menu"
              className={`lg:hidden flex items-center gap-2 text-xs uppercase tracking-widest font-medium transition-colors duration-500 ${
                transparent ? 'text-bone-100' : 'text-ink-900'
              }`}
            >
              <span className="relative w-6 h-[1px] bg-current">
                <span className={`absolute left-0 w-6 h-[1px] bg-current transition-transform duration-300 ${isOpen ? 'top-0 rotate-45' : '-top-1.5'}`} />
                <span className={`absolute left-0 w-6 h-[1px] bg-current transition-opacity duration-300 ${isOpen ? 'opacity-0' : 'top-0 opacity-100'}`} />
                <span className={`absolute left-0 w-6 h-[1px] bg-current transition-transform duration-300 ${isOpen ? 'top-0 -rotate-45' : 'top-1.5'}`} />
              </span>
              <span>{isOpen ? 'Close' : 'Menu'}</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile drawer — slides in from the right with stagger */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.7, ease: EASE }}
            className="fixed inset-0 z-40 bg-bone-100 lg:hidden pt-24"
          >
            <div className="edge h-full flex flex-col justify-between pb-12 overflow-hidden">
              <nav className="flex flex-col gap-2 mt-8">
                {[{ name: 'Home', path: '/' }, ...navItems].map((item, i) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7, delay: 0.06 * i + 0.15, ease: EASE }}
                    className="border-b border-ink-100 py-5 overflow-hidden"
                  >
                    <Link to={item.path} className="group flex items-baseline justify-between">
                      <span className="font-serif text-3xl text-ink-900 font-light transition-transform duration-500 ease-editorial group-hover:translate-x-2">{item.name}</span>
                      <span className="index-number">{String(i + 1).padStart(2, '0')}</span>
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
                className="mt-12 space-y-6"
              >
                <Link
                  to="/booking"
                  className="group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-sm bg-gradient-to-r from-brass-400 via-brass-500 to-brass-600 px-7 py-4 text-sm uppercase tracking-widest font-medium text-bone-50 shadow-lg shadow-brass-600/25 ring-1 ring-inset ring-bone-50/15 transition-all duration-500 ease-editorial hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brass-600/40"
                >
                  {/* Sheen sweep on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-bone-50/40 to-transparent transition-transform duration-700 ease-editorial group-hover:translate-x-full"
                  />
                  <span className="relative">Reserve a Room</span>
                  <span
                    aria-hidden
                    className="relative transition-transform duration-500 ease-editorial group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
                <div className="text-sm text-ink-500 space-y-1 font-light">
                  <p>Bari Bazaar Road, Munger · Bihar 811201</p>
                  <p>+91 94314 19196 · reservations@sandhyagrand.in</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
