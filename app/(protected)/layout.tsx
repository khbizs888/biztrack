'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import GlobalSearch from '@/components/shared/GlobalSearch'
import { applyTheme, loadTheme } from '@/lib/theme'

function ThemeInitializer() {
  useEffect(() => {
    applyTheme(loadTheme())
  }, [])
  return null
}

/** Scrubs Radix Dialog/Sheet body artifacts on every route change.
 *  Runs whenever pathname changes so navigating away from a page with an
 *  open dialog never leaves the app in a pointer-events-blocked state. */
function DialogArtifactCleaner() {
  const pathname = usePathname()
  useEffect(() => {
    document.body.style.pointerEvents = ''
    document.body.style.overflow = ''
    document.body.removeAttribute('data-scroll-locked')
    document.body.removeAttribute('aria-hidden')
    const root = document.getElementById('__next')
    if (root) {
      root.removeAttribute('aria-hidden')
      root.removeAttribute('inert')
    }
  }, [pathname])

  useEffect(() => {
    const handlePopState = () => {
      document.body.style.pointerEvents = ''
      document.body.style.overflow = ''
      document.body.removeAttribute('data-scroll-locked')
      const root = document.getElementById('__next')
      if (root) {
        root.removeAttribute('aria-hidden')
        root.removeAttribute('inert')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return null
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ThemeInitializer />
      <DialogArtifactCleaner />
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
