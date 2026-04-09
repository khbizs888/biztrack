'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGoalTracking, saveMonthlyGoal } from '@/app/actions/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Target, Pencil, Check, Loader2, TrendingUp, Calendar, AlertCircle } from 'lucide-react'
import {
  ComposedChart, AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts'
import { format, addMonths, subMonths, parseISO } from 'date-fns'
import { BRAND_COLORS, BRANDS } from '@/lib/constants'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  selectedBrand: string
  projects: { id: string; name: string; code: string }[]
}

const BRAND_HEX: Record<string, string> = {
  DD: '#3b82f6', FIOR: '#22c55e', Juji: '#f97316', KHH: '#a855f7', NE: '#ef4444',
}

// ── Status helpers ────────────────────────────────────────────────────────────

function projectedStatus(projected: number, goal: number) {
  if (goal === 0) return null
  const pct = (projected / goal) * 100
  if (pct >= 100) return 'on-track'
  if (pct >= 80) return 'at-risk'
  return 'behind'
}

function StatusBadge({ projected, goal, size = 'sm' }: { projected: number; goal: number; size?: 'sm' | 'xs' }) {
  const s = projectedStatus(projected, goal)
  const base = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5 rounded-full border font-medium'
    : 'text-xs px-2 py-0.5 rounded-full border font-medium'
  if (!s) return null
  if (s === 'on-track') return <span className={cn(base, 'bg-green-100 text-green-700 border-green-200')}>On Track</span>
  if (s === 'at-risk')  return <span className={cn(base, 'bg-amber-100 text-amber-700 border-amber-200')}>At Risk</span>
  return <span className={cn(base, 'bg-red-100 text-red-700 border-red-200')}>Behind</span>
}

function ProgressColor(pct: number) {
  if (pct >= 100) return '#22c55e'
  if (pct >= 80)  return '#3b82f6'
  if (pct >= 50)  return '#f97316'
  return '#ef4444'
}

// ── Inline editable target cell ───────────────────────────────────────────────

interface EditableTargetProps {
  brandCode: string
  projectId: string
  initialTarget: number
  initialNotes: string | null
  year: number
  month: number
  onSaved: () => void
}

function EditableTarget({ brandCode, projectId, initialTarget, initialNotes, year, month, onSaved }: EditableTargetProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(initialTarget || ''))
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLInputElement>(null)

  // Sync when parent refetches
  useEffect(() => {
    if (!editing) setValue(String(initialTarget || ''))
  }, [initialTarget, editing])

  useEffect(() => {
    if (!editing) setNotes(initialNotes ?? '')
  }, [initialNotes, editing])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  useEffect(() => {
    if (showNotes) notesRef.current?.focus()
  }, [showNotes])

  async function handleSave() {
    const target = parseFloat(value) || 0
    setSaving(true)
    try {
      await saveMonthlyGoal(projectId, year, month, target, notes || undefined)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
      onSaved()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') { setValue(String(initialTarget || '')); setEditing(false) }
  }

  return (
    <div>
      {editing ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">RM</span>
          <input
            ref={inputRef}
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-28 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
            min={0}
          />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditing(true)}
            className="group flex items-center gap-1.5 text-left hover:text-primary transition-colors"
          >
            {initialTarget > 0
              ? <span className="text-sm font-medium tabular-nums">{formatCurrency(initialTarget)}</span>
              : <span className="text-sm text-muted-foreground italic">Set target…</span>
            }
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {justSaved && <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium"><Check className="h-3 w-3" />Saved</span>}
        </div>
      )}

      {/* Notes row */}
      <div className="mt-0.5">
        {showNotes ? (
          <input
            ref={notesRef}
            type="text"
            value={notes}
            placeholder="Add a note…"
            onChange={e => setNotes(e.target.value)}
            onBlur={() => { setShowNotes(false); if (notes !== (initialNotes ?? '')) handleSave() }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.currentTarget.blur() } }}
            className="text-xs border rounded px-2 py-0.5 w-44 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            onClick={() => setShowNotes(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {initialNotes ? `"${initialNotes}"` : '+ Add note'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GoalTrackingTab({ projectId, selectedBrand, projects }: Props) {
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'))
  const qc = useQueryClient()

  const year  = parseInt(yearMonth.split('-')[0], 10)
  const month = parseInt(yearMonth.split('-')[1], 10)
  const monthLabel = format(parseISO(`${yearMonth}-01`), 'MMMM yyyy')

  const { data, isLoading } = useQuery({
    queryKey: ['goal-tracking', projectId, yearMonth],
    queryFn: () => fetchGoalTracking(projectId, yearMonth),
  })

  function navigateMonth(delta: number) {
    const base = parseISO(`${yearMonth}-01`)
    setYearMonth(format(delta > 0 ? addMonths(base, 1) : subMonths(base, 1), 'yyyy-MM'))
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['goal-tracking', projectId, yearMonth] })
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="p-6"><div className="h-24 bg-muted/50 rounded animate-pulse" /></CardContent></Card>
        <Card><CardContent className="p-6"><div className="h-48 bg-muted/50 rounded animate-pulse" /></CardContent></Card>
      </div>
    )
  }

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const dailyAvg = data.currentDay > 0 ? data.accumulated / data.currentDay : 0
  const projected = dailyAvg * data.daysInMonth
  const daysRemaining = Math.max(0, data.daysInMonth - data.currentDay)
  const dailyNeeded  = daysRemaining > 0 ? (data.totalGoal - data.accumulated) / daysRemaining : 0
  const progressPct  = data.totalGoal > 0 ? Math.min((data.accumulated / data.totalGoal) * 100, 100) : 0

  // Chart: accumulated + goal trajectory + projected trend
  const chartData = data.byDay.map(d => ({
    day: d.day,
    Accumulated: d.day <= data.currentDay ? d.accumulated : null,
    'Goal Pace': d.goalLine,
    Projected: d.day >= data.currentDay && data.currentDay > 0
      ? data.accumulated + dailyAvg * (d.day - data.currentDay)
      : null,
  }))

  const showAllBrands = selectedBrand === ''

  return (
    <div className="space-y-6">

      {/* ── Month navigation ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1.5 rounded-lg border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold">{monthLabel}</h2>
        <button
          onClick={() => navigateMonth(1)}
          className="p-1.5 rounded-lg border hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Section 1: Company / Brand Overview ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main progress card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                {showAllBrands ? 'All Brands' : selectedBrand} — {monthLabel}
              </CardTitle>
              <StatusBadge projected={projected} goal={data.totalGoal} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.totalGoal === 0 ? (
              <div className="flex items-center gap-3 text-muted-foreground py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-sm">No revenue target set for this month. Click the pencil icon below to add one.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{formatCurrency(data.accumulated)}</p>
                    <p className="text-sm text-muted-foreground">of {formatCurrency(data.totalGoal)} target</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary tabular-nums">{progressPct.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">achieved</p>
                  </div>
                </div>

                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, backgroundColor: ProgressColor(progressPct) }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-3 pt-1">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Days Elapsed</p>
                    <p className="text-lg font-bold">{data.currentDay}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Days Left</p>
                    <p className="text-lg font-bold">{daysRemaining}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Daily Needed</p>
                    <p className="text-lg font-bold tabular-nums">
                      {daysRemaining > 0 && dailyNeeded > 0 ? formatCurrency(dailyNeeded) : '—'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Projected</p>
                    <p className={cn(
                      'text-lg font-bold tabular-nums',
                      data.currentDay === 0 ? 'text-muted-foreground'
                        : projected >= data.totalGoal ? 'text-green-600' : 'text-amber-600',
                    )}>
                      {data.currentDay > 0 ? formatCurrency(projected) : '—'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Side stat cards */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Daily Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">
                {data.currentDay > 0 ? formatCurrency(dailyAvg) : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">over {data.currentDay} days</p>
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
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(data.currentDay / data.daysInMonth) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Section 2: Brand Goals Table (inline editable) ───────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {showAllBrands ? 'Brand Revenue Targets' : `${selectedBrand} Revenue Target`}
            <span className="ml-2 text-xs font-normal text-muted-foreground">— click target to edit</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Brand</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Revenue Target</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Accumulated</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-40">Progress</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">%</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Daily Needed</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.byBrand.map(b => {
                const brandDailyAvg = data.currentDay > 0 ? b.accumulated / data.currentDay : 0
                const brandProjected = brandDailyAvg * data.daysInMonth
                const brandProgress = b.goal > 0 ? Math.min((b.accumulated / b.goal) * 100, 100) : 0
                const brandDailyNeeded = daysRemaining > 0
                  ? Math.max(0, (b.goal - b.accumulated) / daysRemaining)
                  : 0

                return (
                  <tr key={b.brand} className="border-b hover:bg-muted/30">
                    {/* Brand */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: BRAND_HEX[b.brand] ?? '#94a3b8' }} />
                        <span className="font-medium">{b.brand}</span>
                      </div>
                    </td>

                    {/* Inline-editable target */}
                    <td className="px-4 py-2.5">
                      <EditableTarget
                        brandCode={b.brand}
                        projectId={b.projectId}
                        initialTarget={b.goal}
                        initialNotes={b.notes}
                        year={year}
                        month={month}
                        onSaved={invalidate}
                      />
                    </td>

                    {/* Accumulated */}
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(b.accumulated)}
                    </td>

                    {/* Progress bar */}
                    <td className="px-4 py-3">
                      {b.goal > 0 ? (
                        <div className="h-2 bg-muted rounded-full overflow-hidden w-full">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${brandProgress}%`,
                              backgroundColor: BRAND_HEX[b.brand] ?? '#6366f1',
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-2 bg-muted/40 rounded-full" />
                      )}
                    </td>

                    {/* % */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {b.goal > 0 ? (
                        <span className="text-sm font-medium">{brandProgress.toFixed(0)}%</span>
                      ) : '—'}
                    </td>

                    {/* Daily needed */}
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {b.goal > 0 && daysRemaining > 0 ? formatCurrency(brandDailyNeeded) : '—'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-right">
                      {b.goal > 0
                        ? <StatusBadge projected={brandProjected} goal={b.goal} size="xs" />
                        : <span className="text-xs text-muted-foreground">No target</span>
                      }
                    </td>
                  </tr>
                )
              })}

              {/* Totals row */}
              {data.byBrand.length > 1 && (
                <tr className="border-t-2 bg-muted/30">
                  <td className="px-4 py-3 font-semibold">Total</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{data.totalGoal > 0 ? formatCurrency(data.totalGoal) : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(data.accumulated)}</td>
                  <td className="px-4 py-3">
                    {data.totalGoal > 0 && (
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {data.totalGoal > 0 ? `${progressPct.toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {data.totalGoal > 0 && daysRemaining > 0 ? formatCurrency(dailyNeeded) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {data.totalGoal > 0 && <StatusBadge projected={projected} goal={data.totalGoal} size="xs" />}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── Section 3: Goal Progress Chart ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Goal Progress Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="accumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `RM${(v / 1000).toFixed(0)}k` : `RM${v}`} />
              <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {/* Projected (grey, behind green) */}
              <Area
                type="monotone"
                dataKey="Projected"
                stroke="#94a3b8"
                fill="url(#projGrad)"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                connectNulls={false}
              />

              {/* Actual accumulated (green) */}
              <Area
                type="monotone"
                dataKey="Accumulated"
                stroke="#22c55e"
                fill="url(#accumGrad)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />

              {/* Goal pace line (dashed purple) */}
              <Line
                type="monotone"
                dataKey="Goal Pace"
                stroke="#6366f1"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
              />

              {/* Individual brand lines in All Brands view */}
              {showAllBrands && data.byBrand.map(b => {
                const brandChartData = b.byDay.map(d => ({
                  day: d.day,
                  [b.brand]: d.day <= data.currentDay ? d.accumulated : null,
                }))
                // We can't add dynamic Lines to a ComposedChart here,
                // so individual brand lines are shown in Section 4 chart instead
                return null
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Section 4: Brand Comparison (All Brands view only) ───────────────── */}
      {showAllBrands && data.byBrand.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Horizontal progress bars */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Brand Comparison</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.byBrand.map(b => {
                const pct = b.goal > 0 ? Math.min((b.accumulated / b.goal) * 100, 100) : 0
                return (
                  <div key={b.brand} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: BRAND_HEX[b.brand] ?? '#94a3b8' }} />
                        <span className="font-medium">{b.brand}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground tabular-nums">{formatCurrency(b.accumulated)}</span>
                        <span className="font-medium w-10 text-right tabular-nums">{b.goal > 0 ? `${pct.toFixed(0)}%` : '—'}</span>
                      </div>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-1.5"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: BRAND_HEX[b.brand] ?? '#6366f1',
                          minWidth: pct > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    {b.goal > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        target: {formatCurrency(b.goal)}
                      </p>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Individual brand accumulated lines chart */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Brand Accumulation Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={Array.from({ length: data.daysInMonth }, (_, i) => {
                    const d = i + 1
                    const row: Record<string, number | null> = { day: d }
                    data.byBrand.forEach(b => {
                      row[b.brand] = d <= data.currentDay ? (b.byDay[i]?.accumulated ?? 0) : null
                    })
                    return row
                  })}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {data.byBrand.map(b => (
                    <Line
                      key={b.brand}
                      type="monotone"
                      dataKey={b.brand}
                      stroke={BRAND_HEX[b.brand] ?? '#94a3b8'}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
