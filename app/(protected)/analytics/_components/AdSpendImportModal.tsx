'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { batchImportAdSpend, type DailyAdSpendInput } from '@/app/actions/analytics'
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface Project { id: string; name: string; code: string }

interface Props {
  open: boolean
  onClose: () => void
  projects: Project[]
  onSuccess?: () => void
}

// Parses RM strings and removes commas: "RM 1,234.50" → 1234.50
function parseMoney(raw: string): number {
  const cleaned = String(raw ?? '').replace(/[RM,\s]/gi, '').trim()
  const v = parseFloat(cleaned)
  return isNaN(v) ? 0 : v
}

// Normalise date: supports DD/MM/YYYY, YYYY-MM-DD, D/M/YYYY
function parseDate(raw: string): string | null {
  const s = String(raw ?? '').trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // D/M/YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

// Map CSV header → field name
const HEADER_MAP: Record<string, keyof DailyAdSpendInput> = {
  'date': 'date',
  'fb ad cost (ads acc. 1)': 'fb_ad_cost_acc1',
  'fb ad cost acc 1': 'fb_ad_cost_acc1',
  'fb acc 1': 'fb_ad_cost_acc1',
  'fb ad cost (ads acc. 2)': 'fb_ad_cost_acc2',
  'fb ad cost acc 2': 'fb_ad_cost_acc2',
  'fb acc 2': 'fb_ad_cost_acc2',
  'fb ad cost (ads acc. 3)': 'fb_ad_cost_acc3',
  'fb ad cost acc 3': 'fb_ad_cost_acc3',
  'fb acc 3': 'fb_ad_cost_acc3',
  'tiktok ad cost': 'tiktok_ad_cost',
  'tiktok': 'tiktok_ad_cost',
  'shopee ad cost': 'shopee_ad_cost',
  'shopee': 'shopee_ad_cost',
  'pmed': 'fb_messages',
  'messages': 'fb_messages',
  'fb messages': 'fb_messages',
  'goal sales': 'goal_sales',
  'goal': 'goal_sales',
}

export default function AdSpendImportModal({ open, onClose, projects, onSuccess }: Props) {
  const [projectId, setProjectId] = useState('')
  const [preview, setPreview] = useState<DailyAdSpendInput[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      parseCSV(text)
    }
    reader.readAsText(file)
  }

  function parseCSV(text: string) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) { setParseErrors(['CSV has no data rows']); return }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))
    const errors: string[] = []
    const rows: DailyAdSpendInput[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => { obj[h] = (cols[idx] ?? '').trim() })

      const dateRaw = obj['date'] ?? ''
      const date = parseDate(dateRaw)
      if (!date) {
        if (dateRaw) errors.push(`Row ${i + 1}: invalid date "${dateRaw}"`)
        continue
      }

      const row: DailyAdSpendInput = { project_id: projectId, date }
      for (const [h, v] of Object.entries(obj)) {
        const field = HEADER_MAP[h]
        if (!field || field === 'date' || field === 'project_id') continue
        if (field === 'fb_messages') {
          row[field] = parseInt(v, 10) || 0
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(row as any)[field] = parseMoney(v)
        }
      }

      rows.push(row)
    }

    setParseErrors(errors)
    setPreview(rows)
    setResult(null)
  }

  async function handleImport() {
    if (!projectId) { toast.error('Select a project first'); return }
    if (!preview.length) { toast.error('No rows to import'); return }
    setImporting(true)
    try {
      const rows = preview.map(r => ({ ...r, project_id: projectId }))
      const res = await batchImportAdSpend(rows)
      setResult(res)
      if (res.errors.length === 0) {
        toast.success(`Imported ${res.inserted} rows`)
        onSuccess?.()
      } else {
        toast.warning(`Imported ${res.inserted} rows with ${res.errors.length} errors`)
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    setPreview([])
    setParseErrors([])
    setResult(null)
    setProjectId('')
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Ad Spend (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project select */}
          <div>
            <Label className="text-xs mb-1.5 block">Project / Brand</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select project…" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File input */}
          <div>
            <Label className="text-xs mb-1.5 block">CSV File</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Expected columns: Date, FB Ad Cost (Ads Acc. 1), FB Ad Cost (Ads Acc. 2), FB Ad Cost (Ads Acc. 3),
              TikTok Ad Cost, Shopee Ad Cost, PMed, Goal sales
            </p>
            <label className="flex items-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click to choose CSV file</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Parse warnings
              </div>
              {parseErrors.map((e, i) => (
                <p key={i} className="text-xs text-amber-600 ml-5">{e}</p>
              ))}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !result && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{preview.length} rows ready to import</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Date</th>
                      <th className="px-2 py-1.5 text-right">FB (3 acc)</th>
                      <th className="px-2 py-1.5 text-right">TikTok</th>
                      <th className="px-2 py-1.5 text-right">Shopee</th>
                      <th className="px-2 py-1.5 text-right">Goal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 30).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{r.date}</td>
                        <td className="px-2 py-1 text-right">
                          {((r.fb_ad_cost_acc1 ?? 0) + (r.fb_ad_cost_acc2 ?? 0) + (r.fb_ad_cost_acc3 ?? 0)).toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right">{(r.tiktok_ad_cost ?? 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{(r.shopee_ad_cost ?? 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{(r.goal_sales ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    {preview.length > 30 && (
                      <tr><td colSpan={5} className="px-2 py-1 text-muted-foreground">… and {preview.length - 30} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className={`rounded-lg border p-3 ${result.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Imported {result.inserted} rows
                {result.errors.length > 0 && ` (${result.errors.length} errors)`}
              </div>
              {result.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs mt-1 ml-6 text-amber-700">{e}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && preview.length > 0 && (
              <Button onClick={handleImport} disabled={importing || !projectId}>
                {importing ? 'Importing…' : `Import ${preview.length} rows`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
