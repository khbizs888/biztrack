'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const CATEGORIES = ['Supplements', 'Skincare', 'Health Drinks', 'Food', 'Other']
const PLATFORMS  = ['Own Website', 'Shopee', 'Lazada', 'TikTok', 'WhatsApp']
const STATUSES   = ['Active', 'Discontinued', 'Coming Soon']

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  product?: any | null
}

const EMPTY = {
  sku: '', name: '', project_id: '__none__', brand: '', category: '',
  unit_cost: '', selling_price: '', weight_g: '',
  platform: [] as string[], status: 'Active', description: '',
}

export default function ProductModal({ open, onClose, onSaved, product }: Props) {
  const [form, setForm]       = useState(EMPTY)
  const [projects, setProjects] = useState<any[]>([])
  const [saving, setSaving]   = useState(false)

  // Load projects for the dropdown
  useEffect(() => {
    if (open) {
      createClient()
        .from('projects')
        .select('id, name, code')
        .order('name')
        .then(({ data }) => setProjects(data ?? []))
    }
  }, [open])

  // Populate form when editing or reset when adding
  useEffect(() => {
    if (open) {
      setForm(product ? {
        sku:           product.sku ?? '',
        name:          product.name ?? '',
        project_id:    product.project_id ?? '__none__',
        brand:         product.brand ?? '',
        category:      product.category ?? '',
        unit_cost:     product.unit_cost?.toString() ?? '',
        selling_price: product.selling_price?.toString() ?? '',
        weight_g:      product.weight_g?.toString() ?? '',
        platform:      Array.isArray(product.platform) ? product.platform : [],
        status:        product.status ?? 'Active',
        description:   product.description ?? '',
      } : EMPTY)
    }
  }, [open, product])

  function handleProjectChange(projectId: string) {
    if (projectId === '__none__') {
      setForm(f => ({ ...f, project_id: '__none__' }))
      return
    }
    const proj = projects.find(p => p.id === projectId)
    setForm(f => ({ ...f, project_id: projectId, brand: proj?.name ?? f.brand }))
  }

  function togglePlatform(p: string) {
    setForm(f => ({
      ...f,
      platform: f.platform.includes(p)
        ? f.platform.filter(x => x !== p)
        : [...f.platform, p],
    }))
  }

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.sku.trim() || !form.name.trim()) {
      toast.error('SKU and Name are required')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const payload: Record<string, any> = {
        sku:           form.sku.trim(),
        name:          form.name.trim(),
        project_id:    form.project_id !== '__none__' ? form.project_id : null,
        brand:         form.brand || null,
        category:      form.category || null,
        unit_cost:     form.unit_cost ? Number(form.unit_cost) : null,
        selling_price: form.selling_price ? Number(form.selling_price) : null,
        weight_g:      form.weight_g ? Number(form.weight_g) : null,
        platform:      form.platform,
        status:        form.status,
        description:   form.description.trim() || null,
        cost:          form.unit_cost ? Number(form.unit_cost) : 0,
        updated_at:    new Date().toISOString(),
      }
      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id)
        if (error) throw error
        toast.success('Product updated')
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        toast.success('Product added')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project / Brand */}
          <div className="space-y-1.5">
            <Label>Project (Brand)</Label>
            <Select value={form.project_id} onValueChange={handleProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select project — auto-fills brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No project</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} <span className="text-muted-foreground font-mono text-xs ml-1">({p.code})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.brand && (
              <p className="text-xs text-muted-foreground">Brand auto-set to: <strong>{form.brand}</strong></p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. FIOR-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Product Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Product name" />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Unit Cost (RM)</Label>
              <Input type="number" step="0.01" min="0" value={form.unit_cost}
                onChange={e => set('unit_cost', e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Selling Price (RM)</Label>
              <Input type="number" step="0.01" min="0" value={form.selling_price}
                onChange={e => set('selling_price', e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (g)</Label>
              <Input type="number" step="0.1" min="0" value={form.weight_g}
                onChange={e => set('weight_g', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Sales Platforms</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {PLATFORMS.map(p => (
                <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.platform.includes(p)}
                    onChange={() => togglePlatform(p)}
                    className="rounded border-gray-300"
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
