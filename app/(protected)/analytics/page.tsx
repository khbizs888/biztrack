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
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns'
import { DollarSign, ShoppingCart, TrendingUp, Percent } from 'lucide-react'

export default function AnalyticsPage() {
  const supabase = createClient()
  const [dateFrom, setDateFrom] = useState(subDays(new Date(), 29).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [projectId, setProjectId] = useState('')
  const [adSpend, setAdSpend] = useState('')

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').order('name')
      return data ?? []
    },
  })

  const { data: analyticsData } = useQuery({
    queryKey: ['analytics', dateFrom, dateTo, projectId],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('*, projects(name,code), customers(name)')
        .gte('order_date', dateFrom)
        .lte('order_date', dateTo)
        .neq('status', 'cancelled')
      if (projectId) q = q.eq('project_id', projectId)
      const { data: orders } = await q

      const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) })
      const byDay = days.map(d => {
        const key = format(d, 'yyyy-MM-dd')
        const dayOrders = orders?.filter(o => o.order_date === key) ?? []
        return {
          date: format(d, 'dd MMM'),
          revenue: dayOrders.reduce((s, o) => s + Number(o.total_price), 0),
          orders: dayOrders.length,
        }
      })

      const byProject: Record<string, number> = {}
      orders?.forEach(o => {
        const name = (o.projects as any)?.name ?? 'Unknown'
        byProject[name] = (byProject[name] ?? 0) + Number(o.total_price)
      })

      const byCustomer: Record<string, { name: string; spend: number }> = {}
      orders?.forEach((o: any) => {
        const cid = o.customer_id ?? 'unknown'
        if (!byCustomer[cid]) byCustomer[cid] = { name: o.customers?.name ?? 'Unknown', spend: 0 }
        byCustomer[cid].spend += Number(o.total_price)
      })
      const topCustomers = Object.values(byCustomer)
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 10)

      const totalRevenue = orders?.reduce((s, o) => s + Number(o.total_price), 0) ?? 0
      const totalOrders = orders?.length ?? 0
      const aov = totalOrders ? totalRevenue / totalOrders : 0

      return {
        byDay,
        byProject: Object.entries(byProject).map(([name, revenue]) => ({ name, revenue })),
        topCustomers,
        totalRevenue,
        totalOrders,
        aov,
      }
    },
  })

  const roas = adSpend && Number(adSpend) > 0
    ? (analyticsData?.totalRevenue ?? 0) / Number(adSpend)
    : null

  const interval = Math.max(1, Math.floor((analyticsData?.byDay.length ?? 1) / 6))

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Analytics" />

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs mb-1 block">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Project</Label>
          <Select value={projectId || 'all'} onValueChange={v => setProjectId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Ad Spend (RM)</Label>
          <Input type="number" placeholder="0.00" value={adSpend} onChange={e => setAdSpend(e.target.value)} className="w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={analyticsData?.totalRevenue ?? 0} isCurrency icon={DollarSign} />
        <StatCard title="Total Orders" value={analyticsData?.totalOrders ?? 0} icon={ShoppingCart} />
        <StatCard title="Avg Order Value" value={analyticsData?.aov ?? 0} isCurrency icon={TrendingUp} />
        <StatCard
          title="ROAS"
          value={roas != null ? `${roas.toFixed(2)}x` : '—'}
          icon={Percent}
          description={adSpend ? `RM ${adSpend} ad spend` : 'Enter ad spend above'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analyticsData?.byDay}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Orders by Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analyticsData?.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Project</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analyticsData?.byProject}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 Customers by LTV</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analyticsData?.topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="spend" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
