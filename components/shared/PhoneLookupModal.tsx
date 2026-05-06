'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Phone, X, CheckCircle2, XCircle, Loader2, Copy, Check, MessageCircle } from 'lucide-react'
import { lookupCustomerByPhone, type PhoneLookupResult } from '@/app/actions/customers'
import { formatCurrency } from '@/lib/utils'
import { BRAND_COLORS } from '@/lib/constants'
import { differenceInDays } from 'date-fns'

const TAG_BADGE: Record<string, string> = {
  New:     'bg-green-100 text-green-700 border-green-200',
  Repeat:  'bg-blue-100 text-blue-700 border-blue-200',
  VIP:     'bg-purple-100 text-purple-700 border-purple-200',
  Dormant: 'bg-orange-100 text-orange-700 border-orange-200',
  Lost:    'bg-red-100 text-red-700 border-red-200',
}

function normalizeInputPhone(raw: string): string {
  const s = raw.replace(/[\s\-]/g, '')
  if (s.startsWith('0')) return '6' + s
  return s
}

function isValidPhone(s: string): boolean {
  const n = s.replace(/[\s\-\+\(\)]/g, '')
  return /^(60\d{8,10}|0\d{8,10}|\d{9,11})$/.test(n)
}

export default function PhoneLookupModal() {
  const [open,    setOpen]    = useState(false)
  const [phone,   setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<PhoneLookupResult | null>(null)
  const [copied,  setCopied]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keyboard shortcut: Ctrl+L / Cmd+L
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const doLookup = useCallback(async (value: string) => {
    const normalized = normalizeInputPhone(value)
    if (!isValidPhone(normalized)) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      const res = await lookupCustomerByPhone(normalized)
      setResult(res)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(value: string) {
    setPhone(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doLookup(value), 500)
  }

  function handleSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    doLookup(phone)
  }

  function handleClose() {
    setOpen(false)
    setPhone('')
    setResult(null)
    setLoading(false)
    setCopied(false)
  }

  function handleCopy(found: Extract<PhoneLookupResult, { found: true }>) {
    const lines = [found.name, `No Tel: ${found.phone}`]
    if (found.address) lines.push(`Address: ${found.address}`)
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleWhatsApp(found: Extract<PhoneLookupResult, { found: true }>) {
    const name = encodeURIComponent(found.name)
    window.open(`https://wa.me/${found.phone}?text=Hi%20${name}`, '_blank')
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-muted transition-colors"
        title="Customer Lookup (Ctrl+L / ⌘L)"
      >
        <Phone className="h-4 w-4 text-muted-foreground" />
      </button>
    )
  }

  const found = result?.found === true ? result : null
  const daysAgo = found?.lastOrderDate
    ? differenceInDays(new Date(), new Date(found.lastOrderDate + 'T12:00:00'))
    : null
  const showInvalid = phone.length >= 5 && !isValidPhone(normalizeInputPhone(phone))

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl border bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold">Customer Lookup <span className="text-muted-foreground font-normal text-sm">客户查询</span></h2>
            <p className="text-xs text-muted-foreground mt-0.5">Check if a phone number has a purchase record</p>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="tel"
                value={phone}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="601xxxxxxxx  输入电话号码"
                className="w-full pl-9 pr-4 h-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || phone.length < 5}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '查询 Check'}
            </button>
          </div>
          {showInvalid && (
            <p className="text-xs text-destructive mt-1.5">Please enter a valid Malaysian phone number (e.g. 601xxxxxxxx)</p>
          )}
        </div>

        {/* Result */}
        {loading && (
          <div className="px-5 pb-6 text-sm text-muted-foreground text-center">Searching…</div>
        )}

        {!loading && result !== null && (
          <div className="px-5 pb-5 space-y-3">
            {found ? (
              <div className="rounded-xl border bg-muted/30 overflow-hidden">
                {/* Name + phone */}
                <div className="px-4 pt-4 pb-3 border-b">
                  <p className="font-bold text-lg leading-tight">{found.name}</p>
                  <p className="text-sm text-muted-foreground font-mono mt-0.5">{found.phone}</p>
                </div>

                {/* Brand badges */}
                {found.byBrand.length > 0 && (
                  <div className="px-4 py-2.5 border-b flex flex-wrap gap-1.5">
                    {found.byBrand.map(b => {
                      const color = BRAND_COLORS[b.brand]
                      return (
                        <span key={b.brand} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${color ? `${color.bg} ${color.text} ${color.border}` : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {b.brand} · {b.orders}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Eligibility badge */}
                <div className="px-4 py-3 border-b">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 bg-green-500 text-white">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-extrabold tracking-wide text-sm">ELIGIBLE ✅</p>
                      <p className="text-xs opacity-90">Has purchase record • 有购买记录</p>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-background px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                    <p className="font-semibold text-sm mt-0.5">{found.totalOrders}</p>
                  </div>
                  <div className="bg-background px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="font-semibold text-sm mt-0.5">{formatCurrency(found.totalSpent)}</p>
                  </div>
                  <div className="bg-background px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">First Order</p>
                    <p className="font-semibold text-sm mt-0.5">{found.firstOrderDate ?? '—'}</p>
                  </div>
                  <div className="bg-background px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">Last Order</p>
                    <p className="font-semibold text-sm mt-0.5">
                      {daysAgo !== null ? `${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago` : '—'}
                    </p>
                  </div>
                </div>

                {/* Customer tag */}
                {found.customerTag && (
                  <div className="px-4 py-2.5 border-t">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${TAG_BADGE[found.customerTag] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {found.customerTag}
                    </span>
                  </div>
                )}

                {/* Divider + action buttons */}
                <div className="border-t px-4 py-3 flex gap-2">
                  <button
                    onClick={() => handleCopy(found)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border bg-background hover:bg-muted transition-colors text-sm font-medium"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied! ✓' : 'Copy Details'}
                  </button>
                  <button
                    onClick={() => handleWhatsApp(found)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-green-500 hover:bg-green-600 transition-colors text-white text-sm font-medium"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3.5 bg-gray-200 text-gray-700">
                <XCircle className="h-6 w-6 shrink-0" />
                <div>
                  <p className="text-lg font-extrabold tracking-wide">NOT ELIGIBLE ❌</p>
                  <p className="text-sm">No purchase record found for this number</p>
                  <p className="text-xs opacity-75">此号码没有购买记录</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
