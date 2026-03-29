'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'

const SPECIAL_PROJECTS = ['DD', 'NE', 'JUJI']

export default function PnLPage() {
  const supabase = createClient()
  const [dateFrom, setDateFrom] = useState(startOfMonth(new Date()).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(endOfMonth(new Date()).toISOString().split('T')[0])

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').order('name')
      return data ?? []
    },
  })

  const { data: pnlData, isLoading } = useQuery({
    queryKey: ['pnl', dateFrom, dateTo, projects?.length],
    enabled: (projects?.length ?? 0) > 0,
    queryFn: async () => {
      const days = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000 + 1

      const [ordersRes, expensesRes, salariesRes] = await Promise.all([
        supabase.from('orders').select('project_id, total_price').gte('order_date', dateFrom).lte('order_date', dateTo).neq('status', 'cancelled'),
        supabase.from('expenses').select('*').gte('date', dateFrom).lte('date', dateTo),
        supabase.from('salaries').select('*'),
      ])

      const projectCount = projects!.length || 1

      return projects!.map(project => {
        const orders = ordersRes.data?.filter(o => o.project_id === project.id) ?? []
        const revenue = orders.reduce((s, o) => s + Number(o.total_price), 0)

        const shipping = revenue * 0.05
        const platformFee = revenue * 0.03

        const marketing = expensesRes.data
          ?.filter(e => e.project_id === project.id && e.type === 'marketing')
          .reduce((s, e) => s + Number(e.amount), 0) ?? 0

        const activeSalaries = salariesRes.data?.filter(s => {
          const start = new Date(s.start_date)
          const end = s.end_date ? new Date(s.end_date) : new Date()
          return start <= new Date(dateTo) && end >= new Date(dateFrom)
        }) ?? []
        const dailySalary = activeSalaries.reduce((s, sal) => s + Number(sal.amount) / 30, 0)
        const salary = (dailySalary * days) / projectCount

        const totalCosts = shipping + platformFee + marketing + salary
        const grossProfit = revenue - totalCosts

        let netProfit: number
        if (SPECIAL_PROJECTS.includes(project.code)) {
          netProfit = grossProfit > 4000 ? 4000 + (grossProfit - 4000) * 0.5 : grossProfit
        } else {
          netProfit = grossProfit
        }

        return { project, revenue, shipping, platformFee, marketing, salary, totalCosts, grossProfit, netProfit }
      })
    },
  })

  const { data: trendData } = useQuery({
    queryKey: ['pnl-trend'],
    queryFn: async () => {
      const months = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() })
      return Promise.all(months.map(async month => {
        const from = startOfMonth(month).toISOString().split('T')[0]
        const to = endOfMonth(month).toISOString().split('T')[0]
        const { data: orders } = await supabase.from('orders').select('total_price').gte('order_date', from).lte('order_date', to).neq('status', 'cancelled')
        const revenue = orders?.reduce((s, o) => s + Number(o.total_price), 0) ?? 0
        const netProfit = revenue * 0.82
        return { month: format(month, 'MMM yy'), revenue, netProfit }
      }))
    },
  })

  const totals = pnlData?.reduce(
    (acc, row) => ({ revenue: acc.revenue + row.revenue, totalCosts: acc.totalCosts + row.totalCosts, netProfit: acc.netProfit + row.netProfit }),
    { revenue: 0, totalCosts: 0, netProfit: 0 }
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Profit & Loss" />

      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <Label className="text-xs mb-1 block">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Shipping (5%)</TableHead>
                <TableHead className="text-right">Platform (3%)</TableHead>
                <TableHead className="text-right">Marketing</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="text-right">Total Costs</TableHead>
                <TableHead className="text-right">Gross Profit</TableHead>
                <TableHead className="text-right font-bold">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnlData?.map(row => (
                <TableRow key={row.project.id}>
                  <TableCell className="font-medium">
                    {row.project.name}
                    <span className="text-xs text-muted-foreground ml-1">({row.project.code})</span>
                    {SPECIAL_PROJECTS.includes(row.project.code) && (
                      <span className="text-xs text-blue-600 ml-1">50% split</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(row.shipping)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(row.platformFee)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(row.marketing)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(row.salary)}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(row.totalCosts)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.grossProfit)}</TableCell>
                  <TableCell className={`text-right font-bold ${row.netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(row.netProfit)}
                  </TableCell>
                </TableRow>
              ))}
              {totals && (
                <TableRow className="bg-muted/30 font-semibold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.revenue)}</TableCell>
                  <TableCell colSpan={5} />
                  <TableCell className="text-right text-destructive">{formatCurrency(totals.totalCosts)}</TableCell>
                  <TableCell />
                  <TableCell className={`text-right font-bold ${totals.netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(totals.netProfit)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">6-Month Profit Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `RM${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
