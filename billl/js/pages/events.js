// billl/js/pages/events.js
import { state } from '../state.js';
import { fetchEvents, addEvent, deleteEvent, updateEvent } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay, showConfirmDelete } from '../ui.js';
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
    
    return `
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
      <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1; margin-right:12px;">
          <div style="font-size:11px;color:#bbb;margin-bottom:4px">Payment Progress</div>
          <div style="background:#f0f0f0;border-radius:4px;height:6px;overflow:hidden">
            <div style="height:6px;border-radius:4px;background:#f5c842;width:${e.total?Math.round(((e.advance||0)/e.total)*100):0}%"></div>
          </div>
          <div style="font-size:11px;color:#888;margin-top:3px">Advance ₹${(e.advance||0).toLocaleString()} / ₹${(e.total||0).toLocaleString()} (${e.total?Math.round(((e.advance||0)/e.total)*100):0}%)</div>
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

export function openEventCustomerForm(eventId = null) {
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
              <input class="form-input" id="ef-name" value="${isEdit && event ? event.customer : ''}" placeholder="Enter name">
            </div>
            <div class="form-group">
              <label class="form-label">Customer Number *</label>
              <input class="form-input" id="ef-phone" value="${isEdit && event ? event.phone : ''}" placeholder="10-digit number" maxlength="10">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Location</label>
              <input class="form-input" id="ef-location" value="${isEdit && event ? (event.location || '') : ''}" placeholder="e.g. Chennai">
            </div>
            <div class="form-group" id="ef-main-date-group">
              <label class="form-label">Event Date *</label>
              <input class="form-input" id="ef-date" type="date" value="${isEdit && event ? event.date : today}">
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

