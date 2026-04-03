'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import ExpenseModal from '@/components/modules/expenses/ExpenseModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Receipt, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const BRANDS = ['FIOR', 'NE', 'DD', 'KHH', 'Juji']
const CATEGORIES = [
  'Ad Spend', 'Shipping', 'Packaging', 'Staff Salary',
  'Platform Fees', 'SST', 'Rent', 'Utilities', 'Raw Materials', 'Other',
]

export default function ExpensesPage() {
  const [expenses, setExpenses]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [brand, setBrand]         = useState('all')
  const [category, setCategory]   = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editExpense, setEditExpense] = useState<any | null>(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase.from('expenses').select('*').order('date', { ascending: false })
    if (dateFrom)        q = q.gte('date', dateFrom)
    if (dateTo)          q = q.lte('date', dateTo)
    if (brand !== 'all')    q = q.eq('brand', brand)
    if (category !== 'all') q = q.eq('category', category)
    const { data, error } = await q
    if (error) { toast.error('Failed to load expenses'); setLoading(false); return }
    setExpenses(data ?? [])
    setLoading(false)
  }, [dateFrom, dateTo, brand, category])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    const { error } = await createClient().from('expenses').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Expense deleted')
    fetchExpenses()
  }

  // Monthly summary by category
  const summary = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = expenses
      .filter(e => e.category === cat)
      .reduce((s, e) => s + Number(e.amount), 0)
    return acc
  }, {})
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      <PageHeader title="Expense Tracker" description={`${expenses.length} expenses · Total: ${formatCurrency(total)}`}>
        <Button size="sm" onClick={() => { setEditExpense(null); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-1" />Add Expense
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {CATEGORIES.filter(c => summary[c] > 0).map(cat => (
          <div key={cat} className="bg-white border rounded-lg p-3">
            <p className="text-xs text-muted-foreground truncate">{cat}</p>
            <p className="text-sm font-semibold mt-0.5">{formatCurrency(summary[cat])}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="w-[150px]"
        />
        <Input
          type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="w-[150px]"
        />
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Brand" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {(dateFrom || dateTo || brand !== 'all' || category !== 'all') && (
          <Button variant="outline" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setBrand('all'); setCategory('all') }}>
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses recorded"
          description="Start tracking expenses to understand your cost structure."
          action={{ label: 'Add Expense', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(e.date)}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                      {e.category ?? e.type ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.brand ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {e.description ?? e.notes ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.payment_method ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(e.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => { setEditExpense(e); setShowModal(true) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(e.id)}>
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

      <ExpenseModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchExpenses}
        expense={editExpense}
      />
    </div>
  )
}
