import { type ReactNode } from 'react';
import { useInView } from 'react-intersection-observer';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

export type RevealVariant = 'fade-up' | 'fade-down' | 'scale-up' | 'slide-left' | 'slide-right';
export type SpringPreset = 'apple' | 'gentle' | 'bouncy';

export interface RevealProps {
  children: ReactNode;
  /** Stagger delay in seconds — applied AFTER the element enters view. */
  delay?: number;
  /** Visual entrance variant. Defaults to 'fade-up'. */
  variant?: RevealVariant;
  /** Spring physics curve. Defaults to 'apple'. */
  spring?: SpringPreset;
  className?: string;
}

const SPRING_CONFIGS = {
  apple: { type: 'spring', stiffness: 220, damping: 24, mass: 0.8 },
  gentle: { type: 'spring', stiffness: 140, damping: 20, mass: 1 },
  bouncy: { type: 'spring', stiffness: 300, damping: 18, mass: 0.7 },
};

function getVariantConfig(variant: RevealVariant): { initial: Record<string, any>; animate: Record<string, any> } {
  switch (variant) {
    case 'fade-up':
      return {
        initial: { opacity: 0, y: 28, scale: 0.975 },
        animate: { opacity: 1, y: 0, scale: 1 },
      };
    case 'fade-down':
      return {
        initial: { opacity: 0, y: -24, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
      };
    case 'scale-up':
      return {
        initial: { opacity: 0, scale: 0.91 },
        animate: { opacity: 1, scale: 1 },
      };
    case 'slide-left':
      return {
        initial: { opacity: 0, x: -32 },
        animate: { opacity: 1, x: 0 },
      };
    case 'slide-right':
      return {
        initial: { opacity: 0, x: 32 },
        animate: { opacity: 1, x: 0 },
      };
    default:
      return {
        initial: { opacity: 0, y: 28, scale: 0.975 },
        animate: { opacity: 1, y: 0, scale: 1 },
      };
  }
}

/**
 * Scroll-triggered Apple spring reveal engine.
 * Supports GPU 3D acceleration, spring presets, reduced motion fallbacks, and directional variants.
 */
export function Reveal({
  children,
  delay = 0,
  variant = 'fade-up',
  spring = 'apple',
  className,
}: RevealProps) {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: '0px 0px -28px 0px',
  });

  const { initial, animate } = getVariantConfig(variant);
  const springConfig = SPRING_CONFIGS[spring] || SPRING_CONFIGS.apple;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? { opacity: 1 } : initial}
      animate={inView ? animate : reduce ? { opacity: 1 } : initial}
      transition={(reduce ? { duration: 0 } : { ...springConfig, delay }) as any}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger parent container for list/grid items.
 */
export function RevealStagger({
  children,
  className,
  staggerDelay = 0.07,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.08,
  });

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : staggerDelay,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const itemVariants: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.97 },
    visible: reduce
      ? { opacity: 1 }
      : {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { type: 'spring', stiffness: 220, damping: 22 },
        },
  };

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
