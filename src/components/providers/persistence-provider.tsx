'use client'

import { useEffect } from 'react'
import { setupPersistence } from '@/stores/persistence-setup'

/**
 * Boots the persistence subscriber once at app mount.
 * Renders nothing — purely a side-effect wiring point.
 */
export function PersistenceProvider() {
  useEffect(() => {
    setupPersistence()
  }, [])
  return null
}
