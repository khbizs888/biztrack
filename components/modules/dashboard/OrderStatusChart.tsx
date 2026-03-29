'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LoadingState from '@/components/shared/LoadingState'

const COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
}

export default function OrderStatusChart() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['orders-status-chart'],
    queryFn: async () => {
      const { data: orders } = await supabase.from('orders').select('status')
      const counts: Record<string, number> = {}
      orders?.forEach(o => { counts[o.status] = (counts[o.status] ?? 0) + 1 })
      return Object.entries(counts).map(([name, value]) => ({ name, value }))
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Orders by Status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <LoadingState rows={3} /> : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                {data?.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
