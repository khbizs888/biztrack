'use client'

import { use, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import {
  productSchema, packageSchema, expenseSchema,
  type ProductFormData, type PackageFormData, type ExpenseFormData,
} from '@/lib/validations'
import PageHeader from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type Tab = 'products' | 'packages' | 'expenses'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('products')
  const [showProductModal, setShowProductModal] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('id', id).single()
      return data
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products', id],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('project_id', id).order('name')
      return data ?? []
    },
  })

  const { data: packages } = useQuery({
    queryKey: ['packages', id],
    queryFn: async () => {
      const { data } = await supabase.from('packages').select('*').eq('project_id', id).order('name')
      return data ?? []
    },
  })

  const { data: expenses } = useQuery({
    queryKey: ['expenses', id],
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('*').eq('project_id', id).order('date', { ascending: false })
      return data ?? []
    },
  })

  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { project_id: id },
  })
  const packageForm = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: { project_id: id },
  })
  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { project_id: id, date: new Date().toISOString().split('T')[0] },
  })

  async function deleteItem(table: string, itemId: string, queryKey: string) {
    const { error } = await supabase.from(table as any).delete().eq('id', itemId)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Deleted')
    queryClient.invalidateQueries({ queryKey: [queryKey, id] })
  }

  if (!project) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={`Code: ${project.code}`} />

      <div className="flex gap-0 border-b">
        {(['products', 'packages', 'expenses'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Products</CardTitle>
            <Button size="sm" onClick={() => setShowProductModal(true)}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-mono">{p.sku}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.cost)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteItem('products', p.id, 'products')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'packages' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Packages</CardTitle>
            <Button size="sm" onClick={() => setShowPackageModal(true)}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{p.price ? formatCurrency(p.price) : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteItem('packages', p.id, 'packages')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'expenses' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Expenses</CardTitle>
            <Button size="sm" onClick={() => setShowExpenseModal(true)}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses?.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                    <TableCell className="capitalize text-sm">{e.type}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.notes ?? '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteItem('expenses', e.id, 'expenses')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Product Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <form onSubmit={productForm.handleSubmit(async (data) => {
            const { error } = await supabase.from('products').insert(data)
            if (error) { toast.error(error.message); return }
            toast.success('Product added')
            queryClient.invalidateQueries({ queryKey: ['products', id] })
            productForm.reset({ project_id: id })
            setShowProductModal(false)
          })} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input {...productForm.register('sku')} />
                {productForm.formState.errors.sku && <p className="text-xs text-destructive">{productForm.formState.errors.sku.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Cost (RM)</Label>
                <Input type="number" step="0.01" {...productForm.register('cost')} />
                {productForm.formState.errors.cost && <p className="text-xs text-destructive">{productForm.formState.errors.cost.message}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...productForm.register('name')} />
              {productForm.formState.errors.name && <p className="text-xs text-destructive">{productForm.formState.errors.name.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowProductModal(false)}>Cancel</Button>
              <Button type="submit" disabled={productForm.formState.isSubmitting}>Add Product</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Package Modal */}
      <Dialog open={showPackageModal} onOpenChange={setShowPackageModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Package</DialogTitle></DialogHeader>
          <form onSubmit={packageForm.handleSubmit(async (data) => {
            const { error } = await supabase.from('packages').insert(data)
            if (error) { toast.error(error.message); return }
            toast.success('Package added')
            queryClient.invalidateQueries({ queryKey: ['packages', id] })
            packageForm.reset({ project_id: id })
            setShowPackageModal(false)
          })} className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...packageForm.register('name')} />
              {packageForm.formState.errors.name && <p className="text-xs text-destructive">{packageForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Price (RM)</Label>
              <Input type="number" step="0.01" {...packageForm.register('price')} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowPackageModal(false)}>Cancel</Button>
              <Button type="submit" disabled={packageForm.formState.isSubmitting}>Add Package</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Modal */}
      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <form onSubmit={expenseForm.handleSubmit(async (data) => {
            const { error } = await supabase.from('expenses').insert(data)
            if (error) { toast.error(error.message); return }
            toast.success('Expense added')
            queryClient.invalidateQueries({ queryKey: ['expenses', id] })
            expenseForm.reset({ project_id: id, date: new Date().toISOString().split('T')[0] })
            setShowExpenseModal(false)
          })} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select onValueChange={v => expenseForm.setValue('type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {['marketing', 'logistics', 'other'].map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {expenseForm.formState.errors.type && <p className="text-xs text-destructive">{expenseForm.formState.errors.type.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Amount (RM)</Label>
                <Input type="number" step="0.01" {...expenseForm.register('amount')} />
                {expenseForm.formState.errors.amount && <p className="text-xs text-destructive">{expenseForm.formState.errors.amount.message}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" {...expenseForm.register('date')} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input placeholder="Optional notes" {...expenseForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowExpenseModal(false)}>Cancel</Button>
              <Button type="submit" disabled={expenseForm.formState.isSubmitting}>Add Expense</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
