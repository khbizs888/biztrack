'use client'

import { useState } from 'react'
import type { Project } from '@/lib/hooks/useProjects'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  existingProjects: Project[]
  onAdd: (name: string, code: string) => void
}

export default function AddProjectModal({ open, onClose, existingProjects, onAdd }: Props) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  function handleClose() {
    setName('')
    setCode('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimName = name.trim()
    const trimCode = code.trim().toUpperCase()
    if (!trimName) { toast.error('Project name is required'); return }
    if (!trimCode) { toast.error('Project code is required'); return }
    if (existingProjects.some(p => p.code === trimCode)) {
      toast.error(`Code "${trimCode}" already exists`)
      return
    }
    onAdd(trimName, trimCode)
    toast.success(`Project "${trimName}" created`)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Project Name <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Nature Essence"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Code <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. NE"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">Short uppercase identifier, e.g. FIOR, NE, DD</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Create Project</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
