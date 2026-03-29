'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { orderSchema, type OrderFormData } from '@/lib/validations'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Package } from '@/lib/types'

interface Props { open: boolean; onClose: () => void }

export default function AddOrderModal({ open, onClose }: Props) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [returning, setReturning] = useState(false)
  const [foundCustomerId, setFoundCustomerId] = useState<string | null>(null)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: { status: 'pending', order_date: new Date().toISOString().split('T')[0] },
  })

  const selectedProjectId = watch('project_id')
  const selectedPackageName = watch('package_name')

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => { const { data } = await supabase.from('projects').select('*').order('name'); return data ?? [] },
  })

  const { data: packages } = useQuery({
    queryKey: ['packages', selectedProjectId],
    enabled: !!selectedProjectId,
    queryFn: async () => {
      const { data } = await supabase.from('packages').select('*').eq('project_id', selectedProjectId)
      return data ?? []
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products', selectedProjectId],
    enabled: !!selectedProjectId,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('project_id', selectedProjectId)
      return data ?? []
    },
  })

  useEffect(() => {
    if (selectedPackageName && packages) {
      const pkg = packages.find((p: Package) => p.name === selectedPackageName)
      if (pkg?.price) setValue('total_price', pkg.price)
    }
  }, [selectedPackageName, packages, setValue])

  async function lookupPhone() {
    const phone = watch('customer_phone')
    if (!phone) return
    setLookingUp(true)
    const { data } = await supabase.from('customers').select('*').eq('phone', phone).single()
    if (data) {
      setValue('customer_name', data.name)
      setFoundCustomerId(data.id)
      setReturning(true)
    } else {
      setFoundCustomerId(null)
      setReturning(false)
    }
    setLookingUp(false)
  }

  async function onSubmit(data: OrderFormData) {
    setLoading(true)
    let customerId = foundCustomerId

    if (!customerId) {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({ name: data.customer_name, phone: data.customer_phone })
        .select()
        .single()
      if (error) { toast.error('Failed to create customer'); setLoading(false); return }
      customerId = newCustomer.id
    }

    const { error } = await supabase.from('orders').insert({
      customer_id: customerId,
      project_id: data.project_id,
      product_name: data.product_name,
      package_name: data.package_name || null,
      total_price: data.total_price,
      status: data.status,
      order_date: data.order_date,
    })

    if (error) { toast.error('Failed to create order'); setLoading(false); return }
    toast.success('Order created successfully')
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    reset()
    setFoundCustomerId(null)
    setReturning(false)
    onClose()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Customer Phone</Label>
              <div className="flex gap-1">
                <Input placeholder="01x-xxxxxxx" {...register('customer_phone')} onBlur={lookupPhone} />
                {returning && <Badge variant="success" className="shrink-0 self-center">Returning</Badge>}
              </div>
              {errors.customer_phone && <p className="text-xs text-destructive">{errors.customer_phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Customer Name</Label>
              <Input placeholder="Full name" {...register('customer_name')} />
              {errors.customer_name && <p className="text-xs text-destructive">{errors.customer_name.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Project</Label>
            <Select onValueChange={v => setValue('project_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.project_id && <p className="text-xs text-destructive">{errors.project_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Product</Label>
              <Select onValueChange={v => setValue('product_name', v)}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p: any) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.product_name && <p className="text-xs text-destructive">{errors.product_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Package</Label>
              <Select onValueChange={v => setValue('package_name', v)}>
                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                <SelectContent>
                  {packages?.map((p: any) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Price (RM)</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('total_price')} />
              {errors.total_price && <p className="text-xs text-destructive">{errors.total_price.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select defaultValue="pending" onValueChange={v => setValue('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pending','processing','shipped','delivered','cancelled'].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Order Date</Label>
            <Input type="date" {...register('order_date')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Create Order'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
