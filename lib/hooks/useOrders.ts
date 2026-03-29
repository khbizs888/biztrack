'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { OrderFilters, PaginatedResult, Order } from '@/lib/types'

export function useOrders(filters: OrderFilters = {}) {
  const supabase = createClient()
  const { status, projectId, dateFrom, dateTo, search, page = 1, pageSize = 25 } = filters

  return useQuery<PaginatedResult<Order>>({
    queryKey: ['orders', filters],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, customers(id, name, phone), projects(id, name, code)', { count: 'exact' })
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (status) query = query.eq('status', status)
      if (projectId) query = query.eq('project_id', projectId)
      if (dateFrom) query = query.gte('order_date', dateFrom)
      if (dateTo) query = query.lte('order_date', dateTo)
      if (search) {
        query = query.or(`customers.name.ilike.%${search}%,customers.phone.ilike.%${search}%`)
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return { data: data ?? [], count: count ?? 0, page, pageSize }
    },
  })
}
