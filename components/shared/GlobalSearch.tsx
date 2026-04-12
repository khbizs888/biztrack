'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, MessageCircle, Crown, CheckCircle2, AlertTriangle } from 'lucide-react'
import { globalSearch, type SearchResult, type CustomerSearchResult, type OrderSearchResult } from '@/app/actions/customer-crm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BRAND_COLORS } from '@/lib/constants'

const TAG_BADGE: Record<string, string> = {
  New:     'bg-blue-100 text-blue-700 border-blue-200',
  Repeat:  'bg-green-100 text-green-700 border-green-200',
  VIP:     'bg-amber-100 text-amber-800 border-amber-300',
  Dormant: 'bg-orange-100 text-orange-700 border-orange-200',
  Lost:    'bg-red-100 text-red-700 border-red-200',
}

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped:    'bg-indigo-100 text-indigo-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-gray-100 text-gray-500',
}

function buildWALink(phone: string | null | undefined): string {
  const cleaned = (phone || '').replace(/[\s\-]/g, '')
  if (cleaned.startsWith('+60')) return `https://wa.me/${cleaned.slice(1)}`
  if (cleaned.startsWith('60'))  return `https://wa.me/${cleaned}`
  if (cleaned.startsWith('0'))   return `https://wa.me/6${cleaned}`
  return `https://wa.me/6${cleaned}`
}

function VipBadge({ r }: { r: CustomerSearchResult }) {
  if (!r.isVip) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
        Not VIP
      </span>
    )
  }
  if (r.isInactiveVip) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300">
        <AlertTriangle className="h-3 w-3" />
        INACTIVE VIP
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
      <Crown className="h-3 w-3" />
      VIP
      <CheckCircle2 className="h-3 w-3 text-amber-600" />
    </span>
  )
}

function CustomerCard({ r, onNavigate }: { r: CustomerSearchResult; onNavigate: () => void }) {
  const waLink = r.phone ? buildWALink(r.phone) : null
  const brandColor = r.preferredBrand ? BRAND_COLORS[r.preferredBrand] : null

  return (
    <div
      className="p-4 hover:bg-muted/40 transition-colors cursor-pointer border-b last:border-b-0"
      onClick={onNavigate}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{r.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TAG_BADGE[r.tag] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              {r.tag}
            </span>
            <VipBadge r={r} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{r.phone}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {r.preferredBrand && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${brandColor ? `${brandColor.bg} ${brandColor.text} ${brandColor.border}` : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {r.preferredBrand}
              </span>
            )}
            {r.isVip && (
              <span className="text-xs text-amber-700">
                VIP requires RM {r.vipThreshold.toLocaleString()}
                {r.preferredBrand ? ` for ${r.preferredBrand}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <p className="font-semibold text-sm">{formatCurrency(r.totalSpent)}</p>
          <p className="text-xs text-muted-foreground">{r.totalOrders} order{r.totalOrders !== 1 ? 's' : ''}</p>
          {r.lastOrderDate && (
            <p className="text-xs text-muted-foreground">Last: {formatDate(r.lastOrderDate)}</p>
          )}
        </div>
      </div>
      {waLink && (
        <div className="mt-2.5 flex justify-end">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-green-700 border border-green-300 hover:bg-green-50 rounded-md px-2 py-1 transition-colors"
          >
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}

function OrderCard({ r, onNavigate }: { r: OrderSearchResult; onNavigate: () => void }) {
  const brandColor = r.projectCode ? BRAND_COLORS[r.projectCode] : null
  const statusStyle = STATUS_STYLES[r.status ?? ''] ?? 'bg-gray-100 text-gray-500'

  return (
    <div
      className="p-4 hover:bg-muted/40 transition-colors cursor-pointer border-b last:border-b-0"
      onClick={onNavigate}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-blue-700">{r.trackingNumber}</p>
          <p className="text-xs font-medium mt-0.5">{r.customerName}</p>
          {r.packageName && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{r.packageName}</p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="font-semibold text-sm">{formatCurrency(r.totalPrice)}</p>
          <div className="flex items-center gap-1.5 justify-end flex-wrap">
            {r.projectCode && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${brandColor ? `${brandColor.bg} ${brandColor.text} ${brandColor.border}` : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {r.projectCode}
              </span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${statusStyle}`}>
              {r.status}
            </span>
          </div>
          {r.orderDate && (
            <p className="text-xs text-muted-foreground">{formatDate(r.orderDate)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GlobalSearch() {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const inputRef  = useRef<HTMLInputElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router    = useRouter()

  const doSearch = useCallback((value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (value.length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await globalSearch(value)
        setResults(res)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }, 300)
  }, [])

  function close() {
    setOpen(false)
    setQuery('')
    setResults([])
  }

  function navigate(r: SearchResult) {
    if (r.type === 'customer') router.push(`/customers/${r.id}`)
    else router.push(`/customers/${r.customerId}`)
    close()
  }

  const showPanel = open && (loading || query.length >= 2)

  return (
    <div className="relative">
      {!open ? (
        <button
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Search customers, phones, tracking numbers…"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background shadow-sm w-80">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => doSearch(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && close()}
            placeholder="Search name, phone, tracking…"
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
          />
          <button onClick={close} className="shrink-0 p-0.5 hover:text-foreground">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-[600px] bg-background border rounded-xl shadow-2xl z-50 overflow-hidden">
          {loading && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">Searching…</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">
              No customers or orders found
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="max-h-[80vh] overflow-y-auto">
              {results.map((r, i) =>
                r.type === 'customer' ? (
                  <CustomerCard key={i} r={r} onNavigate={() => navigate(r)} />
                ) : (
                  <OrderCard key={i} r={r} onNavigate={() => navigate(r)} />
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
