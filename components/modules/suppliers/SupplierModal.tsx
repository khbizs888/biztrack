'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  supplier?: any | null
}

const EMPTY = {
  name: '', contact_person: '', phone: '', email: '',
  products_supplied: '', lead_time_days: '', payment_terms: '', notes: '', status: 'Active',
}

export default function SupplierModal({ open, onClose, onSaved, supplier }: Props) {
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(supplier ? {
        name:              supplier.name ?? '',
        contact_person:    supplier.contact_person ?? '',
        phone:             supplier.phone ?? '',
        email:             supplier.email ?? '',
        products_supplied: supplier.products_supplied ?? '',
        lead_time_days:    supplier.lead_time_days?.toString() ?? '',
        payment_terms:     supplier.payment_terms ?? '',
        notes:             supplier.notes ?? '',
        status:            supplier.status ?? 'Active',
      } : EMPTY)
    }
  }, [open, supplier])

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const payload: Record<string, any> = {
        name:              form.name.trim(),
        contact_person:    form.contact_person.trim() || null,
        phone:             form.phone.trim() || null,
        email:             form.email.trim() || null,
        products_supplied: form.products_supplied.trim(),
        lead_time_days:    form.lead_time_days ? parseInt(form.lead_time_days, 10) : null,
        payment_terms:     form.payment_terms.trim() || null,
        notes:             form.notes.trim() || null,
        status:            form.status,
      }
      if (supplier) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id)
        if (error) throw error
        toast.success('Supplier updated')
      } else {
        const { error } = await supabase.from('suppliers').insert(payload)
        if (error) throw error
        toast.success('Supplier added')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Supplier Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Company name" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+60..." />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="supplier@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Products Supplied</Label>
            <Input value={form.products_supplied} onChange={e => set('products_supplied', e.target.value)}
              placeholder="e.g. Collagen powder, Vitamin C capsules" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lead Time (days)</Label>
              <Input type="number" min="0" value={form.lead_time_days}
                onChange={e => set('lead_time_days', e.target.value)} placeholder="e.g. 14" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}
                placeholder="e.g. Net 30, COD" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Supplier'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
