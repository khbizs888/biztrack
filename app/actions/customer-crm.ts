'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { CustomerTag } from '@/lib/types'

// ─── Tag calculation ──────────────────────────────────────────────────────────

function computeTag(
  totalOrders: number,
  totalSpent: number,
  lastOrderDate: string | null,
): CustomerTag {
  if (!lastOrderDate || totalOrders === 0) return 'New'
  if (totalOrders >= 5 || totalSpent > 2000) return 'VIP'
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

  const customerTag = computeTag(totalOrders, totalSpent, lastOrderDate)

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
