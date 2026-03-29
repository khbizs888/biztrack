'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, subDays } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import LoadingState from '@/components/shared/LoadingState'

export default function RevenueChart() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-chart'],
    queryFn: async () => {
      const from = subDays(new Date(), 29).toISOString().split('T')[0]
      const { data: orders } = await supabase
        .from('orders')
        .select('order_date, total_price')
        .gte('order_date', from)
        .neq('status', 'cancelled')
        .order('order_date')

      const map: Record<string, number> = {}
      for (let i = 29; i >= 0; i--) {
        const key = subDays(new Date(), i).toISOString().split('T')[0]
        map[key] = 0
      }
      orders?.forEach(o => {
        if (map[o.order_date] !== undefined) map[o.order_date] += Number(o.total_price)
      })

      return Object.entries(map).map(([date, revenue]) => ({
        date: format(new Date(date), 'dd MMM'),
        revenue,
      }))
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue — Last 30 Days</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <LoadingState rows={3} /> : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `RM${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
