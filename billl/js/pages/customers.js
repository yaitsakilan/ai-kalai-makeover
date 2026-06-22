// billl/js/pages/customers.js
import { state } from '../state.js';
import { fetchCustomers, addCustomer, deleteCustomer } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay } from '../ui.js';
import { validateAndCleanPhone } from '../utils.js';
import { callGroqAPI } from '../api.js';

export async function renderCustomers() {
  const customers = await fetchCustomers();
  window._cachedCustomers = customers;

  return `
  <div class="top-bar">
    <h2>Customer Management</h2>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-outline" onclick="window.analyzeShopCustomers()">
        <i class="ti ti-chart-bar" style="color:#d97706"></i> AI Analysis
      </button>
      <button class="btn btn-gold" onclick="window.openShopCustomerForm()">
        <i class="ti ti-plus"></i> Add Customer
      </button>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:10px">
      <input class="form-input" style="flex:1" placeholder="Search by name or phone..." id="customer-search" oninput="window.filterCustomers(this.value)">
      <select class="form-input form-select" style="width:160px" onchange="window.filterByPayment(this.value)">
        <option value="all">All Payments</option><option value="paid">Paid</option><option value="pending">Pending</option>
      </select>
    </div>
  </div>
  <div id="customer-list">
    ${renderCustomerList(customers)}
  </div>`;
}

export function renderCustomerList(customers) {
  if(!customers.length) return '<div class="card" style="text-align:center;padding:40px;color:#999"><i class="ti ti-users" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>No customers found</div>';
  const colors=['av-gold','av-teal','av-rose','av-purple'];
  return customers.map((c,i)=>`
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:14px">
        <div class="avatar ${colors[i%4]}" style="width:44px;height:44px;font-size:15px">${(c.name||'').split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <span style="font-size:14px;font-weight:600">${c.name}</span>
            ${(c.visits||0)>=5?'<span class="badge badge-blue">⭐ Regular</span>':''}
            ${c.rating ? `<span style="color:#d97706;font-size:11px;margin-left:6px;letter-spacing:1px;" title="Owner rating: ${c.rating}/5">${'★'.repeat(c.rating)}${'☆'.repeat(5-c.rating)}</span>` : ''}
            ${c.referred_by ? `<span class="badge badge-amber" title="Referred by: ${c.referred_by}">📢 Ref: ${c.referred_by}</span>` : ''}
          </div>
          <div style="font-size:12px;color:#888">${c.phone||'No phone'} · ${c.location||'No location'}</div>
          <div style="font-size:12px;color:#aaa;margin-top:2px">${(c.services||[]).join(', ')} · Last: ${c.last_visit||'N/A'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:#d97706">₹${(c.total_spend||0).toLocaleString()}</div>
          <div style="font-size:11px;color:#bbb">${c.visits||0} visits</div>
          <span class="badge ${c.payment_status==='paid'?'badge-green':'badge-red'}" style="margin-top:4px">${c.payment_status||'pending'}</span>
        </div>
        <div onclick="window.handleDeleteCustomer('${c.id}')" style="cursor:pointer;color:#ccc;padding:8px;border-radius:8px;transition:all 0.15s" onmouseover="this.style.color='#dc2626';this.style.background='#fee2e2'" onmouseout="this.style.color='#ccc';this.style.background='transparent'">
          <i class="ti ti-trash" style="font-size:16px"></i>
        </div>
      </div>
    </div>
  `).join('');
}

export function filterCustomers(q) {
  const customers = (window._cachedCustomers || []).filter(c=>
    (c.name||'').toLowerCase().includes(q.toLowerCase()) || (c.phone||'').includes(q)
  );
  const el = document.getElementById('customer-list');
  if(el) el.innerHTML = renderCustomerList(customers);
}

export function filterByPayment(status) {
  let customers = window._cachedCustomers || [];
  if(status !== 'all') customers = customers.filter(c => c.payment_status === status);
  const el = document.getElementById('customer-list');
  if(el) el.innerHTML = renderCustomerList(customers);
}

export function showAddCustomerModal() {
  showModal('Add New Customer', `
    <div class="form-group">
      <label class="form-label">Customer Name *</label>
      <input class="form-input" id="m-cust-name" placeholder="e.g. Priya Lakshmi">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-input" id="m-cust-phone" placeholder="9876543210">
      </div>
      <div class="form-group">
        <label class="form-label">Location</label>
        <input class="form-input" id="m-cust-location" placeholder="Chennai">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Services (comma separated)</label>
      <input class="form-input" id="m-cust-services" placeholder="Facial, Threading">
    </div>
    <div style="display:grid;grid-template-columns:1.5fr 1.5fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input class="form-input" id="m-cust-amount" type="number" placeholder="1200">
      </div>
      <div class="form-group">
        <label class="form-label">Payment Status</label>
        <select class="form-input form-select" id="m-cust-status">
          <option value="paid">Paid</option><option value="pending">Pending</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Rating</label>
        <select class="form-input form-select" id="m-cust-rating">
          <option value="5" selected>5 ★</option>
          <option value="4">4 ★</option>
          <option value="3">3 ★</option>
          <option value="2">2 ★</option>
          <option value="1">1 ★</option>
        </select>
      </div>
    </div>
  `, async () => {
    const name = document.getElementById('m-cust-name').value.trim();
    if(!name) { showToast('Please enter customer name','error'); return; }
    
    const phoneInput = document.getElementById('m-cust-phone').value.trim();
    let phoneVal = '';
    if (phoneInput) {
      const cleaned = validateAndCleanPhone(phoneInput);
      if (cleaned === null) {
        showToast('Please enter a valid 10-digit phone number', 'error');
        return;
      }
      phoneVal = cleaned;
    }

    await addCustomer({
      name,
      phone: phoneVal,
      location: document.getElementById('m-cust-location').value.trim(),
      services: document.getElementById('m-cust-services').value.split(',').map(s=>s.trim()).filter(Boolean),
      amount: parseInt(document.getElementById('m-cust-amount').value) || 0,
      payment_status: document.getElementById('m-cust-status').value,
      last_visit: new Date().toISOString().split('T')[0],
      total_spend: parseInt(document.getElementById('m-cust-amount').value) || 0,
      visits: 1,
      rating: parseInt(document.getElementById('m-cust-rating').value) || 5
    });
    closeModal();
    if (typeof window.render === 'function') window.render();
  });
}

export async function handleDeleteCustomer(id) {
  if(!confirm('Delete this customer?')) return;
  await deleteCustomer(id);
  if (typeof window.render === 'function') window.render();
}

export async function analyzeShopCustomers() {
  showModal('Shop Customers AI Analysis', `
    <div class="loading-page" style="height: 180px;">
      <div class="spinner"></div>
      <div style="margin-top:12px;font-weight:500;color:#555;">AI is analyzing shop customer trends...</div>
      <div style="font-size:12px;color:#999;margin-top:6px;">Comparing services, locations, and revenue patterns</div>
    </div>
  `, null);
  
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';

  try {
    const customers = await fetchCustomers();
    const shopCustomers = customers.filter(c => !c.services || !c.services.includes('Classes'));
    
    if (shopCustomers.length === 0) {
      document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center;padding:20px;color:#999;">
          <i class="ti ti-users" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>
          No shop customer data found to analyze yet.
        </div>`;
      return;
    }

    const resData = await callGroqAPI('chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an elite salon business analyst. Analyze the provided customer data for Kalai Makeover salon.
Only analyze "shop customers" (students/classes are already filtered out).
Format the output as clean HTML suitable for the inner body of a modal window.
Do NOT use html, head, or body tags. Start directly with report content.
Use standard classes from our app:
- <div class="form-section-title"><i class="ti ti-..."></i> Title</div> for section headers
- <span class="badge badge-green">...</span>, badge-amber, badge-blue, badge-gray for values
- Use grids or list items for clean layout
- Style key metrics prominently.

Guidelines:
- All monetary values in the report must be strictly formatted in INR using the Rupee symbol (₹) (e.g., ₹12,500). Never use USD, dollars, or the $ symbol.

The HTML should contain:
1. Executive Summary: Short overview of shop performance.
2. Metric Grid: Styled list or columns showing: Total Shop Revenue, Customer Count, Average Spend/Customer, Average Rating.
3. Top Services & Locations: What services are most requested, where do the highest-paying customers live.
4. Business Growth Tips: Actionable suggestions for Kalai to boost her business.
Make it concise, insightful, and formatted beautifully.`
        },
        {
          role: 'user',
          content: `Here is the customer data in JSON format: ${JSON.stringify(shopCustomers.map(c => ({
            name: c.name,
            services: c.services,
            amount: c.amount,
            total_spend: c.total_spend,
            visits: c.visits,
            location: c.location,
            rating: c.rating,
            last_visit: c.last_visit
          })))}`
        }
      ],
      temperature: 0.2
    });

    const htmlReport = resData.choices?.[0]?.message?.content || '<p>Analysis could not be generated.</p>';
    const cleanedReport = htmlReport.replace(/```html|```/g, '').trim();

    document.getElementById('modal-body').innerHTML = `
      <div style="max-height:60vh;overflow-y:auto;padding-right:4px;" class="scrollbar-hide">
        ${cleanedReport}
      </div>`;

  } catch (err) {
    console.error('Analysis error:', err);
    document.getElementById('modal-body').innerHTML = `
      <div style="color:#dc2626;text-align:center;padding:20px;">
        <i class="ti ti-alert-triangle" style="font-size:32px;display:block;margin-bottom:10px;"></i>
        Failed to load AI Analysis. Please try again.
      </div>`;
  }
}

export function openShopCustomerForm() {
  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('form-overlay-container');
  if (!container) return;
  container.innerHTML = `
    <div class="form-overlay" onclick="window.closeFormOverlay()">
      <div class="form-panel" onclick="event.stopPropagation()">
        <div class="form-panel-header">
          <h3><i class="ti ti-scissors" style="color:#d97706"></i> Shop Customer Form</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-outline btn-icon" id="form-mic-btn" onclick="window.startVoiceRecording('shop')" title="Fill form with voice" style="width:34px; height:34px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; border-color:#e5e5e5; transition: all 0.2s ease;">
              <i class="ti ti-microphone" style="font-size:16px; color:#d97706;"></i>
            </button>
            <div onclick="window.closeFormOverlay()" style="cursor:pointer;color:#999;font-size:22px;padding:4px;display:flex;align-items:center;"><i class="ti ti-x"></i></div>
          </div>
        </div>
        <div class="form-panel-body">
          <div id="form-voice-container"></div>
          <div class="form-section-title" style="border-top:none;margin-top:0;padding-top:0">
            <i class="ti ti-user"></i> Customer Details
          </div>
          <div class="form-group">
            <label class="form-label">Customer Name *</label>
            <input class="form-input" id="sf-name" placeholder="Enter customer name">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Phone Number *</label>
              <input class="form-input" id="sf-phone" placeholder="10-digit number" maxlength="10">
            </div>
            <div class="form-group">
              <label class="form-label">Location</label>
              <input class="form-input" id="sf-location" placeholder="e.g. Chennai">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-input" id="sf-date" type="date" value="${today}">
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 1.5fr;gap:12px;margin-bottom:14px;align-items:center;">
            <div class="form-group" style="margin-bottom:0;display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="sf-referred" onchange="document.getElementById('sf-referrer-div').style.display = this.checked ? 'block' : 'none'" style="width:16px;height:16px;cursor:pointer;">
              <label for="sf-referred" class="form-label" style="margin-bottom:0;cursor:pointer;font-weight:500;">Came from Referral?</label>
            </div>
            <div class="form-group" id="sf-referrer-div" style="margin-bottom:0;display:none;">
              <input class="form-input" id="sf-referrer" placeholder="Referrer Name">
            </div>
          </div>

          <div class="form-section-title">
            <i class="ti ti-sparkles"></i> Service Taken
            <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap a service, then enter its amount</span>
          </div>
          <div class="form-group">
            <div class="chip-group" id="sf-service-chips">
              ${['Threading','Facial','Bleach','Detan','Hair Spa','Layer Haircut','Black Hair Color','Pedicure','Smoothening','Wax','Others'].map(s =>
                `<div class="chip" onclick="window.serviceChipToggle(this)">${s}</div>`
              ).join('')}
            </div>
            <div class="chip-other-input">
              <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
                <input class="form-input" id="sf-service-other" placeholder="Enter other service name..." style="flex:1">
                <button class="btn btn-gold" onclick="window.addOtherServiceAmount()" style="padding:8px 14px;font-size:12px;white-space:nowrap"><i class="ti ti-plus" style="font-size:14px"></i> Add</button>
              </div>
            </div>
            <div class="service-amount-list" id="sf-service-amounts"></div>
            <div class="sa-total-bar" id="sf-total-bar" style="display:none">
              <span class="sa-total-label">Total Amount</span>
              <span class="sa-total-value" id="sf-total-amount">₹0</span>
            </div>
          </div>

          <div class="form-section-title">
            <i class="ti ti-star"></i> Your Rating for Customer
          </div>
          <div class="form-group">
            <div class="star-rating" id="star-rating-group">
              ${[1,2,3,4,5].map(i => `<span onclick="window.setStarRating(${i})">★</span>`).join('')}
            </div>
            <input type="hidden" id="form-rating-value" value="0">
            <div style="font-size:11px;color:#999;margin-top:6px">Rate the customer experience (as shop owner)</div>
          </div>
        </div>
        <div class="form-panel-footer">
          <button class="btn btn-outline" onclick="window.closeFormOverlay()"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-gold" onclick="window.submitShopCustomerForm()" id="sf-submit-btn"><i class="ti ti-check"></i> Save Customer</button>
        </div>
      </div>
    </div>`;
}

export function serviceChipToggle(chipEl) {
  const serviceName = chipEl.textContent.trim();
  chipEl.classList.toggle('selected');
  const amountList = document.getElementById('sf-service-amounts');
  
  if (serviceName === 'Others') {
    const otherInput = chipEl.closest('.form-group').querySelector('.chip-other-input');
    if (chipEl.classList.contains('selected')) {
      if (otherInput) otherInput.classList.add('show');
    } else {
      if (otherInput) otherInput.classList.remove('show');
      const row = document.getElementById('sa-row-others');
      if (row) row.remove();
      updateServiceTotal();
    }
    return;
  }

  if (chipEl.classList.contains('selected')) {
    const rowId = 'sa-row-' + serviceName.replace(/\s+/g, '-').toLowerCase();
    if (!document.getElementById(rowId)) {
      const row = document.createElement('div');
      row.className = 'service-amount-row';
      row.id = rowId;
      row.dataset.service = serviceName;
      row.innerHTML = `
        <div class="sa-name"><i class="ti ti-sparkles"></i>${serviceName}</div>
        <span style="font-size:12px;color:#888">₹</span>
        <input type="number" placeholder="Amount" oninput="window.updateServiceTotal()">
        <div class="sa-remove" onclick="window.removeServiceRow('${rowId}', '${serviceName}')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
      amountList.appendChild(row);
    }
  } else {
    const rowId = 'sa-row-' + serviceName.replace(/\s+/g, '-').toLowerCase();
    const row = document.getElementById(rowId);
    if (row) row.remove();
  }
  updateServiceTotal();
}

export function addOtherServiceAmount() {
  const otherNameInput = document.getElementById('sf-service-other');
  const otherName = otherNameInput ? otherNameInput.value.trim() : '';
  if (!otherName) { showToast('Please enter the service name first', 'error'); return; }
  
  const amountList = document.getElementById('sf-service-amounts');
  const rowId = 'sa-row-other-' + Date.now();
  const row = document.createElement('div');
  row.className = 'service-amount-row';
  row.id = rowId;
  row.dataset.service = otherName;
  row.innerHTML = `
    <div class="sa-name"><i class="ti ti-sparkles"></i>${otherName}</div>
    <span style="font-size:12px;color:#888">₹</span>
    <input type="number" placeholder="Amount" oninput="window.updateServiceTotal()">
    <div class="sa-remove" onclick="window.removeServiceRow('${rowId}', null)" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
  amountList.appendChild(row);
  otherNameInput.value = '';
  otherNameInput.focus();
  updateServiceTotal();
}

export function removeServiceRow(rowId, serviceName) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  if (serviceName) {
    const chips = document.querySelectorAll('#sf-service-chips .chip');
    chips.forEach(c => { if (c.textContent.trim() === serviceName) c.classList.remove('selected'); });
  }
  updateServiceTotal();
}

export function updateServiceTotal() {
  const rows = document.querySelectorAll('#sf-service-amounts .service-amount-row');
  let total = 0;
  rows.forEach(r => { total += parseInt(r.querySelector('input')?.value) || 0; });
  const el = document.getElementById('sf-total-amount');
  if (el) el.textContent = '₹' + total.toLocaleString();
  const bar = document.getElementById('sf-total-bar');
  if (bar) bar.style.display = rows.length > 0 ? 'flex' : 'none';
}

function getServiceAmounts() {
  const rows = document.querySelectorAll('#sf-service-amounts .service-amount-row');
  const services = [];
  rows.forEach(r => {
    const name = r.dataset.service;
    const amount = parseInt(r.querySelector('input')?.value) || 0;
    if (name) services.push({ name, amount });
  });
  return services;
}

export function setStarRating(rating) {
  const stars = document.querySelectorAll('#star-rating-group span');
  stars.forEach((s, i) => {
    if (i < rating) s.classList.add('active');
    else s.classList.remove('active');
  });
  document.getElementById('form-rating-value').value = rating;
}

export async function submitShopCustomerForm() {
  const name = document.getElementById('sf-name').value.trim();
  if (!name) { showToast('Please enter customer name', 'error'); return; }

  const phoneInput = document.getElementById('sf-phone').value.trim();
  let phoneVal = '';
  if (phoneInput) {
    const cleaned = validateAndCleanPhone(phoneInput);
    if (cleaned === null) { showToast('Please enter a valid 10-digit phone number', 'error'); return; }
    phoneVal = cleaned;
  }

  const serviceAmounts = getServiceAmounts();
  if (serviceAmounts.length === 0) { showToast('Please select at least one service', 'error'); return; }
  
  const hasZero = serviceAmounts.some(s => s.amount <= 0);
  if (hasZero) { showToast('Please enter amount for all selected services', 'error'); return; }

  const totalAmount = serviceAmounts.reduce((s, a) => s + a.amount, 0);
  const serviceNames = serviceAmounts.map(s => s.name);

  const rating = parseInt(document.getElementById('form-rating-value').value) || 5;
  const location = document.getElementById('sf-location').value.trim();
  const date = document.getElementById('sf-date').value || new Date().toISOString().split('T')[0];

  const isReferred = document.getElementById('sf-referred')?.checked;
  const referredBy = isReferred ? document.getElementById('sf-referrer')?.value.trim() : '';

  const btn = document.getElementById('sf-submit-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...'; }

  const result = await addCustomer({
    name,
    phone: phoneVal,
    location,
    services: serviceNames,
    amount: totalAmount,
    payment_status: 'paid',
    last_visit: date,
    total_spend: totalAmount,
    visits: 1,
    rating,
    referred_by: referredBy || null
  });

  if (result) {
    closeFormOverlay();
    const svcSummary = serviceAmounts.map(s => `${s.name}: ₹${s.amount.toLocaleString()}`).join(' · ');
    state.chatMessages.push({role:'ai', text: `✅ <strong>${name}</strong> saved via Shop Customer Form! 🎉<br><span style="font-size:11px;color:#888">${svcSummary}<br>Total: ₹${totalAmount.toLocaleString()} · Rating: ${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</span>`});
    if (typeof window.render === 'function') window.render();
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Save Customer'; }
  }
}

// Bind to window to allow HTML inline click handlers to execute
window.openShopCustomerForm = openShopCustomerForm;
window.submitShopCustomerForm = submitShopCustomerForm;
window.serviceChipToggle = serviceChipToggle;
window.addOtherServiceAmount = addOtherServiceAmount;
window.removeServiceRow = removeServiceRow;
window.updateServiceTotal = updateServiceTotal;
window.setStarRating = setStarRating;
window.filterCustomers = filterCustomers;
window.filterByPayment = filterByPayment;
window.analyzeShopCustomers = analyzeShopCustomers;
window.showAddCustomerModal = showAddCustomerModal;
window.handleDeleteCustomer = handleDeleteCustomer;
