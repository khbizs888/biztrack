'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  fetchProjectsWithPackages,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  createPackageAction,
  updatePackageAction,
  deletePackageAction,
  createAttributeSchema,
  deleteAttributeSchema,
} from '@/app/actions/data'

export interface CustomField {
  id: string
  label: string       // display name, e.g. "Box Count"
  key: string         // storage key, e.g. "box_count"
  type: 'text' | 'number' | 'boolean'
  required: boolean
  defaultValue?: string
}

export interface Package {
  id: string
  projectId: string
  name: string
  code: string
  price: number
  notes?: string
  product_id?: string
  customValues: Record<string, string>
  createdAt: string
}

export interface Project {
  id: string
  name: string
  code: string
  createdAt: string
  packages: Package[]
  customFields: CustomField[]
}

const STORAGE_KEY = 'hoho_projects'

function loadCache(): Project[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Project[]
  } catch {}
  return null
}

function saveCache(projects: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch {}
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const cached = loadCache()
    if (cached) {
      setProjects(cached)
      setReady(true)
    }

    fetchProjectsWithPackages()
      .then(data => {
        // Supabase doesn't return customFields — preserve them from current local state
        setProjects(prev => {
          const fieldMap: Record<string, CustomField[]> = {}
          prev.forEach(p => { if (p.customFields?.length) fieldMap[p.id] = p.customFields })
          const merged = (data as any[]).map(p => ({
            ...p,
            customFields: fieldMap[p.id] ?? [],
          }))
          saveCache(merged)
          return merged
        })
        setReady(true)
      })
      .catch(err => {
        console.error('[useProjects] fetchProjectsWithPackages failed:', err)
        if (!cached) setReady(true)
      })
  }, [])

  const sync = useCallback((next: Project[]) => {
    setProjects(next)
    saveCache(next)
  }, [])

  // ── Projects ──────────────────────────────────────────────────────────────

  const addProject = useCallback(async (name: string, code: string) => {
    const tempId = 'temp_' + crypto.randomUUID()
    const optimistic: Project = {
      id: tempId,
      name,
      code: code.toUpperCase(),
      createdAt: new Date().toISOString(),
      packages: [],
      customFields: [],
    }
    setProjects(prev => {
      const next = [...prev, optimistic]
      saveCache(next)
      return next
    })

    try {
      const created = await createProjectAction(name, code)
      setProjects(prev => {
        const next = prev.map(p => p.id === tempId ? { ...created, customFields: [], packages: [] } : p)
        saveCache(next)
        return next
      })
      return created
    } catch (err) {
      setProjects(prev => {
        const next = prev.filter(p => p.id !== tempId)
        saveCache(next)
        return next
      })
      toast.error('Failed to save project')
      throw err
    }
  }, [])

  const updateProject = useCallback(async (id: string, name: string, code: string) => {
    const prev_snapshot = projects
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, name, code: code.toUpperCase() } : p)
      saveCache(next)
      return next
    })

    try {
      await updateProjectAction(id, name, code)
    } catch {
      sync(prev_snapshot)
      toast.error('Failed to update project')
    }
  }, [projects, sync])

  const deleteProject = useCallback(async (id: string) => {
    const prev_snapshot = projects
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id)
      saveCache(next)
      return next
    })

    try {
      await deleteProjectAction(id)
    } catch {
      sync(prev_snapshot)
      toast.error('Failed to delete project')
    }
  }, [projects, sync])

  // ── Custom Fields ─────────────────────────────────────────────────────────

  const addCustomField = useCallback(async (
    projectId: string,
    field: Omit<CustomField, 'id'>
  ): Promise<CustomField> => {
    const localId = crypto.randomUUID()
    const newField: CustomField = { id: localId, ...field }

    setProjects(prev => {
      const next = prev.map(p =>
        p.id === projectId
          ? { ...p, customFields: [...(p.customFields ?? []), newField] }
          : p
      )
      saveCache(next)
      return next
    })

    // Best-effort Supabase sync; update local id with the real db id on success
    try {
      const supabaseId = await createAttributeSchema({
        project_id:      projectId,
        attribute_key:   field.key,
        attribute_label: field.label,
        attribute_type:  field.type,
        options:         [],
        is_required:     field.required,
      })
      if (supabaseId) {
        const synced: CustomField = { ...newField, id: supabaseId }
        setProjects(prev => {
          const next = prev.map(p =>
            p.id === projectId
              ? { ...p, customFields: p.customFields.map(f => f.id === localId ? synced : f) }
              : p
          )
          saveCache(next)
          return next
        })
        return synced
      }
    } catch (err) {
      console.warn('[useProjects] createAttributeSchema sync failed (localStorage kept):', err)
    }

    return newField
  }, [])

  const deleteCustomField = useCallback(async (projectId: string, fieldId: string) => {
    setProjects(prev => {
      const next = prev.map(p =>
        p.id === projectId
          ? { ...p, customFields: (p.customFields ?? []).filter(f => f.id !== fieldId) }
          : p
      )
      saveCache(next)
      return next
    })

    try {
      await deleteAttributeSchema(fieldId)
    } catch (err) {
      console.warn('[useProjects] deleteAttributeSchema sync failed (localStorage kept):', err)
    }
  }, [])

  // ── Packages ──────────────────────────────────────────────────────────────

  const addPackage = useCallback(async (
    projectId: string,
    data: { name: string; code: string; price: number; notes?: string; customValues?: Record<string, string>; product_id?: string }
  ) => {
    const tempId = 'temp_' + crypto.randomUUID()
    const optimistic: Package = {
      id: tempId,
      projectId,
      name: data.name,
      code: data.code.toUpperCase(),
      price: data.price,
      notes: data.notes,
      product_id: data.product_id,
      customValues: data.customValues ?? {},
      createdAt: new Date().toISOString(),
    }
    setProjects(prev => {
      const next = prev.map(p =>
        p.id === projectId ? { ...p, packages: [...p.packages, optimistic] } : p
      )
      saveCache(next)
      return next
    })

    try {
      const created = await createPackageAction(
        projectId, data.name, data.code, data.price, data.notes, data.customValues, data.product_id
      )
      setProjects(prev => {
        const next = prev.map(p =>
          p.id === projectId
            ? { ...p, packages: p.packages.map(pkg => pkg.id === tempId ? created : pkg) }
            : p
        )
        saveCache(next)
        return next
      })
      return created
    } catch {
      setProjects(prev => {
        const next = prev.map(p =>
          p.id === projectId
            ? { ...p, packages: p.packages.filter(pkg => pkg.id !== tempId) }
            : p
        )
        saveCache(next)
        return next
      })
      toast.error('Failed to save package')
    }
  }, [])

  const updatePackage = useCallback(async (
    projectId: string,
    packageId: string,
    data: { name: string; code: string; price: number; notes?: string; customValues?: Record<string, string>; product_id?: string }
  ) => {
    const prev_snapshot = projects
    setProjects(prev => {
      const next = prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              packages: p.packages.map(pkg =>
                pkg.id === packageId
                  ? {
                      ...pkg,
                      name: data.name,
                      code: data.code.toUpperCase(),
                      price: data.price,
                      notes: data.notes,
                      product_id: data.product_id ?? pkg.product_id,
                      customValues: data.customValues ?? pkg.customValues,
                    }
                  : pkg
              ),
            }
          : p
      )
      saveCache(next)
      return next
    })

    try {
      await updatePackageAction(packageId, data.name, data.code, data.price, data.notes, data.customValues, data.product_id)
    } catch {
      sync(prev_snapshot)
      toast.error('Failed to update package')
    }
  }, [projects, sync])

  const deletePackage = useCallback(async (projectId: string, packageId: string) => {
    const prev_snapshot = projects
    setProjects(prev => {
      const next = prev.map(p =>
        p.id === projectId
          ? { ...p, packages: p.packages.filter(pkg => pkg.id !== packageId) }
          : p
      )
      saveCache(next)
      return next
    })

    try {
      await deletePackageAction(packageId)
    } catch {
      sync(prev_snapshot)
      toast.error('Failed to delete package')
    }
  }, [projects, sync])

  return {
    projects,
    ready,
    addProject,
    updateProject,
    deleteProject,
    addCustomField,
    deleteCustomField,
    addPackage,
    updatePackage,
    deletePackage,
  }
}
