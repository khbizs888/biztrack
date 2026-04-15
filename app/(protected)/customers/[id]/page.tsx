'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  setFollowUp, markContacted, updateCustomerNotes, refreshCustomerStats,
  changeCustomerTag, addCustomerRemark, fetchCustomerRemarks,
} from '@/app/actions/customer-crm'
import { uploadCustomerReceipt, removeCustomerReceipt } from '@/app/actions/customers'
import { exportOrders, type OrderWithDetails } from '@/lib/export-utils'
import PageHeader from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BRAND_COLORS } from '@/lib/constants'
import {
  MessageCircle, Crown, RefreshCw, Bell, TrendingDown, ShoppingCart,
  DollarSign, TrendingUp, Calendar, UserCheck, Phone, StickyNote,
  BarChart3, Tag, Send, Clock, ImageIcon, Upload, Trash2, Download,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import type { CustomerCRM, CustomerTag, OrderStatus } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TAG_STYLES: Record<CustomerTag, string> = {
  New:     'bg-blue-100 text-blue-700 border-blue-200',
  Repeat:  'bg-green-100 text-green-700 border-green-200',
  VIP:     'bg-amber-100 text-amber-800 border-amber-300',
  Dormant: 'bg-orange-100 text-orange-700 border-orange-200',
  Lost:    'bg-red-100 text-red-700 border-red-200',
}

const BRAND_HEX: Record<string, string> = {
  DD: '#3b82f6', FIOR: '#16a34a', Juji: '#f97316', KHH: '#a855f7', NE: '#ef4444',
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  shipped:    'bg-indigo-100 text-indigo-700 border-indigo-200',
  delivered:  'bg-green-100 text-green-700 border-green-200',
  cancelled:  'bg-gray-100 text-gray-500 border-gray-200',
}

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
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${TAG_STYLES[t]}`}>
      {t === 'VIP' && <Crown className="h-3.5 w-3.5" />}
      {t === 'Dormant' && <Bell className="h-3.5 w-3.5" />}
      {t === 'Lost' && <TrendingDown className="h-3.5 w-3.5" />}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase    = createClient()
  const queryClient = useQueryClient()

  // Follow-up form state
  const [fuDate,  setFuDate]  = useState('')
  const [fuNote,  setFuNote]  = useState('')
  const [notes,   setNotes]   = useState('')
  const [fuReady, setFuReady] = useState(false) // true after customer loads

  const [newRemark,    setNewRemark]    = useState('')
  const [isSavingFU,     startSavingFU]     = useTransition()
  const [isContacting,   startContacting]   = useTransition()
  const [isSavingNote,   startSavingNote]   = useTransition()
  const [isRefreshing,   startRefreshing]   = useTransition()
  const [isChangingTag,  startChangingTag]  = useTransition()
  const [isAddingRemark, startAddingRemark] = useTransition()

  const receiptInputRef = useRef<HTMLInputElement>(null)
  const [isUploading,  setIsUploading]  = useState(false)
  const [isRemoving,   setIsRemoving]   = useState(false)
  const [isExporting,  setIsExporting]  = useState(false)

  const { data: customer, isLoading } = useQuery<CustomerCRM | null>({
    queryKey: ['customer-crm', id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').eq('id', id).single()
      return data as CustomerCRM | null
    },
  })

  useEffect(() => {
    if (customer && !fuReady) {
      setFuDate(customer.follow_up_date ?? '')
      setFuNote(customer.follow_up_note ?? '')
      setNotes(customer.notes ?? '')
      setFuReady(true)
    }
  }, [customer, fuReady])

  const { data: remarks = [], refetch: refetchRemarks } = useQuery({
    queryKey: ['customer-remarks', id],
    queryFn: () => fetchCustomerRemarks(id),
  })

  const { data: orders = [] } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_date, created_at, total_price, status, payment_status, delivery_status, tracking_number, package_name, package_snapshot, channel, purchase_reason, remark, state, is_cod, projects(id, name, code)')
        .eq('customer_id', id)
        .order('order_date', { ascending: false })
      return data ?? []
    },
  })

  // Brand revenue breakdown from orders (with count and last order)
  const brandData = (() => {
    const map: Record<string, { revenue: number; orders: number; lastOrderDate: string | null }> = {}
    orders.filter(o => o.status !== 'cancelled').forEach(o => {
      const brand = (o.projects as any)?.code ?? 'Other'
      if (!map[brand]) map[brand] = { revenue: 0, orders: 0, lastOrderDate: null }
      map[brand].revenue += Number(o.total_price ?? 0)
      map[brand].orders++
      const d = o.order_date as string
      if (!map[brand].lastOrderDate || d > map[brand].lastOrderDate!) map[brand].lastOrderDate = d
    })
    return Object.entries(map)
      .map(([brand, v]) => ({ brand, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
  })()

  // Customer insights derived from orders
  const insights = (() => {
    const nonCancelled = orders.filter(o => o.status !== 'cancelled')
    // Purchase frequency: avg days between orders
    let avgDaysBetween: number | null = null
    if (nonCancelled.length >= 2) {
      const dates = [...nonCancelled].map(o => new Date(o.order_date)).sort((a, b) => a.getTime() - b.getTime())
      const totalDays = (dates[dates.length - 1].getTime() - dates[0].getTime()) / 86_400_000
      avgDaysBetween = Math.round(totalDays / (dates.length - 1))
    }
    // Preferred package
    const pkgCount: Record<string, number> = {}
    nonCancelled.forEach(o => {
      const name = o.package_name ?? (o.package_snapshot as any)?.name
      if (name) pkgCount[name] = (pkgCount[name] ?? 0) + 1
    })
    const preferredPkg = Object.entries(pkgCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    return { avgDaysBetween, preferredPkg }
  })()

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['customer-crm', id] })
    queryClient.invalidateQueries({ queryKey: ['customers-crm'] })
    queryClient.invalidateQueries({ queryKey: ['customers-page'] })
    queryClient.invalidateQueries({ queryKey: ['customer-stats'] })
  }

  function handleSaveFU() {
    startSavingFU(async () => {
      try {
        await setFollowUp(id, fuDate, fuNote)
        toast.success('Follow-up saved')
        invalidate()
      } catch { toast.error('Failed to save follow-up') }
    })
  }

  function handleMarkContacted() {
    startContacting(async () => {
      try {
        await markContacted(id)
        toast.success('Marked as contacted')
        invalidate()
      } catch { toast.error('Failed') }
    })
  }

  function handleSaveNotes() {
    startSavingNote(async () => {
      try {
        await updateCustomerNotes(id, notes)
        toast.success('Notes saved')
        invalidate()
      } catch { toast.error('Failed to save notes') }
    })
  }

  function handleRefreshStats() {
    startRefreshing(async () => {
      try {
        await refreshCustomerStats(id)
        toast.success('Stats refreshed')
        invalidate()
      } catch { toast.error('Failed to refresh stats') }
    })
  }

  function handleChangeTag(tag: string) {
    startChangingTag(async () => {
      try {
        await changeCustomerTag(id, tag as CustomerTag)
        toast.success(`Tag changed to ${tag}`)
        invalidate()
      } catch { toast.error('Failed to change tag') }
    })
  }

  function handleAddRemark() {
    if (!newRemark.trim()) return
    startAddingRemark(async () => {
      try {
        await addCustomerRemark(id, newRemark.trim())
        toast.success('Remark added')
        setNewRemark('')
        refetchRemarks()
      } catch { toast.error('Failed to add remark') }
    })
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setIsUploading(true)
    try {
      await uploadCustomerReceipt(id, formData)
      toast.success('Receipt uploaded')
      queryClient.invalidateQueries({ queryKey: ['customer-crm', id] })
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed')
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  async function handleRemoveReceipt() {
    if (!customer?.receipt_url) return
    const match = customer.receipt_url.match(/\/receipts\/(.+)$/)
    const storagePath = match?.[1] ?? ''
    setIsRemoving(true)
    try {
      await removeCustomerReceipt(id, storagePath)
      toast.success('Receipt removed')
      queryClient.invalidateQueries({ queryKey: ['customer-crm', id] })
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove receipt')
    } finally {
      setIsRemoving(false)
    }
  }

  function handleExportCSV() {
    if (!orders.length) { toast.info('No orders to export'); return }
    setIsExporting(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const safeName = (customer?.name ?? 'customer').replace(/[^a-zA-Z0-9]/g, '')

      // Group by brand; export each brand as a separate file
      const byBrand: Record<string, OrderWithDetails[]> = {}
      for (const o of orders) {
        const brand = (o.projects as any)?.code ?? 'Unknown'
        if (!byBrand[brand]) byBrand[brand] = []
        // Inject customer info (the orders query is customer-scoped, no customer join)
        byBrand[brand].push({
          ...(o as any),
          customers: {
            id,
            name:        customer?.name ?? '',
            phone:       customer?.phone ?? null,
            address:     customer?.address ?? null,
            receipt_url: customer?.receipt_url ?? null,
          },
        } as OrderWithDetails)
      }

      for (const [brand, brandOrders] of Object.entries(byBrand)) {
        exportOrders(brandOrders, brand, `${brand}_${safeName}_${today}.csv`)
      }
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!customer) return <p className="text-muted-foreground">Customer not found.</p>

  const waLink = customer.phone ? buildWALink(customer.phone) : null
  const memberSince = formatDate(customer.created_at)
  const lastContactedStr = customer.last_contacted_at
    ? format(new Date(customer.last_contacted_at), 'dd MMM yyyy, HH:mm')
    : null
  const daysSinceLast = customer.last_order_date
    ? differenceInDays(new Date(), new Date(customer.last_order_date + 'T12:00:00'))
    : null

  return (
    <div className="space-y-6 pb-10">
      {/* Profile Header */}
      <PageHeader
        title={customer.name}
        description={`Member since ${memberSince}`}
      >
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50">
              <MessageCircle className="h-4 w-4 mr-1.5" />
              WhatsApp
            </Button>
          </a>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => handleExportCSV()} disabled={isExporting}>
          <Download className={`h-4 w-4 mr-1.5 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleRefreshStats} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      {/* Tag + quick stats */}
      <div className="flex flex-wrap items-center gap-3">
        <TagBadge tag={customer.customer_tag} />
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          {customer.phone}
        </span>
        {daysSinceLast != null && (
          <span className={`text-sm font-medium ${daysSinceLast > 90 ? 'text-red-600' : daysSinceLast > 30 ? 'text-orange-600' : 'text-muted-foreground'}`}>
            Last order {daysSinceLast} days ago
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: String(customer.total_orders ?? 0), icon: ShoppingCart, color: 'bg-green-50 text-green-600' },
          { label: 'Total Spent', value: formatCurrency(customer.total_spent ?? 0), icon: DollarSign, color: 'bg-blue-50 text-blue-600' },
          { label: 'Avg Order Value', value: formatCurrency(customer.average_order_value ?? 0), icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
          { label: 'Member Since', value: memberSince, icon: Calendar, color: 'bg-gray-50 text-gray-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold mt-1">{value}</p>
                </div>
                <div className={`p-2 rounded-lg ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customer Insights Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Customer Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Purchase Frequency</p>
              <p className="font-semibold">
                {insights.avgDaysBetween != null ? `Every ${insights.avgDaysBetween} days` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Preferred Brand</p>
              <p className="font-semibold">{customer.preferred_brand ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Preferred Package</p>
              <p className="font-semibold text-xs truncate" title={insights.preferredPkg ?? ''}>
                {insights.preferredPkg ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Preferred Platform</p>
              <p className="font-semibold">{customer.preferred_platform ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Receipt */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-blue-500" />
            Payment Receipt
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customer.receipt_url ? (
            <div className="space-y-3">
              <a href={customer.receipt_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={customer.receipt_url}
                  alt="Payment receipt"
                  className="max-h-[200px] rounded-lg border object-contain cursor-pointer hover:opacity-80 transition-opacity"
                />
              </a>
              {customer.receipt_uploaded_at && (
                <p className="text-xs text-muted-foreground">
                  Uploaded: {format(new Date(customer.receipt_uploaded_at), 'dd MMM yyyy')}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => receiptInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleRemoveReceipt}
                  disabled={isRemoving}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {isRemoving ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => receiptInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click or drag to upload receipt</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, PDF</p>
            </div>
          )}
          {isUploading && (
            <p className="text-xs text-muted-foreground mt-2 animate-pulse">Uploading…</p>
          )}
          <input
            ref={receiptInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={handleReceiptUpload}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Follow-up + Notes + Change Tag */}
        <div className="space-y-4">
          {/* Follow-up */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-500" />
                Follow-up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lastContactedStr && (
                <p className="text-xs text-muted-foreground">
                  Last contacted: <span className="font-medium text-foreground">{lastContactedStr}</span>
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Follow-up Date</Label>
                <input type="date" value={fuDate} onChange={e => setFuDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Note</Label>
                <textarea value={fuNote} onChange={e => setFuNote(e.target.value)} rows={3}
                  placeholder="e.g. Check on reorder, special offer..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <Button className="w-full" size="sm" onClick={handleSaveFU} disabled={isSavingFU}>
                {isSavingFU ? 'Saving…' : 'Save Follow-up'}
              </Button>
              <Button variant="outline" className="w-full" size="sm" onClick={handleMarkContacted} disabled={isContacting}>
                <UserCheck className="h-4 w-4 mr-1.5" />
                {isContacting ? 'Saving…' : 'Mark as Contacted'}
              </Button>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-blue-500" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                placeholder="Internal notes about this customer..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
              <Button variant="outline" className="w-full" size="sm" onClick={handleSaveNotes} disabled={isSavingNote}>
                {isSavingNote ? 'Saving…' : 'Save Notes'}
              </Button>
            </CardContent>
          </Card>

          {/* Change Tag */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Override Customer Tag</Label>
                <Select
                  value={customer.customer_tag ?? 'New'}
                  onValueChange={handleChangeTag}
                  disabled={isChangingTag}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['New', 'Repeat', 'VIP', 'Dormant', 'Lost'] as CustomerTag[]).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isChangingTag && <p className="text-xs text-muted-foreground">Saving…</p>}
              </div>
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="outline" size="sm" className="w-full text-green-700 border-green-300 hover:bg-green-50">
                    <MessageCircle className="h-4 w-4 mr-1.5" />
                    Open WhatsApp
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          {/* Brand preference */}
          {brandData.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  Brand Preference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.min(brandData.length * 44, 180)}>
                  <BarChart
                    data={brandData}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 10 }}
                      tickFormatter={v => `RM${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="brand" tick={{ fontSize: 12, fontWeight: 600 }} width={40} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {brandData.map(d => (
                        <Cell key={d.brand} fill={BRAND_HEX[d.brand] ?? '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {brandData.map(d => {
                    const total = brandData.reduce((s, x) => s + x.revenue, 0)
                    const pct   = total > 0 ? (d.revenue / total * 100).toFixed(0) : '0'
                    const c = BRAND_COLORS[d.brand]
                    return (
                      <div key={d.brand} className="flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded-full border font-medium ${c ? `${c.bg} ${c.text} ${c.border}` : 'bg-gray-100 text-gray-700'}`}>
                          {d.brand}
                        </span>
                        <span className="text-muted-foreground">{formatCurrency(d.revenue)} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Purchase History */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Purchase History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  No orders yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Brand</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center">Payment</TableHead>
                        <TableHead>Tracking #</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map(o => {
                        const brand     = (o.projects as any)?.code ?? null
                        const pkgName   = o.package_name ?? (o.package_snapshot as any)?.name ?? '—'
                        const status    = o.status as OrderStatus
                        const isSettled = o.payment_status === 'Settled'

                        return (
                          <TableRow key={o.id} className="text-sm hover:bg-muted/30">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(o.order_date)}
                            </TableCell>
                            <TableCell className="text-center">
                              <BrandBadge brand={brand} />
                            </TableCell>
                            <TableCell className="text-xs max-w-[160px] truncate">{pkgName}</TableCell>
                            <TableCell className="text-right font-medium text-xs whitespace-nowrap">
                              {formatCurrency(Number(o.total_price ?? 0))}
                              {o.is_cod && <span className="ml-1 text-amber-600 text-xs">(COD)</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                {o.status}
                              </span>
                              {o.payment_status && (
                                <div className={`text-xs mt-0.5 ${isSettled ? 'text-green-600' : 'text-amber-600'}`}>
                                  {o.payment_status}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {o.tracking_number ?? '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Brand Breakdown Table */}
      {brandData.length > 1 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Brand Spend Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Brand</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Orders</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total Spent</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">% of Total</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Last Order</th>
                  </tr>
                </thead>
                <tbody>
                  {brandData.map((d, i) => {
                    const totalSpent = brandData.reduce((s, x) => s + x.revenue, 0)
                    const pct = totalSpent > 0 ? (d.revenue / totalSpent * 100).toFixed(1) : '0'
                    const isPrimary = i === 0
                    const c = BRAND_COLORS[d.brand]
                    return (
                      <tr key={d.brand} className={`border-b hover:bg-muted/30 ${isPrimary ? 'font-semibold' : ''}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${c ? `${c.bg} ${c.text} ${c.border}` : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {d.brand}
                            </span>
                            {isPrimary && (
                              <span className="text-yellow-500 text-xs" title="Primary brand">★</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">{d.orders}</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(d.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{pct}%</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {d.lastOrderDate ? formatDate(d.lastOrderDate) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remarks / Notes History */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-indigo-500" />
            Remarks History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add remark */}
          <div className="flex gap-2">
            <textarea
              value={newRemark}
              onChange={e => setNewRemark(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddRemark() } }}
              rows={2}
              placeholder="Add a remark… (Enter to save)"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              onClick={handleAddRemark}
              disabled={isAddingRemark || !newRemark.trim()}
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Remark list */}
          {remarks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No remarks yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {remarks.map(r => (
                <div key={r.id} className="rounded-lg bg-muted/40 border px-3 py-2">
                  <p className="text-sm">{r.remark}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
