// billl/js/pages/events.js
import { state } from '../state.js';
import { fetchEvents, fetchCustomers, addEvent, deleteEvent, updateEvent } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay, showConfirmDelete } from '../ui.js';
import { validateAndCleanPhone, getSelectedChips, formatEmpTag } from '../utils.js';
import { callGroqAPI } from '../api.js';
import { renderMuhurthamWidget, bookMuhurthamEvent } from '../muhurtham.js';

export async function renderEvents() {
  const [events, customers] = await Promise.all([fetchEvents(), fetchCustomers()]);
  window._cachedEvents = events;
  window._cachedCustomers = customers;

  const currentMonthIndex = new Date().getMonth();
  if (window._eventActiveTab === undefined || window._eventActiveTab === 'directory') window._eventActiveTab = 'history';
  if (window._eventHistorySubTab === undefined) window._eventHistorySubTab = 'all';
  if (window._selectedEventMonth === undefined) {
    const hasCurrentMonthData = events.some(e => {
      if (!e.date) return false;
      const parts = String(e.date).split('T')[0].split('-');
      return parts.length >= 2 && (parseInt(parts[1], 10) - 1) === currentMonthIndex;
    });
    if (hasCurrentMonthData) {
      window._selectedEventMonth = currentMonthIndex;
    } else {
      let latestMonth = currentMonthIndex;
      let newestDateStr = '';
      events.forEach(e => {
        if (e.date && String(e.date) > newestDateStr) {
          newestDateStr = String(e.date);
          const parts = newestDateStr.split('T')[0].split('-');
          if (parts.length >= 2) {
            const m = parseInt(parts[1], 10) - 1;
            if (m >= 0 && m < 12) latestMonth = m;
          }
        }
      });
      window._selectedEventMonth = latestMonth;
    }
  }
  if (window._eventSearchQuery === undefined) window._eventSearchQuery = '';
  if (window._eventMonthFilterExpanded === undefined) window._eventMonthFilterExpanded = false;
  if (window._eventSearchFieldExpanded === undefined) window._eventSearchFieldExpanded = false;
  if (window._eventStatusFilter === undefined) window._eventStatusFilter = 'all';

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Apply filters for history & analytics
  let filtered = [...events];
  if (window._eventSearchQuery && (window._eventActiveTab === 'history' || window._eventActiveTab === 'directory')) {
    const q = window._eventSearchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      (e.customer || '').toLowerCase().includes(q) ||
      (e.phone || '').includes(q) ||
      (e.type || '').toLowerCase().includes(q) ||
      (e.makeup_type || '').toLowerCase().includes(q)
    );
  }
  if (window._selectedEventMonth !== 'all') {
    const mTarget = parseInt(window._selectedEventMonth, 10);
    filtered = filtered.filter(e => {
      if (!e.date) return false;
      const parts = String(e.date).split('-');
      if (parts.length < 2) return false;
      const m = parseInt(parts[1], 10) - 1;
      return m === mTarget;
    });
  }
  if (window._eventStatusFilter !== 'all' && (window._eventActiveTab === 'history' || window._eventActiveTab === 'directory')) {
    if (window._eventStatusFilter === 'Upcoming') {
      const todayStr = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(e => e.date && e.date >= todayStr);
    } else if (window._eventStatusFilter === 'top_paid') {
      filtered = [...filtered].sort((a, b) => (b.total || 0) - (a.total || 0));
    } else if (window._eventStatusFilter === 'crossover') {
      // Handled in event-list
    } else {
      filtered = filtered.filter(e => e.status === window._eventStatusFilter);
    }
  }

  const activeBtnStyle = window._eventMonthFilterExpanded
    ? 'border-color: #f5c842; background: rgba(245, 200, 66, 0.1);'
    : '';

  const activeSearchBtnStyle = window._eventSearchFieldExpanded
    ? 'border-color: #f5c842; background: rgba(245, 200, 66, 0.1);'
    : '';

  // Trigger chart initialization if analytics tab active and on overview subtab
  window._cachedFilteredEvents = filtered;
  if (window._eventActiveTab === 'analytics' && (window._eventAnalyticsSubTab === 'overview' || !window._eventAnalyticsSubTab)) {
    setTimeout(() => initEventAnalyticsCharts(filtered), 60);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter(e => e.date && e.date >= todayStr);
  const completedEvents = events.filter(e => e.status === 'Completed');
  const crossoverClients = getCrossOverCustomers(events, customers);
  window._cachedCrossoverClients = crossoverClients;

  return `
  <div class="top-bar">
    <div>
      <h2>Event Management & Bookings</h2>
    </div>
    <div style="display:flex; gap:10px; align-items:center;">
      <select class="form-input form-select" style="width:auto;height:36px;font-size:12px;padding:4px 28px 4px 10px;border-color:#e5e5e5;font-weight:500;background-color:#fff" onchange="window.filterEventByMonthSelect(this.value)" title="Choose Month Filter">
        <option value="all" ${window._selectedEventMonth === 'all' ? 'selected' : ''}>📅 All Months</option>
        ${MONTHS.map((m, idx) => `
          <option value="${idx}" ${window._selectedEventMonth === idx ? 'selected' : ''}>📅 ${m}</option>
        `).join('')}
      </select>

      ${(window._eventActiveTab === 'history' || window._eventActiveTab === 'directory') ? `
        <button class="btn btn-outline btn-icon" onclick="window.toggleEventSearchField()" id="toggle-evt-search-btn" style="${activeSearchBtnStyle}" title="Search Event History">
          <i class="ti ti-search" style="color:#d97706"></i>
        </button>
        <button class="btn btn-outline" onclick="window.toggleEventMonthFilter()" id="toggle-evt-filter-btn" style="${activeBtnStyle}">
          <i class="ti ti-filter" style="color:#d97706"></i> Chips
        </button>
      ` : ''}
      <button class="btn btn-gold" onclick="window.openEventCustomerForm()">
        <i class="ti ti-plus"></i> Book Event
      </button>
    </div>
  </div>

  ${renderMuhurthamWidget(events, window._selectedEventMonth)}

  <!-- Navigation Tabs: Event History 1st and Analytics & Insights only -->
  <div class="tab-row" style="margin-bottom:20px;overflow-x:auto;white-space:nowrap">
    <div class="tab ${window._eventActiveTab === 'history' ? 'active' : ''}" onclick="window.switchEventTab('history')" id="tab-evt-history">
      <i class="ti ti-history" style="margin-right:6px"></i> Event History (${filtered.length})
    </div>
    <div class="tab ${window._eventActiveTab === 'analytics' ? 'active' : ''}" onclick="window.switchEventTab('analytics')" id="tab-evt-analytics">
      <i class="ti ti-chart-pie" style="margin-right:6px"></i> Analytics & Insights
    </div>
  </div>

  ${window._eventActiveTab === 'analytics' ? renderEventAnalyticsDashboard(filtered, events, customers) : `
    <div id="event-metrics-container">
      ${renderEventMetrics(filtered)}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div style="font-size:13px; font-weight:600; color:#d97706; display:flex; align-items:center; gap:6px;">
        <i class="ti ti-history" style="font-size:16px;"></i> Event History Records (${filtered.length})
      </div>
      <div class="card" style="padding: 6px 12px; display:flex; gap:8px; margin-bottom:0; overflow-x:auto; max-width:100%; white-space:nowrap;" class="scrollbar-hide">
        <span class="chip ${window._eventStatusFilter === 'all' ? 'selected' : ''}" onclick="window.filterEventsStatus('all')" style="padding: 4px 10px; font-size:11px; cursor:pointer;">All (${events.length})</span>
        <span class="chip ${window._eventStatusFilter === 'Upcoming' ? 'selected' : ''}" onclick="window.filterEventsStatus('Upcoming')" style="padding: 4px 10px; font-size:11px; cursor:pointer;">🗓️ Upcoming (${upcomingEvents.length})</span>
        <span class="chip ${window._eventStatusFilter === 'Completed' ? 'selected' : ''}" onclick="window.filterEventsStatus('Completed')" style="padding: 4px 10px; font-size:11px; cursor:pointer;">✅ Completed (${completedEvents.length})</span>
        <span class="chip ${window._eventStatusFilter === 'Booked' ? 'selected' : ''}" onclick="window.filterEventsStatus('Booked')" style="padding: 4px 10px; font-size:11px; cursor:pointer;">⏳ Pending (${events.filter(e => e.status === 'Booked').length})</span>
        <span class="chip ${window._eventStatusFilter === 'top_paid' ? 'selected' : ''}" onclick="window.filterEventsStatus('top_paid')" style="padding: 4px 10px; font-size:11px; cursor:pointer;"><i class="ti ti-crown" style="color:#d97706;margin-right:3px;"></i> Top Paid Weddings (${events.length})</span>
        <span class="chip ${window._eventStatusFilter === 'crossover' ? 'selected' : ''}" onclick="window.filterEventsStatus('crossover')" style="padding: 4px 10px; font-size:11px; cursor:pointer;">🤝 Event & Shop Customers (${crossoverClients.length})</span>
      </div>
    </div>

    <div class="card" id="event-search-card" style="margin-bottom:16px; display: ${window._eventSearchFieldExpanded ? 'block' : 'none'};">
      <input class="form-input" placeholder="Search event history by name, phone, or event type..." id="event-search-input" value="${window._eventSearchQuery || ''}" oninput="window.filterEventCustomers(this.value)">
    </div>

    <div class="card" id="event-month-filter-card" style="margin-bottom:16px; padding: 12px 18px; display: ${window._eventMonthFilterExpanded ? 'block' : 'none'};">
      <div style="font-size: 11px; font-weight: 600; color: #999; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.08em; display: flex; align-items: center; gap: 6px;">
        <i class="ti ti-filter" style="color:#d97706; font-size: 13px;"></i> Filter by Month
      </div>
      <div class="chip-group scrollbar-hide" style="flex-wrap: nowrap; overflow-x: auto; padding-bottom: 6px; width: 100%;">
        <div class="chip ${window._selectedEventMonth === 'all' ? 'selected' : ''}" style="flex-shrink: 0;" onclick="window.filterEventByMonth('all')" id="evt-month-chip-all">All Months</div>
        ${MONTHS.map((m, idx) => `
          <div class="chip ${window._selectedEventMonth === idx ? 'selected' : ''}" style="flex-shrink: 0;" onclick="window.filterEventByMonth(${idx})" id="evt-month-chip-${idx}">${m}</div>
        `).join('')}
      </div>
    </div>

    <div id="event-list">
      ${window._eventStatusFilter === 'crossover' 
        ? renderCrossoverClientsTab(crossoverClients) 
        : (window._eventStatusFilter === 'top_paid' 
          ? renderTopPaidEventsTab(filtered) 
          : renderEventList(filtered))}
    </div>
  `}`;
}

export function renderEventMetrics(events) {
  const totalBookings = events.length;
  const completedBookings = events.filter(e => e.status === 'Completed').length;
  const totalRevenue = events.reduce((sum, e) => sum + (e.total || 0), 0);
  const totalPending = events.reduce((sum, e) => sum + (e.pending || 0), 0);

  return `
  <div class="metric-grid" style="margin-bottom: 16px;">
    <div class="metric-card mc-gold">
      <div class="metric-label">Total Bookings</div>
      <div class="metric-value">${totalBookings}</div>
      <div class="metric-icon"><i class="ti ti-calendar-event"></i></div>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Completed Bookings</div>
      <div class="metric-value">${completedBookings}</div>
      <div class="metric-icon"><i class="ti ti-checkbox"></i></div>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Total Revenue</div>
      <div class="metric-value">₹${totalRevenue.toLocaleString('en-IN')}</div>
      <div class="metric-icon"><i class="ti ti-currency-rupee"></i></div>
    </div>
    <div class="metric-card mc-purple">
      <div class="metric-label">Pending Payments</div>
      <div class="metric-value">₹${totalPending.toLocaleString('en-IN')}</div>
      <div class="metric-icon"><i class="ti ti-alert-triangle"></i></div>
    </div>
  </div>`;
}

export function applyEventFilters() {
  let events = window._cachedEvents || [];

  if (window._eventSearchQuery) {
    const q = window._eventSearchQuery.toLowerCase();
    events = events.filter(e =>
      (e.customer || '').toLowerCase().includes(q) ||
      (e.phone || '').includes(q) ||
      (e.type || '').toLowerCase().includes(q)
    );
  }

  if (window._selectedEventMonth !== undefined && window._selectedEventMonth !== 'all') {
    events = events.filter(e => {
      if (!e.date) return false;
      const parts = e.date.split('-');
      if (parts.length < 2) return false;
      const m = parseInt(parts[1], 10) - 1;
      return m === window._selectedEventMonth;
    });
  }

  if (window._eventStatusFilter !== undefined && window._eventStatusFilter !== 'all') {
    if (window._eventStatusFilter === 'Upcoming') {
      const todayStr = new Date().toISOString().split('T')[0];
      events = events.filter(e => e.date && e.date >= todayStr);
    } else if (window._eventStatusFilter === 'top_paid') {
      events = [...events].sort((a, b) => (b.total || 0) - (a.total || 0));
    } else if (window._eventStatusFilter === 'crossover') {
      // Handled in listEl below
    } else {
      events = events.filter(e => e.status === window._eventStatusFilter);
    }
  }

  // Update List HTML
  const listEl = document.getElementById('event-list');
  if (listEl) {
    if (window._eventStatusFilter === 'crossover') {
      listEl.innerHTML = renderCrossoverClientsTab(window._cachedCrossoverClients || []);
    } else if (window._eventStatusFilter === 'top_paid') {
      listEl.innerHTML = renderTopPaidEventsTab(events);
    } else {
      listEl.innerHTML = renderEventList(events);
    }
  }

  // Update Metrics HTML
  const metricsEl = document.getElementById('event-metrics-container');
  if (metricsEl) {
    metricsEl.innerHTML = renderEventMetrics(events);
  }
}

export function filterEventCustomers(q) {
  window._eventSearchQuery = q;
  applyEventFilters();
}

export function filterEventByMonth(monthIndex) {
  window._selectedEventMonth = monthIndex;

  // Update active states of chips in UI
  const chips = document.querySelectorAll('.chip[id^="evt-month-chip-"]');
  chips.forEach(chip => {
    chip.classList.remove('selected');
  });

  const activeChip = document.getElementById(`evt-month-chip-${monthIndex}`);
  if (activeChip) {
    activeChip.classList.add('selected');
  }

  applyEventFilters();
}

export function toggleEventMonthFilter() {
  window._eventMonthFilterExpanded = !window._eventMonthFilterExpanded;
  const el = document.getElementById('event-month-filter-card');
  const btn = document.getElementById('toggle-evt-filter-btn');
  if (el) {
    el.style.display = window._eventMonthFilterExpanded ? 'block' : 'none';
  }
  if (btn) {
    if (window._eventMonthFilterExpanded) {
      btn.style.borderColor = '#f5c842';
      btn.style.background = 'rgba(245, 200, 66, 0.1)';
    } else {
      btn.style.borderColor = '';
      btn.style.background = '';
    }
  }
}

export function toggleEventSearchField() {
  window._eventSearchFieldExpanded = !window._eventSearchFieldExpanded;
  const el = document.getElementById('event-search-card');
  const btn = document.getElementById('toggle-evt-search-btn');
  if (el) {
    el.style.display = window._eventSearchFieldExpanded ? 'block' : 'none';
    if (window._eventSearchFieldExpanded) {
      setTimeout(() => {
        const input = document.getElementById('event-search-input');
        if (input) input.focus();
      }, 50);
    }
  }
  if (btn) {
    if (window._eventSearchFieldExpanded) {
      btn.style.borderColor = '#f5c842';
      btn.style.background = 'rgba(245, 200, 66, 0.1)';
    } else {
      btn.style.borderColor = '';
      btn.style.background = '';
    }
  }
}

export function renderEventList(events) {
  if (!events.length) return '<div class="card" style="text-align:center;padding:40px;color:#999"><i class="ti ti-calendar-event" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>No event bookings found</div>';
  return events.map(e => {
    let addonsHtml = '';
    let funcDatesHtml = '';
    
    if (e.additional_makeup) {
      try {
        const arr = typeof e.additional_makeup === 'string' ? JSON.parse(e.additional_makeup) : e.additional_makeup;
        if (Array.isArray(arr)) {
          // Render addons excluding metadata
          const cleanArr = arr.filter(a => a.name && !a.name.startsWith('Meta:') && a.amount > 0);
          if (cleanArr.length > 0) {
            addonsHtml = `
              <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
                ${cleanArr.map(a => `<span style="font-size:10px; font-weight:500; color:#4f46e5; background:#edf2f7; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; border: 0.5px solid #cbd5e0; gap: 4px;"><i class="ti ti-circle-plus" style="font-size:11px; color:#4f46e5;"></i>${a.name}: ₹${a.amount.toLocaleString()}</span>`).join('')}
              </div>
            `;
          }

          // Parse function dates if there are multiple
          const meta = arr.find(a => a.name === 'Meta:FunctionDates');
          if (meta && meta.dates && Object.keys(meta.dates).length > 1) {
            funcDatesHtml = `
              <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px; border-top: 0.5px dashed #e2e8f0; padding-top: 5px;">
                ${Object.entries(meta.dates).map(([func, dateVal]) => `
                  <div style="font-size:10px; color:#555; display:flex; justify-content:space-between; align-items:center; gap:6px;">
                    <span style="font-weight:600; color:#4f46e5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px;" title="${func}">${func}:</span>
                    <span style="background:#e0e7ff; color:#4338ca; padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:600; white-space:nowrap;">${new Date(dateVal).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                `).join('')}
              </div>
            `;
          }
        }
      } catch(err) {}
    }
    
    const { cleanText: cleanCustomer, tagHtml: empBadge } = formatEmpTag(e.customer);

    return `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:15px;font-weight:600">
            ${cleanCustomer}
            ${empBadge}
            ${e.rating ? `<span style="color:#d97706;font-size:11px;margin-left:6px;letter-spacing:1px;" title="Owner rating: ${e.rating}/5">${'★'.repeat(e.rating)}${'☆'.repeat(5-e.rating)}</span>` : ''}
          </div>
          <div style="font-size:12px;color:#888">
            ${e.phone||'No phone'}
            ${e.referred_by ? ` · <span style="color:#b45309;font-weight:500;" title="Referred by: ${e.referred_by}">📢 Referred by: ${e.referred_by}</span>` : ''}
          </div>
          <div style="font-size:11px;color:#999;margin-top:2px;">
            <i class="ti ti-clock" style="font-size:11px;vertical-align:middle;margin-right:2px;"></i>Booked on: ${e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : 'N/A'}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${e.status==='Completed'?'badge-green':e.status==='Booked'?'badge-blue':'badge-amber'}">${e.status}</span>
          <div onclick="window.promptEventWhatsAppBillFromId('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#25d366'" onmouseout="this.style.color='#ccc'" title="Send Invoice via WhatsApp">
            <i class="ti ti-brand-whatsapp" style="font-size:16px"></i>
          </div>
          <div onclick="window.openEventCustomerForm('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#f5c842'" onmouseout="this.style.color='#ccc'" title="Edit Event">
            <i class="ti ti-edit" style="font-size:15px"></i>
          </div>
          <div onclick="window.handleDeleteEvent('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#ccc'" title="Delete Event">
            <i class="ti ti-trash" style="font-size:15px"></i>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:#f9f9f9;border-radius:10px;padding:12px;font-size:12px">
        <div><div style="color:#999;margin-bottom:2px">Event</div><div style="font-weight:500">${e.type}</div></div>
        <div>
          <div style="color:#999;margin-bottom:2px">Event Date</div>
          <div style="font-weight:500; ${funcDatesHtml ? 'color:#4f46e5; font-weight:600;' : ''}">${e.date}</div>
          ${funcDatesHtml}
        </div>
        <div><div style="color:#999;margin-bottom:2px">Total</div><div style="font-weight:500;color:#d97706">₹${(e.total||0).toLocaleString()}</div></div>
        <div><div style="color:#999;margin-bottom:2px">Pending</div><div style="font-weight:500;color:${(e.pending||0)>0?'#dc2626':'#15803d'}">₹${(e.pending||0).toLocaleString()}</div></div>
      </div>
      ${addonsHtml}
      ${(() => {
        // Staff wages badges
        let staffWagesHtml = '';
        if (e.staff_wages) {
          try {
            const wages = typeof e.staff_wages === 'string' ? JSON.parse(e.staff_wages) : e.staff_wages;
            if (Array.isArray(wages) && wages.length > 0) {
              staffWagesHtml = `
                <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
                  <span style="font-size:10px; font-weight:600; color:#dc2626; text-transform:uppercase; letter-spacing:0.05em;"><i class="ti ti-users" style="font-size:11px;"></i> Staff Wages (My Expense):</span>
                  ${wages.map(w => `<span style="font-size:10px; font-weight:500; color:#dc2626; background:#fff5f5; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; border: 0.5px solid #fca5a5; gap: 4px;"><i class="ti ti-user-dollar" style="font-size:11px;"></i>${w.name}: ₹${(w.amount||0).toLocaleString()}</span>`).join('')}
                </div>
              `;
            }
          } catch(err) {}
        }
        return staffWagesHtml;
      })()}
      <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1; margin-right:12px;">
          <div style="font-size:11px;color:#bbb;margin-bottom:4px">Payment Progress</div>
          <div style="background:#f0f0f0;border-radius:4px;height:6px;overflow:hidden">
            <div style="height:6px;border-radius:4px;background:#f5c842;width:${e.total?Math.round(((e.advance||0)/e.total)*100):0}%"></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:3px;">
            <div style="font-size:11px;color:#888">Advance ₹${(e.advance||0).toLocaleString()} / ₹${(e.total||0).toLocaleString()} (${e.total?Math.round(((e.advance||0)/e.total)*100):0}%)</div>
            <div style="display:flex; gap:6px; align-items:center;">
              ${(e.travel_allowance > 0) ? `<span style="font-size:10px; color:#d97706; cursor:pointer; display:flex; align-items:center; gap:3px;" onclick="window.quickEditTransport('${e.id}')" title="Edit transport cost"><i class="ti ti-car" style="font-size:11px;"></i>Transport: ₹${(e.travel_allowance||0).toLocaleString()} <i class="ti ti-pencil" style="font-size:10px;"></i></span>` : ''}
            </div>
          </div>
        </div>
        ${(e.pending || 0) > 0 ? `
          <button class="btn btn-gold" onclick="window.openEventCollectPaymentModal('${e.id}')" style="padding: 6px 12px; font-size: 11px; height: 32px; white-space: nowrap; border-radius: 8px;">
            <i class="ti ti-cash"></i> Collect Payment
          </button>
        ` : ''}
      </div>
    </div>`;
  }).join('');
}

export function showAddEventModal() {
  showModal('Book New Event', `
    <div class="form-group">
      <label class="form-label">Customer Name *</label>
      <input class="form-input" id="m-evt-customer" placeholder="e.g. Anita Sharma">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Phone</label>
        <div style="position:relative; display:flex; align-items:center;">
          <input class="form-input" id="m-evt-phone" placeholder="9876543210" style="padding-right:38px;">
          <button type="button" onclick="window.pickContact('m-evt-phone', 'm-evt-customer')" title="Pick from contacts" style="position:absolute; right:6px; background:none; border:none; color:#d97706; cursor:pointer; padding:5px 7px; display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:17px; transition:all 0.15s;" onmouseover="this.style.background='rgba(217,119,6,0.12)'" onmouseout="this.style.background='transparent'">
            <i class="ti ti-address-book"></i>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Event Type</label>
        <select class="form-input form-select" id="m-evt-type">
          <option>Bridal Makeup</option><option>Reception Makeup</option><option>Engagement Makeup</option>
          <option>Baby Shower</option><option>Party Makeup</option><option>Other</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Event Date *</label>
        <input class="form-input" id="m-evt-date" type="date">
      </div>
      <div class="form-group">
        <label class="form-label">Total (₹)</label>
        <input class="form-input" id="m-evt-total" type="number" placeholder="25000">
      </div>
      <div class="form-group">
        <label class="form-label">Advance (₹)</label>
        <input class="form-input" id="m-evt-advance" type="number" placeholder="10000">
      </div>
    </div>
  `, async () => {
    const customer = document.getElementById('m-evt-customer').value.trim();
    if(!customer) { showToast('Please enter customer name','error'); return; }
    
    const phoneInput = document.getElementById('m-evt-phone').value.trim();
    let phoneVal = '';
    if (phoneInput) {
      const cleaned = validateAndCleanPhone(phoneInput);
      if (cleaned === null) {
        showToast('Please enter a valid 10-digit phone number', 'error');
        return;
      }
      phoneVal = cleaned;
    }

    const date = document.getElementById('m-evt-date').value;
    if(!date) { showToast('Please select the event date', 'error'); return; }

    const total = parseInt(document.getElementById('m-evt-total').value) || 0;
    const advance = parseInt(document.getElementById('m-evt-advance').value) || 0;
    await addEvent({
      customer,
      phone: phoneVal,
      type: document.getElementById('m-evt-type').value,
      date: date,
      total, advance,
      pending: total - advance,
      status: advance >= total ? 'Completed' : 'Booked',
      created_at: new Date().toISOString()
    });
    closeModal();
    if (typeof window.render === 'function') window.render();
  });
}

export async function handleDeleteEvent(id) {
  const confirmed = await showConfirmDelete('Delete Event', 'Are you sure you want to delete this event booking? This action cannot be undone.');
  if (!confirmed) return;
  await deleteEvent(id);
  if (typeof window.render === 'function') window.render();
}

export async function analyzeEvents() {
  showModal('Event Bookings AI Analysis', `
    <div class="loading-page" style="height: 180px;">
      <div class="spinner"></div>
      <div style="margin-top:12px;font-weight:500;color:#555;">AI is analyzing event booking trends...</div>
      <div style="font-size:12px;color:#999;margin-top:6px;">Comparing function types, makeup options, and payment collection</div>
    </div>
  `, null);
  
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';

  try {
    const events = await fetchEvents();
    
    if (events.length === 0) {
      document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center;padding:20px;color:#999;">
          <i class="ti ti-calendar-event" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>
          No event bookings found to analyze yet.
        </div>`;
      return;
    }

    // Pre-calculate exact event metrics to prevent LLM bad-math hallucinations
    const eventCount = events.length;
    const totalRevenue = events.reduce((sum, e) => sum + (e.total || 0), 0);
    const totalAdvance = events.reduce((sum, e) => sum + (e.advance || 0), 0);
    const totalPending = events.reduce((sum, e) => sum + (e.pending || 0), 0);

    const resData = await callGroqAPI('chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an elite salon business analyst. Analyze the provided event booking data for Kalai Makeover salon.
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
  * Total Events Booked: ${eventCount}
  * Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}
  * Total Advance Collected: ₹${totalAdvance.toLocaleString('en-IN')}
  * Total Pending Amount: ₹${totalPending.toLocaleString('en-IN')}
  * Total Staff Wages Paid (your expense): ₹${events.reduce((s, e) => { try { const w = typeof e.staff_wages === 'string' ? JSON.parse(e.staff_wages||'[]') : (e.staff_wages||[]); return s + (Array.isArray(w) ? w.reduce((a,b)=>a+(b.amount||0),0) : 0); } catch(err){ return s; } }, 0).toLocaleString('en-IN')}
  Do NOT calculate or estimate these metrics yourself; use the exact values above.

The HTML should contain:
1. Executive Summary: Short overview of event booking performance using the exact metrics.
2. Metric Grid: Styled list or columns showing these exact metrics.
3. Top Function & Makeup Types: Which functions and makeup types are driving the most revenue.
4. Business Growth Tips: Actionable suggestions for Kalai to secure bookings, collect pending payments on time, and promote high-ticket event makeup packages.
Make it concise, insightful, and formatted beautifully.`
        },
        {
          role: 'user',
          content: `Here is the event booking data in JSON format: ${JSON.stringify(events.map(e => {
            let staffWagesData = [];
            try {
              if (e.staff_wages) staffWagesData = typeof e.staff_wages === 'string' ? JSON.parse(e.staff_wages) : e.staff_wages;
            } catch(err) {}
            const totalStaffWages = staffWagesData.reduce((s, w) => s + (w.amount || 0), 0);
            return {
              customer: e.customer,
              type: e.type,
              date: e.date,
              total: e.total,
              advance: e.advance,
              pending: e.pending,
              status: e.status,
              location: e.location,
              makeup_type: e.makeup_type,
              rating: e.rating,
              transport_cost: e.travel_allowance || 0,
              staff_wages_paid: totalStaffWages,
              staff_details: staffWagesData
            };
          }))}`
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

export function openEventCustomerForm(eventId = null, prefillDate = null, defaultFunction = 'Muhurtham', prefillCustomer = null, prefillPhone = null) {
  window._initializingForm = true;
  const today = new Date().toISOString().split('T')[0];
  const isEdit = !!eventId;
  const event = isEdit ? window._cachedEvents?.find(e => e.id === eventId) : null;
  
  const container = document.getElementById('form-overlay-container');
  if (!container) return;

  let baseFee = '';
  if (isEdit && event) {
    let addonTotal = 0;
    if (event.additional_makeup) {
      try {
        const arr = typeof event.additional_makeup === 'string' ? JSON.parse(event.additional_makeup) : event.additional_makeup;
        if (Array.isArray(arr)) {
          arr.forEach(a => addonTotal += a.amount || 0);
        }
      } catch(e) {}
    }
    baseFee = event.total - addonTotal - (event.travel_allowance || 0);
  }

  const hasReferral = isEdit && event && !!event.referred_by;
  const refDisplay = hasReferral ? 'block' : 'none';
  const refChecked = hasReferral ? 'checked' : '';

  container.innerHTML = `
    <div class="form-overlay" onclick="window.closeFormOverlay()">
      <div class="form-panel" onclick="event.stopPropagation()">
        <div class="form-panel-header">
          <h3><i class="ti ti-calendar-heart" style="color:#ec4899"></i> ${isEdit ? 'Edit Event Booking' : 'Event Booking Form'}</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-outline btn-icon" id="form-mic-btn" onclick="window.startVoiceRecording('event')" title="Fill form with voice" style="width:34px; height:34px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; border-color:#e5e5e5; transition: all 0.2s ease;">
              <i class="ti ti-microphone" style="font-size:16px; color:#ec4899;"></i>
            </button>
            <div onclick="window.closeFormOverlay()" style="cursor:pointer;color:#999;font-size:22px;padding:4px;display:flex;align-items:center;"><i class="ti ti-x"></i></div>
          </div>
        </div>
        <div class="form-panel-body" style="max-height:65vh; overflow-y:auto;">
          <div id="form-voice-container"></div>
          <div class="form-section-title" style="border-top:none;margin-top:0;padding-top:0">
            <i class="ti ti-user"></i> Customer Details
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Customer Name *</label>
              <input class="form-input" id="ef-name" value="${isEdit && event ? event.customer : (prefillCustomer || '')}" placeholder="Enter name">
            </div>
            <div class="form-group">
              <label class="form-label">Customer Number *</label>
              <div style="position:relative; display:flex; align-items:center;">
                <input class="form-input" id="ef-phone" value="${isEdit && event ? event.phone : (prefillPhone || '')}" placeholder="10-digit number" maxlength="10" style="padding-right:38px;">
                <button type="button" onclick="window.pickContact('ef-phone', 'ef-name')" title="Pick from contacts" style="position:absolute; right:6px; background:none; border:none; color:#d97706; cursor:pointer; padding:5px 7px; display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:17px; transition:all 0.15s;" onmouseover="this.style.background='rgba(217,119,6,0.12)'" onmouseout="this.style.background='transparent'">
                  <i class="ti ti-address-book"></i>
                </button>
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Location</label>
              <input class="form-input" id="ef-location" value="${isEdit && event ? (event.location || '') : ''}" placeholder="e.g. Chennai">
            </div>
            <div class="form-group" id="ef-main-date-group">
              <label class="form-label">Event Date *</label>
              <input class="form-input" id="ef-date" type="date" value="${isEdit && event ? event.date : (prefillDate || today)}">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 1.5fr;gap:12px;margin-bottom:14px;align-items:center;">
            <div class="form-group" style="margin-bottom:0;display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="ef-referred" ${refChecked} onchange="document.getElementById('ef-referrer-div').style.display = this.checked ? 'block' : 'none'" style="width:16px;height:16px;cursor:pointer;">
              <label for="ef-referred" class="form-label" style="margin-bottom:0;cursor:pointer;font-weight:500;">Came from Referral?</label>
            </div>
            <div class="form-group" id="ef-referrer-div" style="margin-bottom:0;display:${refDisplay};">
              <select class="form-input form-select" id="ef-referrer">
                <option value="Instagram" ${isEdit && event && event.referred_by === 'Instagram' ? 'selected' : ''}>Instagram</option>
                <option value="Relatives" ${isEdit && event && event.referred_by === 'Relatives' ? 'selected' : ''}>Relatives</option>
              </select>
            </div>
          </div>
 
          <div class="form-section-title">
            <i class="ti ti-confetti"></i> Function Type *
          </div>
          <div class="form-group">
            <div class="chip-group" id="ef-function-chips">
              ${['Puberty Function','Baby Shower','Engagement','Reception','Muhurtham','Party Makeup','Others'].map(s =>
                `<div class="chip" onclick="window.eventFunctionChipToggle(this)">${s}</div>`
              ).join('')}
            </div>
            <div class="chip-other-input">
              <input class="form-input" id="ef-function-other" placeholder="Enter function type..." style="margin-top:8px" oninput="window.updateEventFunctionDates()">
            </div>
            <div id="ef-function-dates-container" style="margin-top:12px; display:none;"></div>
          </div>
 
          <div class="form-section-title">
            <i class="ti ti-brush"></i> Makeup Type *
          </div>
          <div class="form-group">
            <div class="chip-group" id="ef-makeup-chips">
              ${[
                ['Basic Makeup', 3000],
                ['HD Makeup', 5000],
                ['Advanced Makeup', 7000],
                ['Airbrush Makeup', 15000],
                ['Glass Skin Makeup', 12000],
                ['Others', 5000]
              ].map(([s, amt]) =>
                `<div class="chip" onclick="window.makeupTypeChipToggle(this, ${amt})">${s}</div>`
              ).join('')}
            </div>
            <div class="chip-other-input">
              <input class="form-input" id="ef-makeup-other" placeholder="Enter makeup type..." style="margin-top:8px">
            </div>
            <div class="service-amount-list" id="ef-makeup-amounts" style="margin-top:8px"></div>
          </div>
 
          <div class="form-section-title">
            <i class="ti ti-user-check"></i> Groom Add-on
            <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap a chip to add Groom makeup detail</span>
          </div>
          <div class="form-group">
            <div class="chip-group" id="ef-groom-chips">
              ${['Face Makeup', 'Hair Set'].map(s =>
                `<div class="chip" onclick="window.eventAddonChipToggle(this, 'groom', 2000)">${s}</div>`
              ).join('')}
            </div>
            <div class="service-amount-list" id="ef-groom-amounts" style="margin-top:8px"></div>
          </div>
 
          <div class="form-section-title">
            <i class="ti ti-users"></i> Bridesmaid Add-on
            <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap a chip to add Bridesmaid makeup detail</span>
          </div>
          <div class="form-group">
            <div class="chip-group" id="ef-bridesmaid-chips">
              ${['Simple Makeup', 'Hair Style', 'Saree Draping'].map(s =>
                `<div class="chip" onclick="window.eventAddonChipToggle(this, 'bridesmaid', 1500)">${s}</div>`
              ).join('')}
            </div>
            <div class="service-amount-list" id="ef-bridesmaid-amounts" style="margin-top:8px"></div>
          </div>
 
          <div class="form-section-title">
            <i class="ti ti-dots-circle-horizontal"></i> Miscellaneous
            <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap a chip to add miscellaneous cost</span>
          </div>
          <div class="form-group">
            <div class="chip-group" id="ef-misc-chips">
              ${['Transport'].map(s =>
                `<div class="chip" onclick="window.eventMiscChipToggle(this, '${s.toLowerCase()}', 200)">${s}</div>`
              ).join('')}
            </div>
            <div class="service-amount-list" id="ef-misc-amounts" style="margin-top:8px"></div>
          </div>
 
          <div class="form-section-title">
            <i class="ti ti-users" style="color:#dc2626"></i> <span style="color:#dc2626">Staff Wages</span>
            <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">My expense — not charged to customer</span>
          </div>
          <div class="form-group" id="ef-staff-wages-container">
            <div id="ef-staff-wages-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
            <button type="button" class="btn btn-outline" onclick="window.addStaffWageRow()" style="font-size:11px; height:30px; padding:0 12px; border-style:dashed; color:#dc2626; border-color:#fca5a5; display:flex; align-items:center; gap:6px; width:fit-content;">
              <i class="ti ti-plus" style="font-size:12px"></i> Add Staff Member
            </button>
          </div>
 
          <div class="form-section-title">
            <i class="ti ti-currency-rupee"></i> Payment Details
          </div>
          <div class="form-group">
            <label class="form-label">Advance Amount (₹)</label>
            <input class="form-input" id="ef-advance" type="number" value="${isEdit && event ? (event.advance || '') : ''}" placeholder="Enter advance paid" oninput="window.updateEventTotalDisplay()">
          </div>
          <input type="hidden" id="ef-amount" value="${baseFee}">
 
          <div id="ef-payment-breakdown" style="margin-top:14px; display:none;"></div>

          <span id="ef-grand-total-amount" style="display:none"></span>
          <span id="ef-pending-amount" style="display:none"></span>
        </div>
        <div class="form-panel-footer">
          <button class="btn btn-outline" onclick="window.closeFormOverlay()"><i class="ti ti-x"></i> Cancel</button>
          <div style="display:flex; gap:8px;">
            ${isEdit ? `<button class="btn" onclick="window.promptEventWhatsAppBillFromId('${eventId}')" style="background:#25d366; color:#fff; border:none; border-radius:8px; padding:8px 14px; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600;" title="Send Invoice via WhatsApp"><i class="ti ti-brand-whatsapp" style="font-size:16px"></i> Send Invoice</button>` : ''}
            <button class="btn btn-gold" onclick="window.submitEventCustomerForm(${isEdit ? `'${eventId}'` : ''})" id="ef-submit-btn"><i class="ti ti-check"></i> ${isEdit ? 'Update Booking' : 'Save Event'}</button>
          </div>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    if (isEdit && event) {
      // Extract metadata if exists
      let functionDates = {};
      let makeupFees = {};
      if (event.additional_makeup) {
        try {
          const arr = typeof event.additional_makeup === 'string' ? JSON.parse(event.additional_makeup) : event.additional_makeup;
          if (Array.isArray(arr)) {
            const dateMeta = arr.find(a => a.name === 'Meta:FunctionDates');
            if (dateMeta && dateMeta.dates) {
              functionDates = dateMeta.dates;
            }
            const feeMeta = arr.find(a => a.name === 'Meta:MakeupFees');
            if (feeMeta && feeMeta.fees) {
              makeupFees = feeMeta.fees;
            }
          }
        } catch(e) {}
      }

      // Pre-fill function chips
      if (event.type) {
        const selectedTypes = event.type.split(',').map(t => t.trim());
        const funcChips = document.querySelectorAll('#ef-function-chips .chip');
        const otherChip = Array.from(funcChips).find(c => c.textContent.trim() === 'Others');
        const otherFuncs = [];

        selectedTypes.forEach(type => {
          const match = Array.from(funcChips).find(c => c.textContent.trim().toLowerCase() === type.toLowerCase());
          if (match) {
            match.classList.add('selected');
          } else {
            otherFuncs.push(type);
          }
        });

        if (otherFuncs.length > 0 && otherChip) {
          otherChip.classList.add('selected');
          const otherDiv = document.getElementById('ef-function-other')?.closest('.chip-other-input');
          if (otherDiv) otherDiv.classList.add('show');
          const otherInput = document.getElementById('ef-function-other');
          if (otherInput) otherInput.value = otherFuncs.join(', ');
        }

        // Trigger dynamic function dates render
        window._editFunctionDates = functionDates;
        window.updateEventFunctionDates();
        delete window._editFunctionDates;
      }

      // Pre-fill makeup chips
      if (event.makeup_type) {
        const selectedMakeups = event.makeup_type.split(',').map(m => m.trim());
        const makeupChips = document.querySelectorAll('#ef-makeup-chips .chip');
        const otherChip = Array.from(makeupChips).find(c => c.textContent.trim() === 'Others');
        const otherMakeups = [];

        window._editMakeupFees = makeupFees;

        selectedMakeups.forEach(mName => {
          const match = Array.from(makeupChips).find(c => c.textContent.trim().toLowerCase() === mName.toLowerCase());
          if (match) {
            const amtMap = {
              'Basic Makeup': 3000,
              'HD Makeup': 5000,
              'Advanced Makeup': 7000,
              'Airbrush Makeup': 15000,
              'Glass Skin Makeup': 12000
            };
            const defaultAmt = amtMap[match.textContent.trim()] || 5000;
            window.makeupTypeChipToggle(match, defaultAmt);
          } else {
            otherMakeups.push(mName);
          }
        });

        if (otherMakeups.length > 0 && otherChip) {
          otherChip.classList.add('selected');
          const otherDiv = document.getElementById('ef-makeup-other')?.closest('.chip-other-input');
          if (otherDiv) otherDiv.classList.add('show');
          const otherInput = document.getElementById('ef-makeup-other');
          if (otherInput) otherInput.value = otherMakeups.join(', ');
          window.makeupTypeChipToggle(otherChip, 5000);
        }

        delete window._editMakeupFees;
      }

      if (event.additional_makeup) {
        try {
          const arr = typeof event.additional_makeup === 'string' ? JSON.parse(event.additional_makeup) : event.additional_makeup;
          if (Array.isArray(arr)) {
            arr.forEach(addon => {
              if (addon.name && addon.name.startsWith('Meta:')) return; // Skip metadata
              
              const isGroom = addon.name.startsWith('Groom:');
              const category = isGroom ? 'groom' : 'bridesmaid';
              const cleanName = addon.name.replace(/^(Groom:|Bridesmaid:)\s*/, '');
              const chipContainerId = isGroom ? 'ef-groom-chips' : 'ef-bridesmaid-chips';
              const chips = document.querySelectorAll(`#${chipContainerId} .chip`);
              const match = Array.from(chips).find(c => c.textContent.trim().toLowerCase() === cleanName.toLowerCase());
              if (match) {
                window.eventAddonChipToggle(match, category, addon.amount);
              }
            });
          }
        } catch(e) {}
      }

      // Pre-fill transport chip if travel_allowance exists
      if (event.travel_allowance > 0) {
        const transportChips = document.querySelectorAll('#ef-misc-chips .chip');
        const transportMatch = Array.from(transportChips).find(c => c.textContent.trim().toLowerCase() === 'transport');
        if (transportMatch) {
          window.eventMiscChipToggle(transportMatch, 'transport', event.travel_allowance);
        }
      }

      // Pre-fill staff wages
      if (event.staff_wages) {
        try {
          const wages = typeof event.staff_wages === 'string' ? JSON.parse(event.staff_wages) : event.staff_wages;
          if (Array.isArray(wages) && wages.length > 0) {
            wages.forEach(w => window.addStaffWageRow(w.name, w.amount));
          }
        } catch(e) {}
      }
    } else if (!isEdit && defaultFunction) {
      // Auto-select Muhurtham / default function chip if booking from auspicious calendar
      const funcChips = document.querySelectorAll('#ef-function-chips .chip');
      const match = Array.from(funcChips).find(c => c.textContent.trim().toLowerCase() === defaultFunction.toLowerCase());
      if (match) {
        match.classList.add('selected');
        if (typeof window.updateEventFunctionDates === 'function') {
          window.updateEventFunctionDates();
        }
      }
    }
    window._initializingForm = false;
    if (typeof window.updateEventTotalDisplay === 'function') window.updateEventTotalDisplay();
  }, 100);
}
 
export async function submitEventCustomerForm(eventId = null) {
  const isEdit = !!eventId;
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { showToast('Please enter customer name', 'error'); return; }
 
  const phoneInput = document.getElementById('ef-phone').value.trim();
  if (!phoneInput) { showToast('Please enter customer phone number', 'error'); return; }
  const phoneVal = validateAndCleanPhone(phoneInput);
  if (phoneVal === null) { showToast('Please enter a valid 10-digit phone number', 'error'); return; }
 
  const functionType = getSelectedChips('ef-function-chips');
  if (!functionType) { showToast('Please select a function type', 'error'); return; }
 
  const makeupType = getSelectedChips('ef-makeup-chips');
  if (!makeupType) { showToast('Please select a makeup type', 'error'); return; }
 
  const total = parseInt(document.getElementById('ef-amount').value) || 0;
  if (!total) { showToast('Please select at least one makeup package with a valid amount', 'error'); return; }
  const advance = parseInt(document.getElementById('ef-advance').value) || 0;
 
  const location = document.getElementById('ef-location').value.trim();
  const isReferred = document.getElementById('ef-referred')?.checked;
  const referredBy = isReferred ? document.getElementById('ef-referrer')?.value.trim() : '';

  // Parse function dates
  const selectedFuncChips = document.querySelectorAll('#ef-function-chips .chip.selected');
  const funcDates = {};
  let primaryDate = '';

  if (selectedFuncChips.length > 1) {
    let missingDate = false;
    document.querySelectorAll('.ef-func-date-row').forEach(row => {
      const funcName = row.dataset.function;
      const dateVal = row.querySelector('input[type="date"]').value;
      if (!dateVal) {
        missingDate = true;
      } else {
        funcDates[funcName] = dateVal;
      }
    });

    if (missingDate) {
      showToast('Please specify a date for all selected functions', 'error');
      return;
    }

    const sortedDates = Object.values(funcDates).sort();
    primaryDate = sortedDates[0];
  } else {
    primaryDate = document.getElementById('ef-date').value;
    if (!primaryDate) {
      showToast('Please select the event date', 'error');
      return;
    }
    const singleFunc = getSelectedChips('ef-function-chips');
    funcDates[singleFunc] = primaryDate;
  }
 
  // Parse makeup fees
  const makeupFees = {};
  const makeupRows = document.querySelectorAll('#ef-makeup-amounts .service-amount-row[data-category="makeup"]');
  makeupRows.forEach(r => {
    const nameInput = r.querySelector('.sa-name-input');
    const nameLabel = nameInput ? nameInput.value.trim() : r.dataset.label;
    const amt = parseInt(r.querySelector('.ef-makeup-amount-input')?.value) || 0;
    if (nameLabel) {
      makeupFees[nameLabel] = amt;
    }
  });

  // Parse event add-on amounts (Groom, Bridesmaid)
  const addons = [];
  let addonTotal = 0;
  const addonRows = document.querySelectorAll('#ef-groom-amounts .service-amount-row, #ef-bridesmaid-amounts .service-amount-row');
  addonRows.forEach(r => {
    const nameInput = r.querySelector('.sa-name-input');
    let nameLabel = nameInput ? nameInput.value.trim() : r.dataset.label;
    const prefix = r.dataset.category === 'groom' ? 'Groom: ' : 'Bridesmaid: ';
    if (nameLabel && !nameLabel.startsWith('Groom:') && !nameLabel.startsWith('Bridesmaid:')) {
      nameLabel = prefix + nameLabel;
    }
    const amt = parseInt(r.querySelector('.ef-addon-amount-input')?.value) || 0;
    if (nameLabel) {
      addons.push({ name: nameLabel, amount: amt });
      addonTotal += amt;
    }
  });

  // Parse misc amounts (transport etc)
  const miscRows = document.querySelectorAll('#ef-misc-amounts .service-amount-row');
  let travelAllowance = 0;
  miscRows.forEach(r => {
    travelAllowance += parseInt(r.querySelector('.ef-addon-amount-input')?.value) || 0;
  });

  // Parse staff wages (my expense)
  const staffWages = [];
  document.querySelectorAll('#ef-staff-wages-list .ef-staff-wage-row').forEach(r => {
    const nameVal = r.querySelector('.ef-staff-name-input')?.value.trim();
    const amtVal = parseInt(r.querySelector('.ef-staff-amount-input')?.value) || 0;
    if (nameVal && amtVal > 0) {
      staffWages.push({ name: nameVal, amount: amtVal });
    }
  });

  const grandTotal = total + addonTotal + travelAllowance;

  // Add meta entries for multiple functions and makeups to addons
  addons.push({ name: 'Meta:FunctionDates', dates: funcDates, amount: 0 });
  addons.push({ name: 'Meta:MakeupFees', fees: makeupFees, amount: 0 });

  const btn = document.getElementById('ef-submit-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...'; }
 
  const result = isEdit
    ? await updateEvent(eventId, {
        customer: name,
        phone: phoneVal,
        type: functionType || 'Event',
        date: primaryDate,
        total: grandTotal,
        advance: advance,
        pending: grandTotal - advance,
        status: advance >= grandTotal ? 'Completed' : 'Booked',
        location: location,
        makeup_type: makeupType,
        additional_makeup: JSON.stringify(addons),
        travel_allowance: travelAllowance,
        staff_wages: staffWages.length > 0 ? JSON.stringify(staffWages) : null,
        referred_by: referredBy || null
      })
    : await addEvent({
        customer: name,
        phone: phoneVal,
        type: functionType || 'Event',
        date: primaryDate,
        total: grandTotal,
        advance: advance,
        pending: grandTotal - advance,
        status: advance >= grandTotal ? 'Completed' : 'Booked',
        location: location,
        makeup_type: makeupType,
        additional_makeup: JSON.stringify(addons),
        travel_allowance: travelAllowance,
        staff_wages: staffWages.length > 0 ? JSON.stringify(staffWages) : null,
        rating: 5,
        referred_by: referredBy || null,
        created_at: new Date().toISOString()
      });
 
  if (result) {
    closeFormOverlay();
    let summary = `Function: ${functionType || 'N/A'} · Makeup: ${makeupType || 'N/A'} · Total: ₹${grandTotal.toLocaleString()} · Advance: ₹${advance.toLocaleString()}`;
    if (travelAllowance > 0) {
      summary += ` · Transport: ₹${travelAllowance.toLocaleString()}`;
    }
    const displayAddons = addons.filter(a => !a.name.startsWith('Meta:'));
    if (displayAddons.length > 0) {
      summary += `<br><span style="font-size:11px;color:#7c3aed;"><strong>Add-ons:</strong> ${displayAddons.map(a => `${a.name} (₹${a.amount.toLocaleString()})`).join(', ')}</span>`;
    }
    state.chatMessages.push({
      role: 'ai',
      text: `✅ <strong>${name}</strong> event ${isEdit ? 'updated' : 'saved'}! 🎉<br><span style="font-size:11px;color:#888">${summary}</span>`
    });
    if (typeof window.render === 'function') window.render();
    
    // Automatically open WhatsApp invoice sender modal
    setTimeout(() => {
      promptEventWhatsAppBill(result);
    }, 150);
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = isEdit ? '<i class="ti-check"></i> Update Booking' : '<i class="ti ti-check"></i> Save Event'; }
  }
}

export function eventAddonChipToggle(chipEl, category, defaultAmount) {
  const name = chipEl.textContent.trim();
  chipEl.classList.toggle('selected');
  
  const containerId = category === 'groom' ? 'ef-groom-amounts' : 'ef-bridesmaid-amounts';
  const amountList = document.getElementById(containerId);
  if (!amountList) return;

  const rowId = 'ef-addon-row-' + category + '-' + name.replace(/\s+/g, '-').toLowerCase();

  if (chipEl.classList.contains('selected')) {
    if (!document.getElementById(rowId)) {
      const row = document.createElement('div');
      row.className = 'service-amount-row';
      row.id = rowId;
      row.dataset.name = name;
      row.dataset.category = category;
      row.dataset.label = (category === 'groom' ? 'Groom' : 'Bridesmaid') + ': ' + name;
      
      row.innerHTML = `
        <div class="sa-name"><i class="ti ti-sparkles"></i><input type="text" class="sa-name-input" value="${name}"></div>
        <span style="font-size:12px;color:#888">₹</span>
        <input type="number" class="ef-addon-amount-input" value="${defaultAmount}" oninput="window.updateEventTotalDisplay()" style="width: 80px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
        <div class="sa-remove" onclick="window.removeEventAddonRow('${rowId}', '${category}', '${name}')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
      amountList.appendChild(row);
    }
  } else {
    const row = document.getElementById(rowId);
    if (row) row.remove();
  }
  updateEventTotalDisplay();
}

export function removeEventAddonRow(rowId, category, name) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  
  const chipContainerId = category === 'groom' ? 'ef-groom-chips' : 'ef-bridesmaid-chips';
  const chips = document.querySelectorAll(`#${chipContainerId} .chip`);
  chips.forEach(c => { if (c.textContent.trim() === name) c.classList.remove('selected'); });
  
  updateEventTotalDisplay();
}

export function updateEventTotalDisplay() {
  let baseAmount = 0;
  const makeupRows = document.querySelectorAll('#ef-makeup-amounts .service-amount-row[data-category="makeup"]');
  makeupRows.forEach(r => {
    baseAmount += parseInt(r.querySelector('.ef-makeup-amount-input')?.value) || 0;
  });

  const baseInput = document.getElementById('ef-amount');
  if (baseInput) {
    baseInput.value = baseAmount;
  }

  const addonRows = document.querySelectorAll('#ef-groom-amounts .service-amount-row, #ef-bridesmaid-amounts .service-amount-row');
  
  let addonTotal = 0;
  addonRows.forEach(r => {
    addonTotal += parseInt(r.querySelector('.ef-addon-amount-input')?.value) || 0;
  });

  // Sum misc amounts (transport etc)
  const miscRows = document.querySelectorAll('#ef-misc-amounts .service-amount-row');
  let miscTotal = 0;
  miscRows.forEach(r => {
    miscTotal += parseInt(r.querySelector('.ef-addon-amount-input')?.value) || 0;
  });

  const grandTotal = baseAmount + addonTotal + miscTotal;
  const advance = parseInt(document.getElementById('ef-advance')?.value) || 0;
  const pending = grandTotal - advance;

  const totalEl = document.getElementById('ef-grand-total-amount');
  if (totalEl) totalEl.textContent = '₹' + grandTotal.toLocaleString();
  
  const pendingEl = document.getElementById('ef-pending-amount');
  if (pendingEl) {
    pendingEl.textContent = '₹' + pending.toLocaleString();
    pendingEl.style.color = pending > 0 ? '#dc2626' : '#15803d';
  }
  
  const bar = document.getElementById('ef-grand-total-bar');
  if (bar) bar.style.display = 'flex';

  // Render live payment breakdown summary
  const breakdownEl = document.getElementById('ef-payment-breakdown');
  if (breakdownEl) {
    if (baseAmount > 0 || addonTotal > 0 || miscTotal > 0) {
      let breakdownHtml = `
        <div style="background:#fffdf5; border:1px solid #fde68a; border-radius:10px; padding:14px; font-size:12px; color:#555; font-family:'DM Sans', sans-serif;">
          <div style="font-weight:600; color:#b45309; margin-bottom:8px; border-bottom:1px solid #fde68a; padding-bottom:6px; font-size:13px; display:flex; align-items:center; gap:6px;">
            <i class="ti ti-receipt" style="font-size:15px"></i> Billing Invoice Summary
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
      `;
      
      // 1. Base makeup
      const addedMakeups = [];
      makeupRows.forEach(r => {
        const nameInput = r.querySelector('.sa-name-input');
        const nameLabel = nameInput ? nameInput.value.trim() : r.dataset.label;
        const amt = parseInt(r.querySelector('.ef-makeup-amount-input')?.value) || 0;
        if (nameLabel && amt > 0) {
          addedMakeups.push({ name: nameLabel, amount: amt });
        }
      });

      if (addedMakeups.length > 0) {
        addedMakeups.forEach(m => {
          breakdownHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
              <span>✨ Bride ${m.name}</span>
              <span style="font-weight:600; color:#1a1a1a;">₹${m.amount.toLocaleString()}</span>
            </div>
          `;
        });
      }

      // 2. Add-ons
      const addedAddons = [];
      addonRows.forEach(r => {
        if (r.dataset.category !== 'makeup') {
          const nameInput = r.querySelector('.sa-name-input');
          const nameLabel = nameInput ? nameInput.value.trim() : r.dataset.label;
          const amt = parseInt(r.querySelector('.ef-addon-amount-input')?.value) || 0;
          if (nameLabel && amt > 0) {
            addedAddons.push({ name: nameLabel, amount: amt });
          }
        }
      });

      if (addedAddons.length > 0) {
        breakdownHtml += `
          <div style="font-weight:600; color:#888; font-size:10px; text-transform:uppercase; margin-top:4px; letter-spacing:0.04em;">Add-ons</div>
        `;
        addedAddons.forEach(a => {
          breakdownHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-left:6px;">
              <span>• ${a.name}</span>
              <span style="font-weight:600; color:#1a1a1a;">₹${a.amount.toLocaleString()}</span>
            </div>
          `;
        });
      }

      // 3. Miscellaneous (Transport etc)
      const addedMisc = [];
      miscRows.forEach(r => {
        const nameInput = r.querySelector('.sa-name-input');
        const nameLabel = nameInput ? nameInput.value.trim() : r.dataset.label;
        const amt = parseInt(r.querySelector('.ef-addon-amount-input')?.value) || 0;
        if (nameLabel && amt > 0) {
          addedMisc.push({ name: nameLabel, amount: amt });
        }
      });

      if (addedMisc.length > 0) {
        breakdownHtml += `
          <div style="font-weight:600; color:#888; font-size:10px; text-transform:uppercase; margin-top:4px; letter-spacing:0.04em;">Miscellaneous</div>
        `;
        addedMisc.forEach(a => {
          breakdownHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-left:6px;">
              <span>🚗 ${a.name}</span>
              <span style="font-weight:600; color:#1a1a1a;">₹${a.amount.toLocaleString()}</span>
            </div>
          `;
        });
      }

      // 4. Totals and pending
      breakdownHtml += `
            <div style="border-top:1px solid #fde68a; margin-top:8px; padding-top:8px; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%; font-weight:600; color:#d97706; font-size:13px;">
                <span>Total Amount</span>
                <span>₹${grandTotal.toLocaleString()}</span>
              </div>
      `;

      if (advance > 0) {
        breakdownHtml += `
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%; color:#15803d; font-weight:500;">
                <span>Advance Paid</span>
                <span>- ₹${advance.toLocaleString()}</span>
              </div>
        `;
      }

      breakdownHtml += `
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%; font-weight:600; color:${pending > 0 ? '#dc2626' : '#15803d'};">
                <span>Pending Amount</span>
                <span>₹${pending.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      `;

      breakdownEl.innerHTML = breakdownHtml;
      breakdownEl.style.display = 'block';
    } else {
      breakdownEl.innerHTML = '';
      breakdownEl.style.display = 'none';
    }
  }
}

export function makeupTypeChipToggle(chipEl, defaultAmount) {
  const name = chipEl.textContent.trim();
  chipEl.classList.toggle('selected');
  
  const amountList = document.getElementById('ef-makeup-amounts');
  if (!amountList) return;

  const rowId = 'ef-addon-row-makeup-' + name.replace(/\s+/g, '-').toLowerCase();

  if (name === 'Others') {
    const otherInput = chipEl.closest('.form-group').querySelector('.chip-other-input');
    if (chipEl.classList.contains('selected')) {
      if (otherInput) otherInput.classList.add('show');
      if (!document.getElementById(rowId)) {
        const row = document.createElement('div');
        row.className = 'service-amount-row';
        row.id = rowId;
        row.dataset.name = 'Others';
        row.dataset.category = 'makeup';
        row.dataset.label = 'Others';
        
        const savedFee = window._editMakeupFees?.['Others'] || defaultAmount;

        row.innerHTML = `
          <div class="sa-name"><i class="ti ti-sparkles"></i><input type="text" class="sa-name-input" id="ef-makeup-other-label" value="Other Makeup" oninput="window.updateEventTotalDisplay()"></div>
          <span style="font-size:12px;color:#888">₹</span>
          <input type="number" class="ef-makeup-amount-input" value="${savedFee}" oninput="window.updateEventTotalDisplay()" style="width: 80px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
          <div class="sa-remove" onclick="window.removeMakeupRow('${rowId}', '${name}')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
        amountList.appendChild(row);
      }
    } else {
      if (otherInput) otherInput.classList.remove('show');
      const row = document.getElementById(rowId);
      if (row) row.remove();
    }
  } else {
    if (chipEl.classList.contains('selected')) {
      if (!document.getElementById(rowId)) {
        const row = document.createElement('div');
        row.className = 'service-amount-row';
        row.id = rowId;
        row.dataset.name = name;
        row.dataset.category = 'makeup';
        row.dataset.label = name;
        
        const savedFee = window._editMakeupFees?.[name] || defaultAmount;

        row.innerHTML = `
          <div class="sa-name"><i class="ti ti-sparkles"></i><input type="text" class="sa-name-input" value="${name}"></div>
          <span style="font-size:12px;color:#888">₹</span>
          <input type="number" class="ef-makeup-amount-input" value="${savedFee}" oninput="window.updateEventTotalDisplay()" style="width: 80px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
          <div class="sa-remove" onclick="window.removeMakeupRow('${rowId}', '${name}')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
        amountList.appendChild(row);
      }
    } else {
      const row = document.getElementById(rowId);
      if (row) row.remove();
    }
  }
  updateEventTotalDisplay();
}

export function removeMakeupRow(rowId, name) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  
  const chips = document.querySelectorAll('#ef-makeup-chips .chip');
  chips.forEach(c => { if (c.textContent.trim() === name) c.classList.remove('selected'); });
  
  if (name === 'Others') {
    const otherInput = document.querySelector('#ef-makeup-chips').closest('.form-group').querySelector('.chip-other-input');
    if (otherInput) otherInput.classList.remove('show');
  }
  
  updateEventTotalDisplay();
}

export async function openEventCollectPaymentModal(eventId) {
  const event = (window._cachedEvents || []).find(e => e.id === eventId);
  if (!event) return;

  const pending = event.pending || 0;
  const today = new Date().toISOString().split('T')[0];

  showModal(`Collect Pending Payment`, `
    <div style="font-size:13px; color:#555; margin-bottom:14px;">
      Log payment for <strong>${event.customer}</strong> (${event.type}).
      <br><span style="font-size:11px; color:#999;">Outstanding Balance: ₹${pending.toLocaleString('en-IN')}</span>
    </div>
    <div class="form-group">
      <label class="form-label">Amount (₹) *</label>
      <input class="form-input" id="m-evt-pay-amount" type="number" value="${pending}" max="${pending}">
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Payment Date</label>
        <input class="form-input" id="m-evt-pay-date" type="date" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">Method</label>
        <select class="form-input form-select" id="m-evt-pay-method" onchange="window.handleEventPaymentMethodChange(this)">
          <option value="Cash">Cash</option>
          <option value="GPay">GPay</option>
          <option value="Both">Both</option>
        </select>
      </div>
    </div>
    <div id="m-evt-pay-both-container" style="display:none; margin-bottom:14px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">Cash Portion (₹) *</label>
          <input class="form-input" id="m-evt-pay-both-cash" type="number" placeholder="Cash amount" oninput="window.updateEventPaymentBothTotal()">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">GPay Portion (₹) *</label>
          <input class="form-input" id="m-evt-pay-both-gpay" type="number" placeholder="GPay amount" oninput="window.updateEventPaymentBothTotal()">
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Note / Reference</label>
      <input class="form-input" id="m-evt-pay-note" placeholder="e.g. Final payment, GPay transaction ID">
    </div>
  `, async () => {
    const amtVal = parseInt(document.getElementById('m-evt-pay-amount').value) || 0;
    if (amtVal <= 0) { showToast('Please enter a valid amount', 'error'); return; }
    if (amtVal > pending) { showToast('Amount cannot exceed outstanding balance', 'error'); return; }

    const dateVal = document.getElementById('m-evt-pay-date').value || today;
    const methodVal = document.getElementById('m-evt-pay-method').value;
    const notePrefix = document.getElementById('m-evt-pay-note').value.trim() || 'Payment';
    let noteVal = notePrefix;

    if (methodVal === 'Both') {
      const cashPortion = parseInt(document.getElementById('m-evt-pay-both-cash').value) || 0;
      const gpayPortion = parseInt(document.getElementById('m-evt-pay-both-gpay').value) || 0;
      if (cashPortion <= 0 || gpayPortion <= 0) {
        showToast('Please enter both Cash and GPay portion amounts', 'error');
        return;
      }
      if (cashPortion + gpayPortion !== amtVal) {
        showToast(`Sum of Cash (₹${cashPortion}) & GPay (₹${gpayPortion}) must equal payment amount (₹${amtVal})`, 'error');
        return;
      }
      noteVal = `${notePrefix} (Cash: ₹${cashPortion}, GPay: ₹${gpayPortion})`;
    }

    const nextAdvance = (event.advance || 0) + amtVal;
    const nextPending = Math.max(0, (event.total || 0) - nextAdvance);
    const nextStatus = nextAdvance >= (event.total || 0) ? 'Completed' : 'Booked';

    const success = await updateEvent(eventId, {
      ...event,
      advance: nextAdvance,
      pending: nextPending,
      status: nextStatus
    });

    if (success) {
      closeModal();
      showToast('Payment recorded successfully!');
      if (typeof window.render === 'function') window.render();
      
      // Prompt for invoice WhatsApp message
      if (event.phone) {
        setTimeout(() => {
          promptEventWhatsAppBill({
            ...event,
            advance: nextAdvance,
            pending: nextPending,
            status: nextStatus
          });
        }, 500);
      }
    }
  });
}

export function handleEventPaymentMethodChange(selectEl) {
  const container = document.getElementById('m-evt-pay-both-container');
  const amountInput = document.getElementById('m-evt-pay-amount');
  if (!container || !amountInput) return;

  if (selectEl.value === 'Both') {
    container.style.display = 'block';
    amountInput.readOnly = true;

    const currentVal = parseInt(amountInput.value) || 0;
    const half = Math.round(currentVal / 2);
    const cashEl = document.getElementById('m-evt-pay-both-cash');
    const gpayEl = document.getElementById('m-evt-pay-both-gpay');
    if (cashEl) cashEl.value = half;
    if (gpayEl) gpayEl.value = currentVal - half;
  } else {
    container.style.display = 'none';
    amountInput.readOnly = false;
  }
}

export function updateEventPaymentBothTotal() {
  const cash = parseInt(document.getElementById('m-evt-pay-both-cash').value) || 0;
  const gpay = parseInt(document.getElementById('m-evt-pay-both-gpay').value) || 0;
  const amountInput = document.getElementById('m-evt-pay-amount');
  if (amountInput) {
    amountInput.value = cash + gpay;
  }
}

// Bind to window to allow HTML inline click handlers to execute
window.openEventCustomerForm = openEventCustomerForm;
window.submitEventCustomerForm = submitEventCustomerForm;
window.filterEvents = renderEvents; // Backwards compatible filter mapping if used
window.analyzeEvents = analyzeEvents;
window.showAddEventModal = showAddEventModal;
window.handleDeleteEvent = handleDeleteEvent;
window.eventFunctionChipToggle = eventFunctionChipToggle;
window.updateEventFunctionDates = updateEventFunctionDates;
window.filterEventCustomers = filterEventCustomers;
window.filterEventByMonth = filterEventByMonth;
window.toggleEventMonthFilter = toggleEventMonthFilter;
window.toggleEventSearchField = toggleEventSearchField;
window.applyEventFilters = applyEventFilters;
window.renderEventMetrics = renderEventMetrics;
window.renderEventList = renderEventList;
window.eventAddonChipToggle = eventAddonChipToggle;
window.removeEventAddonRow = removeEventAddonRow;
window.updateEventTotalDisplay = updateEventTotalDisplay;
window.makeupTypeChipToggle = makeupTypeChipToggle;
window.removeMakeupRow = removeMakeupRow;
window.openEventCollectPaymentModal = openEventCollectPaymentModal;
window.handleEventPaymentMethodChange = handleEventPaymentMethodChange;
window.updateEventPaymentBothTotal = updateEventPaymentBothTotal;
window.promptEventWhatsAppBill = promptEventWhatsAppBill;
window.promptEventWhatsAppBillFromId = promptEventWhatsAppBillFromId;
window.eventMiscChipToggle = eventMiscChipToggle;
window.removeMiscRow = removeMiscRow;
window.addStaffWageRow = addStaffWageRow;
window.removeStaffWageRow = removeStaffWageRow;
window.quickEditTransport = quickEditTransport;
window.filterEventsStatus = filterEventsStatus;

export function filterEventsStatus(status) {
  window._eventStatusFilter = status;
  if (typeof window.render === 'function') window.render();
}

export function eventMiscChipToggle(chipEl, type, defaultAmount) {
  const name = chipEl.textContent.trim();
  chipEl.classList.toggle('selected');

  const rowId = 'ef-misc-row-' + type;
  const amountList = document.getElementById('ef-misc-amounts');
  if (!amountList) return;

  if (chipEl.classList.contains('selected')) {
    if (!document.getElementById(rowId)) {
      const row = document.createElement('div');
      row.className = 'service-amount-row';
      row.id = rowId;
      row.dataset.name = name;
      row.dataset.category = 'misc';
      row.dataset.label = name;

      row.innerHTML = `
        <div class="sa-name"><i class="ti ti-sparkles"></i><input type="text" class="sa-name-input" value="${name}"></div>
        <span style="font-size:12px;color:#888">₹</span>
        <input type="number" class="ef-addon-amount-input" value="${defaultAmount}" oninput="window.updateEventTotalDisplay()" style="width: 80px; padding: 4px 6px; font-size: 12px; height: 32px; border: 1px solid #ddd; border-radius: 6px;">
        <div class="sa-remove" onclick="window.removeMiscRow('${rowId}', '${name}')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
      amountList.appendChild(row);
    }
  } else {
    const row = document.getElementById(rowId);
    if (row) row.remove();
  }
  updateEventTotalDisplay();
}

export function removeMiscRow(rowId, name) {
  const row = document.getElementById(rowId);
  if (row) row.remove();

  const chips = document.querySelectorAll('#ef-misc-chips .chip');
  chips.forEach(c => { if (c.textContent.trim() === name) c.classList.remove('selected'); });

  updateEventTotalDisplay();
}

// ─── Staff Wages ──────────────────────────────────────────────────────────────

export function addStaffWageRow(defaultName = '', defaultAmount = 500) {
  const list = document.getElementById('ef-staff-wages-list');
  if (!list) return;

  const rowId = 'ef-staff-wage-row-' + Date.now();
  const row = document.createElement('div');
  row.className = 'service-amount-row ef-staff-wage-row';
  row.id = rowId;
  row.style.cssText = 'background:#fff5f5; border: 1px solid #fca5a5; border-radius:8px; padding:8px 10px;';
  row.innerHTML = `
    <div class="sa-name" style="color:#dc2626">
      <i class="ti ti-user" style="color:#dc2626"></i>
      <input type="text" class="sa-name-input ef-staff-name-input" value="${defaultName}" placeholder="Staff name" style="color:#1a1a1a;">
    </div>
    <span style="font-size:12px;color:#dc2626">₹</span>
    <input type="number" class="ef-staff-amount-input" value="${defaultAmount}" placeholder="Amount" style="width:80px; padding:4px 6px; font-size:12px; height:32px; border:1px solid #fca5a5; border-radius:6px;">
    <div class="sa-remove" onclick="window.removeStaffWageRow('${rowId}')" title="Remove" style="color:#dc2626">
      <i class="ti ti-x" style="font-size:14px"></i>
    </div>
  `;
  list.appendChild(row);
}

export function removeStaffWageRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

// ─── Quick Edit Transport ─────────────────────────────────────────────────────

export function quickEditTransport(eventId) {
  const event = (window._cachedEvents || []).find(e => e.id === eventId);
  if (!event) return;

  const { showModal, closeModal } = window._uiHelpers || {};
  import('../ui.js').then(({ showModal, closeModal }) => {
    showModal('Edit Transport Cost', `
      <div style="font-size:13px; color:#555; margin-bottom:14px;">
        Update transport cost for <strong>${event.customer}</strong> (${event.type}).
      </div>
      <div class="form-group">
        <label class="form-label">Transport Amount (₹)</label>
        <input class="form-input" id="m-transport-amount" type="number" value="${event.travel_allowance || 0}" placeholder="e.g. 500">
      </div>
    `, async () => {
      const newTransport = parseInt(document.getElementById('m-transport-amount').value) || 0;
      const oldTransport = event.travel_allowance || 0;
      const diff = newTransport - oldTransport;
      const newTotal = (event.total || 0) + diff;
      const newPending = Math.max(0, newTotal - (event.advance || 0));

      const { updateEvent } = await import('../db.js');
      const { showToast } = await import('../ui.js');
      const success = await updateEvent(eventId, {
        ...event,
        travel_allowance: newTransport,
        total: newTotal,
        pending: newPending,
        status: (event.advance || 0) >= newTotal ? 'Completed' : event.status
      });

      if (success) {
        closeModal();
        showToast('Transport cost updated!');
        if (typeof window.render === 'function') window.render();
      }
    });
  });
}

export function promptEventWhatsAppBill(event) {
  const customerName = event.customer;
  const phone = event.phone;
  const cleanedPhone = validateAndCleanPhone(phone);
  if (!cleanedPhone) {
    showToast('Invalid phone number for sending bill.', 'error');
    return;
  }

  let addons = [];
  try {
    addons = typeof event.additional_makeup === 'string' ? JSON.parse(event.additional_makeup) : event.additional_makeup;
  } catch(e) {}
  if (!Array.isArray(addons)) addons = [];

  let addonTotal = 0;
  addons.forEach(a => addonTotal += a.amount || 0);
  const baseMakeupFee = event.total - addonTotal - (event.travel_allowance || 0);

  let itemsText = ``;
  if (event.makeup_type && event.makeup_type !== 'Others') {
    itemsText += `• ${event.makeup_type}: ₹${baseMakeupFee.toLocaleString()}\n`;
  }
  
  addons.forEach(a => {
    itemsText += `• ${a.name}: ₹${a.amount.toLocaleString()}\n`;
  });

  if (event.travel_allowance > 0) {
    itemsText += `• Transportation: ₹${event.travel_allowance.toLocaleString()}\n`;
  }

  const defaultMessage = `✨ KALAI MAKEOVER — EVENT BOOKING INVOICE ✨

Hello ${customerName},

Thanks for booking Kalai Makeover! We will give our best service on your special occasion. 🎉

Event details:
• Function: ${event.type}
• Event Date: ${event.date ? new Date(event.date).toLocaleDateString('en-IN') : 'N/A'}

Cost breakdown:
${itemsText}
----------------------------------
💰 Total Amount: ₹${(event.total || 0).toLocaleString()}
💳 Advance Paid: ₹${(event.advance || 0).toLocaleString()}
⚠️ Pending Balance: ₹${(event.pending || 0).toLocaleString()}

We look forward to making your day extra special!

Thank you,
Kalai Makeover
📞 8870236006`;

  showModal('Send Booking Invoice via WhatsApp', `
    <div style="font-size:13px;color:#555;margin-bottom:14px">
      Review and customize the invoice message for <strong>${customerName}</strong> (${phone}):
    </div>
    <div class="form-group">
      <label class="form-label">WhatsApp Message Preview</label>
      <textarea class="form-input" id="wa-event-message" style="height:250px;font-family:monospace;white-space:pre-wrap;resize:vertical;line-height:1.4;">${defaultMessage}</textarea>
    </div>
  `, () => {
    const editedMessage = document.getElementById('wa-event-message').value.trim();
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

  setTimeout(() => {
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="ti ti-brand-whatsapp"></i> Send Invoice';
      saveBtn.style.background = '#25d366';
      saveBtn.style.borderColor = '#25d366';
      saveBtn.style.color = '#fff';
    }
  }, 50);
}

export function promptEventWhatsAppBillFromId(eventId) {
  const event = (window._cachedEvents || []).find(e => e.id === eventId);
  if (!event) {
    showToast('Event not found.', 'error');
    return;
  }
  promptEventWhatsAppBill(event);
}

export function eventFunctionChipToggle(chipEl) {
  const name = chipEl.textContent.trim();
  chipEl.classList.toggle('selected');

  if (name === 'Others') {
    const otherInput = chipEl.closest('.form-group').querySelector('.chip-other-input');
    if (chipEl.classList.contains('selected')) {
      if (otherInput) otherInput.classList.add('show');
    } else {
      if (otherInput) otherInput.classList.remove('show');
    }
  }

  updateEventFunctionDates();
}

export function updateEventFunctionDates() {
  const container = document.getElementById('ef-function-dates-container');
  const mainDateGroup = document.getElementById('ef-main-date-group');
  if (!container) return;

  // 1. Read currently entered dates from the container to preserve them
  const currentDates = {};
  container.querySelectorAll('.ef-func-date-row').forEach(row => {
    const funcName = row.dataset.function;
    const dateVal = row.querySelector('input[type="date"]').value;
    if (funcName && dateVal) {
      currentDates[funcName] = dateVal;
    }
  });

  // 2. Get list of selected functions
  const selectedFuncs = [];
  document.querySelectorAll('#ef-function-chips .chip.selected').forEach(c => {
    const text = c.textContent.trim();
    if (text === 'Others') {
      const otherVal = document.getElementById('ef-function-other')?.value.trim();
      if (otherVal) selectedFuncs.push(otherVal);
    } else {
      selectedFuncs.push(text);
    }
  });

  // 3. Determine if we have multiple functions
  if (selectedFuncs.length > 1) {
    // Hide main date group
    if (mainDateGroup) mainDateGroup.style.display = 'none';

    // Build sub-date fields
    const today = new Date().toISOString().split('T')[0];
    let html = `
      <div style="font-size: 11px; font-weight: 600; color: #b45309; background: #fffdf5; padding: 10px 14px; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 8px; display:flex; align-items:center; gap:6px;">
        <i class="ti ti-calendar-event" style="font-size:14px"></i> Specify separate dates for each function:
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    `;

    // Retrieve any pre-filled or preserved dates
    const preservedDates = window._editFunctionDates || currentDates;

    selectedFuncs.forEach(func => {
      const mainDateVal = document.getElementById('ef-date')?.value;
      const dateValue = preservedDates[func] || mainDateVal || today;
      html += `
        <div class="form-group ef-func-date-row" data-function="${func}" style="margin-bottom: 8px;">
          <label class="form-label" style="font-weight: 500; font-size:12px;">${func} Date *</label>
          <input class="form-input" type="date" value="${dateValue}">
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
    container.style.display = 'block';
  } else {
    // Show main date group
    if (mainDateGroup) mainDateGroup.style.display = 'block';
    
    // Hide container
    container.innerHTML = '';
    container.style.display = 'none';
    
    // Update main date label if exactly one function is selected
    const label = mainDateGroup.querySelector('.form-label');
    if (label) {
      if (selectedFuncs.length === 1) {
        label.textContent = `${selectedFuncs[0]} Date *`;
      } else {
        label.textContent = 'Event Date *';
      }
    }
  }
}

// ─────────────────────────────────────────────
// EVENT ANALYTICS & INSIGHTS DASHBOARD
// ─────────────────────────────────────────────

export function switchEventTab(tab) {
  if (tab === 'directory') tab = 'history';
  window._eventActiveTab = tab;
  if (tab === 'analytics' && (window._eventAnalyticsSubTab === 'overview' || !window._eventAnalyticsSubTab)) {
    setTimeout(() => {
      initEventAnalyticsCharts(window._cachedFilteredEvents || window._cachedEvents || []);
    }, 60);
  }
  if (typeof window.render === 'function') window.render();
}

export function filterEventByMonthSelect(val) {
  window._selectedEventMonth = val === 'all' ? 'all' : parseInt(val, 10);
  if (typeof window.render === 'function') window.render();
}

export function switchEventAnalyticsSubTab(subTab) {
  window._eventAnalyticsSubTab = subTab;
  if (subTab === 'overview') {
    setTimeout(() => {
      initEventAnalyticsCharts(window._cachedFilteredEvents || window._cachedEvents || []);
    }, 60);
  }
  if (typeof window.render === 'function') window.render();
}

export function switchEventHistorySubTab(subTab) {
  window._eventHistorySubTab = subTab;
  if (typeof window.render === 'function') window.render();
}

export function filterCrossoverSearch(q) {
  window._crossoverSearchQuery = q;
  const container = document.getElementById('crossover-client-list-container');
  if (container) {
    const clients = window._cachedCrossoverClients || [];
    container.innerHTML = renderCrossoverClientCards(clients, q);
  }
}

// Algorithm to identify clients who have booked both an event and visited as a customer in the shop
export function getCrossOverCustomers(events = window._cachedEvents || [], customers = window._cachedCustomers || []) {
  if (!events || !events.length || !customers || !customers.length) return [];

  function normalizePhone(p) {
    if (!p) return '';
    const digits = String(p).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }

  function normalizeName(n) {
    if (!n) return '';
    return String(n).toLowerCase().replace(/^(mrs\.|ms\.|mr\.|dr\.)\s*/i, '').replace(/[^a-z0-9]/g, '').trim();
  }

  const customerByPhone = new Map();
  const customerByName = new Map();

  customers.forEach(c => {
    const ph = normalizePhone(c.phone);
    if (ph && ph.length >= 7) {
      if (!customerByPhone.has(ph)) customerByPhone.set(ph, []);
      customerByPhone.get(ph).push(c);
    }
    const nm = normalizeName(c.name);
    if (nm && nm.length >= 3) {
      if (!customerByName.has(nm)) customerByName.set(nm, []);
      customerByName.get(nm).push(c);
    }
  });

  const crossoverMap = new Map();

  events.forEach(e => {
    const ePhone = normalizePhone(e.phone);
    const eName = normalizeName(e.customer);

    let matched = [];
    if (ePhone && customerByPhone.has(ePhone)) {
      matched = customerByPhone.get(ePhone);
    } else if (eName && customerByName.has(eName)) {
      matched = customerByName.get(eName);
    }

    if (matched.length > 0) {
      const key = (ePhone && ePhone.length >= 7) ? ePhone : (eName || e.customer);
      if (!crossoverMap.has(key)) {
        crossoverMap.set(key, {
          name: e.customer || matched[0].name,
          phone: e.phone || matched[0].phone,
          location: e.location || matched[0].location || 'Chennai',
          events: [],
          shopVisits: [],
          totalEventSpend: 0,
          totalShopSpend: 0
        });
      }
      const item = crossoverMap.get(key);
      if (!item.events.some(x => x.id === e.id)) {
        item.events.push(e);
        item.totalEventSpend += (e.total || 0);
      }
      matched.forEach(sc => {
        if (!item.shopVisits.some(v => v.id === sc.id)) {
          item.shopVisits.push(sc);
          item.totalShopSpend += (sc.amount || sc.total_spend || 0);
        }
      });
    }
  });

  const results = Array.from(crossoverMap.values());
  results.sort((a, b) => (b.totalEventSpend + b.totalShopSpend) - (a.totalEventSpend + a.totalShopSpend));
  return results;
}

export function renderCrossoverClientsTab(crossoverClients) {
  const totalClients = crossoverClients.length;
  const totalCombinedSpend = crossoverClients.reduce((sum, c) => sum + (c.totalEventSpend + c.totalShopSpend), 0);
  const totalEventSpend = crossoverClients.reduce((sum, c) => sum + c.totalEventSpend, 0);
  const totalShopSpend = crossoverClients.reduce((sum, c) => sum + c.totalShopSpend, 0);
  const avgClientSpend = totalClients > 0 ? Math.round(totalCombinedSpend / totalClients) : 0;

  return `
    <!-- Crossover Metrics Cards -->
    <div class="metric-grid" style="margin-bottom: 20px;">
      <div class="metric-card mc-gold">
        <div class="metric-label">Dual-Channel VIPs</div>
        <div class="metric-value">${totalClients}</div>
        <div class="metric-sub">Booked both Wedding & Salon Visits</div>
        <div class="metric-icon"><i class="ti ti-users"></i></div>
      </div>
      <div class="metric-card mc-teal">
        <div class="metric-label">Combined Lifetime Value</div>
        <div class="metric-value">₹${totalCombinedSpend.toLocaleString('en-IN')}</div>
        <div class="metric-sub">Event + In-Shop Total Spend</div>
        <div class="metric-icon"><i class="ti ti-currency-rupee"></i></div>
      </div>
      <div class="metric-card mc-rose">
        <div class="metric-label">Event Packages Revenue</div>
        <div class="metric-value">₹${totalEventSpend.toLocaleString('en-IN')}</div>
        <div class="metric-sub">${totalCombinedSpend ? Math.round((totalEventSpend/totalCombinedSpend)*100) : 0}% of dual-channel revenue</div>
        <div class="metric-icon"><i class="ti ti-calendar-event"></i></div>
      </div>
      <div class="metric-card mc-purple">
        <div class="metric-label">Salon Shop Revenue</div>
        <div class="metric-value">₹${totalShopSpend.toLocaleString('en-IN')}</div>
        <div class="metric-sub">Avg Lifetime: ₹${avgClientSpend.toLocaleString('en-IN')} / client</div>
        <div class="metric-icon"><i class="ti ti-scissors"></i></div>
      </div>
    </div>

    <!-- Search & Filter Card -->
    <div class="card" style="padding: 14px 18px; margin-bottom: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:280px; position:relative;">
          <i class="ti ti-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#d97706; font-size:16px;"></i>
          <input class="form-input" placeholder="Search dual clients by name, phone, event type, or salon service..." value="${window._crossoverSearchQuery || ''}" oninput="window.filterCrossoverSearch(this.value)" style="padding-left:36px; height:38px;">
        </div>
        <div style="font-size:12px; color:#888;">
          Showing <strong id="crossover-count-label">${crossoverClients.length}</strong> dual-channel VIP clients
        </div>
      </div>
    </div>

    <!-- Crossover Clients List -->
    <div id="crossover-client-list-container">
      ${renderCrossoverClientCards(crossoverClients, window._crossoverSearchQuery || '')}
    </div>
  `;
}

export function renderCrossoverClientCards(crossoverClients, query = '') {
  let list = crossoverClients;
  const q = (query || '').toLowerCase().trim();
  if (q) {
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.location || '').toLowerCase().includes(q) ||
      c.events.some(e => (e.type || '').toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q)) ||
      c.shopVisits.some(v => {
        const s = Array.isArray(v.services) ? v.services.join(' ') : String(v.services || '');
        return s.toLowerCase().includes(q);
      })
    );
  }

  const countLabel = document.getElementById('crossover-count-label');
  if (countLabel) countLabel.textContent = list.length;

  if (!list.length) {
    return `<div class="card" style="text-align:center; padding:40px; color:#888;">
      <i class="ti ti-search" style="font-size:32px; opacity:0.3; display:block; margin-bottom:8px;"></i>
      No cross-over clients matching "${query}".
    </div>`;
  }

  return list.map((c, idx) => {
    let topBadge = '';
    if (idx === 0) topBadge = '<span class="badge badge-gold">👑 #1 Top Dual Client</span>';
    else if (idx === 1) topBadge = '<span class="badge badge-amber">🥈 #2 Dual Client</span>';
    else if (idx === 2) topBadge = '<span class="badge badge-blue">🥉 #3 Dual Client</span>';
    else topBadge = '<span class="badge badge-gold" style="opacity:0.85;">✨ Event + Salon VIP</span>';

    const waText = encodeURIComponent(`Vanakkam ${c.name}! ✨ Thank you for being a valued client for both bridal events and salon services at Kalai Makeover.`);

    return `
    <div class="card crossover-client-card" style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:flex-start; gap:12px;">
          <div style="font-size:15px; font-weight:700; color:#d97706; background:rgba(245,200,66,0.12); width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(245,200,66,0.28); flex-shrink:0;">
            #${idx + 1}
          </div>
          <div>
            <div style="font-size:16px; font-weight:700; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span>${c.name}</span>
              ${topBadge}
              <span class="badge badge-purple" style="font-size:10px; padding:2px 7px;">
                🎉 ${c.events.length} Event${c.events.length > 1 ? 's' : ''}
              </span>
              <span class="badge badge-green" style="font-size:10px; padding:2px 7px;">
                💇‍♀️ ${c.shopVisits.length} Salon Visit${c.shopVisits.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style="font-size:12.5px; color:#888; margin-top:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span><i class="ti ti-phone" style="color:#d97706;"></i> ${c.phone || 'No phone'}</span>
              <span>·</span>
              <span><i class="ti ti-map-pin" style="color:#d97706;"></i> ${c.location || 'Chennai'}</span>
            </div>
          </div>
        </div>

        <div style="text-align:right;">
          <div style="font-size:10.5px; color:#999; text-transform:uppercase; letter-spacing:0.06em;">Total Lifetime Value</div>
          <div style="font-size:18px; font-weight:700; color:#d97706;">₹${(c.totalEventSpend + c.totalShopSpend).toLocaleString('en-IN')}</div>
          <div style="font-size:11px; color:#888; margin-top:2px;">
            Events: <strong style="color:#4f46e5;">₹${c.totalEventSpend.toLocaleString()}</strong> + Shop: <strong style="color:#10b981;">₹${c.totalShopSpend.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <!-- Split details: Events vs Salon visits -->
      <div class="crossover-split-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px; border-radius:12px; border:1px solid rgba(245,200,66,0.14);">
        <!-- Left: Event Bookings -->
        <div>
          <div style="font-size:11.5px; font-weight:700; color:#4f46e5; margin-bottom:8px; display:flex; align-items:center; gap:5px; text-transform:uppercase; letter-spacing:0.04em;">
            <i class="ti ti-calendar-event"></i> Event Bookings (${c.events.length})
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${c.events.map(ev => `
              <div class="crossover-subitem" style="padding:8px 10px; border-radius:8px; font-size:11.5px; display:flex; justify-content:space-between; align-items:center; border:0.5px solid rgba(245,200,66,0.12);">
                <div>
                  <div style="font-weight:600;">${ev.type || 'Wedding Event'}</div>
                  <div style="color:#888; font-size:10.5px;">📅 ${ev.date || 'Date N/A'} · ${ev.location || 'Chennai'}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:700; color:#d97706;">₹${(ev.total || 0).toLocaleString()}</div>
                  <span class="badge ${ev.status === 'Completed' ? 'badge-green' : 'badge-blue'}" style="font-size:9.5px; padding:1px 5px;">${ev.status}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right: Salon Shop Visits -->
        <div>
          <div style="font-size:11.5px; font-weight:700; color:#10b981; margin-bottom:8px; display:flex; align-items:center; gap:5px; text-transform:uppercase; letter-spacing:0.04em;">
            <i class="ti ti-scissors"></i> In-Shop Salon Visits (${c.shopVisits.length})
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${c.shopVisits.map(sv => {
              const sList = Array.isArray(sv.services) ? sv.services : [sv.services || 'Salon Service'];
              return `
              <div class="crossover-subitem" style="padding:8px 10px; border-radius:8px; font-size:11.5px; display:flex; justify-content:space-between; align-items:center; border:0.5px solid rgba(245,200,66,0.12);">
                <div style="flex:1; padding-right:8px;">
                  <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:3px;">
                    ${sList.map(s => `<span style="background:rgba(16,185,129,0.12); color:#10b981; padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:600;">${s}</span>`).join('')}
                  </div>
                  <div style="color:#888; font-size:10.5px;">Visit: ${sv.created_at ? new Date(sv.created_at).toLocaleDateString('en-IN') : 'Recent'}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:700; color:#10b981;">₹${(sv.amount || sv.total_spend || 0).toLocaleString()}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div style="margin-top:12px; display:flex; justify-content:flex-end; gap:8px; align-items:center; flex-wrap:wrap;">
        <a href="https://wa.me/91${c.phone}?text=${waText}" target="_blank" class="btn btn-outline" style="font-size:11.5px; padding:5px 12px; text-decoration:none; color:#25d366; border-color:rgba(37,211,102,0.3); display:inline-flex; align-items:center; gap:5px;">
          <i class="ti ti-brand-whatsapp"></i> WhatsApp VIP
        </a>
        <a href="tel:${c.phone}" class="btn btn-outline" style="font-size:11.5px; padding:5px 12px; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
          <i class="ti ti-phone"></i> Call
        </a>
        <button class="btn btn-gold" onclick="window.openEventCustomerForm(null, null, 'Muhurtham', '${c.name.replace(/'/g, "\\'")}', '${c.phone}')" style="font-size:11.5px; padding:5px 12px; border-radius:8px;">
          <i class="ti ti-plus"></i> Book Next Event
        </button>
      </div>
    </div>`;
  }).join('');
}

export function renderEventAnalyticsDashboard(events, allEvents = window._cachedEvents || events, customers = window._cachedCustomers || []) {
  if (!events || !events.length) {
    return `<div class="card" style="text-align:center;padding:40px;color:#999"><i class="ti ti-chart-pie" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>No event booking analytics available yet. Book events to see detailed insights!</div>`;
  }

  if (window._eventAnalyticsSubTab === undefined) window._eventAnalyticsSubTab = 'overview';

  const crossoverClients = getCrossOverCustomers(allEvents, customers);
  window._cachedCrossoverClients = crossoverClients;

  const subnavHtml = `
    <!-- Analytics & Insights Sub-Menu Navigation -->
    <div class="card event-analytics-subnav-card" style="padding:10px 14px; margin-bottom:20px; display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; border:1px solid rgba(245,200,66,0.22);">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="chip ${window._eventAnalyticsSubTab === 'overview' ? 'selected' : ''}" onclick="window.switchEventAnalyticsSubTab('overview')" style="font-size:12px; padding:6px 14px; cursor:pointer;">
          <i class="ti ti-chart-pie" style="margin-right:5px;"></i> 📊 Analytics Overview
        </button>
        <button class="chip ${window._eventAnalyticsSubTab === 'top_weddings' ? 'selected' : ''}" onclick="window.switchEventAnalyticsSubTab('top_weddings')" style="font-size:12px; padding:6px 14px; cursor:pointer;">
          <i class="ti ti-crown" style="margin-right:5px; color:#f5c842;"></i> 🏆 Top Weddings (${allEvents.length})
        </button>
        <button class="chip ${window._eventAnalyticsSubTab === 'crossover' ? 'selected' : ''}" onclick="window.switchEventAnalyticsSubTab('crossover')" style="font-size:12px; padding:6px 14px; cursor:pointer;">
          <i class="ti ti-users" style="margin-right:5px; color:#10b981;"></i> 🤝 Event & Shop Customers (${crossoverClients.length})
        </button>
      </div>
      <div style="font-size:11.5px; color:rgba(245,200,66,0.85); font-weight:500;">
        ${window._eventAnalyticsSubTab === 'overview' ? '📈 Live Business Intelligence' : window._eventAnalyticsSubTab === 'top_weddings' ? '👑 Highest Revenue Packages' : '✨ Dual-Channel VIP Clients'}
      </div>
    </div>
  `;

  if (window._eventAnalyticsSubTab === 'top_weddings') {
    return subnavHtml + renderTopPaidEventsTab(allEvents);
  }

  if (window._eventAnalyticsSubTab === 'crossover') {
    return subnavHtml + renderCrossoverClientsTab(crossoverClients);
  }

  const totalBookings = events.length;
  const totalRevenue = events.reduce((sum, e) => sum + (e.total || 0), 0);
  const avgBookingValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;
  const totalPending = events.reduce((sum, e) => sum + (e.pending || 0), 0);
  const totalAdvance = events.reduce((sum, e) => sum + (e.advance || 0), 0);

  // 1. Makeup & Event Types Breakdown
  const typeMap = {};
  events.forEach(e => {
    const type = (e.type && e.type.trim()) ? e.type.trim() : 'General Event';
    if (!typeMap[type]) typeMap[type] = { count: 0, revenue: 0 };
    typeMap[type].count += 1;
    typeMap[type].revenue += (e.total || 0);
  });
  const sortedTypes = Object.entries(typeMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  // 2. Locations / Destination Weddings Breakdown
  const locationMap = {};
  let unspecifiedVenueCount = 0;
  let unspecifiedVenueRev = 0;

  function isUnspecifiedVenue(loc) {
    if (!loc) return true;
    const s = String(loc).trim().toLowerCase();
    return !s || s === 'unspecified venue' || s === 'unspecified' || s === 'no location' || s === 'none' || s === 'n/a' || s === 'unknown' || s === 'nil';
  }

  events.forEach(e => {
    const rawLoc = (e.location || '').trim();
    if (isUnspecifiedVenue(rawLoc)) {
      unspecifiedVenueCount += 1;
      unspecifiedVenueRev += (e.total || 0);
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
    locationMap[key].revenue += (e.total || 0);
  });
  const sortedLocations = Object.values(locationMap).sort((a, b) => b.count - a.count);

  // 3. Monthly Trends & Peak Wedding Month
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const allList = (allEvents && allEvents.length) ? allEvents : (window._cachedEvents || events);
  const allMonthMap = {};
  allList.forEach(e => {
    if (!e.date) return;
    const parts = String(e.date).split('T')[0].split('-');
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
      allMonthMap[key].revenue += (e.total || 0);
    }
  });

  let sortedMonths = [];
  if (window._selectedEventMonth !== undefined && window._selectedEventMonth !== 'all') {
    const mTarget = parseInt(window._selectedEventMonth, 10);
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

    const prevMonthData = allMonthMap[prevKey] || { key: prevKey, label: prevLabel, year: prevYear, monthIndex: prevMonthIndex, count: 0, revenue: 0 };
    const currMonthData = allMonthMap[selectedKey] || { key: selectedKey, label: selectedLabel, year: selectedYear, monthIndex: mTarget, count: 0, revenue: 0 };

    sortedMonths = [prevMonthData, currMonthData];
  } else {
    sortedMonths = Object.values(allMonthMap).sort((a, b) => a.key.localeCompare(b.key));
  }

  const peakMonth = sortedMonths.length ? [...sortedMonths].sort((a, b) => b.revenue - a.revenue)[0] : null;

  // Store data for Chart.js
  window._eventAnalyticsData = {
    types: sortedTypes,
    locations: sortedLocations,
    monthly: sortedMonths,
    peakMonth,
    totalAdvance,
    totalPending,
    totalRevenue
  };

  return subnavHtml + `
  <!-- Teaser Banners: Top Weddings & Crossover Clients -->
  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:20px;">
    <div class="card" style="padding:14px 18px; border:1px solid rgba(245,200,66,0.25); cursor:pointer; transition:all 0.2s;" onclick="window.switchEventAnalyticsSubTab('top_weddings')">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:36px; height:36px; border-radius:10px; background:rgba(245,200,66,0.15); display:flex; align-items:center; justify-content:center; color:#f5c842; font-size:18px;">
            <i class="ti ti-crown"></i>
          </div>
          <div>
            <div style="font-weight:700; font-size:13.5px;">🏆 Top Paid Weddings & Events</div>
            <div style="font-size:11px; color:#888;">Ranked by package billing · Top: ₹${(allEvents.length ? Math.max(...allEvents.map(e => e.total || 0)) : 0).toLocaleString()}</div>
          </div>
        </div>
        <div style="font-size:12px; font-weight:600; color:#f5c842; display:flex; align-items:center; gap:4px;">
          View List <i class="ti ti-arrow-right"></i>
        </div>
      </div>
    </div>

    <div class="card" style="padding:14px 18px; border:1px solid rgba(16,185,129,0.3); cursor:pointer; transition:all 0.2s;" onclick="window.switchEventAnalyticsSubTab('crossover')">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:36px; height:36px; border-radius:10px; background:rgba(16,185,129,0.15); display:flex; align-items:center; justify-content:center; color:#10b981; font-size:18px;">
            <i class="ti ti-users"></i>
          </div>
          <div>
            <div style="font-weight:700; font-size:13.5px;">🤝 Event & Shop Customers</div>
            <div style="font-size:11px; color:#888;"><strong>${crossoverClients.length} clients</strong> taken both wedding & salon shop services</div>
          </div>
        </div>
        <div style="font-size:12px; font-weight:600; color:#10b981; display:flex; align-items:center; gap:4px;">
          View Clients <i class="ti ti-arrow-right"></i>
        </div>
      </div>
    </div>
  </div>
  <!-- Top Metrics Overview -->
  <div class="metric-grid" style="margin-bottom: 20px;">
    <div class="metric-card mc-gold">
      <div class="metric-label">Total Event Bookings</div>
      <div class="metric-value">${totalBookings}</div>
      <div class="metric-sub">Peak Month: <strong>${peakMonth ? peakMonth.label : 'N/A'}</strong></div>
      <div class="metric-icon"><i class="ti ti-calendar-event"></i></div>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Total Booking Revenue</div>
      <div class="metric-value">₹${totalRevenue.toLocaleString('en-IN')}</div>
      <div class="metric-sub">Avg Package: ₹${avgBookingValue.toLocaleString('en-IN')}</div>
      <div class="metric-icon"><i class="ti ti-currency-rupee"></i></div>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Advance Collected</div>
      <div class="metric-value">₹${totalAdvance.toLocaleString('en-IN')}</div>
      <div class="metric-sub">${totalRevenue ? Math.round((totalAdvance/totalRevenue)*100) : 0}% of Total Revenue</div>
      <div class="metric-icon"><i class="ti ti-cash"></i></div>
    </div>
    <div class="metric-card mc-purple">
      <div class="metric-label">Pending Payments Balance</div>
      <div class="metric-value" style="color:${totalPending > 0 ? '#dc2626' : '#10b981'}">₹${totalPending.toLocaleString('en-IN')}</div>
      <div class="metric-sub">${totalPending > 0 ? 'To be collected on event dates' : 'All cleared 🎉'}</div>
      <div class="metric-icon"><i class="ti ti-alert-triangle"></i></div>
    </div>
  </div>

  <!-- Charts Grid -->
  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:20px;">
    <!-- Monthly Revenue & Bookings Trend Chart -->
    <div class="card" style="padding:16px;">
      <div style="font-weight:600; font-size:13px; color:#1a1a1a; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
        <i class="ti ti-chart-bar" style="color:#d97706;"></i> Monthly Event Revenue & Booking Volume
      </div>
      <div style="font-size:11px; color:#888; margin-bottom:12px;">Track peak wedding seasons and booking trends month-by-month</div>
      <div style="height:220px; position:relative;">
        <canvas id="eventMonthlyTrendChart"></canvas>
      </div>
    </div>

    <!-- Event Makeup Type Distribution -->
    <div class="card" style="padding:16px;">
      <div style="font-weight:600; font-size:13px; color:#1a1a1a; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
        <i class="ti ti-chart-pie" style="color:#d97706;"></i> Makeup & Function Type Share
      </div>
      <div style="font-size:11px; color:#888; margin-bottom:12px;">Bridal, Reception, Engagement, Saree Prepleating breakdown</div>
      <div style="height:220px; position:relative;">
        <canvas id="eventMakeupTypeChart"></canvas>
      </div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:20px;">
    <!-- Payment & Advance Collection Status -->
    <div class="card" style="padding:16px;">
      <div style="font-weight:600; font-size:13px; color:#1a1a1a; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
        <i class="ti ti-wallet" style="color:#d97706;"></i> Advance vs Pending Balance
      </div>
      <div style="font-size:11px; color:#888; margin-bottom:12px;">Ratio of collected advance money to remaining balance</div>
      <div style="height:220px; position:relative;">
        <canvas id="eventPaymentChart"></canvas>
      </div>
    </div>

    <!-- Event Venues & Locations Grid -->
    <div class="card" style="padding:16px;">
      <div style="font-weight:600; font-size:13px; color:#1a1a1a; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
        <i class="ti ti-map-pin" style="color:#d97706;"></i> Top Booking Venues & Locations
      </div>
      <div style="font-size:11px; color:#888; margin-bottom:12px;">Locations driving the highest number of event bookings</div>
      <div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto; padding-right:4px;" class="scrollbar-hide">
        ${sortedLocations.length ? sortedLocations.map((loc, idx) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#fafafa; border:1px solid #ebebeb; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; font-weight:700; color:#d97706; width:18px;">#${idx + 1}</span>
              <span style="font-size:12.5px; font-weight:600; color:#1a1a1a;">📍 ${loc.name}</span>
            </div>
            <div style="text-align:right;">
              <span style="font-size:12px; font-weight:700; color:#15803d;">₹${loc.revenue.toLocaleString()}</span>
              <span style="font-size:10px; color:#888; margin-left:6px;">(${loc.count} events)</span>
            </div>
          </div>
        `).join('') : '<div style="font-size:12px; color:#888; text-align:center; padding:20px;">No location data found</div>'}
      </div>
      ${unspecifiedVenueCount > 0 ? `
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #eee;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#888">
          <span><i class="ti ti-info-circle" style="color:#9ca3af"></i> ${unspecifiedVenueCount} events with venue unrecorded</span>
          <span style="color:#aaa">₹${unspecifiedVenueRev.toLocaleString()}</span>
        </div>
      ` : ''}
    </div>
  </div>

  <!-- Detailed Function Packages Table Card -->
  <div class="card" style="padding:16px;">
    <div style="font-weight:600; font-size:13px; color:#1a1a1a; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
      <i class="ti ti-sparkles" style="color:#d97706;"></i> Event Makeup Service Performance Summary
    </div>
    <div style="font-size:11px; color:#888; margin-bottom:14px;">Total bookings and revenue performance categorized by makeup service type</div>
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:10px;">
      ${sortedTypes.map(t => `
        <div style="background:#fffdf5; border:1px solid #fde68a; border-radius:10px; padding:12px;">
          <div style="font-size:12px; font-weight:700; color:#b45309; margin-bottom:4px; display:flex; align-items:center; justify-content:space-between;">
            <span>✨ ${t.name}</span>
            <span class="badge badge-gold" style="font-size:10px">${t.count} Bookings</span>
          </div>
          <div style="font-size:15px; font-weight:700; color:#1a1a1a; margin-top:6px;">₹${t.revenue.toLocaleString()}</div>
          <div style="font-size:10.5px; color:#888; margin-top:2px;">Avg: ₹${Math.round(t.revenue / Math.max(1, t.count)).toLocaleString()} / booking</div>
        </div>
      `).join('')}
    </div>
  </div>
  `;
}

export function initEventAnalyticsCharts(events) {
  const dd = window._eventAnalyticsData;
  if (!dd || typeof Chart === 'undefined') return;

  // 1. Monthly Revenue & Bookings Bar + Line Chart
  const monthCtx = document.getElementById('eventMonthlyTrendChart');
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
            label: 'Event Count',
            data: counts,
            backgroundColor: dd.monthly.map(m => (dd.peakMonth && m.key === dd.peakMonth.key) ? '#f5c842' : 'rgba(245, 200, 66, 0.45)'),
            borderColor: '#f5c842',
            borderWidth: 1.5,
            borderRadius: 8,
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
            pointRadius: 4,
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
              label: function(ctx) {
                if (ctx.dataset.type === 'line') {
                  return ` Revenue: ₹${ctx.raw.toLocaleString()}`;
                }
                return ` Events: ${ctx.raw} bookings`;
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Events Count', font: { size: 10 } },
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

  // 2. Makeup Type Share Doughnut Chart
  const typeCtx = document.getElementById('eventMakeupTypeChart');
  if (typeCtx && dd.types && dd.types.length) {
    const topTypes = dd.types.slice(0, 6);
    new Chart(typeCtx, {
      type: 'doughnut',
      data: {
        labels: topTypes.map(t => t.name),
        datasets: [{
          data: topTypes.map(t => t.count),
          backgroundColor: ['#f5c842', '#14b8a6', '#fb7185', '#a78bfa', '#6366f1', '#ec4899']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } }
      }
    });
  }

  // 3. Payment Status Pie Chart
  const payCtx = document.getElementById('eventPaymentChart');
  if (payCtx) {
    new Chart(payCtx, {
      type: 'pie',
      data: {
        labels: ['Advance Collected', 'Pending Balance'],
        datasets: [{
          data: [dd.totalAdvance, dd.totalPending],
          backgroundColor: ['#10b981', '#ef4444']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } }
      }
    });
  }
}

// ─────────────────────────────────────────────
// 🗓️ UPCOMING EVENTS TAB
// ─────────────────────────────────────────────

export function renderUpcomingEventsTab(events) {
  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(e => e.date && e.date >= todayStr);

  upcoming.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="section-title" style="margin-bottom:2px">
            <i class="ti ti-calendar-event" style="color:#d97706;font-size:18px"></i> 🗓️ Scheduled Upcoming Events (${upcoming.length})
          </div>
          <div style="font-size:12px;color:#888">All upcoming weddings & function bookings ordered by date</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
        ${upcoming.length ? upcoming.map(e => {
          const today = new Date(todayStr);
          const evtDate = new Date(e.date);
          const diffDays = Math.ceil((evtDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          let badgeHtml = '';
          if (diffDays === 0) {
            badgeHtml = '<span class="badge badge-gold" style="font-size:11px;padding:3px 8px;">🎉 TODAY!</span>';
          } else if (diffDays === 1) {
            badgeHtml = '<span class="badge badge-amber" style="font-size:11px;padding:3px 8px;">⏰ Tomorrow</span>';
          } else {
            badgeHtml = `<span class="badge badge-blue" style="font-size:11px;padding:3px 8px;">🗓️ In ${diffDays} Days</span>`;
          }

          return renderEventCard(e, badgeHtml);
        }).join('') : '<div style="font-size:12px;color:#888;padding:30px 0;text-align:center">🎉 No upcoming scheduled events. Tap "Book Event" to add a new booking!</div>'}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// 🏆 TOP PAID WEDDINGS & EVENTS TAB
// ─────────────────────────────────────────────

export function renderTopPaidEventsTab(events) {
  const sorted = [...events].sort((a, b) => (b.total || 0) - (a.total || 0));

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div class="section-title" style="margin-bottom:0">
          <i class="ti ti-crown" style="color:#d97706;font-size:18px"></i> 🏆 Highest Revenue Weddings & Events (Top Paid)
        </div>
      </div>
      <div style="font-size:12px;color:#888;margin-bottom:16px">Event bookings ranked strictly by total package billing amount</div>

      <div style="display:flex;flex-direction:column;gap:12px">
        ${sorted.map((e, i) => {
          let rankBadge = '';
          if (i === 0) rankBadge = '<span class="badge badge-gold" style="margin-left:6px">👑 #1 Top Event Billing</span>';
          else if (i === 1) rankBadge = '<span class="badge badge-amber" style="margin-left:6px">🥈 #2 Highest Spender</span>';
          else if (i === 2) rankBadge = '<span class="badge badge-blue" style="margin-left:6px">🥉 #3 Top Spender</span>';

          return renderEventCard(e, rankBadge, i + 1);
        }).join('')}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// ✅ COMPLETED EVENTS TAB
// ─────────────────────────────────────────────

export function renderCompletedEventsTab(events) {
  const completed = events.filter(e => e.status === 'Completed');

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div class="section-title" style="margin-bottom:0">
          <i class="ti ti-circle-check" style="color:#10b981;font-size:18px"></i> ✅ Completed Event Bookings (${completed.length})
        </div>
      </div>
      <div style="font-size:12px;color:#888;margin-bottom:16px">Successfully completed makeup assignments and fully settled events</div>

      <div style="display:flex;flex-direction:column;gap:12px">
        ${completed.length ? completed.map(e => renderEventCard(e, '<span class="badge badge-green">Fully Completed</span>')).join('') : '<div style="font-size:12px;color:#888;padding:30px 0;text-align:center">No completed events found yet.</div>'}
      </div>
    </div>
  `;
}

function renderEventCard(e, extraBadge = '', rankNum = null) {
  let addonsHtml = '';
  let funcDatesHtml = '';
  
  if (e.additional_makeup) {
    try {
      const arr = typeof e.additional_makeup === 'string' ? JSON.parse(e.additional_makeup) : e.additional_makeup;
      if (Array.isArray(arr)) {
        const cleanArr = arr.filter(a => a.name && !a.name.startsWith('Meta:') && a.amount > 0);
        if (cleanArr.length > 0) {
          addonsHtml = `
            <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
              ${cleanArr.map(a => `<span style="font-size:10px; font-weight:500; color:#4f46e5; background:#edf2f7; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; border: 0.5px solid #cbd5e0; gap: 4px;"><i class="ti ti-circle-plus" style="font-size:11px; color:#4f46e5;"></i>${a.name}: ₹${a.amount.toLocaleString()}</span>`).join('')}
            </div>
          `;
        }

        const meta = arr.find(a => a.name === 'Meta:FunctionDates');
        if (meta && meta.dates && Object.keys(meta.dates).length > 1) {
          funcDatesHtml = `
            <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px; border-top: 0.5px dashed #e2e8f0; padding-top: 5px;">
              ${Object.entries(meta.dates).map(([func, dateVal]) => `
                <div style="font-size:10px; color:#555; display:flex; justify-content:space-between; align-items:center; gap:6px;">
                  <span style="font-weight:600; color:#4f46e5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px;" title="${func}">${func}:</span>
                  <span style="background:#e0e7ff; color:#4338ca; padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:600; white-space:nowrap;">${new Date(dateVal).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              `).join('')}
            </div>
          `;
        }
      }
    } catch(err) {}
  }
  
  const { cleanText: cleanCustomer, tagHtml: empBadge } = formatEmpTag(e.customer);

  return `
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div style="display:flex; align-items:flex-start; gap:10px;">
        ${rankNum !== null ? `<div style="font-size:15px; font-weight:700; color:#d97706; margin-top:2px;">#${rankNum}</div>` : ''}
        <div>
          <div style="font-size:15px;font-weight:600; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            ${cleanCustomer}
            ${empBadge}
            ${extraBadge}
            ${e.rating ? `<span style="color:#d97706;font-size:11px;letter-spacing:1px;" title="Owner rating: ${e.rating}/5">${'★'.repeat(e.rating)}${'☆'.repeat(5-e.rating)}</span>` : ''}
          </div>
          <div style="font-size:12px;color:#888; margin-top:2px;">
            ${e.phone || 'No phone'} · ${e.location || 'Chennai'}
            ${e.referred_by ? ` · <span style="color:#b45309;font-weight:500;" title="Referred by: ${e.referred_by}">📢 Ref: ${e.referred_by}</span>` : ''}
          </div>
          <div style="font-size:11px;color:#999;margin-top:2px;">
            <i class="ti ti-clock" style="font-size:11px;vertical-align:middle;margin-right:2px;"></i>Booked on: ${e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : 'N/A'}
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${e.status==='Completed'?'badge-green':e.status==='Booked'?'badge-blue':'badge-amber'}">${e.status}</span>
        <div onclick="window.promptEventWhatsAppBillFromId('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#25d366'" onmouseout="this.style.color='#ccc'" title="Send Invoice via WhatsApp">
          <i class="ti ti-brand-whatsapp" style="font-size:16px"></i>
        </div>
        <div onclick="window.openEventCustomerForm('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#f5c842'" onmouseout="this.style.color='#ccc'" title="Edit Event">
          <i class="ti ti-edit" style="font-size:15px"></i>
        </div>
        <div onclick="window.handleDeleteEvent('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#ccc'" title="Delete Event">
          <i class="ti ti-trash" style="font-size:15px"></i>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:#f9f9f9;border-radius:10px;padding:12px;font-size:12px">
      <div><div style="color:#999;margin-bottom:2px">Event</div><div style="font-weight:500">${e.type}</div></div>
      <div>
        <div style="color:#999;margin-bottom:2px">Event Date</div>
        <div style="font-weight:500; ${funcDatesHtml ? 'color:#4f46e5; font-weight:600;' : ''}">${e.date}</div>
        ${funcDatesHtml}
      </div>
      <div><div style="color:#999;margin-bottom:2px">Total</div><div style="font-weight:500;color:#d97706">₹${(e.total||0).toLocaleString()}</div></div>
      <div><div style="color:#999;margin-bottom:2px">Pending</div><div style="font-weight:500;color:${(e.pending||0)>0?'#dc2626':'#15803d'}">₹${(e.pending||0).toLocaleString()}</div></div>
    </div>
    ${addonsHtml}
    ${(() => {
      let staffWagesHtml = '';
      if (e.staff_wages) {
        try {
          const wages = typeof e.staff_wages === 'string' ? JSON.parse(e.staff_wages) : e.staff_wages;
          if (Array.isArray(wages) && wages.length > 0) {
            staffWagesHtml = `
              <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
                <span style="font-size:10px; font-weight:600; color:#dc2626; text-transform:uppercase; letter-spacing:0.05em;"><i class="ti ti-users" style="font-size:11px;"></i> Staff Wages (My Expense):</span>
                ${wages.map(w => `<span style="font-size:10px; font-weight:500; color:#dc2626; background:#fff5f5; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; border: 0.5px solid #fca5a5; gap: 4px;"><i class="ti ti-user-dollar" style="font-size:11px;"></i>${w.name}: ₹${(w.amount||0).toLocaleString()}</span>`).join('')}
              </div>
            `;
          }
        } catch(err) {}
      }
      return staffWagesHtml;
    })()}
    <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
      <div style="flex:1; margin-right:12px;">
        <div style="font-size:11px;color:#bbb;margin-bottom:4px">Payment Progress</div>
        <div style="background:#f0f0f0;border-radius:4px;height:6px;overflow:hidden">
          <div style="height:6px;border-radius:4px;background:#f5c842;width:${e.total?Math.round(((e.advance||0)/e.total)*100):0}%"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:3px;">
          <div style="font-size:11px;color:#888">Advance ₹${(e.advance||0).toLocaleString()} / ₹${(e.total||0).toLocaleString()} (${e.total?Math.round(((e.advance||0)/e.total)*100):0}%)</div>
          <div style="display:flex; gap:6px; align-items:center;">
            ${(e.travel_allowance > 0) ? `<span style="font-size:10px; color:#d97706; cursor:pointer; display:flex; align-items:center; gap:3px;" onclick="window.quickEditTransport('${e.id}')" title="Edit transport cost"><i class="ti ti-car" style="font-size:11px;"></i>Transport: ₹${(e.travel_allowance||0).toLocaleString()} <i class="ti ti-pencil" style="font-size:10px;"></i></span>` : ''}
          </div>
        </div>
      </div>
      ${(e.pending || 0) > 0 ? `
        <button class="btn btn-gold" onclick="window.openEventCollectPaymentModal('${e.id}')" style="padding: 6px 12px; font-size: 11px; height: 32px; white-space: nowrap; border-radius: 8px;">
          <i class="ti ti-cash"></i> Collect Payment
        </button>
      ` : ''}
    </div>
  </div>`;
}

// Bind to window object for inline HTML event handling
window.switchEventTab = switchEventTab;
window.filterEventByMonthSelect = filterEventByMonthSelect;
window.filterEventByMonth = filterEventByMonth;
window.filterEventCustomers = filterEventCustomers;
window.filterEventsStatus = filterEventsStatus;
window.toggleEventMonthFilter = toggleEventMonthFilter;
window.toggleEventSearchField = toggleEventSearchField;
window.analyzeEvents = analyzeEvents;
window.showAddEventModal = showAddEventModal;
window.handleDeleteEvent = handleDeleteEvent;
window.openEventCustomerForm = openEventCustomerForm;
window.submitEventCustomerForm = submitEventCustomerForm;
window.promptEventWhatsAppBill = promptEventWhatsAppBill;
window.promptEventWhatsAppBillFromId = promptEventWhatsAppBillFromId;
window.openEventCollectPaymentModal = openEventCollectPaymentModal;
window.quickEditTransport = quickEditTransport;
window.eventAddonChipToggle = eventAddonChipToggle;
window.removeEventAddonRow = removeEventAddonRow;
window.updateEventTotalDisplay = updateEventTotalDisplay;
window.eventFunctionChipToggle = eventFunctionChipToggle;
window.updateEventFunctionDates = updateEventFunctionDates;
window.renderEventAnalyticsDashboard = renderEventAnalyticsDashboard;
window.initEventAnalyticsCharts = initEventAnalyticsCharts;
window.renderUpcomingEventsTab = renderUpcomingEventsTab;
window.renderTopPaidEventsTab = renderTopPaidEventsTab;
window.renderCompletedEventsTab = renderCompletedEventsTab;
window.bookMuhurthamEvent = bookMuhurthamEvent;
window.renderMuhurthamWidget = renderMuhurthamWidget;
window.switchEventAnalyticsSubTab = switchEventAnalyticsSubTab;
window.filterCrossoverSearch = filterCrossoverSearch;
window.getCrossOverCustomers = getCrossOverCustomers;
window.renderCrossoverClientsTab = renderCrossoverClientsTab;
window.renderCrossoverClientCards = renderCrossoverClientCards;
window.switchEventHistorySubTab = switchEventHistorySubTab;


