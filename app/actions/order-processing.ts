'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { refreshCustomerStats } from '@/app/actions/customer-crm'

// ─────────────────────────────────────────────
// Main processOrder action
// ─────────────────────────────────────────────

export async function processOrder(orderId: string): Promise<{ success: boolean; error?: string; order?: Record<string, unknown> }> {
  try {
    const supabase = createAdminClient()

    // 1. Fetch order with package
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*, packages(*)')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) return { success: false, error: 'Order not found' }

    const pkg = order.packages as Record<string, unknown> | null
    const updates: Record<string, unknown> = {}

    // 2. Set project_id from package
    if (!order.project_id && pkg?.project_id) {
      updates.project_id = pkg.project_id
    }

    // 3. Create package_snapshot
    if (!order.package_snapshot && pkg) {
      updates.package_snapshot = {
        name: pkg.name,
        price: pkg.price,
        code: pkg.code,
        custom_attributes: pkg.custom_attributes,
      }
    }

    // 4. Set cost_price from package (packages don't have a `cost` column yet,
    //    so we use 0 as a safe default — the field can be edited manually later)
    if (order.cost_price === 0 || order.cost_price === null) {
      const pkgCost = (pkg as Record<string, unknown> | null)?.cost
      updates.cost_price = typeof pkgCost === 'number' ? pkgCost : 0
    }

    // 5. COD logic
    if (order.is_cod === true) {
      updates.payment_status = 'Pending'
    } else if (order.is_cod === false && order.payment_status !== 'Settled') {
      updates.payment_status = 'Settled'
      updates.settled_at = new Date().toISOString()
    }

    // 6. Calculate profit
    const costPrice  = (updates.cost_price  as number) ?? order.cost_price  ?? 0
    const totalPrice = order.total_price    ?? 0
    const shippingFee = order.shipping_fee  ?? 0
    const handlingFee = order.handling_fee  ?? 0
    updates.profit = Number(totalPrice) - Number(costPrice) - Number(shippingFee) - Number(handlingFee)

    // 7. Inventory deduction (non-blocking)
    const pkgId   = pkg?.id as string | undefined
    const qty     = (order.quantity as number | null) ?? 1
    if (pkgId && qty > 0) {
      try {
        await deductInventoryForOrderInternal(pkgId, qty, supabase)
      } catch (invErr) {
        console.error('Inventory deduction failed (non-blocking):', invErr)
      }
    }

    // 8. Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) return { success: false, error: updateError.message }

    // 9. Refresh customer CRM stats (non-blocking)
    const customerId = order.customer_id as string | null
    if (customerId) {
      try {
        await refreshCustomerStats(customerId)
      } catch (statsErr) {
        console.error('Customer stats refresh failed (non-blocking):', statsErr)
      }
    }

    return { success: true, order: updatedOrder as Record<string, unknown> }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ─────────────────────────────────────────────
// processOrdersBatch — run processOrder for multiple orders
// ─────────────────────────────────────────────

export async function processOrdersBatch(orderIds: string[]): Promise<{
  processed: number
  failed: number
  errors: Array<{ orderId: string; error: string }>
}> {
  let processed = 0
  let failed = 0
  const errors: Array<{ orderId: string; error: string }> = []

  for (const id of orderIds) {
    const result = await processOrder(id)
    if (result.success) {
      processed++
    } else {
      failed++
      errors.push({ orderId: id, error: result.error ?? 'Unknown error' })
    }
  }

  return { processed, failed, errors }
}

// ─────────────────────────────────────────────
// Internal inventory deduction (mirrors data.ts logic)
// Uses the component-based approach from migration 010
// ─────────────────────────────────────────────

async function deductInventoryForOrderInternal(
  packageId: string,
  orderQuantity: number,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  // Fetch package custom_attributes and brand from project name
  const { data: pkg } = await supabase
    .from('packages')
    .select('custom_attributes, projects(name)')
    .eq('id', packageId)
    .single()

  if (!pkg) return

  const brand = ((pkg.projects as unknown) as Record<string, unknown> | null)?.name as string | undefined
  if (!brand) return

  const attrs = (pkg.custom_attributes ?? {}) as Record<string, string>

  // Get valid component keys for this brand
  const { data: components } = await supabase
    .from('component_registry')
    .select('json_key')
    .eq('brand', brand)

  if (!components?.length) return

  const validKeys = new Set(components.map((c: Record<string, string>) => c.json_key))
  const today = new Date().toISOString().slice(0, 10)

  const deductions = Object.entries(attrs)
    .filter(([key, val]) => validKeys.has(key) && Number(val) > 0)
    .map(([key, val]) => ({
      brand,
      component_key: key,
      type:     'Stock Out',
      quantity: Number(val) * orderQuantity,
      date:     today,
      notes:    'Auto-deducted from order',
    }))

  if (deductions.length > 0) {
    // Best-effort — silently ignore errors so the order is never blocked
    await supabase.from('inventory').insert(deductions)
  }
}
