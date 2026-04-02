'use client'

import { useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useDashboard } from '@/lib/hooks/useDashboard'
import { useRealtime } from '@/lib/hooks/useRealtime'
import StatCard from '@/components/shared/StatCard'
import PageHeader from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DollarSign, ShoppingCart, Users, TrendingUp, RefreshCw, BarChart2, Settings2, Wifi, type LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import RevenueChart from '@/components/modules/dashboard/RevenueChart'
import OrderStatusChart from '@/components/modules/dashboard/OrderStatusChart'
import type { DashboardKPIs } from '@/lib/types'

// ---------------------------------------------------------------------------
// Available metrics definition
// ---------------------------------------------------------------------------

interface MetricDef {
  key: keyof DashboardKPIs
  label: string
  icon: LucideIcon
  format: (v: number, kpis: DashboardKPIs) => string
  description: string
}

const ALL_METRICS: MetricDef[] = [
  {
    key: 'totalRevenue',
    label: 'Total Revenue',
    icon: DollarSign,
    format: (v) => formatCurrency(v),
    description: 'This month',
  },
  {
    key: 'totalOrders',
    label: 'Total Orders',
    icon: ShoppingCart,
    format: (v) => String(v),
    description: 'This month',
  },
  {
    key: 'newCustomers',
    label: 'New Customers',
    icon: Users,
    format: (v) => String(v),
    description: 'This month',
  },
  {
    key: 'netProfit',
    label: 'Net Profit',
    icon: TrendingUp,
    format: (v) => formatCurrency(v),
    description: 'After fees',
  },
  {
    key: 'repeatOrders',
    label: 'Repeat Orders',
    icon: RefreshCw,
    format: (v) => String(v),
    description: 'This month',
  },
  {
    key: 'avgOrderValue',
    label: 'Avg Order Value',
    icon: BarChart2,
    format: (v) => formatCurrency(v),
    description: 'This month',
  },
]

const DEFAULT_VISIBLE: Array<keyof DashboardKPIs> = ['totalRevenue', 'totalOrders', 'newCustomers', 'netProfit']
const STORAGE_KEY = 'dashboard_visible_metrics'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  useRealtime()
  const { data: kpis, isLoading } = useDashboard()
  const [showEdit, setShowEdit] = useState(false)
  const [visible, setVisible] = useState<Set<keyof DashboardKPIs>>(new Set(DEFAULT_VISIBLE))

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const arr = JSON.parse(saved) as Array<keyof DashboardKPIs>
        setVisible(new Set(arr))
      } catch { /* ignore */ }
    }
  }, [])

  function toggleMetric(key: keyof DashboardKPIs) {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1) return prev // keep at least 1
        next.delete(key)
      } else {
        next.add(key)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }

  const shownMetrics = ALL_METRICS.filter(m => visible.has(m.key))

  return (
    <div>
      <PageHeader title="Dashboard" description="Business overview for this month">
        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <Wifi className="h-3 w-3" /> Live
        </span>
        <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
          <Settings2 className="h-4 w-4 mr-1.5" />Edit Dashboard
        </Button>
      </PageHeader>

      {/* KPI grid */}
      <div className={`grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 ${shownMetrics.length >= 4 ? 'lg:grid-cols-4' : `lg:grid-cols-${shownMetrics.length}`}`}>
        {isLoading
          ? Array.from({ length: visible.size }).map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))
          : shownMetrics.map(m => (
              <StatCard
                key={m.key}
                title={m.label}
                value={m.format(kpis?.[m.key] ?? 0, kpis!)}
                icon={m.icon}
                description={m.description}
              />
            ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<LoadingSpinner />}>
            <RevenueChart />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<LoadingSpinner />}>
            <OrderStatusChart />
          </Suspense>
        </div>
      </div>

      {/* Edit Dashboard modal */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Dashboard</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Choose which KPI cards to display.</p>
          <div className="space-y-2 mt-2">
            {ALL_METRICS.map(m => (
              <label
                key={m.key}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={visible.has(m.key)}
                  onChange={() => toggleMetric(m.key)}
                  className="h-4 w-4 accent-green-600"
                />
                <m.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{m.label}</span>
              </label>
            ))}
          </div>
          <Button className="w-full mt-2" onClick={() => setShowEdit(false)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
