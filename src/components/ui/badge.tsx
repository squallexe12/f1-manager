type BadgeVariant = 'lime' | 'cyan' | 'red' | 'amber' | 'purple' | 'neutral'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  lime: 'bg-[var(--accent-lime)]/15 text-[var(--accent-lime)]',
  cyan: 'bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)]',
  red: 'bg-[var(--accent-red)]/15 text-[var(--accent-red)]',
  amber: 'bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]',
  purple: 'bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]',
  neutral: 'bg-white/[0.06] text-[var(--text-secondary)]',
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-[10px] font-heading font-semibold uppercase tracking-widest
        rounded
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
