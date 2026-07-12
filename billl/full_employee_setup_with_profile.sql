-- ============================================================
-- SQL Setup & Migration: Employee Management System
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create employees table if not exists
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'Stylist',
  salary_type TEXT DEFAULT 'monthly',
  base_rate INTEGER DEFAULT 0,
  email TEXT,
  joining_date DATE DEFAULT CURRENT_DATE,
  password TEXT DEFAULT 'emp123',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Alter table to add new profile columns in case employees table already existed
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emp_id TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhaar_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full Time';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhaar_photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS owner_notes TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_msg TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 12;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_details TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_start TEXT DEFAULT '09:00';

-- 3. Create attendance table if not exists
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT DEFAULT 'Present',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create payslips table if not exists
CREATE TABLE IF NOT EXISTS payslips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  base_pay INTEGER DEFAULT 0,
  allowances INTEGER DEFAULT 0,
  deductions INTEGER DEFAULT 0,
  net_pay INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_employee_month UNIQUE (employee_id, month)
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (to avoid errors) and recreate
DROP POLICY IF EXISTS "Allow public read employees" ON employees;
DROP POLICY IF EXISTS "Allow public insert employees" ON employees;
DROP POLICY IF EXISTS "Allow public update employees" ON employees;
DROP POLICY IF EXISTS "Allow public delete employees" ON employees;

CREATE POLICY "Allow public read employees" ON employees FOR SELECT USING (true);
CREATE POLICY "Allow public insert employees" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update employees" ON employees FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete employees" ON employees FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read attendance" ON attendance;
DROP POLICY IF EXISTS "Allow public insert attendance" ON attendance;
DROP POLICY IF EXISTS "Allow public update attendance" ON attendance;
DROP POLICY IF EXISTS "Allow public delete attendance" ON attendance;

CREATE POLICY "Allow public read attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow public insert attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update attendance" ON attendance FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete attendance" ON attendance FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read payslips" ON payslips;
DROP POLICY IF EXISTS "Allow public insert payslips" ON payslips;
DROP POLICY IF EXISTS "Allow public update payslips" ON payslips;
DROP POLICY IF EXISTS "Allow public delete payslips" ON payslips;

CREATE POLICY "Allow public read payslips" ON payslips FOR SELECT USING (true);
CREATE POLICY "Allow public insert payslips" ON payslips FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update payslips" ON payslips FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete payslips" ON payslips FOR DELETE USING (true);

-- Seed initial employee data (if they don't exist yet)
INSERT INTO employees (name, phone, role, salary_type, base_rate, password, emp_id) VALUES
  ('Kumari', '9876543211', 'Stylist', 'monthly', 6000, 'emp123', 'kalai-emp-01')
ON CONFLICT DO NOTHING;
