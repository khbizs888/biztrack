'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { DashboardKPIs } from '@/lib/types'

export function useDashboard() {
  const supabase = createClient()

  return useQuery<DashboardKPIs>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

      const { data: orders } = await supabase
        .from('orders')
        .select('total_price, status, customer_id')
        .gte('order_date', startOfMonth)
        .lte('order_date', endOfMonth)
        .neq('status', 'cancelled')

      const { data: newCustomers } = await supabase
        .from('customers')
        .select('id', { count: 'exact' })
        .gte('created_at', startOfMonth + 'T00:00:00')
        .lte('created_at', endOfMonth + 'T23:59:59')

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_price), 0) ?? 0
      const totalOrders = orders?.length ?? 0
      const shipping = totalRevenue * 0.05
      const platformFee = totalRevenue * 0.03
      const netProfit = totalRevenue - shipping - platformFee

      return {
        totalRevenue,
        totalOrders,
        newCustomers: newCustomers?.length ?? 0,
        netProfit,
      }
    },
  })
}
