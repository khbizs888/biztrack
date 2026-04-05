'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import {
  fetchProjects,
  fetchActivePackages,
  bulkUpsertCustomers,
  bulkInsertOrders,
  fetchExistingTrackingNumbers,
} from '@/app/actions/data'
import { processOrdersBatch } from '@/app/actions/order-processing'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Upload, AlertCircle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import type { Project } from '@/lib/types'

type RowError = 'missing_name' | 'missing_phone' | 'invalid_price' | 'missing_date'
type RowStatus = 'ready' | 'error'

interface ParsedRow {
  orderRef: string
  date: string
  customerName: string
  phone: string
  packageName: string
  trackingNumber: string | null
  totalPrice: number
  channel: string
  address: string
  isRepeat: boolean
  projectId: string | null
  packageId: string | null
  productName: string
  errors: RowError[]
  status: RowStatus
}

interface ImportResult {
  success: number
  skipped: number
  errors: number
  errorDetails: string[]
}

// ─── Parse helpers ───────────────────────────────────────────────────────────

function parseDate(raw: string): string {
  const s = raw.trim()
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0]
}

function parsePrice(raw: string): number {
  return parseFloat(raw.replace(/RM/gi, '').replace(/,/g, '').trim())
}

function col(raw: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    for (const rk of Object.keys(raw)) {
      if (rk.trim().toLowerCase() === k.toLowerCase()) return (raw[rk] ?? '').trim()
    }
  }
  return ''
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-]/g, '')
}

function matchProject(channel: string, projects: Project[]): Project | undefined {
  const c = channel.trim().toLowerCase()
  return projects.find(p => p.name.toLowerCase() === c || p.code.toLowerCase() === c)
}

function errorLabel(e: RowError): string {
  return {
    missing_name:  'Missing name',
    missing_phone: 'Missing phone',
    invalid_price: 'Invalid price',
    missing_date:  'Missing date',
  }[e]
}

interface Props { open: boolean; onClose: () => void }

export default function ImportOrdersModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const { data: allPackages = [] } = useQuery({
    queryKey: ['packages-all'],
    queryFn: fetchActivePackages,
  })

  function findPackageId(packageName: string, projectId: string | null): string | null {
    if (!packageName || !projectId) return null
    const pool = allPackages.filter(p => p.project_id === projectId)
    const byCode = pool.find(p => p.code && p.code.toLowerCase() === packageName.toLowerCase())
    if (byCode) return byCode.id
    const byName = pool.find(p => p.name.toLowerCase() === packageName.toLowerCase())
    return byName?.id ?? null
  }

  // ── File parsing ─────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.replace(/^\uFEFF/, '').trim(),
      complete: result => {
        const parsed: ParsedRow[] = []

        for (const raw of result.data) {
          const customerName = col(raw, 'Name')
          if (!customerName) continue

          const orderRef    = col(raw, '线上单号')
          const dateRaw     = col(raw, 'Date')
          const channel     = col(raw, 'Channel')
          const phoneRaw    = col(raw, 'Phone no', 'Phone number')
          const packageName = col(raw, 'Package')
          const priceRaw    = col(raw, 'Total Price')
          const address     = col(raw, 'Address line (1)')
          const repeatRaw   = col(raw, 'new/repeat Manual')
          const trackingRaw = col(raw, 'Tracking Number', 'Tracking', 'AWB')

          const phone          = normalizePhone(phoneRaw)
          const totalPrice     = parsePrice(priceRaw)
          const date           = parseDate(dateRaw)
          const isRepeat       = repeatRaw.trim().toLowerCase() === 'repeat'
          const matched        = matchProject(channel, projects)
          const projectId      = matched?.id ?? null
          const packageId      = findPackageId(packageName, projectId)
          const trackingNumber = trackingRaw || null

          const errors: RowError[] = []
          if (!phone)            errors.push('missing_phone')
          if (!dateRaw)          errors.push('missing_date')
          if (isNaN(totalPrice)) errors.push('invalid_price')

          parsed.push({
            orderRef,
            date,
            customerName,
            phone,
            packageName,
            trackingNumber,
            totalPrice: isNaN(totalPrice) ? 0 : totalPrice,
            channel,
            address,
            isRepeat,
            projectId,
            packageId,
            productName: packageName || channel || '—',
            errors,
            status: errors.length > 0 ? 'error' : 'ready',
          })
        }

        if (!parsed.length) {
          toast.error('No valid rows found.')
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }

        setRows(parsed)
        setStep('preview')
      },
      error: () => {
        toast.error('Failed to parse CSV.')
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
    })
  }

  // ── Import (2-step) ──────────────────────────────────────────────────────

  async function handleImport() {
    setImporting(true)
    const validRows    = rows.filter(r => r.status === 'ready')
    let skippedCount   = rows.filter(r => r.status === 'error').length
    let errorCount     = 0
    const errorDetails: string[] = []

    try {
      // Step 1a: Upsert customers
      const customerRows = validRows.map(r => ({
        name: r.customerName,
        phone: r.phone,
        address: r.address || null,
      }))
      const customerMap = await bulkUpsertCustomers(customerRows)

      // Step 1b: Check duplicate tracking numbers
      const trackingNumbers = validRows
        .map(r => r.trackingNumber)
        .filter((t): t is string => t !== null)

      const existingTrackingArr = trackingNumbers.length > 0
        ? await fetchExistingTrackingNumbers(trackingNumbers)
        : []
      const existingTracking = new Set<string>(existingTrackingArr)

      // Step 1c: Build order payloads, skip duplicates
      const toInsert: object[] = []
      for (const r of validRows) {
        if (r.trackingNumber && existingTracking.has(r.trackingNumber)) {
          skippedCount++
          continue
        }
        toInsert.push({
          customer_id:     customerMap[r.phone] ?? null,
          project_id:      r.projectId,
          package_id:      r.packageId,
          product_name:    r.productName,
          package_name:    r.packageName || null,
          total_price:     r.totalPrice,
          status:          'pending',
          order_date:      r.date,
          channel:         r.channel || null,
          is_new_customer: !r.isRepeat,
          tracking_number: r.trackingNumber,
          import_status:   'success',
          quantity:        1,
        })
      }

      // Step 1d: Insert orders via server action
      const { ids: insertedIds, errors: insertErrors } = await bulkInsertOrders(toInsert)
      errorCount   += insertErrors.length
      errorDetails.push(...insertErrors)
      const successCount = insertedIds.length

      // Step 2: Process each inserted order (snapshot, profit, inventory)
      if (insertedIds.length > 0) {
        const { failed, errors: procErrors } = await processOrdersBatch(insertedIds)
        if (failed > 0) {
          console.error('Some orders failed processing:', procErrors)
        }
      }

      // Refresh
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      setResult({ success: successCount, skipped: skippedCount, errors: errorCount, errorDetails })
      setStep('done')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Import failed'
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  // ── Close / reset ────────────────────────────────────────────────────────

  function handleClose() {
    if (importing) return
    setStep('upload')
    setRows([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const readyRows   = rows.filter(r => r.status === 'ready')
  const invalidRows = rows.filter(r => r.status === 'error')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 'preview' ? 'max-w-5xl' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>Import Orders from CSV</DialogTitle>
        </DialogHeader>

        {/* ── STEP: Upload ── */}
        {step === 'upload' && (
          <div
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Click to upload a CSV file</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Expected columns: 线上单号, Date, Channel, Name, Phone no,<br />
              Package, Total Price, Address line (1), new/repeat Manual, Tracking Number
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* ── STEP: Preview ── */}
        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 font-medium">{readyRows.length} ready to import</span>
              {invalidRows.length > 0 && (
                <span className="text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {invalidRows.length} with errors (will be skipped)
                </span>
              )}
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border text-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2">Ref</TableHead>
                    <TableHead className="text-xs py-2">Date</TableHead>
                    <TableHead className="text-xs py-2">Name</TableHead>
                    <TableHead className="text-xs py-2">Phone</TableHead>
                    <TableHead className="text-xs py-2">Package</TableHead>
                    <TableHead className="text-xs py-2">Price</TableHead>
                    <TableHead className="text-xs py-2">Channel</TableHead>
                    <TableHead className="text-xs py-2 w-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => {
                    const hasError = row.errors.length > 0
                    const matched  = projects.find(p => p.id === row.projectId)
                    return (
                      <TableRow key={i} className={hasError ? 'bg-destructive/5' : undefined}>
                        <TableCell className="py-1.5 font-mono text-muted-foreground">
                          {row.orderRef || '—'}
                        </TableCell>
                        <TableCell className="py-1.5">{row.date}</TableCell>
                        <TableCell className="py-1.5 font-medium">
                          {row.customerName}
                          {row.isRepeat && (
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                              <RefreshCw className="h-2.5 w-2.5 mr-0.5" />Repeat
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {row.phone || <span className="text-destructive">—</span>}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {row.packageName || '—'}
                          {row.packageId && (
                            <span className="ml-1 text-green-600 text-[10px]">✓</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {row.errors.includes('invalid_price')
                            ? <span className="text-destructive">!</span>
                            : `RM ${row.totalPrice.toFixed(2)}`}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {row.channel
                            ? matched
                              ? <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{matched.name}</Badge>
                              : <span className="text-muted-foreground text-[10px]">{row.channel} (no match)</span>
                            : '—'}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {hasError && (
                            <span
                              title={row.errors.map(errorLabel).join(', ')}
                              className="text-destructive cursor-help"
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── STEP: Done ── */}
        {step === 'done' && result && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-green-50 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-700">{result.success}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-lg border bg-yellow-50 p-3 text-center">
                <RefreshCw className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="rounded-lg border bg-red-50 p-3 text-center">
                <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-700">{result.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
            {result.errorDetails.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1 max-h-28 overflow-auto">
                {result.errorDetails.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            {step === 'done' ? 'Close' : 'Cancel'}
          </Button>
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={importing || readyRows.length === 0}>
              {importing
                ? 'Importing…'
                : `Import ${readyRows.length} Order${readyRows.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
