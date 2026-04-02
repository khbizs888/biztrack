'use client'

import { useEffect } from 'react'
import Sidebar from '@/components/shared/Sidebar'
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
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
