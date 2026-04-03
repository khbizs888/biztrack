'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import CampaignModal from '@/components/modules/campaigns/CampaignModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const BRANDS    = ['FIOR', 'NE', 'DD', 'KHH', 'Juji']
const PLATFORMS = ['Facebook', 'TikTok', 'Shopee Ads', 'Lazada Ads', 'Google', 'Instagram', 'Other']
const STATUSES  = ['Draft', 'Active', 'Paused', 'Completed']

const STATUS_COLORS: Record<string, string> = {
  'Draft':     'bg-gray-100 text-gray-700',
  'Active':    'bg-green-100 text-green-700',
  'Paused':    'bg-yellow-100 text-yellow-700',
  'Completed': 'bg-blue-100 text-blue-700',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [brand, setBrand]         = useState('all')
  const [platform, setPlatform]   = useState('all')
  const [status, setStatus]       = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editCampaign, setEditCampaign] = useState<any | null>(null)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    if (brand !== 'all')    q = q.eq('brand', brand)
    if (platform !== 'all') q = q.eq('platform', platform)
    if (status !== 'all')   q = q.eq('status', status)
    const { data, error } = await q
    if (error) { toast.error('Failed to load campaigns'); setLoading(false); return }
    setCampaigns(data ?? [])
    setLoading(false)
  }, [brand, platform, status])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign?')) return
    const { error } = await createClient().from('campaigns').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Campaign deleted')
    fetchCampaigns()
  }

  const totalBudget = campaigns.reduce((s, c) => s + Number(c.budget), 0)
  const totalSpent  = campaigns.reduce((s, c) => s + Number(c.spent), 0)

  return (
    <div>
      <PageHeader title="Marketing Campaigns" description={`${campaigns.length} campaigns`}>
        <Button size="sm" onClick={() => { setEditCampaign(null); setShowModal(true) }}>
          <Plus className="h-4 w-4 mr-1" />Add Campaign
        </Button>
      </PageHeader>

      {/* Summary */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Budget</p>
            <p className="text-lg font-semibold">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-lg font-semibold">{formatCurrency(totalSpent)}</p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Budget Remaining</p>
            <p className={cn('text-lg font-semibold', totalBudget - totalSpent < 0 ? 'text-red-600' : 'text-green-600')}>
              {formatCurrency(totalBudget - totalSpent)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Brand" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No campaigns yet"
          description="Create your first marketing campaign to start tracking ad spend."
          action={{ label: 'Add Campaign', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Objective</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Budget vs Spent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(c => {
                const budget  = Number(c.budget)
                const spent   = Number(c.spent)
                const pct     = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
                const overBudget = spent > budget
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.brand}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.platform}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.objective}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(c.start_date)}
                      {c.end_date && <> – {formatDate(c.end_date)}</>}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[140px]">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{formatCurrency(spent)}</span>
                          <span className="text-muted-foreground">{formatCurrency(budget)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', overBudget ? 'bg-red-500' : 'bg-primary')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{pct.toFixed(0)}% used</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {c.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditCampaign(c); setShowModal(true) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CampaignModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={fetchCampaigns}
        campaign={editCampaign}
      />
    </div>
  )
}
