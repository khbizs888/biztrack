'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, Package } from 'lucide-react'
import { globalSearch, type SearchResult } from '@/app/actions/customer-crm'
import { formatCurrency } from '@/lib/utils'

const TAG_BADGE: Record<string, string> = {
  New:     'bg-blue-100 text-blue-700',
  Repeat:  'bg-green-100 text-green-700',
  VIP:     'bg-amber-100 text-amber-800',
  Dormant: 'bg-orange-100 text-orange-700',
  Lost:    'bg-red-100 text-red-700',
}

export default function GlobalSearch() {
  const [open,      setOpen]      = useState(false)
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<SearchResult[]>([])
  const [loading,   setLoading]   = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const inputRef     = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router       = useRouter()

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function close() {
    setOpen(false)
    setQuery('')
    setResults([])
    setActiveIdx(-1)
  }

  const doSearch = useCallback((value: string) => {
    setQuery(value)
    setActiveIdx(-1)
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const target = activeIdx >= 0 ? results[activeIdx] : results[0]
      if (target) navigate(target)
    }
  }

  function navigate(r: SearchResult) {
    if (r.type === 'customer') router.push(`/customers/${r.id}`)
    else router.push(`/customers/${r.customerId}`)
    close()
  }

  const showDropdown = open && (results.length > 0 || loading || (query.length >= 2 && !loading))

  return (
    <div ref={containerRef} className="relative">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Search customers, phones, tracking numbers…"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background shadow-sm w-72 ${showDropdown ? 'rounded-b-none border-b-transparent' : ''}`}>
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => doSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search name, phone, tracking…"
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
          />
          <button onClick={close} className="shrink-0 p-0.5 hover:text-foreground">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {showDropdown && (
        <div className="absolute right-0 top-full w-72 bg-background border border-t-0 rounded-b-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-xs text-muted-foreground">Searching…</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">No results found</div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => navigate(r)}
              className={`w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-muted/60 transition-colors border-t first:border-t-0 ${i === activeIdx ? 'bg-muted' : ''}`}
            >
              {r.type === 'customer' ? (
                <>
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.phone}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TAG_BADGE[r.tag] ?? 'bg-gray-100 text-gray-700'}`}>
                      {r.tag}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatCurrency(r.totalSpent)}</span>
                  </div>
                </>
              ) : (
                <>
                  <Package className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium text-blue-700 truncate">{r.trackingNumber}</p>
                    <p className="text-xs text-muted-foreground">{r.customerName}</p>
                  </div>
                  <span className="text-xs text-blue-600 shrink-0">Track →</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
