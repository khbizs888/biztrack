'use client'

import { useState, useMemo, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { setFollowUp, markContacted, refreshAllCustomerStats } from '@/app/actions/customer-crm'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BRAND_COLORS, BRANDS } from '@/lib/constants'
import {
  Users, Crown, RefreshCw, Bell, TrendingDown, UserCheck,
  MessageCircle, Calendar, ChevronUp, ChevronDown, ExternalLink,
} from 'lucide-react'
import { startOfMonth, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import type { CustomerCRM, CustomerTag } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const TAG_STYLES: Record<CustomerTag, string> = {
  New:     'bg-blue-100 text-blue-700 border-blue-200',
  Repeat:  'bg-green-100 text-green-700 border-green-200',
  VIP:     'bg-amber-100 text-amber-800 border-amber-300',
  Dormant: 'bg-orange-100 text-orange-700 border-orange-200',
  Lost:    'bg-red-100 text-red-700 border-red-200',
}

type SortKey = 'last_order_date' | 'total_spent' | 'total_orders' | 'days_since'
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
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TAG_STYLES[t]}`}>
      {t}
    </span>
  )
}

function BrandBadge({ brand }: { brand: string | null }) {
  if (!brand) return <span className="text-muted-foreground text-xs">—</span>
  const c = BRAND_COLORS[brand]
  if (!c) return <span className="text-xs">{brand}</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      {brand}
    </span>
  )
}

function SortTh({
  label, col, active, dir, onSort,
}: { label: string; col: SortKey; active: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void }) {
  return (
    <button
      onClick={() => onSort(col)}
      className="flex items-center gap-1 hover:text-foreground transition-colors whitespace-nowrap font-medium"
    >
      {label}
      {active === col
        ? dir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        : <ChevronDown className="h-3 w-3 opacity-25" />}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const supabase    = createClient()
  const queryClient = useQueryClient()

  const [tagFilter,    setTagFilter]    = useState<TagFilter>('all')
  const [brandFilter,  setBrandFilter]  = useState('all')
  const [search,       setSearch]       = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('last_order_date')
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc')

  const [fuCustomer, setFuCustomer] = useState<CustomerCRM | null>(null)
  const [fuDate,     setFuDate]     = useState('')
  const [fuNote,     setFuNote]     = useState('')

  const [isSavingFU,   startSavingFU]   = useTransition()
  const [isMarking,    startMarking]    = useTransition()
  const [isRefreshing, startRefreshing] = useTransition()

  const { data: customers = [], isLoading } = useQuery<CustomerCRM[]>({
    queryKey: ['customers-crm'],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('last_order_date', { ascending: false, nullsFirst: false })
      return (data ?? []) as CustomerCRM[]
    },
  })

  const thisMonthStart = startOfMonth(new Date()).toISOString().split('T')[0]

  const stats = useMemo(() => ({
    total:   customers.length,
    newMonth: customers.filter(c => c.first_order_date && c.first_order_date >= thisMonthStart).length,
    repeat:  customers.filter(c => c.customer_tag === 'Repeat').length,
    vip:     customers.filter(c => c.customer_tag === 'VIP').length,
    dormant: customers.filter(c => c.customer_tag === 'Dormant').length,
    lost:    customers.filter(c => c.customer_tag === 'Lost').length,
  }), [customers, thisMonthStart])

  const filtered = useMemo(() => {
    let list = [...customers]
    if (tagFilter !== 'all')   list = list.filter(c => c.customer_tag === tagFilter)
    if (brandFilter !== 'all') list = list.filter(c => c.preferred_brand === brandFilter)
    if (dateFrom) list = list.filter(c => c.last_order_date && c.last_order_date >= dateFrom)
    if (dateTo)   list = list.filter(c => c.last_order_date && c.last_order_date <= dateTo)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
    }
    list.sort((a, b) => {
      let av = 0, bv = 0
      if (sortKey === 'last_order_date') {
        av = a.last_order_date ? new Date(a.last_order_date).getTime() : 0
        bv = b.last_order_date ? new Date(b.last_order_date).getTime() : 0
      } else if (sortKey === 'total_spent') {
        av = a.total_spent ?? 0; bv = b.total_spent ?? 0
      } else if (sortKey === 'total_orders') {
        av = a.total_orders ?? 0; bv = b.total_orders ?? 0
      } else { // days_since — ascending = most dormant first
        av = a.last_order_date ? new Date(a.last_order_date).getTime() : 0
        bv = b.last_order_date ? new Date(b.last_order_date).getTime() : 0
        return sortDir === 'desc' ? av - bv : bv - av
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return list
  }, [customers, tagFilter, brandFilter, dateFrom, dateTo, search, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

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
        queryClient.invalidateQueries({ queryKey: ['customers-crm'] })
        setFuCustomer(null)
      } catch { toast.error('Failed to save') }
    })
  }

  function handleMarkContacted(customerId: string) {
    startMarking(async () => {
      try {
        await markContacted(customerId)
        toast.success('Marked as contacted')
        queryClient.invalidateQueries({ queryKey: ['customers-crm'] })
      } catch { toast.error('Failed') }
    })
  }

  function handleRefreshAll() {
    startRefreshing(async () => {
      try {
        const { updated } = await refreshAllCustomerStats()
        toast.success(`Stats refreshed for ${updated} customers`)
        queryClient.invalidateQueries({ queryKey: ['customers-crm'] })
      } catch { toast.error('Refresh failed') }
    })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  const summaryCards = [
    { label: 'Total Customers',  value: stats.total,   icon: Users,        color: 'text-gray-500',    tag: 'all'     as const },
    { label: 'New (this month)', value: stats.newMonth, icon: Users,        color: 'text-blue-600',    tag: 'New'     as const },
    { label: `Repeat (${stats.total > 0 ? Math.round(stats.repeat / stats.total * 100) : 0}%)`, value: stats.repeat, icon: RefreshCw, color: 'text-green-600', tag: 'Repeat' as const },
    { label: 'VIP',              value: stats.vip,     icon: Crown,        color: 'text-amber-600',   tag: 'VIP'     as const },
    { label: 'Dormant',          value: stats.dormant, icon: Bell,         color: 'text-orange-600',  tag: 'Dormant' as const },
    { label: 'Lost',             value: stats.lost,    icon: TrendingDown, color: 'text-red-600',     tag: 'Lost'    as const },
  ]

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Customers" description={`${filtered.length} of ${stats.total} customers`}>
        <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </PageHeader>

      {/* Summary cards — clickable tag filters */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color, tag }) => (
          <Card
            key={tag}
            onClick={() => setTagFilter(tag === tagFilter ? 'all' : tag)}
            className={`cursor-pointer transition-all hover:shadow-md ${tagFilter === tag ? 'ring-2 ring-primary shadow-md' : ''}`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <Icon className={`h-4 w-4 ${color} mb-1`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-end">
        <Input
          placeholder="Search name or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 w-56"
        />
        <Select value={tagFilter} onValueChange={v => setTagFilter(v as TagFilter)}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Tags" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {(['New', 'Repeat', 'VIP', 'Dormant', 'Lost'] as CustomerTag[]).map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Brands" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Last order:</Label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm" />
          <span className="text-muted-foreground text-xs">–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm border rounded-lg">
          No customers found
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground">
                <TableHead className="min-w-[140px]">Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="text-right">
                  <SortTh label="Orders" col="total_orders" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortTh label="Total Spent" col="total_spent" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead>
                  <SortTh label="Last Order" col="last_order_date" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortTh label="Days Ago" col="days_since" active={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const days     = c.last_order_date
                  ? differenceInDays(new Date(), new Date(c.last_order_date + 'T12:00:00'))
                  : null
                const daysColor = days == null ? '' : days > 90 ? 'text-red-600 font-bold' : days > 30 ? 'text-orange-600 font-medium' : 'text-muted-foreground'
                const isOverdue = c.follow_up_date && c.follow_up_date <= todayStr

                return (
                  <TableRow key={c.id} className="hover:bg-muted/30 text-sm">
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:text-green-600 hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{c.phone}</TableCell>
                    <TableCell><TagBadge tag={c.customer_tag} /></TableCell>
                    <TableCell className="text-right font-semibold">{c.total_orders ?? 0}</TableCell>
                    <TableCell className="text-right text-xs">{formatCurrency(c.total_spent ?? 0)}</TableCell>
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
                          className="text-xs text-muted-foreground hover:text-foreground">
                          Set
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {c.phone && (
                          <a href={buildWALink(c.phone)} target="_blank" rel="noopener noreferrer"
                            title="WhatsApp"
                            className="p-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-700 transition-colors">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button onClick={() => openFollowUp(c)} title="Set follow-up"
                          className="p-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors">
                          <Calendar className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleMarkContacted(c.id)} disabled={isMarking}
                          title="Mark contacted"
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
              <textarea
                value={fuNote} onChange={e => setFuNote(e.target.value)} rows={3}
                placeholder="e.g. Check on reorder, send promotion..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
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
