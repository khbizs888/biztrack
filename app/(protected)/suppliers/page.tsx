'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import SupplierModal from '@/components/modules/suppliers/SupplierModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Truck, Search, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState<any | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await createClient()
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true })
    if (error) { toast.error('Failed to load suppliers'); setLoading(false); return }
    const rows = search
      ? (data ?? []).filter(s =>
          s.name?.toLowerCase().includes(search.toLowerCase()) ||
          s.products_supplied?.toLowerCase().includes(search.toLowerCase()))
      : (data ?? [])
    setSuppliers(rows)
    setLoading(false)
  }, [search])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  async function handleDelete(id: string) {
    if (!confirm('Delete this supplier?')) return
    const { error } = await createClient().from('suppliers').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Supplier deleted')
    fetchSuppliers()
  }

  return (
    <div>
      <PageHeader title="Suppliers" description={`${suppliers.length} suppliers`}>
        <Button size="sm" onClick={() => { setEditSupplier(null); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-1" />Add Supplier
        </Button>
      </PageHeader>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Add suppliers to track your procurement contacts."
          action={{ label: 'Add Supplier', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Products Supplied</TableHead>
                <TableHead className="text-center">Lead Time</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.contact_person ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.phone ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                    {s.products_supplied || '—'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {s.lead_time_days != null ? `${s.lead_time_days}d` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.payment_terms ?? '—'}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      s.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    )}>
                      {s.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => { setEditSupplier(s); setShowModal(true) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SupplierModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchSuppliers}
        supplier={editSupplier}
      />
    </div>
  )
}
