import { BarChart2, PenLine, Camera, Bot, Settings, type LucideIcon } from 'lucide-react'

export type Tab = { href: string; label: string; Icon: LucideIcon }

export const tabs: Tab[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: BarChart2 },
  { href: '/log',       label: 'Log',       Icon: PenLine   },
  { href: '/photos',    label: 'Photos',    Icon: Camera    },
  { href: '/check-in',  label: 'Coach',     Icon: Bot       },
  { href: '/settings',  label: 'Settings',  Icon: Settings  },
]

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}
