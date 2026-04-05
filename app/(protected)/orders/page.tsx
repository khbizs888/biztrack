'use client'

import { useState, useMemo } from 'react'
import { useOrders } from '@/lib/hooks/useOrders'
import { useQuery } from '@tanstack/react-query'
import { fetchProjects } from '@/app/actions/data'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, ShoppingCart, FileDown, FileUp, History, Calendar } from 'lucide-react'
import type { OrderFilters } from '@/lib/types'
import type { Project } from '@/lib/types'
import AddOrderModal from '@/components/modules/orders/AddOrderModal'
import ImportOrdersModal from '@/components/modules/orders/ImportOrdersModal'
import OrderActions from '@/components/modules/orders/OrderActions'
import { BRAND_COLORS, BRANDS } from '@/lib/constants'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function OrdersPage() {
  const today = getTodayStr()
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedBrand, setSelectedBrand] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  // Map project name -> id for filtering
  const brandProjectId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of projects) {
      map[p.name] = p.id
    }
    return map
  }, [projects])

  const filters: OrderFilters = useMemo(() => {
    const f: OrderFilters = {
      dateFrom: selectedDate,
      dateTo: selectedDate,
      page,
      pageSize: PAGE_SIZE,
    }
    if (selectedBrand !== 'All' && brandProjectId[selectedBrand]) {
      f.projectId = brandProjectId[selectedBrand]
    }
    if (search.trim()) f.search = search.trim()
    return f
  }, [selectedDate, selectedBrand, brandProjectId, page, search])

  const { data, isLoading, error } = useOrders(filters)

  // Per-brand order counts for the selected date (load without brand filter)
  const allDayFilters: OrderFilters = useMemo(() => ({
    dateFrom: selectedDate,
    dateTo: selectedDate,
    pageSize: 9999,
    page: 1,
  }), [selectedDate])
  const { data: allDayData } = useOrders(allDayFilters)

  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allDayData?.count ?? 0 }
    for (const brand of BRANDS) {
      const pid = brandProjectId[brand]
      if (!pid) continue
      counts[brand] = (allDayData?.data ?? []).filter(o => o.project_id === pid).length
    }
    return counts
  }, [allDayData, brandProjectId])

  // Summary stats for selected date (all brands)
  const summaryStats = useMemo(() => {
    const orders = allDayData?.data ?? []
    const total = orders.length
    const revenue = orders.reduce((s, o) => s + Number(o.total_price), 0)
    const settled = orders.filter(o => o.payment_status === 'Settled').reduce((s, o) => s + Number(o.total_price), 0)
    const unsettled = revenue - settled
    return { total, revenue, settled, unsettled }
  }, [allDayData])

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0

  function exportCSV() {
    if (!data?.data) return
    const rows = data.data.map(o => [
      formatDate(o.order_date),
      o.created_at ? new Date(o.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : '',
      o.tracking_number ?? '',
      (o.customers as any)?.name ?? '',
      (o.customers as any)?.phone ?? '',
      (o.projects as any)?.name ?? '',
      o.package_snapshot?.name ?? o.package_name ?? '',
      o.total_price,
      o.channel ?? '',
      o.payment_status ?? '',
    ])
    const header = 'Date,Time,Tracking #,Customer Name,Phone,Brand,Package,Amount,Platform,Payment Status\n'
    const csv = header + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${selectedDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleBrandChange(brand: string) {
    setSelectedBrand(brand)
    setPage(1)
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedDate(e.target.value)
    setPage(1)
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    setPage(1)
  }

  const brandTabs = ['All', ...BRANDS]

  return (
    <div>
      <PageHeader title="Daily Order" description={`${data?.count ?? 0} orders on ${formatDate(selectedDate)}`}>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <FileDown className="h-4 w-4 mr-1" />Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
          <FileUp className="h-4 w-4 mr-1" />Import CSV
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/orders/import-history">
            <History className="h-4 w-4 mr-1" />History
          </Link>
        </Button>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1" />Add Order
        </Button>
      </PageHeader>

      {/* Date picker + search row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Input
          placeholder="Search tracking #, customer name or phone…"
          value={search}
          onChange={handleSearchChange}
          className="h-9 w-72"
        />
      </div>

      {/* Brand filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {brandTabs.map(brand => {
          const colors = brand !== 'All' ? BRAND_COLORS[brand] : null
          const isActive = selectedBrand === brand
          return (
            <button
              key={brand}
              onClick={() => handleBrandChange(brand)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                isActive
                  ? colors
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
              )}
            >
              {brand}
              <span className={cn(
                'text-xs rounded-full px-1.5 py-0.5 font-bold',
                isActive
                  ? colors ? `${colors.bg} ${colors.text}` : 'bg-primary/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {brandCounts[brand] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Orders" value={summaryStats.total} icon={ShoppingCart} />
        <StatCard title="Total Revenue" value={summaryStats.revenue} isCurrency />
        <StatCard
          title="Settled"
          value={formatCurrency(summaryStats.settled)}
          className="border-green-200 bg-green-50"
        />
        <StatCard
          title="Unsettled"
          value={formatCurrency(summaryStats.unsettled)}
          className="border-yellow-200 bg-yellow-50"
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load orders.</p>
      ) : !data?.data.length ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders found"
          description={search ? 'Try a different search term.' : 'No orders for this date/filter.'}
          action={{ label: 'Add Order', onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Tracking #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map(order => {
                  const projectName = (order.projects as any)?.name ?? null
                  const brandColors = projectName ? BRAND_COLORS[projectName] : null
                  const pkgName = order.package_snapshot?.name ?? order.package_name ?? '—'
                  const isSettled = order.payment_status === 'Settled'

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {order.tracking_number ?? '—'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {(order.customers as any)?.name ?? '—'}
                        {(order.customers as any)?.phone && (
                          <div className="text-xs text-muted-foreground">{(order.customers as any).phone}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {brandColors && projectName ? (
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border',
                            brandColors.bg, brandColors.text, brandColors.border
                          )}>
                            {projectName}
                          </span>
                        ) : projectName ? (
                          <Badge variant="outline">{projectName}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">{pkgName}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(Number(order.total_price))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.channel ?? '—'}
                      </TableCell>
                      <TableCell>
                        {isSettled ? (
                          <Badge variant="success">Settled</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <OrderActions order={order} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AddOrderModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <ImportOrdersModal open={showImportModal} onClose={() => setShowImportModal(false)} />
    </div>
  )
}
