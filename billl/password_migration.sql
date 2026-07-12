-- Supabase SQL Migration Script
-- Run this in your Supabase SQL Editor to support individual employee passwords

-- 1. Add the password column if it does not already exist
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Update existing employee 'Kumari' to have password 'emp123'
UPDATE employees SET password = 'emp123' WHERE LOWER(name) LIKE '%kumari%';

-- 3. Set default passwords for other existing default employees (optional)
UPDATE employees SET password = 'riya123' WHERE LOWER(name) LIKE '%riya%';
UPDATE employees SET password = 'pooja123' WHERE LOWER(name) LIKE '%pooja%';
