'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchOrdersForPayment, type OrderForPayment } from '@/app/actions/analytics'
import { confirmPayment, updateCODDeliveryStatus } from '@/app/actions/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle2, Loader2, Truck, RotateCcw, CreditCard, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  dateFrom: string
  dateTo: string
}

type ActionLoading = Record<string, 'deliver' | 'return' | 'confirm'>

function PaymentBadge({ status }: { status: string | null }) {
  if (status === 'Settled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" /> Settled
      </span>
    )
  }
  if (status === 'Failed') {
    return <span className="text-xs text-red-500 font-medium">Failed / Returned</span>
  }
  return <span className="text-xs text-amber-600 font-medium">{status ?? 'Pending'}</span>
}

export default function SalesOrdersTable({ projectId, dateFrom, dateTo }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<ActionLoading>({})
  const [bulkLoading, setBulkLoading] = useState(false)

  const queryKey = ['orders-payment', projectId, dateFrom, dateTo]

  const { data: orders = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchOrdersForPayment(projectId, dateFrom, dateTo),
  })

  // Only pending orders are selectable
  const pendingOrders = useMemo(
    () => orders.filter(o => o.payment_status !== 'Settled' && o.payment_status !== 'Failed'),
    [orders],
  )
  const allPendingSelected = pendingOrders.length > 0 && pendingOrders.every(o => selected.has(o.id))
  const somePendingSelected = pendingOrders.some(o => selected.has(o.id))

  function toggleSelectAll() {
    if (allPendingSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingOrders.map(o => o.id)))
    }
  }

  function toggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey })
    qc.invalidateQueries({ queryKey: ['sales-overview', projectId, dateFrom, dateTo] })
  }

  async function handleDeliver(order: OrderForPayment) {
    setLoading(prev => ({ ...prev, [order.id]: 'deliver' }))
    try {
      const res = await updateCODDeliveryStatus(order.id, 'delivered')
      if (res.success) {
        toast.success('Marked as delivered')
        invalidate()
      } else {
        toast.error(res.error ?? 'Failed')
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setLoading(prev => { const n = { ...prev }; delete n[order.id]; return n })
    }
  }

  async function handleReturn(order: OrderForPayment) {
    setLoading(prev => ({ ...prev, [order.id]: 'return' }))
    try {
      const res = await updateCODDeliveryStatus(order.id, 'returned')
      if (res.success) {
        toast.success('Marked as returned')
        invalidate()
      } else {
        toast.error(res.error ?? 'Failed')
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setLoading(prev => { const n = { ...prev }; delete n[order.id]; return n })
    }
  }

  async function handleConfirm(order: OrderForPayment) {
    setLoading(prev => ({ ...prev, [order.id]: 'confirm' }))
    try {
      await confirmPayment(order.id)
      toast.success('Payment confirmed')
      invalidate()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setLoading(prev => { const n = { ...prev }; delete n[order.id]; return n })
    }
  }

  async function handleBulkConfirm() {
    if (selected.size === 0) return
    setBulkLoading(true)
    const toConfirm = orders.filter(o => selected.has(o.id))
    let ok = 0
    let fail = 0
    for (const order of toConfirm) {
      try {
        if (order.is_cod) {
          const res = await updateCODDeliveryStatus(order.id, 'delivered')
          res.success ? ok++ : fail++
        } else {
          await confirmPayment(order.id)
          ok++
        }
      } catch {
        fail++
      }
    }
    setBulkLoading(false)
    setSelected(new Set())
    invalidate()
    if (fail === 0) {
      toast.success(`${ok} order${ok !== 1 ? 's' : ''} confirmed`)
    } else {
      toast.warning(`${ok} confirmed, ${fail} failed`)
    }
  }

  const settledCount = orders.filter(o => o.payment_status === 'Settled').length
  const pendingCount = pendingOrders.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orders.length} total · {settledCount} settled · {pendingCount} pending
            </p>
          </div>
          {somePendingSelected && (
            <Button
              size="sm"
              onClick={handleBulkConfirm}
              disabled={bulkLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {bulkLoading
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Confirming…</>
                : <><CheckSquare className="h-3.5 w-3.5 mr-1.5" />Bulk Confirm ({selected.size})</>
              }
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No orders for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      ref={el => { if (el) el.indeterminate = somePendingSelected && !allPendingSelected }}
                      onChange={toggleSelectAll}
                      disabled={pendingOrders.length === 0}
                      className="h-3.5 w-3.5 cursor-pointer"
                      title="Select all pending"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Package</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Channel</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const isPending = order.payment_status !== 'Settled' && order.payment_status !== 'Failed'
                  const isChecked = selected.has(order.id)
                  const rowLoading = loading[order.id]

                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        'border-b transition-colors',
                        isChecked
                          ? 'bg-green-50/60'
                          : order.is_cod
                            ? 'bg-amber-50/60 hover:bg-amber-50'
                            : 'hover:bg-muted/30',
                        order.payment_status === 'Settled' && 'opacity-60',
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2">
                        {isPending ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRow(order.id)}
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                        ) : (
                          <span className="block w-3.5" />
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                        {order.order_date}
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-2 max-w-[120px] truncate">
                        {order.customer_name ?? <span className="text-muted-foreground">—</span>}
                      </td>

                      {/* Package */}
                      <td className="px-3 py-2 max-w-[140px] truncate text-muted-foreground">
                        {order.package_name ?? '—'}
                      </td>

                      {/* Channel */}
                      <td className="px-3 py-2 text-muted-foreground">
                        {order.channel ?? '—'}
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(order.total_price)}
                      </td>

                      {/* COD badge */}
                      <td className="px-3 py-2 text-center">
                        {order.is_cod ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                            COD
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200">
                            Online
                          </span>
                        )}
                      </td>

                      {/* Payment status */}
                      <td className="px-3 py-2">
                        <PaymentBadge status={order.payment_status} />
                      </td>

                      {/* Action buttons */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.payment_status === 'Settled' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : order.is_cod ? (
                            <>
                              <button
                                onClick={() => handleDeliver(order)}
                                disabled={!!rowLoading}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                                title="Mark as delivered (settles payment)"
                              >
                                {rowLoading === 'deliver'
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Truck className="h-3 w-3" />
                                }
                                Delivered
                              </button>
                              <button
                                onClick={() => handleReturn(order)}
                                disabled={!!rowLoading}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                                title="Mark as returned"
                              >
                                {rowLoading === 'return'
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <RotateCcw className="h-3 w-3" />
                                }
                                Returned
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleConfirm(order)}
                              disabled={!!rowLoading}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                              title="Confirm payment received"
                            >
                              {rowLoading === 'confirm'
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <CreditCard className="h-3 w-3" />
                              }
                              Confirm Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {orders.length >= 200 && (
              <p className="text-xs text-muted-foreground text-center py-2 border-t">
                Showing first 200 orders. Narrow the date range to see more.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
