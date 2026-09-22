// billl/js/monthBookings.js
// Month-Wise Bookings Dashboard, Key Metrics & Overdue Status Tracker

import { updateEvent } from './db.js';
import { showToast } from './ui.js';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Helper to get days ago string (e.g. "Yesterday", "2 days ago")
 */
function getDaysAgoText(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  
  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1) return `${diffDays} days ago`;
  return 'Past';
}

/**
 * 1-Click action to mark an overdue/pending event as Finished (Completed)
 */
export async function quickMarkEventFinished(eventId) {
  const events = window._cachedEvents || [];
  const event = events.find(e => e.id === eventId);
  if (!event) {
    showToast('Event booking not found', 'error');
    return;
  }

  try {
    const updated = await updateEvent(eventId, {
      ...event,
      status: 'Completed'
    });

    if (window._cachedEvents) {
      const idx = window._cachedEvents.findIndex(e => e.id === eventId);
      if (idx !== -1) {
        window._cachedEvents[idx] = { ...window._cachedEvents[idx], status: 'Completed' };
      }
    }

    showToast(`✅ "${event.customer}" event marked as Finished!`, 'success');
    if (typeof window.render === 'function') window.render();
  } catch (err) {
    console.error('Failed to update event status:', err);
    showToast('Failed to mark event as finished', 'error');
  }
}

/**
 * Filter event list by a specific booking date
 */
export function filterEventByDate(dateStr) {
  if (window._selectedEventDate === dateStr) {
    // Toggle off
    window._selectedEventDate = null;
    showToast('Showing all bookings for this month', 'info');
  } else {
    window._selectedEventDate = dateStr;
    const d = new Date(dateStr);
    const label = `${d.getDate()} ${MONTH_SHORT_NAMES[d.getMonth()]}`;
    showToast(`Filtered to bookings on ${label}`, 'info');
  }

  if (typeof window.applyEventFilters === 'function') {
    window.applyEventFilters();
  } else if (typeof window.render === 'function') {
    window.render();
  }
}

/**
 * Clear the specific date filter
 */
export function clearEventDateFilter() {
  window._selectedEventDate = null;
  if (typeof window.applyEventFilters === 'function') {
    window.applyEventFilters();
  } else if (typeof window.render === 'function') {
    window.render();
  }
}

/**
 * Navigate to next / previous month in Month-wise overview
 */
export function navigateEventMonth(offset) {
  const now = new Date();
  let currentMonthIdx = (window._selectedEventMonth === 'all' || window._selectedEventMonth === undefined)
    ? now.getMonth()
    : parseInt(window._selectedEventMonth, 10);

  let year = window._monthBookingYear || now.getFullYear();
  let newMonthIdx = currentMonthIdx + offset;

  if (newMonthIdx < 0) {
    newMonthIdx = 11;
    year -= 1;
  } else if (newMonthIdx > 11) {
    newMonthIdx = 0;
    year += 1;
  }

  window._monthBookingYear = year;
  window._selectedEventMonth = newMonthIdx;
  window._selectedEventDate = null; // reset date filter when changing month

  // Sync with top dropdown if present
  const monthSelect = document.querySelector('select[onchange*="filterEventByMonthSelect"]');
  if (monthSelect) {
    monthSelect.value = String(newMonthIdx);
  }

  if (typeof window.render === 'function') {
    window.render();
  }
}

/**
 * Renders the complete Month-Wise Bookings Dashboard & Schedule Widget
 */
export function renderMonthBookingOverviewWidget(events = [], selectedMonth = 'all') {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentYear = window._monthBookingYear || now.getFullYear();
  
  const isAllMonths = (selectedMonth === 'all' || selectedMonth === undefined);

  let activeEvents = [];
  let displayTitle = '';
  let billingSubtitle = '';
  let datesSectionTitle = '';
  let emptyStateText = '';
  let activeMonthIdx = now.getMonth();

  if (isAllMonths) {
    activeEvents = [...events];
    displayTitle = 'All Months';
    billingSubtitle = 'Billing across All Months';
    emptyStateText = 'No event bookings found across all months.';
  } else {
    activeMonthIdx = parseInt(selectedMonth, 10);
    if (isNaN(activeMonthIdx) || activeMonthIdx < 0 || activeMonthIdx > 11) {
      activeMonthIdx = now.getMonth();
    }
    const activeMonthName = MONTH_NAMES[activeMonthIdx];
    const activeMonthShort = MONTH_SHORT_NAMES[activeMonthIdx];
    displayTitle = `${activeMonthName} ${currentYear}`;
    billingSubtitle = `Billing for ${activeMonthShort}`;
    emptyStateText = `No event bookings scheduled for ${activeMonthName} ${currentYear} yet.`;

    activeEvents = events.filter(e => {
      if (!e.date) return false;
      const parts = String(e.date).split('T')[0].split('-');
      if (parts.length < 2) return false;
      return (parseInt(parts[1], 10) - 1) === activeMonthIdx;
    });
  }

  // Calculate 6 Core Metrics
  const totalCount = activeEvents.length;
  const totalRevenue = activeEvents.reduce((sum, e) => sum + (Number(e.total) || 0), 0);
  const advanceAmount = activeEvents.reduce((sum, e) => sum + (Number(e.advance) || 0), 0);
  const pendingAmount = activeEvents.reduce((sum, e) => sum + (Number(e.pending) || 0), 0);
  const finishedCount = activeEvents.filter(e => e.status === 'Completed').length;
  const upcomingCount = activeEvents.filter(e => e.date && e.date >= todayStr && e.status !== 'Completed').length;

  // "Finished But Not Updated" events (date < todayStr && status !== 'Completed')
  const overdueEventsToShow = activeEvents.filter(e => e.date && e.date < todayStr && e.status !== 'Completed');

  // Group events by date for the booking dates strip
  const datesMap = {};
  activeEvents.forEach(e => {
    if (!e.date) return;
    const dateKey = String(e.date).split('T')[0];
    if (!datesMap[dateKey]) {
      datesMap[dateKey] = [];
    }
    datesMap[dateKey].push(e);
  });

  // Sort dates chronologically
  const sortedDates = Object.keys(datesMap).sort();

  // Next booking date
  const upcomingInGroup = sortedDates.filter(d => d >= todayStr);
  const nextBookingDateStr = upcomingInGroup.length > 0 ? upcomingInGroup[0] : null;
  let nextUpcomingLabel = 'None scheduled';
  if (nextBookingDateStr) {
    const nextD = new Date(nextBookingDateStr + 'T00:00:00');
    nextUpcomingLabel = `Next: ${nextD.getDate()} ${MONTH_SHORT_NAMES[nextD.getMonth()]}`;
  }

  if (isAllMonths) {
    datesSectionTitle = `All Booking Dates (${sortedDates.length} Dates Booked · ${totalCount} Events)`;
  } else {
    datesSectionTitle = `${MONTH_NAMES[activeMonthIdx]} Booking Dates (${sortedDates.length} Dates Booked · ${totalCount} Events)`;
  }

  return `
  <div class="month-overview-card" id="month-booking-dashboard">
    <!-- 6 Key Metrics Cards -->
    <div class="mob-metrics-grid">
      <!-- 1. Total Booking Count -->
      <div class="mob-metric-tile mc-tile-gold">
        <div class="mob-metric-content">
          <div class="mob-metric-label">Total Bookings</div>
          <div class="mob-metric-val">${totalCount}</div>
          <div class="mob-metric-sub">${activeEvents.length ? `${sortedDates.length} booked dates` : 'No bookings yet'}</div>
        </div>
        <div class="mob-metric-icon"><i class="ti ti-calendar-heart"></i></div>
      </div>

      <!-- 2. Total Amount -->
      <div class="mob-metric-tile mc-tile-amber">
        <div class="mob-metric-content">
          <div class="mob-metric-label">Total Package Value</div>
          <div class="mob-metric-val">₹${totalRevenue.toLocaleString('en-IN')}</div>
          <div class="mob-metric-sub">${billingSubtitle}</div>
        </div>
        <div class="mob-metric-icon"><i class="ti ti-currency-rupee"></i></div>
      </div>

      <!-- 3. Advance Collected -->
      <div class="mob-metric-tile mc-tile-teal">
        <div class="mob-metric-content">
          <div class="mob-metric-label">Advance Collected</div>
          <div class="mob-metric-val">₹${advanceAmount.toLocaleString('en-IN')}</div>
          <div class="mob-metric-sub">${totalRevenue > 0 ? Math.round((advanceAmount / totalRevenue) * 100) : 0}% received</div>
        </div>
        <div class="mob-metric-icon"><i class="ti ti-wallet"></i></div>
      </div>

      <!-- 4. Pending Amount -->
      <div class="mob-metric-tile mc-tile-rose">
        <div class="mob-metric-content">
          <div class="mob-metric-label">Pending Amount</div>
          <div class="mob-metric-val" style="color:${pendingAmount > 0 ? '#ef4444' : '#10b981'};">
            ₹${pendingAmount.toLocaleString('en-IN')}
          </div>
          <div class="mob-metric-sub">${pendingAmount > 0 ? 'To collect on events' : 'All settled 🎉'}</div>
        </div>
        <div class="mob-metric-icon"><i class="ti ti-alert-triangle"></i></div>
      </div>

      <!-- 5. Finished (Completed) Count -->
      <div class="mob-metric-tile mc-tile-green">
        <div class="mob-metric-content">
          <div class="mob-metric-label">Finished Events</div>
          <div class="mob-metric-val">${finishedCount}</div>
          <div class="mob-metric-sub">${totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 0}% completed</div>
        </div>
        <div class="mob-metric-icon"><i class="ti ti-circle-check"></i></div>
      </div>

      <!-- 6. Upcoming Count -->
      <div class="mob-metric-tile mc-tile-purple">
        <div class="mob-metric-content">
          <div class="mob-metric-label">Upcoming Events</div>
          <div class="mob-metric-val">${upcomingCount}</div>
          <div class="mob-metric-sub">${nextUpcomingLabel}</div>
        </div>
        <div class="mob-metric-icon"><i class="ti ti-clock-play"></i></div>
      </div>
    </div>

    <!-- ⚠️ FINISHED BUT NOT UPDATED ALERT SECTION -->
    ${renderOverdueUnupdatedSection(overdueEventsToShow, todayStr, isAllMonths ? 'All Months' : MONTH_NAMES[activeMonthIdx], selectedMonth)}

    <!-- MONTH-WISE BOOKING DATES STRIP -->
    <div class="mob-dates-section">
      <div class="mob-dates-header">
        <div class="mob-dates-title">
          <i class="ti ti-calendar-check" style="color:#f5c842;"></i>
          <span>${datesSectionTitle}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${window._selectedEventDate ? `
            <button class="mob-clear-date-btn" onclick="window.clearEventDateFilter()">
              <i class="ti ti-x"></i> Clear Date Filter (${new Date(window._selectedEventDate).getDate()} ${MONTH_SHORT_NAMES[new Date(window._selectedEventDate).getMonth()]})
            </button>
          ` : ''}
          <span class="mob-dates-hint">
            <i class="ti ti-hand-finger"></i> Tap any date card to filter list below
          </span>
        </div>
      </div>

      ${sortedDates.length === 0 ? `
        <div class="mob-no-dates-box">
          <div class="mob-no-dates-icon">
            <i class="ti ti-calendar-off"></i>
          </div>
          <div class="mob-no-dates-text">
            ${emptyStateText}
          </div>
          <button class="btn btn-gold btn-sm" onclick="window.openEventCustomerForm(null, '${currentYear}-${String(activeMonthIdx + 1).padStart(2, '0')}-15')" style="margin-top:10px;">
            <i class="ti ti-plus"></i> Add Event Booking
          </button>
        </div>
      ` : `
        <div class="mob-dates-scroll scrollbar-hide" id="month-booking-dates-strip">
          ${sortedDates.map(dateStr => {
            const evts = datesMap[dateStr];
            const dateObj = new Date(dateStr + 'T00:00:00');
            const dayOfWeek = DAY_NAMES[dateObj.getDay()];
            const dayNum = dateObj.getDate();
            const cardMonthShort = MONTH_SHORT_NAMES[dateObj.getMonth()];
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            const isSelected = window._selectedEventDate === dateStr;

            // Check if any event on this date is overdue/unupdated
            const hasOverdueUnupdated = evts.some(e => isPast && e.status !== 'Completed');
            const allCompleted = evts.every(e => e.status === 'Completed');
            const totalOnDate = evts.reduce((s, e) => s + (Number(e.total) || 0), 0);
            const pendingOnDate = evts.reduce((s, e) => s + (Number(e.pending) || 0), 0);

            // Primary client preview
            const clientNames = evts.map(e => e.customer).join(', ');
            const funcTypes = evts.map(e => e.type).join(', ');

            let statusBadge = '';
            if (hasOverdueUnupdated) {
              statusBadge = `<span class="badge-status-overdue"><i class="ti ti-alert-circle"></i> Needs Update</span>`;
            } else if (allCompleted) {
              statusBadge = `<span class="badge-status-finished"><i class="ti ti-check"></i> Finished</span>`;
            } else if (isToday) {
              statusBadge = `<span class="badge-status-today"><i class="ti ti-sparkles"></i> Today</span>`;
            } else {
              statusBadge = `<span class="badge-status-upcoming"><i class="ti ti-clock"></i> Upcoming</span>`;
            }

            return `
              <div class="mob-date-card ${isSelected ? 'selected' : ''} ${hasOverdueUnupdated ? 'has-overdue' : ''}" 
                   onclick="window.filterEventByDate('${dateStr}')" 
                   title="Click to view bookings on ${dayOfWeek}, ${dayNum} ${cardMonthShort}">
                
                ${isSelected ? `<div class="mob-selected-pill"><i class="ti ti-check"></i> Filtered</div>` : ''}

                <div class="mob-date-top">
                  <span class="mob-day-name ${isToday ? 'today-text' : ''}">${dayOfWeek}</span>
                  ${statusBadge}
                </div>

                <div class="mob-date-middle">
                  <div class="mob-day-number ${isToday ? 'today-num' : ''}">${dayNum}</div>
                  <div class="mob-month-label">${cardMonthShort}</div>
                </div>

                <div class="mob-date-bottom">
                  <div class="mob-date-count">
                    <i class="ti ti-users"></i> ${evts.length} ${evts.length === 1 ? 'Booking' : 'Bookings'}
                  </div>
                  <div class="mob-date-clients" title="${clientNames}">
                    ${clientNames}
                  </div>
                  <div class="mob-date-finance">
                    <span class="mob-date-revenue">₹${totalOnDate.toLocaleString('en-IN')}</span>
                    ${pendingOnDate > 0 ? `<span class="mob-date-pending" title="Pending collection">₹${pendingOnDate.toLocaleString('en-IN')} pend</span>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  </div>
  `;
}

/**
 * Renders the "Finished But Not Updated" alert section
 */
function renderOverdueUnupdatedSection(overdueEvents, todayStr, activeMonthName, selectedMonth) {
  if (!overdueEvents || overdueEvents.length === 0) {
    return `
      <div class="mob-up-to-date-bar">
        <div style="display:flex; align-items:center; gap:8px;">
          <i class="ti ti-circle-check" style="color:#10b981; font-size:16px;"></i>
          <span style="font-size:12px; color:#cbd5e1;">All past event bookings are up to date! No un-updated events.</span>
        </div>
        <span style="font-size:11px; color:#10b981; font-weight:600;">✓ 100% Updated</span>
      </div>
    `;
  }

  return `
    <div class="mob-overdue-alert-container">
      <div class="mob-overdue-banner-head">
        <div class="mob-overdue-title-wrap">
          <div class="mob-overdue-pulsing-icon">
            <i class="ti ti-alert-triangle"></i>
          </div>
          <div>
            <div class="mob-overdue-title">
              Finished But Not Updated (${overdueEvents.length} ${overdueEvents.length === 1 ? 'Event' : 'Events'})
            </div>
            <div class="mob-overdue-desc">
              Event date has passed, but status is not marked as Finished. Tap <strong>"✓ Mark Finished"</strong> to update instantly:
            </div>
          </div>
        </div>

        <div class="mob-overdue-count-badge">
          ⚠️ Action Required: ${overdueEvents.length}
        </div>
      </div>

      <div class="mob-overdue-list">
        ${overdueEvents.map(e => {
          const daysAgo = getDaysAgoText(e.date);
          const dateObj = new Date(e.date + 'T00:00:00');
          const formattedDate = `${dateObj.getDate()} ${MONTH_SHORT_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
          const pendingAmt = Number(e.pending) || 0;
          const totalAmt = Number(e.total) || 0;
          const advanceAmt = Number(e.advance) || 0;

          return `
            <div class="mob-overdue-item-card" id="overdue-item-${e.id}">
              <div class="mob-overdue-main">
                <div class="mob-overdue-item-top">
                  <span class="mob-overdue-date-pill">
                    <i class="ti ti-calendar-x"></i> ${formattedDate} (${daysAgo})
                  </span>
                  <span class="mob-overdue-type-badge">${e.type || 'Event'}</span>
                  ${e.makeup_type ? `<span class="mob-overdue-makeup-badge">${e.makeup_type}</span>` : ''}
                </div>

                <div class="mob-overdue-customer-row">
                  <span class="mob-overdue-customer-name">${e.customer}</span>
                  ${e.phone ? `<span class="mob-overdue-phone"><i class="ti ti-phone"></i> ${e.phone}</span>` : ''}
                  ${e.location ? `<span class="mob-overdue-location"><i class="ti ti-map-pin"></i> ${e.location}</span>` : ''}
                </div>

                <div class="mob-overdue-financials">
                  <span>Total: <strong>₹${totalAmt.toLocaleString('en-IN')}</strong></span>
                  <span>Advance: <strong>₹${advanceAmt.toLocaleString('en-IN')}</strong></span>
                  ${pendingAmt > 0 ? `
                    <span class="mob-overdue-pending-alert">
                      <i class="ti ti-alert-circle"></i> Pending Balance: ₹${pendingAmt.toLocaleString('en-IN')}
                    </span>
                  ` : `
                    <span class="mob-overdue-paid-badge">
                      <i class="ti ti-check"></i> Fully Paid
                    </span>
                  `}
                </div>
              </div>

              <div class="mob-overdue-actions">
                <button class="btn btn-gold mob-btn-finish" onclick="window.quickMarkEventFinished('${e.id}')" title="Mark this event as Finished / Completed">
                  <i class="ti ti-check"></i> Mark Finished
                </button>
                ${pendingAmt > 0 ? `
                  <button class="btn btn-outline mob-btn-collect" onclick="window.openEventCollectPaymentModal('${e.id}')" title="Collect pending payment balance">
                    <i class="ti ti-cash"></i> Collect & Settle
                  </button>
                ` : ''}
                <button class="mob-btn-icon-edit" onclick="window.openEventCustomerForm('${e.id}')" title="Edit booking details">
                  <i class="ti ti-edit"></i>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Bind methods to window for inline onclick execution
window.quickMarkEventFinished = quickMarkEventFinished;
window.filterEventByDate = filterEventByDate;
window.clearEventDateFilter = clearEventDateFilter;
window.navigateEventMonth = navigateEventMonth;
window.renderMonthBookingOverviewWidget = renderMonthBookingOverviewWidget;
