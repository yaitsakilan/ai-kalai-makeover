-- Run this script in your Supabase SQL Editor to add detailed employee profile fields

-- 1. Add new columns to the employees table (if they don't already exist)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emp_id TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhaar_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full Time';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT; -- Stores Base64 string or image URL
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhaar_photo_url TEXT; -- Stores Base64 string or image URL
ALTER TABLE employees ADD COLUMN IF NOT EXISTS owner_notes TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_msg TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 12;

-- 2. Populate emp_id for existing default employees in the database (sorted by name/creation)
UPDATE employees SET emp_id = 'kalai-emp-01' WHERE LOWER(name) LIKE '%kumari%' AND emp_id IS NULL;
UPDATE employees SET emp_id = 'kalai-emp-02' WHERE LOWER(name) LIKE '%riya%' AND emp_id IS NULL;
UPDATE employees SET emp_id = 'kalai-emp-03' WHERE LOWER(name) LIKE '%pooja%' AND emp_id IS NULL;

-- 3. In case any remaining employees have no emp_id, we can assign a temporary pattern or leave it for dynamic backfill
