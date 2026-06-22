// billl/js/db.js
import { showToast } from './ui.js';

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
  if (customer.amount !== undefined) customer.amount = Math.round(Number(customer.amount) || 0);
  if (customer.total_spend !== undefined) customer.total_spend = Math.round(Number(customer.total_spend) || 0);
  let {data, error} = await client.from('customers').insert([customer]).select();
  if (error && error.code === 'PGRST204' && 'rating' in customer) {
    console.warn('Database schema cache error PGRST204: rating column missing. Retrying without rating...');
    const retryCustomer = { ...customer };
    delete retryCustomer.rating;
    const retryResult = await client.from('customers').insert([retryCustomer]).select();
    if (!retryResult.error) {
      showToast('Customer saved! (Warning: Run SQL setup to enable ratings)', 'info');
      return retryResult.data?.[0];
    }
    error = retryResult.error;
  }
  if(error) { console.error('Add customer error:', error); showToast('Failed to add customer','error'); return null; }
  showToast('Customer added successfully!');
  return data?.[0];
}

export async function addEvent(event) {
  const client = initDb();
  if (!client) return null;
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

export async function addExpense(expense) {
  const client = initDb();
  if (!client) return null;
  if (expense.amount !== undefined) expense.amount = Math.round(Number(expense.amount) || 0);
  const {data, error} = await client.from('expenses').insert([expense]).select();
  if(error) { console.error('Add expense error:', error); showToast('Failed to add expense','error'); return null; }
  showToast('Expense added successfully!');
  return data?.[0];
}

export async function fetchReelsIdeas() {
  const client = initDb();
  if (!client) return [];
  const {data, error} = await client.from('reels_ideas').select('*').order('created_at', {ascending:false});
  if(error) { console.error('Fetch reels ideas error:', error); showToast('Failed to load reels ideas','error'); return []; }
  return data || [];
}

export async function addReelsIdea(ideaText) {
  const client = initDb();
  if (!client) return null;
  const {data, error} = await client.from('reels_ideas').insert([{ idea: ideaText, status: 'Planned' }]).select();
  if(error) { console.error('Add reels idea error:', error); showToast('Failed to add reels idea','error'); return null; }
  showToast('Reels idea saved!');
  return data?.[0];
}

export async function updateReelsIdea(id, updates) {
  const client = initDb();
  if (!client) return null;
  const {data, error} = await client.from('reels_ideas').update(updates).eq('id', id).select();
  if(error) { console.error('Update reels idea error:', error); showToast('Failed to update reels idea','error'); return null; }
  return data?.[0];
}

export async function deleteReelsIdea(id) {
  const client = initDb();
  if (!client) return false;
  const {error} = await client.from('reels_ideas').delete().eq('id', id);
  if(error) { console.error('Delete reels idea error:', error); showToast('Failed to delete reels idea','error'); return false; }
  showToast('Reels idea deleted');
  return true;
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
