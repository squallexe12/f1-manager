import type { ReactNode } from 'react'
import { TopBar } from './top-bar'
import { NavBar } from './nav-bar'

interface PageShellProps {
  children: ReactNode
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--accent-lime)] focus:text-[#0A0A0A] focus:rounded focus:text-sm focus:font-heading focus:font-bold"
      >
        Skip to content
      </a>
      <TopBar />
      <main id="main-content" className="max-w-5xl mx-auto px-4 pt-4 pb-20" role="main">
        {children}
      </main>
      <NavBar />
    </div>
  )
}
