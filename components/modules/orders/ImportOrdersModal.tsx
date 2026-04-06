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
  createImportBatch,
  updateImportBatch,
  fetchImportMappings,
  saveImportMapping,
} from '@/app/actions/data'
import { processOrdersBatch } from '@/app/actions/order-processing'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Upload, AlertCircle, RefreshCw, CheckCircle2, XCircle, Save, ChevronRight } from 'lucide-react'
import type { Project } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'preview' | 'done'
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
  listPrice: number | null
  channel: string
  address: string
  isRepeat: boolean
  isCod: boolean
  codAmount: number | null
  shippingFee: number | null
  courier: string
  country: string
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

interface FieldDef {
  key: string
  label: string
  required: boolean
  autoKeys: string[]
}

// ── Field definitions ──────────────────────────────────────────────────────────

const FIELD_DEFS: FieldDef[] = [
  { key: 'tracking',      label: 'Tracking Number',  required: false, autoKeys: ['线上单号', 'Tracking Number', 'Tracking', 'AWB'] },
  { key: 'date',          label: 'Order Date',        required: true,  autoKeys: ['Date'] },
  { key: 'customer_name', label: 'Customer Name',     required: true,  autoKeys: ['Name'] },
  { key: 'phone',         label: 'Phone',             required: true,  autoKeys: ['Phone number', 'Phone no'] },
  { key: 'channel',       label: 'Channel / Brand',   required: false, autoKeys: ['Channel'] },
  { key: 'package',       label: 'Package Name',      required: false, autoKeys: ['Package'] },
  { key: 'package_code',  label: 'Package Code',      required: false, autoKeys: ['商品编码'] },
  { key: 'price',         label: 'Total Price',       required: true,  autoKeys: ['Total Price'] },
  { key: 'list_price',    label: 'List / FIOR Price', required: false, autoKeys: ['Fior Prices'] },
  { key: 'address',       label: 'Address',           required: false, autoKeys: ['Address line (1)', 'Address'] },
  { key: 'customer_type', label: 'New / Repeat',      required: false, autoKeys: ['new/repeat Manual'] },
  { key: 'cod',           label: 'COD Indicator',     required: false, autoKeys: ['COD'] },
  { key: 'cod_amount',    label: 'COD Amount',        required: false, autoKeys: ['代收货款金额'] },
  { key: 'shipping_fee',  label: 'Shipping Fee',      required: false, autoKeys: ['运费'] },
  { key: 'courier',       label: 'Courier',           required: false, autoKeys: ['店铺'] },
  { key: 'country',       label: 'Country',           required: false, autoKeys: ['收件人国家'] },
]

// ── Parse helpers ──────────────────────────────────────────────────────────────

function autoDetect(headers: string[]): Record<string, string> {
  const normalized = headers.map(h => ({ original: h, lower: h.trim().toLowerCase() }))
  const result: Record<string, string> = {}
  for (const field of FIELD_DEFS) {
    for (const key of field.autoKeys) {
      const found = normalized.find(h => h.lower === key.trim().toLowerCase())
      if (found) { result[field.key] = found.original; break }
    }
  }
  return result
}

function getField(row: Record<string, string>, mapping: Record<string, string>, key: string): string {
  const csvCol = mapping[key]
  if (!csvCol) return ''
  return (row[csvCol] ?? '').trim()
}

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

function normalizePhone(raw: string): string {
  let s = raw.replace(/[\s\-]/g, '')
  // Fix Excel scientific notation: 0125039898 becomes 1.25039898E+08
  if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(s)) {
    const n = Math.round(parseFloat(s))
    s = n.toString()
    // Restore leading 0 for 9-digit Malaysian mobile numbers (01X-XXXXXXX)
    if (s.length === 9 && s.startsWith('1')) s = '0' + s
  }
  return s
}

function mapChannel(raw: string): string {
  const c = raw.trim().toLowerCase()
  if (c.startsWith('fb ') || c === 'facebook') return 'Facebook'
  if (c === 'xhs') return 'Xiaohongshu'
  if (c === 'shopee') return 'Shopee'
  if (c === 'tiktok') return 'TikTok'
  if (c === 'lazada') return 'Lazada'
  return raw.trim()
}

function parseIsRepeat(raw: string): boolean {
  // FIOR CSV: 'New' = new customer; 'No' = repeat customer
  const s = raw.trim().toLowerCase()
  return s === 'no' || s === 'repeat'
}

function parseCod(raw: string): boolean {
  return raw.trim().toLowerCase().includes('cod')
}

function mapCourier(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (s.includes('dhl'))                         return 'DHL'
  if (s.includes('poslaju') || s.includes('pos laju')) return 'Pos Laju'
  if (s.includes('jnt') || s.includes('j&t'))   return 'J&T'
  if (s.includes('gdex'))                        return 'GDex'
  if (s.includes('ninja'))                       return 'Ninja Van'
  return raw.trim()
}

function matchProject(channel: string, projects: Project[]): Project | undefined {
  const c = channel.trim().toLowerCase()
  return projects.find(p => p.name.toLowerCase() === c || (p.code && p.code.toLowerCase() === c))
}

function errorLabel(e: RowError): string {
  return ({ missing_name: 'Missing name', missing_phone: 'Missing phone', invalid_price: 'Invalid price', missing_date: 'Missing date' })[e]
}

type Pkg = { id: string; project_id: string; name: string; code: string | null }

function findPackageMatch(codeRaw: string, nameRaw: string, projectId: string | null, allPackages: Pkg[]): string | null {
  if (!projectId) return null
  const pool = allPackages.filter(p => p.project_id === projectId)
  if (codeRaw) {
    const byCode = pool.find(p => p.code && p.code.toLowerCase() === codeRaw.toLowerCase())
    if (byCode) return byCode.id
  }
  if (nameRaw) {
    const nl = nameRaw.toLowerCase()
    const byExact = pool.find(p => p.name.toLowerCase() === nl)
    if (byExact) return byExact.id
    const byFuzzy = pool.find(p => p.name.toLowerCase().includes(nl) || nl.includes(p.name.toLowerCase()))
    if (byFuzzy) return byFuzzy.id
  }
  return null
}

function parseRows(
  rawData: Record<string, string>[],
  mapping: Record<string, string>,
  projects: Project[],
  allPackages: Pkg[]
): ParsedRow[] {
  const parsed: ParsedRow[] = []

  for (const raw of rawData) {
    const get = (key: string) => getField(raw, mapping, key)

    // Skip rows with empty tracking number (线上单号 = order reference)
    const trackingRaw = get('tracking')
    if (!trackingRaw) continue

    const customerName = get('customer_name')
    if (!customerName) continue

    const dateRaw        = get('date')
    const channelRaw     = get('channel')
    const phoneRaw       = get('phone')
    const packageName    = get('package')
    const packageCode    = get('package_code')
    const priceRaw       = get('price')
    const listPriceRaw   = get('list_price')
    const address        = get('address')
    const customerType   = get('customer_type')
    const codRaw         = get('cod')
    const codAmountRaw   = get('cod_amount')
    const shippingFeeRaw = get('shipping_fee')
    const courierRaw     = get('courier')
    const countryRaw     = get('country')

    const phone       = normalizePhone(phoneRaw)
    const totalPrice  = parsePrice(priceRaw)
    const listPriceN  = listPriceRaw  ? parsePrice(listPriceRaw)  : NaN
    const codAmountN  = codAmountRaw  ? parsePrice(codAmountRaw)  : NaN
    const shippingN   = shippingFeeRaw ? parsePrice(shippingFeeRaw) : NaN
    const date        = parseDate(dateRaw)
    const channel     = mapChannel(channelRaw)
    const isRepeat    = parseIsRepeat(customerType)
    const isCod       = parseCod(codRaw)
    const courier     = mapCourier(courierRaw)
    const country     = countryRaw || 'MY'

    const matched   = matchProject(channel, projects) ?? matchProject(channelRaw, projects)
    const projectId = matched?.id ?? null
    const packageId = findPackageMatch(packageCode, packageName, projectId, allPackages)

    const errors: RowError[] = []
    if (!phone)            errors.push('missing_phone')
    if (!dateRaw)          errors.push('missing_date')
    if (isNaN(totalPrice)) errors.push('invalid_price')

    parsed.push({
      orderRef:      trackingRaw,
      date,
      customerName,
      phone,
      packageName,
      trackingNumber: trackingRaw,
      totalPrice:    isNaN(totalPrice) ? 0 : totalPrice,
      listPrice:     isNaN(listPriceN) ? null : listPriceN,
      channel,
      address,
      isRepeat,
      isCod,
      codAmount:   isNaN(codAmountN) ? null : codAmountN,
      shippingFee: isNaN(shippingN)  ? null : shippingN,
      courier,
      country,
      projectId,
      packageId,
      productName: packageName || channelRaw || '—',
      errors,
      status: errors.length > 0 ? 'error' : 'ready',
    })
  }

  return parsed
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { open: boolean; onClose: () => void }

export default function ImportOrdersModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileNameRef  = useRef<string>('')

  const [step, setStep]             = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rawData, setRawData]       = useState<Record<string, string>[]>([])
  const [mapping, setMapping]       = useState<Record<string, string>>({})
  const [rows, setRows]             = useState<ParsedRow[]>([])
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [saveName, setSaveName]     = useState('')
  const [saving, setSaving]         = useState(false)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn:  fetchProjects,
  })

  const { data: allPackages = [] } = useQuery({
    queryKey: ['packages-all'],
    queryFn:  fetchActivePackages,
  })

  const { data: savedMappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['import-mappings'],
    queryFn:  fetchImportMappings,
  })

  // ── File handling ─────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    fileNameRef.current = file.name

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.replace(/^\uFEFF/, '').trim(),
      complete: res => {
        const headers = res.meta.fields ?? []
        setCsvHeaders(headers)
        setRawData(res.data)
        setMapping(autoDetect(headers))
        setStep('mapping')
      },
      error: () => {
        toast.error('Failed to parse CSV.')
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
    })
  }

  function updateMapping(fieldKey: string, csvCol: string) {
    setMapping(prev => ({ ...prev, [fieldKey]: csvCol === '__none__' ? '' : csvCol }))
  }

  // ── Mapping confirmed ─────────────────────────────────────────────────────

  function handleMappingConfirm() {
    const parsed = parseRows(rawData, mapping, projects, allPackages)
    if (!parsed.length) {
      toast.error('No valid rows found. Check that Tracking Number column is mapped and non-empty.')
      return
    }
    setRows(parsed)
    setStep('preview')
  }

  // ── Save mapping ──────────────────────────────────────────────────────────

  async function handleSaveMapping() {
    if (!saveName.trim()) { toast.error('Enter a name for this mapping.'); return }
    setSaving(true)
    try {
      await saveImportMapping(saveName.trim(), mapping)
      await refetchMappings()
      setSaveName('')
      toast.success('Mapping saved!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    setImporting(true)
    const validRows  = rows.filter(r => r.status === 'ready')
    let skippedCount = rows.filter(r => r.status === 'error').length
    let errorCount   = 0
    const errorDetails: string[] = []

    const projectIdCounts: Record<string, number> = {}
    for (const r of validRows) {
      if (r.projectId) projectIdCounts[r.projectId] = (projectIdCounts[r.projectId] ?? 0) + 1
    }
    const dominantProjectId = Object.keys(projectIdCounts).sort(
      (a, b) => projectIdCounts[b] - projectIdCounts[a]
    )[0] ?? null

    let batchId: string | null = null
    try {
      batchId = await createImportBatch(dominantProjectId, fileNameRef.current || 'import.csv', rows.length)
    } catch { /* non-blocking */ }

    try {
      const customerRows = validRows.map(r => ({ name: r.customerName, phone: r.phone, address: r.address || null }))
      const customerMap  = await bulkUpsertCustomers(customerRows)

      const trackingNumbers = validRows.map(r => r.trackingNumber).filter((t): t is string => t !== null)
      const existingTrackingArr = trackingNumbers.length > 0
        ? await fetchExistingTrackingNumbers(trackingNumbers)
        : []
      const existingTracking = new Set<string>(existingTrackingArr)

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
          list_price:      r.listPrice ?? null,
          status:          'pending',
          order_date:      r.date,
          channel:         r.channel || null,
          is_new_customer: !r.isRepeat,
          tracking_number: r.trackingNumber,
          import_status:   'success',
          quantity:        1,
          import_batch_id: batchId,
          is_cod:          r.isCod,
          payment_status:  r.isCod ? 'Pending' : 'Settled',
          shipping_fee:    r.shippingFee ?? null,
          handling_fee:    r.codAmount   ?? null,
          courier:         r.courier     || null,
          country:         r.country     || 'MY',
        })
      }

      const { ids: insertedIds, errors: insertErrors } = await bulkInsertOrders(toInsert)
      errorCount   += insertErrors.length
      errorDetails.push(...insertErrors)
      const successCount = insertedIds.length

      if (insertedIds.length > 0) {
        const { failed, errors: procErrors } = await processOrdersBatch(insertedIds)
        if (failed > 0) console.error('Some orders failed processing:', procErrors)
      }

      if (batchId) {
        try {
          await updateImportBatch(
            batchId,
            { success_count: successCount, skipped_count: skippedCount, error_count: errorCount },
            errorCount > 0 && successCount === 0 ? 'failed' : 'completed'
          )
        } catch { /* non-blocking */ }
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['import-batches'] })

      setResult({ success: successCount, skipped: skippedCount, errors: errorCount, errorDetails })
      setStep('done')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function handleClose() {
    if (importing) return
    setStep('upload')
    setCsvHeaders([])
    setRawData([])
    setMapping({})
    setRows([])
    setResult(null)
    setSaveName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const readyRows   = rows.filter(r => r.status === 'ready')
  const invalidRows = rows.filter(r => r.status === 'error')
  const dialogWidth = step === 'preview' ? 'max-w-5xl' : step === 'mapping' ? 'max-w-2xl' : 'max-w-md'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={dialogWidth}>
        <DialogHeader>
          <DialogTitle>Import Orders from CSV</DialogTitle>
        </DialogHeader>

        {/* ── Upload ─────────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Click to upload a CSV file</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Supports FIOR format: 线上单号, Date, Channel, Name, Phone number,<br />
              Package, 商品编码, Total Price, Fior Prices, COD, 运费, 店铺, 收件人国家
            </p>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {/* ── Mapping ────────────────────────────────────────────────────────── */}
        {step === 'mapping' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Map each field to the corresponding CSV column. Auto-detected from headers.
            </p>

            {/* Load saved mapping */}
            {savedMappings.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground shrink-0 text-xs">Load saved:</span>
                <Select onValueChange={id => {
                  const found = savedMappings.find(m => m.id === id)
                  if (found) setMapping(found.mapping)
                }}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Choose a saved mapping…" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedMappings.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Field mapping table */}
            <div className="max-h-[360px] overflow-auto rounded-lg border text-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2 w-36">Field</TableHead>
                    <TableHead className="text-xs py-2">CSV Column</TableHead>
                    <TableHead className="text-xs py-2 w-8 text-center">✓</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FIELD_DEFS.map(field => {
                    const mapped = mapping[field.key] ?? ''
                    return (
                      <TableRow key={field.key}>
                        <TableCell className="py-1 font-medium text-xs">
                          {field.label}
                          {field.required && <span className="text-destructive ml-0.5">*</span>}
                        </TableCell>
                        <TableCell className="py-1">
                          <Select
                            value={mapped || '__none__'}
                            onValueChange={v => updateMapping(field.key, v)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— not mapped —</SelectItem>
                              {csvHeaders.map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1 text-center">
                          {mapped
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mx-auto" />
                            : field.required
                              ? <XCircle className="h-3.5 w-3.5 text-destructive mx-auto" />
                              : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Save mapping row */}
            <div className="flex items-center gap-2">
              <Input
                className="h-7 text-xs flex-1"
                placeholder="Save this mapping as…"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveMapping()}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSaveMapping}
                disabled={saving || !saveName.trim()}
              >
                <Save className="h-3 w-3 mr-1" />Save
              </Button>
            </div>
          </div>
        )}

        {/* ── Preview ────────────────────────────────────────────────────────── */}
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
                    <TableHead className="text-xs py-2">COD</TableHead>
                    <TableHead className="text-xs py-2 w-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => {
                    const hasError = row.errors.length > 0
                    const matched  = projects.find(p => p.id === row.projectId)
                    return (
                      <TableRow key={i} className={hasError ? 'bg-destructive/5' : undefined}>
                        <TableCell className="py-1.5 font-mono text-muted-foreground text-[10px]">
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
                          {row.packageId && <span className="ml-1 text-green-600 text-[10px]">✓</span>}
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
                              : <span className="text-muted-foreground text-[10px]">{row.channel}</span>
                            : '—'}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {row.isCod && (
                            <Badge className="text-[10px] px-1 py-0 h-4 bg-orange-100 text-orange-700 border-orange-200 border">
                              COD
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {hasError && (
                            <span title={row.errors.map(errorLabel).join(', ')} className="text-destructive cursor-help">
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

        {/* ── Done ───────────────────────────────────────────────────────────── */}
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            {step === 'done' ? 'Close' : 'Cancel'}
          </Button>
          {step === 'mapping' && (
            <Button onClick={handleMappingConfirm}>
              Preview <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')} disabled={importing}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing || readyRows.length === 0}>
                {importing
                  ? 'Importing…'
                  : `Import ${readyRows.length} Order${readyRows.length !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
