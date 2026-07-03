import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Editorial replacement for native <select>.
 * options: [{ value, title, hint? }]
 * Closes on outside click or Escape; visual language matches
 * the site's input-line / brass accent system.
 */
const OptionSelect = ({
  options,
  value,
  onChange,
  error,
  placeholder = 'Choose an option',
  name,
}) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const rootRef = useRef(null);
  const selected = options.find((o) => o.value === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerState = error
    ? 'border-rose-400'
    : open
      ? 'border-ink-900'
      : 'border-ink-300 hover:border-ink-900';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        name={name}
        className={`group w-full text-left flex items-center justify-between gap-4 py-4 pl-0 pr-4 border-b transition-colors duration-300 ${triggerState}`}
      >
        <span className="flex flex-col min-w-0">
          {selected ? (
            <>
              <span className="font-serif text-xl md:text-2xl text-ink-900 leading-tight truncate">
                {selected.title}
              </span>
              {selected.hint && (
                <span className="mt-1 text-[11px] uppercase tracking-widest text-ink-400 truncate">
                  {selected.hint}
                </span>
              )}
            </>
          ) : (
            <span className="font-serif text-xl md:text-2xl text-ink-400 leading-tight">
              {placeholder}
            </span>
          )}
        </span>
        <motion.svg
          width="14" height="14" viewBox="0 0 14 14" aria-hidden
          className="text-brass-500 shrink-0"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <path d="M3 5 L7 9 L11 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute left-0 right-0 mt-3 bg-bone-100 border border-ink-100 rounded-2xl z-30 origin-top overflow-hidden max-h-[60vh] overflow-y-auto"
            style={{ boxShadow: '0 24px 60px -20px rgba(20, 20, 20, 0.18)' }}
          >
            {options.map((o, i) => {
              const isSelected = selected?.value === o.value;
              const isHover = hovered === o.value;
              return (
                <motion.li
                  key={String(o.value) + '-' + i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: Math.min(0.04 * i, 0.32), ease: EASE }}
                  onMouseEnter={() => setHovered(o.value)}
                  onMouseLeave={() => setHovered(null)}
                  className="relative border-b border-ink-100 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full text-left flex items-center justify-between gap-4 pl-6 pr-5 py-4 transition-colors duration-300 ${
                      isSelected ? 'bg-bone-200/70' : 'hover:bg-bone-200/50'
                    }`}
                  >
                    <motion.span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-[2px] bg-brass-500"
                      initial={false}
                      animate={{ scaleY: isHover || isSelected ? 1 : 0 }}
                      style={{ originY: 0.5 }}
                      transition={{ duration: 0.35, ease: EASE }}
                    />
                    <span className="flex items-baseline gap-3 min-w-0">
                      <span className="index-number shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex flex-col min-w-0">
                        <span className="font-serif text-lg md:text-xl text-ink-900 truncate">
                          {o.title}
                        </span>
                        {o.hint && (
                          <span className="mt-1 text-[10px] uppercase tracking-widest text-ink-400 truncate">
                            {o.hint}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-300 ${
                      isSelected ? 'text-brass-500' : 'text-transparent'
                    }`}>
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                        <path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OptionSelect;
