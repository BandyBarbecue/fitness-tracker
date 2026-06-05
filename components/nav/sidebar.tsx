'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { tabs, isActive } from './tabs'

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside
      aria-label="Main navigation"
      className="hidden md:flex fixed top-0 left-0 h-full w-56 flex-col gap-1 p-4 z-50"
      style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-3 pt-4 pb-6">
        <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Fitness</span>
      </div>
      <nav>
        {tabs.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{
                background: active ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
