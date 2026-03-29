'use client'

import { useState } from 'react'
import { useOrders } from '@/lib/hooks/useOrders'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, ShoppingCart, Download } from 'lucide-react'
import type { OrderStatus, OrderFilters } from '@/lib/types'
import AddOrderModal from '@/components/modules/orders/AddOrderModal'
import OrderActions from '@/components/modules/orders/OrderActions'

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'warning',
  processing: 'info',
  shipped: 'secondary',
  delivered: 'success',
  cancelled: 'destructive',
}

export default function OrdersPage() {
  const supabase = createClient()
  const [filters, setFilters] = useState<OrderFilters>({ page: 1, pageSize: 25 })
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const { data, isLoading, error } = useOrders(filters)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').order('name')
      return data ?? []
    },
  })

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFilters(f => ({ ...f, search, page: 1 }))
  }

  function exportCSV() {
    if (!data?.data) return
    const rows = data.data.map(o => [
      formatDate(o.order_date),
      (o.customers as any)?.name ?? '',
      (o.customers as any)?.phone ?? '',
      o.product_name,
      o.package_name ?? '',
      o.total_price,
      o.status,
    ])
    const header = 'Date,Customer,Phone,Product,Package,Amount,Status\n'
    const csv = header + rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'orders.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = data ? Math.ceil(data.count / (filters.pageSize ?? 25)) : 0

  return (
    <div>
      <PageHeader title="Orders" description={`${data?.count ?? 0} total orders`}>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
        <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4 mr-1" />Add Order</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            placeholder="Search customer or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64"
          />
          <Button type="submit" size="sm" variant="outline"><Search className="h-4 w-4" /></Button>
        </form>

        <Select value={filters.status ?? 'all'} onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? undefined : v as OrderStatus, page: 1 }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {(['pending','processing','shipped','delivered','cancelled'] as OrderStatus[]).map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.projectId ?? 'all'} onValueChange={v => setFilters(f => ({ ...f, projectId: v === 'all' ? undefined : v, page: 1 }))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input type="date" className="w-40" onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))} />
        <Input type="date" className="w-40" onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))} />
      </div>

      {isLoading ? <LoadingState /> : error ? (
        <p className="text-destructive text-sm">Failed to load orders.</p>
      ) : !data?.data.length ? (
        <EmptyState icon={ShoppingCart} title="No orders found" description="Add your first order to get started." action={{ label: 'Add Order', onClick: () => setShowAddModal(true) }} />
      ) : (
        <>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="text-sm">{formatDate(order.order_date)}</TableCell>
                    <TableCell className="font-medium">{(order.customers as any)?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(order.customers as any)?.phone ?? '—'}</TableCell>
                    <TableCell className="text-sm">{order.product_name}</TableCell>
                    <TableCell className="text-sm">{order.package_name ?? '—'}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(Number(order.total_price))}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[order.status] as any} className="capitalize">{order.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderActions order={order} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Page {filters.page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={(filters.page ?? 1) >= totalPages} onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}>Next</Button>
            </div>
          </div>
        </>
      )}

      <AddOrderModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  )
}
