'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProjects, type Package } from '@/lib/hooks/useProjects'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  fetchCustomerByPhone, upsertCustomer, upsertCustomerByNameOnly, createOrder, generateOrderId,
} from '@/app/actions/data'
import { changeCustomerTag } from '@/app/actions/customer-crm'
import { setCustomerReceiptUrl } from '@/app/actions/customers'
import type { CustomerTag } from '@/lib/types'

const CHANNELS = [
  'FB', 'WhatsApp', 'Shopee', 'FB ENG', 'Lazada', 'Staff', 'WhatsApp ENG', 'Shopee SG',
] as const

const RECEIPT_BRANDS = ['NE', 'DD', 'Juji']
const AUTO_ID_BRANDS = ['DD', 'Juji', 'NE']

interface Props {
  open: boolean
  onClose: () => void
  defaultProjectId?: string
}

export default function TeamAddOrderModal({ open, onClose, defaultProjectId }: Props) {
  const queryClient = useQueryClient()
  const { projects } = useProjects()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const todayDisplay = `今天 · ${now.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const [loading, setLoading] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [foundCustomerId, setFoundCustomerId] = useState<string | null>(null)

  const [projectId, setProjectId] = useState('')
  const [channel, setChannel] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [packageId, setPackageId] = useState<string | null>(null)
  const [remark, setRemark] = useState('')
  const [newRepeat, setNewRepeat] = useState<'New' | 'Repeat' | ''>('')
  const [receiptLink, setReceiptLink] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ channel?: string; customerName?: string; packageId?: string }>({})

  const effectiveProjectId = defaultProjectId ?? projectId
  const currentProject = projects.find(p => p.id === effectiveProjectId)
  const brandName = currentProject?.name ?? ''
  const showReceiptLink = RECEIPT_BRANDS.includes(brandName)
  const projectPackages: Package[] = currentProject?.packages ?? []

  async function lookupPhone() {
    if (!phone || phone.length < 8) return
    setLookingUp(true)
    try {
      const customer = await fetchCustomerByPhone(phone)
      if (customer) {
        setCustomerName(customer.name)
        setFoundCustomerId(customer.id)
      }
    } finally {
      setLookingUp(false)
    }
  }

  function handlePackageSelect(pid: string) {
    setPackageId(pid === 'none' ? null : pid)
    setFieldErrors(p => ({ ...p, packageId: undefined }))
  }

  async function handleSubmit() {
    const errs: { channel?: string; customerName?: string; packageId?: string } = {}
    if (!channel) errs.channel = '请选择渠道'
    if (!customerName.trim()) errs.customerName = '请填写名字'
    if (!packageId) errs.packageId = '请选择配套'

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setLoading(true)

    try {
      // 1. Resolve customer
      let customerId = foundCustomerId
      if (!customerId) {
        if (phone.trim()) {
          customerId = await upsertCustomer(customerName.trim(), phone.trim())
        } else {
          customerId = await upsertCustomerByNameOnly(customerName.trim())
        }
      }

      // 2. Auto-generate tracking number for DD/Juji/NE
      let trackingNumber: string | null = null
      if (AUTO_ID_BRANDS.includes(brandName) && effectiveProjectId) {
        try { trackingNumber = await generateOrderId(effectiveProjectId) } catch { /* best-effort */ }
      }

      // 3. Resolve package
      const pkg = projectPackages.find(p => p.id === packageId)

      // 4. Create order
      await createOrder({
        customer_id: customerId,
        project_id: effectiveProjectId,
        package_id: packageId,
        product_name: pkg?.name ?? '',
        package_name: pkg?.name ?? null,
        total_price: pkg?.price ?? 0,
        status: 'pending',
        order_date: todayStr,
        channel,
        purchase_reason: remark.trim() || null,
        is_new_customer: newRepeat === 'New',
        tracking_number: trackingNumber,
        state: null,
        address: null,
      })

      // 5. Update customer tag if selected
      if (customerId && newRepeat) {
        try { await changeCustomerTag(customerId, newRepeat as CustomerTag) } catch { /* best-effort */ }
      }

      // 6. Update receipt URL if provided and brand supports it
      if (customerId && receiptLink.trim() && showReceiptLink) {
        try { await setCustomerReceiptUrl(customerId, receiptLink.trim()) } catch { /* best-effort */ }
      }

      toast.success('Order created')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      handleClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setChannel('')
    setCustomerName('')
    setPhone('')
    setPackageId(null)
    setRemark('')
    setNewRepeat('')
    setReceiptLink('')
    setFieldErrors({})
    setFoundCustomerId(null)
    setProjectId('')
    onClose()
  }

  const selectedPkg = projectPackages.find(p => p.id === packageId)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>新增订单</DialogTitle></DialogHeader>
        <div className="space-y-3">

          {/* 1. Date (read-only) */}
          <div className="space-y-1">
            <Label>日期</Label>
            <div className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">{todayDisplay}</div>
          </div>

          {/* Project selector — only shown when no defaultProjectId */}
          {!defaultProjectId && (
            <div className="space-y-1">
              <Label>Brand / Project <span className="text-red-500">*</span></Label>
              <Select value={projectId} onValueChange={v => { setProjectId(v); setPackageId(null) }}>
                <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 2. Channel */}
          <div className="space-y-1">
            <Label>Channel <span className="text-red-500">*</span></Label>
            <Select value={channel} onValueChange={v => { setChannel(v); setFieldErrors(p => ({ ...p, channel: undefined })) }}>
              <SelectTrigger className={cn(fieldErrors.channel && 'border-red-500')}>
                <SelectValue placeholder="选择渠道" />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {fieldErrors.channel && <p className="text-xs text-red-500">{fieldErrors.channel}</p>}
          </div>

          {/* 3. Customer Name */}
          <div className="space-y-1">
            <Label>名字 <span className="text-red-500">*</span></Label>
            <Input
              placeholder="Customer name"
              value={customerName}
              onChange={e => { setCustomerName(e.target.value); setFieldErrors(p => ({ ...p, customerName: undefined })) }}
              className={cn(fieldErrors.customerName && 'border-red-500')}
            />
            {fieldErrors.customerName && <p className="text-xs text-red-500">{fieldErrors.customerName}</p>}
          </div>

          {/* 4. Phone */}
          <div className="space-y-1">
            <Label>电话号码</Label>
            <Input
              placeholder="01x-xxxxxxx"
              value={phone}
              onChange={e => { setPhone(e.target.value); setFoundCustomerId(null) }}
              onBlur={lookupPhone}
            />
            {lookingUp && <p className="text-xs text-muted-foreground">Looking up…</p>}
            {foundCustomerId && !lookingUp && <p className="text-xs text-green-600">Found existing customer</p>}
          </div>

          {/* 5. Package */}
          <div className="space-y-1">
            <Label>Package <span className="text-red-500">*</span></Label>
            <Select
              value={packageId ?? 'none'}
              onValueChange={handlePackageSelect}
              disabled={!effectiveProjectId}
            >
              <SelectTrigger className={cn(fieldErrors.packageId && 'border-red-500')}>
                <SelectValue placeholder={effectiveProjectId ? '选择配套' : '先选择品牌'} />
              </SelectTrigger>
              <SelectContent>
                {projectPackages.length === 0 && (
                  <SelectItem value="none" disabled>No packages defined</SelectItem>
                )}
                {projectPackages.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — RM {p.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.packageId && <p className="text-xs text-red-500">{fieldErrors.packageId}</p>}
            {selectedPkg && <p className="text-xs text-green-600">RM {selectedPkg.price.toFixed(2)}</p>}
          </div>

          {/* 6. Remark */}
          <div className="space-y-1">
            <Label>Remark</Label>
            <textarea
              rows={2}
              placeholder="Optional…"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* 7. New / Repeat */}
          <div className="space-y-1">
            <Label>New / Repeat</Label>
            <Select
              value={newRepeat || 'unset'}
              onValueChange={v => setNewRepeat(v === 'unset' ? '' : v as 'New' | 'Repeat')}
            >
              <SelectTrigger><SelectValue placeholder="选择 (可选)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">— Not set —</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Repeat">Repeat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 8. Receipt Link (NE / DD / Juji only) */}
          {showReceiptLink && (
            <div className="space-y-1">
              <Label>Receipt Link</Label>
              <Input
                placeholder="Paste receipt URL…"
                value={receiptLink}
                onChange={e => setReceiptLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Saved to customer profile</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="button" disabled={loading} onClick={handleSubmit}>
              {loading ? 'Saving…' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
