'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CustomerWithStats } from '@/lib/types'

function getCustomerStatus(orderCount: number, lastOrderDate: string | null) {
  if (!lastOrderDate || orderCount === 0) return 'Churned'
  const daysSince = Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000)
  if (orderCount >= 2 && daysSince <= 90) return 'Active'
  if (orderCount === 1 && daysSince <= 90) return 'New'
  if (daysSince <= 180) return 'At Risk'
  if (daysSince <= 365) return 'Lapsed'
  return 'Churned'
}

export function useCustomers() {
  const supabase = createClient()

  return useQuery<CustomerWithStats[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*, orders(total_price, order_date, status)')
        .order('created_at', { ascending: false })

      if (error) throw error

      return (customers ?? []).map((c: any) => {
        const validOrders = (c.orders ?? []).filter((o: any) => o.status !== 'cancelled')
        const orderCount = validOrders.length
        const totalSpend = validOrders.reduce((sum: number, o: any) => sum + Number(o.total_price), 0)
        const avgOrderValue = orderCount > 0 ? totalSpend / orderCount : 0
        const lastOrderDate = validOrders.length > 0
          ? validOrders.sort((a: any, b: any) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())[0].order_date
          : null

        return {
          ...c,
          order_count: orderCount,
          total_spend: totalSpend,
          avg_order_value: avgOrderValue,
          last_order_date: lastOrderDate,
          status: getCustomerStatus(orderCount, lastOrderDate),
        }
      })
    },
  })
}
