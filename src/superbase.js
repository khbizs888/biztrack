import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://alzrtdyayhqspdaaxdla.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsenJ0ZHlheWhxc3BkYWF4ZGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTAyNzcsImV4cCI6MjA4OTcyNjI3N30.qET8aoQDdbibSYGs1djSwA4p9P_I3rVRuHwGKcVJAO8'

export const supabase = createClient(supabaseUrl, supabaseKey)