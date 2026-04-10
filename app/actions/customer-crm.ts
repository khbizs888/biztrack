'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { CustomerTag, CustomerCRM } from '@/lib/types'

// ─── Global Search ────────────────────────────────────────────────────────────

export type CustomerSearchResult = {
  type: 'customer'
  id: string
  name: string
  phone: string
  tag: string
  totalSpent: number
  totalOrders: number
  lastOrderDate: string | null
  preferredBrand: string | null
}

export type OrderSearchResult = {
  type: 'order'
  id: string
  trackingNumber: string
  customerId: string
  customerName: string
  projectCode: string | null
  packageName: string | null
  totalPrice: number
  orderDate: string
  status: string
}

export type SearchResult = CustomerSearchResult | OrderSearchResult

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return []
  const sb  = createAdminClient()
  const esc = query.replace(/[%_]/g, '\\$&')
  const q   = `%${esc}%`

  const [{ data: customers }, { data: orders }] = await Promise.all([
    sb.from('customers')
      .select('id, name, phone, customer_tag, total_spent, total_orders, last_order_date, preferred_brand')
      .or(`name.ilike.${q},phone.ilike.${q}`)
      .order('total_spent', { ascending: false })
      .limit(8),
    sb.from('orders')
      .select('id, tracking_number, customer_id, order_date, total_price, status, package_name, customers(name), projects(code)')
      .ilike('tracking_number', q)
      .not('tracking_number', 'is', null)
      .limit(4),
  ])

  const results: SearchResult[] = []

  for (const c of customers ?? []) {
    results.push({
      type: 'customer',
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      tag: (c.customer_tag as string) ?? 'New',
      totalSpent: Number(c.total_spent ?? 0),
      totalOrders: c.total_orders ?? 0,
      lastOrderDate: c.last_order_date ?? null,
      preferredBrand: c.preferred_brand ?? null,
    })
  }

  for (const o of orders ?? []) {
    const cust = o.customers as unknown as { name: string } | null
    const proj = o.projects as unknown as { code: string } | null
    if (!o.customer_id) continue
    results.push({
      type: 'order',
      id: o.id,
      trackingNumber: o.tracking_number ?? '',
      customerId: o.customer_id,
      customerName: cust?.name ?? '',
      projectCode: proj?.code ?? null,
      packageName: o.package_name ?? null,
      totalPrice: Number(o.total_price ?? 0),
      orderDate: o.order_date ?? '',
      status: o.status ?? 'pending',
    })
  }

  return results.slice(0, 10)
}

// ─── Server-side paginated customer list ─────────────────────────────────────

const PAGE_SIZE = 50

export async function fetchCustomersPage(params: {
  page?: number
  search?: string
  tag?: string
  brand?: string
  dateFrom?: string
  dateTo?: string
  minSpend?: number
  sortKey?: string
  sortDir?: 'asc' | 'desc'
}): Promise<{ data: CustomerCRM[]; count: number }> {
  const sb = createAdminClient()
  const {
    page = 0,
    search,
    tag,
    brand,
    dateFrom,
    dateTo,
    minSpend,
    sortKey = 'last_order_date',
    sortDir = 'desc',
  } = params

  const validCols = ['last_order_date', 'total_spent', 'total_orders', 'name', 'average_order_value']
  const orderCol  = validCols.includes(sortKey) ? sortKey : 'last_order_date'

  let q = sb.from('customers').select('*', { count: 'exact' })

  if (search) {
    const esc2 = search.replace(/[%_]/g, '\\$&')
    q = q.or(`name.ilike.%${esc2}%,phone.ilike.%${esc2}%`)
  }
  if (tag && tag !== 'all')     q = q.eq('customer_tag', tag)
  if (brand && brand !== 'all') q = q.eq('preferred_brand', brand)
  if (dateFrom)                 q = q.gte('last_order_date', dateFrom)
  if (dateTo)                   q = q.lte('last_order_date', dateTo)
  if (minSpend && minSpend > 0) q = q.gte('total_spent', minSpend)

  q = q.order(orderCol, { ascending: sortDir === 'asc', nullsFirst: false })
  q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  const { data, count, error } = await q
  if (error) throw new Error(error.message)
  return { data: (data ?? []) as CustomerCRM[], count: count ?? 0 }
}

export async function fetchCustomerSummaryStats(): Promise<{
  total: number; newMonth: number; repeat: number; vip: number; dormant: number; lost: number
}> {
  const sb = createAdminClient()
  const d = new Date(); d.setDate(1)
  const monthStr = d.toISOString().split('T')[0]

  const [
    { count: total },
    { count: newMonth },
    { count: repeat },
    { count: vip },
    { count: dormant },
    { count: lost },
  ] = await Promise.all([
    sb.from('customers').select('*', { count: 'exact', head: true }),
    sb.from('customers').select('*', { count: 'exact', head: true }).gte('first_order_date', monthStr),
    sb.from('customers').select('*', { count: 'exact', head: true }).eq('customer_tag', 'Repeat'),
    sb.from('customers').select('*', { count: 'exact', head: true }).eq('customer_tag', 'VIP'),
    sb.from('customers').select('*', { count: 'exact', head: true }).eq('customer_tag', 'Dormant'),
    sb.from('customers').select('*', { count: 'exact', head: true }).eq('customer_tag', 'Lost'),
  ])

  return {
    total: total ?? 0, newMonth: newMonth ?? 0, repeat: repeat ?? 0,
    vip: vip ?? 0, dormant: dormant ?? 0, lost: lost ?? 0,
  }
}

// ─── Customer Remarks ─────────────────────────────────────────────────────────

export async function addCustomerRemark(customerId: string, remark: string): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('customer_remarks')
    .insert({ customer_id: customerId, remark: remark.trim() })
  if (error) throw new Error(error.message)
}

export async function fetchCustomerRemarks(
  customerId: string,
): Promise<{ id: string; remark: string; created_at: string }[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('customer_remarks')
    .select('id, remark, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Change customer tag (manual override) ───────────────────────────────────

export async function changeCustomerTag(customerId: string, tag: CustomerTag): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('customers')
    .update({ customer_tag: tag })
    .eq('id', customerId)
  if (error) throw new Error(error.message)
}

// ─── Bulk SQL tag refresh ─────────────────────────────────────────────────────

export async function refreshAllCustomerTagsSQL(): Promise<{ updated: number }> {
  const sb = createAdminClient()
  const { error } = await sb.rpc('refresh_all_customer_tags')
  if (error) throw new Error(error.message)
  const { count } = await sb.from('customers').select('*', { count: 'exact', head: true })
  return { updated: count ?? 0 }
}

// ─── Tag calculation ──────────────────────────────────────────────────────────

function computeTag(
  totalOrders: number,
  totalSpent: number,
  lastOrderDate: string | null,
  vipSpendThreshold = 2000,
  vipOrderThreshold = 6,
): CustomerTag {
  if (!lastOrderDate || totalOrders === 0) return 'New'
  if (totalOrders >= vipOrderThreshold || totalSpent > vipSpendThreshold) return 'VIP'
  const daysSince = Math.floor(
    (Date.now() - new Date(lastOrderDate + 'T12:00:00').getTime()) / 86_400_000
  )
  if (daysSince > 90) return 'Lost'
  if (daysSince > 30) return 'Dormant'
  if (totalOrders >= 2) return 'Repeat'
  return 'New'
}

// ─── Refresh stats for a single customer ─────────────────────────────────────

export async function refreshCustomerStats(customerId: string): Promise<void> {
  const sb = createAdminClient()

  const { data: orders } = await sb
    .from('orders')
    .select('total_price, order_date, project_id, channel, projects(code)')
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')

  if (!orders || orders.length === 0) {
    await sb
      .from('customers')
      .update({
        total_orders: 0,
        total_spent: 0,
        first_order_date: null,
        last_order_date: null,
        average_order_value: 0,
        customer_tag: 'New',
        preferred_brand: null,
        preferred_platform: null,
      })
      .eq('id', customerId)
    return
  }

  const totalOrders = orders.length
  const totalSpent  = orders.reduce((s, o) => s + Number(o.total_price ?? 0), 0)
  const avgValue    = totalOrders > 0 ? totalSpent / totalOrders : 0

  const sorted        = [...orders].map(o => o.order_date).sort()
  const firstOrderDate = sorted[0] ?? null
  const lastOrderDate  = sorted[sorted.length - 1] ?? null

  // Most frequent brand
  const brandCount: Record<string, number> = {}
  orders.forEach(o => {
    const code = (o.projects as any)?.code
    if (code) brandCount[code] = (brandCount[code] ?? 0) + 1
  })
  const preferredBrand = Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Most frequent platform
  const platCount: Record<string, number> = {}
  orders.forEach(o => {
    if (o.channel) platCount[o.channel] = (platCount[o.channel] ?? 0) + 1
  })
  const preferredPlatform = Object.entries(platCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Determine preferred project for VIP threshold lookup
  const preferredProjectId = Object.entries(
    orders.reduce((acc: Record<string, number>, o) => {
      const pid = o.project_id as string
      if (pid) acc[pid] = (acc[pid] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Fetch brand settings for VIP thresholds
  let vipSpendThreshold = 2000
  let vipOrderThreshold = 6
  if (preferredProjectId) {
    const { data: bSettings } = await sb
      .from('brand_settings')
      .select('vip_spend_threshold, vip_order_threshold')
      .eq('project_id', preferredProjectId)
      .single()
    if (bSettings) {
      vipSpendThreshold = Number(bSettings.vip_spend_threshold ?? 2000)
      vipOrderThreshold = Number(bSettings.vip_order_threshold ?? 6)
    }
  }

  const customerTag = computeTag(totalOrders, totalSpent, lastOrderDate, vipSpendThreshold, vipOrderThreshold)

  await sb
    .from('customers')
    .update({
      total_orders: totalOrders,
      total_spent: totalSpent,
      first_order_date: firstOrderDate,
      last_order_date: lastOrderDate,
      average_order_value: avgValue,
      customer_tag: customerTag,
      preferred_brand: preferredBrand,
      preferred_platform: preferredPlatform,
    })
    .eq('id', customerId)
}

// ─── Bulk refresh (all customers) ────────────────────────────────────────────

export async function refreshAllCustomerStats(): Promise<{ updated: number }> {
  const sb = createAdminClient()
  const { data: customers } = await sb.from('customers').select('id')
  if (!customers?.length) return { updated: 0 }

  let updated = 0
  for (const c of customers) {
    try {
      await refreshCustomerStats(c.id)
      updated++
    } catch { /* continue with others */ }
  }
  return { updated }
}

// ─── Set follow-up ────────────────────────────────────────────────────────────

export async function setFollowUp(
  customerId: string,
  followUpDate: string,
  followUpNote: string,
): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('customers')
    .update({
      follow_up_date: followUpDate || null,
      follow_up_note: followUpNote || null,
    })
    .eq('id', customerId)
  if (error) throw new Error(error.message)
}

// ─── Mark as contacted ────────────────────────────────────────────────────────

export async function markContacted(customerId: string): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('customers')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', customerId)
  if (error) throw new Error(error.message)
}

// ─── Update notes ─────────────────────────────────────────────────────────────

export async function updateCustomerNotes(customerId: string, notes: string): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('customers')
    .update({ notes: notes || null })
    .eq('id', customerId)
  if (error) throw new Error(error.message)
}
