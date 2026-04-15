import * as XLSX from 'xlsx'
import type { Order } from '@/lib/types'

// Orders with resolved customer and project relations
export type OrderWithDetails = Order & {
  customers?: {
    id: string
    name: string
    phone: string | null
    address: string | null
    receipt_url?: string | null
  }
  projects?: { id: string; name: string; code: string }
}

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  preferred_brand: string | null
  customer_tag: string | null
  total_orders: number
  total_spent: number | string
  last_order_date: string | null
  first_order_date: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function getOrderNotes(order: Order): string {
  return (order as any).remark ?? order.purchase_reason ?? ''
}

/** Auto-fit column widths from an array of character-width hints. */
function colWidths(widths: number[]): XLSX.ColInfo[] {
  return widths.map(wch => ({ wch }))
}

// ─── Format A: KHH & FIOR ─────────────────────────────────────────────────────

export function exportKHHFIOR(orders: OrderWithDetails[], brand: string, filename?: string): void {
  const rows = orders.map(o => {
    const c = o.customers
    const isCod = o.is_cod ?? false
    const salePrice = Number(o.total_price)
    return {
      '线上单号':    o.tracking_number ?? o.id,
      '店铺':        '',
      '付款时间':    o.order_date ?? '',
      '买家ID':      '',
      '收件人姓名':  c?.name ?? '',
      '收件人手机号吗': c?.phone ?? '',        // string → SheetJS stores as type 's'
      '收件人电子邮箱': '',
      '收件人地址 1': c?.address ?? '',
      '收件人地址2':  '',
      '收件人区/县':  '',
      '收件人城市':   o.state ?? '',
      '收件人省/州':  o.state ?? '',
      '收件人国家':   'MY',
      '收件人邮箱':   '',
      '运费':         '',
      '商品编码':     o.package_snapshot?.name ?? o.package_name ?? '',
      '商品标题':     '',
      '商品颜色':     '',
      '商品尺寸':     '',
      '商品数量':     1,
      '商品单价':     salePrice,
      '商品税金':     '',
      '付款方式':     isCod ? 'COD' : '在线支付',
      '代收货款金额': isCod ? salePrice : '',
      '币种':         'MYR',
      '留言':         getOrderNotes(o),
      '备注':         '',
      'SourceID':     '',
      'Parent items 2': '',
      'Parent items 3': '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)

  // Force phone column (index 5) cells to text type so Excel won't
  // display long digit strings in scientific notation
  const phoneCol = 5
  rows.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: phoneCol })
    if (ws[addr] && ws[addr].v !== '') {
      ws[addr].t = 's'
      ws[addr].z = '@'
    }
  })

  ws['!cols'] = colWidths([22, 10, 14, 12, 20, 16, 20, 30, 15, 12, 12, 12, 6, 20, 6, 18, 15, 10, 10, 6, 10, 8, 10, 10, 5, 20, 10, 10, 12, 12])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Orders')
  XLSX.writeFile(wb, filename ?? `${brand}_orders_${todayStr()}.xlsx`)
}

// ─── Format B: DD, NE, Juji ───────────────────────────────────────────────────

export function exportDDNEJuji(orders: OrderWithDetails[], brand: string, filename?: string): void {
  const rows = orders.map(o => {
    const c = o.customers
    const isCod = o.is_cod ?? false
    const projectName = o.projects?.name ?? brand
    return {
      'Order No':       o.tracking_number ?? o.id,
      'Project':        projectName,
      'Shopee Order No': '',
      'Unique Id':      '',
      'Order Date':     o.order_date ?? '',
      'Receiver Name':  c?.name ?? '',
      'Full Phone No':  c?.phone ?? '',          // string → type 's'
      'Address Line 1': c?.address ?? '',
      'Postal Code':    '',
      'City':           o.state ?? '',
      'State':          o.state ?? '',
      'Grand Total':    Number(o.total_price),   // number → right-aligned
      'Payment Method': isCod ? 'COD' : 'Bank Transfer',
      'Remark':         getOrderNotes(o),
      'Receipt':        c?.receipt_url ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)

  // Force phone column (index 6) cells to text type
  const phoneCol = 6
  rows.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: phoneCol })
    if (ws[addr] && ws[addr].v !== '') {
      ws[addr].t = 's'
      ws[addr].z = '@'
    }
  })

  ws['!cols'] = colWidths([22, 15, 18, 14, 12, 22, 16, 35, 10, 12, 12, 12, 14, 25, 40])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Orders')
  XLSX.writeFile(wb, filename ?? `${brand}_orders_${todayStr()}.xlsx`)
}

// ─── Customer Insights Export ─────────────────────────────────────────────────

export function exportCustomerInsights(customers: CustomerRow[], brand: string): void {
  const rows = customers.map(c => {
    const spent = Number(c.total_spent ?? 0)
    const orders = Number(c.total_orders ?? 0)
    const tag = c.customer_tag ?? 'Unknown'
    return {
      'Customer Name':        c.name,
      'Phone':                c.phone ?? '',
      'Brand':                c.preferred_brand ?? '',
      'Total Orders':         orders,
      'Total Spent (RM)':     spent,
      'Avg Order Value (RM)': orders > 0 ? Math.round((spent / orders) * 100) / 100 : 0,
      'Last Order Date':      c.last_order_date ?? '',
      'Customer Tag':         tag,
      'VIP Status':           tag === 'VIP' ? 'VIP' : 'Not VIP',
      'Retention Status':     tag === 'Dormant' || tag === 'Lost' ? 'Inactive' : 'Active',
      'Member Since':         c.first_order_date ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)

  // Force phone column (index 1) cells to text type
  rows.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: 1 })
    if (ws[addr] && ws[addr].v !== '') {
      ws[addr].t = 's'
      ws[addr].z = '@'
    }
  })

  ws['!cols'] = colWidths([25, 16, 10, 12, 16, 18, 14, 12, 10, 16, 14])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Customers')
  XLSX.writeFile(wb, `customers_${brand}_${todayStr()}.xlsx`)
}

// ─── Single Customer Export ───────────────────────────────────────────────────

export interface SingleCustomerData {
  id: string
  name: string
  phone: string | null
  preferred_brand: string | null
  preferred_platform: string | null
  customer_tag: string | null
  total_orders: number
  total_spent: number | string
  last_order_date: string | null
  first_order_date: string | null
}

export interface SingleCustomerOrder {
  id: string
  tracking_number: string | null
  order_date: string
  package_snapshot: { name?: string } | null
  package_name: string | null
  channel: string | null
  total_price: number | string
  payment_status: string | null
  is_cod: boolean | null
  delivery_status: string | null
  status: string
  state: string | null
  purchase_reason: string | null
  remark?: string | null
}

export function exportSingleCustomer(
  customer: SingleCustomerData,
  orders: SingleCustomerOrder[],
): void {
  const spent = Number(customer.total_spent ?? 0)
  const ordersCount = Number(customer.total_orders ?? 0)
  const tag = customer.customer_tag ?? 'Unknown'

  // Derive preferred package from order history frequency
  const pkgFreq: Record<string, number> = {}
  orders.forEach(o => {
    const pkg = o.package_snapshot?.name ?? o.package_name ?? ''
    if (pkg) pkgFreq[pkg] = (pkgFreq[pkg] ?? 0) + 1
  })
  const preferredPackage = Object.entries(pkgFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // Preferred channel: use stored value or derive from order history
  const preferredChannel = customer.preferred_platform ?? (() => {
    const chFreq: Record<string, number> = {}
    orders.forEach(o => { if (o.channel) chFreq[o.channel] = (chFreq[o.channel] ?? 0) + 1 })
    return Object.entries(chFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  })()

  const vipStatus = tag === 'VIP' ? 'Active VIP' : 'Not VIP'
  const retentionStatus =
    tag === 'New' || tag === 'Repeat' || tag === 'VIP' ? 'Active' :
    tag === 'Dormant' ? 'At Risk' :
    tag === 'Lost' ? 'Lost' : 'Unknown'

  // ── Sheet 1: Profile (key-value rows) ──────────────────────────────────────
  const profileRows = [
    ['Field',                'Value'],
    ['Customer Name',        customer.name],
    ['Phone',                customer.phone ?? ''],
    ['Brand',                customer.preferred_brand ?? ''],
    ['Member Since',         customer.first_order_date ?? ''],
    ['Customer Tag',         tag],
    ['VIP Status',           vipStatus],
    ['Total Orders',         ordersCount],
    ['Total Spent (RM)',     spent],
    ['Avg Order Value (RM)', ordersCount > 0 ? Math.round((spent / ordersCount) * 100) / 100 : 0],
    ['Last Order Date',      customer.last_order_date ?? ''],
    ['Retention Status',     retentionStatus],
    ['Preferred Package',    preferredPackage],
    ['Preferred Channel',    preferredChannel || '—'],
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(profileRows)
  // Force phone cell (B3, row index 2) to text
  if (ws1['B3'] && ws1['B3'].v !== '') { ws1['B3'].t = 's'; ws1['B3'].z = '@' }
  ws1['!cols'] = colWidths([25, 30])

  // ── Sheet 2: Order History ─────────────────────────────────────────────────
  const orderRows = orders.map(o => ({
    'Order ID':        o.tracking_number ?? o.id,
    'Order Date':      o.order_date ?? '',
    'Package':         o.package_snapshot?.name ?? o.package_name ?? '',
    'Channel':         o.channel ?? '',
    'Sale Price (RM)': Number(o.total_price),
    'Payment':         o.is_cod ? 'COD' : (o.payment_status ?? 'Bank Transfer'),
    'Delivery':        o.delivery_status ?? o.status ?? '',
    'State':           o.state ?? '',
    'Notes':           (o as any).remark ?? o.purchase_reason ?? '',
  }))

  const ws2 = orderRows.length > 0
    ? XLSX.utils.json_to_sheet(orderRows)
    : XLSX.utils.aoa_to_sheet([['Order ID', 'Order Date', 'Package', 'Channel', 'Sale Price (RM)', 'Payment', 'Delivery', 'State', 'Notes']])
  ws2['!cols'] = colWidths([22, 12, 22, 14, 14, 14, 14, 12, 30])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Profile')
  XLSX.utils.book_append_sheet(wb, ws2, 'Order History')

  const safeName = customer.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
  const brand = customer.preferred_brand ?? 'all'
  XLSX.writeFile(wb, `${brand}_${safeName}_${todayStr()}.xlsx`)
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const KHH_FIOR_BRANDS = ['KHH', 'FIOR']

export function exportOrders(orders: OrderWithDetails[], brand: string, filename?: string): void {
  if (KHH_FIOR_BRANDS.includes(brand)) {
    exportKHHFIOR(orders, brand, filename)
  } else {
    exportDDNEJuji(orders, brand, filename)
  }
}
