'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Upload customer receipt ──────────────────────────────────────────────────

export async function uploadCustomerReceipt(
  customerId: string,
  formData: FormData,
): Promise<string> {
  const supabase = createAdminClient()
  const file = formData.get('file') as File | null
  if (!file) throw new Error('No file provided')

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === 'receipts')
  if (!bucketExists) {
    const { error: bucketErr } = await supabase.storage.createBucket('receipts', { public: true })
    if (bucketErr) throw new Error('Failed to create receipts bucket: ' + bucketErr.message)
  }

  // Upload file
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${customerId}/${timestamp}_${safeName}`
  const buffer = new Uint8Array(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) throw new Error('Upload failed: ' + uploadErr.message)

  // Get public URL
  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)

  // Update customer record
  const { error: updateErr } = await supabase
    .from('customers')
    .update({ receipt_url: publicUrl, receipt_uploaded_at: new Date().toISOString() })
    .eq('id', customerId)

  if (updateErr) throw new Error('Failed to update customer: ' + updateErr.message)

  return publicUrl
}

// ─── Remove customer receipt ──────────────────────────────────────────────────

export async function removeCustomerReceipt(
  customerId: string,
  filePath: string,
): Promise<void> {
  const supabase = createAdminClient()

  // Delete from storage (best-effort — don't fail if file is already gone)
  if (filePath) {
    await supabase.storage.from('receipts').remove([filePath])
  }

  // Clear the customer record
  const { error } = await supabase
    .from('customers')
    .update({ receipt_url: null, receipt_uploaded_at: null })
    .eq('id', customerId)

  if (error) throw new Error('Failed to update customer: ' + error.message)
}
