'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import type { CustomField } from '@/lib/hooks/useProjects'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Upload, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  name: string
  code: string
  price: number
  notes: string
  customValues: Record<string, string>
  error?: string
}

interface ColumnMapping {
  name: string   // CSV column → Package Name
  code: string   // CSV column → Code / SKU
  price: string  // CSV column → Price
  notes: string  // CSV column → Notes ("" = none)
  custom: Record<string, string>  // fieldKey → CSV column ("" = none)
}

interface Props {
  open: boolean
  onClose: () => void
  projectCode: string
  customFields?: CustomField[]
  onImport: (rows: { name: string; code: string; price: number; notes?: string; customValues?: Record<string, string> }[]) => void
}

type Step = 'upload' | 'mapping' | 'preview'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NONE = '__none__'

/** Score how well a CSV column name matches a set of candidate keywords (0–1). */
function matchScore(col: string, candidates: string[]): number {
  const lower = col.toLowerCase().replace(/[\s_\-]+/g, '')
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i].toLowerCase().replace(/[\s_\-]+/g, '')
    if (lower === cand) return 1 - i * 0.05          // exact match, ranked first
    if (lower.includes(cand) || cand.includes(lower)) return 0.7 - i * 0.05
  }
  return 0
}

/** Pick the best-matching column from csvColumns for the given field. */
function bestGuess(csvColumns: string[], candidates: string[]): string {
  let best = ''
  let bestScore = 0
  for (const col of csvColumns) {
    const score = matchScore(col, candidates)
    if (score > bestScore) { bestScore = score; best = col }
  }
  return bestScore > 0 ? best : ''
}

function parsePrice(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function applyMapping(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping,
  customFields: CustomField[],
): ParsedRow[] {
  return rawRows.map(raw => {
    const name  = mapping.name  ? (raw[mapping.name]  ?? '').trim() : ''
    const code  = mapping.code  ? (raw[mapping.code]  ?? '').trim().toUpperCase() : ''
    const price = mapping.price ? parsePrice((raw[mapping.price] ?? '').trim()) : 0
    const notes = mapping.notes ? (raw[mapping.notes] ?? '').trim() : ''

    const customValues: Record<string, string> = {}
    for (const field of customFields) {
      const col = mapping.custom[field.key]
      if (col) customValues[field.key] = (raw[col] ?? '').trim()
    }

    let error: string | undefined
    if (!name && !code) error = 'Missing name and code'
    else if (!name)     error = 'Missing name'
    else if (!code)     error = 'Missing code'

    return { name, code, price, notes, customValues, error }
  })
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload',  label: 'Upload'  },
  { key: 'mapping', label: 'Map Columns' },
  { key: 'preview', label: 'Preview' },
]

function StepBar({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex(s => s.key === current)
  return (
    <div className="flex items-center gap-1 mb-1">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors',
            i < currentIdx  && 'bg-green-100 text-green-700',
            i === currentIdx && 'bg-green-600 text-white',
            i > currentIdx  && 'bg-muted text-muted-foreground',
          )}>
            <span className={cn(
              'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border',
              i < currentIdx  && 'border-green-600 text-green-700',
              i === currentIdx && 'border-white text-white',
              i > currentIdx  && 'border-muted-foreground',
            )}>
              {i < currentIdx ? '✓' : i + 1}
            </span>
            {s.label}
          </div>
          {i < STEPS.length - 1 && (
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Mapping row ──────────────────────────────────────────────────────────────

interface MappingRowProps {
  label: string
  required: boolean
  csvColumns: string[]
  value: string
  onChange: (v: string) => void
}

function MappingRow({ label, required, csvColumns, value, onChange }: MappingRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 text-sm">
        <span className="font-medium">{label}</span>
        {required
          ? <span className="ml-1 text-destructive text-xs">*</span>
          : <span className="ml-1 text-muted-foreground text-xs">(optional)</span>
        }
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select value={value || NONE} onValueChange={v => onChange(v === NONE ? '' : v)}>
        <SelectTrigger className="flex-1 h-8 text-sm">
          <SelectValue placeholder="Select column…" />
        </SelectTrigger>
        <SelectContent>
          {!required && (
            <SelectItem value={NONE}>
              <span className="text-muted-foreground italic">None</span>
            </SelectItem>
          )}
          {csvColumns.map(col => (
            <SelectItem key={col} value={col}>{col}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImportPackagesCSVModal({
  open, onClose, projectCode, customFields = [], onImport,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep]             = useState<Step>('upload')
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [rawRows, setRawRows]       = useState<Record<string, string>[]>([])
  const [mapping, setMapping]       = useState<ColumnMapping>({
    name: '', code: '', price: '', notes: '', custom: {},
  })
  const [rows, setRows]             = useState<ParsedRow[]>([])
  const [importing, setImporting]   = useState(false)

  // ── Step 1: parse CSV → mapping ──────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.replace(/^\uFEFF/, '').trim(),
      complete: result => {
        if (!result.data.length) {
          toast.error('No rows found in CSV')
          resetInput()
          return
        }

        const cols = result.meta.fields ?? Object.keys(result.data[0])

        // Auto-guess best column for each field.
        // Name candidates include 'SKU' as low-priority fallback (some CSVs use it as display name).
        // Code candidates put 'SKU Name' before 'SKU' so the longer/more-specific column wins.
        const guessedCustom: Record<string, string> = {}
        for (const field of customFields) {
          guessedCustom[field.key] = bestGuess(cols, [field.label, field.key])
        }

        setCsvColumns(cols)
        setRawRows(result.data)
        setMapping({
          name:   bestGuess(cols, ['Package Name', 'Name', 'package_name', 'Package', 'Item', 'Description', 'SKU']),
          code:   bestGuess(cols, ['Code', 'SKU Name', 'SKU', 'code', 'sku', 'Product Code', 'Item Code']),
          price:  bestGuess(cols, ['Price', 'Total Price', 'price', 'total_price', 'Unit Price', 'Cost']),
          notes:  bestGuess(cols, ['Notes', 'Remark', 'Remarks', 'notes', 'remark', 'Comment', 'Description']),
          custom: guessedCustom,
        })
        // Always stop at the mapping step — never auto-advance to preview.
        setStep('mapping')
      },
      error: () => {
        toast.error('Failed to parse CSV')
        resetInput()
      },
    })
  }

  // ── Step 2 → 3: apply mapping, show preview ──────────────────────────────

  function handleApplyMapping() {
    if (!mapping.name || !mapping.code) {
      toast.error('Package Name and Code / SKU are required fields')
      return
    }
    setRows(applyMapping(rawRows, mapping, customFields))
    setStep('preview')
  }

  // ── Step 3 → import ──────────────────────────────────────────────────────

  function handleConfirm() {
    const valid = rows.filter(r => !r.error)
    if (!valid.length) return

    setImporting(true)
    onImport(valid.map(r => ({
      name: r.name,
      code: r.code,
      price: r.price,
      notes: r.notes || undefined,
      customValues: Object.keys(r.customValues).length > 0 ? r.customValues : undefined,
    })))

    const skipped = rows.length - valid.length
    toast.success(
      `${valid.length} package${valid.length !== 1 ? 's' : ''} imported` +
      (skipped > 0 ? `, ${skipped} skipped` : '')
    )
    handleClose()
  }

  // ── Misc ─────────────────────────────────────────────────────────────────

  function resetInput() {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    if (importing) return
    setStep('upload')
    setCsvColumns([])
    setRawRows([])
    setMapping({ name: '', code: '', price: '', notes: '', custom: {} })
    setRows([])
    resetInput()
    onClose()
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose()
  }

  function setStdField(field: 'name' | 'code' | 'price' | 'notes') {
    return (v: string) => setMapping(m => ({ ...m, [field]: v }))
  }

  function setCustomField(key: string) {
    return (v: string) => setMapping(m => ({ ...m, custom: { ...m.custom, [key]: v } }))
  }

  const validRows   = rows.filter(r => !r.error)
  const invalidRows = rows.filter(r => r.error)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(
        'transition-all',
        step === 'upload'  && 'max-w-md',
        step === 'mapping' && 'max-w-lg',
        step === 'preview' && 'max-w-3xl',
      )}>
        <DialogHeader>
          <DialogTitle>Import Packages from CSV</DialogTitle>
          <StepBar current={step} />
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div>
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload a CSV file</p>
              <p className="text-xs text-muted-foreground mt-2">
                Any CSV format works — you'll map the columns in the next step.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                onClick={e => e.stopPropagation()}
              />
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-gray-700">Example CSV format:</p>
              <pre className="font-mono text-[11px] leading-relaxed">{`Package Name,Code,Price,Notes
Starter Pack 1 Box,${projectCode}-BOX-1,99.00,Best seller
Starter Pack 3 Box,${projectCode}-BOX-3,270.00,`}</pre>
            </div>
          </div>
        )}

        {/* ── Step 2: Column mapping ── */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your CSV has{' '}
              <span className="font-medium text-foreground">{csvColumns.length} columns</span> and{' '}
              <span className="font-medium text-foreground">{rawRows.length} rows</span>.
              Map each field to the right column.
            </p>

            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Standard Fields</p>
              <MappingRow label="Package Name" required   csvColumns={csvColumns} value={mapping.name}  onChange={setStdField('name')} />
              <MappingRow label="Code / SKU"   required   csvColumns={csvColumns} value={mapping.code}  onChange={setStdField('code')} />
              <MappingRow label="Price"        required={false} csvColumns={csvColumns} value={mapping.price} onChange={setStdField('price')} />
              <MappingRow label="Notes"        required={false} csvColumns={csvColumns} value={mapping.notes} onChange={setStdField('notes')} />

              {customFields.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2 border-t">
                    Custom Fields
                  </p>
                  {customFields.map(field => (
                    <MappingRow
                      key={field.key}
                      label={field.label}
                      required={false}
                      csvColumns={csvColumns}
                      value={mapping.custom[field.key] ?? ''}
                      onChange={setCustomField(field.key)}
                    />
                  ))}
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="text-destructive">*</span> Required fields
            </p>
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {validRows.length} ready to import
              </span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-destructive font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {invalidRows.length} with errors (will be skipped)
                </span>
              )}
            </div>

            <div className="max-h-96 overflow-auto rounded-lg border text-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2 w-8">#</TableHead>
                    <TableHead className="text-xs py-2">Code</TableHead>
                    <TableHead className="text-xs py-2">Name</TableHead>
                    <TableHead className="text-xs py-2 text-right">Price</TableHead>
                    <TableHead className="text-xs py-2">Notes</TableHead>
                    {customFields.map(f => (
                      <TableHead key={f.key} className="text-xs py-2">{f.label}</TableHead>
                    ))}
                    <TableHead className="text-xs py-2 w-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i} className={cn(row.error && 'bg-destructive/5')}>
                      <TableCell className="py-1.5 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="py-1.5 font-mono">
                        {row.code || <span className="text-destructive italic">missing</span>}
                      </TableCell>
                      <TableCell className="py-1.5 font-medium">
                        {row.name || <span className="text-destructive italic">missing</span>}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        {row.price > 0 ? formatCurrency(row.price) : '—'}
                      </TableCell>
                      <TableCell className="py-1.5 text-muted-foreground max-w-[120px] truncate">
                        {row.notes || '—'}
                      </TableCell>
                      {customFields.map(f => (
                        <TableCell key={f.key} className="py-1.5 text-muted-foreground max-w-[100px] truncate">
                          {row.customValues[f.key] || '—'}
                        </TableCell>
                      ))}
                      <TableCell className="py-1.5">
                        {row.error && (
                          <span title={row.error} className="text-destructive cursor-help">
                            <AlertCircle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>

          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleApplyMapping} disabled={!mapping.name || !mapping.code}>
                Preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
              <Button
                onClick={handleConfirm}
                disabled={importing || validRows.length === 0}
              >
                {importing
                  ? 'Importing…'
                  : `Import ${validRows.length} Package${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
