-- ============================================================
-- SQL Migration Script: Employee Management System
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'Stylist',
  salary_type TEXT DEFAULT 'monthly', -- 'monthly' or 'daily'
  base_rate INTEGER DEFAULT 0,
  email TEXT,
  joining_date DATE DEFAULT CURRENT_DATE,
  id_proof_number TEXT,
  bank_details TEXT, -- formatted text
  emergency_contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ATTENDANCE TABLE
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

-- 3. PAYSLIPS TABLE
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

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

-- Policies for public (anon key) CRUD access
CREATE POLICY "Allow public read employees" ON employees FOR SELECT USING (true);
CREATE POLICY "Allow public insert employees" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update employees" ON employees FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete employees" ON employees FOR DELETE USING (true);

CREATE POLICY "Allow public read attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow public insert attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update attendance" ON attendance FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete attendance" ON attendance FOR DELETE USING (true);

CREATE POLICY "Allow public read payslips" ON payslips FOR SELECT USING (true);
CREATE POLICY "Allow public insert payslips" ON payslips FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update payslips" ON payslips FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete payslips" ON payslips FOR DELETE USING (true);

-- Seed initial employee data
INSERT INTO employees (name, phone, role, salary_type, base_rate) VALUES
  ('Riya Sen', '9876543210', 'Senior Stylist', 'monthly', 25000),
  ('Pooja Patel', '8765432109', 'Makeup Assistant', 'daily', 800)
ON CONFLICT DO NOTHING;
