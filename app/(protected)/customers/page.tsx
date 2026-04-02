'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useCustomers } from '@/lib/hooks/useCustomers'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Users } from 'lucide-react'
import type { CustomerStatus } from '@/lib/types'

const STATUS_BADGE: Record<CustomerStatus, { variant: string; label: string }> = {
  Active:   { variant: 'success',     label: 'Active' },
  New:      { variant: 'info',        label: 'New' },
  'At Risk':{ variant: 'warning',     label: 'At Risk' },
  Lapsed:   { variant: 'secondary',   label: 'Lapsed' },
  Churned:  { variant: 'destructive', label: 'Churned' },
}

export default function CustomersPage() {
  const router = useRouter()
  const supabase = createClient()
  const { data: customers, isLoading, error } = useCustomers()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name')
      return data ?? []
    },
  })

  const filtered = useMemo(() => {
    if (!customers) return []
    return customers.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
      const matchesProject =
        projectFilter === 'all' ||
        c.project_ids.includes(projectFilter)
      return matchesSearch && matchesProject
    })
  }, [customers, search, projectFilter])

  return (
    <div>
      <PageHeader title="Customer Data" description={`${filtered.length} customers`}>
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52"
        />
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load customers.</p>
      ) : !filtered.length ? (
        <EmptyState icon={Users} title="No customers found" />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>No. Tel</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Frequency</TableHead>
                <TableHead className="text-right">AOV</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead>First Purchase</TableHead>
                <TableHead>Last Purchase</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const badge = STATUS_BADGE[c.status]
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                      {c.address ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{c.order_count}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(c.avg_order_value)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(c.total_spend)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.first_order_date ? formatDate(c.first_order_date) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.last_order_date ? formatDate(c.last_order_date) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant as any}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
