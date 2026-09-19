// billl/js/pages/customers.js
import { state } from '../state.js';
import { fetchCustomers, addCustomer, updateCustomer, deleteCustomer, addClassEnrollment, addClassPayment } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay, showConfirmDelete } from '../ui.js';
import { validateAndCleanPhone, formatEmpTag, formatVisitedDate, getUniqueCustomersMap, getEffectiveVisits, sortCustomersList, getOrdinalVisit, getCustomerVisits } from '../utils.js';
import { callGroqAPI } from '../api.js';
import { calculateModuleStreak, renderModuleStreakWidget } from '../streak.js';

export async function renderCustomers() {
  const customers = await fetchCustomers();
  window._cachedCustomers = customers;

  const currentMonthIndex = new Date().getMonth();
  if (window._customerActiveTab === undefined) window._customerActiveTab = 'history';
  if (['top_paid', 'repeat', 'lapsed', 'new'].includes(window._customerActiveTab)) {
    window._customerHistoryView = window._customerActiveTab;
    window._customerActiveTab = 'history';
  }
  if (window._customerHistoryView === undefined) window._customerHistoryView = 'all';
  if (window._selectedMonth === undefined) {
    const hasCurrentMonthData = customers.some(c => {
      const dStr = c.last_visit || c.created_at;
      if (!dStr) return false;
      const parts = String(dStr).split('T')[0].split('-');
      return parts.length >= 2 && (parseInt(parts[1], 10) - 1) === currentMonthIndex;
    });
    if (hasCurrentMonthData) {
      window._selectedMonth = currentMonthIndex;
    } else {
      let latestMonth = currentMonthIndex;
      let newestDateStr = '';
      customers.forEach(c => {
        const dStr = c.last_visit || c.created_at;
        if (dStr && String(dStr) > newestDateStr) {
          newestDateStr = String(dStr);
          const parts = newestDateStr.split('T')[0].split('-');
          if (parts.length >= 2) {
            const m = parseInt(parts[1], 10) - 1;
            if (m >= 0 && m < 12) latestMonth = m;
          }
        }
      });
      window._selectedMonth = latestMonth;
    }
  }
  if (window._searchQuery === undefined) window._searchQuery = '';
  if (window._monthFilterExpanded === undefined) window._monthFilterExpanded = false;
  if (window._searchFieldExpanded === undefined) window._searchFieldExpanded = false;
  if (window._customerSortOption === undefined) window._customerSortOption = 'date_desc';

  const streakData = calculateModuleStreak(customers, 'last_visit', window._selectedMonth);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Apply filters for both analytics & history tab
  let filtered = [...customers];
  if (window._searchQuery && window._customerActiveTab === 'history') {
    const q = window._searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    );
  }
  if (window._selectedMonth !== 'all') {
    const mTarget = parseInt(window._selectedMonth, 10);
    filtered = filtered.filter(c => {
      const dateStr = c.last_visit || c.created_at;
      if (!dateStr) return false;
      const parts = String(dateStr).split('-');
      if (parts.length < 2) return false;
      const m = parseInt(parts[1], 10) - 1;
      return m === mTarget;
    });
  }

  const activeBtnStyle = window._monthFilterExpanded
    ? 'border-color: #f5c842; background: rgba(245, 200, 66, 0.1);'
    : '';

  const activeSearchBtnStyle = window._searchFieldExpanded
    ? 'border-color: #f5c842; background: rgba(245, 200, 66, 0.1);'
    : '';

  // Trigger chart initialization if analytics tab active
  if (window._customerActiveTab === 'analytics') {
    setTimeout(() => initCustomerAnalyticsCharts(filtered), 60);
  }

  const uniqueMap = getUniqueCustomersMap(customers);
  const repeatCount = Array.from(uniqueMap.values()).filter(g => g.totalVisits > 1 || g.records.length > 1).length;

  const now = new Date();
  const LAPSED_THRESHOLD_DAYS = 40;
  const lapsedCount = customers.filter(c => {
    const dStr = c.last_visit || c.created_at;
    if (!dStr) return false;
    const visitDate = new Date(dStr);
    if (isNaN(visitDate.getTime())) return false;
    const diffDays = Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= LAPSED_THRESHOLD_DAYS;
  }).length;

  const newCount = Array.from(uniqueMap.values()).filter(g => g.totalVisits <= 1 && g.records.length <= 1).length;

  return `
  <div class="top-bar">
    <div>
      <h2>Customer Management</h2>
    </div>
    <div style="display:flex; gap:10px; align-items:center">
      <!-- Month Filter Select Dropdown -->
      <select class="form-input form-select" style="width:auto;height:36px;font-size:12px;padding:4px 28px 4px 10px;border-color:#e5e5e5;font-weight:500;background-color:#fff" onchange="window.filterByMonthSelect(this.value)" title="Choose Month Filter">
        <option value="all" ${window._selectedMonth === 'all' ? 'selected' : ''}>📅 All Months</option>
        ${MONTHS.map((m, idx) => `
          <option value="${idx}" ${window._selectedMonth === idx ? 'selected' : ''}>📅 ${m}</option>
        `).join('')}
      </select>

      ${window._customerActiveTab === 'history' && (window._customerHistoryView === 'all' || !window._customerHistoryView) ? `
        <button class="btn btn-outline btn-icon" onclick="window.toggleSearchField()" id="toggle-search-btn" style="${activeSearchBtnStyle}" title="Search Customers">
          <i class="ti ti-search" style="color:#d97706"></i>
        </button>
      ` : ''}
      <button class="btn btn-gold" onclick="window.openShopCustomerForm()">
        <i class="ti ti-plus"></i> Add Customer
      </button>
    </div>
  </div>

  ${renderModuleStreakWidget('Customer Entries', streakData, '#7c3aed')}

  <!-- Main Navigation Tabs -->
  <div class="tab-row" style="margin-bottom:20px;overflow-x:auto;white-space:nowrap">
    <div class="tab ${window._customerActiveTab === 'history' ? 'active' : ''}" onclick="window.switchCustomerTab('history')">
      <i class="ti ti-history" style="margin-right:6px"></i> Customer History (${filtered.length})
    </div>
    <div class="tab ${window._customerActiveTab === 'analytics' ? 'active' : ''}" onclick="window.switchCustomerTab('analytics')">
      <i class="ti ti-chart-pie" style="margin-right:6px"></i> Analytics & Insights (${filtered.length})
    </div>
  </div>

  ${window._customerActiveTab === 'analytics' ? renderCustomerAnalyticsDashboard(filtered, customers) : `
    <!-- Inside Customer History: View Switcher -->
    <div class="chip-group scrollbar-hide" style="display:flex; flex-wrap:nowrap; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:18px;">
      <div class="chip ${window._customerHistoryView === 'all' ? 'selected' : ''}" onclick="window.switchCustomerHistoryView('all')">
        <i class="ti ti-list"></i> All Customers (${filtered.length})
      </div>
      <div class="chip ${window._customerHistoryView === 'top_paid' ? 'selected' : ''}" onclick="window.switchCustomerHistoryView('top_paid')">
        <i class="ti ti-crown"></i> Top Paid Clients (${uniqueMap.size})
      </div>
      <div class="chip ${window._customerHistoryView === 'repeat' ? 'selected' : ''}" onclick="window.switchCustomerHistoryView('repeat')">
        <i class="ti ti-refresh"></i> Repeat Customers (${repeatCount})
      </div>
      <div class="chip ${window._customerHistoryView === 'lapsed' ? 'selected' : ''}" onclick="window.switchCustomerHistoryView('lapsed')">
        <i class="ti ti-alarm"></i> Inactive Clients (${lapsedCount})
      </div>
      <div class="chip ${window._customerHistoryView === 'new' ? 'selected' : ''}" onclick="window.switchCustomerHistoryView('new')">
        <i class="ti ti-user-plus"></i> New Clients (${newCount})
      </div>
    </div>

    ${window._customerHistoryView === 'top_paid' ? renderTopPaidClientsTab(filtered) :
      window._customerHistoryView === 'repeat' ? renderRepeatCustomersTab(customers) :
      window._customerHistoryView === 'lapsed' ? renderLapsedRetentionTab(customers) :
      window._customerHistoryView === 'new' ? renderNewClientsTab(customers) : `
      <div id="customer-metrics-container">
        ${renderCustomerMetrics(filtered)}
      </div>

      <div class="card" id="search-card" style="margin-bottom:16px; display: ${window._searchFieldExpanded ? 'block' : 'none'};">
        <input class="form-input" placeholder="Search by name or phone..." id="customer-search" value="${window._searchQuery || ''}" oninput="window.filterCustomers(this.value)">
      </div>

      <div id="customer-list">
        ${renderCustomerList(filtered)}
      </div>
    `}
  `}`;
}

export function renderCustomerMetrics(customers) {
  const totalCustomers = customers.length;
  const uniqueMap = getUniqueCustomersMap(customers);
  const repeatedCustomers = Array.from(uniqueMap.values()).filter(g => g.totalVisits > 1 || g.records.length > 1).length;
  const totalAmount = customers.reduce((sum, c) => sum + (c.total_spend || c.amount || 0), 0);
  const avgSpend = totalCustomers > 0 ? Math.round(totalAmount / totalCustomers) : 0;

  const uniqueDays = new Set();
  customers.forEach(c => {
    const dStr = c.last_visit || c.created_at;
    if (dStr) {
      const day = String(dStr).split('T')[0];
      if (day.length >= 10) uniqueDays.add(day);
    }
  });
  const activeDaysCount = uniqueDays.size || 1;
  const avgCustomersPerDay = (totalCustomers / activeDaysCount).toFixed(1);

  return `
  <div class="metric-grid" style="margin-bottom: 16px;">
    <div class="metric-card mc-gold">
      <div class="metric-label">Total Customers</div>
      <div class="metric-value">${totalCustomers}</div>
      <div class="metric-sub">~${avgCustomersPerDay} customers / day</div>
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
  const sorted = sortCustomersList(customers, window._customerSortOption || 'date_desc', window._cachedCustomers || customers);
  return sorted.map((c, i) => {
    const { cleanText: cleanName, tagHtml: empBadge } = formatEmpTag(c.name);
    const initials = cleanName.split(' ').map(n => n[0]).join('').slice(0, 2);
    const effVisits = getEffectiveVisits(c, window._cachedCustomers || customers);
    const visitsList = getCustomerVisits(c, window._cachedCustomers || customers);
    const displayVisitsCount = Math.max(effVisits, visitsList.length);
    const cleanP = c.phone ? validateAndCleanPhone(c.phone) : null;
    const visitsSum = visitsList.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
    const displaySpend = visitsSum > 0 ? visitsSum : (c.total_spend || c.amount || 0);
    return `
    <div class="card" style="margin-bottom:10px;cursor:pointer;" onclick="window.showCustomerDetailsModal('${c.id}')" title="Click to view full customer history & details">
      <div style="display:flex;align-items:center;gap:14px">
        <div class="avatar ${colors[i % 4]}" style="width:44px;height:44px;font-size:15px">${initials}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <span style="font-size:14px;font-weight:600">${cleanName}</span>
            ${empBadge}
            ${displayVisitsCount >= 5 ? '<span class="badge badge-blue">⭐ Regular</span>' : (displayVisitsCount >= 3 ? '<span class="badge badge-amber">💖 Valued</span>' : '')}
            ${c.rating ? `<span style="color:#d97706;font-size:11px;margin-left:6px;letter-spacing:1px;" title="Owner rating: ${c.rating}/5">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</span>` : ''}
            ${c.referred_by ? `<span class="badge badge-amber" title="Referred by: ${c.referred_by}">📢 Ref: ${c.referred_by}</span>` : ''}
          </div>
          <div style="font-size:12px;color:#888">${cleanP || 'No phone'} · ${c.location || 'No location'} · 📅 Visited: ${formatVisitedDate(c.last_visit || c.created_at)}</div>
          
          ${visitsList.length > 1 ? `
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
              ${visitsList.map((v, vIdx) => {
                const vServices = Array.isArray(v.services) ? v.services.join(', ') : (v.services || 'Service');
                const vAmt = v.amount ? `<span style="color:#15803d;font-weight:600;margin-left:3px;">₹${Number(v.amount).toLocaleString()}</span>` : '';
                return `
                  <span style="background:rgba(245,200,66,0.12);color:#92400e;border:0.5px solid rgba(245,200,66,0.3);font-size:11px;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;">
                    <strong style="color:#b45309;margin-right:4px;">${getOrdinalVisit(v.visit_num || (vIdx + 1))}:</strong> ${vServices} ${vAmt}
                  </span>
                `;
              }).join('')}
            </div>
          ` : `
            <div style="font-size:12px;color:#aaa;margin-top:2px">${Array.isArray(c.services) ? c.services.join(', ') : (c.services || '')}</div>
          `}
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:#d97706">₹${displaySpend.toLocaleString()}</div>
          <div style="font-size:11px;color:#bbb">${displayVisitsCount} visits</div>
        </div>
        ${cleanP ? `
        <div onclick="event.stopPropagation(); window.promptWhatsAppBillFromId('${c.id}')" style="cursor:pointer;color:#25d366;padding:8px;border-radius:8px;transition:all 0.15s" onmouseover="this.style.color='#20ba5a';this.style.background='#e8fced'" onmouseout="this.style.color='#25d366';this.style.background='transparent'" title="Send WhatsApp Bill">
          <i class="ti ti-brand-whatsapp" style="font-size:16px"></i>
        </div>
        ` : ''}
        <div onclick="event.stopPropagation(); window.handleDeleteCustomer('${c.id}')" style="cursor:pointer;color:#ccc;padding:8px;border-radius:8px;transition:all 0.15s" onmouseover="this.style.color='#dc2626';this.style.background='#fee2e2'" onmouseout="this.style.color='#ccc';this.style.background='transparent'">
          <i class="ti ti-trash" style="font-size:16px"></i>
        </div>
      </div>
    </div>
  `; }).join('');
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
        <div style="position:relative; display:flex; align-items:center;">
          <input class="form-input" id="m-cust-phone" placeholder="9876543210" style="padding-right:38px;">
          <button type="button" onclick="window.pickContact('m-cust-phone', 'm-cust-name')" title="Pick from contacts" style="position:absolute; right:6px; background:none; border:none; color:#d97706; cursor:pointer; padding:5px 7px; display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:17px; transition:all 0.15s;" onmouseover="this.style.background='rgba(217,119,6,0.12)'" onmouseout="this.style.background='transparent'">
            <i class="ti ti-address-book"></i>
          </button>
        </div>
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
  const confirmed = await showConfirmDelete('Delete Customer', 'Are you sure you want to delete this customer? This action cannot be undone.');
  if (!confirmed) return;
  await deleteCustomer(id);
  if (typeof window.render === 'function') window.render();
}

export async function handleDeleteCustomerVisit(customerId, visitNum) {
  const allCustomers = window._cachedCustomers || await fetchCustomers();
  let target = allCustomers.find(c => String(c.id) === String(customerId));
  if (!target) {
    const cleanP = validateAndCleanPhone(customerId);
    if (cleanP) target = allCustomers.find(c => c.phone && validateAndCleanPhone(c.phone) === cleanP);
  }
  if (!target) {
    showToast('Customer not found', 'error');
    return;
  }

  const visitsList = getCustomerVisits(target, allCustomers);

  // Special action: Delete all repeat visits at once (keep only 1st visit)
  if (visitNum === 'repeat_visits') {
    const confirmed = await showConfirmDelete(
      'Delete Repeat Visits',
      `Are you sure you want to delete all repeat visits (Visits 2 to ${visitsList.length}) and keep only the 1st Visit?`
    );
    if (!confirmed) {
      showCustomerDetailsModal(target.id);
      return;
    }

    const firstVisit = visitsList[0] || { visit_num: 1, services: ['Hair Spa'], amount: target.amount || 1200, date: target.created_at, payment_method: 'Cash' };
    const remainingVisits = [{ ...firstVisit, visit_num: 1 }];
    const firstServices = Array.isArray(firstVisit.services) ? firstVisit.services : [firstVisit.services];
    const firstAmount = Number(firstVisit.amount) > 0 ? Number(firstVisit.amount) : (Number(target.amount) || Number(target.total_spend) || 0);

    await updateCustomer(target.id, {
      visits: 1,
      total_spend: firstAmount,
      amount: firstAmount,
      last_visit: firstVisit.date || target.created_at,
      services: firstServices,
      visit_history: remainingVisits
    });

    showToast('Repeat visits removed! Kept 1st Visit only.');
    const updatedCustomers = await fetchCustomers();
    window._cachedCustomers = updatedCustomers;
    if (typeof window.render === 'function') window.render();
    setTimeout(() => {
      showCustomerDetailsModal(target.id);
    }, 100);
    return;
  }

  const targetVisit = visitsList.find(v => Number(v.visit_num) === Number(visitNum));
  const ordinalName = getOrdinalVisit(visitNum);
  const svcsText = Array.isArray(targetVisit?.services) ? targetVisit.services.join(', ') : (targetVisit?.services || 'Service');

  const confirmed = await showConfirmDelete(
    `Delete ${ordinalName}?`,
    `Are you sure you want to delete ${ordinalName} (${svcsText})? Total spend and visit count will be updated automatically.`
  );
  if (!confirmed) {
    return;
  }

  const remainingVisits = visitsList
    .filter(v => Number(v.visit_num) !== Number(visitNum))
    .map((v, idx) => ({ ...v, visit_num: idx + 1 }));

  if (remainingVisits.length === 0) {
    await deleteCustomer(target.id);
    closeModal();
    if (typeof window.render === 'function') window.render();
    showToast('Customer removed completely.');
    return;
  }

  const newVisits = remainingVisits.length;
  const newTotalSpend = remainingVisits.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  const lastVisitObj = remainingVisits[remainingVisits.length - 1];
  const newAmount = Number(lastVisitObj?.amount) || 0;
  const newLastVisit = lastVisitObj?.date || target.created_at;
  const allRemainingSvcs = [...new Set(remainingVisits.flatMap(v => Array.isArray(v.services) ? v.services : [v.services]))];

  await updateCustomer(target.id, {
    visits: newVisits,
    total_spend: newTotalSpend,
    amount: newAmount,
    last_visit: newLastVisit,
    services: allRemainingSvcs,
    visit_history: remainingVisits
  });

  // Also check if there was a separate duplicate record in database representing this visit
  const cleanPhone = target.phone ? validateAndCleanPhone(target.phone) : null;
  const cleanName = target.name ? target.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() : '';
  const matchingRecords = allCustomers.filter(c => {
    if (String(c.id) === String(target.id)) return false;
    if (cleanPhone && c.phone && validateAndCleanPhone(c.phone) === cleanPhone) return true;
    if (cleanName && c.name && c.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() === cleanName) return true;
    return false;
  });

  if (matchingRecords.length > 0) {
    const recordToDelete = matchingRecords[matchingRecords.length - 1];
    if (recordToDelete) {
      await deleteCustomer(recordToDelete.id);
    }
  }

  showToast(`${ordinalName} deleted successfully!`);
  
  // Refresh cached customers and page
  const updatedCustomers = await fetchCustomers();
  window._cachedCustomers = updatedCustomers;
  if (typeof window.render === 'function') window.render();

  // Re-open modal showing remaining visits
  setTimeout(() => {
    showCustomerDetailsModal(target.id);
  }, 100);
}

window.handleDeleteCustomerVisit = handleDeleteCustomerVisit;


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
    const shopCustomers = customers.filter(c => {
      const sStr = Array.isArray(c.services) ? c.services.join(', ') : (c.services || '');
      return !sStr.includes('Classes');
    });

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
    const shopRevenue = shopCustomers.reduce((sum, c) => sum + (c.total_spend || c.amount || 0), 0);
    const shopAvgSpend = shopCount > 0 ? Math.round(shopRevenue / shopCount) : 0;
    const shopRepeated = Array.from(getUniqueCustomersMap(shopCustomers).values()).filter(g => g.totalVisits > 1 || g.records.length > 1).length;
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
  window._selectedExistingCustomer = null;
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
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Phone Number * <span style="font-size:10px;color:#d97706;font-weight:normal">(Auto-checks repeat client)</span></label>
              <div style="position:relative; display:flex; align-items:center;">
                <input class="form-input" id="sf-phone" placeholder="10-digit number" maxlength="10" oninput="window.handlePhoneLookup(this.value)" style="padding-right:38px;">
                <button type="button" onclick="window.pickContact('sf-phone', 'sf-name')" title="Pick from contacts" style="position:absolute; right:6px; background:none; border:none; color:#d97706; cursor:pointer; padding:5px 7px; display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:17px; transition:all 0.15s;" onmouseover="this.style.background='rgba(217,119,6,0.12)'" onmouseout="this.style.background='transparent'">
                  <i class="ti ti-address-book"></i>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Customer Name *</label>
              <input class="form-input" id="sf-name" placeholder="Enter customer name">
            </div>
          </div>
          <div id="sf-phone-match-card"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
            <div class="form-group">
              <label class="form-label">Location</label>
              <input class="form-input" id="sf-location" placeholder="e.g. Chennai">
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input class="form-input" id="sf-date" type="date" value="${today}" onclick="try{this.showPicker()}catch(e){}">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 1.5fr;gap:12px;margin-bottom:14px;align-items:center;">
            <div class="form-group" style="margin-bottom:0;display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="sf-referred" onchange="document.getElementById('sf-referrer-div').style.display = this.checked ? 'block' : 'none'" style="width:16px;height:16px;cursor:pointer;">
              <label for="sf-referred" class="form-label" style="margin-bottom:0;cursor:pointer;font-weight:500;">Came from Referral?</label>
            </div>
            <div class="form-group" id="sf-referrer-div" style="margin-bottom:0;display:none;">
              <select class="form-input form-select" id="sf-referrer">
                <option value="Instagram">Instagram</option>
                <option value="Relatives">Relatives</option>
              </select>
            </div>
          </div>

          <div class="form-section-title">
            <i class="ti ti-sparkles"></i> Service Taken
            <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap a service, then enter its amount</span>
          </div>
          <div class="form-group">
            <div class="chip-group" id="sf-service-chips">
              ${['Threading', 'Saree Prepleating', 'Facial', 'Bleach', 'Detan', 'Hair Spa', 'Layer Haircut', 'Black Hair Color', 'Pedicure', 'Smoothening', 'Wax', 'Others'].map(s =>
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

export function getServiceRowHtml(serviceName, rowId, amount = 0, method = 'Cash', chipName = '') {
  const isBoth = method === 'Both';
  const amountHtml = isBoth
    ? `
      <input type="number" placeholder="Cash" class="sa-cash-input" value="${amount ? Math.round(amount/2) : ''}" oninput="window.updateServiceTotal()" style="width: 65px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
      <span style="font-size:10px;color:#999">+</span>
      <input type="number" placeholder="GPay" class="sa-gpay-input" value="${amount ? Math.round(amount/2) : ''}" oninput="window.updateServiceTotal()" style="width: 65px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
    `
    : `
      <span style="font-size:12px;color:#888">₹</span>
      <input type="number" placeholder="Amount" class="sa-amount-input" value="${amount || ''}" oninput="window.updateServiceTotal()" style="width: 80px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
    `;
    
  const isSaree = serviceName.toLowerCase().includes('saree');
  const qtyHtml = isSaree
    ? `
      <div style="display: inline-flex; align-items: center; gap: 4px; margin-right: 6px; background: #fffdf5; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 8px;">
        <span style="font-size: 11px; font-weight: 500; color: #b45309;">Qty:</span>
        <input type="number" min="1" value="1" class="sa-qty-input" oninput="window.updateSareePrepleatingAmount(this)" style="width: 40px; padding: 2px; font-size: 12px; height: 26px; border: 1px solid #fcd34d; border-radius: 4px; text-align: center; font-family: inherit; font-weight: 600; color: #b45309; outline: none; background: #fff;">
      </div>
    `
    : '';

  const removeAttr = chipName ? `'${rowId}', '${chipName}'` : `'${rowId}', null`;
  return `
    <div class="sa-name"><i class="ti ti-sparkles"></i><input type="text" class="sa-name-input" value="${serviceName}"></div>
    ${qtyHtml}
    <div class="sa-amount-container" style="display:inline-flex; align-items:center; gap:4px;">
      ${amountHtml}
    </div>
    <select class="form-input form-select sa-method" style="width: 90px; padding: 4px; font-size: 11px; height: 32px; margin-left: 6px;" onchange="window.handleServiceMethodChange(this)">
      <option value="Cash" ${method === 'Cash' ? 'selected' : ''}>Cash</option>
      <option value="GPay" ${method === 'GPay' ? 'selected' : ''}>GPay</option>
      <option value="Both" ${method === 'Both' ? 'selected' : ''}>Both</option>
    </select>
    <div class="sa-remove" onclick="window.removeServiceRow(${removeAttr})" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>
  `;
}

export function updateSareePrepleatingAmount(qtyInput) {
  const row = qtyInput.closest('.service-amount-row');
  if (!row) return;
  const qty = parseInt(qtyInput.value) || 1;
  const baseRate = 250; // Saree Prepleating standard rate
  const totalAmount = qty * baseRate;

  const amtInput = row.querySelector('.sa-amount-input');
  if (amtInput) {
    amtInput.value = totalAmount;
  }
  
  const cashInput = row.querySelector('.sa-cash-input');
  const gpayInput = row.querySelector('.sa-gpay-input');
  if (cashInput && gpayInput) {
    const half = Math.round(totalAmount / 2);
    cashInput.value = half;
    gpayInput.value = half;
  }

  updateServiceTotal();
}

export function handleServiceMethodChange(selectEl) {
  const row = selectEl.closest('.service-amount-row');
  if (!row) return;
  const container = row.querySelector('.sa-amount-container');
  if (!container) return;
  
  const val = selectEl.value;
  if (val === 'Both') {
    container.innerHTML = `
      <input type="number" placeholder="Cash" class="sa-cash-input" oninput="window.updateServiceTotal()" style="width: 65px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
      <span style="font-size:10px;color:#999">+</span>
      <input type="number" placeholder="GPay" class="sa-gpay-input" oninput="window.updateServiceTotal()" style="width: 65px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
    `;
  } else {
    container.innerHTML = `
      <span style="font-size:12px;color:#888">₹</span>
      <input type="number" placeholder="Amount" class="sa-amount-input" oninput="window.updateServiceTotal()" style="width: 80px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
    `;
  }
  updateServiceTotal();
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
      const defaultAmounts = {
        'Threading': 40,
        'Saree Prepleating': 250,
        'Facial': 500,
        'Bleach': 250,
        'Detan': 250,
        'Hair Spa': 700,
        'Layer Haircut': 600,
        'Black Hair Color': 600,
        'Pedicure': 700,
        'Smoothening': 2000,
        'Wax': 300
      };
      const amount = defaultAmounts[serviceName] || 0;

      const row = document.createElement('div');
      row.className = 'service-amount-row';
      row.id = rowId;
      row.dataset.service = serviceName;
      row.innerHTML = getServiceRowHtml(serviceName, rowId, amount, 'Cash', serviceName);
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
  row.innerHTML = getServiceRowHtml(otherName, rowId, 0, 'Cash');
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
  rows.forEach(r => {
    const method = r.querySelector('.sa-method')?.value || 'Cash';
    if (method === 'Both') {
      const cash = parseInt(r.querySelector('.sa-cash-input')?.value) || 0;
      const gpay = parseInt(r.querySelector('.sa-gpay-input')?.value) || 0;
      total += cash + gpay;
    } else {
      total += parseInt(r.querySelector('.sa-amount-input')?.value) || 0;
    }
  });
  const el = document.getElementById('sf-total-amount');
  if (el) el.textContent = '₹' + total.toLocaleString();
  const bar = document.getElementById('sf-total-bar');
  if (bar) bar.style.display = rows.length > 0 ? 'flex' : 'none';
}

function getServiceAmounts() {
  const rows = document.querySelectorAll('#sf-service-amounts .service-amount-row');
  const services = [];
  rows.forEach(r => {
    const nameInput = r.querySelector('.sa-name-input');
    const name = nameInput ? nameInput.value.trim() : r.dataset.service;
    const method = r.querySelector('.sa-method')?.value || 'Cash';
    let amount = 0;
    let cash = 0;
    let gpay = 0;
    if (method === 'Both') {
      cash = parseInt(r.querySelector('.sa-cash-input')?.value) || 0;
      gpay = parseInt(r.querySelector('.sa-gpay-input')?.value) || 0;
      amount = cash + gpay;
    } else {
      amount = parseInt(r.querySelector('.sa-amount-input')?.value) || 0;
    }
    if (name) {
      services.push({ name, amount, method, cash, gpay });
    }
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
  const serviceNames = serviceAmounts.map(s => {
    if (s.method === 'Both') {
      return `${s.name} (Cash: ₹${s.cash}, GPay: ₹${s.gpay})`;
    }
    return `${s.name} (${s.method})`;
  });

  const methods = [...new Set(serviceAmounts.map(s => s.method))];
  const overallPaymentMethod = methods.length === 1 ? methods[0] : 'Both';

  const rating = parseInt(document.getElementById('form-rating-value').value) || 5;
  const location = document.getElementById('sf-location').value.trim();
  const date = document.getElementById('sf-date').value || new Date().toISOString().split('T')[0];

  const isReferred = document.getElementById('sf-referred')?.checked;
  const referredBy = isReferred ? document.getElementById('sf-referrer')?.value.trim() : '';

  const btn = document.getElementById('sf-submit-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...'; }

  let result;
  if (window._selectedExistingCustomer && window._selectedExistingCustomer.id) {
    const existing = window._selectedExistingCustomer;
    const currentVisits = getCustomerVisits(existing, window._cachedCustomers || []);
    const newVisits = (existing.visits || currentVisits.length || 1) + 1;
    const newTotalSpend = (existing.total_spend || existing.amount || 0) + totalAmount;

    const newVisitEntry = {
      visit_num: newVisits,
      date: date,
      services: serviceNames,
      amount: totalAmount,
      payment_method: overallPaymentMethod
    };
    const updatedVisitHistory = [...currentVisits, newVisitEntry];

    const existingSvcs = Array.isArray(existing.services)
      ? existing.services
      : (typeof existing.services === 'string' && existing.services.trim()
        ? existing.services.split(',').map(s => s.trim())
        : []);
    const mergedServices = [...new Set([...existingSvcs, ...serviceNames])];

    result = await updateCustomer(existing.id, {
      name: name || existing.name,
      location: location || existing.location,
      services: mergedServices,
      amount: totalAmount,
      payment_status: 'paid',
      payment_method: overallPaymentMethod,
      last_visit: date,
      total_spend: newTotalSpend,
      visits: newVisits,
      rating: rating || existing.rating || 5,
      visit_history: updatedVisitHistory
    });
  } else {
    const initialVisit = [{
      visit_num: 1,
      date: date,
      services: serviceNames,
      amount: totalAmount,
      payment_method: overallPaymentMethod
    }];

    result = await addCustomer({
      name,
      phone: phoneVal,
      location,
      services: serviceNames,
      amount: totalAmount,
      payment_status: 'paid',
      payment_method: overallPaymentMethod,
      last_visit: date,
      total_spend: totalAmount,
      visits: 1,
      rating,
      referred_by: referredBy || null,
      visit_history: initialVisit
    });
  }

  if (result) {
    closeFormOverlay();
    const svcSummary = serviceAmounts.map(s => {
      if (s.method === 'Both') {
        return `${s.name} (Cash: ₹${s.cash}, GPay: ₹${s.gpay})`;
      }
      return `${s.name} (${s.method}): ₹${s.amount.toLocaleString()}`;
    }).join(' · ');
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

export function openClassesForm() {
  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('form-overlay-container');
  if (!container) return;
  container.innerHTML = `
    <div class="form-overlay" onclick="window.closeFormOverlay()">
      <div class="form-panel" onclick="event.stopPropagation()">
        <div class="form-panel-header">
          <h3><i class="ti ti-school" style="color:#d97706"></i> Class Enrollment Form</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-outline btn-icon" id="form-mic-btn" onclick="window.startVoiceRecording('class')" title="Fill form with voice" style="width:34px; height:34px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; border-color:#e5e5e5; transition: all 0.2s ease;">
              <i class="ti ti-microphone" style="font-size:16px; color:#d97706;"></i>
            </button>
            <div onclick="window.closeFormOverlay()" style="cursor:pointer;color:#999;font-size:22px;padding:4px;display:flex;align-items:center;"><i class="ti ti-x"></i></div>
          </div>
        </div>
        <div class="form-panel-body">
          <div id="form-voice-container"></div>
          <div class="form-section-title" style="border-top:none;margin-top:0;padding-top:0">
            <i class="ti ti-user"></i> Student Details
          </div>
          <div class="form-group">
            <label class="form-label">Student Name *</label>
            <input class="form-input" id="cf-name" placeholder="Enter student name">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Phone Number *</label>
              <div style="position:relative; display:flex; align-items:center;">
                <input class="form-input" id="cf-phone" placeholder="10-digit number" maxlength="10" style="padding-right:38px;">
                <button type="button" onclick="window.pickContact('cf-phone', 'cf-name')" title="Pick from contacts" style="position:absolute; right:6px; background:none; border:none; color:#d97706; cursor:pointer; padding:5px 7px; display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:17px; transition:all 0.15s;" onmouseover="this.style.background='rgba(217,119,6,0.12)'" onmouseout="this.style.background='transparent'">
                  <i class="ti ti-address-book"></i>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Location</label>
              <input class="form-input" id="cf-location" placeholder="e.g. Chennai">
            </div>
          </div>
          
          <div class="form-section-title">
            <i class="ti ti-book-open" style="color:#d97706"></i> Select Classes Taken *
          </div>
          <div class="form-group">
            <div class="chip-group" id="cf-class-chips">
              <div class="chip selected" onclick="window.classesChipToggle(this)">Saree Prepleating</div>
              <div class="chip" onclick="window.classesChipToggle(this)">Beauty Course</div>
              <div class="chip" onclick="window.classesChipToggle(this)">Bridal Makeup</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1.2fr 1.5fr;gap:12px;margin-bottom:14px;align-items:center;">
            <div class="form-group" style="margin-bottom:0;display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="cf-referred" onchange="document.getElementById('cf-referrer-div').style.display = this.checked ? 'block' : 'none'" style="width:16px;height:16px;cursor:pointer;">
              <label for="cf-referred" class="form-label" style="margin-bottom:0;cursor:pointer;font-weight:500;">Came from Referral?</label>
            </div>
            <div class="form-group" id="cf-referrer-div" style="margin-bottom:0;display:none;">
              <select class="form-input form-select" id="cf-referrer">
                <option value="Instagram">Instagram</option>
                <option value="Relatives">Relatives</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Total Course Fee (₹) *</label>
              <input class="form-input" id="cf-total-fee" type="number" value="40000" placeholder="e.g. 40000">
            </div>
            <div class="form-group">
              <label class="form-label">Initial Payment Paid (₹) *</label>
              <input class="form-input" id="cf-initial-payment" type="number" value="10000" placeholder="e.g. 10000">
            </div>
          </div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Enrollment Date</label>
              <input class="form-input" id="cf-date" type="date" value="${today}" onclick="try{this.showPicker()}catch(e){}">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method</label>
              <select class="form-input form-select" id="cf-payment-method" onchange="window.handleClassesPaymentMethodChange(this)">
                <option value="Cash">Cash</option>
                <option value="GPay">GPay</option>
                <option value="Both">Both</option>
              </select>
              <div id="cf-both-amounts-container" style="display:none; margin-top:10px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label" style="font-size:11px">Cash Portion (₹) *</label>
                    <input class="form-input" id="cf-both-cash" type="number" placeholder="Cash amount" oninput="window.updateClassesBothTotal()">
                  </div>
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label" style="font-size:11px">GPay Portion (₹) *</label>
                    <input class="form-input" id="cf-both-gpay" type="number" placeholder="GPay amount" oninput="window.updateClassesBothTotal()">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="form-panel-footer">
          <button class="btn btn-outline" onclick="window.closeFormOverlay()"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-gold" onclick="window.submitClassesForm()" id="cf-submit-btn"><i class="ti ti-check"></i> Save Student</button>
        </div>
      </div>
    </div>`;

  // Run immediately to set initial default values based on defaults (Saree Prepleating starts selected)
  setTimeout(() => {
    const chip = document.querySelector('#cf-class-chips .chip.selected');
    if (chip && typeof window.classesChipToggle === 'function') {
      window.classesChipToggle(chip);
    }
  }, 50);
}

window.classesChipToggle = function(chipEl) {
  const wasSelected = chipEl.classList.contains('selected');
  
  // Deselect all chips in this group
  const group = chipEl.closest('.chip-group');
  if (group) {
    group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  }
  
  // Toggle the clicked one
  if (!wasSelected) {
    chipEl.classList.add('selected');
  }

  const selected = Array.from(document.querySelectorAll('#cf-class-chips .chip.selected')).map(c => c.textContent.trim());
  const feeInput = document.getElementById('cf-total-fee');
  const payInput = document.getElementById('cf-initial-payment');
  
  if (!feeInput || !payInput) return;

  if (selected.length === 1 && selected[0] === 'Saree Prepleating') {
    feeInput.value = 800;
    payInput.value = 800;
  } else if (selected.length > 0) {
    // Default to 40000 course fee and 10000 initial payment for Beauty Course / Bridal Makeup
    feeInput.value = 40000;
    payInput.value = 10000;
  } else {
    // Reset if nothing is selected
    feeInput.value = '';
    payInput.value = '';
  }

  // If payment method is "Both", update the Cash and GPay portion inputs
  const payMethodSelect = document.getElementById('cf-payment-method');
  if (payMethodSelect && payMethodSelect.value === 'Both') {
    const currentVal = parseInt(payInput.value) || 0;
    const half = Math.round(currentVal / 2);
    const cashEl = document.getElementById('cf-both-cash');
    const gpayEl = document.getElementById('cf-both-gpay');
    if (cashEl) cashEl.value = half;
    if (gpayEl) gpayEl.value = currentVal - half;
  }
};

export async function submitClassesForm() {
  const name = document.getElementById('cf-name').value.trim();
  if (!name) { showToast('Please enter student name', 'error'); return; }

  const phoneInput = document.getElementById('cf-phone').value.trim();
  if (!phoneInput) { showToast('Please enter phone number', 'error'); return; }
  const phoneVal = validateAndCleanPhone(phoneInput);
  if (phoneVal === null) { showToast('Please enter a valid 10-digit phone number', 'error'); return; }

  const totalFee = parseInt(document.getElementById('cf-total-fee').value) || 0;
  if (totalFee <= 0) { showToast('Please enter the total course fee amount', 'error'); return; }

  const initialPayment = parseInt(document.getElementById('cf-initial-payment').value) || 0;
  if (initialPayment < 0) { showToast('Initial payment cannot be negative', 'error'); return; }
  if (initialPayment > totalFee) { showToast('Initial payment cannot be more than the total course fee', 'error'); return; }

  const selectedClasses = [];
  document.querySelectorAll('#cf-class-chips .chip.selected').forEach(c => {
    selectedClasses.push(c.textContent.trim());
  });

  if (selectedClasses.length === 0) {
    showToast('Please select at least one class', 'error');
    return;
  }

  const location = document.getElementById('cf-location').value.trim();
  const date = document.getElementById('cf-date').value || new Date().toISOString().split('T')[0];
  const paymentMethod = document.getElementById('cf-payment-method').value;
  
  let paymentNote = 'Initial Enrollment Payment';
  if (paymentMethod === 'Both') {
    const cashPortion = parseInt(document.getElementById('cf-both-cash').value) || 0;
    const gpayPortion = parseInt(document.getElementById('cf-both-gpay').value) || 0;
    if (cashPortion <= 0 || gpayPortion <= 0) {
      showToast('Please enter both Cash and GPay portion amounts', 'error');
      return;
    }
    if (cashPortion + gpayPortion !== initialPayment) {
      showToast(`Sum of Cash (₹${cashPortion}) & GPay (₹${gpayPortion}) must equal Initial Payment (₹${initialPayment})`, 'error');
      return;
    }
    paymentNote = `Initial Enrollment Payment (Cash: ₹${cashPortion}, GPay: ₹${gpayPortion})`;
  }

  const isReferred = document.getElementById('cf-referred')?.checked;
  const referredBy = isReferred ? document.getElementById('cf-referrer')?.value.trim() : '';

  const btn = document.getElementById('cf-submit-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...'; }

  // Save to class_enrollments
  const result = await addClassEnrollment({
    name,
    phone: phoneVal,
    location,
    classes: selectedClasses,
    total_fee: totalFee,
    total_paid: initialPayment,
    status: 'Active',
    start_date: date,
    referred_by: referredBy || null
  });

  if (result) {
    // Save initial payment if it is greater than 0
    if (initialPayment > 0) {
      await addClassPayment({
        enrollment_id: result.id,
        amount: initialPayment,
        payment_method: paymentMethod,
        date: date,
        note: paymentNote
      });
    }

    closeFormOverlay();
    state.chatMessages.push({ 
      role: 'ai', 
      text: `✅ Student <strong>${name}</strong> enrolled in Classes! 🎉<br><span style="font-size:11px;color:#888">Classes: ${selectedClasses.join(', ')} · Total Fee: ₹${totalFee.toLocaleString()} · Paid: ₹${initialPayment.toLocaleString()} · Location: ${location || 'N/A'}</span>` 
    });
    if (typeof window.render === 'function') window.render();

    setTimeout(() => {
      promptWhatsAppBill(name, phoneVal, selectedClasses.map(c => `Class: ${c}`), initialPayment, date, 'paid');
    }, 400);
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Save Student'; }
  }
}

export function handleClassesPaymentMethodChange(selectEl) {
  const container = document.getElementById('cf-both-amounts-container');
  const initialPaymentInput = document.getElementById('cf-initial-payment');
  if (!container || !initialPaymentInput) return;

  if (selectEl.value === 'Both') {
    container.style.display = 'block';
    initialPaymentInput.readOnly = true;
    
    // Split the current initial payment into cash and gpay inputs
    const currentVal = parseInt(initialPaymentInput.value) || 0;
    const half = Math.round(currentVal / 2);
    const cashEl = document.getElementById('cf-both-cash');
    const gpayEl = document.getElementById('cf-both-gpay');
    if (cashEl) cashEl.value = half;
    if (gpayEl) gpayEl.value = currentVal - half;
  } else {
    container.style.display = 'none';
    initialPaymentInput.readOnly = false;
  }
}

export function updateClassesBothTotal() {
  const cash = parseInt(document.getElementById('cf-both-cash').value) || 0;
  const gpay = parseInt(document.getElementById('cf-both-gpay').value) || 0;
  const initialPaymentInput = document.getElementById('cf-initial-payment');
  if (initialPaymentInput) {
    initialPaymentInput.value = cash + gpay;
  }
}

export function applyRecognizedCustomerDetails(customerId) {
  const match = window._selectedExistingCustomer || (window._cachedCustomers || []).find(c => String(c.id) === String(customerId));
  if (!match) return;

  window._selectedExistingCustomer = match;

  const phoneInput = document.getElementById('sf-phone');
  const nameInput = document.getElementById('sf-name');
  const locInput = document.getElementById('sf-location');

  if (phoneInput && match.phone) {
    phoneInput.value = match.phone;
  }

  if (nameInput) {
    const cleanName = match.name ? match.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim() : '';
    nameInput.value = cleanName;
  }

  if (locInput && match.location) {
    locInput.value = match.location;
  }

  if (match.rating && typeof window.setStarRating === 'function') {
    window.setStarRating(match.rating);
  }

  if (typeof window.showToast === 'function') {
    window.showToast(`Auto-filled details for ${match.name ? match.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim() : 'Customer'}`, 'success');
  }
}

export function handlePhoneLookup(val) {
  const cleanDigits = (val || '').replace(/\D/g, '');
  const matchCard = document.getElementById('sf-phone-match-card');

  if (cleanDigits.length < 3) {
    window._selectedExistingCustomer = null;
    if (matchCard) matchCard.innerHTML = '';
    return;
  }

  const cached = window._cachedCustomers || [];
  const match = cached.find(c => {
    if (!c.phone) return false;
    const cPhoneClean = c.phone.toString().replace(/\D/g, '');
    return cPhoneClean.endsWith(cleanDigits) || cPhoneClean.includes(cleanDigits);
  });

  if (match) {
    window._selectedExistingCustomer = match;
    const nameInput = document.getElementById('sf-name');
    const locInput = document.getElementById('sf-location');
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = match.name ? match.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim() : '';
    }
    if (locInput && !locInput.value.trim()) {
      locInput.value = match.location || '';
    }
    if (match.rating) {
      window.setStarRating(match.rating);
    }

    const cleanName = match.name ? match.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim() : 'Customer';
    const totalSpend = match.total_spend || match.amount || 0;
    const visits = match.visits || 1;
    const lastVisit = match.last_visit || 'N/A';

    if (matchCard) {
      matchCard.innerHTML = `
        <div onclick="window.applyRecognizedCustomerDetails('${match.id}')" style="cursor:pointer; background: linear-gradient(135deg, rgba(217,119,6,0.1), rgba(245,200,66,0.18)); border: 1.5px dashed #d97706; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; font-size: 12px; animation: fadeIn 0.2s ease;" title="Click to auto-fill full phone, name & location">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-weight:700; color:#d97706; font-size:12px; display:inline-flex; align-items:center; gap:4px;">
              <i class="ti ti-sparkles" style="font-size:14px"></i> Repeat Client Recognized!
            </span>
            <button type="button" onclick="event.stopPropagation(); window.clearPhoneMatch()" style="background:none; border:none; color:#dc2626; font-size:11px; cursor:pointer; font-weight:600; text-decoration:underline;">Not this client?</button>
          </div>
          <div style="color:#1a1a1a; font-weight:700; font-size:13px; margin-bottom:2px;">${cleanName} · ${match.phone || ''}</div>
          <div style="color:#555; font-size:11px; display:flex; gap:12px; flex-wrap:wrap; margin-bottom:4px">
            <span>📍 <strong>Location:</strong> ${match.location || 'No location'}</span>
            <span>📅 <strong>Last Visit:</strong> ${lastVisit}</span>
            <span>⭐ <strong>Visits:</strong> ${visits}</span>
            <span>💰 <strong>Total Spend:</strong> ₹${totalSpend.toLocaleString()}</span>
          </div>
          <div style="font-size:11px; color:#d97706; font-weight:600; display:flex; align-items:center; gap:4px">
            <i class="ti ti-hand-click"></i> 👉 Tap here to auto-fill full phone number (${match.phone}), name & location!
          </div>
        </div>`;
    }
  } else {
    window._selectedExistingCustomer = null;
    if (matchCard) matchCard.innerHTML = '';
  }
}

export function clearPhoneMatch() {
  window._selectedExistingCustomer = null;
  const matchCard = document.getElementById('sf-phone-match-card');
  if (matchCard) matchCard.innerHTML = '';
  const nameInput = document.getElementById('sf-name');
  const locInput = document.getElementById('sf-location');
  if (nameInput) nameInput.value = '';
  if (locInput) locInput.value = '';
}

// Bind to window to allow HTML inline click handlers to execute
window.openShopCustomerForm = openShopCustomerForm;
window.submitShopCustomerForm = submitShopCustomerForm;
window.handlePhoneLookup = handlePhoneLookup;
window.clearPhoneMatch = clearPhoneMatch;
window.serviceChipToggle = serviceChipToggle;
window.addOtherServiceAmount = addOtherServiceAmount;
window.removeServiceRow = removeServiceRow;
window.updateServiceTotal = updateServiceTotal;
window.setStarRating = setStarRating;
window.filterCustomers = filterCustomers;
window.filterByMonth = filterByMonth;
window.toggleMonthFilter = toggleMonthFilter;

// ─────────────────────────────────────────────
// CUSTOMER ANALYTICS & INSIGHTS DASHBOARD
// ─────────────────────────────────────────────

export function switchCustomerTab(tab) {
  if (['top_paid', 'repeat', 'lapsed', 'new'].includes(tab)) {
    window._customerActiveTab = 'history';
    window._customerHistoryView = tab;
  } else {
    window._customerActiveTab = tab;
    if (tab === 'history' && !window._customerHistoryView) {
      window._customerHistoryView = 'all';
    }
  }
  if (typeof window.render === 'function') window.render();
}

export function switchCustomerHistoryView(view) {
  window._customerActiveTab = 'history';
  window._customerHistoryView = view;
  if (typeof window.render === 'function') window.render();
}

export function renderCustomerAnalyticsDashboard(customers, allCustomers = window._cachedCustomers || customers) {
  if (!customers || !customers.length) {
    return `<div class="card" style="text-align:center;padding:40px;color:#999"><i class="ti ti-chart-pie" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>No customer analytics available yet. Add customers to see detailed insights!</div>`;
  }

  const totalCustomers = customers.length;
  const uniqueMap = getUniqueCustomersMap(customers);
  const repeatCustomers = Array.from(uniqueMap.values()).filter(g => g.totalVisits > 1 || g.records.length > 1);
  const retentionRate = totalCustomers > 0 ? Math.round((repeatCustomers.length / (uniqueMap.size || 1)) * 100) : 0;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spend || 0), 0);
  const avgSpend = Math.round(totalRevenue / totalCustomers);

  // 1. Locations Breakdown ("most customer place came from")
  const locationMap = {};

  function isUnspecifiedLocation(loc) {
    if (!loc) return true;
    const s = String(loc).trim().toLowerCase();
    return !s || s === 'unspecified' || s === 'no location' || s === 'none' || s === 'n/a' || s === 'unknown' || s === 'not specified' || s === 'nil' || s === 'undefined' || s === 'null';
  }

  customers.forEach(c => {
    const rawLoc = (c.location || '').trim();
    if (isUnspecifiedLocation(rawLoc)) {
      if (!locationMap['unspecified']) {
        locationMap['unspecified'] = { name: 'Unspecified', count: 0, revenue: 0 };
      }
      locationMap['unspecified'].count += 1;
      locationMap['unspecified'].revenue += (c.total_spend || c.amount || 0);
      return;
    }
    const key = rawLoc.toLowerCase().replace(/\s+/g, ' ');
    if (!locationMap[key]) {
      locationMap[key] = { name: rawLoc, count: 0, revenue: 0 };
    } else {
      if (rawLoc !== rawLoc.toLowerCase() && locationMap[key].name === locationMap[key].name.toLowerCase()) {
        locationMap[key].name = rawLoc;
      }
    }
    locationMap[key].count += 1;
    locationMap[key].revenue += (c.total_spend || c.amount || 0);
  });
  const sortedLocations = Object.values(locationMap).sort((a, b) => b.count - a.count);
  const specifiedLocations = sortedLocations.filter(l => l.name.toLowerCase() !== 'unspecified');
  const topLocation = specifiedLocations.length > 0 
    ? specifiedLocations[0] 
    : { name: 'Not Specified', count: 0, revenue: 0 };

  // 2. Staff vs Owner Handling ("how customer handle employee and by owner")
  const staffMap = {};
  customers.forEach(c => {
    const match = (c.name || '').match(/\[Emp:\s*([^\]]+)\]/i);
    const staffName = match ? match[1].trim() : 'Owner (Kalai)';
    if (!staffMap[staffName]) staffMap[staffName] = { count: 0, revenue: 0 };
    staffMap[staffName].count += 1;
    staffMap[staffName].revenue += (c.total_spend || 0);
  });
  const sortedStaff = Object.entries(staffMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  // 3. Payment Method Split ("by cash or gpay")
  let cashCount = 0, cashRev = 0, gpayCount = 0, gpayRev = 0;
  customers.forEach(c => {
    const pmStr = (c.payment_method || '').toLowerCase();
    const servicesStr = (Array.isArray(c.services) ? c.services.join(' ') : (c.services || '')).toLowerCase();
    
    // Check if GPay / UPI is specified in payment_method OR in services text
    const isGPay = pmStr.includes('gpay') || pmStr.includes('online') || pmStr.includes('upi') || pmStr.includes('bank') || servicesStr.includes('gpay') || servicesStr.includes('online') || servicesStr.includes('upi');

    if (isGPay) {
      gpayCount++;
      gpayRev += (c.total_spend || c.amount || 0);
    } else {
      cashCount++;
      cashRev += (c.total_spend || c.amount || 0);
    }
  });

  // 4. Ratings Distribution ("by ratings")
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let ratingSum = 0, ratingTotal = 0;
  customers.forEach(c => {
    if (c.rating) {
      ratingCounts[c.rating] = (ratingCounts[c.rating] || 0) + 1;
      ratingSum += c.rating;
      ratingTotal++;
    }
  });
  const avgRating = ratingTotal > 0 ? (ratingSum / ratingTotal).toFixed(1) : '5.0';

  // 5. Popular Services Breakdown ("which service most")
  const serviceMap = {};
  customers.forEach(c => {
    const sList = Array.isArray(c.services) ? c.services : (c.services || '').split(',');
    sList.forEach(s => {
      // Strip payment tags like (GPay), (Cash), (Online) to consolidate identical services
      const cleanS = s.replace(/\s*\((GPay|Cash|Online|UPI)\)/gi, '').trim();
      if (!cleanS) return;
      if (!serviceMap[cleanS]) serviceMap[cleanS] = { count: 0, revenue: 0 };
      serviceMap[cleanS].count += 1;
      serviceMap[cleanS].revenue += Math.round((c.total_spend || c.amount || 0) / Math.max(1, sList.length));
    });
  });
  const sortedServices = Object.entries(serviceMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  // 6. Calculate active service days & Avg Customers / Day
  const uniqueDays = new Set();
  customers.forEach(c => {
    const dStr = c.last_visit || c.created_at;
    if (dStr) {
      const day = String(dStr).split('T')[0];
      if (day.length >= 10) uniqueDays.add(day);
    }
  });
  const activeDaysCount = uniqueDays.size || 1;
  const avgCustomersPerDay = (totalCustomers / activeDaysCount).toFixed(1);

  // 7. Monthly Breakdown & Peak Month Analysis ("which month is high")
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const allList = (allCustomers && allCustomers.length) ? allCustomers : (window._cachedCustomers || customers);

  const allMonthMap = {};
  allList.forEach(c => {
    const dStr = c.last_visit || c.created_at;
    if (!dStr) return;
    const parts = String(dStr).split('T')[0].split('-');
    if (parts.length < 2) return;
    const yr = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      const key = `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[mIdx]} ${yr}`;
      if (!allMonthMap[key]) {
        allMonthMap[key] = { key, label, year: parseInt(yr, 10), monthIndex: mIdx, count: 0, revenue: 0 };
      }
      allMonthMap[key].count += 1;
      allMonthMap[key].revenue += (c.total_spend || c.amount || 0);
    }
  });

  let sortedMonths = [];
  let isMonthComparison = false;
  let prevMonthData = null;
  let currMonthData = null;
  let diffVisits = 0;
  let diffVisitsPct = 0;
  let diffRev = 0;
  let diffRevPct = 0;

  if (window._selectedMonth !== undefined && window._selectedMonth !== 'all') {
    const mTarget = parseInt(window._selectedMonth, 10);
    let selectedYear = new Date().getFullYear();
    Object.values(allMonthMap).forEach(m => {
      if (m.monthIndex === mTarget) selectedYear = m.year;
    });

    const prevMonthIndex = (mTarget - 1 + 12) % 12;
    const prevYear = mTarget === 0 ? selectedYear - 1 : selectedYear;
    const prevKey = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}`;
    const prevLabel = `${MONTH_NAMES[prevMonthIndex]} ${prevYear}`;
    const selectedKey = `${selectedYear}-${String(mTarget + 1).padStart(2, '0')}`;
    const selectedLabel = `${MONTH_NAMES[mTarget]} ${selectedYear}`;

    prevMonthData = allMonthMap[prevKey] || { key: prevKey, label: prevLabel, year: prevYear, monthIndex: prevMonthIndex, count: 0, revenue: 0 };
    currMonthData = allMonthMap[selectedKey] || { key: selectedKey, label: selectedLabel, year: selectedYear, monthIndex: mTarget, count: 0, revenue: 0 };

    sortedMonths = [prevMonthData, currMonthData];
    isMonthComparison = true;

    diffVisits = currMonthData.count - prevMonthData.count;
    diffVisitsPct = prevMonthData.count > 0 
      ? Math.round((diffVisits / prevMonthData.count) * 100) 
      : (currMonthData.count > 0 ? 100 : 0);
    diffRev = currMonthData.revenue - prevMonthData.revenue;
    diffRevPct = prevMonthData.revenue > 0 
      ? Math.round((diffRev / prevMonthData.revenue) * 100) 
      : (currMonthData.revenue > 0 ? 100 : 0);
  } else {
    sortedMonths = Object.values(allMonthMap).sort((a, b) => a.key.localeCompare(b.key));
  }

  const peakMonth = sortedMonths.length ? [...sortedMonths].sort((a, b) => b.count - a.count)[0] : null;

  // Store for Chart.js
  window._customerAnalyticsData = {
    locations: sortedLocations,
    staff: sortedStaff,
    services: sortedServices,
    monthly: sortedMonths,
    isMonthComparison,
    currMonthData,
    prevMonthData,
    peakMonth,
    cashRev, gpayRev, cashCount, gpayCount
  };

  return `
    <!-- Top KPI Cards -->
    <div class="metric-grid" style="margin-bottom:20px">
      <div class="metric-card mc-gold">
        <div class="metric-label">Total Customers</div>
        <div class="metric-value">${totalCustomers}</div>
        <div class="metric-sub">${repeatCustomers.length} repeat clients (${retentionRate}% retention)</div>
        <i class="ti ti-users metric-icon"></i>
      </div>
      <div class="metric-card mc-orange">
        <div class="metric-label">Avg Customers / Day</div>
        <div class="metric-value" style="color:#d97706">${avgCustomersPerDay} <span style="font-size:13px;font-weight:500;color:#888">/ day</span></div>
        <div class="metric-sub">Across ${activeDaysCount} active service days</div>
        <i class="ti ti-calendar-stats metric-icon" style="opacity:0.12;color:#d97706"></i>
      </div>
      <div class="metric-card mc-teal">
        <div class="metric-label">Total Customer Spend</div>
        <div class="metric-value">₹${totalRevenue.toLocaleString()}</div>
        <div class="metric-sub">Average ₹${avgSpend.toLocaleString()} per customer</div>
        <i class="ti ti-wallet metric-icon"></i>
      </div>
      <div class="metric-card mc-rose">
        <div class="metric-label">Top Location</div>
        <div class="metric-value" style="font-size:20px;text-transform:capitalize">${topLocation.name || 'N/A'}</div>
        <div class="metric-sub">${topLocation.count || 0} customers from here</div>
        <i class="ti ti-map-pin metric-icon"></i>
      </div>
      <div class="metric-card mc-purple">
        <div class="metric-label">Top Service</div>
        <div class="metric-value" style="font-size:20px">${sortedServices[0]?.name || 'N/A'}</div>
        <div class="metric-sub">${sortedServices[0]?.count || 0} bookings total</div>
        <i class="ti ti-sparkles metric-icon"></i>
      </div>
    </div>

    <!-- 📅 Monthly Customer & Revenue Trends (Which Month is High Chart) -->
    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="section-title" style="margin-bottom:2px">
            <i class="ti ti-chart-bar" style="color:#d97706;font-size:18px"></i> 
            ${isMonthComparison && currMonthData && prevMonthData 
              ? `Monthly Trend: ${currMonthData.label} vs Previous Month (${prevMonthData.label})` 
              : 'Monthly Customer Visits & Revenue Trend (Peak Month Analysis)'}
          </div>
          <div style="font-size:12px;color:#888">
            ${isMonthComparison && currMonthData && prevMonthData 
              ? `Comparing ${currMonthData.label} performance against previous month (${prevMonthData.label}) to evaluate growth & customer traffic` 
              : 'Monthly breakdown showing which months generate peak salon visits & revenue'}
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${isMonthComparison && prevMonthData ? `
            <div style="background:${diffVisits >= 0 ? '#f0fdf4' : '#fff1f2'};border:1px solid ${diffVisits >= 0 ? '#bbf7d0' : '#fecdd3'};border-radius:10px;padding:6px 14px;display:flex;align-items:center;gap:8px">
              <i class="ti ${diffVisits >= 0 ? 'ti-trending-up' : 'ti-trending-down'}" style="color:${diffVisits >= 0 ? '#16a34a' : '#e11d48'};font-size:20px"></i>
              <div>
                <div style="font-size:10px;color:${diffVisits >= 0 ? '#15803d' : '#be123c'};font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">MoM vs ${prevMonthData.label}</div>
                <div style="font-size:13px;font-weight:700;color:${diffVisits >= 0 ? '#166534' : '#9f1239'}">
                  ${diffVisits >= 0 ? '+' : ''}${diffVisitsPct}% visits (${diffVisits >= 0 ? '+' : ''}${diffVisits}) · ${diffRev >= 0 ? '+' : ''}${diffRevPct}% rev
                </div>
              </div>
            </div>
          ` : ''}

          ${peakMonth ? `
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:6px 14px;display:flex;align-items:center;gap:10px">
              <i class="ti ti-trophy" style="color:#d97706;font-size:20px"></i>
              <div>
                <div style="font-size:10px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">${isMonthComparison ? 'Higher Month' : 'Highest Peak Month'}</div>
                <div style="font-size:14px;font-weight:700;color:#92400e">${peakMonth.label} — ${peakMonth.count} Visits <span style="font-size:12px;font-weight:600;color:#15803d">(₹${peakMonth.revenue.toLocaleString()})</span></div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <div style="position:relative;width:100%;height:220px;margin-bottom:16px">
        <canvas id="customerMonthlyTrendChart"></canvas>
      </div>

      <!-- Monthly Breakdown List -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px">
        ${sortedMonths.map(m => {
          const isPeak = peakMonth && m.key === peakMonth.key;
          const isSelected = isMonthComparison && currMonthData && m.key === currMonthData.key;
          const isPrev = isMonthComparison && prevMonthData && m.key === prevMonthData.key;
          const totalRef = isMonthComparison && prevMonthData && currMonthData ? (prevMonthData.count + currMonthData.count || 1) : totalCustomers;
          const pct = Math.round((m.count / (totalRef || 1)) * 100);
          return `
            <div style="padding:12px 14px;background:${isSelected ? '#fffdf0' : (isPeak ? '#fffbeb' : '#fafafa')};border:${isSelected ? '2px solid #f5c842' : (isPeak ? '1.5px solid #fde68a' : '1px solid #f0f0f0')};border-radius:10px;position:relative;">
              <div style="position:absolute;top:-9px;right:8px;display:flex;gap:4px">
                ${isSelected ? '<span class="badge badge-amber" style="font-size:9px;padding:1px 6px">Selected Month</span>' : ''}
                ${isPrev ? '<span class="badge badge-gray" style="font-size:9px;padding:1px 6px">Previous Month</span>' : ''}
                ${isPeak && !isSelected ? '<span class="badge badge-gold" style="font-size:9px;padding:1px 6px">🏆 Higher</span>' : ''}
              </div>
              <div style="font-size:13px;font-weight:700;color:#1a1a1a">${m.label}</div>
              <div style="font-size:20px;font-weight:700;color:${isPeak ? '#d97706' : '#333'};margin-top:4px">${m.count} <span style="font-size:12px;font-weight:normal;color:#888">cust (${pct}%)</span></div>
              <div style="font-size:13px;font-weight:600;color:#15803d;margin-top:3px">₹${m.revenue.toLocaleString()}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Row 1: Location Analysis & Owner vs Staff Handling -->
    <div class="grid-2" style="margin-bottom:20px">
      <!-- 📍 Customer Location Analysis -->
      <div class="card">
        <div class="section-title">
          <i class="ti ti-map-pin" style="color:#d97706"></i> Top Customer Locations / Places
        </div>
        <div style="font-size:12px;color:#888;margin-bottom:12px">Breakdown of where your salon & event customers come from</div>
        
        <div style="position:relative;width:100%;height:160px;margin-bottom:14px">
          <canvas id="customerLocationChart"></canvas>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${sortedLocations.length ? sortedLocations.slice(0, 5).map(loc => {
            const pct = Math.round((loc.count / totalCustomers) * 100);
            return `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                  <span style="font-weight:600;color:#333"><i class="ti ti-location" style="color:#d97706"></i> ${loc.name}</span>
                  <span style="color:#888">${loc.count} customers (${pct}%) · ₹${loc.revenue.toLocaleString()}</span>
                </div>
                <div style="width:100%;height:6px;background:#f3f4f6;border-radius:10px;overflow:hidden">
                  <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, #f5c842, #e8a020);border-radius:10px"></div>
                </div>
              </div>
            `;
          }).join('') : '<div style="color:#888;font-size:12px;text-align:center;padding:12px">No customer location data recorded</div>'}
        </div>
      </div>

      <!-- 🧑‍💼 Owner vs Staff Handling -->
      <div class="card">
        <div class="section-title">
          <i class="ti ti-user-check" style="color:#d97706"></i> Staff vs Owner Customer Handling
        </div>
        <div style="font-size:12px;color:#888;margin-bottom:12px">Customer distribution & revenue generated per employee</div>

        <div style="position:relative;width:100%;height:160px;margin-bottom:14px">
          <canvas id="customerStaffChart"></canvas>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${sortedStaff.map(st => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#fafafa;border-radius:8px;border:1px solid #f0f0f0">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:28px;height:28px;border-radius:50%;background:${st.name.includes('Owner') ? '#fef3c7' : '#e0e7ff'};color:${st.name.includes('Owner') ? '#b45309' : '#4338ca'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">
                  ${st.name[0]}
                </div>
                <div>
                  <div style="font-size:13px;font-weight:600;color:#1a1a1a">${st.name}</div>
                  <div style="font-size:11px;color:#888">${st.count} customers served</div>
                </div>
              </div>
              <div style="font-size:13px;font-weight:700;color:#d97706">₹${st.revenue.toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Row 2: Payment Methods & Ratings Distribution -->
    <div class="grid-2" style="margin-bottom:20px">
      <!-- 💵 Cash vs GPay Payment Split -->
      <div class="card">
        <div class="section-title">
          <i class="ti ti-credit-card" style="color:#d97706"></i> Payment Mode Preferences (Cash vs GPay)
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px">
            <div style="font-size:11px;color:#b45309;font-weight:600">💵 Cash Collections</div>
            <div style="font-size:20px;font-weight:700;color:#92400e;margin-top:2px">₹${cashRev.toLocaleString()}</div>
            <div style="font-size:11px;color:#b45309">${cashCount} transactions</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px">
            <div style="font-size:11px;color:#15803d;font-weight:600">📱 GPay / UPI Receipts</div>
            <div style="font-size:20px;font-weight:700;color:#166534;margin-top:2px">₹${gpayRev.toLocaleString()}</div>
            <div style="font-size:11px;color:#15803d">${gpayCount} transactions</div>
          </div>
        </div>

        <div style="position:relative;width:100%;height:140px">
          <canvas id="customerPaymentChart"></canvas>
        </div>
      </div>

      <!-- ⭐ Ratings & Satisfaction -->
      <div class="card">
        <div class="section-title">
          <i class="ti ti-star" style="color:#d97706"></i> Customer Ratings & Satisfaction
        </div>

        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;background:#fcfcfc;padding:12px;border-radius:10px">
          <div style="font-size:32px;font-weight:700;color:#d97706">${avgRating}</div>
          <div>
            <div style="color:#d97706;font-size:14px;letter-spacing:2px">★★★★★</div>
            <div style="font-size:11px;color:#888">Based on ${ratingTotal} rated visits</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          ${[5, 4, 3, 2, 1].map(stars => {
            const count = ratingCounts[stars] || 0;
            const pct = ratingTotal > 0 ? Math.round((count / ratingTotal) * 100) : 0;
            return `
              <div style="display:flex;align-items:center;gap:8px;font-size:12px">
                <span style="width:24px;font-weight:600;color:#555">${stars}★</span>
                <div style="flex:1;height:6px;background:#f3f4f6;border-radius:10px;overflow:hidden">
                  <div style="width:${pct}%;height:100%;background:#f5c842;border-radius:10px"></div>
                </div>
                <span style="width:30px;text-align:right;color:#888">${count}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Row 3: Popular Services & Repeat VIP Clients -->
    <div class="grid-2">
      <!-- ✂️ Popular Services -->
      <div class="card">
        <div class="section-title">
          <i class="ti ti-scissors" style="color:#d97706"></i> Most Popular Services
        </div>
        <div style="font-size:12px;color:#888;margin-bottom:12px">Most requested salon treatments ranked by volume</div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${sortedServices.slice(0, 6).map((svc, idx) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#fafafa;border-radius:8px">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:12px;font-weight:700;color:#d97706;width:18px">#${idx + 1}</span>
                <span style="font-size:13px;font-weight:600;color:#333">${svc.name}</span>
              </div>
              <div style="text-align:right">
                <span class="badge badge-gold" style="font-size:11px">${svc.count} bookings</span>
                <span style="font-size:12px;font-weight:700;color:#15803d;margin-left:6px">₹${svc.revenue.toLocaleString()}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 👑 Top VIP Repeat Clients -->
      <div class="card">
        <div class="section-title">
          <i class="ti ti-crown" style="color:#d97706"></i> Top VIP Repeat Clients
        </div>
        <div style="font-size:12px;color:#888;margin-bottom:12px">Highest spending & most frequent salon clients</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${customers.slice().sort((a, b) => {
            const listA = getCustomerVisits(a, customers);
            const sumA = listA.reduce((s, v) => s + (Number(v.amount) || 0), 0);
            const spendA = sumA > 0 ? sumA : (a.total_spend || a.amount || 0);

            const listB = getCustomerVisits(b, customers);
            const sumB = listB.reduce((s, v) => s + (Number(v.amount) || 0), 0);
            const spendB = sumB > 0 ? sumB : (b.total_spend || b.amount || 0);

            return spendB - spendA;
          }).slice(0, 5).map((c, i) => {
            const { cleanText } = formatEmpTag(c.name);
            const effVisits = getEffectiveVisits(c, customers);
            const visitsList = getCustomerVisits(c, customers);
            const visitsSum = visitsList.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
            const displaySpend = visitsSum > 0 ? visitsSum : (c.total_spend || c.amount || 0);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#fff;border:1px solid #f0f0f0;border-radius:10px">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="font-size:12px;font-weight:700;color:#d97706;width:16px">#${i + 1}</div>
                  <div>
                    <div style="font-size:13px;font-weight:600;color:#1a1a1a">${cleanText}</div>
                    <div style="font-size:11px;color:#888">${c.phone || 'No phone'} · ${effVisits} visits · 📅 Last: ${formatVisitedDate(c.last_visit || c.created_at)}</div>
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:13px;font-weight:700;color:#d97706">₹${displaySpend.toLocaleString()}</div>
                  <span class="badge badge-green" style="font-size:10px">VIP Client</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

export function initCustomerAnalyticsCharts(customers) {
  const dd = window._customerAnalyticsData;
  if (!dd || typeof Chart === 'undefined') return;

  // 1. Location Donut Chart
  const locCtx = document.getElementById('customerLocationChart');
  if (locCtx) {
    const topLocs = (dd.locations || []).slice(0, 5);
    if (topLocs.length > 0) {
      new Chart(locCtx, {
        type: 'doughnut',
        data: {
          labels: topLocs.map(l => l.name),
          datasets: [{
            data: topLocs.map(l => l.count),
            backgroundColor: ['#f5c842', '#14b8a6', '#fb7185', '#a78bfa', '#6366f1']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } }
        }
      });
    } else {
      locCtx.style.display = 'none';
    }
  }

  // 2. Staff vs Owner Handling Bar Chart
  const staffCtx = document.getElementById('customerStaffChart');
  if (staffCtx) {
    new Chart(staffCtx, {
      type: 'bar',
      data: {
        labels: dd.staff.map(s => s.name),
        datasets: [{
          label: 'Customers Served',
          data: dd.staff.map(s => s.count),
          backgroundColor: '#f5c842',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { stepSize: 1, font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }
      }
    });
  }

  // 3. Payment Mode Donut Chart
  const payCtx = document.getElementById('customerPaymentChart');
  if (payCtx) {
    new Chart(payCtx, {
      type: 'pie',
      data: {
        labels: ['Cash', 'GPay / UPI'],
        datasets: [{
          data: [dd.cashCount, dd.gpayCount],
          backgroundColor: ['#fbbf24', '#34d399']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } }
      }
    });
  }

  // 4. Monthly Customer & Revenue Bar Chart ("which month is high")
  const monthCtx = document.getElementById('customerMonthlyTrendChart');
  if (monthCtx && dd.monthly && dd.monthly.length) {
    const labels = dd.monthly.map(m => m.label);
    const counts = dd.monthly.map(m => m.count);
    const revenues = dd.monthly.map(m => m.revenue);

    new Chart(monthCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Customer Visits',
            data: counts,
            backgroundColor: dd.monthly.map(m => {
              if (dd.isMonthComparison && dd.currMonthData && m.key === dd.currMonthData.key) {
                return '#f5c842';
              }
              if (dd.peakMonth && m.key === dd.peakMonth.key) {
                return '#f5c842';
              }
              return 'rgba(245, 200, 66, 0.45)';
            }),
            borderColor: dd.monthly.map(m => {
              if (dd.isMonthComparison && dd.currMonthData && m.key === dd.currMonthData.key) {
                return '#d97706';
              }
              return '#f5c842';
            }),
            borderWidth: 1.5,
            borderRadius: 8,
            maxBarThickness: 70,
            yAxisID: 'y'
          },
          {
            label: 'Revenue (₹)',
            data: revenues,
            type: 'line',
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#10b981',
            pointRadius: 5,
            pointHoverRadius: 7,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 } } },
          tooltip: {
            callbacks: {
              title: function(ctx) {
                const idx = ctx[0]?.dataIndex;
                const m = dd.monthly[idx];
                if (!m) return '';
                if (dd.isMonthComparison) {
                  if (dd.currMonthData && m.key === dd.currMonthData.key) return `${m.label} (Selected Month)`;
                  if (dd.prevMonthData && m.key === dd.prevMonthData.key) return `${m.label} (Previous Month)`;
                }
                return m.label;
              },
              label: function(ctx) {
                if (ctx.dataset.type === 'line') {
                  return ` Revenue: ₹${Number(ctx.raw).toLocaleString()}`;
                }
                return ` Customers: ${ctx.raw} visits`;
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Customers Count', font: { size: 10 } },
            ticks: { precision: 0, font: { size: 10 } }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Revenue (₹)', font: { size: 10 } },
            ticks: {
              callback: function(val) { return '₹' + val.toLocaleString(); },
              font: { size: 10 }
            }
          },
          x: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }
}

window.openShopCustomerForm = openShopCustomerForm;
window.submitShopCustomerForm = submitShopCustomerForm;
window.serviceChipToggle = serviceChipToggle;
window.addOtherServiceAmount = addOtherServiceAmount;
window.removeServiceRow = removeServiceRow;
window.setStarRating = setStarRating;
window.updateServiceTotal = updateServiceTotal;
window.handleServiceMethodChange = handleServiceMethodChange;
window.updateSareePrepleatingAmount = updateSareePrepleatingAmount;
window.handlePhoneLookup = handlePhoneLookup;
window.submitClassesForm = submitClassesForm;
window.handleClassesPaymentMethodChange = handleClassesPaymentMethodChange;
window.updateClassesBothTotal = updateClassesBothTotal;
window.filterCustomers = filterCustomers;
window.filterByMonth = filterByMonth;
window.switchCustomerTab = switchCustomerTab;
window.switchCustomerHistoryView = switchCustomerHistoryView;
window.toggleMonthFilter = toggleMonthFilter;
window.toggleSearchField = toggleSearchField;
window.applyFilters = applyFilters;
window.renderCustomerMetrics = renderCustomerMetrics;
window.analyzeShopCustomers = analyzeShopCustomers;
window.showAddCustomerModal = showAddCustomerModal;
window.handleDeleteCustomer = handleDeleteCustomer;
window.promptWhatsAppBill = promptWhatsAppBill;
window.promptWhatsAppBillFromId = promptWhatsAppBillFromId;
window.openClassesForm = openClassesForm;
window.filterByMonthSelect = function(val) {
  window._selectedMonth = val === 'all' ? 'all' : parseInt(val, 10);
  if (typeof window.render === 'function') window.render();
};

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 📲 SERVICE-BASED WHATSAPP INVITE TRACKER & HANDLER
// ─────────────────────────────────────────────

export function getInviteSentInfo(customer) {
  if (!customer) return null;
  try {
    const raw = localStorage.getItem('kalai_customer_invites');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const cleanPhone = customer.phone ? validateAndCleanPhone(customer.phone) : null;
    const cleanName = customer.name ? customer.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() : '';

    const entry = (cleanPhone && data[cleanPhone]) ||
                  (customer.id && data[customer.id]) ||
                  (cleanName && data[`name:${cleanName}`]);
    if (!entry) return null;

    const sentDateStr = typeof entry === 'string' ? entry : entry.sent_at;
    if (!sentDateStr) return null;

    const sentDate = new Date(sentDateStr);
    if (isNaN(sentDate.getTime())) return null;

    const now = new Date();
    const dSent = new Date(sentDate.getFullYear(), sentDate.getMonth(), sentDate.getDate());
    const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.max(0, Math.floor((dNow.getTime() - dSent.getTime()) / (1000 * 60 * 60 * 24)));

    let daysText = 'Today';
    if (diffDays === 1) {
      daysText = '1 day ago';
    } else if (diffDays > 1) {
      daysText = `${diffDays} days ago`;
    }

    return {
      sentAt: sentDateStr,
      diffDays,
      daysText,
      label: `Sent ${daysText}`
    };
  } catch (e) {
    return null;
  }
}

export function recordInviteSent(customer, inviteType = 'general') {
  if (!customer) return;
  try {
    const raw = localStorage.getItem('kalai_customer_invites');
    const data = raw ? JSON.parse(raw) : {};
    const nowIso = new Date().toISOString();
    const entry = {
      sent_at: nowIso,
      type: inviteType
    };

    const cleanPhone = customer.phone ? validateAndCleanPhone(customer.phone) : null;
    const cleanName = customer.name ? customer.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() : '';

    if (cleanPhone) data[cleanPhone] = entry;
    if (customer.id) data[customer.id] = entry;
    if (cleanName) data[`name:${cleanName}`] = entry;

    localStorage.setItem('kalai_customer_invites', JSON.stringify(data));
  } catch (e) {
    console.error('Error recording invite sent:', e);
  }
}

export function renderCustomerInviteBtn(c, inviteType = 'top_paid', defaultText = 'Send Invite') {
  const cleanP = c.phone ? validateAndCleanPhone(c.phone) : null;
  if (!cleanP) return '';

  const invite = getInviteSentInfo(c);
  if (invite) {
    return `
      <button class="btn btn-invite-sent" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;padding:6px 11px;font-size:11px;font-weight:600;border-radius:8px;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;cursor:pointer;transition:all 0.15s;" 
              onclick="event.stopPropagation(); window.sendWhatsAppServiceInvite('${c.id}', '${inviteType}')" 
              title="Invite sent ${invite.daysText} (${new Date(invite.sentAt).toLocaleDateString()}). Click to send again">
        <i class="ti ti-circle-check" style="font-size:13px;color:#16a34a"></i> ${invite.label}
      </button>
    `;
  }

  return `
    <button class="btn btn-outline" style="color:#25d366;border-color:#25d366;padding:6px 12px;font-size:11px;border-radius:8px;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;cursor:pointer;transition:all 0.15s;" 
            onclick="event.stopPropagation(); window.sendWhatsAppServiceInvite('${c.id}', '${inviteType}')" 
            title="Send WhatsApp Invite">
      <i class="ti ti-brand-whatsapp" style="font-size:13px"></i> ${defaultText}
    </button>
  `;
}

export function sendWhatsAppServiceInvite(id, inviteType) {
  const customers = window._cachedCustomers || [];
  const c = customers.find(item => String(item.id) === String(id));
  if (!c || !c.phone) {
    if (typeof window.showToast === 'function') window.showToast('No valid phone number for WhatsApp', 'error');
    return;
  }

  // Record invite timestamp
  recordInviteSent(c, inviteType);

  const { cleanText: cleanName } = formatEmpTag(c.name || 'Customer');
  let firstService = 'salon makeover';

  if (Array.isArray(c.services) && c.services.length > 0) {
    firstService = c.services[0].replace(/\s*\((GPay|Cash|Online|UPI)\)/gi, '').trim();
  } else if (c.services) {
    firstService = String(c.services).split(',')[0].replace(/\s*\((GPay|Cash|Online|UPI)\)/gi, '').trim();
  }
  if (!firstService) firstService = 'salon makeover';

  let cleanPhone = validateAndCleanPhone(c.phone);
  if (!cleanPhone) cleanPhone = c.phone.replace(/\D/g, '');

  let msg = '';
  if (inviteType === 'lapsed' || inviteType === 'repeat') {
    msg = `Vanakkam ${cleanName}! ✨\n\nIt's been a while since your last ${firstService} at Kalai Makeover! We miss you! 🌸\n\nBook your next makeover & refresh session today with us. Click to reply or call us to reserve your slot! 💖`;
  } else if (inviteType === 'new') {
    msg = `Vanakkam ${cleanName}! 🌸\n\nThank you for visiting Kalai Makeover for your ${firstService}! We hope you loved your makeover experience. ✨\n\nWe'd love to see you again soon for your next care session! Book your next appointment anytime 💅`;
  } else {
    msg = `Vanakkam ${cleanName}! 👑\n\nGreetings from Kalai Makeover! We loved hosting you for your ${firstService}. We look forward to your next visit soon! ✨`;
  }

  const encoded = encodeURIComponent(msg);
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encoded}`;
  window.open(waUrl, '_blank');

  if (typeof window.showToast === 'function') {
    window.showToast(`Invite opened for ${cleanName} & marked as Sent Today!`, 'success');
  }

  // Update UI immediately so button changes to Sent Today
  if (typeof window.render === 'function') {
    window.render();
  }
}

// ─────────────────────────────────────────────
// 🏆 TOP PAID CLIENTS TAB
// ─────────────────────────────────────────────

export function renderTopPaidClientsTab(customers) {
  const allRef = window._cachedCustomers || customers;
  const uniqueMap = getUniqueCustomersMap(customers);
  const uniqueClients = Array.from(uniqueMap.values()).map(g => {
    const visitsList = getCustomerVisits(g.primary, allRef);
    const visitsSum = visitsList.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
    const totalSpend = visitsSum > 0 ? visitsSum : Math.max(g.totalSpend, Number(g.primary.total_spend) || 0, Number(g.primary.amount) || 0);
    return {
      ...g.primary,
      visits: Math.max(g.totalVisits, visitsList.length),
      total_spend: totalSpend
    };
  });

  // Strictly sort descending by total_spend (highest amount first)
  uniqueClients.sort((a, b) => {
    const diff = (Number(b.total_spend) || 0) - (Number(a.total_spend) || 0);
    if (diff !== 0) return diff;
    const dateA = a.last_visit || a.created_at || '';
    const dateB = b.last_visit || b.created_at || '';
    return String(dateB).localeCompare(String(dateA));
  });

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div class="section-title" style="margin-bottom:0">
          <i class="ti ti-crown" style="color:#d97706;font-size:18px"></i> 🏆 Highest Spending Clients (Top Paid Customers)
        </div>
      </div>
      <div style="font-size:12px;color:#888;margin-bottom:16px">Clients ranked strictly by total revenue spend across all visits</div>

      <div style="display:flex;flex-direction:column;gap:10px">
        ${uniqueClients.map((c, i) => {
          const { cleanText, tagHtml } = formatEmpTag(c.name);
          const cleanP = c.phone ? validateAndCleanPhone(c.phone) : null;
          const visitsList = getCustomerVisits(c, allRef);
          const allServices = [];
          visitsList.forEach(v => {
            const svcs = Array.isArray(v.services) ? v.services : (v.services || '').split(',');
            svcs.forEach(s => {
              const tr = s.trim();
              if (tr && !allServices.includes(tr)) allServices.push(tr);
            });
          });
          const servicesText = allServices.length ? allServices.join(', ') : (Array.isArray(c.services) ? c.services.join(', ') : (c.services || 'General Services'));
          const displaySpend = Number(c.total_spend) || 0;
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#fff;border:1px solid #ebebeb;border-radius:12px;cursor:pointer;" onclick="window.showCustomerDetailsModal('${c.id}')" title="Click to view full customer details & history">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="font-size:14px;font-weight:700;color:${i<3?'#d97706':'#888'};width:24px;text-align:center">#${i + 1}</div>
                <div>
                  <div style="font-size:14px;font-weight:600;color:#1a1a1a;display:inline-flex;align-items:center;">
                    ${cleanText} ${tagHtml}
                    ${i === 0 ? '<span class="badge badge-gold" style="margin-left:6px">👑 Top #1 Spender</span>' : ''}
                  </div>
                  <div style="font-size:12px;color:#888;margin-top:2px">${cleanP || 'No phone'} · ${c.location || 'Chennai'} · ${c.visits} visits · 📅 Visited: ${formatVisitedDate(c.last_visit || c.created_at)}</div>
                  <div style="font-size:11px;color:#aaa;margin-top:2px">Services: ${servicesText}</div>
                </div>
              </div>

                <div style="display:flex;align-items:center;gap:14px">
                  <div style="text-align:right">
                    <div style="font-size:16px;font-weight:700;color:#d97706">₹${displaySpend.toLocaleString()}</div>
                    <span class="badge badge-green" style="font-size:10px">Paid Client</span>
                  </div>
                  ${renderCustomerInviteBtn(c, 'top_paid', 'Send Invite')}
                </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// 🔁 REPEAT CUSTOMERS TAB
// ─────────────────────────────────────────────

export function renderRepeatCustomersTab(customers) {
  const uniqueMap = getUniqueCustomersMap(customers);
  const repeatGroups = Array.from(uniqueMap.values()).filter(g => g.totalVisits > 1 || g.records.length > 1);
  const repeatClients = repeatGroups.map(g => ({
    ...g.primary,
    visits: g.totalVisits,
    total_spend: g.totalSpend
  }));
  const sortedRepeatClients = sortCustomersList(repeatClients, 'most_visited', customers);

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="section-title" style="margin-bottom:2px">
            <i class="ti ti-refresh" style="color:#d97706;font-size:18px"></i> 🔁 Active Repeat Loyal Clients (${sortedRepeatClients.length})
          </div>
          <div style="font-size:12px;color:#888">Clients who have visited your salon 2 or more times</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
        ${sortedRepeatClients.length ? sortedRepeatClients.map((c, i) => {
          const { cleanText } = formatEmpTag(c.name);
          const cleanP = c.phone ? validateAndCleanPhone(c.phone) : null;
          const repeatVisits = getCustomerVisits(c, customers);
          const displayVisits = repeatVisits.length > 1 ? repeatVisits.length : (c.visits || 2);
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;cursor:pointer;" onclick="window.showCustomerDetailsModal('${c.id}')" title="Click to view full customer details & history">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="font-size:14px;font-weight:700;color:#166534;width:24px;text-align:center">#${i + 1}</div>
                <div>
                  <div style="font-size:14px;font-weight:600;color:#166534">${cleanText} <span class="badge badge-green" style="margin-left:6px;font-size:10px">${displayVisits} Visits</span></div>
                  <div style="font-size:12px;color:#15803d;margin-top:2px">${cleanP || 'No phone'} · ${c.location || 'Chennai'} · Spend: ₹${(c.total_spend || 0).toLocaleString()} · 📅 Last Visit: ${formatVisitedDate(c.last_visit || c.created_at)}</div>
                  ${repeatVisits.length > 1 ? `
                    <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:4px;">
                      ${repeatVisits.map((v, vIdx) => `
                        <span style="background:rgba(22,101,52,0.1);color:#166534;font-size:10px;padding:2px 6px;border-radius:4px;display:inline-flex;align-items:center;">
                          <strong>${getOrdinalVisit(v.visit_num || (vIdx + 1))}:</strong>&nbsp;${Array.isArray(v.services) ? v.services.join(', ') : (v.services || 'Service')}
                        </span>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                ${renderCustomerInviteBtn(c, 'repeat', 'Invite Again')}
              </div>
            </div>
          `;
        }).join('') : '<div style="font-size:12px;color:#888;padding:20px 0;text-align:center">No repeat customers found in selected range.</div>'}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// ⏰ LAPSED CLIENT RETENTION TAB
// ─────────────────────────────────────────────

export function renderLapsedRetentionTab(customers) {
  const now = new Date();
  const LAPSED_THRESHOLD_DAYS = 40;

  const lapsedClients = customers.filter(c => {
    const dStr = c.last_visit || c.created_at;
    if (!dStr) return false;
    const visitDate = new Date(dStr);
    if (isNaN(visitDate.getTime())) return false;
    const diffDays = Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= LAPSED_THRESHOLD_DAYS;
  });

  const sortedLapsedClients = sortCustomersList(lapsedClients, window._customerSortOption || 'date_desc', customers);

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="section-title" style="color:#dc2626;margin-bottom:2px">
            <i class="ti ti-alarm" style="color:#dc2626;font-size:18px"></i> ⏰ Inactive Clients (${sortedLapsedClients.length})
          </div>
          <div style="font-size:12px;color:#888">Clients who haven't visited in over 40 days. Send personalized WhatsApp re-invites!</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
        ${sortedLapsedClients.length ? sortedLapsedClients.map(c => {
          const { cleanText } = formatEmpTag(c.name);
          const serviceName = Array.isArray(c.services) ? c.services.join(', ') : (c.services || 'Makeover');
          const cleanP = c.phone ? validateAndCleanPhone(c.phone) : null;
          const dStr = c.last_visit || c.created_at;
          const daysAgo = dStr ? Math.floor((now.getTime() - new Date(dStr).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          return `
            <div style="padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;cursor:pointer;" onclick="window.showCustomerDetailsModal('${c.id}')" title="Click to view full customer details & history">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-size:14px;font-weight:600;color:#991b1b">${cleanText} <span class="badge badge-red" style="margin-left:6px;font-size:10px;background:#fee2e2;color:#991b1b">${daysAgo} Days Ago</span></div>
                  <div style="font-size:12px;color:#888;margin-top:2px">${cleanP || 'No phone'} · 📅 Last Visit: ${formatVisitedDate(dStr)}</div>
                  <div style="font-size:11px;color:#b91c1c;margin-top:2px">Last Service: ${serviceName}</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                  ${renderCustomerInviteBtn(c, 'lapsed', 'Send Re-invite')}
                </div>
              </div>
            </div>
          `;
        }).join('') : '<div style="font-size:12px;color:#15803d;padding:20px 0;text-align:center">🎉 All clients are active and up to date with salon visits! No inactive clients right now.</div>'}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// 🆕 NEW CLIENTS TAB
// ─────────────────────────────────────────────

export function renderNewClientsTab(customers) {
  const uniqueMap = getUniqueCustomersMap(customers);
  const newGroups = Array.from(uniqueMap.values()).filter(g => g.totalVisits <= 1 && g.records.length <= 1);
  const newClients = newGroups.map(g => g.primary);

  return `
    <div class="card">
      <div class="section-title">
        <i class="ti ti-user-plus" style="color:#d97706;font-size:18px"></i> 🆕 New First-Time Clients (${newClients.length})
      </div>
      <div style="font-size:12px;color:#888;margin-bottom:16px">First-time visitors. Send them a WhatsApp Thank You & Return Invite based on their first service!</div>

      <div style="display:flex;flex-direction:column;gap:10px">
        ${newClients.map(c => {
          const { cleanText, tagHtml } = formatEmpTag(c.name);
          const servicesText = Array.isArray(c.services) ? c.services.join(', ') : (c.services || 'First Service');
          const cleanP = c.phone ? validateAndCleanPhone(c.phone) : null;
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#fff;border:1px solid #ebebeb;border-radius:10px;cursor:pointer;" onclick="window.showCustomerDetailsModal('${c.id}')" title="Click to view full customer details & history">
              <div>
                <div style="font-size:13px;font-weight:600;color:#1a1a1a;display:inline-flex;align-items:center;">
                  ${cleanText} ${tagHtml}
                  <span class="badge badge-amber" style="margin-left:6px;font-size:10px">🆕 New Client</span>
                </div>
                <div style="font-size:11px;color:#888;margin-top:2px">${cleanP || 'No phone'} · ${c.location || 'Chennai'} · 📅 Visited: ${formatVisitedDate(c.last_visit || c.created_at)}</div>
                <div style="font-size:11px;color:#444;margin-top:2px">Service Taken: <strong>${servicesText}</strong></div>
              </div>

              <div>
                ${renderCustomerInviteBtn(c, 'new', 'Send Welcome & Return Invite')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

window.sendWhatsAppServiceInvite = sendWhatsAppServiceInvite;
window.applyRecognizedCustomerDetails = applyRecognizedCustomerDetails;
window.handleCustomerSortChange = function(val) {
  window._customerSortOption = val;
  if (typeof window.render === 'function') window.render();
};

export function showCustomerDetailsModal(idOrPhone) {
  const allCustomers = window._cachedCustomers || [];
  let target = allCustomers.find(c => String(c.id) === String(idOrPhone));
  if (!target) {
    const cleanP = validateAndCleanPhone(idOrPhone);
    if (cleanP) {
      target = allCustomers.find(c => c.phone && validateAndCleanPhone(c.phone) === cleanP);
    }
  }
  if (!target) {
    showToast('Customer details not found', 'error');
    return;
  }

  // Find all records matching this customer (by phone or clean name)
  const cleanPhone = target.phone ? validateAndCleanPhone(target.phone) : null;
  const cleanName = target.name ? target.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() : '';

  let matchingRecords = [];
  if (cleanPhone) {
    matchingRecords = allCustomers.filter(c => c.phone && validateAndCleanPhone(c.phone) === cleanPhone);
  } else if (cleanName) {
    matchingRecords = allCustomers.filter(c => {
      const n = c.name ? c.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() : '';
      return n === cleanName;
    });
  } else {
    matchingRecords = [target];
  }

  // Sort visits by date (newest first)
  matchingRecords.sort((a, b) => {
    const dateA = a.last_visit || a.created_at || '';
    const dateB = b.last_visit || b.created_at || '';
    return String(dateB).localeCompare(String(dateA));
  });

  const visitsList = getCustomerVisits(target, allCustomers);
  const totalVisitsCount = Math.max(target.visits || 1, visitsList.length);
  const visitsSum = visitsList.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  const totalSpend = visitsSum > 0 ? visitsSum : (Number(target.total_spend) || Number(target.amount) || 0);

  // Auto-sync total_spend and visits to Supabase if they are out of sync
  if (visitsSum > 0 && (visitsSum !== Number(target.total_spend) || totalVisitsCount !== Number(target.visits))) {
    target.total_spend = totalSpend;
    target.visits = totalVisitsCount;
    updateCustomer(target.id, { total_spend: totalSpend, visits: totalVisitsCount }).catch(console.error);
  }

  // All unique services taken
  const allServicesSet = new Set();
  visitsList.forEach(v => {
    const sList = Array.isArray(v.services) ? v.services : (v.services || '').split(',');
    sList.forEach(s => {
      const cleanS = s.trim();
      if (cleanS) allServicesSet.add(cleanS);
    });
  });
  if (target.services) {
    const sList = Array.isArray(target.services) ? target.services : (target.services || '').split(',');
    sList.forEach(s => {
      const cleanS = s.trim();
      if (cleanS) allServicesSet.add(cleanS);
    });
  }
  const uniqueServices = Array.from(allServicesSet);

  const { cleanText, tagHtml } = formatEmpTag(target.name);
  const validPhone = target.phone ? validateAndCleanPhone(target.phone) : null;
  const modalInvite = getInviteSentInfo(target);

  const modalHtml = `
    <div style="font-family: inherit; max-width: 100%;">
      <!-- Customer Top Card Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;background:#fcf8f2;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="flex:1;min-width:200px;">
          <div style="font-size:16px;font-weight:700;color:#1a1a1a;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${cleanText} ${tagHtml}
            ${totalVisitsCount >= 5 ? '<span class="badge badge-blue" style="font-size:10px;padding:2px 6px;">⭐ Regular Client</span>' : (totalVisitsCount >= 3 ? '<span class="badge badge-amber" style="font-size:10px;padding:2px 6px;">💖 Valued Client</span>' : (totalVisitsCount === 1 ? '<span class="badge badge-gray" style="font-size:10px;padding:2px 6px;">🆕 New Client</span>' : ''))}
          </div>
          <div style="font-size:12px;color:#555;margin-top:4px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <span><i class="ti ti-phone" style="color:#d97706"></i> ${validPhone || 'No phone'}</span>
            <span><i class="ti ti-map-pin" style="color:#d97706"></i> ${target.location || 'Chennai'}</span>
            ${target.rating ? `<span style="color:#d97706;">${'★'.repeat(target.rating)}${'☆'.repeat(5 - target.rating)}</span>` : ''}
          </div>
        </div>
        ${validPhone ? `
          <button class="btn btn-gold" style="${modalInvite ? 'background:#15803d;' : 'background:#25d366;'}color:#fff;border:none;padding:6px 12px;font-size:11px;border-radius:8px;display:inline-flex;align-items:center;gap:5px;" onclick="window.sendWhatsAppServiceInvite('${target.id}', 'repeat')" title="${modalInvite ? `Invite sent ${modalInvite.daysText} (${new Date(modalInvite.sentAt).toLocaleDateString()}). Click to send again` : 'Open WhatsApp'}">
            <i class="${modalInvite ? 'ti ti-circle-check' : 'ti ti-brand-whatsapp'}" style="font-size:14px"></i> ${modalInvite ? modalInvite.label : 'WhatsApp'}
          </button>
        ` : ''}
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;">Visits</div>
          <div style="font-size:18px;font-weight:700;color:#d97706;margin-top:1px;">${totalVisitsCount}</div>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;">Total Spend</div>
          <div style="font-size:18px;font-weight:700;color:#15803d;margin-top:1px;">₹${totalSpend.toLocaleString()}</div>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;">Last Visited</div>
          <div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-top:4px;">${formatVisitedDate(target.last_visit || target.created_at)}</div>
        </div>
      </div>

      <!-- Services Summary (Scrollable Chips) -->
      <div style="margin-bottom:12px;">
        <div class="section-title" style="font-size:12px;margin-bottom:6px;">
          <i class="ti ti-scissors" style="color:#d97706"></i> All Services Taken (${uniqueServices.length})
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;max-height:85px;overflow-y:auto;padding:2px;background:#fafafa;border:1px solid #f0f0f0;border-radius:8px;" class="scrollbar-hide">
          ${uniqueServices.length ? uniqueServices.map(s => `
            <span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-size:11px;padding:2px 8px;border-radius:14px;font-weight:500;">
              ✨ ${s}
            </span>
          `).join('') : '<span style="color:#888;font-size:11px;padding:4px;">No services recorded yet</span>'}
        </div>
      </div>

      <!-- Visit History Timeline (Scrollable List) -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
          <div class="section-title" style="font-size:12px;margin-bottom:0;">
            <i class="ti ti-calendar" style="color:#d97706"></i> Visit History & Records (${visitsList.length})
          </div>
        </div>
        <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px;" class="scrollbar-hide">
          ${[...visitsList].reverse().map((v) => {
            const dateDisplay = formatVisitedDate(v.date || target.last_visit || target.created_at);
            const servicesDisplay = Array.isArray(v.services) ? v.services.join(', ') : (v.services || 'General Service');
            const amt = Number(v.amount) || 0;
            const pm = v.payment_method || 'Cash';
            const ordinal = getOrdinalVisit(v.visit_num);
            return `
              <div style="padding:10px 12px;background:#fafafa;border:1px solid #ebebeb;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                <div style="flex:1;min-width:0;padding-right:8px;">
                  <div style="font-size:12px;font-weight:700;color:#d97706;display:flex;align-items:center;gap:6px;">
                    <span class="badge badge-amber" style="font-size:10px;padding:2px 7px;font-weight:700;">${ordinal}</span>
                    <span style="color:#555;font-size:11px;font-weight:normal;">📅 ${dateDisplay}</span>
                  </div>
                  <div style="font-size:12px;color:#333;margin-top:4px;" title="${servicesDisplay}">Services: <strong>${servicesDisplay}</strong></div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                  <div style="text-align:right;">
                    <div style="font-size:13px;font-weight:700;color:#15803d;">₹${amt.toLocaleString()}</div>
                    <span class="badge badge-gray" style="font-size:9px;padding:1px 5px;margin-top:2px;">${pm}</span>
                  </div>
                  <button type="button" onclick="event.stopPropagation(); window.handleDeleteCustomerVisit('${target.id}', ${v.visit_num})" 
                          style="cursor:pointer;width:30px;height:30px;min-width:30px;border-radius:8px;background:#fee2e2;color:#dc2626;border:1px solid #fecaca;display:inline-flex;align-items:center;justify-content:center;padding:0;transition:all 0.15s;font-family:inherit;" 
                          onmouseover="this.style.background='#dc2626';this.style.color='#fff'" 
                          onmouseout="this.style.background='#fee2e2';this.style.color='#dc2626'" 
                          title="Delete ${ordinal}">
                    <i class="ti ti-trash" style="font-size:15px"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  showModal(`Customer Profile: ${cleanText}`, modalHtml, null);
  
  // Customize modal footer to hide save button and set cancel text to Close
  setTimeout(() => {
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.style.display = 'none';
    const cancelBtn = document.querySelector('#modal-container .btn-outline');
    if (cancelBtn) cancelBtn.textContent = 'Close';
  }, 50);
}

window.showCustomerDetailsModal = showCustomerDetailsModal;
window.getInviteSentInfo = getInviteSentInfo;
window.recordInviteSent = recordInviteSent;
window.renderCustomerInviteBtn = renderCustomerInviteBtn;
