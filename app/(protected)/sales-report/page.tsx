'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { subDays, eachDayOfInterval, parseISO, format } from 'date-fns'
import { DollarSign, TrendingUp, ShoppingCart, BarChart2 } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SalesOrder {
  id: string
  order_date: string
  total_price: number
  cost_price: number
  profit: number
  package_snapshot: { name?: string; price?: number; code?: string } | null
  package_name: string | null
  status: string
  customers: { name: string } | null
  projects: { name: string; code: string } | null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SalesReportPage() {
  const supabase = createClient()

  const [dateFrom, setDateFrom] = useState(subDays(new Date(), 29).toISOString().split('T')[0])
  const [dateTo,   setDateTo]   = useState(new Date().toISOString().split('T')[0])
  const [projectId, setProjectId] = useState('')

  // Fetch projects for filter
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').order('name')
      return data ?? []
    },
  })

  // Fetch orders with profit data
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-report', dateFrom, dateTo, projectId],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('id, order_date, total_price, cost_price, profit, package_snapshot, package_name, status, customers(name), projects(name, code)')
        .gte('order_date', dateFrom)
        .lte('order_date', dateTo)
        .neq('status', 'cancelled')
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (projectId) q = q.eq('project_id', projectId)

      const { data: orders } = await q
      const safeOrders = (orders ?? []) as unknown as SalesOrder[]

      // Summary stats
      const totalRevenue   = safeOrders.reduce((s, o) => s + Number(o.total_price), 0)
      const totalProfit    = safeOrders.reduce((s, o) => s + Number(o.profit ?? 0), 0)
      const totalOrders    = safeOrders.length
      const avgProfit      = totalOrders > 0 ? totalProfit / totalOrders : 0

      // Daily profit trend (last 30 days)
      const days = eachDayOfInterval({
        start: parseISO(dateFrom),
        end:   parseISO(dateTo),
      })
      const byDay = days.map(d => {
        const key = format(d, 'yyyy-MM-dd')
        const dayOrders = safeOrders.filter(o => o.order_date === key)
        return {
          date:    format(d, 'dd MMM'),
          revenue: dayOrders.reduce((s, o) => s + Number(o.total_price), 0),
          profit:  dayOrders.reduce((s, o) => s + Number(o.profit ?? 0), 0),
        }
      })

      return { orders: safeOrders, totalRevenue, totalProfit, totalOrders, avgProfit, byDay }
    },
  })

  const interval = Math.max(1, Math.floor((salesData?.byDay.length ?? 1) / 6))

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Report" description="Revenue and profit analysis by date range" />

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs mb-1 block">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-36"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-36"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Project</Label>
          <Select value={projectId || '__all__'} onValueChange={v => setProjectId(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Projects</SelectItem>
              {projects.map((p: { id: string; name: string }) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={salesData?.totalRevenue ?? 0}
          isCurrency
          icon={DollarSign}
        />
        <StatCard
          title="Total Profit"
          value={salesData?.totalProfit ?? 0}
          isCurrency
          icon={TrendingUp}
          description={
            salesData && salesData.totalRevenue > 0
              ? `${((salesData.totalProfit / salesData.totalRevenue) * 100).toFixed(1)}% margin`
              : undefined
          }
        />
        <StatCard
          title="Total Orders"
          value={salesData?.totalOrders ?? 0}
          icon={ShoppingCart}
        />
        <StatCard
          title="Avg Profit / Order"
          value={salesData?.avgProfit ?? 0}
          isCurrency
          icon={BarChart2}
        />
      </div>

      {/* ── Profit trend chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Profit Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesData?.byDay}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'profit' ? 'Profit' : 'Revenue',
                ]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                fill="url(#revenueGrad)"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#10b981"
                fill="url(#profitGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground justify-end">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-blue-600 opacity-60" style={{ borderTop: '2px dashed #2563eb' }} />
              Revenue
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-green-600" />
              Profit
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Orders table ── */}
      <div className="rounded-lg border bg-white">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-medium text-sm">
            Order Details
            {salesData && (
              <span className="ml-2 text-muted-foreground font-normal">
                ({salesData.totalOrders} orders)
              </span>
            )}
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : !salesData?.orders.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No orders found for the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.orders.map(order => {
                  const packageDisplay =
                    order.package_snapshot?.name ??
                    order.package_name ??
                    '—'
                  const profit = Number(order.profit ?? 0)

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(order.order_date)}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {order.customers?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.projects ? (
                          <Badge variant="outline" className="text-xs">
                            {order.projects.code}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">
                        {packageDisplay}
                        {order.package_snapshot?.code && (
                          <span className="ml-1 text-xs text-muted-foreground font-mono">
                            [{order.package_snapshot.code}]
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={order.status === 'delivered' ? 'default' : 'secondary'}
                          className="text-xs capitalize"
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCurrency(Number(order.total_price))}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatCurrency(Number(order.cost_price ?? 0))}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {formatCurrency(profit)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
