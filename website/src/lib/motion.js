import React, { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  useMotionTemplate,
  useMotionValue,
  AnimatePresence,
} from 'framer-motion';

// Shared editorial easing — slow, settled finish like the existing pages.
export const EASE = [0.22, 1, 0.36, 1];

// ─────────────────────────── Variants ───────────────────────────

const make = (from, to = { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }) => ({
  hidden: from,
  show: (i = 0) => ({
    ...to,
    transition: {
      duration: 0.9,
      delay: typeof i === 'number' ? i * 0.08 : 0,
      ease: EASE,
    },
  }),
});

export const fadeUp    = make({ opacity: 0, y: 32 });
export const fadeDown  = make({ opacity: 0, y: -32 });
export const fadeLeft  = make({ opacity: 0, x: -40 });
export const fadeRight = make({ opacity: 0, x: 40 });
export const scaleIn   = make({ opacity: 0, scale: 0.92 });
export const zoomIn    = make({ opacity: 0, scale: 1.08 });
export const blurIn    = make({ opacity: 0, y: 14, filter: 'blur(10px)' });

export const stagger = (delay = 0.08, delayChildren = 0.1) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: delay, delayChildren },
  },
});

export const VARIANTS = {
  fadeUp, fadeDown, fadeLeft, fadeRight, scaleIn, zoomIn, blurIn,
};

// ─────────────────────────── Reveal wrapper ───────────────────────────

export const Reveal = ({
  as = 'div',
  variant = 'fadeUp',
  delay = 0,
  once = true,
  amount = 0.1,
  className = '',
  children,
  ...rest
}) => {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;
  const variants = reduce ? undefined : VARIANTS[variant] || fadeUp;
  return (
    <MotionTag
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once, amount }}
      variants={variants}
      custom={delay / 0.08}
      transition={delay ? { delay, duration: 0.9, ease: EASE } : undefined}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

// ─────────────────────────── Stagger group ───────────────────────────

export const StaggerGroup = ({
  as = 'div',
  delay = 0.08,
  delayChildren = 0.1,
  once = true,
  amount = 0.1,
  className = '',
  children,
  ...rest
}) => {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once, amount }}
      variants={reduce ? undefined : stagger(delay, delayChildren)}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

export const StaggerItem = ({
  as = 'div',
  variant = 'fadeUp',
  className = '',
  children,
  ...rest
}) => {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      variants={VARIANTS[variant] || fadeUp}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

// ─────────────────────────── RevealText (per word) ───────────────────────────
// Parent observes once with a stable bounding rect; words inherit via variants.

const WORD_PARENT = {
  hidden: {},
  show: (cfg) => ({
    transition: {
      staggerChildren: cfg?.gap ?? 0.045,
      delayChildren: cfg?.delay ?? 0,
    },
  }),
};
const WORD_CHILD = {
  hidden: { y: '110%', opacity: 0 },
  show: { y: '0%', opacity: 1, transition: { duration: 0.9, ease: EASE } },
};

export const RevealText = ({
  as = 'span',
  text,
  className = '',
  wordClassName = 'inline-block',
  stagger: gap = 0.045,
  delay = 0,
  emphasis,
}) => {
  const reduce = useReducedMotion();
  const Tag = as;
  if (reduce) return <Tag className={className}>{text}</Tag>;
  const words = String(text).split(' ');
  return (
    <Tag className={className} aria-label={text}>
      <motion.span
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        variants={WORD_PARENT}
        custom={{ gap, delay }}
      >
        {words.map((word, i) => {
          const isEm = emphasis && word.toLowerCase().replace(/[^a-z]/g, '') === emphasis.toLowerCase();
          return (
            <span key={`${word}-${i}`} className="overflow-hidden inline-block align-baseline mr-[0.22em]">
              <motion.span
                variants={WORD_CHILD}
                className={`${wordClassName} ${isEm ? 'italic text-brass-500' : ''}`}
              >
                {word}
              </motion.span>
            </span>
          );
        })}
      </motion.span>
    </Tag>
  );
};

// ─────────────────────────── Parallax (scroll-driven Y) ───────────────────────────

export const Parallax = ({
  amount = 80,
  className = '',
  children,
  ...rest
}) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  const ySmooth = useSpring(y, { stiffness: 80, damping: 20, mass: 0.6 });
  return (
    <motion.div
      ref={ref}
      style={reduce ? undefined : { y: ySmooth }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

// ─────────────────────────── RevealImage (mask-reveal effect) ───────────────────────────
// Parent observes once with a stable bounding rect; the mask slides up via variants.

const IMG_PARENT = {
  hidden: {},
  show: { transition: {} },
};
const IMG_MASK = {
  hidden: { y: '102%' },
  show: { y: '0%', transition: { duration: 1.2, ease: EASE } },
};

export const RevealImage = ({
  src,
  alt,
  className = '',
  aspect = 'aspect-[4/5]',
  fit = 'object-cover',
  parallaxAmount = 30,
  zoom = true,
}) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [parallaxAmount, -parallaxAmount]);
  const ySmooth = useSpring(y, { stiffness: 70, damping: 22 });
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1.0]);
  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once: true, amount: 0.1 }}
      variants={IMG_PARENT}
      className={`relative overflow-hidden ${aspect} ${className}`}
    >
      <motion.div
        variants={reduce ? undefined : IMG_MASK}
        className="absolute inset-0"
      >
        <motion.img
          src={src}
          alt={alt}
          loading="lazy"
          className={`w-full h-full ${fit}`}
          style={reduce ? undefined : { y: ySmooth, scale: zoom ? scale : undefined }}
        />
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────── Magnetic (mouse-tracking) ───────────────────────────

export const Magnetic = ({ strength = 16, className = '', children, ...rest }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 18 });
  const sy = useSpring(y, { stiffness: 180, damping: 18 });

  const handleMove = (e) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    x.set(px * strength);
    y.set(py * strength);
  };
  const reset = () => { x.set(0); y.set(0); };

  return (
    <motion.span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={reduce ? undefined : { x: sx, y: sy }}
      className={`inline-block ${className}`}
      {...rest}
    >
      {children}
    </motion.span>
  );
};

// ─────────────────────────── Tilt card (3D perspective on hover) ───────────────────────────

export const Tilt = ({
  intensity = 8,
  className = '',
  children,
  ...rest
}) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 20 });
  const sry = useSpring(ry, { stiffness: 200, damping: 20 });
  const transform = useMotionTemplate`perspective(900px) rotateX(${srx}deg) rotateY(${sry}deg)`;

  const handleMove = (e) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rx.set(-py * intensity);
    ry.set(px * intensity);
  };
  const reset = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={reduce ? undefined : { transform, transformStyle: 'preserve-3d' }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

// ─────────────────────────── Scroll progress bar ───────────────────────────

export const ScrollProgress = ({
  height = 2,
  color = '#B08D57',
}) => {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120, damping: 30, restDelta: 0.001,
  });
  if (reduce) return null;
  return (
    <motion.div
      style={{
        scaleX,
        transformOrigin: '0% 50%',
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height,
        background: color,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─────────────────────────── Floating ambient blob ───────────────────────────

export const FloatingOrb = ({
  size = 200,
  className = '',
  style = {},
  duration = 12,
}) => {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      animate={{
        x: [0, 24, -16, 0],
        y: [0, -28, 18, 0],
        scale: [1, 1.06, 0.96, 1],
      }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      className={`absolute rounded-full pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        filter: 'blur(60px)',
        ...style,
      }}
    />
  );
};

// ─────────────────────────── Animated counter (number ticks up) ───────────────────────────

export const Counter = ({ to, duration = 1.4, className = '', suffix = '' }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const value = useMotionValue(0);
  const display = useTransform(value, (latest) => Math.round(latest).toLocaleString('en-IN') + suffix);
  React.useEffect(() => {
    if (reduce) { value.set(to); return; }
    const controls = animateValue(value, to, duration);
    return controls?.stop;
  }, [to, duration, reduce, value]);
  return <motion.span ref={ref} className={className}>{display}</motion.span>;
};

// Tiny animate-on-mount helper for the Counter
function animateValue(mv, target, duration) {
  const start = performance.now();
  const from = mv.get();
  let raf;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / (duration * 1000));
    const eased = 1 - Math.pow(1 - t, 3);
    mv.set(from + (target - from) * eased);
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}

// ─────────────────────────── Marquee strip (infinitely scrolling text) ───────────────────────────

export const MarqueeStrip = ({
  items = [],
  speed = 38,
  className = '',
  separator = '·',
}) => {
  const reduce = useReducedMotion();
  if (!items.length) return null;
  const doubled = [...items, ...items];

  return (
    <div className={`marquee select-none ${className}`} aria-hidden>
      <motion.div
        className="flex items-center gap-16 whitespace-nowrap"
        animate={reduce ? undefined : { x: ['0%', '-50%'] }}
        transition={reduce ? undefined : { duration: speed, repeat: Infinity, ease: 'linear' }}
        style={{ willChange: 'transform' }}
      >
        {doubled.map((label, i) => (
          <span key={i} className="inline-flex items-center gap-16 shrink-0">
            <span className="font-serif text-3xl md:text-5xl tracking-tight">{label}</span>
            <span className="text-brass-500 text-2xl md:text-4xl">{separator}</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
};

// ─────────────────────────── Giant ghosted section number ───────────────────────────

export const GiantNumber = ({
  children,
  className = '',
  position = 'right',
  amount = 60,
  opacity = 0.05,
}) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  const ySmooth = useSpring(y, { stiffness: 60, damping: 22 });

  const positionClass =
    position === 'right' ? 'right-[-4vw] md:right-[-2vw]'
    : position === 'left'  ? 'left-[-4vw] md:left-[-2vw]'
    : 'left-1/2 -translate-x-1/2';

  return (
    <div ref={ref} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${positionClass} ${className}`}>
      <motion.span
        aria-hidden
        style={reduce ? undefined : { y: ySmooth }}
        className="block font-serif font-light leading-none tracking-tighter text-ink-900 select-none"
        // 22vw scales nicely from mobile to ultrawide
      >
        <span style={{ fontSize: '22vw', opacity, display: 'block', lineHeight: 0.85 }}>
          {children}
        </span>
      </motion.span>
    </div>
  );
};

// ─────────────────────────── Drawn rule (brass underline draws in) ───────────────────────────

export const DrawnRule = ({
  color = '#B08D57',
  thickness = 1,
  width = 64,
  className = '',
  delay = 0,
}) => {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={reduce ? undefined : { scaleX: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 1.2, delay, ease: EASE }}
      style={{
        display: 'block',
        width,
        height: thickness,
        background: color,
        transformOrigin: '0% 50%',
      }}
      className={className}
    />
  );
};

// ─────────────────────────── Noise/grain overlay (site-wide texture) ───────────────────────────

export const NoiseOverlay = ({ opacity = 0.04 }) => (
  <div
    aria-hidden
    style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 9998,
      mixBlendMode: 'multiply',
      opacity,
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
    }}
  />
);

// ─────────────────────────── Cinema transition (gold curtain sweep) ───────────────────────────

export const CinemaTransition = ({ pathKey, children }) => {
  const reduce = useReducedMotion();
  return (
    <>
      {!reduce && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`curtain-${pathKey}`}
            aria-hidden
            initial={{ scaleY: 1, transformOrigin: '100% 0%' }}
            animate={{ scaleY: 0, transformOrigin: '100% 0%' }}
            exit={{ scaleY: 1, transformOrigin: '0% 100%' }}
            transition={{ duration: 0.8, ease: EASE }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9997,
              pointerEvents: 'none',
              background:
                'linear-gradient(135deg, #1A1A1A 0%, #2A1F10 55%, #B08D57 100%)',
            }}
          />
        </AnimatePresence>
      )}
      <motion.div
        key={pathKey}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -16 }}
        transition={{ duration: 0.7, ease: EASE, delay: reduce ? 0 : 0.15 }}
      >
        {children}
      </motion.div>
    </>
  );
};


