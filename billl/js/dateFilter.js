// billl/js/dateFilter.js
// Custom "Filter by" modal with Day, Week, Month, Year, Custom tabs & calendar picker

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const DAY_SHORT_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTwoDigits(n) {
  return String(n).padStart(2, '0');
}

export function getWeekStartStr(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sun, 1 is Mon
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const monday = new Date(date.setDate(diff));
  return `${monday.getFullYear()}-${formatTwoDigits(monday.getMonth() + 1)}-${formatTwoDigits(monday.getDate())}`;
}

export function getWeekEndStr(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? 0 : 7); // Sunday end
  const sunday = new Date(date.setDate(diff));
  return `${sunday.getFullYear()}-${formatTwoDigits(sunday.getMonth() + 1)}-${formatTwoDigits(sunday.getDate())}`;
}

// Module filter state registry
window._moduleDateFilters = window._moduleDateFilters || {};

export function getModuleDateFilter(moduleName = 'customers') {
  if (!window._moduleDateFilters[moduleName]) {
    const now = new Date();
    window._moduleDateFilters[moduleName] = {
      mode: 'month', // 'day' | 'week' | 'month' | 'year' | 'custom' | 'all'
      selectedDay: `${now.getFullYear()}-${formatTwoDigits(now.getMonth() + 1)}-${formatTwoDigits(now.getDate())}`,
      selectedWeekStart: getWeekStartStr(now),
      selectedWeekEnd: getWeekEndStr(now),
      selectedMonth: now.getMonth(), // 0-11
      selectedYear: now.getFullYear(),
      customStartDate: '',
      customEndDate: '',
      navYear: now.getFullYear(),
      navMonth: now.getMonth()
    };
  }
  return window._moduleDateFilters[moduleName];
}

export function isDateInModuleFilter(dateStr, moduleName = 'customers') {
  const filter = getModuleDateFilter(moduleName);
  if (!filter || filter.mode === 'all') return true;
  if (!dateStr) return false;

  const d = String(dateStr).split('T')[0];
  const parts = d.split('-');
  if (parts.length < 3) return false;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;

  if (filter.mode === 'day') {
    return d === filter.selectedDay;
  }
  if (filter.mode === 'week') {
    return d >= filter.selectedWeekStart && d <= filter.selectedWeekEnd;
  }
  if (filter.mode === 'month') {
    const yMatch = (!filter.selectedYear || filter.selectedYear === 'all') ? true : (y === parseInt(filter.selectedYear, 10));
    const mMatch = (filter.selectedMonth === 'all' || filter.selectedMonth === undefined) ? true : (m === parseInt(filter.selectedMonth, 10));
    return yMatch && mMatch;
  }
  if (filter.mode === 'year') {
    if (filter.selectedYear === 'all') return true;
    return y === parseInt(filter.selectedYear, 10);
  }
  if (filter.mode === 'custom') {
    if (filter.customStartDate && filter.customEndDate) {
      return d >= filter.customStartDate && d <= filter.customEndDate;
    }
    if (filter.customStartDate) return d >= filter.customStartDate;
    if (filter.customEndDate) return d <= filter.customEndDate;
    return true;
  }
  return true;
}

export function getModuleDateFilterLabel(moduleName = 'customers') {
  const filter = getModuleDateFilter(moduleName);
  if (!filter || filter.mode === 'all') return 'All Time';

  if (filter.mode === 'day') {
    if (!filter.selectedDay) return 'Day Filter';
    const parts = filter.selectedDay.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[2], 10)} ${MONTH_SHORT_NAMES[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
    }
    return filter.selectedDay;
  }

  if (filter.mode === 'week') {
    const sParts = (filter.selectedWeekStart || '').split('-');
    const eParts = (filter.selectedWeekEnd || '').split('-');
    if (sParts.length === 3 && eParts.length === 3) {
      return `${parseInt(sParts[2], 10)} ${MONTH_SHORT_NAMES[parseInt(sParts[1], 10) - 1]} - ${parseInt(eParts[2], 10)} ${MONTH_SHORT_NAMES[parseInt(eParts[1], 10) - 1]}`;
    }
    return 'This Week';
  }

  if (filter.mode === 'month') {
    if (filter.selectedMonth === 'all') {
      return filter.selectedYear === 'all' ? 'All Months' : `All Months ${filter.selectedYear}`;
    }
    const mName = MONTH_NAMES[filter.selectedMonth] || 'Month';
    const yName = filter.selectedYear === 'all' ? '' : filter.selectedYear;
    return `${mName} ${yName}`.trim();
  }

  if (filter.mode === 'year') {
    return filter.selectedYear === 'all' ? 'All Years' : `Year ${filter.selectedYear}`;
  }

  if (filter.mode === 'custom') {
    if (filter.customStartDate && filter.customEndDate) {
      return `${filter.customStartDate} to ${filter.customEndDate}`;
    }
    return 'Custom Range';
  }

  return 'Filter by Date';
}

export function renderDateFilterTrigger(moduleName = 'customers') {
  const filter = getModuleDateFilter(moduleName);
  const label = getModuleDateFilterLabel(moduleName);
  const isFiltered = filter.mode !== 'all';

  return `
    <div class="df-trigger-wrap" style="display:inline-flex; align-items:center; gap:6px;">
      <button type="button" class="df-trigger-btn ${isFiltered ? 'is-active' : ''}" onclick="window.openDateFilterModal('${moduleName}')" title="Filter by Day, Week, Month, Year, Custom">
        <i class="ti ti-calendar" style="font-size:15px; color:#0b3b24;"></i>
        <span class="df-trigger-text">${label}</span>
        <i class="ti ti-chevron-down" style="font-size:12px; color:#6b7280; margin-left:2px;"></i>
      </button>
      ${isFiltered ? `
        <button type="button" class="df-trigger-clear-btn" onclick="window.clearDateFilterModule('${moduleName}')" title="Reset filter to All Time">
          <i class="ti ti-x"></i>
        </button>
      ` : ''}
    </div>
  `;
}

// ─────────────────────────────────────────────
// MODAL STATE & ACTIONS
// ─────────────────────────────────────────────

window._activeFilterModule = 'customers';
window._tempFilterState = null;

export function openDateFilterModal(moduleName = 'customers') {
  window._activeFilterModule = moduleName;
  const current = getModuleDateFilter(moduleName);
  window._tempFilterState = JSON.parse(JSON.stringify(current));

  // Default to 'month' mode view matching user design
  if (!window._tempFilterState.mode || window._tempFilterState.mode === 'all') {
    window._tempFilterState.mode = 'month';
  }

  const now = new Date();
  if (!window._tempFilterState.navYear) {
    window._tempFilterState.navYear = (window._tempFilterState.selectedYear && window._tempFilterState.selectedYear !== 'all') ? parseInt(window._tempFilterState.selectedYear, 10) : now.getFullYear();
  }
  if (window._tempFilterState.navMonth === undefined) {
    window._tempFilterState.navMonth = (window._tempFilterState.selectedMonth !== 'all' && window._tempFilterState.selectedMonth !== undefined) ? parseInt(window._tempFilterState.selectedMonth, 10) : now.getMonth();
  }

  // Ensure navigation aligns with selected item
  if (window._tempFilterState.mode === 'day' && window._tempFilterState.selectedDay) {
    const parts = window._tempFilterState.selectedDay.split('-');
    if (parts.length === 3) {
      window._tempFilterState.navYear = parseInt(parts[0], 10);
      window._tempFilterState.navMonth = parseInt(parts[1], 10) - 1;
    }
  } else if (window._tempFilterState.mode === 'month') {
    if (window._tempFilterState.selectedYear && window._tempFilterState.selectedYear !== 'all') {
      window._tempFilterState.navYear = parseInt(window._tempFilterState.selectedYear, 10);
    }
    if (window._tempFilterState.selectedMonth !== 'all' && window._tempFilterState.selectedMonth !== undefined) {
      window._tempFilterState.navMonth = parseInt(window._tempFilterState.selectedMonth, 10);
    }
  }

  renderDateFilterModal();
}

export function closeDateFilterModal() {
  const modalEl = document.getElementById('df-filter-modal-root');
  if (modalEl) modalEl.remove();
  window._tempFilterState = null;
}

export function setDateFilterMode(mode) {
  if (!window._tempFilterState) return;
  window._tempFilterState.mode = mode;
  renderDateFilterModal();
}

export function navigateFilterNav(offset) {
  if (!window._tempFilterState) return;
  const st = window._tempFilterState;

  if (st.mode === 'year') {
    st.navYear += offset;
  } else if (st.mode === 'month') {
    if (st.selectedMonth === 'all') {
      st.navYear += offset;
      st.selectedYear = st.navYear;
    } else {
      st.navMonth += offset;
      if (st.navMonth < 0) {
        st.navMonth = 11;
        st.navYear -= 1;
      } else if (st.navMonth > 11) {
        st.navMonth = 0;
        st.navYear += 1;
      }
      st.selectedMonth = st.navMonth;
      st.selectedYear = st.navYear;
    }
  } else {
    // Navigate month for day, week, custom
    st.navMonth += offset;
    if (st.navMonth < 0) {
      st.navMonth = 11;
      st.navYear -= 1;
    } else if (st.navMonth > 11) {
      st.navMonth = 0;
      st.navYear += 1;
    }
  }
  renderDateFilterModal();
}

export function selectFilterCalendarDay(year, month, day) {
  if (!window._tempFilterState) return;
  const st = window._tempFilterState;
  const dStr = `${year}-${formatTwoDigits(month + 1)}-${formatTwoDigits(day)}`;

  if (st.mode === 'day') {
    st.selectedDay = dStr;
    st.navYear = year;
    st.navMonth = month;
  } else if (st.mode === 'week') {
    st.selectedWeekStart = getWeekStartStr(new Date(year, month, day));
    st.selectedWeekEnd = getWeekEndStr(new Date(year, month, day));
    st.selectedDay = dStr;
    st.navYear = year;
    st.navMonth = month;
  } else if (st.mode === 'custom') {
    // If neither or both set, start new range
    if (!st.customStartDate || (st.customStartDate && st.customEndDate)) {
      st.customStartDate = dStr;
      st.customEndDate = '';
    } else if (st.customStartDate && !st.customEndDate) {
      if (dStr < st.customStartDate) {
        st.customEndDate = st.customStartDate;
        st.customStartDate = dStr;
      } else {
        st.customEndDate = dStr;
      }
    }
  }

  renderDateFilterModal();
}

export function selectFilterMonthItem(monthIdx) {
  if (!window._tempFilterState) return;
  const st = window._tempFilterState;
  st.selectedMonth = monthIdx;
  st.selectedYear = st.navYear;
  renderDateFilterModal();
}

export function selectFilterYearItem(yearVal) {
  if (!window._tempFilterState) return;
  const st = window._tempFilterState;
  st.selectedYear = yearVal;
  if (yearVal !== 'all') {
    st.navYear = parseInt(yearVal, 10);
  }
  renderDateFilterModal();
}

export function handleCustomDateInputChange(field, val) {
  if (!window._tempFilterState) return;
  if (field === 'start') window._tempFilterState.customStartDate = val;
  if (field === 'end') window._tempFilterState.customEndDate = val;
}

export function applyDateFilter() {
  if (!window._tempFilterState) return;
  const mod = window._activeFilterModule || 'customers';
  window._moduleDateFilters[mod] = JSON.parse(JSON.stringify(window._tempFilterState));
  closeDateFilterModal();

  // Trigger page render or refresh
  if (typeof window.applyFilters === 'function' && mod === 'customers') {
    window.applyFilters();
  } else if (typeof window.applyEventFilters === 'function' && mod === 'events') {
    window.applyEventFilters();
  }
  if (typeof window.render === 'function') {
    window.render();
  }
}

export function clearDateFilterModule(moduleName = 'customers') {
  const mod = moduleName || window._activeFilterModule || 'customers';
  const current = getModuleDateFilter(mod);
  current.mode = 'all';
  closeDateFilterModal();

  if (typeof window.applyFilters === 'function' && mod === 'customers') {
    window.applyFilters();
  } else if (typeof window.applyEventFilters === 'function' && mod === 'events') {
    window.applyEventFilters();
  }
  if (typeof window.render === 'function') {
    window.render();
  }
}

// ─────────────────────────────────────────────
// MODAL HTML GENERATOR
// ─────────────────────────────────────────────

function renderDateFilterModal() {
  const st = window._tempFilterState || getModuleDateFilter(window._activeFilterModule);
  let root = document.getElementById('df-filter-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'df-filter-modal-root';
    document.body.appendChild(root);
  }

  const mode = st.mode; // 'day' | 'week' | 'month' | 'year' | 'custom'

  // Header navigator text:
  let navTitle = '';
  if (mode === 'year') {
    navTitle = `${st.navYear}`;
  } else {
    navTitle = `${MONTH_NAMES[st.navMonth]} ${st.navYear}`;
  }

  root.innerHTML = `
    <div class="df-modal-overlay" onclick="window.closeDateFilterModal()">
      <div class="df-modal-card" onclick="event.stopPropagation()">
        
        <div class="df-modal-inner">
          <!-- Header: Filter by & Close Icon -->
          <div class="df-modal-header">
            <h3 class="df-modal-title">Filter by</h3>
            <button type="button" class="df-close-btn" onclick="window.closeDateFilterModal()" title="Close filter">
              <i class="ti ti-x"></i>
            </button>
          </div>

          <!-- Pills Row: Day, Week, Month, Year, Custom -->
          <div class="df-pills-row">
            <button type="button" class="df-pill ${mode === 'day' ? 'is-active' : ''}" onclick="window.setDateFilterMode('day')">
              <span class="df-pill-icon">${mode === 'day' ? '✔' : ''}</span>
              <span>Day</span>
            </button>

            <button type="button" class="df-pill ${mode === 'week' ? 'is-active' : ''}" onclick="window.setDateFilterMode('week')">
              <span class="df-pill-icon">${mode === 'week' ? '✔' : ''}</span>
              <span>Week</span>
            </button>

            <button type="button" class="df-pill ${mode === 'month' ? 'is-active' : ''}" onclick="window.setDateFilterMode('month')">
              <span class="df-pill-icon">${mode === 'month' ? '✔' : ''}</span>
              <span>Month</span>
            </button>

            <button type="button" class="df-pill ${mode === 'year' ? 'is-active' : ''}" onclick="window.setDateFilterMode('year')">
              <span class="df-pill-icon">${mode === 'year' ? '✔' : ''}</span>
              <span>Year</span>
            </button>

            <button type="button" class="df-pill ${mode === 'custom' ? 'is-active' : ''}" onclick="window.setDateFilterMode('custom')">
              <span class="df-pill-icon">${mode === 'custom' ? '✔' : ''}</span>
              <span>Custom</span>
            </button>
          </div>

          <!-- Navigation Row: ← Month Year → -->
          <div class="df-nav-row">
            <button type="button" class="df-nav-arrow-btn" onclick="window.navigateFilterNav(-1)" title="Previous">
              <i class="ti ti-arrow-left"></i>
            </button>
            <div class="df-nav-label">${navTitle}</div>
            <button type="button" class="df-nav-arrow-btn" onclick="window.navigateFilterNav(1)" title="Next">
              <i class="ti ti-arrow-right"></i>
            </button>
          </div>

          <!-- Dynamic Body Area based on Tab Mode -->
          <div class="df-body-area">
            ${renderFilterModeBody(st)}
          </div>
        </div>

        <!-- Footer / Full Width Apply Action -->
        <div class="df-footer">
          <button type="button" class="df-apply-btn" onclick="window.applyDateFilter()">
            Apply
          </button>
          <div class="df-reset-container">
            <button type="button" class="df-all-time-link" onclick="window.clearDateFilterModule('${window._activeFilterModule}')">
              Reset filter to All Time
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderFilterModeBody(st) {
  if (st.mode === 'day' || st.mode === 'week') {
    return renderCalendarGrid(st);
  }
  if (st.mode === 'month') {
    return renderMonthsGrid(st);
  }
  if (st.mode === 'year') {
    return renderYearsGrid(st);
  }
  if (st.mode === 'custom') {
    return renderCustomRangeView(st);
  }
  return '';
}

function renderCalendarGrid(st) {
  const year = st.navYear;
  const month = st.navMonth;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // First day of month (0 is Sun, 1 is Mon) -> We treat Monday as first column (0..6)
  const firstDay = new Date(year, month, 1).getDay();
  const startCol = (firstDay === 0) ? 6 : firstDay - 1;

  const cells = [];

  // Trailing days from previous month
  for (let i = startCol - 1; i >= 0; i--) {
    const prevD = prevMonthDays - i;
    const prevM = (month === 0) ? 11 : month - 1;
    const prevY = (month === 0) ? year - 1 : year;
    const dStr = `${prevY}-${formatTwoDigits(prevM + 1)}-${formatTwoDigits(prevD)}`;
    cells.push({
      day: prevD,
      dStr,
      isCurrentMonth: false,
      year: prevY,
      month: prevM
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${formatTwoDigits(month + 1)}-${formatTwoDigits(d)}`;
    cells.push({
      day: d,
      dStr,
      isCurrentMonth: true,
      year,
      month
    });
  }

  // Leading days of next month
  let nextDay = 1;
  const remainder = cells.length % 7;
  const needed = remainder === 0 ? 0 : 7 - remainder;
  for (let i = 0; i < needed; i++) {
    const nextM = (month === 11) ? 0 : month + 1;
    const nextY = (month === 11) ? year + 1 : year;
    const dStr = `${nextY}-${formatTwoDigits(nextM + 1)}-${formatTwoDigits(nextDay)}`;
    cells.push({
      day: nextDay++,
      dStr,
      isCurrentMonth: false,
      year: nextY,
      month: nextM
    });
  }

  return `
    <div class="df-calendar-container">
      <!-- Days of Week Header -->
      <div class="df-calendar-weekdays">
        ${DAY_SHORT_NAMES.map(name => `<div class="df-weekday-col">${name.charAt(0)}</div>`).join('')}
      </div>

      <!-- Calendar Days Grid -->
      <div class="df-calendar-grid">
        ${cells.map(c => {
          let isSelected = false;
          let isInWeekRange = false;

          if (st.mode === 'day') {
            isSelected = (c.dStr === st.selectedDay);
          } else if (st.mode === 'week') {
            if (st.selectedWeekStart && st.selectedWeekEnd) {
              isInWeekRange = (c.dStr >= st.selectedWeekStart && c.dStr <= st.selectedWeekEnd);
              isSelected = (c.dStr === st.selectedDay);
            }
          }

          const cellClass = [
            'df-day-cell',
            c.isCurrentMonth ? 'is-curr-month' : 'is-other-month',
            isSelected ? 'is-selected' : '',
            isInWeekRange ? 'is-in-week' : ''
          ].filter(Boolean).join(' ');

          return `
            <div class="${cellClass}" onclick="window.selectFilterCalendarDay(${c.year}, ${c.month}, ${c.day})">
              <span>${c.day}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderMonthsGrid(st) {
  const selectedM = st.selectedMonth;
  const selectedY = st.selectedYear;
  const isAllMonthsSelected = (selectedM === 'all');

  return `
    <div class="df-months-wrapper">
      <div style="margin-bottom:12px; display:flex; justify-content:center;">
        <button type="button" class="df-quick-choice-btn ${isAllMonthsSelected ? 'is-active' : ''}" onclick="window.selectFilterMonthItem('all')">
          📅 All Months (${st.navYear})
        </button>
      </div>

      <div class="df-months-grid">
        ${MONTH_SHORT_NAMES.map((name, idx) => {
          const isSelected = (!isAllMonthsSelected && selectedM === idx && String(selectedY) === String(st.navYear));
          return `
            <button type="button" class="df-month-box ${isSelected ? 'is-selected' : ''}" onclick="window.selectFilterMonthItem(${idx})">
              ${name}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderYearsGrid(st) {
  const currentYear = new Date().getFullYear();
  const yearList = ['all', currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  const selectedY = st.selectedYear;

  return `
    <div class="df-years-wrapper">
      <div class="df-years-grid">
        ${yearList.map(y => {
          const isSelected = (String(selectedY) === String(y));
          const label = (y === 'all') ? '🗓️ All Years' : `🗓️ ${y}`;
          return `
            <button type="button" class="df-year-box ${isSelected ? 'is-selected' : ''}" onclick="window.selectFilterYearItem('${y}')">
              ${label}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCustomRangeView(st) {
  return `
    <div class="df-custom-wrapper">
      <div style="font-size:12px; color:#4b5563; margin-bottom:12px; text-align:center;">
        Select start & end dates:
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
        <div>
          <label style="font-size:11px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">From Date:</label>
          <input type="date" class="form-input" style="height:36px; font-size:13px; width:100%; border-radius:8px;" value="${st.customStartDate || ''}" onchange="window.handleCustomDateInputChange('start', this.value)">
        </div>
        <div>
          <label style="font-size:11px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">To Date:</label>
          <input type="date" class="form-input" style="height:36px; font-size:13px; width:100%; border-radius:8px;" value="${st.customEndDate || ''}" onchange="window.handleCustomDateInputChange('end', this.value)">
        </div>
      </div>
      ${renderCalendarGrid(st)}
    </div>
  `;
}

// Bind methods to window for inline onclick handlers
window.openDateFilterModal = openDateFilterModal;
window.closeDateFilterModal = closeDateFilterModal;
window.setDateFilterMode = setDateFilterMode;
window.navigateFilterNav = navigateFilterNav;
window.selectFilterCalendarDay = selectFilterCalendarDay;
window.selectFilterMonthItem = selectFilterMonthItem;
window.selectFilterYearItem = selectFilterYearItem;
window.handleCustomDateInputChange = handleCustomDateInputChange;
window.applyDateFilter = applyDateFilter;
window.clearDateFilterModule = clearDateFilterModule;
