'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import ProductModal from '@/components/modules/products/ProductModal'
import { useCleanupDialogArtifacts } from '@/lib/hooks/use-cleanup-dialog-artifacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Plus, Package, Search, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const CATEGORIES = ['Supplements', 'Skincare', 'Health Drinks', 'Food', 'Other']
const STATUSES   = ['Active', 'Discontinued', 'Coming Soon']

const STATUS_COLORS: Record<string, string> = {
  'Active':       'bg-green-100 text-green-700',
  'Discontinued': 'bg-red-100 text-red-700',
  'Coming Soon':  'bg-blue-100 text-blue-700',
}

export default function ProductsPage() {
  useCleanupDialogArtifacts()
  const [products, setProducts]   = useState<any[]>([])
  const [projects, setProjects]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [projectId, setProjectId] = useState('all')
  const [category, setCategory]   = useState('all')
  const [status, setStatus]       = useState('all')
  const [showModal, setShowModal]     = useState(false)
  const [editProduct, setEditProduct] = useState<any | null>(null)

  // Load projects list once for the filter dropdown
  useEffect(() => {
    createClient()
      .from('projects')
      .select('id, name, code')
      .order('name')
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    // Join with projects to get project name/code for each product
    let q = supabase
      .from('products')
      .select('*, projects(id, name, code)')
      .order('created_at', { ascending: false })
    if (projectId !== 'all') q = q.eq('project_id', projectId)
    if (category !== 'all') q = q.eq('category', category)
    if (status !== 'all')   q = q.eq('status', status)
    const { data, error } = await q
    if (error) { toast.error('Failed to load products'); setLoading(false); return }
    const rows = search
      ? (data ?? []).filter(p =>
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.sku?.toLowerCase().includes(search.toLowerCase()))
      : (data ?? [])
    setProducts(rows)
    setLoading(false)
  }, [projectId, category, status, search])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return
    const { error } = await createClient().from('products').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Product deleted')
    fetchProducts()
  }

  function openAdd() { setEditProduct(null); setShowModal(true) }
  function openEdit(p: any) { setEditProduct(p); setShowModal(true) }

  return (
    <div>
      <PageHeader title="Product Catalog" description={`${products.length} products`}>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" />Add Product
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Add your first product and link it to a project."
          action={{ label: 'Add Product', onClick: openAdd }}
        />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map(p => {
                const proj = p.projects as { id: string; name: string; code: string } | null
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {p.sku}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {proj
                        ? <Badge variant="outline">{proj.name}</Badge>
                        : p.brand
                          ? <span className="text-xs text-muted-foreground">{p.brand}</span>
                          : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.category ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {p.unit_cost != null ? formatCurrency(Number(p.unit_cost)) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {p.selling_price != null ? formatCurrency(Number(p.selling_price)) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Array.isArray(p.platform) && p.platform.length > 0
                        ? p.platform.join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {p.status ?? 'Active'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <ProductModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchProducts}
        product={editProduct}
      />
    </div>
  )
}
