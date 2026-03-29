export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export type CustomerStatus = 'Active' | 'New' | 'At Risk' | 'Lapsed' | 'Churned'

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
  last_order_date: string | null
  status: CustomerStatus
}

export interface Order {
  id: string
  customer_id: string | null
  project_id: string | null
  product_name: string
  package_name: string | null
  total_price: number
  status: OrderStatus
  order_date: string
  created_at: string
  customers?: Customer
  projects?: Project
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
  price: number | null
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
