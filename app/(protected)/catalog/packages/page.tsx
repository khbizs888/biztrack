'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { useCleanupDialogArtifacts } from '@/lib/hooks/use-cleanup-dialog-artifacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { Plus, Package, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchAllPackages,
  createCatalogPackage,
  updateCatalogPackage,
  togglePackageStatus,
  type CatalogPackage,
} from '@/app/actions/catalog'

const BRANDS = ['DD', 'FIOR', 'Juji', 'KHH', 'NE'] as const

// ── Profit colour helpers ───────────────────────────────────────────────────

function profitPctColor(pct: number): string {
  if (pct >= 30) return 'text-green-600 font-semibold'
  if (pct >= 10) return 'text-yellow-600 font-semibold'
  return 'text-red-600 font-semibold'
}

// ── Package form modal ──────────────────────────────────────────────────────

interface FormState {
  project_id: string
  name: string
  code: string
  price: string
  cost: string
  description: string
}

const EMPTY_FORM: FormState = {
  project_id: '',
  name: '',
  code: '',
  price: '',
  cost: '',
  description: '',
}

interface PackageModalProps {
  open: boolean
  editing: CatalogPackage | null
  projects: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}

function PackageModal({ open, editing, projects, onClose, onSaved }: PackageModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const firstFocus = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        project_id: editing.project_id,
        name: editing.name,
        code: editing.code ?? '',
        price: editing.price != null ? String(editing.price) : '',
        cost: editing.cost != null ? String(editing.cost) : '',
        description: editing.description ?? '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setTimeout(() => firstFocus.current?.focus(), 50)
  }, [open, editing])

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.project_id) { toast.error('Select a brand'); return }
    if (!form.name.trim()) { toast.error('Package name is required'); return }
    const price = parseFloat(form.price)
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price'); return }
    const cost = form.cost ? parseFloat(form.cost) : null
    if (form.cost && (isNaN(cost!) || cost! < 0)) { toast.error('Enter a valid cost'); return }

    setSaving(true)
    try {
      if (editing) {
        await updateCatalogPackage(editing.id, {
          name: form.name,
          code: form.code || null,
          price,
          cost: cost ?? null,
          description: form.description || null,
        })
      } else {
        await createCatalogPackage({
          project_id: form.project_id,
          name: form.name,
          code: form.code || null,
          price,
          cost: cost ?? null,
          description: form.description || null,
        })
      }
      toast.success(editing ? 'Package updated' : 'Package created')
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Package' : 'Add Package'}</DialogTitle>
        </DialogHeader>

        {editing && (
          <p className="text-xs text-muted-foreground -mt-1 mb-1 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Changing the price will not affect existing orders — snapshots are frozen at order time.
          </p>
        )}

        <div className="space-y-3">
          {/* Brand */}
          <div className="space-y-1">
            <Label>Brand <span className="text-red-500">*</span></Label>
            <Select
              value={form.project_id}
              onValueChange={v => set('project_id', v)}
              disabled={!!editing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing && (
              <p className="text-xs text-muted-foreground">Brand cannot be changed after creation</p>
            )}
          </div>

          {/* Name + Code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Package Name <span className="text-red-500">*</span></Label>
              <Input
                ref={firstFocus}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Starter Pack"
              />
            </div>
            <div className="space-y-1">
              <Label>Code (SKU)</Label>
              <Input
                value={form.code}
                onChange={e => set('code', e.target.value)}
                placeholder="e.g. DD-S01"
              />
            </div>
          </div>

          {/* Price + Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Price (RM) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={e => set('price', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Cost (RM)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={e => set('cost', e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Package'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CatalogPackagesPage() {
  useCleanupDialogArtifacts()

  const [packages, setPackages] = useState<CatalogPackage[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CatalogPackage | null>(null)

  useEffect(() => {
    createClient()
      .from('projects')
      .select('id, name')
      .order('name')
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllPackages()
      setPackages(data)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to load packages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(pkg: CatalogPackage) {
    try {
      await togglePackageStatus(pkg.id, !pkg.is_active)
      toast.success(pkg.is_active ? 'Package deactivated' : 'Package activated')
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update status')
    }
  }

  // Brand tabs with counts
  const countByBrand = (name: string) =>
    packages.filter(p => (p.projects as any)?.name === name).length
  const totalActive = packages.filter(p => p.is_active).length

  const filtered = brandFilter === 'all'
    ? packages
    : packages.filter(p => (p.projects as any)?.name === brandFilter)

  // Only BRANDS that actually have projects
  const availableBrands = BRANDS.filter(b => projects.some(p => p.name === b))

  return (
    <div>
      <PageHeader
        title="Package Management"
        description={`${packages.length} packages · ${totalActive} active`}
      >
        <Button size="sm" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-1" />Add Package
        </Button>
      </PageHeader>

      {/* Brand filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        <button
          onClick={() => setBrandFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            brandFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          All ({packages.length})
        </button>
        {availableBrands.map(brand => (
          <button
            key={brand}
            onClick={() => setBrandFilter(brand)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              brandFilter === brand
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {brand} ({countByBrand(brand)})
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No packages found"
          description={brandFilter === 'all' ? 'Add your first package to get started.' : `No packages for ${brandFilter} yet.`}
          action={{ label: 'Add Package', onClick: () => { setEditing(null); setShowModal(true) } }}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Price (RM)</TableHead>
                <TableHead className="text-right">Cost (RM)</TableHead>
                <TableHead className="text-right">Profit (RM)</TableHead>
                <TableHead className="text-right">Profit %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(pkg => {
                const price = pkg.price ?? 0
                const cost = pkg.cost ?? null
                const profit = cost != null ? price - cost : null
                const profitPct = profit != null && price > 0 ? (profit / price) * 100 : null
                const brand = (pkg.projects as any)?.name ?? '—'

                return (
                  <TableRow
                    key={pkg.id}
                    className={cn(!pkg.is_active && 'opacity-50')}
                  >
                    <TableCell className="font-medium">
                      <span className={cn(!pkg.is_active && 'line-through text-muted-foreground')}>
                        {pkg.name}
                      </span>
                      {pkg.code && (
                        <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {pkg.code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {brand}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(price)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {cost != null ? formatCurrency(cost) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {profit != null
                        ? <span className={profitPct != null ? profitPctColor(profitPct) : ''}>
                            {formatCurrency(profit)}
                          </span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {profitPct != null
                        ? <span className={profitPctColor(profitPct)}>
                            {profitPct.toFixed(1)}%
                          </span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        pkg.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500',
                      )}>
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit"
                          onClick={() => { setEditing(pkg); setShowModal(true) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={pkg.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggle(pkg)}
                        >
                          {pkg.is_active
                            ? <ToggleRight className="h-4 w-4 text-green-600" />
                            : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PackageModal
        open={showModal}
        editing={editing}
        projects={projects}
        onClose={() => setShowModal(false)}
        onSaved={load}
      />
    </div>
  )
}
