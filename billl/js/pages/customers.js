// billl/js/pages/customers.js
import { state } from '../state.js';
import { fetchCustomers, addCustomer, deleteCustomer } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay } from '../ui.js';
import { validateAndCleanPhone } from '../utils.js';
import { callGroqAPI } from '../api.js';

export async function renderCustomers() {
  const customers = await fetchCustomers();
  window._cachedCustomers = customers;

  if (window._selectedMonth === undefined) window._selectedMonth = 'all';
  if (window._searchQuery === undefined) window._searchQuery = '';
  if (window._monthFilterExpanded === undefined) window._monthFilterExpanded = false;
  if (window._searchFieldExpanded === undefined) window._searchFieldExpanded = false;

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Apply filters initially
  let filtered = [...customers];
  if (window._searchQuery) {
    const q = window._searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    );
  }
  if (window._selectedMonth !== 'all') {
    filtered = filtered.filter(c => {
      if (!c.last_visit) return false;
      const parts = c.last_visit.split('-');
      if (parts.length < 2) return false;
      const m = parseInt(parts[1], 10) - 1;
      return m === window._selectedMonth;
    });
  }

  const activeBtnStyle = window._monthFilterExpanded
    ? 'border-color: #f5c842; background: rgba(245, 200, 66, 0.1);'
    : '';

  const activeSearchBtnStyle = window._searchFieldExpanded
    ? 'border-color: #f5c842; background: rgba(245, 200, 66, 0.1);'
    : '';

  return `
  <div class="top-bar">
    <h2>Customer Management</h2>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-outline" onclick="window.analyzeShopCustomers()">
        <i class="ti ti-chart-bar" style="color:#d97706"></i> AI Analysis
      </button>
      <button class="btn btn-outline btn-icon" onclick="window.toggleSearchField()" id="toggle-search-btn" style="${activeSearchBtnStyle}" title="Search Customers">
        <i class="ti ti-search" style="color:#d97706"></i>
      </button>
      <button class="btn btn-outline" onclick="window.toggleMonthFilter()" id="toggle-filter-btn" style="${activeBtnStyle}">
        <i class="ti ti-filter" style="color:#d97706"></i> Filter
      </button>
      <button class="btn btn-gold" onclick="window.openShopCustomerForm()">
        <i class="ti ti-plus"></i> Add Customer
      </button>
    </div>
  </div>

  <div id="customer-metrics-container">
    ${renderCustomerMetrics(filtered)}
  </div>

  <div class="card" id="search-card" style="margin-bottom:16px; display: ${window._searchFieldExpanded ? 'block' : 'none'};">
    <input class="form-input" placeholder="Search by name or phone..." id="customer-search" value="${window._searchQuery || ''}" oninput="window.filterCustomers(this.value)">
  </div>

  <div class="card" id="month-filter-card" style="margin-bottom:16px; padding: 12px 18px; display: ${window._monthFilterExpanded ? 'block' : 'none'};">
    <div style="font-size: 11px; font-weight: 600; color: #999; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; gap: 6px;">
      <i class="ti ti-filter" style="color:#d97706; font-size: 13px;"></i> Filter by Month
    </div>
    <div class="chip-group scrollbar-hide" style="flex-wrap: nowrap; overflow-x: auto; padding-bottom: 6px; width: 100%;">
      <div class="chip ${window._selectedMonth === 'all' ? 'selected' : ''}" style="flex-shrink: 0;" onclick="window.filterByMonth('all')" id="month-chip-all">All Months</div>
      ${MONTHS.map((m, idx) => `
        <div class="chip ${window._selectedMonth === idx ? 'selected' : ''}" style="flex-shrink: 0;" onclick="window.filterByMonth(${idx})" id="month-chip-${idx}">${m}</div>
      `).join('')}
    </div>
  </div>

  <div id="customer-list">
    ${renderCustomerList(filtered)}
  </div>`;
}

export function renderCustomerMetrics(customers) {
  const totalCustomers = customers.length;
  const repeatedCustomers = customers.filter(c => (c.visits || 0) > 1).length;
  const totalAmount = customers.reduce((sum, c) => sum + (c.total_spend || 0), 0);
  const avgSpend = totalCustomers > 0 ? Math.round(totalAmount / totalCustomers) : 0;

  return `
  <div class="metric-grid" style="margin-bottom: 16px;">
    <div class="metric-card mc-gold">
      <div class="metric-label">Total Customers</div>
      <div class="metric-value">${totalCustomers}</div>
      <div class="metric-icon"><i class="ti ti-users"></i></div>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Repeated Customers</div>
      <div class="metric-value">${repeatedCustomers}</div>
      <div class="metric-icon"><i class="ti ti-refresh"></i></div>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Total Amount</div>
      <div class="metric-value">₹${totalAmount.toLocaleString('en-IN')}</div>
      <div class="metric-icon"><i class="ti ti-currency-rupee"></i></div>
    </div>
    <div class="metric-card mc-purple">
      <div class="metric-label">Average Spend</div>
      <div class="metric-value">₹${avgSpend.toLocaleString('en-IN')}</div>
      <div class="metric-icon"><i class="ti ti-wallet"></i></div>
    </div>
  </div>`;
}

export function applyFilters() {
  let customers = window._cachedCustomers || [];

  // 1. Search Query
  if (window._searchQuery) {
    const q = window._searchQuery.toLowerCase();
    customers = customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    );
  }

  // 2. Month Filter
  if (window._selectedMonth !== undefined && window._selectedMonth !== 'all') {
    customers = customers.filter(c => {
      if (!c.last_visit) return false;
      const parts = c.last_visit.split('-');
      if (parts.length < 2) return false;
      const m = parseInt(parts[1], 10) - 1;
      return m === window._selectedMonth;
    });
  }

  // Update List HTML
  const listEl = document.getElementById('customer-list');
  if (listEl) {
    listEl.innerHTML = renderCustomerList(customers);
  }

  // Update Metrics HTML
  const metricsEl = document.getElementById('customer-metrics-container');
  if (metricsEl) {
    metricsEl.innerHTML = renderCustomerMetrics(customers);
  }
}

export function filterCustomers(q) {
  window._searchQuery = q;
  applyFilters();
}

export function filterByMonth(monthIndex) {
  window._selectedMonth = monthIndex;

  // Update active states of chips in UI
  const chips = document.querySelectorAll('.chip[id^="month-chip-"]');
  chips.forEach(chip => {
    chip.classList.remove('selected');
  });

  const activeChip = document.getElementById(`month-chip-${monthIndex}`);
  if (activeChip) {
    activeChip.classList.add('selected');
  }

  applyFilters();
}

export function toggleMonthFilter() {
  window._monthFilterExpanded = !window._monthFilterExpanded;
  const el = document.getElementById('month-filter-card');
  const btn = document.getElementById('toggle-filter-btn');
  if (el) {
    el.style.display = window._monthFilterExpanded ? 'block' : 'none';
  }
  if (btn) {
    if (window._monthFilterExpanded) {
      btn.style.borderColor = '#f5c842';
      btn.style.background = 'rgba(245, 200, 66, 0.1)';
    } else {
      btn.style.borderColor = '';
      btn.style.background = '';
    }
  }
}

export function toggleSearchField() {
  window._searchFieldExpanded = !window._searchFieldExpanded;
  const el = document.getElementById('search-card');
  const btn = document.getElementById('toggle-search-btn');
  if (el) {
    el.style.display = window._searchFieldExpanded ? 'block' : 'none';
    if (window._searchFieldExpanded) {
      setTimeout(() => {
        const input = document.getElementById('customer-search');
        if (input) input.focus();
      }, 50);
    }
  }
  if (btn) {
    if (window._searchFieldExpanded) {
      btn.style.borderColor = '#f5c842';
      btn.style.background = 'rgba(245, 200, 66, 0.1)';
    } else {
      btn.style.borderColor = '';
      btn.style.background = '';
    }
  }
}

export function renderCustomerList(customers) {
  if (!customers.length) return '<div class="card" style="text-align:center;padding:40px;color:#999"><i class="ti ti-users" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>No customers found</div>';
  const colors = ['av-gold', 'av-teal', 'av-rose', 'av-purple'];
  return customers.map((c, i) => `
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:14px">
        <div class="avatar ${colors[i % 4]}" style="width:44px;height:44px;font-size:15px">${(c.name || '').split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <span style="font-size:14px;font-weight:600">${c.name}</span>
            ${(c.visits || 0) >= 5 ? '<span class="badge badge-blue">⭐ Regular</span>' : ''}
            ${c.rating ? `<span style="color:#d97706;font-size:11px;margin-left:6px;letter-spacing:1px;" title="Owner rating: ${c.rating}/5">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</span>` : ''}
            ${c.referred_by ? `<span class="badge badge-amber" title="Referred by: ${c.referred_by}">📢 Ref: ${c.referred_by}</span>` : ''}
          </div>
          <div style="font-size:12px;color:#888">${c.phone || 'No phone'} · ${c.location || 'No location'}</div>
          <div style="font-size:12px;color:#aaa;margin-top:2px">${(c.services || []).join(', ')} · Last: ${c.last_visit || 'N/A'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:#d97706">₹${(c.total_spend || 0).toLocaleString()}</div>
          <div style="font-size:11px;color:#bbb">${c.visits || 0} visits</div>
        </div>
        ${c.phone ? `
        <div onclick="window.promptWhatsAppBillFromId('${c.id}')" style="cursor:pointer;color:#25d366;padding:8px;border-radius:8px;transition:all 0.15s" onmouseover="this.style.color='#20ba5a';this.style.background='#e8fced'" onmouseout="this.style.color='#25d366';this.style.background='transparent'" title="Send WhatsApp Bill">
          <i class="ti ti-brand-whatsapp" style="font-size:16px"></i>
        </div>
        ` : ''}
        <div onclick="window.handleDeleteCustomer('${c.id}')" style="cursor:pointer;color:#ccc;padding:8px;border-radius:8px;transition:all 0.15s" onmouseover="this.style.color='#dc2626';this.style.background='#fee2e2'" onmouseout="this.style.color='#ccc';this.style.background='transparent'">
          <i class="ti ti-trash" style="font-size:16px"></i>
        </div>
      </div>
    </div>
  `).join('');
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
    if (!name) { showToast('Please enter customer name', 'error'); return; }

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
      services: document.getElementById('m-cust-services').value.split(',').map(s => s.trim()).filter(Boolean),
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
  if (!confirm('Delete this customer?')) return;
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

    // Pre-calculate exact shop metrics to ensure consistency and prevent LLM bad-math hallucinations
    const shopCount = shopCustomers.length;
    const shopRevenue = shopCustomers.reduce((sum, c) => sum + (c.total_spend || 0), 0);
    const shopAvgSpend = shopCount > 0 ? Math.round(shopRevenue / shopCount) : 0;
    const shopRepeated = shopCustomers.filter(c => (c.visits || 0) > 1).length;
    const ratedCustomers = shopCustomers.filter(c => (c.rating || 0) > 0);
    const shopAvgRating = ratedCustomers.length > 0
      ? (ratedCustomers.reduce((sum, c) => sum + (c.rating || 0), 0) / ratedCustomers.length).toFixed(1)
      : '5.0';

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
- Use these EXACT pre-calculated metrics in your report and metric grid:
  * Customer Count: ${shopCount}
  * Total Shop Revenue: ₹${shopRevenue.toLocaleString('en-IN')}
  * Average Spend/Customer: ₹${shopAvgSpend.toLocaleString('en-IN')}
  * Repeated Customers: ${shopRepeated}
  * Average Rating: ${shopAvgRating}/5
  Do NOT calculate or estimate these metrics yourself; use the exact values above.

The HTML should contain:
1. Executive Summary: Short overview of shop performance using the exact metrics.
2. Metric Grid: Styled list or columns showing these exact metrics.
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
              ${['Threading', 'Facial', 'Bleach', 'Detan', 'Hair Spa', 'Layer Haircut', 'Black Hair Color', 'Pedicure', 'Smoothening', 'Wax', 'Others'].map(s =>
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
              ${[1, 2, 3, 4, 5].map(i => `<span onclick="window.setStarRating(${i})">★</span>`).join('')}
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
    state.chatMessages.push({ role: 'ai', text: `✅ <strong>${name}</strong> saved via Shop Customer Form! 🎉<br><span style="font-size:11px;color:#888">${svcSummary}<br>Total: ₹${totalAmount.toLocaleString()} · Rating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>` });
    if (typeof window.render === 'function') window.render();

    if (phoneVal) {
      setTimeout(() => {
        promptWhatsAppBill(name, phoneVal, serviceNames, totalAmount, date, 'paid', serviceAmounts);
      }, 400);
    }
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Save Customer'; }
  }
}

export function promptWhatsAppBill(customerName, phone, services, amount, date, paymentStatus, serviceBreakdown = null) {
  if (!phone) {
    showToast('Customer phone number is missing!', 'error');
    return;
  }

  const cleanedPhone = validateAndCleanPhone(phone);
  if (!cleanedPhone) {
    showToast('Please enter a valid 10-digit phone number', 'error');
    return;
  }

  let servicesText = '';
  if (serviceBreakdown && Array.isArray(serviceBreakdown) && serviceBreakdown.length > 0) {
    servicesText = serviceBreakdown.map(s => `- ${s.name}: ₹${s.amount.toLocaleString()}`).join('\n');
  } else if (Array.isArray(services)) {
    servicesText = services.map(s => `- ${s}`).join('\n');
  } else {
    servicesText = `- ${services}`;
  }

  const formattedDate = date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedStatus = paymentStatus ? paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1) : 'Paid';

  const defaultMessage = `Hello ${customerName},

Thank you for visiting Kalai Makeover. We hope you enjoyed our service.

Please find your invoice details below:


Service(s):
${servicesText}
Total Amount: ₹${amount.toLocaleString()}


We would love to hear your feedback. Your review helps us improve and serve you better. https://g.page/r/CRpMmps5Ku6gEAI/review

Thank you,
Kalai Makeover
📞 8870236006`;

  showModal('Send Bill via WhatsApp', `
    <div style="font-size:13px;color:#555;margin-bottom:14px">
      Review and customize the bill message for <strong>${customerName}</strong> (${phone}):
    </div>
    <div class="form-group">
      <label class="form-label">WhatsApp Message Preview</label>
      <textarea class="form-input" id="wa-bill-message" style="height:200px;font-family:monospace;white-space:pre-wrap;resize:vertical;line-height:1.4;">${defaultMessage}</textarea>
    </div>
  `, () => {
    const editedMessage = document.getElementById('wa-bill-message').value.trim();
    if (!editedMessage) {
      showToast('Message text cannot be empty.', 'error');
      return;
    }
    const fullPhone = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(editedMessage)}`;
    window.open(url, '_blank');
    closeModal();
    showToast('WhatsApp opened in a new tab!');
  });

  // Customize modal save button to represent WhatsApp action
  setTimeout(() => {
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="ti ti-brand-whatsapp"></i> Send Bill';
      saveBtn.style.background = '#25d366';
      saveBtn.style.borderColor = '#25d366';
      saveBtn.style.color = '#fff';
    }
  }, 50);
}

export function promptWhatsAppBillFromId(customerId) {
  const customer = (window._cachedCustomers || []).find(c => c.id === customerId);
  if (!customer) {
    showToast('Customer not found.', 'error');
    return;
  }
  promptWhatsAppBill(
    customer.name,
    customer.phone,
    customer.services,
    customer.amount || customer.total_spend || 0,
    customer.last_visit,
    customer.payment_status
  );
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
window.filterByMonth = filterByMonth;
window.toggleMonthFilter = toggleMonthFilter;
window.toggleSearchField = toggleSearchField;
window.applyFilters = applyFilters;
window.renderCustomerMetrics = renderCustomerMetrics;
window.analyzeShopCustomers = analyzeShopCustomers;
window.showAddCustomerModal = showAddCustomerModal;
window.handleDeleteCustomer = handleDeleteCustomer;
window.promptWhatsAppBill = promptWhatsAppBill;
window.promptWhatsAppBillFromId = promptWhatsAppBillFromId;
