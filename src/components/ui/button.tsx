'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent-lime)] text-[#0A0A0A] hover:brightness-110 active:brightness-90 focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50',
  secondary:
    'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-hover)] hover:bg-white/[0.06] active:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]/50',
  danger:
    'bg-[var(--accent-red)]/15 text-[var(--accent-red)] border border-[var(--accent-red)]/30 hover:bg-[var(--accent-red)]/25 active:bg-[var(--accent-red)]/35 focus-visible:ring-2 focus-visible:ring-[var(--accent-red)]/50',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] active:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-white/20',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-2
          font-heading font-semibold uppercase tracking-wider
          rounded-lg transition-[background,border-color,color,opacity] duration-150
          outline-none
          disabled:opacity-40 disabled:pointer-events-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
