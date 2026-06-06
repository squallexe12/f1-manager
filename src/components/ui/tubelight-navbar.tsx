'use client'

import { motion, useReducedMotion } from 'framer-motion'
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
  const reduceMotion = useReducedMotion()

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={cn('fixed bottom-0 left-1/2 z-40 mb-6 -translate-x-1/2', className)}
    >
      {/* Liquid-glass pill — "Crystalline Rim" (multi-frontend workflow winner + judge grafts).
          Colour surface is driven by the cross-theme bucket (--surface-raised / --line-hair /
          --ink-*), so the glass adapts to both the kinetic and broadcast themes. */}
      <div className="relative flex items-center gap-0.5 rounded-full border border-[var(--line-hair)] bg-[var(--surface-raised)]/55 px-1.5 py-1.5 ring-1 ring-inset ring-white/12 backdrop-blur-xl backdrop-saturate-150 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6),0_4px_16px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.4)] sm:gap-1 md:gap-2">
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
                'relative cursor-pointer rounded-full px-2.5 py-2 outline-none md:px-4',
                'font-heading text-sm font-semibold uppercase tracking-wider',
                'transition-[color,transform] duration-200 ease-out active:scale-95',
                'focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]',
                isActive
                  ? 'bg-[var(--accent-lime)]/[0.06] text-[var(--accent-lime)]'
                  : 'text-[var(--ink-body)] hover:bg-white/[0.04] hover:text-[var(--ink-hi)]',
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="flex md:hidden">
                <Icon size={18} strokeWidth={2.5} aria-hidden />
              </span>
              {isActive && (
                <motion.div
                  layoutId="navbar-lamp"
                  aria-hidden
                  className="absolute inset-0 -z-10 w-full rounded-full bg-[var(--accent-lime)]/[0.07]"
                  initial={false}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 300, damping: 30 }
                  }
                >
                  {/* Lamp filament + layered halo (sharp core + atmospheric bloom) */}
                  <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-[var(--accent-lime)] shadow-[0_0_2px_rgba(204,255,0,1),0_0_8px_rgba(204,255,0,0.7),0_0_20px_5px_rgba(204,255,0,0.30)]">
                    <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-[var(--accent-lime)]/25 blur-md" />
                    <div className="absolute -top-1 h-6 w-8 rounded-full bg-[var(--accent-lime)]/25 blur-md" />
                    <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-[var(--accent-lime)]/25 blur-sm" />
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
