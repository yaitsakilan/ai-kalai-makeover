-- ============================================================
-- Kalai Makeover AI Assistant — Supabase Database Setup
-- Run this entire script in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. CUSTOMERS TABLE
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EVENTS TABLE
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
  review TEXT,
  rating INTEGER DEFAULT 5,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BILL SCANS TABLE
CREATE TABLE IF NOT EXISTS bill_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store TEXT,
  items JSONB DEFAULT '[]',
  total INTEGER DEFAULT 0,
  scan_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);



-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS and allow public access (anon key, no auth)
-- ============================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_scans ENABLE ROW LEVEL SECURITY;


-- Customers policies
CREATE POLICY "Allow public read customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update customers" ON customers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete customers" ON customers FOR DELETE USING (true);

-- Events policies
CREATE POLICY "Allow public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Allow public insert events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update events" ON events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete events" ON events FOR DELETE USING (true);

-- Expenses policies
CREATE POLICY "Allow public read expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Allow public insert expenses" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update expenses" ON expenses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete expenses" ON expenses FOR DELETE USING (true);

-- Bill scans policies
CREATE POLICY "Allow public read bill_scans" ON bill_scans FOR SELECT USING (true);
CREATE POLICY "Allow public insert bill_scans" ON bill_scans FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update bill_scans" ON bill_scans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete bill_scans" ON bill_scans FOR DELETE USING (true);



-- ============================================================
-- SEED DATA — Your existing mock data
-- ============================================================

-- Seed customers
INSERT INTO customers (name, phone, location, services, amount, payment_status, last_visit, total_spend, visits, rating) VALUES
  ('Priya Lakshmi', '9876543210', 'Chennai', ARRAY['Facial','Threading'], 2400, 'paid', '2024-01-15', 8600, 6, 5),
  ('Anita Sharma', '9988776655', 'Tambaram', ARRAY['Bridal Makeup'], 15000, 'pending', '2024-01-14', 15000, 1, 4),
  ('Deepa Raj', '9123456789', 'Velachery', ARRAY['Hair Color','Facial'], 3500, 'paid', '2024-01-13', 12000, 8, 5),
  ('Kavitha Devi', '9876501234', 'Adyar', ARRAY['Manicure','Pedicure'], 1200, 'paid', '2024-01-12', 5800, 5, 5),
  ('Sowmya Nair', '9765432198', 'T.Nagar', ARRAY['Haircut','Hair Spa'], 2000, 'pending', '2024-01-11', 7200, 4, 3);

-- Seed events
INSERT INTO events (customer, phone, type, date, total, advance, pending, status) VALUES
  ('Anita Sharma', '9988776655', 'Bridal Makeup', '2024-02-10', 25000, 10000, 15000, 'Booked'),
  ('Rekha Pillai', '9654321098', 'Reception Makeup', '2024-01-28', 18000, 18000, 0, 'Completed'),
  ('Meena Krishnan', '9543210987', 'Engagement Makeup', '2024-02-05', 12000, 5000, 7000, 'Booked'),
  ('Latha Balamurugan', '9432109876', 'Baby Shower', '2024-01-30', 8000, 3000, 5000, 'Pending');

-- Seed expenses
INSERT INTO expenses (category, amount, date, note) VALUES
  ('Rent', 15000, '2024-01-01', 'Monthly rent'),
  ('Products', 8500, '2024-01-05', 'Facial kit, cream'),
  ('Salary', 12000, '2024-01-07', 'Staff salary'),
  ('Electricity', 2200, '2024-01-10', 'Electricity bill'),
  ('Water', 500, '2024-01-10', 'Water bill'),
  ('Travel', 1200, '2024-01-12', 'Product purchase travel'),
  ('Miscellaneous', 800, '2024-01-14', 'Stationery & cleaning');

-- Seed bill scans
INSERT INTO bill_scans (store, items, total, scan_date) VALUES
  ('Beauty Mart Chennai', '[{"name":"Facial Kit","amount":2500},{"name":"Cream","amount":1200},{"name":"Serum","amount":800}]'::jsonb, 4500, 'Jan 14'),
  ('Salon Supplies Co', '[{"name":"Hair Color","amount":1800},{"name":"Developer","amount":1000}]'::jsonb, 2800, 'Jan 10'),
  ('Cosmo Store', '[{"name":"Wax","amount":800},{"name":"Threading thread","amount":400}]'::jsonb, 1200, 'Jan 8');

-- ============================================================
-- 5. CLASS ENROLLMENTS TABLE & 6. CLASS PAYMENTS TABLE
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

ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read class_enrollments" ON class_enrollments FOR SELECT USING (true);
CREATE POLICY "Allow public insert class_enrollments" ON class_enrollments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update class_enrollments" ON class_enrollments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete class_enrollments" ON class_enrollments FOR DELETE USING (true);

CREATE POLICY "Allow public read class_payments" ON class_payments FOR SELECT USING (true);
CREATE POLICY "Allow public insert class_payments" ON class_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update class_payments" ON class_payments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete class_payments" ON class_payments FOR DELETE USING (true);

-- ============================================================
-- 7. JEWELS TABLE & 8. JEWEL RENTALS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS jewels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  purchase_price INTEGER DEFAULT 0,
  purchase_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  image_url TEXT,                     -- URL or base64 data URL of the jewel image
  total_rental_income INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Available',   -- 'Available', 'Rented', 'Retired'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For existing database migration:
-- ALTER TABLE jewels ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS jewel_rentals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jewel_id UUID REFERENCES jewels(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  rental_date DATE DEFAULT CURRENT_DATE,
  return_date DATE,
  rental_fee INTEGER DEFAULT 0,
  deposit INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',      -- 'Active', 'Returned'
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE jewels ENABLE ROW LEVEL SECURITY;
ALTER TABLE jewel_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read jewels" ON jewels FOR SELECT USING (true);
CREATE POLICY "Allow public insert jewels" ON jewels FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update jewels" ON jewels FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete jewels" ON jewels FOR DELETE USING (true);

CREATE POLICY "Allow public read jewel_rentals" ON jewel_rentals FOR SELECT USING (true);
CREATE POLICY "Allow public insert jewel_rentals" ON jewel_rentals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update jewel_rentals" ON jewel_rentals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete jewel_rentals" ON jewel_rentals FOR DELETE USING (true);

-- ============================================================
-- 9. MONTHLY BALANCES TABLE & EXPENSES MODIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,          -- Format 'YYYY-MM'
  cash_balance INTEGER DEFAULT 0,
  gpay_balance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For existing database migration:
-- ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';

ALTER TABLE monthly_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read monthly_balances" ON monthly_balances FOR SELECT USING (true);
CREATE POLICY "Allow public insert monthly_balances" ON monthly_balances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update monthly_balances" ON monthly_balances FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete monthly_balances" ON monthly_balances FOR DELETE USING (true);

-- ============================================================
-- DONE! Your database is ready. ✅
-- ============================================================
