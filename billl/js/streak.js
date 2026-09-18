// billl/js/streak.js
import { showModal } from './ui.js';

export function normalizeDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && dateVal.length >= 10 && dateVal.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateVal.substring(0, 10);
  }
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '';
}

export function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

export function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function calculateModuleStreak(dataArray = [], dateField = 'date', selectedMonth = 'all') {
  const activeDateSet = new Set();
  const dateCounts = {};
  dataArray.forEach(item => {
    const raw = item[dateField] || item.last_visit || item.date || item.created_at || item.scan_date || item.purchase_date;
    const norm = normalizeDate(raw);
    if (norm) {
      activeDateSet.add(norm);
      dateCounts[norm] = (dateCounts[norm] || 0) + 1;
    }
  });

  const now = new Date();
  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();
  const todayRecorded = activeDateSet.has(todayStr);
  const yesterdayRecorded = activeDateSet.has(yesterdayStr);

  // Compute current streak overall
  let currentStreak = 0;
  let startDate = new Date();
  if (!todayRecorded) {
    startDate.setDate(startDate.getDate() - 1);
  }
  while (true) {
    const checkStr = startDate.toISOString().split('T')[0];
    if (activeDateSet.has(checkStr)) {
      currentStreak++;
      startDate.setDate(startDate.getDate() - 1);
    } else {
      break;
    }
  }

  const streakBroken = !todayRecorded && !yesterdayRecorded && currentStreak === 0;

  // Compute best streak historically
  const sortedDates = Array.from(activeDateSet).sort();
  let maxStreak = 0;
  let tempStreak = 0;
  let prevDateObj = null;

  sortedDates.forEach(dStr => {
    const curDateObj = new Date(dStr);
    if (!prevDateObj) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((curDateObj - prevDateObj) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }
    if (tempStreak > maxStreak) maxStreak = tempStreak;
    prevDateObj = curDateObj;
  });

  const bestStreak = Math.max(currentStreak, maxStreak);

  // Determine Target Month & Year
  let targetYear = now.getFullYear();
  let targetMonthIdx = now.getMonth(); // 0-11
  const isAllMonths = (selectedMonth === 'all');

  if (!isAllMonths && selectedMonth !== undefined && selectedMonth !== null) {
    targetMonthIdx = parseInt(selectedMonth, 10);
    // If dates in dataset have a different year for this month, match it
    for (const dStr of activeDateSet) {
      const parts = dStr.split('-');
      if (parts.length >= 2 && (parseInt(parts[1], 10) - 1) === targetMonthIdx) {
        targetYear = parseInt(parts[0], 10);
        break;
      }
    }
  } else {
    // When "all months", use current month or latest month with data
    if (activeDateSet.size > 0) {
      const curMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const hasCurrentData = sortedDates.some(d => d.startsWith(curMonthPrefix));
      if (!hasCurrentData) {
        const latest = sortedDates[sortedDates.length - 1];
        const parts = latest.split('-');
        if (parts.length >= 2) {
          targetYear = parseInt(parts[0], 10);
          targetMonthIdx = parseInt(parts[1], 10) - 1;
        }
      }
    }
  }

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const targetMonthName = MONTH_NAMES[targetMonthIdx] || 'Month';
  const targetMonthPrefix = `${targetYear}-${String(targetMonthIdx + 1).padStart(2, '0')}`;

  // Calculate day-by-day for the entire target month
  const daysInMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthDays = [];
  let monthActiveDaysCount = 0;
  let monthTotalEntries = 0;
  let monthRunningStreak = 0;
  let monthBestStreak = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(targetYear, targetMonthIdx, day);
    const dStr = `${targetMonthPrefix}-${String(day).padStart(2, '0')}`;
    const dayName = daysOfWeek[d.getDay()];
    const hasData = activeDateSet.has(dStr);
    const count = dateCounts[dStr] || 0;
    const isToday = (dStr === todayStr);
    const isFuture = !isToday && (d > now);

    if (hasData) {
      monthActiveDaysCount++;
      monthTotalEntries += count;
      monthRunningStreak++;
      if (monthRunningStreak > monthBestStreak) monthBestStreak = monthRunningStreak;
    } else if (!isFuture) {
      monthRunningStreak = 0;
    }

    monthDays.push({
      dateStr: dStr,
      dayNum: day,
      dayName,
      hasData,
      count,
      isToday,
      isFuture
    });
  }

  // Elapsed days in target month
  const isCurrentMonth = (targetYear === now.getFullYear() && targetMonthIdx === now.getMonth());
  const elapsedDaysInMonth = isCurrentMonth 
    ? now.getDate() 
    : (new Date(targetYear, targetMonthIdx, 1) > now ? 0 : daysInMonth);
  const consistencyRate = elapsedDaysInMonth > 0 
    ? Math.round((monthActiveDaysCount / elapsedDaysInMonth) * 100) 
    : 0;

  // Last 7 days breakdown for quick reference
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    last7Days.push({
      dateStr: dStr,
      dayName: daysOfWeek[d.getDay()],
      dateNum: d.getDate(),
      isToday: (dStr === todayStr),
      hasData: activeDateSet.has(dStr)
    });
  }

  return {
    currentStreak,
    bestStreak,
    todayRecorded,
    yesterdayRecorded,
    streakBroken,
    totalEntries: dataArray.length,
    activeDaysCount: activeDateSet.size,
    targetMonthName,
    targetYear,
    isAllMonths,
    isCurrentMonth,
    monthActiveDaysCount,
    monthTotalEntries,
    monthBestStreak,
    elapsedDaysInMonth,
    daysInMonth,
    consistencyRate,
    monthDays,
    last7Days
  };
}

export function calculateMonthlyGamification(allModulesData = {}) {
  const { customers = [], expenses = [], events = [] } = allModulesData;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-based
  const currentMonthStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
  
  const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const currentDayNum = now.getDate(); // 1 to 31

  // Collect date sets for each module for current month
  const moduleDateSets = {
    customers: new Set(),
    expenses: new Set(),
    events: new Set()
  };

  const processList = (list, key, dateField = 'date') => {
    (list || []).forEach(item => {
      const raw = item[dateField] || item.created_at || item.scan_date || item.purchase_date;
      const norm = normalizeDate(raw);
      if (norm && norm.startsWith(currentMonthStr)) {
        moduleDateSets[key].add(norm);
      }
    });
  };

  processList(customers, 'customers');
  processList(expenses, 'expenses');
  processList(events, 'events');

  let totalPoints = 0;
  let activeDaysInMonth = new Set();
  let dayByDayDetails = [];

  for (let day = 1; day <= currentDayNum; day++) {
    const dStr = `${currentMonthStr}-${String(day).padStart(2, '0')}`;
    const custActive = moduleDateSets.customers.has(dStr);
    const expActive = moduleDateSets.expenses.has(dStr);
    const evtActive = moduleDateSets.events.has(dStr);

    const activeCount = (custActive?1:0) + (expActive?1:0) + (evtActive?1:0);

    if (activeCount > 0) {
      activeDaysInMonth.add(dStr);
      // 10 pts per active category
      let pts = activeCount * 10;
      // Bonus 30 pts if all 3 modules are active on the same day
      if (activeCount === 3) pts += 30;
      totalPoints += pts;
    }

    dayByDayDetails.push({
      dateStr: dStr,
      day,
      activeCount,
      custActive,
      expActive,
      evtActive
    });
  }

  const activeDaysCount = activeDaysInMonth.size;
  const missedDaysCount = Math.max(0, currentDayNum - activeDaysCount);
  const consistencyRate = currentDayNum > 0 ? Math.round((activeDaysCount / currentDayNum) * 100) : 0;

  let grade = 'C';
  let badgeColor = '#6b7280';
  let title = 'Bronze Tier 🥉';
  if (consistencyRate >= 90) { grade = 'S'; badgeColor = '#7c3aed'; title = 'Legendary Salon Tier 👑'; }
  else if (consistencyRate >= 80) { grade = 'A'; badgeColor = '#f5c842'; title = 'Gold Tier 🌟'; }
  else if (consistencyRate >= 60) { grade = 'B'; badgeColor = '#2563eb'; title = 'Silver Tier 🥈'; }

  const todayStr = getTodayStr();
  const todayMatrix = {
    customers: moduleDateSets.customers.has(todayStr),
    expenses: moduleDateSets.expenses.has(todayStr),
    events: moduleDateSets.events.has(todayStr)
  };
  const todayCompletedCount = Object.values(todayMatrix).filter(Boolean).length;

  return {
    currentMonthStr,
    monthName: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
    daysInMonth,
    currentDayNum,
    activeDaysCount,
    missedDaysCount,
    consistencyRate,
    totalPoints,
    grade,
    badgeColor,
    title,
    todayMatrix,
    todayCompletedCount,
    dayByDayDetails
  };
}

export function renderModuleStreakWidget(moduleTitle, streakData, themeColor = '#7c3aed') {
  const {
    currentStreak = 0,
    bestStreak = 0,
    todayRecorded = false,
    streakBroken = false,
    targetMonthName = 'Month',
    targetYear = new Date().getFullYear(),
    isAllMonths = true,
    isCurrentMonth = true,
    monthActiveDaysCount = 0,
    monthTotalEntries = 0,
    monthBestStreak = 0,
    elapsedDaysInMonth = 30,
    daysInMonth = 30,
    consistencyRate = 0,
    monthDays = [],
    last7Days = []
  } = streakData || {};

  const statusText = isCurrentMonth 
    ? (todayRecorded 
        ? `<span style="color:#16a34a; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-circle-check-filled"></i> Today Logged! Streak Safe</span>`
        : (streakBroken 
            ? `<span style="color:#dc2626; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-alert-circle"></i> Streak Missed — Log entry today to restart</span>`
            : `<span style="color:#d97706; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-clock"></i> Streak at Risk! Add entry today</span>`))
    : `<span style="color:#4b5563; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-calendar-event"></i> Month View: ${targetMonthName} ${targetYear}</span>`;

  // Auto-scroll to today or latest day
  setTimeout(() => {
    const todayEl = document.querySelector('#module-month-days-strip [data-today="true"]');
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, 120);
  return `
  <div class="streak-widget-card" style="background:linear-gradient(145deg, #1c1308, #130c04); border:1px solid rgba(245,200,66,0.25); border-radius:14px; padding:16px 20px; margin-bottom:20px; box-shadow:0 4px 24px rgba(0,0,0,0.35);">
    <!-- Top Header: Streak Stats & Month Consistency -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,rgba(245,200,66,0.18),rgba(217,119,6,0.1)); border:1px solid rgba(245,200,66,0.3); display:flex; align-items:center; justify-content:center; font-size:22px; color:#f5c842; box-shadow:0 2px 10px rgba(245,200,66,0.15);">
          🔥
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:17px; font-weight:700; color:#fffbeb;">
              ${isCurrentMonth ? `${currentStreak} Day${currentStreak === 1 ? '' : 's'} Streak` : `${targetMonthName} ${targetYear}`}
            </span>
            <span class="badge" style="background:rgba(245,200,66,0.12); color:#fde68a; border:1px solid rgba(245,200,66,0.28); font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px;">
              🏆 Best: ${bestStreak} Days
            </span>
            ${monthBestStreak > 0 ? `
              <span class="badge" style="background:rgba(16,185,129,0.12); color:#6ee7b7; border:1px solid rgba(16,185,129,0.25); font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px;">
                ⭐ ${targetMonthName} Best: ${monthBestStreak} Days
              </span>
            ` : ''}
            ${isAllMonths ? `
              <span class="badge" style="background:rgba(59,130,246,0.12); color:#93c5fd; border:1px solid rgba(59,130,246,0.25); font-size:11px; font-weight:500; padding:2px 8px; border-radius:20px;">
                📅 All Months (Showing ${targetMonthName})
              </span>
            ` : ''}
          </div>
          <div style="font-size:12px; margin-top:2px; color:#94a3b8;">${statusText}</div>
        </div>
      </div>

      <!-- Right summary metrics -->
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <div style="font-size:11.5px; color:#e2e8f0; background:#221609; padding:6px 12px; border-radius:8px; border:1px solid rgba(245,200,66,0.2); display:flex; align-items:center; gap:6px;">
          <span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block;"></span>
          <strong>${monthActiveDaysCount}</strong> / ${elapsedDaysInMonth || daysInMonth} Active Days (${consistencyRate}%)
        </div>
        <div style="font-size:11.5px; color:#e2e8f0; background:#221609; padding:6px 12px; border-radius:8px; border:1px solid rgba(245,200,66,0.2);">
          <strong>${monthTotalEntries}</strong> entries in ${targetMonthName}
        </div>
      </div>
    </div>

    <!-- Day-by-Day Month Tracker Header -->
    <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:11px; font-weight:600; color:#cbd5e1; text-transform:uppercase; letter-spacing:0.05em; display:flex; align-items:center; gap:6px;">
        <i class="ti ti-calendar"></i> ${targetMonthName} ${targetYear} — Daily Entries Calendar (${daysInMonth} Days)
      </div>
      <div style="font-size:11px; color:#94a3b8; display:flex; align-items:center; gap:4px;">
        <span>Swipe / Scroll &rarr;</span>
      </div>
    </div>

    <!-- Scrollable Month Days Strip -->
    <div class="scrollbar-hide" style="display:flex; gap:6px; overflow-x:auto; padding:4px 2px 8px; -webkit-overflow-scrolling:touch;" id="module-month-days-strip">
      ${(monthDays && monthDays.length ? monthDays : last7Days).map(day => {
        const isToday = !!day.isToday;
        const hasData = !!day.hasData;
        const isFuture = !!day.isFuture;
        const bg = isToday 
          ? (hasData ? '#2e1c08' : '#221508') 
          : (hasData ? 'rgba(16,185,129,0.12)' : (isFuture ? '#170f06' : '#1a1207'));
        const border = isToday 
          ? '2px solid #f5c842' 
          : (hasData ? '1px solid rgba(16,185,129,0.3)' : (isFuture ? '1px dashed rgba(245,200,66,0.12)' : '1px solid rgba(245,200,66,0.15)'));
        const dayColor = isToday ? '#fde68a' : (hasData ? '#6ee7b7' : '#94a3b8');
        const numColor = isToday ? '#fffbeb' : (hasData ? '#a7f3d0' : (isFuture ? '#64748b' : '#cbd5e1'));
        const shadow = isToday ? '0 2px 8px rgba(245,200,66,0.25)' : (hasData ? '0 1px 4px rgba(16,185,129,0.2)' : 'none');

        return `
          <div data-today="${isToday ? 'true' : 'false'}" style="flex:0 0 46px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:7px 2px; border-radius:10px; background:${bg}; border:${border}; box-shadow:${shadow}; transition:all 0.15s;" title="${day.dateStr || ''} (${day.dayName}): ${hasData ? `${day.count || 1} ${moduleTitle.toLowerCase()} record(s)` : (isFuture ? 'Upcoming day' : 'No entry')}">
            <span style="font-size:9.5px; font-weight:600; color:${dayColor}; text-transform:uppercase;">${day.dayName}</span>
            <span style="font-size:12px; font-weight:700; color:${numColor}; margin:2px 0;">${day.dayNum || day.dateNum}</span>
            <span style="font-size:13px; line-height:1;">${hasData ? '🔥' : (isFuture ? '·' : '❌')}</span>
            ${day.count > 1 ? `<span style="font-size:9px; font-weight:700; color:#16a34a; background:rgba(22,163,74,0.15); border-radius:8px; padding:0 4px; margin-top:2px; line-height:1.3;">${day.count}</span>` : ''}
            ${isToday ? `<span style="font-size:8px; font-weight:800; color:#f5c842; text-transform:uppercase; margin-top:2px;">Today</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  </div>`;
}

export function showMonthlyReportModal(allModulesData) {
  const stats = calculateMonthlyGamification(allModulesData);

  showModal(`End-of-Month Performance Report — ${stats.monthName}`, `
    <div style="text-align:center; padding:10px 0 20px;">
      <div style="width:64px; height:64px; border-radius:20px; background:${stats.badgeColor}15; color:${stats.badgeColor}; display:inline-flex; align-items:center; justify-content:center; font-size:32px; margin-bottom:10px; border:1px solid ${stats.badgeColor}40;">
        🏅
      </div>
      <h3 style="font-size:20px; font-weight:700; color:#1f2937; margin:0;">${stats.title}</h3>
      <div style="font-size:13px; color:#6b7280; margin-top:4px;">Monthly Maintenance Consistency Score</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:20px;">
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:12px; text-align:center;">
        <div style="font-size:11px; color:#166534; font-weight:600;">Active Days</div>
        <div style="font-size:22px; font-weight:800; color:#15803d; margin-top:2px;">${stats.activeDaysCount}</div>
        <div style="font-size:10px; color:#166534;">out of ${stats.currentDayNum} days</div>
      </div>
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:12px; text-align:center;">
        <div style="font-size:11px; color:#991b1b; font-weight:600;">Days Missed</div>
        <div style="font-size:22px; font-weight:800; color:#dc2626; margin-top:2px;">${stats.missedDaysCount}</div>
        <div style="font-size:10px; color:#991b1b;">incomplete days</div>
      </div>
      <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:12px; padding:12px; text-align:center;">
        <div style="font-size:11px; color:#5b21b6; font-weight:600;">Total Points</div>
        <div style="font-size:22px; font-weight:800; color:#7c3aed; margin-top:2px;">${stats.totalPoints.toLocaleString()}</div>
        <div style="font-size:10px; color:#5b21b6;">earned pts</div>
      </div>
    </div>

    <div style="background:#fafafa; border:1px solid #f0f0f0; border-radius:12px; padding:14px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; color:#374151; margin-bottom:6px;">
        <span>Consistency Rate</span>
        <span>${stats.consistencyRate}%</span>
      </div>
      <div style="background:#e5e7eb; border-radius:6px; height:8px; overflow:hidden;">
        <div style="height:100%; width:${stats.consistencyRate}%; background:linear-gradient(90deg, #7c3aed, #f59e0b); border-radius:6px;"></div>
      </div>
    </div>

    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:12px 16px; font-size:12px; color:#92400e; display:flex; align-items:center; gap:10px;">
      <i class="ti ti-refresh" style="font-size:18px; color:#d97706;"></i>
      <div>
        <strong>Monthly Reset Notice:</strong> On the 1st of next month, your active daily streak counter and points will start fresh for the new month while keeping this result in history!
      </div>
    </div>
  `, null);

  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';
}

window.showMonthlyReportModal = showMonthlyReportModal;
