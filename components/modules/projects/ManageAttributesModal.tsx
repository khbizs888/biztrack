'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAttributeSchema,
  createAttributeSchema,
  updateAttributeSchema,
  deleteAttributeSchema,
} from '@/app/actions/data'
import type { PackageAttributeSchema, AttributeType } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  open: boolean
  onClose: () => void
}

const ATTR_TYPE_LABELS: Record<AttributeType, string> = {
  text: 'Text',
  number: 'Number',
  boolean: 'Yes / No',
  select: 'Dropdown',
}

const TYPE_BADGE: Record<AttributeType, string> = {
  text: 'bg-blue-50 text-blue-700',
  number: 'bg-purple-50 text-purple-700',
  boolean: 'bg-orange-50 text-orange-700',
  select: 'bg-green-50 text-green-700',
}

interface AttrForm {
  attribute_key: string
  attribute_label: string
  attribute_type: AttributeType
  options_raw: string   // comma-separated for 'select' type
  is_required: boolean
}

const EMPTY_FORM: AttrForm = {
  attribute_key: '',
  attribute_label: '',
  attribute_type: 'text',
  options_raw: '',
  is_required: false,
}

export default function ManageAttributesModal({ projectId, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<AttrForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: schema = [] } = useQuery<PackageAttributeSchema[]>({
    queryKey: ['attr-schema', projectId],
    queryFn: () => fetchAttributeSchema(projectId),
    enabled: open,
  })

  function setF(patch: Partial<AttrForm>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  function startEdit(attr: PackageAttributeSchema) {
    setEditingId(attr.id)
    setForm({
      attribute_key: attr.attribute_key,
      attribute_label: attr.attribute_label,
      attribute_type: attr.attribute_type,
      options_raw: (attr.options ?? []).join(', '),
      is_required: attr.is_required,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function parseOptions(raw: string): string[] {
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  }

  async function handleSave() {
    if (!form.attribute_label.trim()) { toast.error('Label is required'); return }
    if (!editingId && !form.attribute_key.trim()) { toast.error('Key is required'); return }
    if (form.attribute_type === 'select' && !form.options_raw.trim()) {
      toast.error('Add at least one option for dropdown type'); return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateAttributeSchema(editingId, {
          attribute_label: form.attribute_label.trim(),
          attribute_type: form.attribute_type,
          options: parseOptions(form.options_raw),
          is_required: form.is_required,
        })
        toast.success('Attribute updated')
      } else {
        await createAttributeSchema({
          project_id: projectId,
          attribute_key: form.attribute_key.trim(),
          attribute_label: form.attribute_label.trim(),
          attribute_type: form.attribute_type,
          options: parseOptions(form.options_raw),
          is_required: form.is_required,
          sort_order: schema.length,
        })
        toast.success('Attribute added')
      }
      queryClient.invalidateQueries({ queryKey: ['attr-schema', projectId] })
      cancelEdit()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAttributeSchema(id)
      queryClient.invalidateQueries({ queryKey: ['attr-schema', projectId] })
      toast.success('Attribute removed')
      if (editingId === id) cancelEdit()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  function handleClose() {
    cancelEdit()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Package Attributes</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Define custom fields that appear when adding a package for this project.
          </p>
        </DialogHeader>

        {/* Existing attributes */}
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {schema.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No attributes yet.</p>
          )}
          {schema.map(attr => (
            <div
              key={attr.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                editingId === attr.id ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50'
              )}
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium">{attr.attribute_label}</span>
                <span className="text-muted-foreground text-xs ml-1.5 font-mono">{attr.attribute_key}</span>
                {attr.is_required && (
                  <span className="ml-1.5 text-xs text-red-500">*</span>
                )}
              </div>
              <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', TYPE_BADGE[attr.attribute_type])}>
                {ATTR_TYPE_LABELS[attr.attribute_type]}
              </span>
              {attr.attribute_type === 'select' && attr.options.length > 0 && (
                <span className="text-xs text-muted-foreground">{attr.options.length} opts</span>
              )}
              <button
                onClick={() => startEdit(attr)}
                className="p-1 rounded hover:bg-white text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(attr.id)}
                className="p-1 rounded hover:bg-white text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add / Edit form */}
        <div className="border rounded-lg p-4 space-y-3 bg-white">
          <p className="text-sm font-medium text-gray-700">
            {editingId ? 'Edit Attribute' : 'Add Attribute'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Key <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. color"
                value={form.attribute_key}
                onChange={e => setF({ attribute_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                disabled={!!editingId}
                className="text-xs h-8 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Display Label <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Color"
                value={form.attribute_label}
                onChange={e => setF({ attribute_label: e.target.value })}
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={form.attribute_type}
                onValueChange={v => setF({ attribute_type: v as AttributeType })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ATTR_TYPE_LABELS) as [AttributeType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Required</Label>
              <Select
                value={form.is_required ? 'yes' : 'no'}
                onValueChange={v => setF({ is_required: v === 'yes' })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no" className="text-xs">Optional</SelectItem>
                  <SelectItem value="yes" className="text-xs">Required</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.attribute_type === 'select' && (
            <div className="space-y-1">
              <Label className="text-xs">Options (comma-separated)</Label>
              <Input
                placeholder="e.g. Red, Blue, Green"
                value={form.options_raw}
                onChange={e => setF({ options_raw: e.target.value })}
                className="text-xs h-8"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {editingId && (
              <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8 text-xs">
                <X className="h-3 w-3 mr-1" />Cancel
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs">
              {editingId
                ? <><Check className="h-3 w-3 mr-1" />Save Changes</>
                : <><Plus className="h-3 w-3 mr-1" />Add Attribute</>
              }
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
