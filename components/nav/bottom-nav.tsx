'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { tabs, isActive } from './tabs'

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 md:hidden grid grid-cols-5 z-50"
      style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className="flex flex-col items-center gap-1 py-2 pt-3"
          >
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
