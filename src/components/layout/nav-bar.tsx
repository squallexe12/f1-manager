'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useUIStore, type PageId } from '@/stores/ui-store'

interface NavItem {
  id: PageId
  label: string
  icon: string
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'paddock', label: 'Paddock', icon: '⌂', path: '/paddock' },
  { id: 'factory', label: 'Factory', icon: '⚙', path: '/factory' },
  { id: 'drivers', label: 'Drivers', icon: '☊', path: '/drivers' },
  { id: 'strategy', label: 'Strategy', icon: '◎', path: '/strategy' },
  { id: 'finance', label: 'Finance', icon: '$', path: '/finance' },
  { id: 'calendar', label: 'Calendar', icon: '▦', path: '/calendar' },
  { id: 'regulations', label: 'Regs', icon: '§', path: '/regulations' },
]

export function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { setActivePage } = useUIStore()

  function handleNav(item: NavItem) {
    setActivePage(item.id)
    router.push(item.path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-secondary)]/95 backdrop-blur-md border-t border-[var(--border-default)]" role="navigation" aria-label="Main navigation">
      <div className="flex items-center justify-around max-w-5xl mx-auto h-14">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              aria-current={isActive ? 'page' : undefined}
              className={`
                relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md
                transition-colors duration-150 outline-none
                focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
                ${isActive
                  ? 'text-[var(--accent-lime)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="text-[9px] font-heading font-semibold uppercase tracking-wider">
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 h-[2px] w-8 bg-[var(--accent-lime)] rounded-t" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
