'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { projectSchema, type ProjectFormData } from '@/lib/validations'
import PageHeader from '@/components/shared/PageHeader'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { Plus, FolderKanban, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function ProjectsPage() {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('*, products(id), packages(id)')
        .order('created_at')
      return data ?? []
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  })

  async function onSubmit(data: ProjectFormData) {
    const { error } = await supabase.from('projects').insert({ name: data.name, code: data.code.toUpperCase() })
    if (error) { toast.error(error.message); return }
    toast.success('Project created')
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    reset()
    setShowModal(false)
  }

  return (
    <div>
      <PageHeader title="Projects" description="Manage your product lines">
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1" />New Project
        </Button>
      </PageHeader>

      {isLoading ? <LoadingState /> : !projects?.length ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          action={{ label: 'Create Project', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/projects/${p.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{p.code}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground mb-3">
                  <span>{(p.products as any[])?.length ?? 0} products</span>
                  <span>{(p.packages as any[])?.length ?? 0} packages</span>
                </div>
                <p className="text-xs text-muted-foreground">Created {formatDate(p.created_at)}</p>
                <div className="flex items-center text-blue-600 text-sm mt-2 font-medium">
                  View details <ArrowRight className="h-3 w-3 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Project Name</Label>
              <Input placeholder="e.g. Nature Essence" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input placeholder="e.g. NE" {...register('code')} className="uppercase" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
