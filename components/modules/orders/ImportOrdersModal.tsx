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
type CsvFormat = 'A' | 'B' | 'unknown'

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
  remark: string
  sourceId: string | null
  errors: RowError[]
  status: RowStatus
  packageMatched: boolean
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

// ── Format detection ───────────────────────────────────────────────────────────

function detectFormat(headers: string[]): CsvFormat {
  const lower = headers.map(h => h.toLowerCase().trim())
  if (lower.includes('线上单号')) return 'A'
  if (lower.some(h => h.includes('receiver name'))) return 'B'
  // fallback heuristics
  if (lower.includes('full phone no') || lower.includes('parcel')) return 'B'
  if (lower.includes('name') && lower.includes('phone number')) return 'A'
  return 'unknown'
}

// ── Field auto-key maps ────────────────────────────────────────────────────────

const FORMAT_A_AUTO_KEYS: Record<string, string[]> = {
  tracking:      ['线上单号', 'Tracking Number', 'Tracking', 'AWB'],
  date:          ['Date'],
  customer_name: ['Name'],
  phone:         ['Phone number', 'Phone no'],
  channel:       ['Channel'],
  package:       ['Package'],
  package_code:  ['商品编码'],
  price:         ['Total Price'],
  list_price:    ['Fior Prices'],
  address:       ['Address line (1)', 'Address'],
  postcode:      ['Postcode (1)', 'Postcode'],
  city:          ['City (1)', 'City'],
  state:         ['State'],
  cod:           ['COD'],
  cod_amount:    ['代收货款金额'],
  shipping_fee:  ['运费'],
  courier:       ['店铺'],
  customer_type: ['new/repeat Manual'],
  remark:        ['Purchase reason'],
}

const FORMAT_B_AUTO_KEYS: Record<string, string[]> = {
  row_number:    ['Number'],
  track_2026:    ['Track 2026'],
  track_2025:    ['Track 2025'],
  date:          ['Date'],
  customer_name: ['Receiver Name'],
  phone:         ['Full Phone No'],
  phone2:        ['Phone no'],
  channel:       ['Channel'],
  package:       ['Package'],
  price:         ['Total Price'],
  remark:        ['Remark', 'Purchase reason'],
  courier:       ['Parcel'],
  customer_type: ['new/repeat Manual'],
  source_id:     ['Shopee Order No'],
}

// ── Field definitions ──────────────────────────────────────────────────────────

const FIELD_DEFS_A: FieldDef[] = [
  { key: 'tracking',      label: 'Tracking Number',  required: false, autoKeys: FORMAT_A_AUTO_KEYS.tracking },
  { key: 'date',          label: 'Order Date',        required: true,  autoKeys: FORMAT_A_AUTO_KEYS.date },
  { key: 'customer_name', label: 'Customer Name',     required: true,  autoKeys: FORMAT_A_AUTO_KEYS.customer_name },
  { key: 'phone',         label: 'Phone',             required: true,  autoKeys: FORMAT_A_AUTO_KEYS.phone },
  { key: 'channel',       label: 'Channel',           required: false, autoKeys: FORMAT_A_AUTO_KEYS.channel },
  { key: 'package',       label: 'Package Name',      required: false, autoKeys: FORMAT_A_AUTO_KEYS.package },
  { key: 'package_code',  label: 'Package Code',      required: false, autoKeys: FORMAT_A_AUTO_KEYS.package_code },
  { key: 'price',         label: 'Total Price',       required: true,  autoKeys: FORMAT_A_AUTO_KEYS.price },
  { key: 'list_price',    label: 'List Price',        required: false, autoKeys: FORMAT_A_AUTO_KEYS.list_price },
  { key: 'address',       label: 'Address',           required: false, autoKeys: FORMAT_A_AUTO_KEYS.address },
  { key: 'cod',           label: 'COD Indicator',     required: false, autoKeys: FORMAT_A_AUTO_KEYS.cod },
  { key: 'cod_amount',    label: 'COD Amount',        required: false, autoKeys: FORMAT_A_AUTO_KEYS.cod_amount },
  { key: 'shipping_fee',  label: 'Shipping Fee',      required: false, autoKeys: FORMAT_A_AUTO_KEYS.shipping_fee },
  { key: 'courier',       label: 'Courier',           required: false, autoKeys: FORMAT_A_AUTO_KEYS.courier },
  { key: 'customer_type', label: 'New / Repeat',      required: false, autoKeys: FORMAT_A_AUTO_KEYS.customer_type },
  { key: 'remark',        label: 'Remark',            required: false, autoKeys: FORMAT_A_AUTO_KEYS.remark },
]

const FIELD_DEFS_B: FieldDef[] = [
  { key: 'row_number',    label: 'Row Number',         required: true,  autoKeys: FORMAT_B_AUTO_KEYS.row_number },
  { key: 'track_2026',    label: 'Tracking (2026)',    required: false, autoKeys: FORMAT_B_AUTO_KEYS.track_2026 },
  { key: 'track_2025',    label: 'Tracking (2025)',    required: false, autoKeys: FORMAT_B_AUTO_KEYS.track_2025 },
  { key: 'date',          label: 'Order Date',         required: true,  autoKeys: FORMAT_B_AUTO_KEYS.date },
  { key: 'customer_name', label: 'Customer Name',      required: true,  autoKeys: FORMAT_B_AUTO_KEYS.customer_name },
  { key: 'phone',         label: 'Primary Phone',      required: true,  autoKeys: FORMAT_B_AUTO_KEYS.phone },
  { key: 'phone2',        label: 'Secondary Phone',    required: false, autoKeys: FORMAT_B_AUTO_KEYS.phone2 },
  { key: 'channel',       label: 'Channel',            required: false, autoKeys: FORMAT_B_AUTO_KEYS.channel },
  { key: 'package',       label: 'Package Name',       required: false, autoKeys: FORMAT_B_AUTO_KEYS.package },
  { key: 'price',         label: 'Total Price',        required: true,  autoKeys: FORMAT_B_AUTO_KEYS.price },
  { key: 'remark',        label: 'Remark (COD check)', required: false, autoKeys: FORMAT_B_AUTO_KEYS.remark },
  { key: 'courier',       label: 'Courier',            required: false, autoKeys: FORMAT_B_AUTO_KEYS.courier },
  { key: 'customer_type', label: 'New / Repeat',       required: false, autoKeys: FORMAT_B_AUTO_KEYS.customer_type },
  { key: 'source_id',     label: 'Shopee Order No',    required: false, autoKeys: FORMAT_B_AUTO_KEYS.source_id },
]

// ── Parse helpers ──────────────────────────────────────────────────────────────

function autoDetectMapping(headers: string[], format: CsvFormat): Record<string, string> {
  const fieldDefs = format === 'B' ? FIELD_DEFS_B : FIELD_DEFS_A
  const normalized = headers.map(h => ({ original: h, lower: h.trim().toLowerCase() }))
  const result: Record<string, string> = {}
  for (const field of fieldDefs) {
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

function normalizePhone(raw: string, format: CsvFormat = 'A'): string {
  let s = raw.replace(/[\s\-\(\)]/g, '')
  // Fix Excel scientific notation: 1.25039898E+08
  if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(s)) {
    const n = Math.round(parseFloat(s))
    s = n.toString()
    if (s.length === 9 && s.startsWith('1')) s = '60' + s
    else if (s.length === 10 && s.startsWith('01')) s = '6' + s
    return s
  }
  if (format === 'B') {
    // Format B: store as clean digits without leading country code issues
    if (s.startsWith('60')) return s
    if (s.startsWith('0')) return '6' + s  // 01X -> 601X
    if (s.startsWith('1') && s.length === 9) return '60' + s
  } else {
    // Format A: keep original normalization
    if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(s)) {
      const n = Math.round(parseFloat(s))
      s = n.toString()
      if (s.length === 9 && s.startsWith('1')) s = '0' + s
    }
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

function mapChannelB(raw: string): string {
  const c = raw.trim().toUpperCase()
  if (c.includes('FB') || c.includes('FACEBOOK')) return 'Facebook'
  if (c === 'SHOPEE') return 'Shopee'
  if (c === 'WHATSAPP' || c === 'WA') return 'WhatsApp'
  if (c === 'TIKTOK') return 'TikTok'
  if (c === 'LAZADA') return 'Lazada'
  if (c === 'INSTAGRAM' || c === 'IG') return 'Instagram'
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

function detectCodFromRemark(remark: string): boolean {
  const r = remark.trim().toLowerCase()
  return r.includes('cod') || r.includes('cash on delivery')
}

function mapCourier(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (s.includes('dhl'))                             return 'DHL'
  if (s.includes('poslaju') || s.includes('pos laju')) return 'Pos Laju'
  if (s.includes('jnt') || s.includes('j&t'))       return 'J&T'
  if (s.includes('gdex'))                            return 'GDex'
  if (s.includes('ninja'))                           return 'Ninja Van'
  return raw.trim()
}

function matchProject(channel: string, projects: Project[]): Project | undefined {
  const c = channel.trim().toLowerCase()
  return projects.find(p => p.name.toLowerCase() === c || (p.code && p.code.toLowerCase() === c))
}

function errorLabel(e: RowError): string {
  return ({ missing_name: 'Missing name', missing_phone: 'Missing phone', invalid_price: 'Invalid price', missing_date: 'Missing date' })[e]
}

function generateTrackingB(
  rowNumber: string,
  track2026: string,
  track2025: string,
  projectName: string,
  year: number = 2026
): string {
  if (track2026.trim()) return track2026.trim()
  if (track2025.trim()) return track2025.trim()
  const num = parseInt(rowNumber, 10)
  if (isNaN(num)) return `${projectName}${year}${rowNumber}`
  return `${projectName}${year}${String(num).padStart(6, '0')}`
}

type Pkg = { id: string; project_id: string; name: string; code: string | null }

function normalizePackageName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

function findPackageMatch(codeRaw: string, nameRaw: string, projectId: string | null, allPackages: Pkg[]): string | null {
  if (!projectId) return null
  const pool = allPackages.filter(p => p.project_id === projectId)
  // 1. Try code match
  if (codeRaw.trim()) {
    const byCode = pool.find(p => p.code && p.code.toLowerCase() === codeRaw.toLowerCase().trim())
    if (byCode) return byCode.id
  }
  if (!nameRaw.trim()) return null
  const nl = normalizePackageName(nameRaw)
  // 2. Exact normalized match
  const byExact = pool.find(p => normalizePackageName(p.name) === nl)
  if (byExact) return byExact.id
  // 3. Substring match (either direction)
  const byFuzzy = pool.find(p => {
    const pn = normalizePackageName(p.name)
    return pn.includes(nl) || nl.includes(pn)
  })
  return byFuzzy?.id ?? null
}

function parseRows(
  rawData: Record<string, string>[],
  mapping: Record<string, string>,
  projects: Project[],
  allPackages: Pkg[],
  fallbackProjectId?: string,
  format: CsvFormat = 'A',
  projectName: string = ''
): ParsedRow[] {
  const parsed: ParsedRow[] = []

  for (const raw of rawData) {
    const get = (key: string) => getField(raw, mapping, key)

    if (format === 'B') {
      // ── Format B (DD, Juji, NE) ────────────────────────────────────────────
      const rowNumber    = get('row_number')
      const track2026    = get('track_2026')
      const track2025    = get('track_2025')
      const dateRaw      = get('date')
      const customerName = get('customer_name')
      const phoneRaw     = get('phone')
      const phone2Raw    = get('phone2')
      const channelRaw   = get('channel')
      const packageName  = get('package')
      const priceRaw     = get('price')
      const remarkRaw    = get('remark')
      const courierRaw   = get('courier')
      const customerType = get('customer_type')
      const sourceIdRaw  = get('source_id')

      // Skip conditions
      if (!dateRaw) continue
      if (!customerName && !phoneRaw && !phone2Raw) continue

      const totalPrice = parsePrice(priceRaw)
      if (totalPrice === 0 || isNaN(totalPrice)) continue

      const trackingNumber = generateTrackingB(rowNumber, track2026, track2025, projectName)
      const isCod          = detectCodFromRemark(remarkRaw)
      let phone            = normalizePhone(phoneRaw, 'B')
      if (!phone && phone2Raw) phone = normalizePhone(phone2Raw, 'B')
      const channel        = mapChannelB(channelRaw)
      const date           = parseDate(dateRaw)
      const isRepeat       = parseIsRepeat(customerType)
      const courier        = mapCourier(courierRaw)

      // For Format B, always use fallback project (selected project)
      const projectId  = fallbackProjectId ?? null
      const packageId  = findPackageMatch('', packageName, projectId, allPackages)
      const sourceId   = sourceIdRaw || null

      const errors: RowError[] = []
      if (!customerName)    errors.push('missing_name')
      if (!phone)           errors.push('missing_phone')
      if (!dateRaw)         errors.push('missing_date')
      if (isNaN(totalPrice)) errors.push('invalid_price')

      parsed.push({
        orderRef:      trackingNumber,
        date,
        customerName,
        phone,
        packageName,
        trackingNumber,
        totalPrice:    isNaN(totalPrice) ? 0 : totalPrice,
        listPrice:     null,
        channel,
        address:       '',
        isRepeat,
        isCod,
        codAmount:     null,
        shippingFee:   null,
        courier,
        country:       'MY',
        projectId,
        packageId,
        productName:   packageName || channelRaw || '—',
        remark:        remarkRaw,
        sourceId,
        errors,
        status:        errors.length > 0 ? 'error' : 'ready',
        packageMatched: packageId !== null,
      })
    } else {
      // ── Format A (FIOR, KHH) ───────────────────────────────────────────────
      const trackingRaw    = get('tracking')
      const dateRaw        = get('date')
      const customerName   = get('customer_name')
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
      const remarkRaw      = get('remark')

      // Skip conditions
      if (!dateRaw) continue
      if (!customerName && !phoneRaw) continue

      const totalPrice = parsePrice(priceRaw)
      if (totalPrice === 0 || isNaN(totalPrice)) continue

      // For Format A, also skip if no tracking number
      if (!trackingRaw) continue

      const phone      = normalizePhone(phoneRaw, 'A')
      const listPriceN = listPriceRaw  ? parsePrice(listPriceRaw)  : NaN
      const codAmountN = codAmountRaw  ? parsePrice(codAmountRaw)  : NaN
      const shippingN  = shippingFeeRaw ? parsePrice(shippingFeeRaw) : NaN
      const date       = parseDate(dateRaw)
      const channel    = mapChannel(channelRaw)
      const isRepeat   = parseIsRepeat(customerType)
      const isCod      = parseCod(codRaw)
      const courier    = mapCourier(courierRaw)

      // Use channel-matched project first; fall back to manually selected project
      const matched   = matchProject(channel, projects) ?? matchProject(channelRaw, projects)
      const projectId = matched?.id ?? fallbackProjectId ?? null
      const packageId = findPackageMatch(packageCode, packageName, projectId, allPackages)

      const errors: RowError[] = []
      if (!customerName)    errors.push('missing_name')
      if (!phone)           errors.push('missing_phone')
      if (!dateRaw)         errors.push('missing_date')
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
        country:     'MY',
        projectId,
        packageId,
        productName: packageName || channelRaw || '—',
        remark:      remarkRaw,
        sourceId:    null,
        errors,
        status:      errors.length > 0 ? 'error' : 'ready',
        packageMatched: packageId !== null,
      })
    }
  }

  return parsed
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { open: boolean; onClose: () => void }

export default function ImportOrdersModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileNameRef  = useRef<string>('')

  const [step, setStep]                   = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders]       = useState<string[]>([])
  const [rawData, setRawData]             = useState<Record<string, string>[]>([])
  const [mapping, setMapping]             = useState<Record<string, string>>({})
  const [rows, setRows]                   = useState<ParsedRow[]>([])
  const [importing, setImporting]         = useState(false)
  const [result, setResult]               = useState<ImportResult | null>(null)
  const [saveName, setSaveName]           = useState('')
  const [saving, setSaving]               = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [detectedFormat, setDetectedFormat] = useState<CsvFormat>('unknown')

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
        const format  = detectFormat(headers)
        setCsvHeaders(headers)
        setRawData(res.data)
        setDetectedFormat(format)
        setMapping(autoDetectMapping(headers, format))
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
    const selectedProject = projects.find(p => p.id === selectedProjectId)
    const parsed = parseRows(
      rawData,
      mapping,
      projects,
      allPackages,
      selectedProjectId || undefined,
      detectedFormat,
      selectedProject?.name || ''
    )
    if (!parsed.length) {
      toast.error('No valid rows found. Check that required columns are mapped and non-empty.')
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
          purchase_reason: r.remark      || null,
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
    setSelectedProjectId('')
    setDetectedFormat('unknown')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const readyRows   = rows.filter(r => r.status === 'ready')
  const invalidRows = rows.filter(r => r.status === 'error')
  const dialogWidth = step === 'preview' ? 'max-w-5xl' : step === 'mapping' ? 'max-w-2xl' : 'max-w-md'
  const currentFieldDefs = detectedFormat === 'B' ? FIELD_DEFS_B : FIELD_DEFS_A

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={dialogWidth}>
        <DialogHeader>
          <DialogTitle>Import Orders from CSV</DialogTitle>
        </DialogHeader>

        {/* ── Upload ─────────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Project selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project (Brand)</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project for this import…" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Orders will be linked to this project. Required for Format B (DD/Juji/NE). Auto-detected from channel for Format A.
              </p>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload a CSV file</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Format A (FIOR/KHH): 线上单号, Date, Name, Phone number, COD…<br />
                Format B (DD/Juji/NE): Number, Receiver Name, Full Phone No, Remark…
              </p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
        )}

        {/* ── Mapping ────────────────────────────────────────────────────────── */}
        {step === 'mapping' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Map each field to the corresponding CSV column. Auto-detected from headers.
            </p>

            {/* Format badge */}
            {detectedFormat !== 'unknown' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">Detected Format:</span>
                <Badge variant={detectedFormat === 'A' ? 'default' : 'secondary'}>
                  {detectedFormat === 'A' ? 'Format A — FIOR/KHH style' : 'Format B — DD/Juji/NE style'}
                </Badge>
              </div>
            )}

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
                  {currentFieldDefs.map(field => {
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
                          <span className={!row.packageId ? 'text-amber-600' : ''}>
                            {row.packageName || '—'}
                          </span>
                          {row.packageId
                            ? <span className="ml-1 text-green-600 text-[10px]">✓</span>
                            : row.packageName
                              ? <span className="ml-1 text-amber-500 text-[10px]">?</span>
                              : null
                          }
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
