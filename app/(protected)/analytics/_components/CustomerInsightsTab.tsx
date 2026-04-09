'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchCustomerInsights } from '@/app/actions/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Users, UserPlus, Star, Clock, Repeat2 } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format } from 'date-fns'

interface Props {
  projectId: string
  dateFrom: string
  dateTo: string
}

const TAG_COLORS: Record<string, string> = {
  New: '#22c55e',
  Repeat: '#3b82f6',
  VIP: '#a855f7',
  Dormant: '#f97316',
  Lost: '#ef4444',
  Unknown: '#94a3b8',
}

const TAG_BADGE: Record<string, string> = {
  New: 'bg-green-100 text-green-700 border-green-200',
  Repeat: 'bg-blue-100 text-blue-700 border-blue-200',
  VIP: 'bg-purple-100 text-purple-700 border-purple-200',
  Dormant: 'bg-orange-100 text-orange-700 border-orange-200',
  Lost: 'bg-red-100 text-red-700 border-red-200',
  Unknown: 'bg-gray-100 text-gray-700 border-gray-200',
}

export default function CustomerInsightsTab({ projectId, dateFrom, dateTo }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-insights', projectId, dateFrom, dateTo],
    queryFn: () => fetchCustomerInsights(projectId, dateFrom, dateTo),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="h-12 bg-muted/50 rounded animate-pulse" /></CardContent></Card>
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        No customer data available.
      </div>
    )
  }

  const interval = Math.max(1, Math.floor(data.newVsRepeatByDay.length / 7))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Customers</CardTitle>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">New This Month</CardTitle>
            <UserPlus className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.newThisMonth}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Repeat Rate</CardTitle>
            <Repeat2 className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.repeatRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">VIP Customers</CardTitle>
            <Star className="h-3.5 w-3.5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{data.vipCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Dormant / Lost</CardTitle>
            <Clock className="h-3.5 w-3.5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.dormantCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Customer Tags</CardTitle></CardHeader>
          <CardContent>
            {data.byTag.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No customer tag data</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.byTag}
                      dataKey="count"
                      nameKey="tag"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ tag, percent }) => `${tag} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.byTag.map(entry => (
                        <Cell key={entry.tag} fill={TAG_COLORS[entry.tag] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {data.byTag.map(t => (
                    <div key={t.tag} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: TAG_COLORS[t.tag] ?? '#94a3b8' }} />
                      <span className="text-xs">{t.tag}</span>
                      <span className="text-xs font-medium ml-auto pl-4">{t.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">New vs Repeat Orders Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.newVsRepeatByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={interval} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="new" name="New" fill="#22c55e" stackId="a" />
                <Bar dataKey="repeat" name="Repeat" fill="#3b82f6" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Customers + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Top 10 Customers by Spend</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.top10.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No customer data</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Tag</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Orders</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top10.map((c, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-muted-foreground">{c.phone}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${TAG_BADGE[c.tag] ?? TAG_BADGE.Unknown}`}>
                          {c.tag}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{c.total_orders}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(c.total_spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Follow-up Reminders Due</CardTitle></CardHeader>
          <CardContent>
            {data.followUps.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No follow-ups due today.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.followUps.map(f => (
                  <div key={f.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.phone}</p>
                        {f.follow_up_note && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{f.follow_up_note}"</p>
                        )}
                      </div>
                      <span className="text-xs text-amber-600 font-medium shrink-0">{f.follow_up_date}</span>
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
