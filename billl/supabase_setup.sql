-- ============================================================
-- Kalai Makeover AI Assistant — Complete Master Database Setup & Migration
-- Safe to run on a new project or an existing one (Idempotent)
-- ============================================================

-- ============================================================
-- 1. CUSTOMERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  services TEXT[] DEFAULT '{}',
  amount INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT 'Cash',
  last_visit DATE DEFAULT CURRENT_DATE,
  total_spend INTEGER DEFAULT 0,
  visits INTEGER DEFAULT 1,
  rating INTEGER DEFAULT 5,
  referred_by TEXT,
  visit_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for existing customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS visit_history JSONB DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 5;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- ============================================================
-- 2. EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer TEXT NOT NULL,
  phone TEXT,
  type TEXT,
  date DATE,
  total INTEGER DEFAULT 0,
  advance INTEGER DEFAULT 0,
  pending INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  location TEXT,
  makeup_type TEXT,
  additional_makeup JSONB DEFAULT '[]',
  travel_allowance INTEGER DEFAULT 0,
  staff_wages JSONB DEFAULT '[]',      -- Array of {name, amount}
  review TEXT,
  rating INTEGER DEFAULT 5,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for existing events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS staff_wages JSONB DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS travel_allowance INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS additional_makeup JSONB DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS makeup_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS review TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 5;
ALTER TABLE events ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- ============================================================
-- 3. EXPENSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  payment_method TEXT DEFAULT 'Cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for existing expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';

-- ============================================================
-- 4. BILL SCANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store TEXT,
  items JSONB DEFAULT '[]',
  total INTEGER DEFAULT 0,
  scan_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. CLASS ENROLLMENTS & 6. CLASS PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  classes TEXT[] DEFAULT '{}',
  total_fee INTEGER DEFAULT 0,
  total_paid INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  start_date DATE DEFAULT CURRENT_DATE,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES class_enrollments(id) ON DELETE CASCADE,
  amount INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. JEWELS & 8. JEWEL RENTALS
-- ============================================================
CREATE TABLE IF NOT EXISTS jewels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  purchase_price INTEGER DEFAULT 0,
  purchase_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  total_rental_income INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Available',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for existing jewels table
ALTER TABLE jewels ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS jewel_rentals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jewel_id UUID REFERENCES jewels(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  rental_date DATE DEFAULT CURRENT_DATE,
  return_date DATE,
  rental_fee INTEGER DEFAULT 0,
  deposit INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. EMPLOYEES TABLE (Full Profile & Roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  emp_id TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'Stylist',
  salary_type TEXT DEFAULT 'monthly', -- 'monthly' or 'daily'
  base_rate INTEGER DEFAULT 0,
  email TEXT,
  joining_date DATE DEFAULT CURRENT_DATE,
  password TEXT DEFAULT 'emp123',
  dob DATE,
  address TEXT,
  emergency_name TEXT,
  emergency_number TEXT,
  emergency_contact TEXT,
  aadhaar_number TEXT,
  employment_type TEXT DEFAULT 'Full Time',
  status TEXT DEFAULT 'Active',
  photo_url TEXT,
  aadhaar_photo_url TEXT,
  owner_notes TEXT,
  employee_msg TEXT,
  leave_balance INTEGER DEFAULT 12,
  bank_details TEXT,
  shift_start TEXT DEFAULT '09:00',
  allowed_forms JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for existing employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emp_id TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'emp123';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhaar_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full Time';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhaar_photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS owner_notes TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_msg TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 12;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_details TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_start TEXT DEFAULT '09:00';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS allowed_forms JSONB;

-- ============================================================
-- 10. ATTENDANCE & 11. PAYSLIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT DEFAULT 'Present',       -- 'Present', 'Absent', 'Late', 'Half-day'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payslips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL,                -- Format 'YYYY-MM'
  base_pay INTEGER DEFAULT 0,
  allowances INTEGER DEFAULT 0,
  deductions INTEGER DEFAULT 0,
  net_pay INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending',       -- 'Pending', 'Paid'
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_employee_month UNIQUE (employee_id, month)
);

-- ============================================================
-- 12. MONTHLY BALANCES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,          -- Format 'YYYY-MM'
  cash_balance INTEGER DEFAULT 0,
  gpay_balance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. SHOP SETTINGS TABLE (Shared Shop WiFi & Config)
-- ============================================================
CREATE TABLE IF NOT EXISTS shop_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. BILL QUEUE TABLE (Staff bills approved & sent by owner)
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  kind TEXT,                         -- 'Shop Bill', 'Event Invoice', 'Student Receipt'
  created_by TEXT,                   -- Staff member who prepared it
  status TEXT DEFAULT 'pending',     -- 'pending', 'sent', 'dismissed'
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. REELS IDEAS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS reels_ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idea TEXT NOT NULL,
  status TEXT DEFAULT 'Planned',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) FOR ALL TABLES
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE jewels ENABLE ROW LEVEL SECURITY;
ALTER TABLE jewel_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels_ideas ENABLE ROW LEVEL SECURITY;

-- Macro drop & recreate policies safely
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'customers', 'events', 'expenses', 'bill_scans',
    'class_enrollments', 'class_payments', 'jewels', 'jewel_rentals',
    'employees', 'attendance', 'payslips', 'monthly_balances',
    'shop_settings', 'bill_queue', 'reels_ideas'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read %I" ON %I;', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public insert %I" ON %I;', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public update %I" ON %I;', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public delete %I" ON %I;', tbl, tbl);

    EXECUTE format('CREATE POLICY "Allow public read %I" ON %I FOR SELECT USING (true);', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow public insert %I" ON %I FOR INSERT WITH CHECK (true);', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow public update %I" ON %I FOR UPDATE USING (true) WITH CHECK (true);', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow public delete %I" ON %I FOR DELETE USING (true);', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_payslips_emp_month ON payslips(employee_id, month);
CREATE INDEX IF NOT EXISTS idx_class_payments_enrollment ON class_payments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_jewel_rentals_jewel ON jewel_rentals(jewel_id);
CREATE INDEX IF NOT EXISTS idx_bill_queue_status ON bill_queue(status);

-- ============================================================
-- DONE! All 15 tables are configured and ready. ✅
-- ============================================================
