'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import StockMovementModal from '@/components/modules/inventory/StockMovementModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Warehouse, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const BRANDS = ['FIOR', 'NE', 'DD', 'KHH', 'Juji']
const LOW_STOCK_THRESHOLD = 10

export default function InventoryPage() {
  const [rows, setRows]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [brand, setBrand]       = useState('all')
  const [showModal, setShowModal]   = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase.from('inventory_summary').select('*').order('product_name', { ascending: true })
    if (brand !== 'all') q = q.eq('brand', brand)
    const { data, error } = await q
    if (error) { toast.error('Failed to load inventory'); setLoading(false); return }
    setRows(data ?? [])
    setLoading(false)
  }, [brand])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const lowStockCount = rows.filter(r => Number(r.current_stock) < LOW_STOCK_THRESHOLD).length
  const totalProducts = rows.length

  function openStockModal(product: any) {
    setSelectedProduct(product)
    setShowModal(true)
  }

  return (
    <div>
      <PageHeader title="Inventory" description={`${totalProducts} products tracked`}>
        <Button size="sm" onClick={() => { setSelectedProduct(null); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-1" />Stock Movement
        </Button>
      </PageHeader>

      {/* Summary row */}
      <div className="flex gap-4 mb-5">
        <div className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3">
          <Warehouse className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Total Products</p>
            <p className="text-lg font-semibold">{totalProducts}</p>
          </div>
        </div>
        {lowStockCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-xs text-red-600">Low Stock</p>
              <p className="text-lg font-semibold text-red-700">{lowStockCount} products</p>
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
          description="Add products first, then record stock movements."
          action={{ label: 'Record Stock Movement', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const stock = Number(row.current_stock)
                const isLow = stock < LOW_STOCK_THRESHOLD
                return (
                  <TableRow
                    key={row.product_id}
                    className={cn(isLow && 'bg-red-50/50')}
                  >
                    <TableCell>
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {row.sku}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {row.product_name}
                        {isLow && (
                          <span className="flex items-center gap-1 text-xs text-red-600 font-normal">
                            <AlertTriangle className="h-3 w-3" />
                            Low
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.brand ? <Badge variant="outline">{row.brand}</Badge> : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        'text-lg font-semibold',
                        stock === 0 ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-green-700'
                      )}>
                        {stock}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">units</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openStockModal(row)}>
                        + Movement
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <StockMovementModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchInventory}
        preselectedProduct={selectedProduct}
      />
    </div>
  )
}
