'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface BrandSetting {
  id: string
  project_id: string
  vip_spend_threshold: number
  vip_order_threshold: number
  retention_days: number
  inactive_days: number
}

export async function fetchBrandSettings(): Promise<BrandSetting[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('brand_settings')
    .select('id, project_id, vip_spend_threshold, vip_order_threshold, retention_days, inactive_days')
    .order('project_id')
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => ({
    id: r.id,
    project_id: r.project_id,
    vip_spend_threshold: Number(r.vip_spend_threshold ?? 2000),
    vip_order_threshold: Number(r.vip_order_threshold ?? 6),
    retention_days: Number(r.retention_days ?? 365),
    inactive_days: Number(r.inactive_days ?? 365),
  }))
}

export async function fetchBrandSettingByProject(projectId: string): Promise<BrandSetting | null> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('brand_settings')
    .select('id, project_id, vip_spend_threshold, vip_order_threshold, retention_days, inactive_days')
    .eq('project_id', projectId)
    .single()
  if (error) return null
  return {
    id: data.id,
    project_id: data.project_id,
    vip_spend_threshold: Number(data.vip_spend_threshold ?? 2000),
    vip_order_threshold: Number(data.vip_order_threshold ?? 6),
    retention_days: Number(data.retention_days ?? 365),
    inactive_days: Number(data.inactive_days ?? 365),
  }
}

export async function saveBrandSetting(
  projectId: string,
  settings: {
    vip_spend_threshold: number
    vip_order_threshold: number
    retention_days: number
    inactive_days: number
  },
): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('brand_settings')
    .upsert(
      {
        project_id: projectId,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id' },
    )
  if (error) throw new Error(error.message)
}
