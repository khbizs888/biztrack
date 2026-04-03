'use client'

import { useState, useEffect } from 'react'
import type { Package } from '@/lib/hooks/useProjects'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  pkg: Package | null
  projectId: string
  onSave: (data: {
    name: string
    code: string
    price: number
    notes?: string
    customValues?: Record<string, string>
    product_id?: string
  }) => void
}

export default function EditPackageModal({ open, onClose, pkg, projectId, onSave }: Props) {
  const [name, setName]         = useState('')
  const [code, setCode]         = useState('')
  const [price, setPrice]       = useState('')
  const [notes, setNotes]       = useState('')
  const [productId, setProductId] = useState('__none__')
  const [products, setProducts] = useState<any[]>([])

  // Load products for this project when modal opens
  useEffect(() => {
    if (open && projectId) {
      createClient()
        .from('products')
        .select('id, sku, name')
        .eq('project_id', projectId)
        .eq('status', 'Active')
        .order('name')
        .then(({ data }) => setProducts(data ?? []))
    }
  }, [open, projectId])

  // Populate form from existing package
  useEffect(() => {
    if (pkg) {
      setName(pkg.name)
      setCode(pkg.code)
      setPrice(String(pkg.price))
      setNotes(pkg.notes ?? '')
      setProductId(pkg.product_id ?? '__none__')
    }
  }, [pkg])

  function handleClose() {
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimName    = name.trim()
    const trimCode    = code.trim().toUpperCase()
    const parsedPrice = parseFloat(price)
    if (!trimName)                             { toast.error('Package name is required'); return }
    if (!trimCode)                             { toast.error('Package code is required'); return }
    if (isNaN(parsedPrice) || parsedPrice < 0) { toast.error('Enter a valid price'); return }
    onSave({
      name:       trimName,
      code:       trimCode,
      price:      parsedPrice,
      notes:      notes.trim() || undefined,
      customValues: pkg?.customValues,
      product_id: productId !== '__none__' ? productId : undefined,
    })
    toast.success('Package updated')
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Package</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product link */}
          {products.length > 0 && (
            <div className="space-y-1">
              <Label>Linked Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional — link to a product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No product linked</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Package Name <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Starter Pack 3 Bulan"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Code <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. FIOR-BOX-3"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-1">
            <Label>Price (RM) <span className="text-red-500">*</span></Label>
            <Input
              type="number" step="0.01" min="0" placeholder="0.00"
              value={price} onChange={e => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input
              placeholder="Optional notes"
              value={notes} onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
