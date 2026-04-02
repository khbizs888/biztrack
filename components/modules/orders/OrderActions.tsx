'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateOrderStatus, deleteOrder } from '@/app/actions/data'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import type { Order, OrderStatus } from '@/lib/types'

const STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']

export default function OrderActions({ order }: { order: Order }) {
  const queryClient = useQueryClient()
  const [updating, setUpdating] = useState(false)

  async function handleStatusChange(status: string) {
    setUpdating(true)
    try {
      await updateOrderStatus(order.id, status)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Status updated')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this order? This cannot be undone.')) return
    try {
      await deleteOrder(order.id)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Order deleted')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={order.status} onValueChange={handleStatusChange} disabled={updating}>
        <SelectTrigger className="h-7 text-xs w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map(s => (
            <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost" size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
