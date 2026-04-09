'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchSalesOverview } from '@/app/actions/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, BarChart3, Minus } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { BRAND_COLORS } from '@/lib/constants'

interface Props {
  projectId: string
  dateFrom: string
  dateTo: string
  selectedBrand: string
}

const PLATFORM_COLORS: Record<string, string> = {
  Facebook: '#1877F2',
  TikTok: '#010101',
  Xiaohongshu: '#E8281D',
  Shopee: '#EE4D2D',
  Lazada: '#0F146D',
  Other: '#94a3b8',
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return <span className="text-xs text-muted-foreground">—</span>
  const pct = ((current - prev) / prev) * 100
  const up = pct >= 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function SalesOverviewTab({ projectId, dateFrom, dateTo, selectedBrand }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-overview', projectId, dateFrom, dateTo],
    queryFn: () => fetchSalesOverview(projectId, dateFrom, dateTo),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-16 bg-muted/50 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        Failed to load sales data.
      </div>
    )
  }

  const interval = Math.max(1, Math.floor((data.byDay.length) / 7))

  const brandBarData = data.byBrand.map(b => ({
    ...b,
    fill: BRAND_COLORS[b.code]
      ? `var(--color-${b.code.toLowerCase()}, #6366f1)`
      : '#6366f1',
  }))

  const BRAND_HEX: Record<string, string> = {
    DD: '#3b82f6', FIOR: '#22c55e', Juji: '#f97316', KHH: '#a855f7', NE: '#ef4444',
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Book Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.bookSales)}</div>
            <TrendBadge current={data.bookSales} prev={data.prevBookSales} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Settle Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(data.settleSales)}</div>
            <TrendBadge current={data.settleSales} prev={data.prevSettleSales} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatCurrency(data.totalProfit)}
            </div>
            <TrendBadge current={data.totalProfit} prev={data.prevProfit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.aov)}</div>
            <TrendBadge current={data.aov} prev={data.prevAov} />
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Daily Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.byDay}>
                <defs>
                  <linearGradient id="revGradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#revGradGreen)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {selectedBrand === '' ? (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Revenue by Brand</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.byBrand}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {data.byBrand.map(b => (
                      <Cell key={b.code} fill={BRAND_HEX[b.code] ?? '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Orders by Day</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="orders" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Top 10 Packages by Revenue</CardTitle></CardHeader>
          <CardContent>
            {data.topPackages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No package data for this period</p>
            ) : (
              <div className="space-y-2">
                {data.topPackages.map((pkg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-medium truncate">{pkg.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {formatCurrency(pkg.revenue)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${(pkg.revenue / data.topPackages[0].revenue) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pkg.orders} ord</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Revenue by Platform</CardTitle></CardHeader>
          <CardContent>
            {data.byPlatform.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No platform data for this period</p>
            ) : (
              <div className="space-y-3">
                {data.byPlatform.map((p, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{p.platform}</span>
                      <span className="text-muted-foreground">{formatCurrency(p.revenue)} · {p.orders} orders</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.revenue / data.byPlatform[0].revenue) * 100}%`,
                          backgroundColor: PLATFORM_COLORS[p.platform] ?? '#6366f1',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
