'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateOrder } from '@/app/actions/data'
import { useProjects, type Package } from '@/lib/hooks/useProjects'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Order } from '@/lib/types'

const MALAYSIA_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang',
  'Penang', 'Perak', 'Perlis', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'Kuala Lumpur', 'Labuan', 'Putrajaya',
]

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
const PAYMENT_STATUSES = ['Settled', 'Pending']

interface Props { order: Order | null; onClose: () => void }

export default function EditOrderModal({ order, onClose }: Props) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const { projects } = useProjects()

  const [date, setDate]             = useState('')
  const [tracking, setTracking]     = useState('')
  const [projectId, setProjectId]   = useState('')
  const [packageId, setPackageId]   = useState('')
  const [packageName, setPackageName] = useState('')
  const [price, setPrice]           = useState('')
  const [channel, setChannel]       = useState('')
  const [state, setState]           = useState('')
  const [isCod, setIsCod]           = useState(false)
  const [paymentStatus, setPaymentStatus] = useState('Settled')
  const [status, setStatus]         = useState('pending')
  const [notes, setNotes]           = useState('')
  const [customState, setCustomState] = useState(false)

  useEffect(() => {
    if (!order) return
    setDate(order.order_date ?? '')
    setTracking(order.tracking_number ?? '')
    setProjectId(order.project_id ?? '')
    setPackageId(order.package_id ?? '')
    setPackageName(order.package_name ?? order.package_snapshot?.name ?? '')
    setPrice(String(order.total_price ?? ''))
    setChannel(order.channel ?? '')
    const orderState = order.state ?? ''
    setState(orderState)
    setCustomState(!!orderState && !MALAYSIA_STATES.includes(orderState))
    setIsCod(order.is_cod ?? false)
    setPaymentStatus(order.payment_status ?? 'Settled')
    setStatus(order.status ?? 'pending')
    setNotes(order.purchase_reason ?? '')
  }, [order])

  const projectPackages: Package[] = projects.find(p => p.id === projectId)?.packages ?? []

  function handlePackageSelect(pkgId: string) {
    if (pkgId === 'none') { setPackageId(''); setPackageName(''); return }
    const pkg = projectPackages.find(p => p.id === pkgId)
    if (!pkg) return
    setPackageId(pkg.id)
    setPackageName(pkg.name)
    setPrice(String(pkg.price))
  }

  async function handleSave() {
    if (!order) return
    setLoading(true)
    try {
      await updateOrder(order.id, {
        order_date: date,
        tracking_number: tracking || null,
        project_id: projectId || undefined,
        package_id: packageId || null,
        package_name: packageName || null,
        total_price: parseFloat(price) || 0,
        channel,
        state: state || null,
        is_cod: isCod,
        payment_status: paymentStatus,
        status,
        purchase_reason: notes || null,
      })
      toast.success('Order updated')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!order} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Order</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Date + Tracking */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Order Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tracking Number</Label>
              <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking #" />
            </div>
          </div>

          {/* Project + Channel */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Brand</Label>
              <Select value={projectId} onValueChange={v => { setProjectId(v); setPackageId(''); setPackageName('') }}>
                <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <Input value={channel} onChange={e => setChannel(e.target.value)} placeholder="e.g. Facebook" />
            </div>
          </div>

          {/* Package */}
          <div className="space-y-1">
            <Label className="text-xs">Package</Label>
            <Select value={packageId || 'none'} onValueChange={handlePackageSelect} disabled={!projectId}>
              <SelectTrigger><SelectValue placeholder={projectId ? 'Select package' : 'Pick brand first'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None / Manual —</SelectItem>
                {projectPackages.map(p => (
                  <SelectItem key={p.id} value={p.id}>[{p.code}] {p.name} — RM {p.price.toFixed(2)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!packageId && (
              <Input className="mt-1.5" value={packageName} onChange={e => setPackageName(e.target.value)} placeholder="Package / product name" />
            )}
          </div>

          {/* Price + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Total Price (RM)</Label>
              <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* State */}
          <div className="space-y-1">
            <Label className="text-xs">State</Label>
            <Select
              value={MALAYSIA_STATES.includes(state) ? state : state ? 'custom' : ''}
              onValueChange={v => {
                if (v === 'custom') { setCustomState(true); setState('') }
                else { setCustomState(false); setState(v) }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {MALAYSIA_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                <SelectItem value="custom">Other (International)</SelectItem>
              </SelectContent>
            </Select>
            {(customState || (state && !MALAYSIA_STATES.includes(state))) && (
              <Input value={state} onChange={e => setState(e.target.value)} placeholder="Enter state / country" />
            )}
          </div>

          {/* COD + Payment Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Payment Method</Label>
              <Select value={isCod ? 'cod' : 'prepaid'} onValueChange={v => setIsCod(v === 'cod')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prepaid">Prepaid</SelectItem>
                  <SelectItem value="cod">COD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Notes / Purchase Reason</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Weight loss" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
