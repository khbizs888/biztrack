'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { useQueryClient } from '@tanstack/react-query'
import { fetchProjects, bulkUpsertCustomers, bulkCreateOrders } from '@/app/actions/data'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Upload, AlertCircle, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Project } from '@/lib/types'

type RowError = 'missing_name' | 'missing_phone' | 'invalid_price' | 'missing_date'

interface ParsedRow {
  orderRef: string
  date: string
  customerName: string
  phone: string
  packageName: string
  totalPrice: number
  channel: string
  address: string
  isRepeat: boolean
  projectId: string | null
  productName: string
  errors: RowError[]
}

function parseDate(raw: string): string {
  const s = raw.trim()
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0]
}

function parsePrice(raw: string) { return parseFloat(raw.replace(/RM/gi,'').replace(/,/g,'').trim()) }
function col(raw: Record<string,string>, ...keys: string[]) {
  for (const k of keys) for (const rk of Object.keys(raw)) if (rk.trim().toLowerCase()===k.toLowerCase()) return (raw[rk]??'').trim()
  return ''
}
function normalizePhone(raw: string) { return raw.replace(/[\s\-]/g,'') }
function matchProject(channel: string, projects: Project[]) {
  const c = channel.trim().toLowerCase()
  return projects.find(p => p.name.toLowerCase()===c || p.code.toLowerCase()===c)
}
function errorLabel(e: RowError) {
  return { missing_name:'Missing name', missing_phone:'Missing phone', invalid_price:'Invalid price', missing_date:'Missing date' }[e]
}

interface Props { open: boolean; onClose: () => void }

export default function ImportOrdersModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload'|'preview'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)

  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: fetchProjects })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    Papa.parse<Record<string,string>>(file, {
      header: true, skipEmptyLines: true,
      transformHeader: h => h.replace(/^\uFEFF/,'').trim(),
      complete: result => {
        const parsed: ParsedRow[] = []
        for (const raw of result.data) {
          const customerName = col(raw,'Name')
          if (!customerName) continue
          const orderRef   = col(raw,'线上单号')
          const dateRaw    = col(raw,'Date')
          const channel    = col(raw,'Channel')
          const phoneRaw   = col(raw,'Phone no')||col(raw,'Phone number')
          const packageName= col(raw,'Package')
          const priceRaw   = col(raw,'Total Price')
          const address    = col(raw,'Address line (1)')
          const repeatRaw  = col(raw,'new/repeat Manual')
          const phone      = normalizePhone(phoneRaw)
          const totalPrice = parsePrice(priceRaw)
          const date       = parseDate(dateRaw)
          const isRepeat   = repeatRaw.trim().toLowerCase()==='repeat'
          const matched    = matchProject(channel, projects)
          const errors: RowError[] = []
          if (!phone)           errors.push('missing_phone')
          if (!dateRaw)         errors.push('missing_date')
          if (isNaN(totalPrice)) errors.push('invalid_price')
          parsed.push({ orderRef, date, customerName, phone, packageName, totalPrice: isNaN(totalPrice)?0:totalPrice, channel, address, isRepeat, projectId: matched?.id??null, productName: packageName||channel||'—', errors })
        }
        if (!parsed.length) { toast.error('No valid rows found.'); if(fileInputRef.current) fileInputRef.current.value=''; return }
        setRows(parsed); setStep('preview')
      },
      error: () => { toast.error('Failed to parse CSV.'); if(fileInputRef.current) fileInputRef.current.value='' },
    })
  }

  async function handleImport() {
    setImporting(true)
    const valid = rows.filter(r => r.errors.length===0)
    const skipped = rows.length - valid.length
    try {
      const customerRows = valid.map(r => ({ name: r.customerName, phone: r.phone, address: r.address||null }))
      const customerMap = await bulkUpsertCustomers(customerRows)

      const orderInserts = valid.map(r => ({
        customer_id: customerMap[r.phone] ?? null,
        project_id: r.projectId,
        product_name: r.productName,
        package_name: r.packageName||null,
        total_price: r.totalPrice,
        status: 'pending',
        order_date: r.date,
        channel: r.channel||null,
        is_new_customer: !r.isRepeat,
      }))

      const { success, fail } = await bulkCreateOrders(orderInserts)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (success>0) toast.success(`${success} order${success!==1?'s':''} imported`)
      if (fail>0)    toast.error(`${fail} order${fail!==1?'s':''} failed`)
      if (skipped>0) toast.warning(`${skipped} row${skipped!==1?'s':''} skipped`)
    } catch (e: any) {
      toast.error(e.message ?? 'Import failed')
    } finally {
      setImporting(false)
      handleClose()
    }
  }

  function handleClose() {
    if (importing) return
    setStep('upload'); setRows([])
    if (fileInputRef.current) fileInputRef.current.value=''
    onClose()
  }

  const validRows = rows.filter(r=>r.errors.length===0)
  const invalidRows = rows.filter(r=>r.errors.length>0)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step==='preview'?'max-w-5xl':'max-w-md'}>
        <DialogHeader><DialogTitle>Import Orders from CSV</DialogTitle></DialogHeader>

        {step==='upload' && (
          <div className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors" onClick={()=>fileInputRef.current?.click()}>
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Click to upload a CSV file</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Expected columns: 线上单号, Date, Channel, Name, Phone no,<br/>Package, Total Price, Address line (1), new/repeat Manual
            </p>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {step==='preview' && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 font-medium">{validRows.length} ready to import</span>
              {invalidRows.length>0 && (
                <span className="text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5"/>{invalidRows.length} with errors (skipped)
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
                    <TableHead className="text-xs py-2 w-6"/>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row,i) => {
                    const hasError = row.errors.length>0
                    const matched = projects.find(p=>p.id===row.projectId)
                    return (
                      <TableRow key={i} className={hasError?'bg-destructive/5':undefined}>
                        <TableCell className="py-1.5 font-mono text-muted-foreground">{row.orderRef||'—'}</TableCell>
                        <TableCell className="py-1.5">{row.date}</TableCell>
                        <TableCell className="py-1.5 font-medium">
                          {row.customerName}
                          {row.isRepeat&&<Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4"><RefreshCw className="h-2.5 w-2.5 mr-0.5"/>Repeat</Badge>}
                        </TableCell>
                        <TableCell className="py-1.5">{row.phone||<span className="text-destructive">—</span>}</TableCell>
                        <TableCell className="py-1.5">{row.packageName||'—'}</TableCell>
                        <TableCell className="py-1.5">{row.errors.includes('invalid_price')?<span className="text-destructive">!</span>:`RM ${row.totalPrice.toFixed(2)}`}</TableCell>
                        <TableCell className="py-1.5">
                          {row.channel?(matched?<Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{matched.name}</Badge>:<span className="text-muted-foreground text-[10px]">{row.channel} (no match)</span>):'—'}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {hasError&&<span title={row.errors.map(errorLabel).join(', ')} className="text-destructive cursor-help"><AlertCircle className="h-3.5 w-3.5"/></span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>Cancel</Button>
          {step==='preview'&&(
            <Button onClick={handleImport} disabled={importing||validRows.length===0}>
              {importing?'Importing…':`Import ${validRows.length} Order${validRows.length!==1?'s':''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
