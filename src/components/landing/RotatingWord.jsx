import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const charVariants = {
  hidden: { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: '-100%', opacity: 0 },
};

/**
 * Rotates through `words`, animating each character in/out on a spring.
 * When `active` is false (caller passes `!prefersReducedMotion`), renders
 * the first word as plain static text — no timers, no motion.
 */
export default function RotatingWord({ words, interval = 2200, active = true, className }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || words.length <= 1) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [active, interval, words.length]);

  if (!active) {
    return <span className={className}>{words[0]}</span>;
  }

  const current = words[index] ?? '';
  const characters = current.split('');

  return (
    <span className={className} style={{ display: 'inline-block' }}>
      <span className="sr-only">{current}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={current}
          aria-hidden="true"
          style={{ display: 'inline-block' }}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {characters.map((char, i) => (
            <motion.span
              key={`${current}-${i}`}
              style={{ display: 'inline-block' }}
              variants={charVariants}
              transition={{ type: 'spring', damping: 22, stiffness: 260, delay: i * 0.018 }}
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
