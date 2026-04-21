import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import { ContrastProvider } from '@/components/layout/contrast-provider'
import { PersistenceProvider } from '@/components/providers/persistence-provider'
import '../styles/tokens.css'
import './globals.css'
import '../styles/topbar.css'
import '../styles/paddock.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MISSION CONTROL | F1 Kinetic Command',
  description: 'F1 Management Simulation — Command Your Constructor',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg-primary text-text-primary font-body antialiased">
        <ContrastProvider />
        <PersistenceProvider />
        {children}
      </body>
    </html>
  )
}
