'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function fetchProjects() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('projects').select('*').order('name')
  if (error) throw new Error(error.message)
  return JSON.parse(JSON.stringify(data ?? []))
}

export async function fetchProjectSales(): Promise<Record<string, number>> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('orders').select('project_id, total_price').neq('status', 'cancelled')
  if (error) { console.error(error.message); return {} }
  const map: Record<string, number> = {}
  ;(JSON.parse(JSON.stringify(data ?? [])) as { project_id: string | null; total_price: string }[])
    .forEach(o => {
      if (o.project_id) map[o.project_id] = (map[o.project_id] ?? 0) + Number(o.total_price)
    })
  return map
}
