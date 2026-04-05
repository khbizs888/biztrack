'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchImportBatches,
  fetchBatchOrders,
  fetchProjects,
  reprocessBatchErrors,
  type ImportBatch,
} from '@/app/actions/data'
import type { Project, Order } from '@/lib/types'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { History, ChevronDown, ChevronRight, RefreshCw, Upload } from 'lucide-react'
import { BRAND_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BatchFilters {
  projectId?: string
  dateFrom?: string
  dateTo?: string
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge variant="success">Completed</Badge>
  if (status === 'failed')    return <Badge variant="destructive">Failed</Badge>
  return <Badge variant="info">Processing</Badge>
}

function BrandBadge({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-muted-foreground text-xs">—</span>
  const colors = BRAND_COLORS[name]
  if (!colors) return <Badge variant="outline">{name}</Badge>
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border',
      colors.bg, colors.text, colors.border
    )}>
      {name}
    </span>
  )
}

function BatchOrdersSubTable({ batchId }: { batchId: string }) {
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['batch-orders', batchId],
    queryFn: () => fetchBatchOrders(batchId),
  })

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">Loading orders…</div>
    )
  }

  if (!orders.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">No orders found for this batch.</div>
    )
  }

  return (
    <div className="bg-muted/30 border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs py-2 pl-8">Tracking #</TableHead>
            <TableHead className="text-xs py-2">Customer</TableHead>
            <TableHead className="text-xs py-2">Package</TableHead>
            <TableHead className="text-xs py-2 text-right">Amount</TableHead>
            <TableHead className="text-xs py-2">Import Status</TableHead>
            <TableHead className="text-xs py-2">Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map(o => (
            <TableRow key={o.id} className="text-xs">
              <TableCell className="py-1.5 pl-8 font-mono text-muted-foreground">
                {o.tracking_number ?? '—'}
              </TableCell>
              <TableCell className="py-1.5">
                {(o.customers as any)?.name ?? '—'}
              </TableCell>
              <TableCell className="py-1.5">
                {o.package_snapshot?.name ?? o.package_name ?? '—'}
              </TableCell>
              <TableCell className="py-1.5 text-right">
                {formatCurrency(Number(o.total_price))}
              </TableCell>
              <TableCell className="py-1.5">
                {o.import_status === 'success' ? (
                  <span className="text-green-600 font-medium">Success</span>
                ) : o.import_status === 'error' ? (
                  <span className="text-red-600 font-medium">Error</span>
                ) : (
                  <span className="text-muted-foreground">{o.import_status ?? '—'}</span>
                )}
              </TableCell>
              <TableCell className="py-1.5 max-w-[240px] truncate text-red-600">
                {o.import_error ?? ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImportHistoryPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<BatchFilters>({})
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState<string | null>(null)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const { data: batches = [], isLoading, error } = useQuery<ImportBatch[]>({
    queryKey: ['import-batches', filters],
    queryFn: () => fetchImportBatches(filters),
  })

  // Summary stats
  const stats = useMemo(() => {
    const totalImports = batches.length
    const totalOrders  = batches.reduce((s, b) => s + b.success_count, 0)
    const totalRows    = batches.reduce((s, b) => s + b.total_rows, 0)
    const successRate  = totalRows > 0 ? Math.round((totalOrders / totalRows) * 100) : 0
    const lastBatch    = batches[0] ?? null
    const lastLabel    = lastBatch
      ? `${new Date(lastBatch.imported_at).toLocaleDateString('en-MY')} · ${(lastBatch.projects as any)?.name ?? '—'}`
      : '—'
    return { totalImports, totalOrders, successRate, lastLabel }
  }, [batches])

  async function handleReprocess(batchId: string) {
    setReprocessing(batchId)
    try {
      const result = await reprocessBatchErrors(batchId)
      toast.success(`Reprocessed ${result.reprocessed} order${result.reprocessed !== 1 ? 's' : ''}${result.failed > 0 ? `, ${result.failed} still failed` : ''}`)
      queryClient.invalidateQueries({ queryKey: ['import-batches'] })
      queryClient.invalidateQueries({ queryKey: ['batch-orders', batchId] })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reprocess failed')
    } finally {
      setReprocessing(null)
    }
  }

  function toggleExpand(batchId: string) {
    setExpandedBatchId(prev => (prev === batchId ? null : batchId))
  }

  return (
    <div>
      <PageHeader title="Import History" description="Track all CSV import sessions">
        <Button variant="outline" size="sm" asChild>
          <Link href="/orders">
            Back to Orders
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/orders">
            <Upload className="h-4 w-4 mr-1" />New Import
          </Link>
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Imports" value={stats.totalImports} icon={History} />
        <StatCard title="Orders Imported" value={stats.totalOrders} />
        <StatCard title="Success Rate" value={`${stats.successRate}%`} />
        <StatCard title="Last Import" value={stats.lastLabel} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select
          value={filters.projectId ?? '__all__'}
          onValueChange={v => setFilters(f => ({ ...f, projectId: v === '__all__' ? undefined : v }))}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Brands</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>From</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span>To</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load import history.</p>
      ) : !batches.length ? (
        <EmptyState
          icon={History}
          title="No import history yet"
          description="Import your first CSV to get started."
        />
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Date / Time</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Total Rows</TableHead>
                <TableHead className="text-right">Success</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map(batch => {
                const isExpanded = expandedBatchId === batch.id
                const brandName = (batch.projects as any)?.name as string | undefined

                return (
                  <>
                    <TableRow
                      key={batch.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => toggleExpand(batch.id)}
                    >
                      <TableCell className="text-muted-foreground">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(batch.imported_at).toLocaleString('en-MY', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <BrandBadge name={brandName} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {batch.file_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">{batch.total_rows}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        {batch.success_count}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {batch.skipped_count}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {batch.error_count > 0 ? (
                          <span className="text-red-600 font-medium">{batch.error_count}</span>
                        ) : (
                          <span className="text-muted-foreground">{batch.error_count}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={batch.status} />
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {batch.error_count > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={reprocessing === batch.id}
                            onClick={() => handleReprocess(batch.id)}
                            className="h-7 text-xs"
                          >
                            {reprocessing === batch.id ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Reprocessing…
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Re-process
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${batch.id}-expanded`}>
                        <TableCell colSpan={10} className="p-0">
                          <BatchOrdersSubTable batchId={batch.id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
