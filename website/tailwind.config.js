/** @type {import('tailwindcss').Config} */
// Design system for the Sandhya Grand editorial site. The palette is anchored on
// values that already live in src/index.css: bone (#FAF7F0 page background),
// ink (#1A1A1A body text) and brass (#B08D57, the gold seen in the shadows and
// the scrollbar). ink-200/-300 reuse the exact scrollbar greys (#D2CEC5/#A8A39A).
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        // Warm cream — page surfaces
        bone: {
          DEFAULT: '#FAF7F0',
          50: '#FFFFFF',
          100: '#FAF7F0',
          200: '#F0EBE0',
          300: '#E4DDCC',
        },
        // Warm charcoal — text & dark surfaces
        ink: {
          DEFAULT: '#1A1A1A',
          50: '#F5F4F1',
          100: '#E7E4DE',
          200: '#D2CEC5',
          300: '#A8A39A',
          400: '#847F76',
          500: '#635E56',
          600: '#47433C',
          700: '#332F2A',
          800: '#242119',
          900: '#1A1A1A',
        },
        // Gold accent
        brass: {
          DEFAULT: '#B08D57',
          300: '#D9BF97',
          400: '#C4A474',
          500: '#B08D57',
          600: '#8F7043',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Small uppercase kicker/label text
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.18em' }],
        // Fluid display headings (clamp: min, preferred, max)
        'display-sm': ['clamp(1.75rem, 1rem + 3vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        display: ['clamp(2.5rem, 1rem + 6vw, 4.5rem)', { lineHeight: '1.05', letterSpacing: '-0.022em' }],
        'display-lg': ['clamp(3rem, 1rem + 8vw, 6.5rem)', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
      },
      maxWidth: {
        edge: '90rem', // outer content gutter width
        reading: '42rem', // comfortable prose measure
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
