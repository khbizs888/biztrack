'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const MOVEMENT_TYPES = ['Stock In', 'Stock Out', 'Adjustment']

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  preselectedProduct?: any | null
}

const today = () => new Date().toISOString().slice(0, 10)

export default function StockMovementModal({ open, onClose, onSaved, preselectedProduct }: Props) {
  const [products, setProducts]     = useState<any[]>([])
  const [form, setForm] = useState({
    product_id: '', type: 'Stock In', quantity: '', reference: '', notes: '', date: today(),
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      loadProducts()
      setForm(f => ({
        ...f,
        date:       today(),
        quantity:   '',
        reference:  '',
        notes:      '',
        type:       'Stock In',
        product_id: preselectedProduct?.product_id ?? '',
      }))
    }
  }, [open, preselectedProduct])

  async function loadProducts() {
    const { data } = await createClient()
      .from('products')
      .select('id, sku, name')
      .order('name', { ascending: true })
    setProducts(data ?? [])
  }

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product_id || !form.quantity) {
      toast.error('Product and Quantity are required')
      return
    }
    const qty = parseInt(form.quantity, 10)
    if (isNaN(qty) || qty === 0) {
      toast.error('Quantity must be a non-zero integer')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('inventory').insert({
        product_id: form.product_id,
        type:       form.type,
        quantity:   qty,
        reference:  form.reference.trim() || null,
        notes:      form.notes.trim() || null,
        date:       form.date,
      })
      if (error) throw error
      toast.success('Stock movement recorded')
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to record movement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Stock Movement</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product *</Label>
            <Select value={form.product_id} onValueChange={v => set('product_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Movement Type *</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input
                type="number" min="-9999" value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                placeholder={form.type === 'Adjustment' ? 'e.g. -5 or +10' : 'Units'}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Reference (optional)</Label>
            <Input value={form.reference} onChange={e => set('reference', e.target.value)}
              placeholder="Order ID / PO number" />
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record Movement'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
