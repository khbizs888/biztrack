'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchDashboardKPIs } from '@/app/actions/data'
import type { DashboardKPIs } from '@/lib/types'

export function useDashboard() {
  return useQuery<DashboardKPIs>({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardKPIs,
  })
}
