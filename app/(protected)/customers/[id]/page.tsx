'use client'

import { use } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { customerSchema, type CustomerFormData } from '@/lib/validations'
import PageHeader from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingState'
import StatCard from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ShoppingCart, DollarSign, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import type { OrderStatus } from '@/lib/types'

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'warning',
  processing: 'info',
  shipped: 'secondary',
  delivered: 'success',
  cancelled: 'destructive',
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').eq('id', id).single()
      return data
    },
  })

  const { data: orders } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, projects(name, code)')
        .eq('customer_id', id)
        .order('order_date', { ascending: false })
      return data ?? []
    },
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    values: customer ? { name: customer.name, phone: customer.phone, address: customer.address ?? '' } : undefined,
  })

  async function onSubmit(data: CustomerFormData) {
    const { error } = await supabase.from('customers').update(data).eq('id', id)
    if (error) { toast.error('Failed to update customer'); return }
    toast.success('Customer updated')
    queryClient.invalidateQueries({ queryKey: ['customer', id] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
  }

  if (isLoading) return <LoadingSpinner />
  if (!customer) return <p className="text-muted-foreground">Customer not found.</p>

  const validOrders = orders?.filter(o => o.status !== 'cancelled') ?? []
  const totalSpend = validOrders.reduce((s, o) => s + Number(o.total_price), 0)
  const avgOrder = validOrders.length ? totalSpend / validOrders.length : 0

  return (
    <div className="space-y-6">
      <PageHeader title={customer.name} description={`Customer since ${formatDate(customer.created_at)}`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Orders" value={validOrders.length} icon={ShoppingCart} />
        <StatCard title="Lifetime Value" value={totalSpend} isCurrency icon={DollarSign} />
        <StatCard title="Avg Order Value" value={avgOrder} isCurrency icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Edit Customer</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input {...register('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input {...register('address')} />
              </div>
              <Button type="submit" size="sm" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Order History</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders?.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{formatDate(o.order_date)}</TableCell>
                      <TableCell className="text-sm">{o.product_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(o.projects as any)?.code ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(o.total_price))}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[o.status as OrderStatus] as any} className="capitalize">{o.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
