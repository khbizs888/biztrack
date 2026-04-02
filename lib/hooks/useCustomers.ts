'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchCustomers } from '@/app/actions/data'
import type { CustomerWithStats } from '@/lib/types'

export function useCustomers() {
  return useQuery<CustomerWithStats[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  })
}
