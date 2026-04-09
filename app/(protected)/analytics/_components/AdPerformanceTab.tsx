'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { computeRaceReport, saveAdSpend, fetchRawAdSpend, type RaceReportRow } from '@/app/actions/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { ChevronDown, ChevronUp, Save, DollarSign, TrendingUp, Target, MessageCircle } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, BarChart,
} from 'recharts'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Project { id: string; name: string; code: string }

interface Props {
  projectId: string
  dateFrom: string
  dateTo: string
  selectedBrand: string
  projects: Project[]
}

function roasColor(roas: number): string {
  if (roas >= 2) return 'text-green-600'
  if (roas >= 1) return 'text-amber-500'
  return 'text-red-500'
}

function roasBg(roas: number): string {
  if (roas >= 2) return 'bg-green-100 text-green-700 border-green-200'
  if (roas >= 1) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

export default function AdPerformanceTab({ projectId, dateFrom, dateTo, selectedBrand, projects }: Props) {
  const qc = useQueryClient()
  const [showEntry, setShowEntry] = useState(true)
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fb1, setFb1] = useState('')
  const [fb2, setFb2] = useState('')
  const [fb3, setFb3] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [shopee, setShopee] = useState('')
  const [messages, setMessages] = useState('')
  const [goalSales, setGoalSales] = useState('')
  const [saving, setSaving] = useState(false)
  const [entryProjectId, setEntryProjectId] = useState(projectId || (projects[0]?.id ?? ''))

  const fbTotal = (parseFloat(fb1) || 0) + (parseFloat(fb2) || 0) + (parseFloat(fb3) || 0)
  const fbAfterSST = fbTotal * 1.08
  const ttAfterSST = (parseFloat(tiktok) || 0) * 1.08
  const shAfterSST = (parseFloat(shopee) || 0) * 1.08
  const totalAfterSST = fbAfterSST + ttAfterSST + shAfterSST

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['race-report', projectId, dateFrom, dateTo],
    queryFn: () => computeRaceReport(projectId, dateFrom, dateTo),
  })

  async function handleSave() {
    if (!entryProjectId) { toast.error('Select a project'); return }
    setSaving(true)
    try {
      await saveAdSpend({
        project_id: entryProjectId,
        date: entryDate,
        fb_ad_cost_acc1: parseFloat(fb1) || 0,
        fb_ad_cost_acc2: parseFloat(fb2) || 0,
        fb_ad_cost_acc3: parseFloat(fb3) || 0,
        tiktok_ad_cost: parseFloat(tiktok) || 0,
        shopee_ad_cost: parseFloat(shopee) || 0,
        fb_messages: parseInt(messages, 10) || 0,
        goal_sales: parseFloat(goalSales) || 0,
        source: 'manual',
      })
      toast.success('Ad spend saved')
      qc.invalidateQueries({ queryKey: ['race-report'] })
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  // Aggregate totals
  const totals = rows.reduce<RaceReportRow>((acc, r) => ({
    ...acc,
    fb_cost: acc.fb_cost + r.fb_cost,
    tiktok_cost: acc.tiktok_cost + r.tiktok_cost,
    shopee_cost: acc.shopee_cost + r.shopee_cost,
    total_ad_spend: acc.total_ad_spend + r.total_ad_spend,
    fb_total_sales: acc.fb_total_sales + r.fb_total_sales,
    tiktok_total_sales: acc.tiktok_total_sales + r.tiktok_total_sales,
    shopee_total_sales: acc.shopee_total_sales + r.shopee_total_sales,
    total_sales: acc.total_sales + r.total_sales,
    total_orders: acc.total_orders + r.total_orders,
    fb_new_orders: acc.fb_new_orders + r.fb_new_orders,
    fb_repeat_orders: acc.fb_repeat_orders + r.fb_repeat_orders,
    tiktok_new_orders: acc.tiktok_new_orders + r.tiktok_new_orders,
    tiktok_repeat_orders: acc.tiktok_repeat_orders + r.tiktok_repeat_orders,
    shopee_new_orders: acc.shopee_new_orders + r.shopee_new_orders,
    shopee_repeat_orders: acc.shopee_repeat_orders + r.shopee_repeat_orders,
    total_new_orders: acc.total_new_orders + r.total_new_orders,
    total_repeat_orders: acc.total_repeat_orders + r.total_repeat_orders,
    fb_messages: acc.fb_messages + r.fb_messages,
    fb_raw_cost: acc.fb_raw_cost + r.fb_raw_cost,
    tiktok_raw_cost: acc.tiktok_raw_cost + r.tiktok_raw_cost,
    shopee_raw_cost: acc.shopee_raw_cost + r.shopee_raw_cost,
    goal_sales: acc.goal_sales + r.goal_sales,
    date: '',
    fb_new_sales: 0, fb_repeat_sales: 0,
    tiktok_new_sales: 0, tiktok_repeat_sales: 0,
    shopee_new_sales: 0, shopee_repeat_sales: 0,
    total_new_sales: 0, total_repeat_sales: 0,
    fb_roas: 0, tiktok_roas: 0, shopee_roas: 0, total_roas: 0,
    cost_per_message: 0, cost_per_purchase: 0, new_order_rate: 0,
    aov: 0, new_aov: 0, repeat_aov: 0,
  }), {
    date: '', fb_raw_cost: 0, tiktok_raw_cost: 0, shopee_raw_cost: 0,
    fb_messages: 0, goal_sales: 0, fb_cost: 0, tiktok_cost: 0, shopee_cost: 0,
    total_ad_spend: 0, fb_new_orders: 0, fb_repeat_orders: 0, fb_new_sales: 0,
    fb_repeat_sales: 0, fb_total_sales: 0, tiktok_new_orders: 0,
    tiktok_repeat_orders: 0, tiktok_new_sales: 0, tiktok_repeat_sales: 0,
    tiktok_total_sales: 0, shopee_new_orders: 0, shopee_repeat_orders: 0,
    shopee_new_sales: 0, shopee_repeat_sales: 0, shopee_total_sales: 0,
    total_new_orders: 0, total_repeat_orders: 0, total_new_sales: 0,
    total_repeat_sales: 0, total_sales: 0, total_orders: 0,
    fb_roas: 0, tiktok_roas: 0, shopee_roas: 0, total_roas: 0,
    cost_per_message: 0, cost_per_purchase: 0, new_order_rate: 0,
    aov: 0, new_aov: 0, repeat_aov: 0,
  })

  const overallRoas = totals.total_ad_spend > 0 ? totals.total_sales / totals.total_ad_spend : 0
  const cpp = totals.total_orders > 0 ? totals.total_ad_spend / totals.total_orders : 0
  const cpm = totals.fb_messages > 0 ? totals.fb_cost / totals.fb_messages : 0

  const chartData = rows.map(r => ({
    date: r.date.slice(5), // MM-DD
    fbSpend: r.fb_cost,
    ttSpend: r.tiktok_cost,
    shSpend: r.shopee_cost,
    totalSpend: r.total_ad_spend,
    sales: r.total_sales,
    roas: r.total_roas,
  }))

  const newRepeatData = rows.map(r => ({
    date: r.date.slice(5),
    new: r.total_new_orders,
    repeat: r.total_repeat_orders,
  }))

  return (
    <div className="space-y-6">
      {/* Quick Ad Spend Entry */}
      <Card>
        <CardHeader className="pb-2">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowEntry(p => !p)}
          >
            <CardTitle className="text-sm font-medium">Quick Ad Spend Entry</CardTitle>
            {showEntry ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {showEntry && (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs mb-1 block">Date</Label>
                <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-36" />
              </div>
              {!projectId && (
                <div>
                  <Label className="text-xs mb-1 block">Project</Label>
                  <select
                    value={entryProjectId}
                    onChange={e => setEntryProjectId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <Label className="text-xs mb-1 block">FB Acc 1 (RM)</Label>
                <Input type="number" placeholder="0.00" value={fb1} onChange={e => setFb1(e.target.value)} className="w-28" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">FB Acc 2 (RM)</Label>
                <Input type="number" placeholder="0.00" value={fb2} onChange={e => setFb2(e.target.value)} className="w-28" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">FB Acc 3 (RM)</Label>
                <Input type="number" placeholder="0.00" value={fb3} onChange={e => setFb3(e.target.value)} className="w-28" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">TikTok (RM)</Label>
                <Input type="number" placeholder="0.00" value={tiktok} onChange={e => setTiktok(e.target.value)} className="w-28" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Shopee (RM)</Label>
                <Input type="number" placeholder="0.00" value={shopee} onChange={e => setShopee(e.target.value)} className="w-28" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Messages</Label>
                <Input type="number" placeholder="0" value={messages} onChange={e => setMessages(e.target.value)} className="w-24" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Goal Sales (RM)</Label>
                <Input type="number" placeholder="0.00" value={goalSales} onChange={e => setGoalSales(e.target.value)} className="w-32" />
              </div>
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
            {(fbTotal > 0 || parseFloat(tiktok) > 0 || parseFloat(shopee) > 0) && (
              <div className="rounded-lg bg-muted/50 border px-4 py-2 text-sm">
                Total Spend: <strong>{formatCurrency(fbTotal + (parseFloat(tiktok) || 0) + (parseFloat(shopee) || 0))}</strong>
                &nbsp;|&nbsp;After SST (8%): <strong className="text-amber-600">{formatCurrency(totalAfterSST)}</strong>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-12 bg-muted/50 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No ad spend data for this period.</p>
          <p className="text-xs text-muted-foreground mt-1">Use the form above or import a CSV to add ad spend records.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Ad Spend</CardTitle>
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(totals.total_ad_spend)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">after 8% SST</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Ad Platform Sales</CardTitle>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(totals.total_sales)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{totals.total_orders} orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Overall ROAS</CardTitle>
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${roasColor(overallRoas)}`}>
                  {overallRoas.toFixed(2)}×
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {overallRoas >= 2 ? 'Good' : overallRoas >= 1 ? 'Break-even' : 'Below cost'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Cost / Purchase</CardTitle>
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(cpp)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">per order</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Cost / Message</CardTitle>
                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{cpm > 0 ? formatCurrency(cpm) : '—'}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{totals.fb_messages} messages</p>
              </CardContent>
            </Card>
          </div>

          {/* Spend vs Sales Chart */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Daily Spend vs Sales</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}×`} />
                  <Tooltip formatter={(v: number, name: string) => {
                    if (name === 'roas') return [`${v.toFixed(2)}×`, 'ROAS']
                    return [formatCurrency(v), name]
                  }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalSpend" name="Ad Spend" fill="#f97316" opacity={0.8} />
                  <Line yAxisId="left" type="monotone" dataKey="sales" name="Sales" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="roas" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Platform Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Facebook */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-[#1877F2]">Facebook</CardTitle>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roasBg(totals.total_ad_spend > 0 ? totals.fb_total_sales / totals.fb_cost : 0)}`}>
                    {totals.fb_cost > 0 ? (totals.fb_total_sales / totals.fb_cost).toFixed(2) : '—'}× ROAS
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Spend (after SST)</span><span className="font-medium">{formatCurrency(totals.fb_cost)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sales</span><span className="font-medium">{formatCurrency(totals.fb_total_sales)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">New orders</span><span>{totals.fb_new_orders}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Repeat orders</span><span>{totals.fb_repeat_orders}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cost/Purchase</span>
                  <span>{totals.fb_new_orders + totals.fb_repeat_orders > 0 ? formatCurrency(totals.fb_cost / (totals.fb_new_orders + totals.fb_repeat_orders)) : '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* TikTok */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">TikTok / XHS</CardTitle>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roasBg(totals.tiktok_cost > 0 ? totals.tiktok_total_sales / totals.tiktok_cost : 0)}`}>
                    {totals.tiktok_cost > 0 ? (totals.tiktok_total_sales / totals.tiktok_cost).toFixed(2) : '—'}× ROAS
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Spend (after SST)</span><span className="font-medium">{formatCurrency(totals.tiktok_cost)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sales</span><span className="font-medium">{formatCurrency(totals.tiktok_total_sales)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">New orders</span><span>{totals.tiktok_new_orders}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Repeat orders</span><span>{totals.tiktok_repeat_orders}</span></div>
              </CardContent>
            </Card>

            {/* Shopee */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-[#EE4D2D]">Shopee / Lazada</CardTitle>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roasBg(totals.shopee_cost > 0 ? totals.shopee_total_sales / totals.shopee_cost : 0)}`}>
                    {totals.shopee_cost > 0 ? (totals.shopee_total_sales / totals.shopee_cost).toFixed(2) : '—'}× ROAS
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Spend (after SST)</span><span className="font-medium">{formatCurrency(totals.shopee_cost)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sales</span><span className="font-medium">{formatCurrency(totals.shopee_total_sales)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">New orders</span><span>{totals.shopee_new_orders}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Repeat orders</span><span>{totals.shopee_repeat_orders}</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Platform spend + new/repeat charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Platform Spend Over Time</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="fbSpend" name="Facebook" fill="#1877F2" stackId="a" />
                    <Bar dataKey="ttSpend" name="TikTok" fill="#010101" stackId="a" />
                    <Bar dataKey="shSpend" name="Shopee" fill="#EE4D2D" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">New vs Repeat Orders</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={newRepeatData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
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

          {/* Daily Data Table */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Daily Race Report</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">FB Spend</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">TT Spend</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Shopee</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sales</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">ROAS</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Orders</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">CPP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.date} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono">{r.date}</td>
                        <td className="px-3 py-2 text-right">{r.fb_cost.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right">{r.tiktok_cost.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right">{r.shopee_cost.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right font-medium">{r.total_ad_spend.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right font-medium">{r.total_sales.toFixed(0)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${roasColor(r.total_roas)}`}>
                          {r.total_ad_spend > 0 ? r.total_roas.toFixed(2) + '×' : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">{r.total_orders}</td>
                        <td className="px-3 py-2 text-right">
                          {r.total_orders > 0 ? r.cost_per_purchase.toFixed(0) : '—'}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 1 && (
                      <tr className="border-t-2 bg-muted/30 font-semibold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{totals.fb_cost.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right">{totals.tiktok_cost.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right">{totals.shopee_cost.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right">{totals.total_ad_spend.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right">{totals.total_sales.toFixed(0)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${roasColor(overallRoas)}`}>
                          {totals.total_ad_spend > 0 ? overallRoas.toFixed(2) + '×' : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">{totals.total_orders}</td>
                        <td className="px-3 py-2 text-right">{cpp.toFixed(0)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
