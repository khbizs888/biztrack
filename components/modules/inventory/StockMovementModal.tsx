'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const BRANDS = ['FIOR', 'NE', 'DD', 'KHH', 'Juji']
const MOVEMENT_TYPES = ['Stock In', 'Stock Out', 'Adjustment']

interface Component {
  json_key: string
  display_name: string
  unit: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  preselectedBrand?: string | null
  preselectedComponent?: string | null
}

const today = () => new Date().toISOString().slice(0, 10)

export default function StockMovementModal({
  open, onClose, onSaved, preselectedBrand, preselectedComponent,
}: Props) {
  const [components, setComponents] = useState<Component[]>([])
  const [form, setForm] = useState({
    brand: '', component_key: '__none__', type: 'Stock In',
    quantity: '', reference: '', notes: '', date: today(),
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const brand = preselectedBrand ?? ''
      const component_key = preselectedComponent ?? '__none__'
      setForm({ brand, component_key, type: 'Stock In', quantity: '', reference: '', notes: '', date: today() })
      if (brand) loadComponents(brand)
      else setComponents([])
    }
  }, [open, preselectedBrand, preselectedComponent])

  async function loadComponents(brand: string) {
    const { data } = await createClient()
      .from('component_registry')
      .select('json_key, display_name, unit')
      .eq('brand', brand)
      .order('display_name')
    setComponents(data ?? [])
  }

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function handleBrandChange(brand: string) {
    setForm(f => ({ ...f, brand, component_key: '__none__' }))
    loadComponents(brand)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brand || form.component_key === '__none__' || !form.quantity) {
      toast.error('Brand, Component and Quantity are required')
      return
    }
    const qty = parseInt(form.quantity, 10)
    if (isNaN(qty) || qty === 0) {
      toast.error('Quantity must be a non-zero integer')
      return
    }
    setSaving(true)
    try {
      const { error } = await createClient().from('inventory').insert({
        brand:         form.brand,
        component_key: form.component_key,
        type:          form.type,
        quantity:      qty,
        reference:     form.reference.trim() || null,
        notes:         form.notes.trim() || null,
        date:          form.date,
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

  const selectedComponent = components.find(c => c.json_key === form.component_key)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Stock Movement</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Brand */}
          <div className="space-y-1.5">
            <Label>Brand *</Label>
            <Select value={form.brand || '__none__'} onValueChange={v => handleBrandChange(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select brand…</SelectItem>
                {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Component */}
          <div className="space-y-1.5">
            <Label>Component *</Label>
            <Select
              value={form.component_key}
              onValueChange={v => set('component_key', v)}
              disabled={!form.brand || components.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={form.brand ? 'Select component' : 'Pick brand first'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select component…</SelectItem>
                {components.map(c => (
                  <SelectItem key={c.json_key} value={c.json_key}>
                    {c.display_name} <span className="text-muted-foreground">({c.unit})</span>
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
              <Label>
                Quantity *
                {selectedComponent && (
                  <span className="text-muted-foreground font-normal ml-1">({selectedComponent.unit})</span>
                )}
              </Label>
              <Input
                type="number" min="-9999" value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                placeholder={form.type === 'Adjustment' ? 'e.g. -5 or +10' : 'Amount'}
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
