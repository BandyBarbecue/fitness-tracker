import { BottomNav } from '@/components/nav/bottom-nav'
import { Sidebar } from '@/components/nav/sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:pl-56">
      <Sidebar />
      <main className="pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
