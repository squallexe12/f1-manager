'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings-store'

/**
 * Applies the high-contrast CSS class to <html> based on settings.
 * Must be rendered as a client component inside the layout.
 */
export function ContrastProvider() {
  const highContrast = useSettingsStore((s) => s.highContrast)

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast)
  }, [highContrast])

  return null
}
