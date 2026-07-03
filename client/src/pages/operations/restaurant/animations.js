// Framer-motion variants shared by the Restaurant page and its tabs.

// Page container fades in and staggers its children.
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Staggered children animate in with a springy rise.
export const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

// Faster stagger for the many small category chips.
export const chipContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

export const chipVariants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 18 } },
};
