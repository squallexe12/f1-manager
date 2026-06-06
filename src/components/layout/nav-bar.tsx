'use client'

import {
  Home,
  Factory,
  Users,
  Target,
  DollarSign,
  CalendarDays,
  Scale,
} from 'lucide-react'
import { TubelightNavBar, type NavItem } from '@/components/ui/tubelight-navbar'
import { useUIStore, type PageId } from '@/stores/ui-store'

const NAV_ITEMS: Array<NavItem & { id: PageId }> = [
  { id: 'paddock', name: 'Paddock', url: '/paddock', icon: Home },
  { id: 'factory', name: 'Factory', url: '/factory', icon: Factory },
  { id: 'drivers', name: 'Drivers', url: '/drivers', icon: Users },
  { id: 'strategy', name: 'Strategy', url: '/strategy', icon: Target },
  { id: 'finance', name: 'Finance', url: '/finance', icon: DollarSign },
  { id: 'calendar', name: 'Calendar', url: '/calendar', icon: CalendarDays },
  { id: 'regulations', name: 'Regs', url: '/regulations', icon: Scale },
]

export function NavBar() {
  const setActivePage = useUIStore((s) => s.setActivePage)

  const items: NavItem[] = NAV_ITEMS.map(({ id, name, url, icon }) => ({
    name,
    url,
    icon,
    onSelect: () => setActivePage(id),
  }))

  return <TubelightNavBar items={items} />
}
