'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useDashboard } from '@/lib/hooks/useDashboard'
import { useRealtime } from '@/lib/hooks/useRealtime'
import StatCard from '@/components/shared/StatCard'
import PageHeader from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingState'
import { DollarSign, ShoppingCart, Users, TrendingUp, Wifi } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import RevenueChart from '@/components/modules/dashboard/RevenueChart'
import OrderStatusChart from '@/components/modules/dashboard/OrderStatusChart'

export default function DashboardPage() {
  useRealtime()
  const { data: kpis, isLoading } = useDashboard()

  return (
    <div>
      <PageHeader title="Dashboard" description="Business overview for this month">
        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <Wifi className="h-3 w-3" /> Live
        </span>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))
        ) : (
          <>
            <StatCard title="Total Revenue" value={kpis?.totalRevenue ?? 0} isCurrency icon={DollarSign} description="This month" />
            <StatCard title="Total Orders" value={kpis?.totalOrders ?? 0} icon={ShoppingCart} description="This month" />
            <StatCard title="New Customers" value={kpis?.newCustomers ?? 0} icon={Users} description="This month" />
            <StatCard title="Net Profit" value={kpis?.netProfit ?? 0} isCurrency icon={TrendingUp} description="After fees" />
          </>
        )}
      </div>

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
    </div>
  )
}
