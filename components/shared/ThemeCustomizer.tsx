'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  THEME_PRESETS,
  DEFAULT_THEME,
  applyTheme,
  saveTheme,
  loadTheme,
  type AppTheme,
} from '@/lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Mini theme preview swatch
// ─────────────────────────────────────────────────────────────────────────────

function ThemePreview({ theme }: { theme: AppTheme }) {
  return (
    <div
      className="w-full h-16 rounded overflow-hidden flex"
      style={{ backgroundColor: theme.background, border: `1px solid ${theme.border}` }}
    >
      {/* Sidebar strip */}
      <div
        className="w-7 shrink-0 flex flex-col gap-1 pt-2 px-1.5"
        style={{ backgroundColor: theme.sidebar, borderRight: `1px solid ${theme.border}` }}
      >
        <div
          className="h-1 rounded-full"
          style={{ backgroundColor: theme.primary, width: '80%' }}
        />
        <div
          className="h-1 rounded-full"
          style={{ backgroundColor: theme.sidebarText, width: '65%', opacity: 0.4 }}
        />
        <div
          className="h-1 rounded-full"
          style={{ backgroundColor: theme.sidebarText, width: '55%', opacity: 0.4 }}
        />
        <div
          className="h-1 rounded-full"
          style={{ backgroundColor: theme.sidebarText, width: '70%', opacity: 0.4 }}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 p-1.5 flex flex-col gap-1">
        {/* Header bar */}
        <div className="flex items-center gap-1">
          <div
            className="h-1.5 rounded"
            style={{ backgroundColor: theme.text, width: '28%', opacity: 0.7 }}
          />
          <div className="ml-auto">
            <div
              className="h-3.5 w-8 rounded-sm"
              style={{ backgroundColor: theme.primary }}
            />
          </div>
        </div>

        {/* Stat cards row */}
        <div className="flex gap-1 flex-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="flex-1 rounded-sm p-0.5"
              style={{
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
              }}
            >
              <div
                className="h-1 rounded mb-0.5"
                style={{ backgroundColor: theme.primary, width: '55%', opacity: 0.9 }}
              />
              <div
                className="h-0.5 rounded"
                style={{ backgroundColor: theme.textMuted, width: '80%', opacity: 0.5 }}
              />
            </div>
          ))}
        </div>

        {/* Table row */}
        <div
          className="h-1.5 rounded"
          style={{ backgroundColor: theme.surfaceAlt, width: '90%' }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ThemeCustomizer() {
  const [activeTheme, setActiveTheme] = useState<AppTheme>(DEFAULT_THEME)

  useEffect(() => {
    const saved = loadTheme()
    setActiveTheme(saved)
    applyTheme(saved)
  }, [])

  function selectTheme(theme: AppTheme) {
    setActiveTheme(theme)
    applyTheme(theme)
    saveTheme(theme.id)
  }

  return (
    <div className="space-y-5">
      {/* ── Theme picker ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Choose a full-page theme — changes background, surfaces, sidebar, and all colors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEME_PRESETS.map(theme => {
              const isActive = activeTheme.id === theme.id
              return (
                <button
                  key={theme.id}
                  onClick={() => selectTheme(theme)}
                  className={[
                    'group relative flex flex-col gap-2 rounded-xl p-2 text-left transition-all',
                    'border-2 focus:outline-none',
                    isActive
                      ? 'border-gray-800 shadow-md'
                      : 'border-gray-200 hover:border-gray-400',
                  ].join(' ')}
                >
                  <ThemePreview theme={theme} />

                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-medium text-gray-800 leading-tight">
                      {theme.name}
                    </span>
                    {isActive && (
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-gray-900">
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Live preview ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
          <CardDescription>Live preview with the current theme applied</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-background p-4 space-y-4">
            {/* Buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <Button size="sm">Primary Button</Button>
              <Button size="sm" variant="outline">Outline</Button>
              <Button size="sm" variant="secondary">Secondary</Button>
              <Button size="sm" variant="ghost">Ghost</Button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 items-center">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Error</Badge>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Revenue', value: 'RM 12,450' },
                { label: 'Orders', value: '284' },
                { label: 'Profit', value: 'RM 3,820' },
              ].map(card => (
                <div key={card.label} className="rounded-lg border bg-card p-3 shadow-sm">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-base font-bold text-primary mt-0.5">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Table sample */}
            <div className="rounded-md border overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 flex gap-6 text-xs font-medium text-muted-foreground border-b">
                <span>Date</span><span>Customer</span><span className="ml-auto">Amount</span>
              </div>
              {[
                { date: '01 Apr', name: 'Aminah Binti Kassim', amt: 'RM 189' },
                { date: '01 Apr', name: 'Razif Ahmad', amt: 'RM 245' },
              ].map((row, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 flex gap-6 text-xs border-b last:border-0"
                  style={{ backgroundColor: i % 2 === 1 ? 'hsl(var(--muted))' : undefined }}
                >
                  <span className="text-muted-foreground">{row.date}</span>
                  <span className="text-foreground">{row.name}</span>
                  <span className="ml-auto font-medium text-primary">{row.amt}</span>
                </div>
              ))}
            </div>

            {/* Active nav item */}
            <div className="flex gap-1">
              {['Dashboard', 'Orders', 'Reports'].map((item, i) => (
                <span
                  key={item}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    i === 0
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
