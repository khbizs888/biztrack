'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import StockMovementModal from '@/components/modules/inventory/StockMovementModal'
import { useCleanupDialogArtifacts } from '@/lib/hooks/use-cleanup-dialog-artifacts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Warehouse, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const BRANDS = ['FIOR', 'NE', 'DD', 'KHH', 'Juji']
const LOW_STOCK_THRESHOLD = 10

interface StockRow {
  brand: string
  component_key: string
  display_name: string
  unit: string
  current_stock: number
}

interface ModalState {
  open: boolean
  brand?: string
  component_key?: string
}

export default function InventoryPage() {
  useCleanupDialogArtifacts()
  const [rows, setRows]       = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [brand, setBrand]     = useState('all')
  const [modal, setModal]     = useState<ModalState>({ open: false })

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase.from('inventory_summary').select('*')
    if (brand !== 'all') q = q.eq('brand', brand)
    const { data, error } = await q
    if (error) { toast.error('Failed to load inventory'); setLoading(false); return }
    setRows((data ?? []).map((r: any) => ({ ...r, current_stock: Number(r.current_stock) })))
    setLoading(false)
  }, [brand])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const lowStockCount  = rows.filter(r => r.current_stock < LOW_STOCK_THRESHOLD).length
  const totalComponents = rows.length

  // Group rows by brand for display
  const grouped = rows.reduce<Record<string, StockRow[]>>((acc, row) => {
    if (!acc[row.brand]) acc[row.brand] = []
    acc[row.brand].push(row)
    return acc
  }, {})

  const brandOrder = brand === 'all' ? BRANDS.filter(b => grouped[b]) : [brand]

  return (
    <div>
      <PageHeader title="Inventory" description={`${totalComponents} components tracked`}>
        <Button size="sm" onClick={() => setModal({ open: true })}>
          <Plus className="h-4 w-4 mr-1" />Stock Movement
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="flex gap-4 mb-5">
        <div className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3">
          <Warehouse className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Components Tracked</p>
            <p className="text-lg font-semibold">{totalComponents}</p>
          </div>
        </div>
        {lowStockCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-xs text-red-600">Low Stock</p>
              <p className="text-lg font-semibold text-red-700">{lowStockCount} components</p>
            </div>
          </div>
        )}
      </div>

      {/* Brand filter */}
      <div className="flex gap-2 mb-4">
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Brand" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No inventory data"
          description="Record stock movements to start tracking component levels."
          action={{ label: 'Record Stock Movement', onClick: () => setModal({ open: true }) }}
        />
      ) : (
        <div className="space-y-4">
          {brandOrder.map(b => {
            const brandRows = grouped[b] ?? []
            if (!brandRows.length) return null
            return (
              <div key={b} className="rounded-lg border bg-white">
                <div className="px-4 py-2 border-b bg-gray-50 rounded-t-lg">
                  <Badge variant="outline" className="font-semibold">{b}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brandRows.map(row => {
                      const isLow = row.current_stock < LOW_STOCK_THRESHOLD
                      return (
                        <TableRow key={row.component_key} className={cn(isLow && 'bg-red-50/50')}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {row.display_name}
                              {isLow && (
                                <span className="flex items-center gap-1 text-xs text-red-600 font-normal">
                                  <AlertTriangle className="h-3 w-3" />
                                  Low
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{row.unit}</TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              'text-lg font-semibold',
                              row.current_stock === 0 ? 'text-red-600'
                                : isLow ? 'text-orange-600'
                                : 'text-green-700'
                            )}>
                              {row.current_stock}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{row.unit.toLowerCase()}s</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline" size="sm"
                              onClick={() => setModal({ open: true, brand: row.brand, component_key: row.component_key })}
                            >
                              + Movement
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          })}
        </div>
      )}

      <StockMovementModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        onSaved={fetchInventory}
        preselectedBrand={modal.brand}
        preselectedComponent={modal.component_key}
      />
    </div>
  )
}
