// billl/js/db.js
import { showToast } from './ui.js';
import { state } from './state.js';

const SUPABASE_URL = window.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';

export let db = null;

export function initDb() {
  if (db) return db;
  
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded. Check CDN script in HTML.');
    return null;
  }

  try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('Supabase URL or Anon Key is missing.');
    }
  } catch (e) {
    console.error('Database client init failed:', e);
  }
  return db;
}

// Initialize on load
initDb();

export async function fetchCustomers() {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('customers').select('*').order('created_at',{ascending:false});
  if(error) { console.error('Fetch customers error:', error); showToast('Failed to load customers','error'); return []; }
  return data || [];
}

export async function fetchEvents() {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('events').select('*').order('date',{ascending:true});
  if(error) { console.error('Fetch events error:', error); showToast('Failed to load events','error'); return []; }
  return data || [];
}

export async function fetchExpenses() {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('expenses').select('*').order('date',{ascending:false});
  if(error) { console.error('Fetch expenses error:', error); showToast('Failed to load expenses','error'); return []; }
  return data || [];
}

export async function fetchBillScans() {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('bill_scans').select('*').order('created_at',{ascending:false});
  if(error) { console.error('Fetch bill_scans error:', error); return []; }
  return data || [];
}

export async function addCustomer(customer) {
  const client = initDb();
  if (!client) return null;
  if (state && state.userRole === 'employee') {
    if (customer.name) customer.name = customer.name.trim() + ' [Emp]';
  }
  if (customer.amount !== undefined) customer.amount = Math.round(Number(customer.amount) || 0);
  if (customer.total_spend !== undefined) customer.total_spend = Math.round(Number(customer.total_spend) || 0);
  let {data, error} = await client.from('customers').insert([customer]).select();
  if (error && error.code === 'PGRST204') {
    const retryCustomer = { ...customer };
    let retrying = false;
    if ('rating' in retryCustomer) {
      delete retryCustomer.rating;
      retrying = true;
    }
    if ('payment_method' in retryCustomer) {
      delete retryCustomer.payment_method;
      retrying = true;
    }
    if (retrying) {
      console.warn('Database schema cache error PGRST204: rating/payment_method missing. Retrying insert...');
      const retryResult = await client.from('customers').insert([retryCustomer]).select();
      if (!retryResult.error) {
        showToast('Customer saved! (Warning: Run SQL setup to enable rating/payment_method)', 'info');
        return retryResult.data?.[0];
      }
      error = retryResult.error;
    }
  }
  if(error) { console.error('Add customer error:', error); showToast('Failed to add customer','error'); return null; }
  showToast('Customer added successfully!');
  return data?.[0];
}

export async function addEvent(event) {
  const client = initDb();
  if (!client) return null;
  if (state && state.userRole === 'employee') {
    if (event.customer) event.customer = event.customer.trim() + ' [Emp]';
  }
  if (event.total !== undefined) event.total = Math.round(Number(event.total) || 0);
  if (event.advance !== undefined) event.advance = Math.round(Number(event.advance) || 0);
  if (event.pending !== undefined) event.pending = Math.round(Number(event.pending) || 0);
  let {data, error} = await client.from('events').insert([event]).select();
  if (error && error.code === 'PGRST204') {
    console.warn('Database schema cache error PGRST204: some columns might be missing. Retrying with base event columns...');
    const baseEvent = {
      customer: event.customer,
      phone: event.phone,
      type: event.type,
      date: event.date,
      total: event.total,
      advance: event.advance,
      pending: event.pending,
      status: event.status
    };
    const retryResult = await client.from('events').insert([baseEvent]).select();
    if (!retryResult.error) {
      showToast('Event saved! (Warning: Run SQL setup to enable rating/extended columns)', 'info');
      return retryResult.data?.[0];
    }
    error = retryResult.error;
  }
  if(error) { console.error('Add event error:', error); showToast('Failed to add event','error'); return null; }
  showToast('Event booked successfully!');
  return data?.[0];
}

export async function updateEvent(id, event) {
  const client = initDb();
  if (!client) return null;
  if (event.total !== undefined) event.total = Math.round(Number(event.total) || 0);
  if (event.advance !== undefined) event.advance = Math.round(Number(event.advance) || 0);
  if (event.pending !== undefined) event.pending = Math.round(Number(event.pending) || 0);
  
  const {data, error} = await client.from('events').update(event).eq('id', id).select();
  if(error) { console.error('Update event error:', error); showToast('Failed to update event','error'); return null; }
  showToast('Event updated successfully!');
  return data?.[0];
}

export async function addExpense(expense) {
  const client = initDb();
  if (!client) return null;
  if (state && state.userRole === 'employee') {
    expense.note = expense.note && expense.note.trim() ? expense.note.trim() + ' [Emp]' : '[Emp]';
  }
  if (expense.amount !== undefined) expense.amount = Math.round(Number(expense.amount) || 0);
  
  let {data, error} = await client.from('expenses').insert([expense]).select();
  if (error && error.code === 'PGRST204') {
    console.warn('Database schema cache error PGRST204: payment_method column might be missing. Retrying insert without payment_method...');
    const retryExpense = { ...expense };
    delete retryExpense.payment_method;
    const retryResult = await client.from('expenses').insert([retryExpense]).select();
    if (!retryResult.error) {
      showToast('Expense saved! (Warning: Run SQL setup to enable payment method column)', 'info');
      return retryResult.data?.[0];
    }
    error = retryResult.error;
  }
  if(error) { console.error('Add expense error:', error); showToast('Failed to add expense','error'); return null; }
  showToast('Expense added successfully!');
  return data?.[0];
}



export async function addBillScan(scan) {
  const client = initDb();
  if (!client) return null;
  if (scan.total !== undefined) scan.total = Math.round(Number(scan.total) || 0);
  if (scan.items) {
    scan.items = scan.items.map(item => ({
      name: item.name,
      amount: Math.round(Number(item.amount) || 0)
    }));
  }
  const {data, error} = await client.from('bill_scans').insert([scan]).select();
  if(error) { console.error('Add bill_scan error:', error); showToast('Failed to save scan','error'); return null; }
  showToast('Bill scan saved!');
  return data?.[0];
}

export async function deleteCustomer(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('customers').delete().eq('id', id);
  if(error) { showToast('Failed to delete','error'); return false; }
  showToast('Customer deleted');
  return true;
}

export async function deleteEvent(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('events').delete().eq('id', id);
  if(error) { showToast('Failed to delete','error'); return false; }
  showToast('Event deleted');
  return true;
}

export async function deleteExpense(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('expenses').delete().eq('id', id);
  if(error) { showToast('Failed to delete','error'); return false; }
  showToast('Expense deleted');
  return true;
}

export async function deleteBillScan(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('bill_scans').delete().eq('id', id);
  if(error) { showToast('Failed to delete scan','error'); return false; }
  showToast('Bill scan deleted');
  return true;
}

// Class Enrollments DB helpers
export async function fetchClassEnrollments() {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('class_enrollments').select('*').order('created_at', {ascending:false});
  if(error) { console.error('Fetch enrollments error:', error); showToast('Failed to load students','error'); return []; }
  return data || [];
}

export async function addClassEnrollment(enrollment) {
  const client = initDb();
  if (!client) return null;
  if (state && state.userRole === 'employee') {
    if (enrollment.name) enrollment.name = enrollment.name.trim() + ' [Emp]';
  }
  if (enrollment.total_fee !== undefined) enrollment.total_fee = Math.round(Number(enrollment.total_fee) || 0);
  if (enrollment.total_paid !== undefined) enrollment.total_paid = Math.round(Number(enrollment.total_paid) || 0);
  const {data, error} = await client.from('class_enrollments').insert([enrollment]).select();
  if(error) { console.error('Add enrollment error:', error); showToast('Failed to enroll student','error'); return null; }
  showToast('Student enrolled successfully!');
  return data?.[0];
}

export async function updateClassEnrollment(id, data) {
  const client = initDb();
  if (!client) return null;
  if (data.total_fee !== undefined) data.total_fee = Math.round(Number(data.total_fee) || 0);
  if (data.total_paid !== undefined) data.total_paid = Math.round(Number(data.total_paid) || 0);
  const {data: result, error} = await client.from('class_enrollments').update(data).eq('id', id).select();
  if(error) { console.error('Update enrollment error:', error); showToast('Failed to update student','error'); return null; }
  return result?.[0];
}

export async function deleteClassEnrollment(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('class_enrollments').delete().eq('id', id);
  if(error) { showToast('Failed to delete student','error'); return false; }
  showToast('Student record deleted');
  return true;
}

// Class Payments DB helpers
export async function fetchClassPayments(enrollmentId) {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('class_payments').select('*').eq('enrollment_id', enrollmentId).order('date', {ascending:true});
  if(error) { console.error('Fetch payments error:', error); return []; }
  return data || [];
}

export async function addClassPayment(payment) {
  const client = initDb();
  if (!client) return null;
  if (state && state.userRole === 'employee') {
    payment.note = payment.note && payment.note.trim() ? payment.note.trim() + ' [Emp]' : '[Emp]';
  }
  if (payment.amount !== undefined) payment.amount = Math.round(Number(payment.amount) || 0);
  const {data, error} = await client.from('class_payments').insert([payment]).select();
  if(error) { console.error('Add payment error:', error); showToast('Failed to record payment','error'); return null; }
  showToast('Payment recorded successfully!');
  return data?.[0];
}

export async function deleteClassPayment(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('class_payments').delete().eq('id', id);
  if(error) { showToast('Failed to delete payment','error'); return false; }
  showToast('Payment deleted');
  return true;
}

// Jewel Inventory DB helpers
export async function fetchJewels() {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('jewels').select('*').order('created_at', {ascending:false});
  if(error) { console.error('Fetch jewels error:', error); showToast('Failed to load jewels','error'); return []; }
  return data || [];
}

export async function addJewel(jewel) {
  const client = initDb();
  if (!client) return null;
  if (state && state.userRole === 'employee') {
    if (jewel.name) jewel.name = jewel.name.trim() + ' [Emp]';
  }
  if (jewel.purchase_price !== undefined) jewel.purchase_price = Math.round(Number(jewel.purchase_price) || 0);
  if (jewel.total_rental_income !== undefined) jewel.total_rental_income = Math.round(Number(jewel.total_rental_income) || 0);
  
  let {data, error} = await client.from('jewels').insert([jewel]).select();
  if (error && (error.code === 'PGRST204' || error.code === '42703')) {
    console.warn('Database schema cache error or undefined column: image_url column might be missing. Retrying insert without image_url...');
    const retryJewel = { ...jewel };
    delete retryJewel.image_url;
    const retryResult = await client.from('jewels').insert([retryJewel]).select();
    if (!retryResult.error) {
      showToast('Jewel saved! (Warning: Run SQL setup to enable image column)', 'info');
      return retryResult.data?.[0];
    }
    error = retryResult.error;
  }
  if(error) { console.error('Add jewel error:', error); showToast('Failed to add jewel','error'); return null; }
  showToast('Jewel added successfully!');
  return data?.[0];
}

export async function updateJewel(id, data) {
  const client = initDb();
  if (!client) return null;
  if (data.purchase_price !== undefined) data.purchase_price = Math.round(Number(data.purchase_price) || 0);
  if (data.total_rental_income !== undefined) data.total_rental_income = Math.round(Number(data.total_rental_income) || 0);
  const {data: result, error} = await client.from('jewels').update(data).eq('id', id).select();
  if(error) { console.error('Update jewel error:', error); showToast('Failed to update jewel','error'); return null; }
  return result?.[0];
}

export async function deleteJewel(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('jewels').delete().eq('id', id);
  if(error) { showToast('Failed to delete jewel','error'); return false; }
  showToast('Jewel deleted');
  return true;
}

// Jewel Rentals DB helpers
export async function fetchJewelRentals(jewelId) {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('jewel_rentals').select('*').eq('jewel_id', jewelId).order('rental_date', {ascending:true});
  if(error) { console.error('Fetch rentals error:', error); return []; }
  return data || [];
}

export async function addJewelRental(rental) {
  const client = initDb();
  if (!client) return null;
  if (state && state.userRole === 'employee') {
    if (rental.customer_name) rental.customer_name = rental.customer_name.trim() + ' [Emp]';
  }
  if (rental.rental_fee !== undefined) rental.rental_fee = Math.round(Number(rental.rental_fee) || 0);
  if (rental.deposit !== undefined) rental.deposit = Math.round(Number(rental.deposit) || 0);
  const {data, error} = await client.from('jewel_rentals').insert([rental]).select();
  if(error) { console.error('Add rental error:', error); showToast('Failed to record rental','error'); return null; }
  showToast('Rental logged successfully!');
  return data?.[0];
}

export async function updateJewelRental(id, data) {
  const client = initDb();
  if (!client) return null;
  if (data.rental_fee !== undefined) data.rental_fee = Math.round(Number(data.rental_fee) || 0);
  if (data.deposit !== undefined) data.deposit = Math.round(Number(data.deposit) || 0);
  const {data: result, error} = await client.from('jewel_rentals').update(data).eq('id', id).select();
  if(error) { console.error('Update rental error:', error); showToast('Failed to update rental','error'); return null; }
  return result?.[0];
}

export async function deleteJewelRental(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('jewel_rentals').delete().eq('id', id);
  if(error) { showToast('Failed to delete rental record','error'); return false; }
  showToast('Rental record deleted');
  return true;
}

export async function fetchMonthlyBalances() {
  const client = initDb();
  if (!client) {
    try {
      return JSON.parse(localStorage.getItem('monthly_balances') || '[]');
    } catch(e) { return []; }
  }
  
  const { data, error } = await client.from('monthly_balances').select('*').order('month', { ascending: false });
  if (error) {
    console.warn('Fetch monthly balances DB error, falling back to local storage:', error);
    try {
      return JSON.parse(localStorage.getItem('monthly_balances') || '[]');
    } catch(e) { return []; }
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
    let local = JSON.parse(localStorage.getItem('monthly_balances') || '[]');
    local = local.filter(b => b.month !== balance.month);
    local.push(balance);
    localStorage.setItem('monthly_balances', JSON.stringify(local));
    showToast('Starting balances saved locally! (Warning: Run SQL setup to sync to Database)', 'info');
    return balance;
  } catch(e) {
    console.error('Local storage save failed:', e);
    return null;
  }
}
