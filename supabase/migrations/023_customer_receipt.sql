-- Migration 023: Customer payment receipt storage
ALTER TABLE customers ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz;
