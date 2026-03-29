'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomers } from '@/lib/hooks/useCustomers'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Users } from 'lucide-react'
import type { CustomerStatus } from '@/lib/types'

const STATUS_COLORS: Record<CustomerStatus, string> = {
  Active: 'success',
  New: 'info',
  'At Risk': 'warning',
  Lapsed: 'secondary',
  Churned: 'destructive',
}

export default function CustomersPage() {
  const router = useRouter()
  const { data: customers, isLoading, error } = useCustomers()
  const [search, setSearch] = useState('')

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  ) ?? []

  return (
    <div>
      <PageHeader title="Customers" description={`${customers?.length ?? 0} total customers`}>
        <Input
          placeholder="Search name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-60"
        />
      </PageHeader>

      {isLoading ? <LoadingState /> : error ? (
        <p className="text-destructive text-sm">Failed to load customers.</p>
      ) : !filtered.length ? (
        <EmptyState icon={Users} title="No customers found" />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">AOV</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/customers/${c.id}`)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.address ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm">{c.order_count}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(c.avg_order_value)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(c.total_spend)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[c.status] as any}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.last_order_date ? formatDate(c.last_order_date) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
