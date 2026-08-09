// billl/js/db.js
import { showToast } from './ui.js';
import { state } from './state.js';

function getEmployeeSuffix() {
  if (state && state.userRole === 'employee') {
    if (window._selectedPortalEmployeeId && window._cachedEmployees) {
      const emp = window._cachedEmployees.find(e => e.id === window._selectedPortalEmployeeId);
      if (emp && emp.name) {
        return ` [Emp: ${emp.name}]`;
      }
    }
    return ' [Emp]';
  }
  return '';
}

const SUPABASE_URL = window.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';

export let db = null;

export function initDb() {
  if (db) return db;
  
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded. Check CDN script in HTML.');
    return null;
  }

  const url = window.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '';
  const key = window.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';

  const isPlaceholderUrl = !url || url.includes('YOUR_SUPABASE_PROJECT_ID');
  const isPlaceholderKey = !key || key.includes('YOUR_SUPABASE_ANON_KEY');

  if (isPlaceholderUrl || isPlaceholderKey) {
    console.warn('Supabase credentials in config.js are placeholders. Operating in LocalStorage fallback mode.');
    return null;
  }

  try {
    db = supabase.createClient(url, key);
  } catch (e) {
    console.error('Database client init failed:', e);
  }
  return db;
}

// Initialize on load
initDb();

// LocalStorage helpers
function getLocalItem(key, defaultVal = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch(e) { return defaultVal; }
}

function setLocalItem(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch(e) { console.error(`LocalStorage write error [${key}]:`, e); }
}

function genUUID() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
}

// ==========================================
//  CUSTOMERS DB OPERATIONS
// ==========================================

export async function fetchCustomers() {
  const client = initDb();
  if (!client) return fetchCustomersLocally();
  const {data, error} = await client.from('customers').select('*').order('created_at',{ascending:false});
  if(error) { console.warn('Fetch customers error, using local storage:', error); return fetchCustomersLocally(); }
  return data || [];
}

function fetchCustomersLocally() {
  const list = getLocalItem('customers', null);
  if (list === null) {
    const sample = [
      { id: 'demo-c1', name: 'Priya Sundar', phone: '9876543210', location: 'Chennai', services: ['Bridal Makeup', 'Facial'], amount: 3500, total_spend: 3500, rating: 5, payment_method: 'GPay', payment_status: 'completed', last_visit: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() },
      { id: 'demo-c2', name: 'Anitha Ramesh', phone: '9876543211', location: 'Tambaram', services: ['Hair Spa', 'Threading'], amount: 1200, total_spend: 1200, rating: 5, payment_method: 'Cash', payment_status: 'completed', last_visit: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() }
    ];
    setLocalItem('customers', sample);
    return sample;
  }
  return list;
}

export async function addCustomer(customer) {
  const client = initDb();
  const suffix = getEmployeeSuffix();
  if (suffix && customer.name) {
    customer.name = customer.name.trim() + suffix;
  }
  if (customer.amount !== undefined) customer.amount = Math.round(Number(customer.amount) || 0);
  if (customer.total_spend !== undefined) customer.total_spend = Math.round(Number(customer.total_spend) || 0);

  if (!client) {
    const newCust = { ...customer, id: customer.id || genUUID(), created_at: customer.created_at || new Date().toISOString() };
    const list = fetchCustomersLocally();
    list.unshift(newCust);
    setLocalItem('customers', list);
    showToast('Customer saved locally!');
    return newCust;
  }

  let {data, error} = await client.from('customers').insert([customer]).select();
  if (error && error.code === 'PGRST204') {
    const retryCustomer = { ...customer };
    let retrying = false;
    if ('rating' in retryCustomer) { delete retryCustomer.rating; retrying = true; }
    if ('payment_method' in retryCustomer) { delete retryCustomer.payment_method; retrying = true; }
    if (retrying) {
      const retryResult = await client.from('customers').insert([retryCustomer]).select();
      if (!retryResult.error) {
        showToast('Customer saved! (Warning: Run SQL setup to enable rating/payment_method)', 'info');
        return retryResult.data?.[0];
      }
      error = retryResult.error;
    }
  }
  if(error) {
    console.warn('Add customer DB error, saving locally:', error);
    const newCust = { ...customer, id: customer.id || genUUID(), created_at: customer.created_at || new Date().toISOString() };
    const list = fetchCustomersLocally();
    list.unshift(newCust);
    setLocalItem('customers', list);
    showToast('Customer saved locally!');
    return newCust;
  }
  showToast('Customer added successfully!');
  return data?.[0];
}

export async function updateCustomer(id, updates) {
  const client = initDb();
  if (updates.amount !== undefined) updates.amount = Math.round(Number(updates.amount) || 0);
  if (updates.total_spend !== undefined) updates.total_spend = Math.round(Number(updates.total_spend) || 0);

  if (!client) {
    const list = fetchCustomersLocally();
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      setLocalItem('customers', list);
      showToast('Customer visit updated locally!');
      return list[idx];
    }
    return null;
  }

  const { data, error } = await client.from('customers').update(updates).eq('id', id).select();
  if (error) {
    console.warn('Update customer DB error, updating locally:', error);
    const list = fetchCustomersLocally();
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      setLocalItem('customers', list);
      showToast('Customer visit updated locally!');
      return list[idx];
    }
    return null;
  }
  showToast('Customer visit updated successfully!');
  return data?.[0];
}

export async function deleteCustomer(id) {
  const client = initDb();
  if (!client) {
    const list = fetchCustomersLocally().filter(c => c.id !== id);
    setLocalItem('customers', list);
    showToast('Customer deleted');
    return true;
  }
  const {error} = await client.from('customers').delete().eq('id', id);
  if(error) {
    const list = fetchCustomersLocally().filter(c => c.id !== id);
    setLocalItem('customers', list);
    showToast('Customer deleted');
    return true;
  }
  showToast('Customer deleted');
  return true;
}

// ==========================================
//  EVENTS DB OPERATIONS
// ==========================================

export async function fetchEvents() {
  const client = initDb();
  if (!client) return fetchEventsLocally();
  const {data, error} = await client.from('events').select('*').order('date',{ascending:true});
  if(error) { console.warn('Fetch events error, using local storage:', error); return fetchEventsLocally(); }
  return data || [];
}

function fetchEventsLocally() {
  const list = getLocalItem('events', null);
  if (list === null) {
    const sample = [
      { id: 'demo-e1', customer: 'Kavitha M', phone: '9876543212', type: 'Bridal Makeup', date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], venue: 'Grand Palace Hall, Chennai', total: 15000, advance: 5000, pending: 10000, status: 'confirmed', notes: 'HD Airbrush Makeup', created_at: new Date().toISOString() }
    ];
    setLocalItem('events', sample);
    return sample;
  }
  return list;
}

export async function addEvent(event) {
  const client = initDb();
  const suffix = getEmployeeSuffix();
  if (suffix && event.customer) {
    event.customer = event.customer.trim() + suffix;
  }
  if (event.total !== undefined) event.total = Math.round(Number(event.total) || 0);
  if (event.advance !== undefined) event.advance = Math.round(Number(event.advance) || 0);
  if (event.pending !== undefined) event.pending = Math.round(Number(event.pending) || 0);

  if (!client) {
    const newEvt = { ...event, id: event.id || genUUID(), created_at: event.created_at || new Date().toISOString() };
    const list = fetchEventsLocally();
    list.unshift(newEvt);
    setLocalItem('events', list);
    showToast('Event booked locally!');
    return newEvt;
  }

  let {data, error} = await client.from('events').insert([event]).select();
  if(error) {
    console.warn('Add event DB error, saving locally:', error);
    const newEvt = { ...event, id: event.id || genUUID(), created_at: event.created_at || new Date().toISOString() };
    const list = fetchEventsLocally();
    list.unshift(newEvt);
    setLocalItem('events', list);
    showToast('Event booked locally!');
    return newEvt;
  }
  showToast('Event booked successfully!');
  return data?.[0];
}

export async function updateEvent(id, event) {
  const client = initDb();
  if (event.total !== undefined) event.total = Math.round(Number(event.total) || 0);
  if (event.advance !== undefined) event.advance = Math.round(Number(event.advance) || 0);
  if (event.pending !== undefined) event.pending = Math.round(Number(event.pending) || 0);

  if (!client) {
    let list = fetchEventsLocally();
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...event };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('events', list);
    showToast('Event updated locally!');
    return updatedItem;
  }

  const {data, error} = await client.from('events').update(event).eq('id', id).select();
  if(error) {
    let list = fetchEventsLocally();
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...event };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('events', list);
    showToast('Event updated locally!');
    return updatedItem;
  }
  showToast('Event updated successfully!');
  return data?.[0];
}

export async function deleteEvent(id) {
  const client = initDb();
  if (!client) {
    const list = fetchEventsLocally().filter(e => e.id !== id);
    setLocalItem('events', list);
    showToast('Event deleted');
    return true;
  }
  const {error} = await client.from('events').delete().eq('id', id);
  if(error) {
    const list = fetchEventsLocally().filter(e => e.id !== id);
    setLocalItem('events', list);
    showToast('Event deleted');
    return true;
  }
  showToast('Event deleted');
  return true;
}

// ==========================================
//  EXPENSES DB OPERATIONS
// ==========================================

export async function fetchExpenses() {
  const client = initDb();
  if (!client) return fetchExpensesLocally();
  const {data, error} = await client.from('expenses').select('*').order('date',{ascending:false});
  if(error) { console.warn('Fetch expenses error, using local storage:', error); return fetchExpensesLocally(); }
  return data || [];
}

function fetchExpensesLocally() {
  const list = getLocalItem('expenses', null);
  if (list === null) {
    const sample = [
      { id: 'demo-ex1', name: 'Salon Rent', category: 'Rent', amount: 12000, type: 'general', date: new Date().toISOString().split('T')[0], note: 'Monthly shop rent', created_at: new Date().toISOString() },
      { id: 'demo-ex2', name: 'MAC Foundation & Cosmetics', category: 'Product', amount: 4500, type: 'product', date: new Date().toISOString().split('T')[0], note: 'Restock cosmetics', created_at: new Date().toISOString() }
    ];
    setLocalItem('expenses', sample);
    return sample;
  }
  return list;
}

export async function addExpense(expense) {
  const client = initDb();
  const suffix = getEmployeeSuffix();
  if (suffix) {
    expense.note = expense.note && expense.note.trim() ? expense.note.trim() + suffix : suffix.trim();
  }
  if (expense.amount !== undefined) expense.amount = Math.round(Number(expense.amount) || 0);

  if (!client) {
    const newExp = { ...expense, id: expense.id || genUUID(), created_at: expense.created_at || new Date().toISOString() };
    const list = fetchExpensesLocally();
    list.unshift(newExp);
    setLocalItem('expenses', list);
    showToast('Expense added locally!');
    return newExp;
  }

  let {data, error} = await client.from('expenses').insert([expense]).select();
  if(error) {
    console.warn('Add expense DB error, saving locally:', error);
    const newExp = { ...expense, id: expense.id || genUUID(), created_at: expense.created_at || new Date().toISOString() };
    const list = fetchExpensesLocally();
    list.unshift(newExp);
    setLocalItem('expenses', list);
    showToast('Expense added locally!');
    return newExp;
  }
  showToast('Expense added successfully!');
  return data?.[0];
}

export async function deleteExpense(id) {
  const client = initDb();
  if (!client) {
    const list = fetchExpensesLocally().filter(e => e.id !== id);
    setLocalItem('expenses', list);
    showToast('Expense deleted');
    return true;
  }
  const {error} = await client.from('expenses').delete().eq('id', id);
  if(error) {
    const list = fetchExpensesLocally().filter(e => e.id !== id);
    setLocalItem('expenses', list);
    showToast('Expense deleted');
    return true;
  }
  showToast('Expense deleted');
  return true;
}

// ==========================================
//  BILL SCANS DB OPERATIONS
// ==========================================

export async function fetchBillScans() {
  const client = initDb();
  if (!client) return getLocalItem('bill_scans', []);
  const {data, error} = await client.from('bill_scans').select('*').order('created_at',{ascending:false});
  if(error) { return getLocalItem('bill_scans', []); }
  return data || [];
}

export async function addBillScan(scan) {
  const client = initDb();
  if (scan.total !== undefined) scan.total = Math.round(Number(scan.total) || 0);
  if (scan.items) {
    scan.items = scan.items.map(item => ({
      name: item.name,
      amount: Math.round(Number(item.amount) || 0)
    }));
  }

  if (!client) {
    const newScan = { ...scan, id: scan.id || genUUID(), created_at: new Date().toISOString() };
    const list = getLocalItem('bill_scans', []);
    list.unshift(newScan);
    setLocalItem('bill_scans', list);
    showToast('Bill scan saved locally!');
    return newScan;
  }

  const {data, error} = await client.from('bill_scans').insert([scan]).select();
  if(error) {
    const newScan = { ...scan, id: scan.id || genUUID(), created_at: new Date().toISOString() };
    const list = getLocalItem('bill_scans', []);
    list.unshift(newScan);
    setLocalItem('bill_scans', list);
    showToast('Bill scan saved locally!');
    return newScan;
  }
  showToast('Bill scan saved!');
  return data?.[0];
}

export async function deleteBillScan(id) {
  const client = initDb();
  if (!client) {
    const list = getLocalItem('bill_scans', []).filter(s => s.id !== id);
    setLocalItem('bill_scans', list);
    showToast('Bill scan deleted');
    return true;
  }
  const {error} = await client.from('bill_scans').delete().eq('id', id);
  if(error) {
    const list = getLocalItem('bill_scans', []).filter(s => s.id !== id);
    setLocalItem('bill_scans', list);
    showToast('Bill scan deleted');
    return true;
  }
  showToast('Bill scan deleted');
  return true;
}

// ==========================================
//  ACADEMY ENROLLMENTS DB OPERATIONS
// ==========================================

export async function fetchClassEnrollments() {
  const client = initDb();
  if (!client) return fetchClassEnrollmentsLocally();
  const {data, error} = await client.from('class_enrollments').select('*').order('created_at', {ascending:false});
  if(error) { console.warn('Fetch enrollments error, using local storage:', error); return fetchClassEnrollmentsLocally(); }
  return data || [];
}

function fetchClassEnrollmentsLocally() {
  const list = getLocalItem('class_enrollments', null);
  if (list === null) {
    const sample = [
      { id: 'demo-s1', name: 'Divya K', phone: '9876543213', course: 'Professional Bridal Makeup Course', batch: 'June 2026', total_fee: 25000, total_paid: 15000, status: 'Active', joining_date: '2026-06-01', created_at: new Date().toISOString() }
    ];
    setLocalItem('class_enrollments', sample);
    return sample;
  }
  return list;
}

export async function addClassEnrollment(enrollment) {
  const client = initDb();
  const suffix = getEmployeeSuffix();
  if (suffix && enrollment.name) {
    enrollment.name = enrollment.name.trim() + suffix;
  }
  if (enrollment.total_fee !== undefined) enrollment.total_fee = Math.round(Number(enrollment.total_fee) || 0);
  if (enrollment.total_paid !== undefined) enrollment.total_paid = Math.round(Number(enrollment.total_paid) || 0);

  if (!client) {
    const newEnr = { ...enrollment, id: enrollment.id || genUUID(), created_at: new Date().toISOString() };
    const list = fetchClassEnrollmentsLocally();
    list.unshift(newEnr);
    setLocalItem('class_enrollments', list);
    showToast('Student enrolled locally!');
    return newEnr;
  }

  const {data, error} = await client.from('class_enrollments').insert([enrollment]).select();
  if(error) {
    const newEnr = { ...enrollment, id: enrollment.id || genUUID(), created_at: new Date().toISOString() };
    const list = fetchClassEnrollmentsLocally();
    list.unshift(newEnr);
    setLocalItem('class_enrollments', list);
    showToast('Student enrolled locally!');
    return newEnr;
  }
  showToast('Student enrolled successfully!');
  return data?.[0];
}

export async function updateClassEnrollment(id, data) {
  const client = initDb();
  if (data.total_fee !== undefined) data.total_fee = Math.round(Number(data.total_fee) || 0);
  if (data.total_paid !== undefined) data.total_paid = Math.round(Number(data.total_paid) || 0);

  if (!client) {
    let list = fetchClassEnrollmentsLocally();
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...data };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('class_enrollments', list);
    return updatedItem;
  }

  const {data: result, error} = await client.from('class_enrollments').update(data).eq('id', id).select();
  if(error) {
    let list = fetchClassEnrollmentsLocally();
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...data };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('class_enrollments', list);
    return updatedItem;
  }
  return result?.[0];
}

export async function deleteClassEnrollment(id) {
  const client = initDb();
  if (!client) {
    const list = fetchClassEnrollmentsLocally().filter(s => s.id !== id);
    setLocalItem('class_enrollments', list);
    showToast('Student record deleted');
    return true;
  }
  const {error} = await client.from('class_enrollments').delete().eq('id', id);
  if(error) {
    const list = fetchClassEnrollmentsLocally().filter(s => s.id !== id);
    setLocalItem('class_enrollments', list);
    showToast('Student record deleted');
    return true;
  }
  showToast('Student record deleted');
  return true;
}

export async function fetchClassPayments(enrollmentId) {
  const client = initDb();
  if (!client) {
    return getLocalItem('class_payments', []).filter(p => p.enrollment_id === enrollmentId);
  }
  const {data, error} = await client.from('class_payments').select('*').eq('enrollment_id', enrollmentId).order('date', {ascending:true});
  if(error) { return getLocalItem('class_payments', []).filter(p => p.enrollment_id === enrollmentId); }
  return data || [];
}

export async function addClassPayment(payment) {
  const client = initDb();
  const suffix = getEmployeeSuffix();
  if (suffix) {
    payment.note = payment.note && payment.note.trim() ? payment.note.trim() + suffix : suffix.trim();
  }
  if (payment.amount !== undefined) payment.amount = Math.round(Number(payment.amount) || 0);

  if (!client) {
    const newPay = { ...payment, id: payment.id || genUUID(), created_at: new Date().toISOString() };
    const list = getLocalItem('class_payments', []);
    list.unshift(newPay);
    setLocalItem('class_payments', list);
    showToast('Payment recorded locally!');
    return newPay;
  }

  const {data, error} = await client.from('class_payments').insert([payment]).select();
  if(error) {
    const newPay = { ...payment, id: payment.id || genUUID(), created_at: new Date().toISOString() };
    const list = getLocalItem('class_payments', []);
    list.unshift(newPay);
    setLocalItem('class_payments', list);
    showToast('Payment recorded locally!');
    return newPay;
  }
  showToast('Payment recorded successfully!');
  return data?.[0];
}

export async function deleteClassPayment(id) {
  const client = initDb();
  if (!client) {
    const list = getLocalItem('class_payments', []).filter(p => p.id !== id);
    setLocalItem('class_payments', list);
    showToast('Payment deleted');
    return true;
  }
  const {error} = await client.from('class_payments').delete().eq('id', id);
  if(error) {
    const list = getLocalItem('class_payments', []).filter(p => p.id !== id);
    setLocalItem('class_payments', list);
    showToast('Payment deleted');
    return true;
  }
  showToast('Payment deleted');
  return true;
}

// ==========================================
//  JEWELRY INVENTORY DB OPERATIONS
// ==========================================

export async function fetchJewels() {
  const client = initDb();
  if (!client) return fetchJewelsLocally();
  const {data, error} = await client.from('jewels').select('*').order('created_at', {ascending:false});
  if(error) { console.warn('Fetch jewels error, using local storage:', error); return fetchJewelsLocally(); }
  return data || [];
}

function fetchJewelsLocally() {
  const list = getLocalItem('jewels', null);
  if (list === null) {
    const sample = [
      { id: 'demo-j1', name: 'Antic Kundan Bridal Set', code: 'J-001', category: 'Necklace Set', deposit: 2000, rental_fee: 1500, purchase_price: 12000, total_rental_income: 4500, status: 'Available', created_at: new Date().toISOString() }
    ];
    setLocalItem('jewels', sample);
    return sample;
  }
  return list;
}

export async function addJewel(jewel) {
  const client = initDb();
  const suffix = getEmployeeSuffix();
  if (suffix && jewel.name) {
    jewel.name = jewel.name.trim() + suffix;
  }
  if (jewel.purchase_price !== undefined) jewel.purchase_price = Math.round(Number(jewel.purchase_price) || 0);
  if (jewel.total_rental_income !== undefined) jewel.total_rental_income = Math.round(Number(jewel.total_rental_income) || 0);

  if (!client) {
    const newJewel = { ...jewel, id: jewel.id || genUUID(), created_at: new Date().toISOString() };
    const list = fetchJewelsLocally();
    list.unshift(newJewel);
    setLocalItem('jewels', list);
    showToast('Jewel added locally!');
    return newJewel;
  }

  let {data, error} = await client.from('jewels').insert([jewel]).select();
  if (error) {
    const newJewel = { ...jewel, id: jewel.id || genUUID(), created_at: new Date().toISOString() };
    const list = fetchJewelsLocally();
    list.unshift(newJewel);
    setLocalItem('jewels', list);
    showToast('Jewel added locally!');
    return newJewel;
  }
  showToast('Jewel added successfully!');
  return data?.[0];
}

export async function updateJewel(id, data) {
  const client = initDb();
  if (data.purchase_price !== undefined) data.purchase_price = Math.round(Number(data.purchase_price) || 0);
  if (data.total_rental_income !== undefined) data.total_rental_income = Math.round(Number(data.total_rental_income) || 0);

  if (!client) {
    let list = fetchJewelsLocally();
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...data };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('jewels', list);
    return updatedItem;
  }

  const {data: result, error} = await client.from('jewels').update(data).eq('id', id).select();
  if(error) {
    let list = fetchJewelsLocally();
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...data };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('jewels', list);
    return updatedItem;
  }
  return result?.[0];
}

export async function deleteJewel(id) {
  const client = initDb();
  if (!client) {
    const list = fetchJewelsLocally().filter(j => j.id !== id);
    setLocalItem('jewels', list);
    showToast('Jewel deleted');
    return true;
  }
  const {error} = await client.from('jewels').delete().eq('id', id);
  if(error) {
    const list = fetchJewelsLocally().filter(j => j.id !== id);
    setLocalItem('jewels', list);
    showToast('Jewel deleted');
    return true;
  }
  showToast('Jewel deleted');
  return true;
}

export async function fetchJewelRentals(jewelId) {
  const client = initDb();
  if (!client) {
    return getLocalItem('jewel_rentals', []).filter(r => r.jewel_id === jewelId);
  }
  const {data, error} = await client.from('jewel_rentals').select('*').eq('jewel_id', jewelId).order('rental_date', {ascending:true});
  if(error) { return getLocalItem('jewel_rentals', []).filter(r => r.jewel_id === jewelId); }
  return data || [];
}

export async function addJewelRental(rental) {
  const client = initDb();
  const suffix = getEmployeeSuffix();
  if (suffix && rental.customer_name) {
    rental.customer_name = rental.customer_name.trim() + suffix;
  }
  if (rental.rental_fee !== undefined) rental.rental_fee = Math.round(Number(rental.rental_fee) || 0);
  if (rental.deposit !== undefined) rental.deposit = Math.round(Number(rental.deposit) || 0);

  if (!client) {
    const newRental = { ...rental, id: rental.id || genUUID(), created_at: new Date().toISOString() };
    const list = getLocalItem('jewel_rentals', []);
    list.unshift(newRental);
    setLocalItem('jewel_rentals', list);
    showToast('Rental logged locally!');
    return newRental;
  }

  const {data, error} = await client.from('jewel_rentals').insert([rental]).select();
  if(error) {
    const newRental = { ...rental, id: rental.id || genUUID(), created_at: new Date().toISOString() };
    const list = getLocalItem('jewel_rentals', []);
    list.unshift(newRental);
    setLocalItem('jewel_rentals', list);
    showToast('Rental logged locally!');
    return newRental;
  }
  showToast('Rental logged successfully!');
  return data?.[0];
}

export async function updateJewelRental(id, data) {
  const client = initDb();
  if (data.rental_fee !== undefined) data.rental_fee = Math.round(Number(data.rental_fee) || 0);
  if (data.deposit !== undefined) data.deposit = Math.round(Number(data.deposit) || 0);

  if (!client) {
    let list = getLocalItem('jewel_rentals', []);
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...data };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('jewel_rentals', list);
    return updatedItem;
  }

  const {data: result, error} = await client.from('jewel_rentals').update(data).eq('id', id).select();
  if(error) {
    let list = getLocalItem('jewel_rentals', []);
    let updatedItem = null;
    list = getLocalItem('jewel_rentals', []).map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...data };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('jewel_rentals', list);
    return updatedItem;
  }
  return result?.[0];
}

export async function deleteJewelRental(id) {
  const client = initDb();
  if (!client) {
    const list = getLocalItem('jewel_rentals', []).filter(r => r.id !== id);
    setLocalItem('jewel_rentals', list);
    showToast('Rental record deleted');
    return true;
  }
  const {error} = await client.from('jewel_rentals').delete().eq('id', id);
  if(error) {
    const list = getLocalItem('jewel_rentals', []).filter(r => r.id !== id);
    setLocalItem('jewel_rentals', list);
    showToast('Rental record deleted');
    return true;
  }
  showToast('Rental record deleted');
  return true;
}

export async function fetchMonthlyBalances() {
  const client = initDb();
  if (!client) {
    return getLocalItem('monthly_balances', []);
  }
  
  const { data, error } = await client.from('monthly_balances').select('*').order('month', { ascending: false });
  if (error) {
    console.warn('Fetch monthly balances DB error, falling back to local storage:', error);
    return getLocalItem('monthly_balances', []);
  }
  return data || [];
}

export async function saveMonthlyBalance(balance) {
  const client = initDb();
  if (!client) {
    return saveMonthlyBalanceLocally(balance);
  }

  const { data, error } = await client.from('monthly_balances').upsert([balance], { onConflict: 'month' }).select();
  if (error) {
    console.warn('Upsert monthly balance DB error, falling back to local storage:', error);
    return saveMonthlyBalanceLocally(balance);
  }
  showToast('Starting balances saved successfully!');
  return data?.[0];
}

function saveMonthlyBalanceLocally(balance) {
  try {
    let local = getLocalItem('monthly_balances', []);
    local = local.filter(b => b.month !== balance.month);
    local.push(balance);
    setLocalItem('monthly_balances', local);
    showToast('Starting balances saved locally!');
    return balance;
  } catch(e) {
    console.error('Local storage save failed:', e);
    return null;
  }
}

// ==========================================
//  EMPLOYEES MANAGEMENT DB OPERATIONS
// ==========================================

export async function fetchEmployees() {
  const client = initDb();
  if (!client) return fetchEmployeesLocally();

  const { data, error } = await client.from('employees').select('*').order('name');
  if (error) {
    console.warn('Fetch employees DB error, falling back to local storage:', error);
    return fetchEmployeesLocally();
  }
  return data || [];
}

function fetchEmployeesLocally() {
  const list = getLocalItem('employees', []);
  const needsMigration = list.length > 0 && (!list[0].hasOwnProperty('email') || !list[0].hasOwnProperty('password') || !list[0].hasOwnProperty('emp_id'));
  if (list.length === 0 || needsMigration) {
    const mock = [
      { 
        id: 'mock-kumari', 
        emp_id: 'kalai-emp-01',
        name: 'Kumari', 
        phone: '9876543211', 
        role: 'Stylist', 
        salary_type: 'monthly', 
        base_rate: 18000, 
        email: 'kumari@kalai.com', 
        joining_date: '2026-06-01', 
        dob: '',
        address: '',
        emergency_name: '',
        emergency_number: '',
        aadhaar_number: '',
        employment_type: 'Full Time',
        status: 'Active',
        photo_url: '',
        aadhaar_photo_url: '',
        owner_notes: '',
        employee_msg: '',
        leave_balance: 12,
        bank_details: '',
        emergency_contact: '', 
        password: 'emp123',
        shift_start: '09:00',
        created_at: new Date().toISOString() 
      }
    ];
    setLocalItem('employees', mock);
    return mock;
  }
  return list;
}

export async function addEmployee(emp) {
  const client = initDb();
  
  if (!emp.emp_id) {
    let nextNum = 1;
    try {
      const list = await fetchEmployees().catch(() => []);
      if (list && list.length > 0) {
        const nums = list
          .map(e => {
            const match = (e.emp_id || '').match(/kalai-emp-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          })
          .filter(n => n > 0);
        if (nums.length > 0) {
          nextNum = Math.max(...nums) + 1;
        }
      }
    } catch(e) {
      console.warn('Failed to calculate next emp_id sequence:', e);
    }
    emp.emp_id = `kalai-emp-${String(nextNum).padStart(2, '0')}`;
  }

  const id = genUUID();
  const newEmp = { ...emp, id, created_at: new Date().toISOString() };

  if (!client) {
    const list = fetchEmployeesLocally();
    list.unshift(newEmp);
    setLocalItem('employees', list);
    showToast('Employee added locally!');
    return newEmp;
  }

  const { data, error } = await client.from('employees').insert([newEmp]).select();
  if (error) {
    console.warn('Add employee DB error, saving locally:', error);
    const list = fetchEmployeesLocally();
    list.unshift(newEmp);
    setLocalItem('employees', list);
    showToast('Employee added locally!');
    return newEmp;
  }
  showToast('Employee added successfully!');
  return data?.[0];
}

export async function updateEmployee(emp) {
  const client = initDb();
  if (!client) {
    let list = fetchEmployeesLocally();
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === emp.id) {
        updatedItem = { ...item, ...emp };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('employees', list);
    showToast('Employee updated locally!');
    return updatedItem;
  }

  const { data, error } = await client.from('employees').update(emp).eq('id', emp.id).select();
  if (error) {
    let list = fetchEmployeesLocally();
    let updatedItem = null;
    list = list.map(item => {
      if (item.id === emp.id) {
        updatedItem = { ...item, ...emp };
        return updatedItem;
      }
      return item;
    });
    setLocalItem('employees', list);
    showToast('Employee updated locally!');
    return updatedItem;
  }
  showToast('Employee updated successfully!');
  return data?.[0];
}

export async function deleteEmployee(id) {
  const client = initDb();
  if (!client) {
    const list = fetchEmployeesLocally().filter(e => e.id !== id);
    setLocalItem('employees', list);
    showToast('Employee deleted successfully!');
    return true;
  }

  const { error } = await client.from('employees').delete().eq('id', id);
  if (error) {
    const list = fetchEmployeesLocally().filter(e => e.id !== id);
    setLocalItem('employees', list);
    showToast('Employee deleted successfully!');
    return true;
  }
  showToast('Employee deleted successfully!');
  return true;
}

export async function fetchAttendance() {
  const client = initDb();
  if (!client) return fetchAttendanceLocally();

  const { data, error } = await client.from('attendance').select('*').order('date', { ascending: false });
  if (error) {
    console.warn('Fetch attendance DB error, falling back to local storage:', error);
    return fetchAttendanceLocally();
  }
  return data || [];
}

function fetchAttendanceLocally() {
  return getLocalItem('attendance', []);
}

export async function saveAttendance(log) {
  const client = initDb();
  const id = log.id || genUUID();
  const fullLog = { ...log, id, created_at: new Date().toISOString() };

  if (!client) return saveAttendanceLocally(fullLog);

  const { data, error } = await client.from('attendance').upsert([fullLog], { onConflict: 'id' }).select();
  if (error) {
    console.warn('Save attendance DB error, falling back to local storage:', error);
    return saveAttendanceLocally(fullLog);
  }
  return data?.[0];
}

function saveAttendanceLocally(fullLog) {
  try {
    let list = fetchAttendanceLocally();
    list = list.filter(a => a.id !== fullLog.id);
    list.push(fullLog);
    setLocalItem('attendance', list);
    return fullLog;
  } catch(e) { return null; }
}

export async function fetchPayslips() {
  const client = initDb();
  if (!client) return fetchPayslipsLocally();

  const { data, error } = await client.from('payslips').select('*').order('month', { ascending: false });
  if (error) {
    console.warn('Fetch payslips DB error, falling back to local storage:', error);
    return fetchPayslipsLocally();
  }
  return data || [];
}

function fetchPayslipsLocally() {
  return getLocalItem('payslips', []);
}

export async function savePayslip(payslip) {
  const client = initDb();
  const id = payslip.id || genUUID();
  const fullPayslip = { ...payslip, id, created_at: new Date().toISOString() };

  if (!client) return savePayslipLocally(fullPayslip);

  const { data, error } = await client.from('payslips').upsert([fullPayslip], { onConflict: 'id' }).select();
  if (error) {
    console.warn('Save payslip DB error, falling back to local storage:', error);
    return savePayslipLocally(fullPayslip);
  }
  return data?.[0];
}

function savePayslipLocally(fullPayslip) {
  try {
    let list = fetchPayslipsLocally();
    list = list.filter(p => !(p.employee_id === fullPayslip.employee_id && p.month === fullPayslip.month));
    list.push(fullPayslip);
    setLocalItem('payslips', list);
    return fullPayslip;
  } catch(e) { return null; }
}

export async function fetchAllClassPayments() {
  const client = initDb();
  if (!client) return getLocalItem('class_payments', []);
  const { data, error } = await client.from('class_payments').select('*').order('date', { ascending: false });
  if (error) return getLocalItem('class_payments', []);
  return data || [];
}

export async function fetchAllJewelRentals() {
  const client = initDb();
  if (!client) return getLocalItem('jewel_rentals', []);
  const { data, error } = await client.from('jewel_rentals').select('*').order('created_at', { ascending: false });
  if (error) return getLocalItem('jewel_rentals', []);
  return data || [];
}

export async function fetchFinancialSummary(selectedMonth = 'all') {
  let [customers, events, expenses, payslips, studentPayments, jewelRentals] = await Promise.all([
    fetchCustomers().catch(() => []),
    fetchEvents().catch(() => []),
    fetchExpenses().catch(() => []),
    fetchPayslips().catch(() => []),
    fetchAllClassPayments().catch(() => []),
    fetchAllJewelRentals().catch(() => [])
  ]);

  // Extract all unique YYYY-MM months for filter dropdown
  const monthSet = new Set();
  const getMonthStr = (dStr) => dStr ? String(dStr).substring(0, 7) : null;

  customers.forEach(c => { const m = getMonthStr(c.last_visit || c.created_at); if(m && m.length===7) monthSet.add(m); });
  events.forEach(e => { const m = getMonthStr(e.date || e.created_at); if(m && m.length===7) monthSet.add(m); });
  expenses.forEach(ex => { const m = getMonthStr(ex.date || ex.created_at); if(m && m.length===7) monthSet.add(m); });
  payslips.forEach(p => { const m = getMonthStr(p.month || p.created_at); if(m && m.length===7) monthSet.add(m); });
  studentPayments.forEach(sp => { const m = getMonthStr(sp.date || sp.created_at); if(m && m.length===7) monthSet.add(m); });
  jewelRentals.forEach(r => { const m = getMonthStr(r.start_date || r.created_at); if(m && m.length===7) monthSet.add(m); });

  // Ensure current month is included if set is empty
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  monthSet.add(currentMonthStr);
  const availableMonths = Array.from(monthSet).sort().reverse();

  // Filter lists if a specific month is selected
  if (selectedMonth && selectedMonth !== 'all') {
    customers = customers.filter(c => getMonthStr(c.last_visit || c.created_at) === selectedMonth);
    events = events.filter(e => getMonthStr(e.date || e.created_at) === selectedMonth);
    expenses = expenses.filter(ex => getMonthStr(ex.date || ex.created_at) === selectedMonth);
    payslips = payslips.filter(p => getMonthStr(p.month || p.created_at) === selectedMonth);
    studentPayments = studentPayments.filter(sp => getMonthStr(sp.date || sp.created_at) === selectedMonth);
    jewelRentals = jewelRentals.filter(r => getMonthStr(r.start_date || r.created_at) === selectedMonth);
  }

  // Income Streams
  const shopRevenue = customers.reduce((sum, c) => sum + (c.payment_status === 'paid' ? (c.amount || 0) : 0), 0);
  const eventAdvance = events.reduce((sum, e) => sum + (e.advance || 0), 0);
  const eventFinalPaid = events.reduce((sum, e) => {
    if (e.status === 'Completed' || (e.pending || 0) === 0) {
      return sum + (e.total ? Math.max(0, e.total - (e.advance || 0)) : 0);
    }
    return sum;
  }, 0);
  const eventRevenue = eventAdvance + eventFinalPaid;
  const academyRevenue = studentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const jewelRevenue = jewelRentals.reduce((sum, r) => sum + (r.rental_fee || 0), 0);

  const totalGrossRevenue = shopRevenue + eventRevenue + academyRevenue + jewelRevenue;

  // Payment Mode Breakdown
  let cashTotal = 0;
  let gpayTotal = 0;

  customers.forEach(c => {
    if (c.payment_status === 'paid') {
      if ((c.payment_method || '').toLowerCase().includes('cash')) cashTotal += (c.amount || 0);
      else gpayTotal += (c.amount || 0);
    }
  });

  studentPayments.forEach(p => {
    if ((p.payment_method || '').toLowerCase().includes('cash')) cashTotal += (p.amount || 0);
    else gpayTotal += (p.amount || 0);
  });

  events.forEach(e => {
    gpayTotal += (e.advance || 0);
  });

  jewelRentals.forEach(r => {
    if ((r.payment_method || '').toLowerCase().includes('cash')) cashTotal += (r.rental_fee || 0);
    else gpayTotal += (r.rental_fee || 0);
  });

  // Expense Streams
  const generalExpenses = expenses.reduce((sum, ex) => sum + (ex.amount || 0), 0);
  const payrollExpenses = payslips.reduce((sum, p) => sum + (p.net_salary || 0), 0);
  const eventStaffWages = events.reduce((sum, e) => {
    const wages = Array.isArray(e.staff_wages) ? e.staff_wages : [];
    return sum + wages.reduce((s, w) => s + (w.amount || 0), 0);
  }, 0);
  const eventTravelCosts = events.reduce((sum, e) => sum + (e.travel_allowance || 0), 0);

  const totalExpenses = generalExpenses + payrollExpenses + eventStaffWages + eventTravelCosts;
  const netOperatingProfit = totalGrossRevenue - totalExpenses;

  // Receivables & Payables Dues
  const customerDues = customers.filter(c => c.payment_status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0);
  const eventDues = events.reduce((sum, e) => sum + (e.pending || 0), 0);
  const totalReceivables = customerDues + eventDues;

  return {
    selectedMonth,
    availableMonths,
    shopRevenue,
    eventRevenue,
    academyRevenue,
    jewelRevenue,
    totalGrossRevenue,
    cashTotal,
    gpayTotal,
    generalExpenses,
    payrollExpenses,
    eventStaffWages,
    eventTravelCosts,
    totalExpenses,
    netOperatingProfit,
    totalReceivables,
    customers,
    events,
    expenses,
    payslips
  };
}
