'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchGoalTracking } from '@/app/actions/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Target, Calendar, TrendingUp, AlertCircle } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { format } from 'date-fns'
import { BRAND_COLORS } from '@/lib/constants'

interface Props {
  projectId: string
  selectedBrand: string
  yearMonth: string // 'yyyy-MM'
}

const BRAND_HEX: Record<string, string> = {
  DD: '#3b82f6', FIOR: '#22c55e', Juji: '#f97316', KHH: '#a855f7', NE: '#ef4444',
}

function StatusBadge({ progress }: { progress: number }) {
  if (progress >= 100) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">Achieved</span>
  if (progress >= 80) return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium">On Track</span>
  if (progress >= 50) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">At Risk</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">Behind</span>
}

export default function GoalTrackingTab({ projectId, selectedBrand, yearMonth }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['goal-tracking', projectId, yearMonth],
    queryFn: () => fetchGoalTracking(projectId, yearMonth),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="p-6"><div className="h-24 bg-muted/50 rounded animate-pulse" /></CardContent></Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        No goal tracking data for this month.
      </div>
    )
  }

  const progress = data.totalGoal > 0 ? Math.min((data.accumulated / data.totalGoal) * 100, 100) : 0
  const daysRemaining = data.daysInMonth - data.currentDay
  const dailyAvgActual = data.currentDay > 0 ? data.accumulated / data.currentDay : 0
  const projected = dailyAvgActual * data.daysInMonth
  const dailyNeeded = daysRemaining > 0 ? (data.totalGoal - data.accumulated) / daysRemaining : 0

  // Chart data: only show up to current day for actual, full month for goal line
  const chartData = data.byDay.map(d => ({
    day: `${d.day}`,
    accumulated: d.day <= data.currentDay ? d.accumulated : null,
    goal: d.goal,
  }))

  return (
    <div className="space-y-6">
      {/* This Month Progress */}
      {data.totalGoal === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">No goal set for this month</p>
              <p className="text-xs mt-0.5">Add goal sales in the Ad Spend entry form or import via CSV.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                {yearMonth} Monthly Goal Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-3xl font-bold">{formatCurrency(data.accumulated)}</p>
                  <p className="text-sm text-muted-foreground">of {formatCurrency(data.totalGoal)} goal</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{progress.toFixed(1)}%</p>
                  <StatusBadge progress={progress} />
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: progress >= 100 ? '#22c55e' : progress >= 80 ? '#3b82f6' : progress >= 50 ? '#f97316' : '#ef4444',
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Days Remaining</p>
                  <p className="text-lg font-bold">{daysRemaining}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Daily Needed</p>
                  <p className="text-lg font-bold">{dailyNeeded > 0 ? formatCurrency(dailyNeeded) : '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Projected MTD</p>
                  <p className={`text-lg font-bold ${projected >= data.totalGoal ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatCurrency(projected)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Daily Average
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatCurrency(dailyAvgActual)}</p>
                <p className="text-xs text-muted-foreground mt-1">based on {data.currentDay} days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Month Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{data.currentDay} / {data.daysInMonth}</p>
                <p className="text-xs text-muted-foreground mt-1">days elapsed</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Accumulated vs Goal Chart */}
      {data.totalGoal > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Accumulated Sales vs Goal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `RM${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="accumulated"
                  name="Accumulated"
                  stroke="#22c55e"
                  fill="url(#accGrad)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="goal"
                  name="Goal"
                  stroke="#6366f1"
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Brand comparison (All Brands view) */}
      {selectedBrand === '' && data.byBrand.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Brand Goal Comparison</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Brand</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Goal</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Accumulated</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Progress</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.byBrand.map(b => (
                  <tr key={b.brand} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: BRAND_HEX[b.brand] ?? '#94a3b8' }}
                        />
                        <span className="font-medium">{b.brand}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{b.goal > 0 ? formatCurrency(b.goal) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(b.accumulated)}</td>
                    <td className="px-4 py-3 text-right">
                      {b.goal > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(b.progress, 100)}%`,
                                backgroundColor: BRAND_HEX[b.brand] ?? '#6366f1',
                              }}
                            />
                          </div>
                          <span className="text-xs w-10 text-right">{b.progress.toFixed(0)}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.goal > 0 ? <StatusBadge progress={b.progress} /> : <span className="text-xs text-muted-foreground">No goal</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
