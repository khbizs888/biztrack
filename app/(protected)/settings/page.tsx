'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { passwordSchema, type PasswordFormData } from '@/lib/validations'
import { fetchBrandSettings, saveBrandSetting } from '@/app/actions/brand-settings'
import { useProjects } from '@/lib/hooks/useProjects'
import PageHeader from '@/components/shared/PageHeader'
import ThemeCustomizer from '@/components/shared/ThemeCustomizer'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'

export default function SettingsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [savingBrand, setSavingBrand] = useState<string | null>(null)

  const { projects } = useProjects()
  const { data: brandSettings = [] } = useQuery({
    queryKey: ['brand-settings'],
    queryFn: fetchBrandSettings,
  })

  // Local editable state for brand settings
  const [brandEdits, setBrandEdits] = useState<Record<string, {
    vip_spend_threshold: string
    vip_order_threshold: string
    retention_days: string
    inactive_days: string
  }>>({})

  useEffect(() => {
    if (brandSettings.length > 0) {
      const edits: typeof brandEdits = {}
      for (const s of brandSettings) {
        edits[s.project_id] = {
          vip_spend_threshold: String(s.vip_spend_threshold),
          vip_order_threshold: String(s.vip_order_threshold),
          retention_days: String(s.retention_days),
          inactive_days: String(s.inactive_days),
        }
      }
      setBrandEdits(edits)
    }
  }, [brandSettings])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setDisplayName(user?.user_metadata?.full_name ?? '')
    })
  }, [])

  async function saveProfile() {
    setSavingProfile(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } })
    if (error) { toast.error(error.message); setSavingProfile(false); return }
    toast.success('Profile updated')
    setSavingProfile(false)
  }

  async function changePassword(data: PasswordFormData) {
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) { toast.error(error.message); return }
    toast.success('Password updated successfully')
    reset()
  }

  async function handleSaveBrandSetting(projectId: string) {
    const edit = brandEdits[projectId]
    if (!edit) return
    setSavingBrand(projectId)
    try {
      await saveBrandSetting(projectId, {
        vip_spend_threshold: parseFloat(edit.vip_spend_threshold) || 2000,
        vip_order_threshold: parseInt(edit.vip_order_threshold, 10) || 6,
        retention_days: parseInt(edit.retention_days, 10) || 365,
        inactive_days: parseInt(edit.inactive_days, 10) || 365,
      })
      toast.success('Brand settings saved')
      queryClient.invalidateQueries({ queryKey: ['brand-settings'] })
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save')
    } finally {
      setSavingBrand(null)
    }
  }

  function updateBrandEdit(projectId: string, field: string, value: string) {
    setBrandEdits(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], [field]: value },
    }))
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" />

      <ThemeCustomizer />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled className="bg-muted" />
          </div>
          <div className="space-y-1">
            <Label>Display Name</Label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} size="sm">
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Use a strong password with at least 6 characters</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(changePassword)} className="space-y-4">
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Confirm Password</Label>
              <Input type="password" placeholder="••••••••" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Brand VIP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand VIP & Retention Settings</CardTitle>
          <CardDescription>
            Configure VIP thresholds and retention windows per brand. These affect how customer tags are computed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {projects.map(project => {
            const edit = brandEdits[project.id]
            if (!edit) return null
            return (
              <div key={project.id} className="space-y-3 pb-4 border-b last:border-b-0 last:pb-0">
                <p className="text-sm font-semibold">{project.name} ({project.code ?? project.name})</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">VIP Spend Threshold (RM)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={edit.vip_spend_threshold}
                      onChange={e => updateBrandEdit(project.id, 'vip_spend_threshold', e.target.value)}
                      placeholder="2000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">VIP Order Threshold (orders)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={edit.vip_order_threshold}
                      onChange={e => updateBrandEdit(project.id, 'vip_order_threshold', e.target.value)}
                      placeholder="6"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Retention Window (days)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={edit.retention_days}
                      onChange={e => updateBrandEdit(project.id, 'retention_days', e.target.value)}
                      placeholder="365"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Inactive Threshold (days)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={edit.inactive_days}
                      onChange={e => updateBrandEdit(project.id, 'inactive_days', e.target.value)}
                      placeholder="365"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSaveBrandSetting(project.id)}
                  disabled={savingBrand === project.id}
                >
                  {savingBrand === project.id ? 'Saving...' : `Save ${project.name} Settings`}
                </Button>
              </div>
            )
          })}
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground">No projects found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
