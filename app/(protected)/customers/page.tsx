'use client'

import { useState, useEffect, useCallback, useTransition, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import Link from 'next/link'
import {
  fetchCustomersPage, fetchCustomerSummaryStats,
  setFollowUp, markContacted, refreshAllCustomerTagsSQL,
} from '@/app/actions/customer-crm'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BRAND_COLORS, BRANDS } from '@/lib/constants'
import {
  Users, Crown, RefreshCw, Bell, TrendingDown, UserCheck,
  MessageCircle, Calendar, ChevronUp, ChevronDown, ExternalLink, X,
} from 'lucide-react'
import { differenceInDays, subDays, format } from 'date-fns'
import { toast } from 'sonner'
import type { CustomerCRM, CustomerTag } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useCleanupDialogArtifacts } from '@/lib/hooks/use-cleanup-dialog-artifacts'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const TAG_STYLES: Record<CustomerTag, string> = {
  New:     'bg-blue-100 text-blue-700 border-blue-200',
  Repeat:  'bg-green-100 text-green-700 border-green-200',
  VIP:     'bg-amber-100 text-amber-800 border-amber-300',
  Dormant: 'bg-orange-100 text-orange-700 border-orange-200',
  Lost:    'bg-red-100 text-red-700 border-red-200',
}

type SortKey = 'last_order_date' | 'total_spent' | 'total_orders' | 'average_order_value' | 'name'
type TagFilter = 'all' | CustomerTag

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildWALink(phone: string | null | undefined): string {
  const cleaned = (phone || '').replace(/[\s\-]/g, '')
  if (cleaned.startsWith('+60')) return `https://wa.me/${cleaned.slice(1)}`
  if (cleaned.startsWith('60'))  return `https://wa.me/${cleaned}`
  if (cleaned.startsWith('0'))   return `https://wa.me/6${cleaned}`
  return `https://wa.me/6${cleaned}`
}

function TagBadge({ tag }: { tag: CustomerTag | null }) {
  const t = tag ?? 'New'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TAG_STYLES[t]}`}>{t}</span>
}

function BrandBadge({ brand }: { brand: string | null }) {
  if (!brand) return <span className="text-muted-foreground text-xs">—</span>
  const c = BRAND_COLORS[brand]
  if (!c) return <span className="text-xs">{brand}</span>
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>{brand}</span>
}

function SortTh({ label, col, active, dir, onSort }: {
  label: string; col: SortKey; active: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void
}) {
  return (
    <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors whitespace-nowrap font-medium">
      {label}
      {active === col
        ? dir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        : <ChevronDown className="h-3 w-3 opacity-25" />}
    </button>
  )
}

// ─── Main content (needs useSearchParams → wrapped in Suspense) ───────────────

function CustomersContent() {
  useCleanupDialogArtifacts()
  const router      = useRouter()
  const params      = useSearchParams()
  const queryClient = useQueryClient()

  // Read filter state from URL
  const page        = parseInt(params.get('page') ?? '0', 10)
  const search      = params.get('search') ?? ''
  const tagFilter   = (params.get('tag') as TagFilter) ?? 'all'
  const brandFilter = params.get('brand') ?? 'all'
  const dateFrom    = params.get('from') ?? ''
  const dateTo      = params.get('to') ?? ''
  const minSpend    = params.get('min') ?? ''
  const sortKey     = (params.get('sort') as SortKey) ?? 'last_order_date'
  const sortDir     = (params.get('dir') as 'asc' | 'desc') ?? 'desc'

  // Local search input (debounced before URL update)
  const [searchInput, setSearchInput] = useState(search)

  // Sync input if URL changes externally
  useEffect(() => { setSearchInput(search) }, [search])

  // Debounce: push search to URL 300ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) update({ search: searchInput || null })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const [fuCustomer, setFuCustomer] = useState<CustomerCRM | null>(null)
  const [fuDate,     setFuDate]     = useState('')
  const [fuNote,     setFuNote]     = useState('')
  const [isSavingFU,   startSavingFU]   = useTransition()
  const [isMarking,    startMarking]    = useTransition()
  const [isRefreshing, startRefreshing] = useTransition()

  // ── URL param helper ─────────────────────────────────────────────────────

  function update(changes: Record<string, string | number | null>, resetPage = true) {
    const p = new URLSearchParams(params.toString())
    if (resetPage) p.delete('page')
    for (const [k, v] of Object.entries(changes)) {
      const str = v == null ? '' : String(v)
      if (!str || str === 'all' || str === '0') p.delete(k)
      else p.set(k, str)
    }
    router.replace(`/customers?${p.toString()}`, { scroll: false })
  }

  function clearAll() {
    setSearchInput('')
    router.replace('/customers', { scroll: false })
  }

  const activeFilterCount = [
    tagFilter !== 'all', brandFilter !== 'all',
    dateFrom, dateTo, minSpend, search,
  ].filter(Boolean).length

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stats = { total: 0, newMonth: 0, repeat: 0, vip: 0, dormant: 0, lost: 0 } } = useQuery({
    queryKey: ['customer-stats'],
    queryFn:  fetchCustomerSummaryStats,
    staleTime: 30_000,
  })

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['customers-page', page, search, tagFilter, brandFilter, dateFrom, dateTo, minSpend, sortKey, sortDir],
    queryFn:  () => fetchCustomersPage({
      page,
      search:   search || undefined,
      tag:      tagFilter,
      brand:    brandFilter,
      dateFrom: dateFrom || undefined,
      dateTo:   dateTo || undefined,
      minSpend: minSpend ? Number(minSpend) : undefined,
      sortKey,
      sortDir,
    }),
    placeholderData: keepPreviousData,
  })

  const customers  = pageData?.data ?? []
  const totalCount = pageData?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // ── Sort helpers ─────────────────────────────────────────────────────────

  function toggleSort(key: SortKey) {
    if (sortKey === key) update({ sort: key, dir: sortDir === 'desc' ? 'asc' : 'desc' })
    else update({ sort: key, dir: 'desc' })
  }

  // ── Quick date presets ────────────────────────────────────────────────────

  function setDatePreset(days: number) {
    update({
      from: format(subDays(new Date(), days - 1), 'yyyy-MM-dd'),
      to:   format(new Date(), 'yyyy-MM-dd'),
    })
  }

  // ── Follow-up helpers ─────────────────────────────────────────────────────

  function openFollowUp(c: CustomerCRM) {
    setFuCustomer(c)
    setFuDate(c.follow_up_date ?? '')
    setFuNote(c.follow_up_note ?? '')
  }

  function saveFollowUp() {
    if (!fuCustomer) return
    startSavingFU(async () => {
      try {
        await setFollowUp(fuCustomer.id, fuDate, fuNote)
        toast.success('Follow-up saved')
        queryClient.invalidateQueries({ queryKey: ['customers-page'] })
        queryClient.invalidateQueries({ queryKey: ['customer-stats'] })
        setFuCustomer(null)
      } catch { toast.error('Failed to save') }
    })
  }

  function handleMarkContacted(customerId: string) {
    startMarking(async () => {
      try {
        await markContacted(customerId)
        toast.success('Marked as contacted')
        queryClient.invalidateQueries({ queryKey: ['customers-page'] })
      } catch { toast.error('Failed') }
    })
  }

  function handleRefreshAll() {
    startRefreshing(async () => {
      try {
        const { updated } = await refreshAllCustomerTagsSQL()
        toast.success(`Tags refreshed for ${updated} customers`)
        queryClient.invalidateQueries({ queryKey: ['customers-page'] })
        queryClient.invalidateQueries({ queryKey: ['customer-stats'] })
      } catch { toast.error('Refresh failed') }
    })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // ── Summary cards ────────────────────────────────────────────────────────

  const summaryCards: { label: string; value: number; icon: React.ElementType; color: string; tag: TagFilter }[] = [
    { label: 'Total',    value: stats.total,    icon: Users,        color: 'text-gray-500',   tag: 'all'     },
    { label: 'New/mo',   value: stats.newMonth,  icon: Users,        color: 'text-blue-600',   tag: 'New'     },
    { label: `Repeat (${stats.total > 0 ? Math.round(stats.repeat / stats.total * 100) : 0}%)`, value: stats.repeat,   icon: RefreshCw,    color: 'text-green-600',  tag: 'Repeat'  },
    { label: 'VIP',      value: stats.vip,      icon: Crown,        color: 'text-amber-600',  tag: 'VIP'     },
    { label: 'Dormant',  value: stats.dormant,  icon: Bell,         color: 'text-orange-600', tag: 'Dormant' },
    { label: 'Lost',     value: stats.lost,     icon: TrendingDown, color: 'text-red-600',    tag: 'Lost'    },
  ]

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Customers"
        description={isLoading ? 'Loading…' : `${totalCount.toLocaleString()} customers${activeFilterCount > 0 ? ' (filtered)' : ''}`}
      >
        <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Tags
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color, tag }) => (
          <Card
            key={tag}
            onClick={() => update({ tag: tag === tagFilter ? null : tag })}
            className={`cursor-pointer transition-all hover:shadow-md ${tagFilter === tag ? 'ring-2 ring-primary shadow-md' : ''}`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <Icon className={`h-4 w-4 ${color} mb-1`} />
              <p className="text-2xl font-bold">{value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <div className="space-y-3 p-4 bg-muted/20 rounded-lg border">
        {/* Row 1: Search + clear */}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name or phone…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="h-9 w-56"
          />
          <div>
            <Label className="text-xs text-muted-foreground mr-2">Min Spend (RM)</Label>
            <Input
              type="number"
              placeholder="0"
              value={minSpend}
              onChange={e => update({ min: e.target.value || null })}
              className="h-9 w-28 inline-flex"
            />
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-muted-foreground">
              <X className="h-3.5 w-3.5 mr-1" />
              Clear all
              <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">
                {activeFilterCount}
              </span>
            </Button>
          )}
        </div>

        {/* Row 2: Tag pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Tag:</span>
          {(['all', 'New', 'Repeat', 'VIP', 'Dormant', 'Lost'] as TagFilter[]).map(t => (
            <button
              key={t}
              onClick={() => update({ tag: t })}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                tagFilter === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border bg-background hover:bg-muted',
              )}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>

        {/* Row 3: Brand pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Brand:</span>
          <button
            onClick={() => update({ brand: 'all' })}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              brandFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            All
          </button>
          {BRANDS.map(b => {
            const c = BRAND_COLORS[b]
            return (
              <button
                key={b}
                onClick={() => update({ brand: b })}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  brandFilter === b
                    ? `${c?.bg ?? ''} ${c?.text ?? ''} ${c?.border ?? ''}`
                    : 'border-border bg-background hover:bg-muted',
                )}
              >
                {b}
              </button>
            )
          })}
        </div>

        {/* Row 4: Date range */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Last order:</span>
          {[
            { label: '7d',  days: 7 },
            { label: '30d', days: 30 },
            { label: '90d', days: 90 },
          ].map(p => (
            <button
              key={p.label}
              onClick={() => setDatePreset(p.days)}
              className="h-8 px-2.5 rounded-md text-xs border border-border bg-background hover:bg-muted transition-colors"
            >
              Last {p.label}
            </button>
          ))}
          <input type="date" value={dateFrom} onChange={e => update({ from: e.target.value || null })}
            className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs" />
          <span className="text-muted-foreground text-xs">–</span>
          <input type="date" value={dateTo} onChange={e => update({ to: e.target.value || null })}
            className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs" />
          {(dateFrom || dateTo) && (
            <button onClick={() => update({ from: null, to: null })}
              className="text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading && !customers.length ? (
        <div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
      ) : customers.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm border rounded-lg">
          No customers found
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground">
                <TableHead className="min-w-[140px]">
                  <SortTh label="Name" col="name" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="text-right">
                  <SortTh label="Orders" col="total_orders" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortTh label="Total Spent" col="total_spent" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortTh label="Avg Order" col="average_order_value" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead>
                  <SortTh label="Last Order" col="last_order_date" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead className="text-right">Days Ago</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(c => {
                const days = c.last_order_date
                  ? differenceInDays(new Date(), new Date(c.last_order_date + 'T12:00:00'))
                  : null
                const daysColor = days == null ? '' : days > 90 ? 'text-red-600 font-bold' : days > 60 ? 'text-orange-600 font-medium' : days > 30 ? 'text-yellow-600' : 'text-green-600'
                const isOverdue = c.follow_up_date && c.follow_up_date <= todayStr

                return (
                  <TableRow key={c.id} className="hover:bg-muted/30 text-sm">
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:text-green-600 hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-xs font-mono">{c.phone}</span>
                        {c.phone && (
                          <a href={buildWALink(c.phone)} target="_blank" rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-700" title="WhatsApp">
                            <MessageCircle className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><TagBadge tag={c.customer_tag} /></TableCell>
                    <TableCell className="text-right font-semibold">{c.total_orders ?? 0}</TableCell>
                    <TableCell className="text-right text-xs">{formatCurrency(c.total_spent ?? 0)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(c.average_order_value ?? 0)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {c.last_order_date ? formatDate(c.last_order_date) : '—'}
                    </TableCell>
                    <TableCell className={`text-right text-xs ${daysColor}`}>
                      {days != null ? days : '—'}
                    </TableCell>
                    <TableCell><BrandBadge brand={c.preferred_brand} /></TableCell>
                    <TableCell>
                      {c.follow_up_date ? (
                        <button onClick={() => openFollowUp(c)}
                          className={`text-xs font-medium hover:underline ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                          {formatDate(c.follow_up_date)}{isOverdue ? ' ⚠' : ''}
                        </button>
                      ) : (
                        <button onClick={() => openFollowUp(c)}
                          className="text-xs text-muted-foreground hover:text-foreground">Set</button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {c.phone && (
                          <a href={buildWALink(c.phone)} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                            className="p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-700 transition-colors">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button onClick={() => openFollowUp(c)} title="Set follow-up"
                          className="p-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors">
                          <Calendar className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleMarkContacted(c.id)} disabled={isMarking} title="Mark contacted"
                          className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors disabled:opacity-40">
                          <UserCheck className="h-3.5 w-3.5" />
                        </button>
                        <Link href={`/customers/${c.id}`} title="View profile"
                          className="p-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()} customers
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => update({ page: page - 1 }, false)}
                  className="px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-2">{page + 1} / {totalPages}</span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => update({ page: page + 1 }, false)}
                  className="px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Follow-up dialog */}
      <Dialog open={!!fuCustomer} onOpenChange={open => { if (!open) setFuCustomer(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Follow-up — {fuCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Follow-up Date</Label>
              <input type="date" value={fuDate} onChange={e => setFuDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <textarea value={fuNote} onChange={e => setFuNote(e.target.value)} rows={3}
                placeholder="e.g. Check on reorder, send promotion..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveFollowUp} disabled={isSavingFU}>
                {isSavingFU ? 'Saving…' : 'Save Follow-up'}
              </Button>
              <Button variant="outline" onClick={() => setFuCustomer(null)}>Cancel</Button>
            </div>
            {fuCustomer?.follow_up_date && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground text-xs"
                onClick={() => { setFuDate(''); setFuNote('') }}>
                Clear follow-up date
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Page export (Suspense wrapper required for useSearchParams) ───────────────

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse bg-muted/20 rounded-lg" />}>
      <CustomersContent />
    </Suspense>
  )
}
