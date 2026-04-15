'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProjects } from '@/lib/hooks/useProjects'
import type { CustomField, Package } from '@/lib/hooks/useProjects'
import PageHeader from '@/components/shared/PageHeader'
import AddPackageModal from '@/components/modules/projects/AddPackageModal'
import { useCleanupDialogArtifacts } from '@/lib/hooks/use-cleanup-dialog-artifacts'
import EditPackageModal from '@/components/modules/projects/EditPackageModal'
import ImportPackagesCSVModal from '@/components/modules/projects/ImportPackagesCSVModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Package2, AlertTriangle, FileUp, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'packages' | 'settings' | 'fields'

// ─── Custom Field type selector options ───────────────────────────────────────

const FIELD_TYPE_LABELS: Record<CustomField['type'], string> = {
  text:    'Text',
  number:  'Number',
  boolean: 'Yes / No',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSnakeCase(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  useCleanupDialogArtifacts()
  const { id } = params
  const router = useRouter()
  const {
    projects, ready,
    addPackage, updatePackage, deletePackage,
    updateProject, deleteProject,
    addCustomField, deleteCustomField,
  } = useProjects()

  const [tab, setTab] = useState<Tab>('packages')
  const [showAddPkg, setShowAddPkg]         = useState(false)
  const [showImportCSV, setShowImportCSV]   = useState(false)
  const [editingPkg, setEditingPkg]         = useState<Package | null>(null)
  const [deletingPkgId, setDeletingPkgId]   = useState<string | null>(null)
  const [showDeleteProject, setShowDeleteProject] = useState(false)

  // Settings form state
  const [settingsName, setSettingsName] = useState('')
  const [settingsCode, setSettingsCode] = useState('')
  const [settingsInit, setSettingsInit] = useState(false)

  // Custom fields form state
  const [showAddField, setShowAddField]       = useState(false)
  const [newFieldLabel, setNewFieldLabel]     = useState('')
  const [newFieldKey, setNewFieldKey]         = useState('')
  const [newFieldType, setNewFieldType]       = useState<CustomField['type']>('text')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false)
  const [savingField, setSavingField]         = useState(false)

  if (!ready) return null

  const project = projects.find(p => p.id === id)
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/projects')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  const customFields = project.customFields ?? []

  // Init settings form once
  if (!settingsInit) {
    setSettingsName(project.name)
    setSettingsCode(project.code)
    setSettingsInit(true)
  }

  // ── Settings handlers ──────────────────────────────────────────────────────

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    const trimName = settingsName.trim()
    const trimCode = settingsCode.trim().toUpperCase()
    if (!trimName || !trimCode) { toast.error('Name and code are required'); return }
    const duplicate = projects.some(p => p.code === trimCode && p.id !== id)
    if (duplicate) { toast.error(`Code "${trimCode}" already used by another project`); return }
    updateProject(id, trimName, trimCode)
    toast.success('Project updated')
  }

  function handleDeleteProject() {
    deleteProject(id)
    toast.success(`Project "${project?.name ?? 'Project'}" deleted`)
    router.push('/projects')
  }

  // ── Package handlers ───────────────────────────────────────────────────────

  function handleDeletePackage() {
    if (!deletingPkgId) return
    const pkg = project?.packages.find(p => p.id === deletingPkgId)
    deletePackage(id, deletingPkgId)
    toast.success(`Package "${pkg?.name}" deleted`)
    setDeletingPkgId(null)
  }

  // ── Custom field handlers ──────────────────────────────────────────────────

  function handleNewFieldLabelChange(label: string) {
    setNewFieldLabel(label)
    if (!keyManuallyEdited) setNewFieldKey(toSnakeCase(label))
  }

  function resetAddFieldForm() {
    setNewFieldLabel('')
    setNewFieldKey('')
    setNewFieldType('text')
    setNewFieldRequired(false)
    setKeyManuallyEdited(false)
    setShowAddField(false)
  }

  async function handleSaveField(e: React.FormEvent) {
    e.preventDefault()
    const label = newFieldLabel.trim()
    const key   = newFieldKey.trim()
    if (!label) { toast.error('Label is required'); return }
    if (!key)   { toast.error('Key is required'); return }
    if (customFields.some(f => f.key === key)) { toast.error(`Key "${key}" already exists`); return }

    setSavingField(true)
    try {
      await addCustomField(id, { label, key, type: newFieldType, required: newFieldRequired })
      toast.success(`Custom field "${label}" added`)
      resetAddFieldForm()
    } finally {
      setSavingField(false)
    }
  }

  async function handleDeleteField(fieldId: string, fieldLabel: string) {
    await deleteCustomField(id, fieldId)
    toast.success(`Field "${fieldLabel}" removed`)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={`Code: ${project.code}`}>
        <Select value={id} onValueChange={v => router.push(`/projects/${v}`)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Switch project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-0 border-b">
        {([
          { key: 'packages', label: 'Packages' },
          { key: 'settings', label: 'Settings' },
          { key: 'fields',   label: 'Custom Fields' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            {t.key === 'fields' && customFields.length > 0 && (
              <span className="ml-1.5 text-xs bg-green-100 text-green-700 rounded-full px-1.5 py-0.5">
                {customFields.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Packages Tab ── */}
      {tab === 'packages' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">
              Packages
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({project.packages.length})
              </span>
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowImportCSV(true)}>
                <FileUp className="h-4 w-4 mr-1" />Import CSV
              </Button>
              <Button size="sm" onClick={() => setShowAddPkg(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Package
              </Button>
            </div>
          </div>

          {project.packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-white">
              <div className="bg-gray-100 rounded-full p-4 mb-3">
                <Package2 className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No packages yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Add your first package for this project</p>
              <Button size="sm" onClick={() => setShowAddPkg(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Package
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead>Code</TableHead>
                      <TableHead>Package Name</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Notes</TableHead>
                      {/* Dynamic custom field columns */}
                      {customFields.map(f => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.packages.map(pkg => (
                      <TableRow key={pkg.id}>
                        <TableCell>
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {pkg.code}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(pkg.price)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {pkg.notes || '—'}
                        </TableCell>
                        {/* Dynamic custom field values */}
                        {customFields.map(f => (
                          <TableCell key={f.key} className="text-sm text-muted-foreground max-w-[140px] truncate">
                            {f.type === 'boolean'
                              ? (pkg.customValues?.[f.key] === 'true' ? 'Yes' : pkg.customValues?.[f.key] === 'false' ? 'No' : '—')
                              : (pkg.customValues?.[f.key] || '—')}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingPkg(pkg)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeletingPkgId(pkg.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab ── */}
      {tab === 'settings' && (
        <div className="max-w-md space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Project Details</h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1">
                <Label>Project Name <span className="text-red-500">*</span></Label>
                <Input
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  placeholder="e.g. Nature Essence"
                />
              </div>
              <div className="space-y-1">
                <Label>Code <span className="text-red-500">*</span></Label>
                <Input
                  value={settingsCode}
                  onChange={e => setSettingsCode(e.target.value.toUpperCase())}
                  placeholder="e.g. NE"
                  className="font-mono uppercase"
                  maxLength={10}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
            <h3 className="font-semibold text-destructive mb-1">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete this project and all its packages. This cannot be undone.
            </p>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteProject(true)}>
              <Trash2 className="h-4 w-4 mr-1" />Delete Project
            </Button>
          </div>
        </div>
      )}

      {/* ── Custom Fields Tab ── */}
      {tab === 'fields' && (
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Custom Fields</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Extra data columns that appear when adding or importing packages for this project.
              </p>
            </div>
            {!showAddField && (
              <Button size="sm" onClick={() => setShowAddField(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Field
              </Button>
            )}
          </div>

          {/* Existing fields list */}
          {customFields.length > 0 ? (
            <div className="rounded-lg border bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead>Label</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead className="w-16 text-right">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customFields.map(field => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.label}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {field.key}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {FIELD_TYPE_LABELS[field.type]}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {field.required ? 'Yes' : 'No'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteField(field.id, field.label)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : !showAddField ? (
            <div className="rounded-lg border bg-white flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-gray-100 rounded-full p-3 mb-3">
                <Settings2 className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No custom fields yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Add fields like "Box Count", "Weight (g)", or "Is Bundle"
              </p>
              <Button size="sm" onClick={() => setShowAddField(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Field
              </Button>
            </div>
          ) : null}

          {/* Add field inline form */}
          {showAddField && (
            <div className="rounded-lg border bg-white p-5">
              <h4 className="font-medium text-gray-900 mb-4">New Custom Field</h4>
              <form onSubmit={handleSaveField} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Label <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder='e.g. Box Count'
                      value={newFieldLabel}
                      onChange={e => handleNewFieldLabelChange(e.target.value)}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">Shown to the user</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Key <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder='e.g. box_count'
                      value={newFieldKey}
                      onChange={e => { setNewFieldKey(e.target.value); setKeyManuallyEdited(true) }}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Storage key (snake_case)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select
                      value={newFieldType}
                      onValueChange={v => setNewFieldType(v as CustomField['type'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Yes / No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Required</Label>
                    <div className="flex items-center gap-2 h-9">
                      <input
                        type="checkbox"
                        id="field-required"
                        checked={newFieldRequired}
                        onChange={e => setNewFieldRequired(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor="field-required" className="text-sm text-muted-foreground">
                        Make this field required
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={resetAddFieldForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingField}>
                    {savingField ? 'Saving…' : 'Save Field'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}

      <AddPackageModal
        open={showAddPkg}
        onClose={() => setShowAddPkg(false)}
        projectId={id}
        projectCode={project.code}
        customFields={customFields}
        onAdd={data => addPackage(id, data)}
      />

      <ImportPackagesCSVModal
        open={showImportCSV}
        onClose={() => setShowImportCSV(false)}
        projectCode={project.code}
        customFields={customFields}
        onImport={rows => rows.forEach(r => addPackage(id, r))}
      />

      <EditPackageModal
        open={!!editingPkg}
        onClose={() => setEditingPkg(null)}
        pkg={editingPkg}
        projectId={id}
        onSave={data => {
          if (editingPkg) {
            updatePackage(id, editingPkg.id, {
              ...data,
              customValues: editingPkg.customValues,
            })
          }
          setEditingPkg(null)
        }}
      />

      {/* Delete Package Confirmation */}
      <Dialog open={!!deletingPkgId} onOpenChange={open => { if (!open) setDeletingPkgId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Package
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <strong>{project.packages.find(p => p.id === deletingPkgId)?.name}</strong>?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeletingPkgId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePackage}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <Dialog open={showDeleteProject} onOpenChange={setShowDeleteProject}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Project
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{project.name}</strong> and all {project.packages.length} package
            {project.packages.length !== 1 ? 's' : ''}? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowDeleteProject(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProject}>Delete Project</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
