// billl/js/pages/events.js
import { state } from '../state.js';
import { fetchEvents, addEvent, deleteEvent } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay } from '../ui.js';
import { validateAndCleanPhone, getSelectedChips } from '../utils.js';
import { callGroqAPI } from '../api.js';

export async function renderEvents() {
  const events = await fetchEvents();
  const totalPending = events.filter(e=>(e.pending||0)>0).reduce((s,e)=>s+(e.pending||0),0);

  return `
  <div class="top-bar">
    <h2>Event Bookings</h2>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-outline" onclick="window.analyzeEvents()">
        <i class="ti ti-chart-bar" style="color:#d97706"></i> AI Analysis
      </button>
      <button class="btn btn-gold" onclick="window.openEventCustomerForm()"><i class="ti ti-plus"></i> Book Event</button>
    </div>
  </div>
  <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
    <div class="metric-card mc-teal">
      <div class="metric-label">Total Events</div>
      <div class="metric-value">${events.length}</div>
      <div class="metric-sub">All time</div>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Pending Amount</div>
      <div class="metric-value">₹${totalPending.toLocaleString()}</div>
      <div class="metric-sub">${events.filter(e=>(e.pending||0)>0).length} events pending</div>
    </div>
    <div class="metric-card mc-gold">
      <div class="metric-label">Completed</div>
      <div class="metric-value">${events.filter(e=>e.status==='Completed').length}</div>
      <div class="metric-sub">Fully paid</div>
    </div>
  </div>
  ${events.map(e=>`
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
  `).join('')}`;
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

The HTML should contain:
1. Executive Summary: Short overview of event booking performance.
2. Metric Grid: Styled list or columns showing: Total Events Booked, Total Revenue, Total Advance Collected, Total Pending Amount.
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
