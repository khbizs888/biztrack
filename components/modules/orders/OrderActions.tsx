'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Order, OrderStatus } from '@/lib/types'

interface Props { order: Order }

export default function OrderActions({ order }: Props) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function changeStatus(status: OrderStatus) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
    if (error) { toast.error('Failed to update status'); return }
    toast.success('Status updated')
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }

  async function confirmDelete() {
    setDeleting(true)
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    if (error) { toast.error('Failed to delete order'); setDeleting(false); return }
    toast.success('Order deleted')
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    setDeleteOpen(false)
    setDeleting(false)
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <Select value={order.status} onValueChange={(v) => changeStatus(v as OrderStatus)}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(['pending','processing','shipped','delivered','cancelled'] as OrderStatus[]).map(s => (
            <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Order</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this order? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
