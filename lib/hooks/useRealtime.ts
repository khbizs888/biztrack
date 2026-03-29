'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useRealtime() {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const connectedRef = useRef(false)

  useEffect(() => {
    const channel = supabase
      .channel('realtime-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      })
      .subscribe((status) => {
        connectedRef.current = status === 'SUBSCRIBED'
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase])
}
