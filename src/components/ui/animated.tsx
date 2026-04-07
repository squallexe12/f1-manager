'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

// Respects prefers-reduced-motion via Framer Motion's built-in support

/** Fade-in on mount */
export function FadeIn({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Slide up + fade in on mount */
export function SlideUp({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Slide in from left (for commentary entries) */
export function SlideInLeft({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Animated number counter */
export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {value}
    </motion.span>
  )
}

/** Stagger children animation wrapper */
export function StaggerContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Individual stagger item */
export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.25 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Layout animation for position changes (timing tower) */
export function LayoutItem({ children, layoutId, className = '' }: { children: ReactNode; layoutId: string; className?: string }) {
  return (
    <motion.div
      layout
      layoutId={layoutId}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Page transition wrapper */
export function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { AnimatePresence }
