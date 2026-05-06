import type { ReactNode } from 'react'
import { JetBrains_Mono } from 'next/font/google'
import '@/styles/drivers-broadcast.css'

// Inter and Space_Grotesk are already loaded by the root layout (src/app/layout.tsx).
// Only JetBrains_Mono is loaded here so it is fetched only when the user
// visits /drivers (route-scoped font loading).
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export default function DriversLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`drivers-broadcast ${jetbrainsMono.variable}`}>
      {children}
    </div>
  )
}
