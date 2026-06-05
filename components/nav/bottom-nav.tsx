'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, PenLine, Camera, Bot, Settings } from 'lucide-react'

const tabs = [
  { href: '/dashboard', label: 'Dashboard', Icon: BarChart2 },
  { href: '/log',       label: 'Log',       Icon: PenLine   },
  { href: '/photos',    label: 'Photos',    Icon: Camera    },
  { href: '/check-in',  label: 'Coach',     Icon: Bot       },
  { href: '/settings',  label: 'Settings',  Icon: Settings  },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden grid grid-cols-5 z-50"
      style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link key={href} href={href} className="flex flex-col items-center gap-1 py-2 pt-3">
            <Icon
              size={20}
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
              strokeWidth={active ? 2.5 : 1.75}
            />
            <span
              className="text-[9px] font-semibold"
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
