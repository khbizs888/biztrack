'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchOrders } from '@/app/actions/data'
import type { OrderFilters, PaginatedResult, Order } from '@/lib/types'

export function useOrders(filters: OrderFilters = {}) {
  return useQuery<PaginatedResult<Order>>({
    queryKey: ['orders', filters],
    queryFn: () => fetchOrders(filters),
  })
}
