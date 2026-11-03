-- Supabase SQL Migration Script
-- Run this in your Supabase SQL Editor. Safe to run more than once.
--  • shop_settings: every phone uses the same shop WiFi for attendance check-in.
--    Without it the captured WiFi stays on the owner's phone only, and staff phones cannot check in.
--  • bill_queue: bills staff prepare wait here for the owner to send from the owner's WhatsApp.
--    Without it staff phones cannot send bills.
--  • employees.allowed_forms: which forms each staff member sees, chosen in their profile.
--    Without it staff see every form.

-- 1. Shared shop settings, one row per setting (the shop WiFi is stored under key 'shop_wifi')
CREATE TABLE IF NOT EXISTS shop_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read shop_settings" ON shop_settings;
DROP POLICY IF EXISTS "Allow public insert shop_settings" ON shop_settings;
DROP POLICY IF EXISTS "Allow public update shop_settings" ON shop_settings;
CREATE POLICY "Allow public read shop_settings" ON shop_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert shop_settings" ON shop_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update shop_settings" ON shop_settings FOR UPDATE USING (true) WITH CHECK (true);

-- 2. Customer bills waiting for the owner to send
CREATE TABLE IF NOT EXISTS bill_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  kind TEXT,                         -- 'Shop Bill', 'Event Invoice', 'Student Receipt'
  created_by TEXT,                   -- staff member who prepared it
  status TEXT DEFAULT 'pending',     -- 'pending', 'sent', 'dismissed'
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bill_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read bill_queue" ON bill_queue;
DROP POLICY IF EXISTS "Allow public insert bill_queue" ON bill_queue;
DROP POLICY IF EXISTS "Allow public update bill_queue" ON bill_queue;
CREATE POLICY "Allow public read bill_queue" ON bill_queue FOR SELECT USING (true);
CREATE POLICY "Allow public insert bill_queue" ON bill_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update bill_queue" ON bill_queue FOR UPDATE USING (true) WITH CHECK (true);

-- 3. Forms shown on each staff member's page (NULL = all forms)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS allowed_forms JSONB;

-- 4. After running this, open Employees > Attendance at the salon and tap "Re-capture Shop WiFi"
