'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  eachDayOfInterval, parseISO, format, startOfMonth, endOfMonth,
  differenceInDays, getDaysInMonth, getDate, subDays,
} from 'date-fns'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function safeDivide(n: number, d: number): number {
  return d === 0 ? 0 : n / d
}

function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyAdSpendInput {
  project_id: string
  date: string
  fb_ad_cost_acc1?: number
  fb_ad_cost_acc2?: number
  fb_ad_cost_acc3?: number
  tiktok_ad_cost?: number
  shopee_ad_cost?: number
  fb_messages?: number
  goal_sales?: number
  notes?: string
  source?: 'manual' | 'csv_import' | 'api_meta' | 'api_tiktok' | 'api_shopee'
}

export interface RaceReportRow {
  date: string
  // Raw costs (before SST)
  fb_raw_cost: number
  tiktok_raw_cost: number
  shopee_raw_cost: number
  fb_messages: number
  goal_sales: number
  // After SST (×1.08)
  fb_cost: number
  tiktok_cost: number
  shopee_cost: number
  total_ad_spend: number
  // Facebook
  fb_new_orders: number
  fb_repeat_orders: number
  fb_new_sales: number
  fb_repeat_sales: number
  fb_total_sales: number
  // TikTok
  tiktok_new_orders: number
  tiktok_repeat_orders: number
  tiktok_new_sales: number
  tiktok_repeat_sales: number
  tiktok_total_sales: number
  // Shopee
  shopee_new_orders: number
  shopee_repeat_orders: number
  shopee_new_sales: number
  shopee_repeat_sales: number
  shopee_total_sales: number
  // Totals
  total_new_orders: number
  total_repeat_orders: number
  total_new_sales: number
  total_repeat_sales: number
  total_sales: number
  total_orders: number
  // Calculated metrics
  fb_roas: number
  tiktok_roas: number
  shopee_roas: number
  total_roas: number
  cost_per_message: number
  cost_per_purchase: number
  new_order_rate: number
  aov: number
  new_aov: number
  repeat_aov: number
}

export interface SalesOverviewData {
  bookSales: number
  settleSales: number
  totalProfit: number
  aov: number
  totalOrders: number
  prevBookSales: number
  prevSettleSales: number
  prevProfit: number
  prevAov: number
  prevOrders: number
  byDay: { date: string; revenue: number; orders: number }[]
  byBrand: { name: string; code: string; revenue: number; orders: number }[]
  byPlatform: { platform: string; revenue: number; orders: number }[]
  topPackages: { name: string; revenue: number; orders: number }[]
}

export interface CustomerInsightsData {
  total: number
  newThisMonth: number
  repeatRate: number
  vipCount: number
  dormantCount: number
  byTag: { tag: string; count: number }[]
  newVsRepeatByDay: { date: string; new: number; repeat: number }[]
  top10: { name: string; phone: string; total_orders: number; total_spent: number; tag: string }[]
  followUps: { id: string; name: string; phone: string; follow_up_date: string; follow_up_note: string | null }[]
}

export interface GoalTrackingData {
  totalGoal: number
  accumulated: number
  daysInMonth: number
  currentDay: number
  byDay: { day: number; actual: number; accumulated: number; goal: number }[]
  byBrand: { brand: string; goal: number; accumulated: number; progress: number }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Ad Spend CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function saveAdSpend(data: DailyAdSpendInput): Promise<void> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('daily_ad_spend')
    .upsert(
      { ...data, source: data.source ?? 'manual', updated_at: new Date().toISOString() },
      { onConflict: 'project_id,date' },
    )
  if (error) throw new Error(error.message)
}

export async function batchImportAdSpend(
  rows: DailyAdSpendInput[],
): Promise<{ inserted: number; errors: string[] }> {
  const sb = createAdminClient()
  const errors: string[] = []
  let inserted = 0
  for (const row of rows) {
    const { error } = await sb
      .from('daily_ad_spend')
      .upsert(
        { ...row, source: 'csv_import', updated_at: new Date().toISOString() },
        { onConflict: 'project_id,date' },
      )
    if (error) errors.push(`${row.date}: ${error.message}`)
    else inserted++
  }
  return { inserted, errors }
}

export async function fetchRawAdSpend(
  projectId: string,
  dateFrom: string,
  dateTo: string,
): Promise<DailyAdSpendInput[]> {
  const sb = createAdminClient()
  let q = sb
    .from('daily_ad_spend')
    .select('*')
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return plain(data ?? [])
}

// ─────────────────────────────────────────────────────────────────────────────
// Race Report (live computation from daily_ad_spend + orders)
// ─────────────────────────────────────────────────────────────────────────────

export async function computeRaceReport(
  projectId: string,
  dateFrom: string,
  dateTo: string,
): Promise<RaceReportRow[]> {
  const sb = createAdminClient()

  // Fetch ad spend rows
  let adQ = sb
    .from('daily_ad_spend')
    .select('*')
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true })
  if (projectId) adQ = adQ.eq('project_id', projectId)
  const { data: adRows, error: adErr } = await adQ
  if (adErr) throw new Error(adErr.message)

  // Fetch orders (non-cancelled)
  let ordQ = sb
    .from('orders')
    .select('order_date, total_price, channel, is_new_customer')
    .gte('order_date', dateFrom)
    .lte('order_date', dateTo)
    .neq('status', 'cancelled')
  if (projectId) ordQ = ordQ.eq('project_id', projectId)
  const { data: orders, error: ordErr } = await ordQ
  if (ordErr) throw new Error(ordErr.message)

  type OrderRow = { order_date: string; total_price: number; channel: string | null; is_new_customer: boolean | null }

  // Group ad spend by date (aggregate if multiple projects for All Brands)
  const adByDate: Record<string, {
    fb1: number; fb2: number; fb3: number
    tiktok: number; shopee: number; messages: number; goal: number
  }> = {}
  for (const row of adRows ?? []) {
    const d = row.date
    if (!adByDate[d]) adByDate[d] = { fb1: 0, fb2: 0, fb3: 0, tiktok: 0, shopee: 0, messages: 0, goal: 0 }
    adByDate[d].fb1 += Number(row.fb_ad_cost_acc1 ?? 0)
    adByDate[d].fb2 += Number(row.fb_ad_cost_acc2 ?? 0)
    adByDate[d].fb3 += Number(row.fb_ad_cost_acc3 ?? 0)
    adByDate[d].tiktok += Number(row.tiktok_ad_cost ?? 0)
    adByDate[d].shopee += Number(row.shopee_ad_cost ?? 0)
    adByDate[d].messages += Number(row.fb_messages ?? 0)
    adByDate[d].goal += Number(row.goal_sales ?? 0)
  }

  // Group orders by date
  const ordByDate: Record<string, OrderRow[]> = {}
  for (const o of orders ?? []) {
    if (!ordByDate[o.order_date]) ordByDate[o.order_date] = []
    ordByDate[o.order_date].push(o as OrderRow)
  }

  const FB_CHANNELS = ['Facebook']
  const TT_CHANNELS = ['TikTok', 'Xiaohongshu']
  const SHOP_CHANNELS = ['Shopee', 'Lazada']

  const result: RaceReportRow[] = Object.entries(adByDate).map(([date, spend]) => {
    const dayOrders = ordByDate[date] ?? []

    const fbOrds = dayOrders.filter(o => FB_CHANNELS.includes(o.channel ?? ''))
    const ttOrds = dayOrders.filter(o => TT_CHANNELS.includes(o.channel ?? ''))
    const shopOrds = dayOrders.filter(o => SHOP_CHANNELS.includes(o.channel ?? ''))

    const sum = (arr: OrderRow[]) => arr.reduce((s, o) => s + Number(o.total_price), 0)
    const newOf = (arr: OrderRow[]) => arr.filter(o => o.is_new_customer)
    const repOf = (arr: OrderRow[]) => arr.filter(o => !o.is_new_customer)

    const fbNew = newOf(fbOrds); const fbRep = repOf(fbOrds)
    const ttNew = newOf(ttOrds); const ttRep = repOf(ttOrds)
    const shNew = newOf(shopOrds); const shRep = repOf(shopOrds)
    const allNew = newOf(dayOrders); const allRep = repOf(dayOrders)

    const fb_new_sales = sum(fbNew); const fb_repeat_sales = sum(fbRep)
    const tiktok_new_sales = sum(ttNew); const tiktok_repeat_sales = sum(ttRep)
    const shopee_new_sales = sum(shNew); const shopee_repeat_sales = sum(shRep)
    const total_new_sales = sum(allNew); const total_repeat_sales = sum(allRep)

    const fb_total_sales = fb_new_sales + fb_repeat_sales
    const tiktok_total_sales = tiktok_new_sales + tiktok_repeat_sales
    const shopee_total_sales = shopee_new_sales + shopee_repeat_sales
    const total_sales = total_new_sales + total_repeat_sales
    const total_orders = dayOrders.length

    const fb_raw_cost = spend.fb1 + spend.fb2 + spend.fb3
    const fb_cost = fb_raw_cost * 1.08
    const tiktok_cost = spend.tiktok * 1.08
    const shopee_cost = spend.shopee * 1.08
    const total_ad_spend = fb_cost + tiktok_cost + shopee_cost

    return {
      date,
      fb_raw_cost, tiktok_raw_cost: spend.tiktok, shopee_raw_cost: spend.shopee,
      fb_messages: spend.messages, goal_sales: spend.goal,
      fb_cost, tiktok_cost, shopee_cost, total_ad_spend,
      fb_new_orders: fbNew.length, fb_repeat_orders: fbRep.length, fb_new_sales, fb_repeat_sales, fb_total_sales,
      tiktok_new_orders: ttNew.length, tiktok_repeat_orders: ttRep.length, tiktok_new_sales, tiktok_repeat_sales, tiktok_total_sales,
      shopee_new_orders: shNew.length, shopee_repeat_orders: shRep.length, shopee_new_sales, shopee_repeat_sales, shopee_total_sales,
      total_new_orders: allNew.length, total_repeat_orders: allRep.length,
      total_new_sales, total_repeat_sales, total_sales, total_orders,
      fb_roas: safeDivide(fb_total_sales, fb_cost),
      tiktok_roas: safeDivide(tiktok_total_sales, tiktok_cost),
      shopee_roas: safeDivide(shopee_total_sales, shopee_cost),
      total_roas: safeDivide(total_sales, total_ad_spend),
      cost_per_message: safeDivide(fb_cost, spend.messages),
      cost_per_purchase: safeDivide(total_ad_spend, total_orders),
      new_order_rate: safeDivide(allNew.length, total_orders),
      aov: safeDivide(total_sales, total_orders),
      new_aov: safeDivide(total_new_sales, allNew.length),
      repeat_aov: safeDivide(total_repeat_sales, allRep.length),
    }
  })

  result.sort((a, b) => a.date.localeCompare(b.date))
  return plain(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Overview
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSalesOverview(
  projectId: string,
  dateFrom: string,
  dateTo: string,
): Promise<SalesOverviewData> {
  const sb = createAdminClient()

  // Compute previous period (same length, directly before)
  const from = parseISO(dateFrom)
  const to = parseISO(dateTo)
  const span = differenceInDays(to, from) + 1
  const prevFrom = format(subDays(from, span), 'yyyy-MM-dd')
  const prevTo = format(subDays(from, 1), 'yyyy-MM-dd')

  async function fetchOrders(dFrom: string, dTo: string) {
    let q = sb
      .from('orders')
      .select('order_date, total_price, profit, payment_status, status, delivery_status, channel, is_new_customer, package_name, projects(name, code)')
      .gte('order_date', dFrom)
      .lte('order_date', dTo)
      .neq('status', 'cancelled')
    if (projectId) q = q.eq('project_id', projectId)
    const { data } = await q
    return data ?? []
  }

  const [current, prev] = await Promise.all([
    fetchOrders(dateFrom, dateTo),
    fetchOrders(prevFrom, prevTo),
  ])

  const calcMetrics = (rows: typeof current) => {
    const bookSales = rows.reduce((s, o) => s + Number(o.total_price), 0)
    const settleSales = rows
      .filter(o => o.payment_status === 'paid' || o.delivery_status === 'delivered' || o.status === 'delivered')
      .reduce((s, o) => s + Number(o.total_price), 0)
    const totalProfit = rows.reduce((s, o) => s + Number(o.profit ?? 0), 0)
    const totalOrders = rows.length
    return { bookSales, settleSales, totalProfit, aov: safeDivide(bookSales, totalOrders), totalOrders }
  }

  const curr = calcMetrics(current)
  const p = calcMetrics(prev)

  // Daily trend
  const days = eachDayOfInterval({ start: from, end: to })
  const byDay = days.map(d => {
    const key = format(d, 'yyyy-MM-dd')
    const dayOrds = current.filter(o => o.order_date === key)
    return {
      date: format(d, 'dd MMM'),
      revenue: dayOrds.reduce((s, o) => s + Number(o.total_price), 0),
      orders: dayOrds.length,
    }
  })

  // By brand
  const brandMap: Record<string, { name: string; code: string; revenue: number; orders: number }> = {}
  for (const o of current) {
    const proj = o.projects as unknown as { name: string; code: string } | null
    const code = proj?.code ?? 'Unknown'
    const name = proj?.name ?? 'Unknown'
    if (!brandMap[code]) brandMap[code] = { name, code, revenue: 0, orders: 0 }
    brandMap[code].revenue += Number(o.total_price)
    brandMap[code].orders++
  }

  // By platform
  const platMap: Record<string, { revenue: number; orders: number }> = {}
  for (const o of current) {
    const ch = o.channel ?? 'Other'
    if (!platMap[ch]) platMap[ch] = { revenue: 0, orders: 0 }
    platMap[ch].revenue += Number(o.total_price)
    platMap[ch].orders++
  }

  // Top packages
  const pkgMap: Record<string, { revenue: number; orders: number }> = {}
  for (const o of current) {
    const name = o.package_name ?? 'Unknown'
    if (!pkgMap[name]) pkgMap[name] = { revenue: 0, orders: 0 }
    pkgMap[name].revenue += Number(o.total_price)
    pkgMap[name].orders++
  }
  const topPackages = Object.entries(pkgMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return plain({
    ...curr,
    prevBookSales: p.bookSales,
    prevSettleSales: p.settleSales,
    prevProfit: p.totalProfit,
    prevAov: p.aov,
    prevOrders: p.totalOrders,
    byDay,
    byBrand: Object.values(brandMap).sort((a, b) => b.revenue - a.revenue),
    byPlatform: Object.entries(platMap)
      .map(([platform, v]) => ({ platform, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    topPackages,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Insights
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCustomerInsights(
  projectId: string,
  dateFrom: string,
  dateTo: string,
): Promise<CustomerInsightsData> {
  const sb = createAdminClient()

  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

  // ── When a brand is selected, customers must be scoped to those who have
  //    ordered from that project. The customers table has no project_id column,
  //    so we derive the set from the orders table. ──────────────────────────────
  //
  //    We also capture each customer's FIRST order date for THIS brand so that
  //    "New This Month" means "first order with this brand was this month",
  //    not "first order ever was this month".

  let brandCustomerIds: string[] | null = null
  // customerId → earliest order_date for this specific project
  const brandFirstOrderDate: Record<string, string> = {}

  if (projectId) {
    const { data: projOrders } = await sb
      .from('orders')
      .select('customer_id, order_date')
      .eq('project_id', projectId)
      .not('customer_id', 'is', null)
      .order('order_date', { ascending: true })

    for (const o of projOrders ?? []) {
      const cid = o.customer_id as string
      if (!brandFirstOrderDate[cid]) brandFirstOrderDate[cid] = o.order_date
    }
    brandCustomerIds = Object.keys(brandFirstOrderDate)

    // No customers have ever ordered from this brand → return empty result
    if (brandCustomerIds.length === 0) {
      const emptyDays = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) })
      return plain({
        total: 0, newThisMonth: 0, repeatRate: 0, vipCount: 0, dormantCount: 0,
        byTag: [],
        newVsRepeatByDay: emptyDays.map(d => ({ date: format(d, 'dd MMM'), new: 0, repeat: 0 })),
        top10: [],
        followUps: [],
      })
    }
  }

  // ── Fetch customers, scoped to the brand's customer list when filtering ──────
  let custQ = sb
    .from('customers')
    .select('id, name, phone, customer_tag, total_orders, total_spent, first_order_date, follow_up_date, follow_up_note')
    .order('total_spent', { ascending: false })
  if (brandCustomerIds !== null) custQ = custQ.in('id', brandCustomerIds)
  const { data: customers } = await custQ

  // ── Orders in date range for new-vs-repeat trend (already project-scoped) ───
  let ordQ = sb
    .from('orders')
    .select('order_date, is_new_customer')
    .gte('order_date', dateFrom)
    .lte('order_date', dateTo)
    .neq('status', 'cancelled')
  if (projectId) ordQ = ordQ.eq('project_id', projectId)
  const { data: orders } = await ordQ

  const from = parseISO(dateFrom)
  const to = parseISO(dateTo)
  const days = eachDayOfInterval({ start: from, end: to })
  const newVsRepeatByDay = days.map(d => {
    const key = format(d, 'yyyy-MM-dd')
    const dayOrds = orders?.filter(o => o.order_date === key) ?? []
    return {
      date: format(d, 'dd MMM'),
      new: dayOrds.filter(o => o.is_new_customer).length,
      repeat: dayOrds.filter(o => !o.is_new_customer).length,
    }
  })

  const all = customers ?? []
  const total = all.length
  const vipCount = all.filter(c => c.customer_tag === 'VIP').length
  const dormantCount = all.filter(c => c.customer_tag === 'Dormant' || c.customer_tag === 'Lost').length
  const repeatCount = all.filter(c => (c.total_orders ?? 0) >= 2).length

  // "New this month": when brand-filtered, use the customer's first order date
  // with THIS brand; otherwise use their global first_order_date.
  const newThisMonth = projectId
    ? Object.values(brandFirstOrderDate).filter(d => d >= monthStart && d <= monthEnd).length
    : all.filter(c => {
        const fod = c.first_order_date
        return fod && fod >= monthStart && fod <= monthEnd
      }).length

  // Tag breakdown
  const tagMap: Record<string, number> = {}
  for (const c of all) {
    const t = c.customer_tag ?? 'Unknown'
    tagMap[t] = (tagMap[t] ?? 0) + 1
  }
  const byTag = Object.entries(tagMap).map(([tag, count]) => ({ tag, count }))

  // Top 10 customers by spend
  const top10 = all
    .sort((a, b) => Number(b.total_spent ?? 0) - Number(a.total_spent ?? 0))
    .slice(0, 10)
    .map(c => ({
      name: c.name,
      phone: c.phone,
      total_orders: c.total_orders ?? 0,
      total_spent: Number(c.total_spent ?? 0),
      tag: c.customer_tag ?? 'Unknown',
    }))

  // Follow-up reminders due today or overdue
  const todayStr = format(today, 'yyyy-MM-dd')
  const followUps = all
    .filter(c => c.follow_up_date && c.follow_up_date <= todayStr)
    .map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      follow_up_date: c.follow_up_date!,
      follow_up_note: c.follow_up_note,
    }))
    .slice(0, 20)

  return plain({
    total,
    newThisMonth,
    repeatRate: safeDivide(repeatCount, total) * 100,
    vipCount,
    dormantCount,
    byTag,
    newVsRepeatByDay,
    top10,
    followUps,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal Tracking
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchGoalTracking(
  projectId: string,
  yearMonth: string, // 'yyyy-MM'
): Promise<GoalTrackingData> {
  const sb = createAdminClient()
  const monthStart = `${yearMonth}-01`
  const daysInMon = getDaysInMonth(parseISO(monthStart))
  const monthEnd = `${yearMonth}-${String(daysInMon).padStart(2, '0')}`
  const todayDay = Math.min(getDate(new Date()), daysInMon)

  // Ad spend goals for this month
  let adQ = sb
    .from('daily_ad_spend')
    .select('date, goal_sales, project_id, projects(name, code)')
    .gte('date', monthStart)
    .lte('date', monthEnd)
  if (projectId) adQ = adQ.eq('project_id', projectId)
  const { data: adRows } = await adQ

  // Orders for this month
  let ordQ = sb
    .from('orders')
    .select('order_date, total_price, project_id, projects(name, code)')
    .gte('order_date', monthStart)
    .lte('order_date', monthEnd)
    .neq('status', 'cancelled')
  if (projectId) ordQ = ordQ.eq('project_id', projectId)
  const { data: orders } = await ordQ

  // Total goal for the month (sum all daily goals)
  const totalGoal = (adRows ?? []).reduce((s, r) => s + Number(r.goal_sales ?? 0), 0)
  const accumulated = (orders ?? []).reduce((s, o) => s + Number(o.total_price), 0)

  // Daily accumulated chart
  const byDay: { day: number; actual: number; accumulated: number; goal: number }[] = []
  let runningTotal = 0
  for (let d = 1; d <= daysInMon; d++) {
    const dayStr = `${yearMonth}-${String(d).padStart(2, '0')}`
    const dayGoal = (adRows ?? [])
      .filter(r => r.date === dayStr)
      .reduce((s, r) => s + Number(r.goal_sales ?? 0), 0)
    const dayActual = d <= todayDay
      ? (orders ?? []).filter(o => o.order_date === dayStr).reduce((s, o) => s + Number(o.total_price), 0)
      : 0
    runningTotal += d <= todayDay ? dayActual : 0
    byDay.push({ day: d, actual: dayActual, accumulated: runningTotal, goal: totalGoal })
  }

  // Per-brand breakdown
  const brandGoals: Record<string, { goal: number; accumulated: number; brand: string }> = {}
  for (const r of adRows ?? []) {
    const proj = r.projects as unknown as { name: string; code: string } | null
    const code = proj?.code ?? 'Unknown'
    if (!brandGoals[code]) brandGoals[code] = { brand: code, goal: 0, accumulated: 0 }
    brandGoals[code].goal += Number(r.goal_sales ?? 0)
  }
  for (const o of orders ?? []) {
    const proj = o.projects as unknown as { name: string; code: string } | null
    const code = proj?.code ?? 'Unknown'
    if (!brandGoals[code]) brandGoals[code] = { brand: code, goal: 0, accumulated: 0 }
    brandGoals[code].accumulated += Number(o.total_price)
  }

  const byBrand = Object.values(brandGoals).map(b => ({
    ...b,
    progress: safeDivide(b.accumulated, b.goal) * 100,
  }))

  return plain({ totalGoal, accumulated, daysInMonth: daysInMon, currentDay: todayDay, byDay, byBrand })
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders for payment confirmation table
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderForPayment {
  id: string
  order_date: string
  customer_name: string | null
  package_name: string | null
  total_price: number
  channel: string | null
  payment_status: string | null
  is_cod: boolean | null
  delivery_status: string | null
  tracking_number: string | null
  project_code: string | null
}

export async function fetchOrdersForPayment(
  projectId: string,
  dateFrom: string,
  dateTo: string,
): Promise<OrderForPayment[]> {
  const sb = createAdminClient()
  let q = sb
    .from('orders')
    .select('id, order_date, total_price, channel, payment_status, is_cod, delivery_status, tracking_number, package_name, customers(name), projects(code)')
    .gte('order_date', dateFrom)
    .lte('order_date', dateTo)
    .neq('status', 'cancelled')
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return plain(
    (data ?? []).map(o => ({
      id: o.id,
      order_date: o.order_date,
      customer_name: (o.customers as unknown as { name: string } | null)?.name ?? null,
      package_name: o.package_name,
      total_price: Number(o.total_price),
      channel: o.channel,
      payment_status: o.payment_status,
      is_cod: o.is_cod,
      delivery_status: o.delivery_status,
      tracking_number: o.tracking_number,
      project_code: (o.projects as unknown as { code: string } | null)?.code ?? null,
    })),
  )
}
