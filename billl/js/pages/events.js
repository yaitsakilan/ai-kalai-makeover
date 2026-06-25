// billl/js/pages/events.js
import { state } from '../state.js';
import { fetchEvents, addEvent, deleteEvent } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay } from '../ui.js';
import { validateAndCleanPhone, getSelectedChips } from '../utils.js';
import { callGroqAPI } from '../api.js';

export async function renderEvents() {
  const events = await fetchEvents();
  window._cachedEvents = events;

  if (window._selectedEventMonth === undefined) window._selectedEventMonth = 'all';
  if (window._eventSearchQuery === undefined) window._eventSearchQuery = '';
  if (window._eventMonthFilterExpanded === undefined) window._eventMonthFilterExpanded = false;
  if (window._eventSearchFieldExpanded === undefined) window._eventSearchFieldExpanded = false;

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Apply filters initially
  let filtered = [...events];
  if (window._eventSearchQuery) {
    const q = window._eventSearchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      (e.customer || '').toLowerCase().includes(q) ||
      (e.phone || '').includes(q) ||
      (e.type || '').toLowerCase().includes(q)
    );
  }
  if (window._selectedEventMonth !== 'all') {
    filtered = filtered.filter(e => {
      if (!e.date) return false;
      const parts = e.date.split('-');
      if (parts.length < 2) return false;
      const m = parseInt(parts[1], 10) - 1;
      return m === window._selectedEventMonth;
    });
  }

  const activeBtnStyle = window._eventMonthFilterExpanded
    ? 'border-color: #f5c842; background: rgba(245, 200, 66, 0.1);'
    : '';

  const activeSearchBtnStyle = window._eventSearchFieldExpanded
    ? 'border-color: #f5c842; background: rgba(245, 200, 66, 0.1);'
    : '';

  return `
  <div class="top-bar">
    <h2>Event Bookings</h2>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-outline" onclick="window.analyzeEvents()">
        <i class="ti ti-chart-bar" style="color:#d97706"></i> AI Analysis
      </button>
      <button class="btn btn-outline btn-icon" onclick="window.toggleEventSearchField()" id="toggle-evt-search-btn" style="${activeSearchBtnStyle}" title="Search Events">
        <i class="ti ti-search" style="color:#d97706"></i>
      </button>
      <button class="btn btn-outline" onclick="window.toggleEventMonthFilter()" id="toggle-evt-filter-btn" style="${activeBtnStyle}">
        <i class="ti ti-filter" style="color:#d97706"></i> Filter
      </button>
      <button class="btn btn-gold" onclick="window.openEventCustomerForm()"><i class="ti ti-plus"></i> Book Event</button>
    </div>
  </div>

  <div id="event-metrics-container">
    ${renderEventMetrics(filtered)}
  </div>

  <div class="card" id="event-search-card" style="margin-bottom:16px; display: ${window._eventSearchFieldExpanded ? 'block' : 'none'};">
    <input class="form-input" placeholder="Search by name, phone, or event type..." id="event-search-input" value="${window._eventSearchQuery || ''}" oninput="window.filterEventCustomers(this.value)">
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
    ${renderEventList(filtered)}
  </div>`;
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

  // Update List HTML
  const listEl = document.getElementById('event-list');
  if (listEl) {
    listEl.innerHTML = renderEventList(events);
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
  return events.map(e => `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:15px;font-weight:600">
            ${e.customer}
            ${e.rating ? `<span style="color:#d97706;font-size:11px;margin-left:6px;letter-spacing:1px;" title="Owner rating: ${e.rating}/5">${'★'.repeat(e.rating)}${'☆'.repeat(5-e.rating)}</span>` : ''}
          </div>
          <div style="font-size:12px;color:#888">
            ${e.phone||'No phone'}
            ${e.referred_by ? ` · <span style="color:#b45309;font-weight:500;" title="Referred by: ${e.referred_by}">📢 Referred by: ${e.referred_by}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${e.status==='Completed'?'badge-green':e.status==='Booked'?'badge-blue':'badge-amber'}">${e.status}</span>
          <div onclick="window.handleDeleteEvent('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#ccc'">
            <i class="ti ti-trash" style="font-size:15px"></i>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:#f9f9f9;border-radius:10px;padding:12px;font-size:12px">
        <div><div style="color:#999;margin-bottom:2px">Event</div><div style="font-weight:500">${e.type}</div></div>
        <div><div style="color:#999;margin-bottom:2px">Date</div><div style="font-weight:500">${e.date}</div></div>
        <div><div style="color:#999;margin-bottom:2px">Total</div><div style="font-weight:500;color:#d97706">₹${(e.total||0).toLocaleString()}</div></div>
        <div><div style="color:#999;margin-bottom:2px">Pending</div><div style="font-weight:500;color:${(e.pending||0)>0?'#dc2626':'#15803d'}">₹${(e.pending||0).toLocaleString()}</div></div>
      </div>
      <div style="margin-top:10px">
        <div style="font-size:11px;color:#bbb;margin-bottom:4px">Payment Progress</div>
        <div style="background:#f0f0f0;border-radius:4px;height:6px;overflow:hidden">
          <div style="height:6px;border-radius:4px;background:#f5c842;width:${e.total?Math.round(((e.advance||0)/e.total)*100):0}%"></div>
        </div>
        <div style="font-size:11px;color:#888;margin-top:3px">Advance ₹${(e.advance||0).toLocaleString()} / ₹${(e.total||0).toLocaleString()} (${e.total?Math.round(((e.advance||0)/e.total)*100):0}%)</div>
      </div>
    </div>
  `).join('');
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
        <input class="form-input" id="m-evt-phone" placeholder="9876543210">
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
        <label class="form-label">Date</label>
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

    const total = parseInt(document.getElementById('m-evt-total').value) || 0;
    const advance = parseInt(document.getElementById('m-evt-advance').value) || 0;
    await addEvent({
      customer,
      phone: phoneVal,
      type: document.getElementById('m-evt-type').value,
      date: document.getElementById('m-evt-date').value || new Date().toISOString().split('T')[0],
      total, advance,
      pending: total - advance,
      status: advance >= total ? 'Completed' : 'Booked'
    });
    closeModal();
    if (typeof window.render === 'function') window.render();
  });
}

export async function handleDeleteEvent(id) {
  if(!confirm('Delete this event?')) return;
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
          content: `Here is the event booking data in JSON format: ${JSON.stringify(events.map(e => ({
            customer: e.customer,
            type: e.type,
            date: e.date,
            total: e.total,
            advance: e.advance,
            pending: e.pending,
            status: e.status,
            location: e.location,
            makeup_type: e.makeup_type,
            rating: e.rating
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

export function openEventCustomerForm() {
  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('form-overlay-container');
  if (!container) return;
  container.innerHTML = `
    <div class="form-overlay" onclick="window.closeFormOverlay()">
      <div class="form-panel" onclick="event.stopPropagation()">
        <div class="form-panel-header">
          <h3><i class="ti ti-calendar-heart" style="color:#ec4899"></i> Event Booking Form</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-outline btn-icon" id="form-mic-btn" onclick="window.startVoiceRecording('event')" title="Fill form with voice" style="width:34px; height:34px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; border-color:#e5e5e5; transition: all 0.2s ease;">
              <i class="ti ti-microphone" style="font-size:16px; color:#ec4899;"></i>
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
              <label class="form-label">Customer Name *</label>
              <input class="form-input" id="ef-name" placeholder="Enter name">
            </div>
            <div class="form-group">
              <label class="form-label">Customer Number</label>
              <input class="form-input" id="ef-phone" placeholder="10-digit number" maxlength="10">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Location</label>
              <input class="form-input" id="ef-location" placeholder="e.g. Chennai">
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input class="form-input" id="ef-date" type="date" value="${today}">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 1.5fr;gap:12px;margin-bottom:14px;align-items:center;">
            <div class="form-group" style="margin-bottom:0;display:flex;align-items:center;gap:6px;">
              <input type="checkbox" id="ef-referred" onchange="document.getElementById('ef-referrer-div').style.display = this.checked ? 'block' : 'none'" style="width:16px;height:16px;cursor:pointer;">
              <label for="ef-referred" class="form-label" style="margin-bottom:0;cursor:pointer;font-weight:500;">Came from Referral?</label>
            </div>
            <div class="form-group" id="ef-referrer-div" style="margin-bottom:0;display:none;">
              <input class="form-input" id="ef-referrer" placeholder="Referrer Name">
            </div>
          </div>

          <div class="form-section-title">
            <i class="ti ti-confetti"></i> Function Type
          </div>
          <div class="form-group">
            <div class="chip-group" id="ef-function-chips">
              ${['Puberty Function','Baby Shower','Engagement','Reception','Muhurtham','Party Makeup','Others'].map(s =>
                `<div class="chip" onclick="window.chipToggle('function', this, true)">${s}</div>`
              ).join('')}
            </div>
            <div class="chip-other-input">
              <input class="form-input" id="ef-function-other" placeholder="Enter function type..." style="margin-top:8px">
            </div>
          </div>

          <div class="form-section-title">
            <i class="ti ti-brush"></i> Makeup Type
          </div>
          <div class="form-group">
            <div class="chip-group" id="ef-makeup-chips">
              ${['Basic Makeup','HD Makeup','Advanced Makeup','Airbrush Makeup','Glass Skin Makeup','Water Proof Makeup','Others'].map(s =>
                `<div class="chip" onclick="window.chipToggle('makeup', this, true)">${s}</div>`
              ).join('')}
            </div>
            <div class="chip-other-input">
              <input class="form-input" id="ef-makeup-other" placeholder="Enter makeup type..." style="margin-top:8px">
            </div>
          </div>

          <div class="form-section-title">
            <i class="ti ti-currency-rupee"></i> Payment Details
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Total Amount (₹) *</label>
              <input class="form-input" id="ef-amount" type="number" placeholder="Enter total amount">
            </div>
            <div class="form-group">
              <label class="form-label">Advance Amount (₹)</label>
              <input class="form-input" id="ef-advance" type="number" placeholder="Enter advance paid">
            </div>
          </div>
        </div>
        <div class="form-panel-footer">
          <button class="btn btn-outline" onclick="window.closeFormOverlay()"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-gold" onclick="window.submitEventCustomerForm()" id="ef-submit-btn"><i class="ti ti-check"></i> Save Event</button>
        </div>
      </div>
    </div>`;
}

export async function submitEventCustomerForm() {
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { showToast('Please enter customer name', 'error'); return; }

  const phoneInput = document.getElementById('ef-phone').value.trim();
  let phoneVal = '';
  if (phoneInput) {
    const cleaned = validateAndCleanPhone(phoneInput);
    if (cleaned === null) { showToast('Please enter a valid 10-digit phone number', 'error'); return; }
    phoneVal = cleaned;
  }

  const functionType = getSelectedChips('ef-function-chips');
  const makeupType = getSelectedChips('ef-makeup-chips');
  const total = parseInt(document.getElementById('ef-amount').value) || 0;
  if (!total) { showToast('Please enter the total amount', 'error'); return; }
  const advance = parseInt(document.getElementById('ef-advance').value) || 0;

  const location = document.getElementById('ef-location').value.trim();
  const date = document.getElementById('ef-date').value || new Date().toISOString().split('T')[0];

  const isReferred = document.getElementById('ef-referred')?.checked;
  const referredBy = isReferred ? document.getElementById('ef-referrer')?.value.trim() : '';

  const btn = document.getElementById('ef-submit-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...'; }

  const result = await addEvent({
    customer: name,
    phone: phoneVal,
    type: functionType || 'Event',
    date,
    total: total,
    advance: advance,
    pending: total - advance,
    status: advance >= total ? 'Completed' : 'Booked',
    location: location,
    makeup_type: makeupType,
    additional_makeup: '[]',
    travel_allowance: 0,
    rating: 5,
    referred_by: referredBy || null
  });

  if (result) {
    closeFormOverlay();
    let summary = `Function: ${functionType || 'N/A'} · Makeup: ${makeupType || 'N/A'} · Total: ₹${total.toLocaleString()} · Advance: ₹${advance.toLocaleString()}`;
    state.chatMessages.push({role:'ai', text: `✅ <strong>${name}</strong> event saved! 🎉<br><span style="font-size:11px;color:#888">${summary}</span>`});
    if (typeof window.render === 'function') window.render();
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Save Event'; }
  }
}

// Bind to window to allow HTML inline click handlers to execute
window.openEventCustomerForm = openEventCustomerForm;
window.submitEventCustomerForm = submitEventCustomerForm;
window.filterEvents = renderEvents; // Backwards compatible filter mapping if used
window.analyzeEvents = analyzeEvents;
window.showAddEventModal = showAddEventModal;
window.handleDeleteEvent = handleDeleteEvent;
window.filterEventCustomers = filterEventCustomers;
window.filterEventByMonth = filterEventByMonth;
window.toggleEventMonthFilter = toggleEventMonthFilter;
window.toggleEventSearchField = toggleEventSearchField;
window.applyEventFilters = applyEventFilters;
window.renderEventMetrics = renderEventMetrics;
window.renderEventList = renderEventList;
