'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NavItem {
  name: string
  url: string
  icon: LucideIcon
  /** Optional side-effect on click (e.g. sync a store). Navigation is handled by <Link>. */
  onSelect?: () => void
}

interface TubelightNavBarProps {
  items: NavItem[]
  className?: string
}

export function TubelightNavBar({ items, className }: TubelightNavBarProps) {
  const pathname = usePathname()

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={cn('fixed bottom-0 left-1/2 z-40 mb-6 -translate-x-1/2', className)}
    >
      {/* Glass pill */}
      <div
        className={cn(
          'relative flex items-center gap-1 rounded-full px-1.5 py-1.5 sm:gap-2',
          'border border-[var(--border-default)] bg-[var(--bg-secondary)]/65 backdrop-blur-xl',
          'shadow-[0_8px_32px_rgba(0,0,0,0.45)]',
          // glass lip: faint top highlight
          'before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px',
          'before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
        )}
      >
        {items.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.url
          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={item.onSelect}
              aria-label={item.name}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative cursor-pointer rounded-full px-4 py-2 outline-none transition-colors',
                'font-heading text-sm font-semibold uppercase tracking-wider',
                'focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50',
                isActive
                  ? 'text-[var(--accent-lime)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)]',
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="flex md:hidden">
                <Icon size={18} strokeWidth={2.5} aria-hidden />
              </span>
              {isActive && (
                <motion.div
                  layoutId="navbar-lamp"
                  className="absolute inset-0 -z-10 w-full rounded-full bg-[var(--accent-lime)]/5"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-[var(--accent-lime)]">
                    <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-[var(--accent-lime)]/20 blur-md" />
                    <div className="absolute -top-1 h-6 w-8 rounded-full bg-[var(--accent-lime)]/20 blur-md" />
                    <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-[var(--accent-lime)]/20 blur-sm" />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
