'use client'

import { useState } from 'react'
import { useOrders } from '@/lib/hooks/useOrders'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, ShoppingCart, FileDown, FileUp } from 'lucide-react'
import type { OrderFilters } from '@/lib/types'
import AddOrderModal from '@/components/modules/orders/AddOrderModal'
import ImportOrdersModal from '@/components/modules/orders/ImportOrdersModal'
import OrderActions from '@/components/modules/orders/OrderActions'

export default function OrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>({ page: 1, pageSize: 50 })
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  const { data, isLoading, error } = useOrders(filters)

  const totalPages = data ? Math.ceil(data.count / (filters.pageSize ?? 50)) : 0

  function exportCSV() {
    if (!data?.data) return
    const rows = data.data.map(o => [
      formatDate(o.order_date),
      (o.customers as any)?.name ?? '',
      (o.customers as any)?.phone ?? '',
      (o.customers as any)?.address ?? '',
      o.package_name ?? '',
      o.is_new_customer === false ? 'Repeat' : 'New',
      o.total_price,
    ])
    const header = 'Date,Customer Name,No. Tel,Address,Package,New/Repeat,Total Price\n'
    const csv = header + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'orders.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader title="Daily Order" description={`${data?.count ?? 0} total orders`}>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <FileDown className="h-4 w-4 mr-1" />Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
          <FileUp className="h-4 w-4 mr-1" />Import Excel/CSV
        </Button>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1" />Add Order
        </Button>
      </PageHeader>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load orders.</p>
      ) : !data?.data.length ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="Add your first order to get started."
          action={{ label: 'Add Order', onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>No. Tel</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>New/Repeat</TableHead>
                  <TableHead className="text-right">Total Price</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(order.order_date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {(order.customers as any)?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(order.customers as any)?.phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      {(order.customers as any)?.address ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.package_name ?? '—'}
                    </TableCell>
                    <TableCell>
                      {order.is_new_customer === false ? (
                        <Badge variant="secondary">Repeat</Badge>
                      ) : (
                        <Badge variant="info">New</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(order.total_price))}
                    </TableCell>
                    <TableCell>
                      <OrderActions order={order} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>Page {filters.page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={(filters.page ?? 1) <= 1}
                  onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={(filters.page ?? 1) >= totalPages}
                  onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AddOrderModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <ImportOrdersModal open={showImportModal} onClose={() => setShowImportModal(false)} />
    </div>
  )
}
