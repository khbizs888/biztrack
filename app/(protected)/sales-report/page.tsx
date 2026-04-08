'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { confirmPayment, updateCODDeliveryStatus, type DeliveryStatus } from '@/app/actions/data'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { subDays, eachDayOfInterval, parseISO, format } from 'date-fns'
import { DollarSign, TrendingUp, ShoppingCart, BarChart2, CheckCircle, Clock } from 'lucide-react'

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
  payment_status: string | null
  is_cod: boolean | null
  delivery_status: string | null
  customers: { name: string } | null
  projects: { name: string; code: string } | null
}

type PaymentFilter = 'all' | 'Settled' | 'Pending'

// ─── Confirm Payment button (needs useTransition) ────────────────────────────

function ConfirmPaymentButton({ orderId, onConfirmed }: { orderId: string; onConfirmed: () => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      className="text-xs h-7 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await confirmPayment(orderId)
          onConfirmed()
        })
      }}
    >
      {isPending ? 'Confirming…' : 'Confirm Payment'}
    </Button>
  )
}

// ─── Delivery Status Badge ────────────────────────────────────────────────────

function DeliveryStatusBadge({ status }: { status: string | null }) {
  if (!status || status === 'pending_delivery') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
        Pending
      </span>
    )
  }
  if (status === 'out_for_delivery') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
        Out for Delivery
      </span>
    )
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
        Delivered
      </span>
    )
  }
  if (status === 'returned') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
        Returned
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      {status}
    </span>
  )
}

// ─── COD Delivery Action Buttons ──────────────────────────────────────────────

function CODDeliveryButtons({ orderId, currentStatus, onUpdated }: {
  orderId: string
  currentStatus: string | null
  onUpdated: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const isSettled  = currentStatus === 'delivered'
  const isReturned = currentStatus === 'returned' || currentStatus === 'failed'

  if (isSettled || isReturned) return null

  return (
    <div className="flex gap-1 flex-wrap">
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-7 border-green-400 text-green-700 hover:bg-green-50"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await updateCODDeliveryStatus(orderId, 'delivered' as DeliveryStatus)
            onUpdated()
          })
        }}
      >
        {isPending ? '…' : 'Mark Delivered'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-7 border-red-300 text-red-600 hover:bg-red-50"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await updateCODDeliveryStatus(orderId, 'returned' as DeliveryStatus)
            onUpdated()
          })
        }}
      >
        {isPending ? '…' : 'Returned'}
      </Button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SalesReportPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [dateFrom, setDateFrom] = useState(subDays(new Date(), 29).toISOString().split('T')[0])
  const [dateTo,   setDateTo]   = useState(new Date().toISOString().split('T')[0])
  const [projectId, setProjectId] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all')

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
        .select('id, order_date, total_price, cost_price, profit, package_snapshot, package_name, status, payment_status, is_cod, delivery_status, customers(name), projects(name, code)')
        .gte('order_date', dateFrom)
        .lte('order_date', dateTo)
        .neq('status', 'cancelled')
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (projectId) q = q.eq('project_id', projectId)

      const { data: orders } = await q
      const safeOrders = (orders ?? []) as unknown as SalesOrder[]

      // Summary stats
      const totalRevenue    = safeOrders.reduce((s, o) => s + Number(o.total_price), 0)
      const totalProfit     = safeOrders.reduce((s, o) => s + Number(o.profit ?? 0), 0)
      const totalOrders     = safeOrders.length
      const avgProfit       = totalOrders > 0 ? totalProfit / totalOrders : 0
      const settledSales    = safeOrders
        .filter(o => o.payment_status === 'Settled')
        .reduce((s, o) => s + Number(o.total_price), 0)
      const unsettledSales  = safeOrders
        .filter(o => o.payment_status === 'Pending')
        .reduce((s, o) => s + Number(o.total_price), 0)

      // Daily profit trend
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

      return { orders: safeOrders, totalRevenue, totalProfit, totalOrders, avgProfit, settledSales, unsettledSales, byDay }
    },
  })

  // Apply payment filter to displayed orders
  const displayedOrders = (salesData?.orders ?? []).filter(o => {
    if (paymentFilter === 'all') return true
    if (paymentFilter === 'Settled') return o.payment_status === 'Settled'
    if (paymentFilter === 'Pending') return o.payment_status === 'Pending'
    return true
  })

  // Recalculate summary for filtered view
  const filteredRevenue = displayedOrders.reduce((s, o) => s + Number(o.total_price), 0)
  const filteredProfit  = displayedOrders.reduce((s, o) => s + Number(o.profit ?? 0), 0)

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
        <div>
          <Label className="text-xs mb-1 block">Payment Status</Label>
          <Select value={paymentFilter} onValueChange={v => setPaymentFilter(v as PaymentFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Orders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="Settled">Settled</SelectItem>
              <SelectItem value="Pending">Unsettled (Pending)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Book Sales"
          value={paymentFilter === 'all' ? (salesData?.totalRevenue ?? 0) : filteredRevenue}
          isCurrency
          icon={DollarSign}
          description="All orders incl. pending"
          className="border-blue-200 bg-blue-50"
        />
        <StatCard
          title="Total Profit"
          value={paymentFilter === 'all' ? (salesData?.totalProfit ?? 0) : filteredProfit}
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
          value={paymentFilter === 'all' ? (salesData?.totalOrders ?? 0) : displayedOrders.length}
          icon={ShoppingCart}
        />
        <StatCard
          title="Avg Profit / Order"
          value={salesData?.avgProfit ?? 0}
          isCurrency
          icon={BarChart2}
        />
        <StatCard
          title="Settled Sales"
          value={salesData?.settledSales ?? 0}
          isCurrency
          icon={CheckCircle}
          className="border-green-200 bg-green-50"
        />
        <StatCard
          title="Unsettled Sales"
          value={salesData?.unsettledSales ?? 0}
          isCurrency
          icon={Clock}
          className="border-yellow-200 bg-yellow-50"
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
                ({displayedOrders.length} orders)
              </span>
            )}
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : !displayedOrders.length ? (
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
                  <TableHead>Payment</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedOrders.map(order => {
                  const packageDisplay =
                    order.package_snapshot?.name ??
                    order.package_name ??
                    '—'
                  const profit = Number(order.profit ?? 0)
                  const isSettled = order.payment_status === 'Settled'
                  const isPending = order.payment_status === 'Pending'

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
                      <TableCell>
                        {isSettled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Settled
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            Pending
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.is_cod ? (
                          <DeliveryStatusBadge status={order.delivery_status} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
                      <TableCell className="text-right">
                        {order.is_cod ? (
                          <CODDeliveryButtons
                            orderId={order.id}
                            currentStatus={order.delivery_status}
                            onUpdated={() =>
                              queryClient.invalidateQueries({ queryKey: ['sales-report'] })
                            }
                          />
                        ) : isPending ? (
                          <ConfirmPaymentButton
                            orderId={order.id}
                            onConfirmed={() =>
                              queryClient.invalidateQueries({ queryKey: ['sales-report'] })
                            }
                          />
                        ) : null}
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
