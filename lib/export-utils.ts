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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(cell).join(',')
}

function downloadCSV(csv: string, filename: string): void {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function getOrderNotes(order: Order): string {
  return (order as any).remark ?? order.purchase_reason ?? ''
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Format A: KHH & FIOR ─────────────────────────────────────────────────────

export function exportKHHFIOR(orders: OrderWithDetails[], brand: string, filename?: string): void {
  const headers = [
    '线上单号', '店铺', '付款时间', '买家ID', '收件人姓名', '收件人手机号吗',
    '收件人电子邮箱', '收件人地址 1', '收件人地址2', '收件人区/县', '收件人城市',
    '收件人省/州', '收件人国家', '收件人邮箱', '运费', '商品编码', '商品标题',
    '商品颜色', '商品尺寸', '商品数量', '商品单价', '商品税金', '付款方式',
    '代收货款金额', '币种', '留言', '备注', 'SourceID', 'Parent items 2', 'Parent items 3',
  ]

  const rows = orders.map(o => {
    const c = o.customers
    const isCod = o.is_cod ?? false
    const salePrice = Number(o.total_price)
    return csvRow([
      o.tracking_number ?? o.id,                    // 线上单号
      '',                                            // 店铺
      o.order_date,                                  // 付款时间
      '',                                            // 买家ID
      c?.name ?? '',                                 // 收件人姓名
      c?.phone ?? '',                                // 收件人手机号吗
      '',                                            // 收件人电子邮箱
      c?.address ?? '',                              // 收件人地址 1
      '',                                            // 收件人地址2
      '',                                            // 收件人区/县
      o.state ?? '',                                 // 收件人城市
      o.state ?? '',                                 // 收件人省/州
      'MY',                                          // 收件人国家
      '',                                            // 收件人邮箱
      '',                                            // 运费
      o.package_snapshot?.name ?? o.package_name ?? '', // 商品编码
      '',                                            // 商品标题
      '',                                            // 商品颜色
      '',                                            // 商品尺寸
      1,                                             // 商品数量
      salePrice,                                     // 商品单价
      '',                                            // 商品税金
      isCod ? 'COD' : '在线支付',                   // 付款方式
      isCod ? salePrice : '',                        // 代收货款金额
      'MYR',                                         // 币种
      getOrderNotes(o),                              // 留言
      '',                                            // 备注
      '',                                            // SourceID
      '',                                            // Parent items 2
      '',                                            // Parent items 3
    ])
  })

  const csv = [csvRow(headers), ...rows].join('\n')
  downloadCSV(csv, filename ?? `${brand}_orders_${todayStr()}.csv`)
}

// ─── Format B: DD, NE, Juji ───────────────────────────────────────────────────

export function exportDDNEJuji(orders: OrderWithDetails[], brand: string, filename?: string): void {
  const headers = [
    'Order No', 'Project', 'Shopee Order No', 'Unique Id', 'Order Date',
    'Receiver Name', 'Full Phone No', 'Address Line 1', 'Postal Code', 'City', 'State',
    'Grand Total', 'Payment Method', 'Remark', 'Receipt',
  ]

  const rows = orders.map(o => {
    const c = o.customers
    const isCod = o.is_cod ?? false
    const projectName = o.projects?.name ?? brand
    return csvRow([
      o.tracking_number ?? o.id,    // Order No
      projectName,                   // Project
      '',                            // Shopee Order No
      '',                            // Unique Id
      o.order_date,                  // Order Date
      c?.name ?? '',                 // Receiver Name
      c?.phone ?? '',                // Full Phone No
      c?.address ?? '',              // Address Line 1
      '',                            // Postal Code
      o.state ?? '',                 // City
      o.state ?? '',                 // State
      Number(o.total_price),         // Grand Total
      isCod ? 'COD' : 'Bank Transfer', // Payment Method
      getOrderNotes(o),              // Remark
      c?.receipt_url ?? '',          // Receipt
    ])
  })

  const csv = [csvRow(headers), ...rows].join('\n')
  downloadCSV(csv, filename ?? `${brand}_orders_${todayStr()}.csv`)
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
