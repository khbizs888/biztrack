export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export type CustomerStatus = 'Active' | 'New' | 'At Risk' | 'Lapsed' | 'Churned'

export type AttributeType = 'text' | 'number' | 'boolean' | 'select'

export interface Project {
  id: string
  name: string
  code: string
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  address: string | null
  created_at: string
}

export interface CustomerWithStats extends Customer {
  order_count: number
  total_spend: number
  avg_order_value: number
  first_order_date: string | null
  last_order_date: string | null
  status: CustomerStatus
  project_ids: string[]
}

export interface Order {
  id: string
  customer_id: string | null
  project_id: string | null
  package_id: string | null
  product_name: string
  package_name: string | null
  total_price: number
  status: OrderStatus
  order_date: string
  created_at: string
  fb_name: string | null
  channel: string | null
  purchase_reason: string | null
  is_new_customer: boolean
  customers?: Customer
  projects?: Project
  packages?: Pick<Package, 'id' | 'name' | 'code'>
}

export interface Product {
  id: string
  project_id: string
  sku: string
  name: string
  cost: number
}

export interface Package {
  id: string
  project_id: string
  name: string
  code: string | null
  price: number | null
  custom_attributes: Record<string, unknown>
  is_active: boolean
  sort_order: number
}

export interface PackageItem {
  id: string
  package_id: string
  product_id: string
  quantity: number
}

export interface PackageAttributeSchema {
  id: string
  project_id: string
  attribute_key: string
  attribute_label: string
  attribute_type: AttributeType
  options: string[]
  is_required: boolean
  sort_order: number
  created_at: string
}

export interface PackageBreakdownRow {
  package_name: string
  code: string | null
  units_sold: number
  revenue: number
}

export interface ProjectPnL {
  total_revenue: number
  total_orders: number
  avg_order_value: number
  package_breakdown: PackageBreakdownRow[]
  cost_estimate: {
    shipping: number
    platform_fee: number
    product_cost: number
    total: number
  }
  gross_profit: number
  profit_margin: number
}

export interface Salary {
  id: string
  employee_name: string
  amount: number
  start_date: string
  end_date: string | null
}

export interface Expense {
  id: string
  project_id: string
  type: string
  amount: number
  date: string
  notes: string | null
  projects?: Project
}

export interface DashboardKPIs {
  totalRevenue: number
  totalOrders: number
  newCustomers: number
  netProfit: number
  repeatOrders: number
  avgOrderValue: number
}

export interface PnLData {
  project: Project
  revenue: number
  productCost: number
  shipping: number
  platformFee: number
  marketing: number
  salary: number
  totalCosts: number
  grossProfit: number
  netProfit: number
}

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}

export interface OrderFilters {
  status?: OrderStatus
  projectId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  pageSize?: number
}
