'use client'

import { useState, useEffect } from 'react'
import type { CustomField } from '@/lib/hooks/useProjects'
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
  projectId: string
  projectCode: string
  customFields?: CustomField[]
  onAdd: (data: {
    name: string
    code: string
    price: number
    notes?: string
    customValues?: Record<string, string>
    product_id?: string
  }) => void
}

export default function AddPackageModal({ open, onClose, projectId, projectCode, customFields = [], onAdd }: Props) {
  const [name, setName]   = useState('')
  const [code, setCode]   = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [productId, setProductId] = useState('__none__')
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<any[]>([])

  // Load products for this project whenever the modal opens
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

  function handleClose() {
    setName(''); setCode(''); setPrice(''); setNotes('')
    setProductId('__none__'); setCustomValues({})
    onClose()
  }

  function setCustomValue(key: string, value: string) {
    setCustomValues(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimName    = name.trim()
    const trimCode    = code.trim().toUpperCase()
    const parsedPrice = parseFloat(price)
    if (!trimName)                             { toast.error('Package name is required'); return }
    if (!trimCode)                             { toast.error('Package code is required'); return }
    if (isNaN(parsedPrice) || parsedPrice < 0) { toast.error('Enter a valid price'); return }

    for (const field of customFields) {
      if (field.required && !customValues[field.key]?.trim()) {
        toast.error(`"${field.label}" is required`)
        return
      }
    }

    onAdd({
      name:         trimName,
      code:         trimCode,
      price:        parsedPrice,
      notes:        notes.trim() || undefined,
      customValues: Object.keys(customValues).length > 0 ? customValues : undefined,
      product_id:   productId !== '__none__' ? productId : undefined,
    })
    toast.success(`Package "${trimName}" added`)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Package</DialogTitle>
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
              <p className="text-xs text-muted-foreground">Links this package to a product from the catalog</p>
            </div>
          )}

          {/* Standard fields */}
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
              placeholder={`e.g. ${projectCode}-BOX-3`}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
            />
            <p className="text-xs text-muted-foreground">e.g. {projectCode}-BOX-3, {projectCode}-SLIM-1</p>
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

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div className="border-t pt-4 space-y-4">
              {customFields.map(field => (
                <div key={field.key} className="space-y-1">
                  <Label>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {field.type === 'boolean' ? (
                    <div className="flex items-center gap-2 h-9">
                      <input
                        type="checkbox"
                        id={`cf-${field.key}`}
                        checked={customValues[field.key] === 'true'}
                        onChange={e => setCustomValue(field.key, e.target.checked ? 'true' : 'false')}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor={`cf-${field.key}`} className="text-sm text-muted-foreground">
                        {customValues[field.key] === 'true' ? 'Yes' : 'No'}
                      </label>
                    </div>
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : 'text'}
                      step={field.type === 'number' ? 'any' : undefined}
                      placeholder={field.defaultValue ?? (field.type === 'number' ? '0' : '')}
                      value={customValues[field.key] ?? ''}
                      onChange={e => setCustomValue(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Add Package</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
