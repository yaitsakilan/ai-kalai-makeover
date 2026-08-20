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

export function calculateModuleStreak(dataArray = [], dateField = 'date') {
  const activeDateSet = new Set();
  dataArray.forEach(item => {
    const raw = item[dateField] || item.created_at || item.scan_date || item.purchase_date;
    const norm = normalizeDate(raw);
    if (norm) activeDateSet.add(norm);
  });

  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();

  const todayRecorded = activeDateSet.has(todayStr);
  const yesterdayRecorded = activeDateSet.has(yesterdayStr);

  // Compute current streak
  let currentStreak = 0;
  let startDate = new Date();
  
  // If today is not recorded yet, start checking from yesterday
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

  // Calculate 7-day breakdown (last 7 days including today)
  const last7Days = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const isToday = (dStr === todayStr);
    const dayName = daysOfWeek[d.getDay()];
    const dateNum = d.getDate();
    const hasData = activeDateSet.has(dStr);

    last7Days.push({
      dateStr: dStr,
      dayName,
      dateNum,
      isToday,
      hasData
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
  const { currentStreak, bestStreak, todayRecorded, streakBroken, last7Days } = streakData;

  const statusText = todayRecorded 
    ? `<span style="color:#16a34a; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-circle-check-filled"></i> Today Logged! Streak Safe</span>`
    : (streakBroken 
        ? `<span style="color:#dc2626; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-alert-circle"></i> Streak Missed — Log entry to start new streak</span>`
        : `<span style="color:#d97706; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="ti ti-clock"></i> Streak at Risk! Add entry today</span>`);

  return `
  <div class="streak-widget-card" style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:16px 20px; margin-bottom:20px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#fff7ed,#ffedd5); border:1px solid #fed7aa; display:flex; align-items:center; justify-content:center; font-size:22px; color:#ea580c; box-shadow:0 2px 8px rgba(234,88,12,0.15);">
          🔥
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px; font-weight:700; color:#1f2937;">${currentStreak} Day${currentStreak === 1 ? '' : 's'} Streak</span>
            <span class="badge" style="background:#fff7ed; color:#ea580c; border:1px solid #ffedd5; font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px;">
              🏆 Best: ${bestStreak} Days
            </span>
          </div>
          <div style="font-size:12px; margin-top:2px;">${statusText}</div>
        </div>
      </div>
      <div style="font-size:11.5px; color:#6b7280; background:#f9fafb; padding:6px 12px; border-radius:8px; border:1px solid #f3f4f6;">
        Daily Goal: Log at least 1 ${moduleTitle.toLowerCase()} record daily
      </div>
    </div>

    <!-- 7 Day Tracker Pills -->
    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px;">
      ${last7Days.map(day => `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 4px; border-radius:10px; background:${day.isToday ? '#fefce8' : (day.hasData ? '#f0fdf4' : '#f9fafb')}; border:${day.isToday ? '1.5px solid #f59e0b' : (day.hasData ? '1px solid #bbf7d0' : '1px solid #e5e7eb')}; transition:all 0.2s;">
          <span style="font-size:10px; font-weight:600; color:${day.isToday ? '#b45309' : '#6b7280'}; text-transform:uppercase;">${day.dayName}</span>
          <span style="font-size:11px; font-weight:700; color:#1f2937; margin:2px 0;">${day.dateNum}</span>
          <span style="font-size:14px;">${day.hasData ? '🔥' : '❌'}</span>
        </div>
      `).join('')}
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
