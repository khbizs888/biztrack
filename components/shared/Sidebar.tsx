'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, ShoppingCart, Users, BarChart2,
  TrendingUp, FolderKanban, Settings, LogOut, Package
} from 'lucide-react'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/pnl', label: 'P&L', icon: TrendingUp },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  userEmail?: string
}

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-white">
      <div className="flex h-16 items-center px-6 border-b border-slate-700">
        <Package className="h-6 w-6 text-blue-400 mr-2" />
        <span className="text-lg font-bold">BizTrack</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-700 p-4">
        {userEmail && (
          <p className="text-xs text-slate-400 truncate mb-3">{userEmail}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  )
}
