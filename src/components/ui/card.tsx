import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  accentColor?: string
}

export function Card({ children, accentColor, className = '', ...props }: CardProps) {
  return (
    <div
      className={`
        bg-[var(--bg-surface)] backdrop-blur-sm
        border border-[var(--border-default)]
        rounded-lg p-4
        ${accentColor ? `border-l-2` : ''}
        ${className}
      `}
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
      {...props}
    >
      {children}
    </div>
  )
}
