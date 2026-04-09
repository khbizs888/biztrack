'use client'

import { useEffect } from 'react'
import Sidebar from '@/components/shared/Sidebar'
import GlobalSearch from '@/components/shared/GlobalSearch'
import { applyTheme, loadTheme } from '@/lib/theme'

function ThemeInitializer() {
  useEffect(() => {
    applyTheme(loadTheme())
  }, [])
  return null
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ThemeInitializer />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Global header bar */}
        <header className="shrink-0 border-b bg-background px-6 py-2 flex items-center justify-end gap-2">
          <GlobalSearch />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
