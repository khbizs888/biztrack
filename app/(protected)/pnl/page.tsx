'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useProjects } from '@/lib/hooks/useProjects'
import { getPnlSettings, savePnlSettings } from '@/app/actions/data'
import PageHeader from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns'
import { Printer, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

const SPECIAL_PROJECTS = ['DD', 'NE', 'JUJI', 'KHH', 'FIOR']

interface ProjectSettings {
  productCostPct: number
  shippingPct: number
  platformFeePct: number
  marketingPct: number
  otherPct: number
  salaryAmount: number
  splitRuleEnabled: boolean
  splitFlatFee: number
  splitPct: number
  useManualRevenue: boolean
  manualRevenue: number
}

const DEFAULT_SETTINGS: ProjectSettings = {
  productCostPct: 30,
  shippingPct: 5,
  platformFeePct: 3,
  marketingPct: 10,
  otherPct: 0,
  salaryAmount: 0,
  splitRuleEnabled: true,
  splitFlatFee: 4000,
  splitPct: 50,
  useManualRevenue: false,
  manualRevenue: 0,
}

type AllSettings = Record<string, ProjectSettings>

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getProjectSettings(all: AllSettings, projectId: string): ProjectSettings {
  return { ...DEFAULT_SETTINGS, ...(all[projectId] ?? {}) }
}

/** Pro-rate monthly salary based on days in the selected range vs days in covered months */
function prorateSalary(monthlyAmount: number, dateFrom: string, dateTo: string): number {
  if (!monthlyAmount) return 0
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  const days = differenceInCalendarDays(to, from) + 1
  // Use 30 as neutral month length for pro-rating (simple approach)
  return (monthlyAmount / 30) * days
}

// ─────────────────────────────────────────────────────────────────────────────
// Editable number input component
// ─────────────────────────────────────────────────────────────────────────────

interface NumInputProps {
  value: number
  onChange: (v: number) => void
  suffix?: string
  prefix?: string
  min?: number
  max?: number
  step?: number
  className?: string
}

function NumInput({ value, onChange, suffix, prefix, min = 0, max, step = 0.1, className = '' }: NumInputProps) {
  const [local, setLocal] = useState(String(value))

  useEffect(() => {
    setLocal(String(value))
  }, [value])

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input
        type="number"
        value={local}
        min={min}
        max={max}
        step={step}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => {
          const v = parseFloat(local)
          if (!isNaN(v)) {
            onChange(min !== undefined ? Math.max(min, v) : v)
          } else {
            setLocal(String(value))
          }
        }}
        className="w-20 text-right text-sm border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Row components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ label, className = '' }: { label: string; className?: string }) {
  return (
    <tr className={`bg-gray-50 ${className}`}>
      <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </td>
    </tr>
  )
}

function PnLRow({
  label,
  pct,
  amount,
  onPctChange,
  colorClass = '',
  bold = false,
  indent = false,
}: {
  label: string
  pct?: number
  amount: number
  onPctChange?: (v: number) => void
  colorClass?: string
  bold?: boolean
  indent?: boolean
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      <td className={`px-4 py-2 text-sm ${bold ? 'font-semibold' : ''} ${indent ? 'pl-8' : ''} ${colorClass}`}>
        {label}
      </td>
      <td className="px-4 py-2 text-right">
        {pct !== undefined && onPctChange ? (
          <NumInput value={pct} onChange={onPctChange} suffix="%" min={0} max={100} />
        ) : pct !== undefined ? (
          <span className="text-sm text-muted-foreground">{pct.toFixed(1)}%</span>
        ) : null}
      </td>
      <td className={`px-4 py-2 text-right text-sm font-mono ${bold ? 'font-bold' : ''} ${colorClass}`}>
        {formatCurrency(amount)}
      </td>
    </tr>
  )
}

function StaticRow({
  label,
  value,
  bold = false,
  colorClass = '',
  indent = false,
}: {
  label: string
  value: string
  bold?: boolean
  colorClass?: string
  indent?: boolean
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      <td colSpan={2} className={`px-4 py-2 text-sm ${bold ? 'font-semibold' : ''} ${indent ? 'pl-8' : ''} ${colorClass}`}>
        {label}
      </td>
      <td className={`px-4 py-2 text-right text-sm font-mono ${bold ? 'font-bold' : ''} ${colorClass}`}>
        {value}
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function PnLPage() {
  const supabase = createClient()

  const [dateFrom, setDateFrom] = useState(startOfMonth(new Date()).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(endOfMonth(new Date()).toISOString().split('T')[0])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [allSettings, setAllSettings] = useState<AllSettings>({})
  const [settingsLoading, setSettingsLoading] = useState(false)

  // Load settings from DB when project changes
  useEffect(() => {
    if (!selectedProjectId) return
    // Return cached settings if already loaded
    if (allSettings[selectedProjectId]) return

    setSettingsLoading(true)
    getPnlSettings(selectedProjectId)
      .then(dbSettings => {
        // Map DB keys to ProjectSettings keys
        const mapped: Partial<ProjectSettings> = {
          productCostPct:    dbSettings.product_cost_pct  ?? DEFAULT_SETTINGS.productCostPct,
          shippingPct:       dbSettings.shipping_cost_pct ?? DEFAULT_SETTINGS.shippingPct,
          marketingPct:      dbSettings.marketing_cost_pct ?? DEFAULT_SETTINGS.marketingPct,
          platformFeePct:    dbSettings.platform_fee_pct  ?? DEFAULT_SETTINGS.platformFeePct,
          salaryAmount:      dbSettings.staff_cost_monthly ?? DEFAULT_SETTINGS.salaryAmount,
        }
        setAllSettings(prev => ({
          ...prev,
          [selectedProjectId]: { ...DEFAULT_SETTINGS, ...mapped },
        }))
      })
      .catch(() => {
        // Fall back to defaults silently
      })
      .finally(() => setSettingsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId])

  const settings = selectedProjectId
    ? getProjectSettings(allSettings, selectedProjectId)
    : DEFAULT_SETTINGS

  const updateSetting = useCallback(
    <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
      if (!selectedProjectId) return
      setAllSettings(prev => {
        const next = {
          ...prev,
          [selectedProjectId]: { ...getProjectSettings(prev, selectedProjectId), [key]: value },
        }
        // Persist to DB (map back to DB key format)
        const updated = next[selectedProjectId]
        savePnlSettings(selectedProjectId, {
          product_cost_pct:   updated.productCostPct,
          shipping_cost_pct:  updated.shippingPct,
          marketing_cost_pct: updated.marketingPct,
          platform_fee_pct:   updated.platformFeePct,
          staff_cost_monthly: updated.salaryAmount,
        }).catch(console.error)
        return next
      })
    },
    [selectedProjectId]
  )

  // Load projects from localStorage
  const { projects } = useProjects()

  // Select first project by default once loaded
  useEffect(() => {
    if (projects?.length && !selectedProjectId) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  const selectedProject = projects?.find(p => p.id === selectedProjectId)
  const isSpecialProject = selectedProject ? SPECIAL_PROJECTS.includes(selectedProject.code) : false

  // Fetch revenue from Supabase
  const {
    data: autoRevenue,
    isLoading: revenueLoading,
    error: revenueError,
  } = useQuery({
    queryKey: ['pnl-revenue', selectedProjectId, dateFrom, dateTo],
    enabled: !!selectedProjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('total_price')
        .eq('project_id', selectedProjectId)
        .gte('order_date', dateFrom)
        .lte('order_date', dateTo)
        .neq('status', 'cancelled')
      if (error) throw error
      const totalRevenue = (data ?? []).reduce((s, o) => s + Number(o.total_price), 0)
      const orderCount = (data ?? []).length
      return { totalRevenue, orderCount }
    },
    retry: 1,
  })

  // Determine revenue to use
  const revenue = settings.useManualRevenue
    ? settings.manualRevenue
    : (autoRevenue?.totalRevenue ?? 0)

  const orderCount = settings.useManualRevenue ? null : (autoRevenue?.orderCount ?? 0)

  // Calculate costs
  const productCost = revenue * (settings.productCostPct / 100)
  const shippingCost = revenue * (settings.shippingPct / 100)
  const platformFeeCost = revenue * (settings.platformFeePct / 100)
  const marketingCost = revenue * (settings.marketingPct / 100)
  const otherCost = revenue * (settings.otherPct / 100)
  const salaryCost = prorateSalary(settings.salaryAmount, dateFrom, dateTo)

  const totalCosts = productCost + shippingCost + platformFeeCost + marketingCost + otherCost + salaryCost
  const grossProfit = revenue - totalCosts
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

  // Split rule calculation
  let yourShare = grossProfit
  let partnerShare = 0
  if (isSpecialProject && settings.splitRuleEnabled) {
    if (grossProfit > settings.splitFlatFee) {
      const remaining = grossProfit - settings.splitFlatFee
      yourShare = settings.splitFlatFee + remaining * (settings.splitPct / 100)
      partnerShare = remaining * (1 - settings.splitPct / 100)
    } else {
      yourShare = grossProfit
      partnerShare = 0
    }
  }
  const netProfit = yourShare

  const profitColor = (v: number) => (v >= 0 ? 'text-green-700' : 'text-red-600')

  return (
    <div className="space-y-6">
      <PageHeader title="Profit & Loss" description="Per-project PnL statement with editable cost assumptions">
        <Button
          variant="outline"
          size="sm"
          className="print:hidden"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4 mr-1.5" />
          Print / Export
        </Button>
      </PageHeader>

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-4 items-end print:hidden">
        <div>
          <Label className="text-xs mb-1 block">Project</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select project…" />
            </SelectTrigger>
            <SelectContent>
              {projects?.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  <span className="text-xs text-muted-foreground ml-1.5">({p.code})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        {/* Quick month buttons */}
        {[0, 1, 2].map(offset => {
          const d = new Date()
          d.setMonth(d.getMonth() - offset)
          const label = d.toLocaleString('en-MY', { month: 'short', year: '2-digit' })
          return (
            <Button
              key={offset}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setDateFrom(startOfMonth(d).toISOString().split('T')[0])
                setDateTo(endOfMonth(d).toISOString().split('T')[0])
              }}
            >
              {label}
            </Button>
          )
        })}
      </div>

      {!selectedProjectId ? (
        <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
          Select a project to view its PnL statement.
        </div>
      ) : settingsLoading ? (
        <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground animate-pulse">
          Loading settings…
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── PnL Table ── */}
          <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  {selectedProject?.name}
                  <span className="text-xs text-muted-foreground ml-2 font-mono">
                    ({selectedProject?.code})
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dateFrom} → {dateTo}
                </p>
              </div>
              {isSpecialProject && (
                <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5">
                  Split rule project
                </span>
              )}
            </div>

            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">
                    Rate / Input
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">
                    Amount (RM)
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* ── REVENUE ── */}
                <SectionHeader label="Revenue" />

                {/* Revenue source toggle */}
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-700">
                        Total Orders Revenue
                      </span>
                      {revenueLoading && (
                        <span className="text-xs text-muted-foreground animate-pulse">loading…</span>
                      )}
                      {revenueError && !settings.useManualRevenue && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="h-3 w-3" />
                          Supabase unavailable
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 print:hidden">
                      <button
                        onClick={() => updateSetting('useManualRevenue', !settings.useManualRevenue)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gray-700"
                      >
                        {settings.useManualRevenue ? (
                          <ToggleRight className="h-4 w-4 text-blue-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                        {settings.useManualRevenue ? 'Manual override' : `Auto (from orders): ${formatCurrency(autoRevenue?.totalRevenue ?? 0)}`}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {settings.useManualRevenue ? (
                      <NumInput
                        value={settings.manualRevenue}
                        onChange={v => updateSetting('manualRevenue', v)}
                        prefix="RM"
                        step={100}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {orderCount !== null ? `${orderCount} orders` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-mono font-semibold text-green-700">
                    {formatCurrency(revenue)}
                  </td>
                </tr>

                {orderCount !== null && !settings.useManualRevenue && (
                  <tr className="border-b border-gray-100 bg-green-50/30">
                    <td colSpan={2} className="px-4 pl-8 py-1.5 text-xs text-muted-foreground">
                      Number of Orders
                    </td>
                    <td className="px-4 py-1.5 text-right text-xs font-mono text-green-700">
                      {orderCount}
                    </td>
                  </tr>
                )}

                {/* ── COST OF GOODS ── */}
                <SectionHeader label="Cost of Goods" />

                <PnLRow
                  label="Product Cost"
                  indent
                  pct={settings.productCostPct}
                  onPctChange={v => updateSetting('productCostPct', v)}
                  amount={-productCost}
                  colorClass="text-red-600"
                />

                {/* ── OPERATIONAL COSTS ── */}
                <SectionHeader label="Operational Costs" />

                <PnLRow
                  label="Shipping"
                  indent
                  pct={settings.shippingPct}
                  onPctChange={v => updateSetting('shippingPct', v)}
                  amount={-shippingCost}
                  colorClass="text-red-600"
                />
                <PnLRow
                  label="Platform Fee"
                  indent
                  pct={settings.platformFeePct}
                  onPctChange={v => updateSetting('platformFeePct', v)}
                  amount={-platformFeeCost}
                  colorClass="text-red-600"
                />
                <PnLRow
                  label="Marketing"
                  indent
                  pct={settings.marketingPct}
                  onPctChange={v => updateSetting('marketingPct', v)}
                  amount={-marketingCost}
                  colorClass="text-red-600"
                />
                <PnLRow
                  label="Other"
                  indent
                  pct={settings.otherPct}
                  onPctChange={v => updateSetting('otherPct', v)}
                  amount={-otherCost}
                  colorClass="text-red-600"
                />

                {/* ── SALARY ── */}
                <SectionHeader label="Salary" />

                <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 pl-8 py-2 text-sm text-red-600">
                    Salary (monthly)
                    <span className="text-xs text-muted-foreground ml-1.5">
                      pro-rated {differenceInCalendarDays(new Date(dateTo), new Date(dateFrom)) + 1} days
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <NumInput
                      value={settings.salaryAmount}
                      onChange={v => updateSetting('salaryAmount', v)}
                      prefix="RM"
                      step={100}
                    />
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-mono text-red-600">
                    {formatCurrency(-salaryCost)}
                  </td>
                </tr>

                {/* ── SUMMARY ── */}
                <SectionHeader label="Summary" className="border-t-2" />

                <StaticRow
                  label="Total Revenue"
                  value={formatCurrency(revenue)}
                  bold
                  colorClass="text-green-700"
                />
                <StaticRow
                  label="Total Costs"
                  value={formatCurrency(-totalCosts)}
                  bold
                  colorClass="text-red-600"
                />
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold">Gross Profit</td>
                  <td className={`px-4 py-3 text-right text-sm font-bold font-mono ${profitColor(grossProfit)}`}>
                    {formatCurrency(grossProfit)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td colSpan={2} className="px-4 py-2 text-sm text-muted-foreground">Profit Margin</td>
                  <td className={`px-4 py-2 text-right text-sm font-mono ${profitColor(profitMargin)}`}>
                    {profitMargin.toFixed(1)}%
                  </td>
                </tr>

                {/* Split rule section */}
                {isSpecialProject && (
                  <>
                    <SectionHeader label={`Profit Split — ${selectedProject?.code}`} className="border-t-2" />

                    {/* Toggle */}
                    <tr className="border-b border-gray-100 print:hidden">
                      <td colSpan={3} className="px-4 py-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={() => updateSetting('splitRuleEnabled', !settings.splitRuleEnabled)}
                            className="flex items-center gap-1.5 text-sm hover:text-gray-700"
                          >
                            {settings.splitRuleEnabled ? (
                              <ToggleRight className="h-5 w-5 text-blue-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-400" />
                            )}
                            <span className={settings.splitRuleEnabled ? 'text-blue-700 font-medium' : 'text-muted-foreground'}>
                              Split rule {settings.splitRuleEnabled ? 'ON' : 'OFF'}
                            </span>
                          </button>
                          {settings.splitRuleEnabled && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>Flat fee:</span>
                              <NumInput
                                value={settings.splitFlatFee}
                                onChange={v => updateSetting('splitFlatFee', v)}
                                prefix="RM"
                                step={500}
                              />
                              <span>+ your share:</span>
                              <NumInput
                                value={settings.splitPct}
                                onChange={v => updateSetting('splitPct', Math.min(100, Math.max(0, v)))}
                                suffix="%"
                                min={0}
                                max={100}
                                step={5}
                              />
                              <span>of remaining</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {settings.splitRuleEnabled && (
                      <>
                        <tr className="border-b border-gray-100 bg-blue-50/30">
                          <td colSpan={2} className="px-4 pl-8 py-2 text-sm text-blue-700">
                            Your share
                            <span className="text-xs text-muted-foreground ml-1.5">
                              RM {settings.splitFlatFee.toLocaleString()} + {settings.splitPct}% of remaining
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-mono font-semibold text-blue-700">
                            {formatCurrency(yourShare)}
                          </td>
                        </tr>
                        <tr className="border-b border-gray-100 bg-blue-50/20">
                          <td colSpan={2} className="px-4 pl-8 py-2 text-sm text-muted-foreground">
                            Partner share
                            <span className="text-xs ml-1.5">
                              {(100 - settings.splitPct)}% of remaining
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-mono text-muted-foreground">
                            {formatCurrency(partnerShare)}
                          </td>
                        </tr>
                      </>
                    )}
                  </>
                )}

                {/* Net Profit */}
                <tr className={`${netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'} border-t-2 border-gray-300`}>
                  <td colSpan={2} className="px-4 py-4 text-base font-bold">
                    Net Profit
                    {isSpecialProject && settings.splitRuleEnabled && (
                      <span className="text-xs font-normal text-muted-foreground ml-1.5">(your share)</span>
                    )}
                  </td>
                  <td className={`px-4 py-4 text-right text-lg font-bold font-mono ${profitColor(netProfit)}`}>
                    {formatCurrency(netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Settings persistence note ── */}
          <p className="text-xs text-muted-foreground print:hidden">
            All % settings and salary are saved automatically per project in the database.
          </p>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .space-y-6, .space-y-6 * { visibility: visible; }
          .space-y-6 { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          input[type="number"] { border: none; background: transparent; }
        }
      `}</style>
    </div>
  )
}
