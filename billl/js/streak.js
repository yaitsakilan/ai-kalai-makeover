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

  const missedDaysCount = Math.max(0, elapsedDaysInMonth - monthActiveDaysCount);
  const missedDaysList = [];
  if (elapsedDaysInMonth > 0) {
    for (let day = 1; day <= elapsedDaysInMonth; day++) {
      const dStr = `${targetMonthPrefix}-${String(day).padStart(2, '0')}`;
      if (!activeDateSet.has(dStr)) {
        const d = new Date(targetYear, targetMonthIdx, day);
        missedDaysList.push({
          dayNum: day,
          dayName: daysOfWeek[d.getDay()],
          dateStr: dStr
        });
      }
    }
  }

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
    missedDaysCount,
    missedDaysList,
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
    targetMonthName = 'Month',
    targetYear = new Date().getFullYear(),
    isAllMonths = true,
    isCurrentMonth = true,
    monthActiveDaysCount = 0,
    elapsedDaysInMonth = 0,
    consistencyRate = 0,
    missedDaysCount = 0,
    missedDaysList = [],
    monthDays = [],
    last7Days = []
  } = streakData || {};

  const targetMonthShort = (targetMonthName || 'Month').substring(0, 3);
  const isFutureMonth = elapsedDaysInMonth === 0;

  // Auto-scroll to today or active day
  setTimeout(() => {
    const todayEl = document.querySelector('#module-month-days-strip [data-today="true"]');
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, 100);

  const daysToRender = (monthDays && monthDays.length) ? monthDays : last7Days;

  return `
  <div class="streak-widget-card" style="border-radius:14px; padding:12px 16px; margin-bottom:18px; border-left:4px solid ${missedDaysCount > 0 ? '#ef4444' : '#10b981'} !important;">
    <!-- Minimal Text Header: 5 Days Missed , Missed dates: 8, 14, 17, 18, 19, at the end Sep Month -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:13.5px;">
        <span style="font-weight:700; color:#fffbeb; font-size:15px;">
          ${isFutureMonth ? 'Upcoming Month' : (missedDaysCount === 0 ? '0 Days Missed' : `${missedDaysCount} Days Missed`)}
        </span>
        <span style="color:#94a3b8;">,</span>
        <span style="color:${missedDaysCount > 0 ? '#f87171' : '#34d399'}; font-weight:600;">
          ${isFutureMonth 
            ? 'No records yet' 
            : (missedDaysCount > 0 
                ? `Missed dates: ${missedDaysList.map(d => d.dayNum).join(', ')}` 
                : 'All days active')}
        </span>
      </div>
      <div style="font-size:12px; font-weight:700; color:#fde68a; background:rgba(245,200,66,0.12); border:1px solid rgba(245,200,66,0.28); padding:3px 10px; border-radius:12px; text-transform:capitalize;">
        ${targetMonthShort} Month
      </div>
    </div>

    <!-- Month Date Strip (1 to 30 days) -->
    <div class="scrollbar-hide" style="display:flex; gap:6px; overflow-x:auto; padding:2px 2px 6px; -webkit-overflow-scrolling:touch;" id="module-month-days-strip">
      ${daysToRender.map(day => {
        const isToday = !!day.isToday;
        const hasData = !!day.hasData;
        const isFuture = !!day.isFuture;
        const isMissed = !hasData && !isFuture;

        return `
          <div data-day-box="true" data-today="${isToday}" data-has-data="${hasData}" data-missed="${isMissed}" style="flex:0 0 44px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:6px 2px; border-radius:10px; border:1px solid rgba(245,200,66,0.15); transition:all 0.15s;" title="${day.dateStr || ''} (${day.dayName}): ${hasData ? `${day.count || 1} entry record(s)` : (isFuture ? 'Upcoming day' : 'Missed day')}">
            <span class="day-name-label" style="font-size:9px; font-weight:600; text-transform:uppercase;">${day.dayName}</span>
            <span class="day-num-label" style="font-size:12px; font-weight:700; margin:2px 0;">${day.dayNum || day.dateNum}</span>
            <span style="font-size:13px; line-height:1;">${hasData ? '🔥' : (isFuture ? '·' : '❌')}</span>
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
