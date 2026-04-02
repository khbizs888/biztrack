'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { useQueryClient } from '@tanstack/react-query'
import { fetchProducts, bulkCreatePackages } from '@/app/actions/data'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Upload, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ParsedRow {
  packageName: string
  product1: string
  product2: string
  product3: string
  amount: number
  price: number
  error?: string
}

function col(raw: Record<string,string>, ...keys: string[]) {
  for (const k of keys) for (const rk of Object.keys(raw)) if (rk.trim().toLowerCase()===k.toLowerCase()) return (raw[rk]??'').trim()
  return ''
}

interface Props { projectId: string; open: boolean; onClose: () => void }

export default function ImportPackagesModal({ projectId, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload'|'preview'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    Papa.parse<Record<string,string>>(file, {
      header: true, skipEmptyLines: true,
      transformHeader: h => h.replace(/^\uFEFF/,'').trim(),
      complete: result => {
        const parsed: ParsedRow[] = result.data.map(raw => {
          const packageName = col(raw,'Package Name','package_name','Package')
          const product1 = col(raw,'Product 1','product1')
          const product2 = col(raw,'Product 2','product2')
          const product3 = col(raw,'Product 3','product3')
          const amount = parseInt(col(raw,'Amount','amount','Qty'),10)
          const price  = parseFloat(col(raw,'Price','price','Total Price').replace(/[^0-9.-]/g,''))
          let error: string|undefined
          if (!packageName)         error = 'Missing package name'
          else if (!product1)       error = 'Product 1 is required'
          else if (isNaN(price)||price<0) error = 'Invalid price'
          return { packageName, product1, product2, product3, amount: isNaN(amount)||amount<1?1:amount, price: isNaN(price)?0:price, error }
        })
        if (!parsed.length) { toast.error('No rows found.'); if(fileInputRef.current) fileInputRef.current.value=''; return }
        setRows(parsed); setStep('preview')
      },
      error: () => { toast.error('Failed to parse CSV.'); if(fileInputRef.current) fileInputRef.current.value='' },
    })
  }

  async function handleImport() {
    setImporting(true)
    const valid = rows.filter(r => !r.error)
    const skipped = rows.length - valid.length
    try {
      const products = await fetchProducts(projectId)
      const productMap: Record<string,string> = {}
      products.forEach((p: any) => { productMap[p.name.toLowerCase()] = p.id })

      const { success, fail } = await bulkCreatePackages(
        projectId,
        valid.map(r => ({ name: r.packageName, price: r.price, product1: r.product1, product2: r.product2, product3: r.product3, amount: r.amount })),
        productMap
      )
      queryClient.invalidateQueries({ queryKey: ['packages', projectId] })
      if (success>0) toast.success(`${success} package${success!==1?'s':''} imported`)
      if (fail>0)    toast.error(`${fail} failed`)
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

  const validRows = rows.filter(r=>!r.error)
  const invalidRows = rows.filter(r=>r.error)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step==='preview'?'max-w-3xl':'max-w-md'}>
        <DialogHeader><DialogTitle>Import Packages from CSV</DialogTitle></DialogHeader>

        {step==='upload' && (
          <div className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors" onClick={()=>fileInputRef.current?.click()}>
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground"/>
            <p className="text-sm font-medium">Click to upload a CSV file</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Expected columns: Package Name, Product 1, Product 2,<br/>Product 3, Amount, Price
            </p>
            <p className="text-xs text-muted-foreground mt-1">Products matched by name (case-insensitive) to this project.</p>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange}/>
          </div>
        )}

        {step==='preview' && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 font-medium">{validRows.length} ready to import</span>
              {invalidRows.length>0&&<span className="text-destructive font-medium flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5"/>{invalidRows.length} with errors (skipped)</span>}
            </div>
            <div className="max-h-96 overflow-auto rounded-lg border text-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2">Package Name</TableHead>
                    <TableHead className="text-xs py-2">Product 1</TableHead>
                    <TableHead className="text-xs py-2">Product 2</TableHead>
                    <TableHead className="text-xs py-2">Product 3</TableHead>
                    <TableHead className="text-xs py-2 text-right">Qty</TableHead>
                    <TableHead className="text-xs py-2 text-right">Price</TableHead>
                    <TableHead className="text-xs py-2 w-6"/>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row,i) => (
                    <TableRow key={i} className={row.error?'bg-destructive/5':undefined}>
                      <TableCell className="py-1.5 font-medium">{row.packageName||'—'}</TableCell>
                      <TableCell className="py-1.5">{row.product1||'—'}</TableCell>
                      <TableCell className="py-1.5 text-muted-foreground">{row.product2||'—'}</TableCell>
                      <TableCell className="py-1.5 text-muted-foreground">{row.product3||'—'}</TableCell>
                      <TableCell className="py-1.5 text-right">{row.amount}</TableCell>
                      <TableCell className="py-1.5 text-right">{formatCurrency(row.price)}</TableCell>
                      <TableCell className="py-1.5">{row.error&&<span title={row.error} className="text-destructive cursor-help"><AlertCircle className="h-3.5 w-3.5"/></span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>Cancel</Button>
          {step==='preview'&&(
            <Button onClick={handleImport} disabled={importing||validRows.length===0}>
              {importing?'Importing…':`Import ${validRows.length} Package${validRows.length!==1?'s':''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
