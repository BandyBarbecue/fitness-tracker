'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function SubTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex-1 text-center py-2.5 text-xs font-semibold transition-colors"
      style={{
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
      }}
    >
      {label}
    </Link>
  )
}

export function InsightsSubTabs() {
  const pathname = usePathname()
  return (
    <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
      <SubTab href="/insights" label="Analytics" active={pathname === '/insights'} />
      <SubTab href="/insights/photos" label="Photos" active={pathname.startsWith('/insights/photos')} />
    </div>
  )
}
