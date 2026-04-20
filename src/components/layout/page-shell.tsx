import type { CSSProperties, ReactNode } from 'react'
import { TopBar } from './top-bar'
import { NavBar } from './nav-bar'

interface PageShellProps {
  children: ReactNode
  theme?: 'kinetic' | 'broadcast'
}

export function PageShell({ children, theme = 'kinetic' }: PageShellProps) {
  const isBroadcast = theme === 'broadcast'
  // Broadcast theme expands the shell to match the reference design (1760px).
  // CSS variable cascades to TopBar/NavBar so their inner containers align.
  const shellMax = isBroadcast ? '1760px' : '64rem'
  return (
    <div
      data-theme={theme}
      className="min-h-screen bg-[var(--surface-void)]"
      style={{ '--shell-max': shellMax } as CSSProperties}
    >
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className={`sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded focus:text-sm focus:font-heading focus:font-bold ${
          isBroadcast
            ? 'focus:bg-[var(--sig-amber)] focus:text-[var(--bg-void)]'
            : 'focus:bg-[var(--accent-lime)] focus:text-[#0A0A0A]'
        }`}
      >
        Skip to content
      </a>
      <TopBar />
      <main
        id="main-content"
        className="mx-auto px-4 pt-4 pb-20 w-full max-w-[var(--shell-max,64rem)]"
        role="main"
      >
        {children}
      </main>
      <NavBar />
    </div>
  )
}
