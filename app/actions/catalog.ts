'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface CatalogPackage {
  id: string
  project_id: string
  name: string
  code: string | null
  price: number | null
  cost: number | null
  description: string | null
  is_active: boolean
  sort_order: number
  projects: { id: string; name: string; code: string | null } | null
}

export async function fetchAllPackages(projectId?: string): Promise<CatalogPackage[]> {
  const sb = createAdminClient()
  let q = sb
    .from('packages')
    .select('id, project_id, name, code, price, cost, description, is_active, sort_order, projects(id, name, code)')
    .order('sort_order')
    .order('name')

  if (projectId) q = q.eq('project_id', projectId)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return JSON.parse(JSON.stringify(data ?? []))
}

export async function createCatalogPackage(payload: {
  project_id: string
  name: string
  code?: string | null
  price: number
  cost?: number | null
  description?: string | null
}): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb.from('packages').insert({
    project_id: payload.project_id,
    name: payload.name.trim(),
    code: payload.code?.trim() || null,
    price: payload.price,
    cost: payload.cost ?? null,
    description: payload.description?.trim() || null,
    is_active: true,
  })
  if (error) throw new Error(error.message)
}

export async function updateCatalogPackage(
  id: string,
  payload: {
    name: string
    code?: string | null
    price: number
    cost?: number | null
    description?: string | null
    is_active?: boolean
  },
): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb.from('packages').update({
    name: payload.name.trim(),
    code: payload.code?.trim() || null,
    price: payload.price,
    cost: payload.cost ?? null,
    description: payload.description?.trim() || null,
    ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
  }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function togglePackageStatus(id: string, isActive: boolean): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb.from('packages').update({ is_active: isActive }).eq('id', id)
  if (error) throw new Error(error.message)
}
