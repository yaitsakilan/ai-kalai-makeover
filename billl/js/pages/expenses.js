// billl/js/pages/expenses.js
import { state } from '../state.js';
import { fetchExpenses, fetchCustomers, fetchEvents, fetchAllClassPayments, fetchAllJewelRentals, addExpense, deleteExpense, fetchMonthlyBalances, saveMonthlyBalance } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay, showConfirmDelete } from '../ui.js';
import { callGroqAPI } from '../api.js';
import { formatEmpTag } from '../utils.js';

export function setExpenseTab(tab) {
  window._expenseTabFilter = tab;
  if (typeof window.render === 'function') window.render();
}

export function filterExpenseByMonth(val) {
  window._selectedExpenseMonth = val === 'all' ? 'all' : parseInt(val, 10);
  window._expenseTrendViewMode = (val === 'all' ? 'monthly' : 'daily');
  if (typeof window.render === 'function') window.render();
}

export function setExpenseTrendView(mode) {
  window._expenseTrendViewMode = mode;
  if (typeof window.render === 'function') window.render();
}



export function openExpenseFormSelector() {
  showModal('Select Expense Type to Add', `
    <div style="font-size:12.5px; color:#666; margin-bottom:16px; text-align:center;">
      Choose the expense form you would like to fill out:
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div onclick="window.closeModal(); window.openSalonProductExpenseForm();" class="expense-type-card" style="display:flex; align-items:center; gap:14px; padding:14px 16px; border:1px solid #e5e7eb; border-radius:12px; cursor:pointer; background:#fff; transition:all 0.2s;">
        <div style="width:42px; height:42px; border-radius:10px; background:#f3e8ff; color:#7c3aed; display:flex; align-items:center; justify-content:center; font-size:20px;">
          <i class="ti ti-package"></i>
        </div>
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:600; color:#1f2937;">Salon Products Form</div>
          <div style="font-size:12px; color:#6b7280;">Hair colors, developer, creams, kits & salon inventory</div>
        </div>
        <i class="ti ti-chevron-right" style="color:#9ca3af; font-size:18px;"></i>
      </div>

      <div onclick="window.closeModal(); window.openMakeupExpenseForm();" class="expense-type-card" style="display:flex; align-items:center; gap:14px; padding:14px 16px; border:1px solid #e5e7eb; border-radius:12px; cursor:pointer; background:#fff; transition:all 0.2s;">
        <div style="width:42px; height:42px; border-radius:10px; background:#fce7f3; color:#be185d; display:flex; align-items:center; justify-content:center; font-size:20px;">
          <i class="ti ti-brush"></i>
        </div>
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:600; color:#1f2937;">Makeup Items & Accessories</div>
          <div style="font-size:12px; color:#6b7280;">Hair extensions, lashes, sprays, pins & accessories</div>
        </div>
        <i class="ti ti-chevron-right" style="color:#9ca3af; font-size:18px;"></i>
      </div>

      <div onclick="window.closeModal(); window.showAddExpenseModal();" class="expense-type-card" style="display:flex; align-items:center; gap:14px; padding:14px 16px; border:1px solid #e5e7eb; border-radius:12px; cursor:pointer; background:#fff; transition:all 0.2s;">
        <div style="width:42px; height:42px; border-radius:10px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:20px;">
          <i class="ti ti-receipt"></i>
        </div>
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:600; color:#1f2937;">General Expenses Form</div>
          <div style="font-size:12px; color:#6b7280;">Rent, staff salaries, electricity, water bills, travel & utilities</div>
        </div>
        <i class="ti ti-chevron-right" style="color:#9ca3af; font-size:18px;"></i>
      </div>


      <div onclick="window.closeModal(); window.showPage('ocr');" class="expense-type-card" style="display:flex; align-items:center; gap:14px; padding:14px 16px; border:1px solid #e5e7eb; border-radius:12px; cursor:pointer; background:#fff; transition:all 0.2s;">
        <div style="width:42px; height:42px; border-radius:10px; background:#fff7ed; color:#ea580c; display:flex; align-items:center; justify-content:center; font-size:20px;">
          <i class="ti ti-scan"></i>
        </div>
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:600; color:#1f2937;">Scan Bill (AI OCR)</div>
          <div style="font-size:12px; color:#6b7280;">Upload bill receipt image or photo to extract and save expense</div>
        </div>
        <i class="ti ti-chevron-right" style="color:#9ca3af; font-size:18px;"></i>
      </div>
    </div>
  `, null);
  
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';
}

export async function renderExpenses() {
  const [allExpenses, allCustomers, allEvents, studentPayments, jewelRentals] = await Promise.all([
    fetchExpenses().catch(() => []),
    fetchCustomers().catch(() => []),
    fetchEvents().catch(() => []),
    fetchAllClassPayments().catch(() => []),
    fetchAllJewelRentals().catch(() => [])
  ]);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();

  // Initialize selected month if not set: default to current month if data exists, or latest month with data
  if (window._selectedExpenseMonth === undefined) {
    const hasCurrentMonthData = allExpenses.some(e => {
      if (!e.date) return false;
      const parts = String(e.date).split('T')[0].split('-');
      return parts.length >= 2 && (parseInt(parts[1], 10) - 1) === currentMonthIndex;
    });
    if (hasCurrentMonthData) {
      window._selectedExpenseMonth = currentMonthIndex;
    } else {
      let latestMonth = currentMonthIndex;
      let newestDateStr = '';
      allExpenses.forEach(e => {
        if (e.date && String(e.date) > newestDateStr) {
          newestDateStr = String(e.date);
          const parts = newestDateStr.split('T')[0].split('-');
          if (parts.length >= 2) {
            const m = parseInt(parts[1], 10) - 1;
            if (m >= 0 && m < 12) latestMonth = m;
          }
        }
      });
      window._selectedExpenseMonth = latestMonth;
    }
  }

  const isAllMonths = (window._selectedExpenseMonth === 'all');
  let targetYear = currentYear;
  let targetMonthIdx = currentMonthIndex;

  if (!isAllMonths && window._selectedExpenseMonth !== undefined && window._selectedExpenseMonth !== null) {
    targetMonthIdx = parseInt(window._selectedExpenseMonth, 10);
    // Find matching year for selected month if different from current year
    for (const e of allExpenses) {
      if (!e.date) continue;
      const parts = String(e.date).split('T')[0].split('-');
      if (parts.length >= 2 && (parseInt(parts[1], 10) - 1) === targetMonthIdx) {
        targetYear = parseInt(parts[0], 10);
        break;
      }
    }
  }

  const selectedMonthStr = `${targetYear}-${String(targetMonthIdx + 1).padStart(2, '0')}`;
  const selectedMonthName = `${MONTHS[targetMonthIdx]} ${targetYear}`;
  const selectedMonthLabel = isAllMonths ? 'All Time' : selectedMonthName;
  const activeTab = window._expenseTabFilter || 'all';

  // 1. Filter expenses based on selected month
  let monthExpenses = allExpenses;
  if (!isAllMonths) {
    monthExpenses = allExpenses.filter(e => {
      if (!e.date) return false;
      const parts = String(e.date).split('T')[0].split('-');
      return parts.length >= 2 && (parseInt(parts[1], 10) - 1) === targetMonthIdx;
    });
  }

  // 2. Filter expenses based on active tab
  let expenses = monthExpenses;
  if (activeTab === 'product') {
    expenses = monthExpenses.filter(e => e.category === 'Products');
  } else if (activeTab === 'general') {
    expenses = monthExpenses.filter(e => e.category !== 'Products');
  }

  const total = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const totalAllExpenses = monthExpenses.reduce((s,e)=>s+(e.amount||0),0);
  const totalGeneralExpenses = monthExpenses.filter(e => e.category !== 'Products').reduce((s,e)=>s+(e.amount||0),0);
  const totalProductExpenses = monthExpenses.filter(e => e.category === 'Products').reduce((s,e)=>s+(e.amount||0),0);

  const cats = {};
  expenses.forEach(e=>{ cats[e.category]=(cats[e.category]||0)+(e.amount||0); });

  // 3. Inflow & Outflow Tracking (Orders + Events + Expenses)
  const balanceMonthStr = isAllMonths ? `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}` : selectedMonthStr;
  const getMonthPrefix = (dStr) => dStr ? String(dStr).substring(0, 7) : '';

  const monthCustomers = isAllMonths 
    ? allCustomers 
    : allCustomers.filter(c => getMonthPrefix(c.last_visit || c.created_at) === balanceMonthStr);

  const monthEvents = isAllMonths 
    ? allEvents 
    : allEvents.filter(e => getMonthPrefix(e.date || e.created_at) === balanceMonthStr);

  const monthStudents = isAllMonths
    ? studentPayments
    : studentPayments.filter(p => getMonthPrefix(p.date || p.created_at) === balanceMonthStr);

  const monthJewels = isAllMonths
    ? jewelRentals
    : jewelRentals.filter(r => getMonthPrefix(r.start_date || r.created_at) === balanceMonthStr);

  // Inflow from Customers (Orders / Shop Services)
  let custCashIn = 0;
  let custGPayIn = 0;
  monthCustomers.forEach(c => {
    if (c.payment_status === 'paid' || !c.payment_status) {
      const svcs = (Array.isArray(c.services) ? c.services.join(' ') : (c.services || '')).toLowerCase();
      const pm = (c.payment_method || '').toLowerCase();
      
      if (svcs.includes('both') || pm.includes('both')) {
        let cashMatch = svcs.match(/cash:\s*₹?(\d+)/);
        let gpayMatch = svcs.match(/gpay:\s*₹?(\d+)/);
        if (cashMatch && gpayMatch) {
          custCashIn += parseInt(cashMatch[1], 10);
          custGPayIn += parseInt(gpayMatch[1], 10);
        } else {
          custCashIn += Math.round((c.amount || 0) / 2);
          custGPayIn += Math.round((c.amount || 0) / 2);
        }
      } else if (svcs.includes('gpay') || svcs.includes('online') || svcs.includes('upi') || pm.includes('gpay') || pm.includes('online') || pm.includes('upi')) {
        custGPayIn += (c.amount || 0);
      } else {
        custCashIn += (c.amount || 0);
      }
    }
  });

  // Inflow from Events (Bookings & Advances)
  let evtCashIn = 0;
  let evtGPayIn = 0;
  monthEvents.forEach(e => {
    const paidAmt = (e.advance || 0);
    const noteStr = ((e.additional_makeup || '') + ' ' + (e.review || '')).toLowerCase();
    if (noteStr.includes('cash:') || noteStr.includes('gpay:')) {
      let cashMatch = noteStr.match(/cash:\s*₹?(\d+)/);
      let gpayMatch = noteStr.match(/gpay:\s*₹?(\d+)/);
      if (cashMatch) evtCashIn += parseInt(cashMatch[1], 10);
      if (gpayMatch) evtGPayIn += parseInt(gpayMatch[1], 10);
      if (!cashMatch && !gpayMatch) evtGPayIn += paidAmt;
    } else {
      evtGPayIn += paidAmt;
    }
  });

  // Inflow from Academy & Jewels
  let otherCashIn = 0;
  let otherGPayIn = 0;
  monthStudents.forEach(p => {
    if ((p.payment_method || '').toLowerCase().includes('cash')) otherCashIn += (p.amount || 0);
    else otherGPayIn += (p.amount || 0);
  });
  monthJewels.forEach(r => {
    if ((r.payment_method || '').toLowerCase().includes('cash')) otherCashIn += (r.rental_fee || 0);
    else otherGPayIn += (r.rental_fee || 0);
  });

  const cashInflow = custCashIn + evtCashIn + otherCashIn;
  const gpayInflow = custGPayIn + evtGPayIn + otherGPayIn;
  const totalInflow = cashInflow + gpayInflow;

  // Expenses Outflow
  const balanceMonthExpenses = isAllMonths 
    ? allExpenses 
    : allExpenses.filter(e => (e.date || '').startsWith(balanceMonthStr));

  const cashSpent = balanceMonthExpenses.filter(e => e.payment_method === 'Cash' || !e.payment_method).reduce((sum, e) => sum + (e.amount || 0), 0);
  const gpaySpent = balanceMonthExpenses.filter(e => e.payment_method === 'GPay').reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSpent = cashSpent + gpaySpent;

  // Starting Balances
  const balances = await fetchMonthlyBalances();
  const currentBalance = balances.find(b => b.month === balanceMonthStr) || { cash_balance: 0, gpay_balance: 0 };
  const cashStarting = currentBalance.cash_balance || 0;
  const gpayStarting = currentBalance.gpay_balance || 0;
  const totalStarting = cashStarting + gpayStarting;

  // Real Remaining Balances: Starting + Inflow (Orders & Events) - Expenses Outflow
  const cashRemaining = cashStarting + cashInflow - cashSpent;
  const gpayRemaining = gpayStarting + gpayInflow - gpaySpent;
  const totalRemaining = totalStarting + totalInflow - totalSpent;

  const currentMonthName = isAllMonths ? `${MONTHS[currentMonthIndex]} ${currentYear}` : selectedMonthName;
  const hasBalances = currentBalance.cash_balance !== undefined || currentBalance.gpay_balance !== undefined;
  const showBanner = (!hasBalances || (cashStarting === 0 && gpayStarting === 0));

  // 4. Comprehensive Business Analytics
  const allMonthMap = {};
  allExpenses.forEach(e => {
    if (!e.date) return;
    const parts = String(e.date).split('T')[0].split('-');
    if (parts.length < 2) return;
    const yr = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      const key = `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
      const label = `${MONTHS[mIdx].substring(0, 3)} ${yr}`;
      if (!allMonthMap[key]) {
        allMonthMap[key] = { key, label, year: parseInt(yr, 10), monthIndex: mIdx, total: 0, count: 0, products: 0, overheads: 0 };
      }
      const amt = (e.amount || 0);
      allMonthMap[key].total += amt;
      allMonthMap[key].count += 1;
      if (e.category === 'Products' || (e.note && (e.note.includes('Products:') || e.note.includes('Makeup:')))) {
        allMonthMap[key].products += amt;
      } else {
        allMonthMap[key].overheads += amt;
      }
    }
  });

  let sortedMonths = [];
  let isMonthComparison = false;
  let prevMonthExpense = null;
  let currMonthExpense = null;
  let diffEntries = 0;
  let diffEntriesPct = 0;
  let momDiff = 0;
  let momDiffPct = 0;

  if (!isAllMonths) {
    const mTarget = targetMonthIdx;
    let selectedYear = targetYear;
    Object.values(allMonthMap).forEach(m => {
      if (m.monthIndex === mTarget) selectedYear = m.year;
    });

    const prevMonthIndex = (mTarget - 1 + 12) % 12;
    const prevYear = mTarget === 0 ? selectedYear - 1 : selectedYear;
    const prevKey = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}`;
    const prevLabel = `${MONTHS[prevMonthIndex].substring(0, 3)} ${prevYear}`;
    const selectedKey = `${selectedYear}-${String(mTarget + 1).padStart(2, '0')}`;
    const selectedLabel = `${MONTHS[mTarget].substring(0, 3)} ${selectedYear}`;

    prevMonthExpense = allMonthMap[prevKey] || { key: prevKey, label: prevLabel, year: prevYear, monthIndex: prevMonthIndex, total: 0, count: 0, products: 0, overheads: 0 };
    currMonthExpense = allMonthMap[selectedKey] || { key: selectedKey, label: selectedLabel, year: selectedYear, monthIndex: mTarget, total: 0, count: 0, products: 0, overheads: 0 };

    sortedMonths = [prevMonthExpense, currMonthExpense];
    isMonthComparison = true;

    diffEntries = currMonthExpense.count - prevMonthExpense.count;
    diffEntriesPct = prevMonthExpense.count > 0 
      ? Math.round((diffEntries / prevMonthExpense.count) * 100) 
      : (currMonthExpense.count > 0 ? 100 : 0);

    momDiff = currMonthExpense.total - prevMonthExpense.total;
    momDiffPct = prevMonthExpense.total > 0 
      ? Math.round((momDiff / prevMonthExpense.total) * 100) 
      : (currMonthExpense.total > 0 ? 100 : 0);
  } else {
    sortedMonths = Object.values(allMonthMap).sort((a, b) => a.key.localeCompare(b.key));
    isMonthComparison = false;
  }

  const peakExpenseMonth = sortedMonths.length ? [...sortedMonths].sort((a, b) => b.total - a.total)[0] : null;


  // Profitability & Burn Rate
  const netProfit = totalInflow - totalAllExpenses;
  const profitMarginPct = totalInflow > 0 ? Math.round((netProfit / totalInflow) * 100) : 0;
  const daysInMonth = isAllMonths ? 365 : new Date(targetYear, targetMonthIdx + 1, 0).getDate();
  const dailyBurn = Math.round(totalAllExpenses / (daysInMonth || 1));

  // Product Inventory vs Shop Overheads Split
  const productSpend = monthExpenses
    .filter(e => e.category === 'Products' || (e.note && (e.note.includes('Products:') || e.note.includes('Makeup:'))))
    .reduce((s, e) => s + (e.amount || 0), 0);
  const overheadSpend = Math.max(0, totalAllExpenses - productSpend);
  const productSpendPct = totalAllExpenses > 0 ? Math.round((productSpend / totalAllExpenses) * 100) : 0;
  const overheadSpendPct = totalAllExpenses > 0 ? (100 - productSpendPct) : 0;

  // Sorted Categories
  const sortedCats = Object.entries(cats)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Top Vendors / Suppliers from Product Expense notes
  const vendorMap = {};
  monthExpenses.forEach(e => {
    if (e.note) {
      const match = e.note.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        const vendor = match[1].trim();
        if (vendor && !vendor.toLowerCase().includes('cash') && !vendor.toLowerCase().includes('gpay')) {
          vendorMap[vendor] = (vendorMap[vendor] || 0) + (e.amount || 0);
        }
      }
    }
  });
  const sortedVendors = Object.entries(vendorMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // 5. Daily spending distribution for the selected month
  const dayCount = isAllMonths ? 30 : new Date(targetYear, targetMonthIdx + 1, 0).getDate();
  const dayMap = {};
  for (let d = 1; d <= dayCount; d++) {
    const dayStr = `${targetYear}-${String(targetMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dayMap[d] = {
      day: d,
      dateStr: dayStr,
      label: `${MONTHS[targetMonthIdx].substring(0, 3)} ${d}`,
      total: 0,
      count: 0,
      items: []
    };
  }

  monthExpenses.forEach(e => {
    if (!e.date) return;
    const parts = String(e.date).split('T')[0].split('-');
    if (parts.length >= 3) {
      const d = parseInt(parts[2], 10);
      if (dayMap[d]) {
        dayMap[d].total += (e.amount || 0);
        dayMap[d].count += 1;
        dayMap[d].items.push(e);
      }
    }
  });

  const dailyData = Object.values(dayMap);
  let peakDay = null;
  dailyData.forEach(d => {
    if (d.total > 0 && (!peakDay || d.total > peakDay.total)) {
      peakDay = d;
    }
  });

  const activeTrendView = window._expenseTrendViewMode || (!isAllMonths ? 'daily' : 'monthly');
  const isDailyView = (!isAllMonths && activeTrendView === 'daily');

  // Cache data for Chart.js rendering
  window._expenseAnalyticsData = {
    isAllMonths,
    targetMonthIdx,
    targetYear,
    selectedMonthName,
    dailyData,
    peakDay,
    activeTrendView,
    isDailyView,
    sortedMonths,
    peakExpenseMonth,
    currMonthExpense,
    prevMonthExpense,
    isMonthComparison,
    sortedCats,
    totalAllExpenses,
    cashSpent,
    gpaySpent,
    productSpend,
    overheadSpend,
    sortedVendors
  };

  const bannerHtml = showBanner ? `
    <div class="preview-box" style="margin-bottom:16px; border-color:#f59e0b; background:#fffbeb; padding: 14px 18px; border-radius: 12px;" id="starting-balance-banner">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <strong style="color:#b45309; font-size:13px; display:flex; align-items:center; gap:6px;"><i class="ti ti-alert-triangle" style="font-size:16px"></i> Start-of-Month Balances Not Set</strong>
          <div style="font-size:11.5px; color:#666; margin-top:2px;">Please set your starting Cash in Hand and GPay balances for <strong>${currentMonthName}</strong> to track remaining funds.</div>
        </div>
        <button class="btn btn-gold" onclick="window.showStartingBalanceModal('${balanceMonthStr}', ${cashStarting}, ${gpayStarting})" style="padding: 6px 14px; font-size:12px; height:32px;">
          <i class="ti ti-wallet"></i> Set Balances
        </button>
      </div>
    </div>
  ` : '';

  setTimeout(() => initExpenseAnalyticsCharts(), 60);

  return `
  <div class="top-bar">
    <div>
      <h2>Expenses Management</h2>
    </div>
    <div style="display:flex; gap:8px; flex-wrap: wrap; align-items:center;">
      <!-- Month Filter Select Dropdown -->
      <select class="form-input form-select" style="width:auto;height:36px;font-size:12px;padding:4px 28px 4px 10px;border-color:#e5e5e5;font-weight:500;" onchange="window.filterExpenseByMonth(this.value)" title="Choose Month Filter">
        <option value="all" ${isAllMonths ? 'selected' : ''}>📅 All Months</option>
        ${MONTHS.map((m, idx) => `
          <option value="${idx}" ${(!isAllMonths && targetMonthIdx === idx) ? 'selected' : ''}>📅 ${m}</option>
        `).join('')}
      </select>
      <button class="btn btn-outline" onclick="window.openProductExpenseForm()">
        <i class="ti ti-plus"></i> Product Expense
      </button>
      <button class="btn btn-outline" onclick="window.showAddExpenseModal()">
        <i class="ti ti-plus"></i> General Expense
      </button>
      <button class="btn btn-outline" onclick="window.analyzeExpenses()" style="border-color:#7c3aed; color:#7c3aed;" title="AI Expenses & Cost Insights">
        <i class="ti ti-sparkles"></i> AI Analysis
      </button>
      <button class="btn btn-outline" onclick="window.showPage('ocr')" style="border-color:#ea580c; color:#ea580c;">
        <i class="ti ti-scan"></i> Scan Bill
      </button>
    </div>
  </div>

  ${bannerHtml}

  <div class="metric-grid" style="margin-bottom: 20px;">
    <div class="metric-card mc-orange">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="metric-label">Cash in Hand Balance (${isAllMonths ? 'All Time' : MONTHS[targetMonthIdx]})</div>
        <button onclick="window.showStartingBalanceModal('${balanceMonthStr}', ${cashStarting}, ${gpayStarting})" style="background:none; border:none; color:#b45309; cursor:pointer; font-size:11px; padding:2px 6px; border-radius:6px; display:inline-flex; align-items:center; gap:3px;" title="Edit Starting Balances"><i class="ti ti-pencil"></i> Edit</button>
      </div>
      <div class="metric-value" style="color: ${cashRemaining >= 0 ? '#1a1a1a' : '#dc2626'}">₹${cashRemaining.toLocaleString()}</div>
      <div class="metric-sub">Start: ₹${cashStarting.toLocaleString()} · Inflow: +₹${cashInflow.toLocaleString()} · Spent: -₹${cashSpent.toLocaleString()}</div>
      <div class="metric-icon"><i class="ti ti-wallet"></i></div>
    </div>
    <div class="metric-card mc-purple">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="metric-label">GPay Balance (${isAllMonths ? 'All Time' : MONTHS[targetMonthIdx]})</div>
        <button onclick="window.showStartingBalanceModal('${balanceMonthStr}', ${cashStarting}, ${gpayStarting})" style="background:none; border:none; color:#7c3aed; cursor:pointer; font-size:11px; padding:2px 6px; border-radius:6px; display:inline-flex; align-items:center; gap:3px;" title="Edit Starting Balances"><i class="ti ti-pencil"></i> Edit</button>
      </div>
      <div class="metric-value" style="color: ${gpayRemaining >= 0 ? '#1a1a1a' : '#dc2626'}">₹${gpayRemaining.toLocaleString()}</div>
      <div class="metric-sub">Start: ₹${gpayStarting.toLocaleString()} · Inflow: +₹${gpayInflow.toLocaleString()} · Spent: -₹${gpaySpent.toLocaleString()}</div>
      <div class="metric-icon"><i class="ti ti-credit-card"></i></div>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Total Remaining Funds (${isAllMonths ? 'All Time' : MONTHS[targetMonthIdx]})</div>
      <div class="metric-value" style="color: ${totalRemaining >= 0 ? '#15803d' : '#dc2626'}">₹${totalRemaining.toLocaleString()}</div>
      <div class="metric-sub">Total Funds: ₹${(totalStarting + totalInflow).toLocaleString()} (Start: ₹${totalStarting.toLocaleString()} + In: +₹${totalInflow.toLocaleString()}) · Spent: -₹${totalSpent.toLocaleString()}</div>
      <div class="metric-icon"><i class="ti ti-cash"></i></div>
    </div>
  </div>

  <!-- 1. Financial Inflow vs Outflow & Daily Burn Rate KPIs -->
  <div class="metric-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
    <div class="metric-card mc-green">
      <div class="metric-label">Total Inflow (${selectedMonthLabel})</div>
      <div class="metric-value" style="color:#15803d">₹${totalInflow.toLocaleString()}</div>
      <div class="metric-sub">Shop + Events + Academy + Rentals</div>
      <div class="metric-icon"><i class="ti ti-arrow-up-right"></i></div>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Total Outflow (${selectedMonthLabel})</div>
      <div class="metric-value" style="color:#dc2626">₹${totalAllExpenses.toLocaleString()}</div>
      <div class="metric-sub">${monthExpenses.length} transactions recorded</div>
      <div class="metric-icon"><i class="ti ti-arrow-down-left"></i></div>
    </div>
    <div class="metric-card mc-gold">
      <div class="metric-label">Net Operating Margin</div>
      <div class="metric-value" style="color:${netProfit >= 0 ? '#166534' : '#dc2626'}">${netProfit >= 0 ? '+' : ''}₹${netProfit.toLocaleString()}</div>
      <div class="metric-sub">${profitMarginPct}% Profit Margin ${netProfit >= 0 ? '📈' : '📉'}</div>
      <div class="metric-icon"><i class="ti ti-chart-arrows"></i></div>
    </div>
    <div class="metric-card mc-blue">
      <div class="metric-label">Daily Operating Burn</div>
      <div class="metric-value" style="color:#2563eb">₹${dailyBurn.toLocaleString()}<span style="font-size:12px;font-weight:normal;color:#888;">/day</span></div>
      <div class="metric-sub">Avg spend per calendar day</div>
      <div class="metric-icon"><i class="ti ti-flame"></i></div>
    </div>
  </div>

  <!-- 📅 Monthly Spending & Outflow Trends (Like Customers Page) -->
  <div class="card" style="margin-bottom:20px; padding:20px">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px">
      <div>
        <div class="section-title" style="margin-bottom:2px">
          <i class="ti ti-chart-bar" style="color:#d97706; font-size:18px"></i>
          ${isMonthComparison && currMonthExpense && prevMonthExpense 
            ? `Monthly Trend: ${currMonthExpense.label} vs Previous Month (${prevMonthExpense.label})` 
            : 'Monthly Expense Outflow & Overhead Trend (Peak Month Analysis)'}
        </div>
        <div style="font-size:12px; color:#888">
          ${isMonthComparison && currMonthExpense && prevMonthExpense 
            ? `Comparing ${currMonthExpense.label} performance against previous month (${prevMonthExpense.label}) to evaluate spending growth & expense entries` 
            : 'Monthly breakdown showing salon expenditure & overhead trends'}
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
        ${isMonthComparison && prevMonthExpense ? `
          <div style="background:${momDiff <= 0 ? '#f0fdf4' : '#fff1f2'}; border:1px solid ${momDiff <= 0 ? '#bbf7d0' : '#fecdd3'}; border-radius:10px; padding:6px 14px; display:flex; align-items:center; gap:8px">
            <i class="ti ${momDiff <= 0 ? 'ti-trending-down' : 'ti-trending-up'}" style="color:${momDiff <= 0 ? '#16a34a' : '#e11d48'}; font-size:20px"></i>
            <div>
              <div style="font-size:10px; color:${momDiff <= 0 ? '#15803d' : '#be123c'}; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">MoM vs ${prevMonthExpense.label}</div>
              <div style="font-size:13px; font-weight:700; color:${momDiff <= 0 ? '#166534' : '#9f1239'}">
                ${diffEntries >= 0 ? '+' : ''}${diffEntriesPct}% entries (${diffEntries >= 0 ? '+' : ''}${diffEntries}) · ${momDiff > 0 ? '+' : ''}${momDiffPct}% spend
              </div>
            </div>
          </div>
        ` : ''}

        ${peakExpenseMonth ? `
          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:6px 14px; display:flex; align-items:center; gap:10px">
            <i class="ti ti-trophy" style="color:#d97706; font-size:20px"></i>
            <div>
              <div style="font-size:10px; color:#b45309; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">${isMonthComparison ? 'Higher Month' : 'Highest Peak Month'}</div>
              <div style="font-size:14px; font-weight:700; color:#92400e">${peakExpenseMonth.label} — ${peakExpenseMonth.count} Entries <span style="font-size:12px; font-weight:600; color:#15803d">(₹${peakExpenseMonth.total.toLocaleString()})</span></div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <div style="position:relative; width:100%; height:220px; margin-bottom:16px">
      <canvas id="expenseMonthlyTrendChart"></canvas>
    </div>

    <!-- Monthly Breakdown List -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px">
      ${sortedMonths.map(m => {
        const isPeak = peakExpenseMonth && m.key === peakExpenseMonth.key;
        const isSelected = isMonthComparison && currMonthExpense && m.key === currMonthExpense.key;
        const isPrev = isMonthComparison && prevMonthExpense && m.key === prevMonthExpense.key;
        const totalRef = isMonthComparison && prevMonthExpense && currMonthExpense ? (prevMonthExpense.count + currMonthExpense.count || 1) : sortedMonths.reduce((s, x) => s + x.count, 0) || 1;
        const pct = Math.round((m.count / (totalRef || 1)) * 100);
        return `
          <div style="padding:12px 14px; background:${isSelected ? '#fffdf0' : (isPeak ? '#fffbeb' : '#fafafa')}; border:${isSelected ? '2px solid #f5c842' : (isPeak ? '1.5px solid #fde68a' : '1px solid #f0f0f0')}; border-radius:10px; position:relative;">
            <div style="position:absolute; top:-9px; right:8px; display:flex; gap:4px">
              ${isSelected ? '<span class="badge badge-amber" style="font-size:9px; padding:1px 6px">Selected Month</span>' : ''}
              ${isPrev ? '<span class="badge badge-gray" style="font-size:9px; padding:1px 6px">Previous Month</span>' : ''}
              ${isPeak && !isSelected ? '<span class="badge badge-gold" style="font-size:9px; padding:1px 6px">🏆 Higher</span>' : ''}
            </div>
            <div style="font-size:13px; font-weight:700; color:#1a1a1a">${m.label}</div>
            <div style="font-size:20px; font-weight:700; color:${isPeak ? '#d97706' : '#333'}; margin-top:4px">${m.count} <span style="font-size:12px; font-weight:normal; color:#888">entries (${pct}%)</span></div>
            <div style="font-size:13px; font-weight:600; color:#15803d; margin-top:3px">₹${m.total.toLocaleString()}</div>
          </div>
        `;
      }).join('')}
    </div>
  </div>

  <!-- 3. Category Breakdown & Products vs Overheads Split (Two-Column Grid) -->
  <div class="grid-2" style="margin-bottom:20px;">
    <!-- 🍩 Top Expense Categories & Cost Drivers -->
    <div class="card">
      <div class="section-title">
        <i class="ti ti-chart-donut" style="color:#7c3aed;"></i> Top Expense Categories & Cost Drivers
      </div>
      <div style="font-size:12px; color:#888; margin-bottom:12px;">Category distribution of where money went (${selectedMonthLabel})</div>
      
      <div style="position:relative; width:100%; height:180px; margin-bottom:14px;">
        <canvas id="expenseCategoryChart"></canvas>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${sortedCats.slice(0, 5).map(cat => {
          const pct = totalAllExpenses > 0 ? Math.round((cat.amount / totalAllExpenses) * 100) : 0;
          return `
            <div>
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
                <span style="font-weight:600; color:#1a1a1a; display:flex; align-items:center; gap:6px;">
                  <i class="ti ${expenseIcon(cat.name)}" style="color:#7c3aed;"></i> ${cat.name}
                </span>
                <span style="color:#888; font-weight:500;">₹${cat.amount.toLocaleString()} (${pct}%)</span>
              </div>
              <div style="width:100%; height:6px; background:#f3f4f6; border-radius:10px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #7c3aed, #a78bfa); border-radius:10px;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 📦 Products vs Overheads + Payment Mode Distribution -->
    <div class="card">
      <div class="section-title">
        <i class="ti ti-scale" style="color:#d97706;"></i> Inventory vs Shop Overheads Split
      </div>
      <div style="font-size:12px; color:#888; margin-bottom:12px;">Re-usable product purchases vs fixed operating bills</div>

      <!-- Split Ratio Bar -->
      <div style="background:#fafafa; border:1px solid #f0f0f0; border-radius:10px; padding:12px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:6px;">
          <span style="color:#7c3aed;"><i class="ti ti-package"></i> Products: ₹${productSpend.toLocaleString()} (${productSpendPct}%)</span>
          <span style="color:#d97706;"><i class="ti ti-building"></i> Overheads: ₹${overheadSpend.toLocaleString()} (${overheadSpendPct}%)</span>
        </div>
        <div style="width:100%; height:10px; background:#fde68a; border-radius:6px; overflow:hidden; display:flex;">
          <div style="width:${productSpendPct}%; height:100%; background:#7c3aed;" title="Products: ${productSpendPct}%"></div>
          <div style="width:${overheadSpendPct}%; height:100%; background:#f59e0b;" title="Overheads: ${overheadSpendPct}%"></div>
        </div>
      </div>

      <!-- Payment Method Distribution -->
      <div class="section-title" style="font-size:12.5px; margin-bottom:8px;">
        <i class="ti ti-credit-card" style="color:#2563eb;"></i> Payment Mode Distribution (${selectedMonthLabel})
      </div>
      <div style="position:relative; width:100%; height:160px; margin-bottom:12px;">
        <canvas id="expensePaymentChart"></canvas>
      </div>

      <!-- Top Vendors / Suppliers -->
      ${sortedVendors.length ? `
        <div style="border-top:1px solid #f0f0f0; padding-top:12px; margin-top:10px;">
          <div style="font-size:11.5px; font-weight:600; color:#555; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.04em;">Top Suppliers / Stores</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${sortedVendors.map(v => `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; padding:5px 8px; background:#f9fafb; border-radius:6px;">
                <span style="font-weight:600; color:#333;"><i class="ti ti-building-store" style="color:#7c3aed; margin-right:4px;"></i> ${v.name}</span>
                <span style="font-weight:600; color:#1a1a1a;">₹${v.amount.toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  </div>

  <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; align-items:center; background:#f9fafb; padding:8px; border-radius:12px; border:1px solid #f3f4f6;">
    <button class="btn ${activeTab === 'all' ? 'btn-gold' : 'btn-outline'}" onclick="window.setExpenseTab('all')" style="padding:6px 16px; font-size:12px; height:34px;">
      <i class="ti ti-list"></i> All Expenses (₹${totalAllExpenses.toLocaleString()})
    </button>
    <button class="btn ${activeTab === 'general' ? 'btn-gold' : 'btn-outline'}" onclick="window.setExpenseTab('general')" style="padding:6px 16px; font-size:12px; height:34px;">
      <i class="ti ti-receipt"></i> General Expenses (₹${totalGeneralExpenses.toLocaleString()})
    </button>
    <button class="btn ${activeTab === 'product' ? 'btn-gold' : 'btn-outline'}" onclick="window.setExpenseTab('product')" style="padding:6px 16px; font-size:12px; height:34px;">
      <i class="ti ti-package"></i> Product Expenses (₹${totalProductExpenses.toLocaleString()})
    </button>
  </div>

  <div class="card" style="margin-bottom:16px;padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div class="section-title" style="margin-bottom:0">
        ${activeTab === 'product' ? 'Product Expenses Breakdown' : activeTab === 'general' ? 'General Expenses Breakdown' : 'All Expenses Breakdown'} (${selectedMonthLabel})
      </div>
      <div style="font-size:22px;font-weight:700;color:#dc2626">₹${total.toLocaleString()}</div>
    </div>
    ${Object.keys(cats).length === 0 ? `<div style="color:#999;font-size:13px;padding:12px 0;">No expense entries in this category for ${selectedMonthLabel}.</div>` :
      Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`
      <div class="service-row">
        <div style="width:30px;height:30px;border-radius:8px;background:#fef3c7;display:flex;align-items:center;justify-content:center">
          <i class="ti ${expenseIcon(cat)}" style="font-size:15px;color:#d97706"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${cat}</div>
          <div style="background:#f0f0f0;border-radius:3px;height:5px;margin-top:5px;overflow:hidden">
            <div style="height:5px;border-radius:3px;background:#f5c842;width:${total?Math.round((amt/total)*100):0}%"></div>
          </div>
        </div>
        <div style="text-align:right;min-width:80px">
          <div style="font-size:13px;font-weight:600">₹${amt.toLocaleString()}</div>
          <div style="font-size:11px;color:#bbb">${total?Math.round((amt/total)*100):0}%</div>
        </div>
      </div>
    `).join('')}
  </div>
  <div class="card">
    <div class="section-title">Transaction History (${expenses.length} entries${isAllMonths ? '' : ` · ${selectedMonthName}`})</div>
    ${expenses.length === 0 ? `<div style="color:#999;font-size:13px;padding:20px;text-align:center;">No expense records found${isAllMonths ? '' : ` for ${selectedMonthName}`}.</div>` :
      expenses.map(e=>{
      const { cleanText: cleanNote, tagHtml: empBadge } = formatEmpTag(e.note || e.category);
      return `
      <div class="expense-row">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${cleanNote} ${empBadge}</div>
          <div style="font-size:11px;color:#bbb">${e.category} · ${e.date} · <span style="color:#b45309;font-weight:500;background:#fffbeb;padding:2px 6px;border-radius:4px;font-size:10px">${e.payment_method || 'Cash'}</span></div>
        </div>
        <div style="font-size:14px;font-weight:600;color:#dc2626;margin-right:12px">-₹${(e.amount||0).toLocaleString()}</div>
        <div onclick="window.handleDeleteExpense('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#ccc'">
          <i class="ti ti-trash" style="font-size:15px"></i>
        </div>
      </div>
    `; }).join('')}
  </div>`;
}

export function initExpenseAnalyticsCharts() {
  const dd = window._expenseAnalyticsData;
  if (!dd || typeof Chart === 'undefined') return;

  if (!window._expenseCharts) {
    window._expenseCharts = {};
  }

  // Destroy previous charts if they exist to prevent canvas reuse errors
  if (window._expenseCharts.monthly) {
    try { window._expenseCharts.monthly.destroy(); } catch (e) {}
  }
  if (window._expenseCharts.category) {
    try { window._expenseCharts.category.destroy(); } catch (e) {}
  }
  if (window._expenseCharts.payment) {
    try { window._expenseCharts.payment.destroy(); } catch (e) {}
  }

  // 1. Monthly Expense & Outflow Trend Bar + Line Chart (Like Customers Page)
  const monthCanvas = document.getElementById('expenseMonthlyTrendChart');
  if (monthCanvas && dd.sortedMonths && dd.sortedMonths.length) {
    const labels = dd.sortedMonths.map(m => m.label);
    const counts = dd.sortedMonths.map(m => m.count);
    const totals = dd.sortedMonths.map(m => m.total);

    window._expenseCharts.monthly = new Chart(monthCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Expense Entries',
            data: counts,
            backgroundColor: dd.sortedMonths.map(m => {
              if (dd.isMonthComparison && dd.currMonthExpense && m.key === dd.currMonthExpense.key) {
                return '#f5c842';
              }
              if (dd.peakExpenseMonth && m.key === dd.peakExpenseMonth.key) {
                return '#f5c842';
              }
              return 'rgba(245, 200, 66, 0.45)';
            }),
            borderColor: dd.sortedMonths.map(m => {
              if (dd.isMonthComparison && dd.currMonthExpense && m.key === dd.currMonthExpense.key) {
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
            label: 'Total Outflow (₹)',
            data: totals,
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
                const m = dd.sortedMonths[idx];
                if (!m) return '';
                if (dd.isMonthComparison) {
                  if (dd.currMonthExpense && m.key === dd.currMonthExpense.key) return `${m.label} (Selected Month)`;
                  if (dd.prevMonthExpense && m.key === dd.prevMonthExpense.key) return `${m.label} (Previous Month)`;
                }
                return m.label;
              },
              label: function(ctx) {
                if (ctx.dataset.type === 'line') {
                  return ` Total Outflow: ₹${Number(ctx.raw).toLocaleString()}`;
                }
                return ` Expenses: ${ctx.raw} entries`;
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Expenses Count', font: { size: 10 } },
            ticks: { precision: 0, font: { size: 10 } }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Total Outflow (₹)', font: { size: 10 } },
            ticks: {
              callback: function(val) { return '₹' + Number(val).toLocaleString(); },
              font: { size: 10 }
            }
          },
          x: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }


  // 2. Category Doughnut Chart
  const catCanvas = document.getElementById('expenseCategoryChart');
  if (catCanvas && dd.sortedCats && dd.sortedCats.length) {
    const catPalette = ['#7c3aed', '#f5c842', '#10b981', '#3b82f6', '#ec4899', '#f97316', '#6366f1', '#14b8a6', '#8b5cf6'];
    window._expenseCharts.category = new Chart(catCanvas, {
      type: 'doughnut',
      data: {
        labels: dd.sortedCats.map(c => c.name),
        datasets: [{
          data: dd.sortedCats.map(c => c.amount),
          backgroundColor: catPalette.slice(0, dd.sortedCats.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { size: 11 }, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ₹${Number(ctx.raw || 0).toLocaleString()}`
            }
          }
        }
      }
    });
  }

  // 3. Payment Mode Donut Chart
  const payCanvas = document.getElementById('expensePaymentChart');
  if (payCanvas && (dd.cashSpent > 0 || dd.gpaySpent > 0)) {
    window._expenseCharts.payment = new Chart(payCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Cash Outflow', 'GPay / UPI Outflow'],
        datasets: [{
          data: [dd.cashSpent, dd.gpaySpent],
          backgroundColor: ['#f5c842', '#3b82f6'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { size: 11 }, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ₹${Number(ctx.raw || 0).toLocaleString()}`
            }
          }
        }
      }
    });
  }
}

export function showAddExpenseModal() {
  const today = new Date().toISOString().split('T')[0];
  const categories = [
    { name: 'Rent', icon: 'ti-building' },
    { name: 'Salary', icon: 'ti-users' },
    { name: 'Electricity', icon: 'ti-bolt' },
    { name: 'Water', icon: 'ti-droplet' },
    { name: 'Travel', icon: 'ti-car' },
    { name: 'Cleaning', icon: 'ti-sparkles' },
    { name: 'Tea & Snacks', icon: 'ti-cup' },
    { name: 'Maintenance', icon: 'ti-tool' },
    { name: 'Products', icon: 'ti-package' },
    { name: 'Miscellaneous', icon: 'ti-dots' },
    { name: 'Others', icon: 'ti-plus' }
  ];

  showModal('Add General Expense', `
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-bottom:14px;align-items:start;">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-weight:600;font-size:12px;margin-bottom:6px;">Payment Method *</label>
        <div class="chip-group" id="ge-payment-chips" style="margin-top:0;">
          <div class="chip selected" onclick="window.selectGeneralExpensePayment(this, 'Cash')" style="padding:6px 13px;font-size:12px;">
            <i class="ti ti-cash" style="font-size:14px;color:#16a34a;"></i> Cash
          </div>
          <div class="chip" onclick="window.selectGeneralExpensePayment(this, 'GPay')" style="padding:6px 13px;font-size:12px;">
            <i class="ti ti-brand-google" style="font-size:14px;color:#2563eb;"></i> GPay
          </div>
        </div>
        <input type="hidden" id="ge-payment-method" value="Cash">
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-weight:600;font-size:12px;margin-bottom:6px;">Expense Date</label>
        <input class="form-input" id="ge-date" type="date" value="${today}" onchange="window.updateGeneralExpenseDefaultDate(this.value)" onclick="try{this.showPicker()}catch(e){}" style="height:36px;font-size:12px;">
      </div>
    </div>

    <div class="form-group" style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <label class="form-label" style="margin-bottom:0; font-weight:600; font-size:12px;">Select Expense Categories *</label>
        <span style="font-size:11px; color:#888; font-weight:400;">Tap to select multiple</span>
      </div>
      <div class="chip-group" id="ge-category-chips">
        ${categories.map(c => `
          <div class="chip" data-category="${c.name}" onclick="window.generalExpenseChipToggle(this, '${c.name}', '${c.icon}')">
            <i class="ti ${c.icon}" style="font-size:13px"></i> ${c.name}
          </div>
        `).join('')}
      </div>

      <div class="chip-other-input" id="ge-other-input-div" style="margin-top:10px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="form-input" id="ge-other-name" placeholder="Enter custom expense category name..." style="flex:1;height:36px;font-size:12px;" onkeydown="if(event.key==='Enter'){event.preventDefault();window.addOtherGeneralExpense();}">
          <button type="button" class="btn btn-gold" onclick="window.addOtherGeneralExpense()" style="padding:8px 14px;font-size:12px;white-space:nowrap;height:36px;">
            <i class="ti ti-plus"></i> Add
          </button>
        </div>
      </div>
    </div>

    <div class="form-section-title" style="margin-top:14px; margin-bottom:8px; font-size:11px; display:flex; justify-content:space-between; align-items:center;">
      <span><i class="ti ti-receipt-2"></i> Selected Expense Amounts</span>
      <span style="font-weight:400; text-transform:none; letter-spacing:0; color:#888;">Set date, method & amount</span>
    </div>

    <div id="ge-empty-hint" style="text-align:center; padding:18px 12px; color:#94a3b8; font-size:12px; border:1px dashed rgba(245,200,66,0.3); border-radius:10px; background:rgba(245,200,66,0.03);">
      <i class="ti ti-hand-click" style="font-size:20px; display:block; margin-bottom:4px; opacity:0.7;"></i>
      Tap one or more category chips above to enter amounts
    </div>

    <div class="service-amount-list" id="ge-amount-list" style="margin-top:8px;"></div>

    <div class="sa-total-bar" id="ge-total-bar" style="display:none; margin-top:14px; padding:10px 14px; border-radius:10px;">
      <span class="sa-total-label" style="font-weight:600;">Grand Total</span>
      <span class="sa-total-value" id="ge-total-amount" style="font-size:18px; font-weight:700; color:#d97706;">₹0</span>
    </div>
  `, async () => {
    const rows = document.querySelectorAll('#ge-amount-list .service-amount-row');
    if (rows.length === 0) {
      showToast('Please select at least one category chip', 'error');
      return;
    }

    const date = document.getElementById('ge-date')?.value || new Date().toISOString().split('T')[0];
    const defaultMethod = document.getElementById('ge-payment-method')?.value || 'Cash';

    const items = [];
    rows.forEach(r => {
      const category = r.dataset.category;
      const rowDate = r.querySelector('.ge-row-date')?.value || date;
      const amount = parseInt(r.querySelector('.ge-row-amount')?.value) || 0;
      const payment_method = r.querySelector('.ge-row-pay')?.value || defaultMethod;
      if (amount > 0) {
        items.push({
          category,
          amount,
          date: rowDate,
          payment_method,
          note: category
        });
      }
    });

    if (items.length === 0) {
      showToast('Please enter an amount greater than 0 for at least one selected chip', 'error');
      return;
    }

    let successCount = 0;
    for (const item of items) {
      const res = await addExpense(item);
      if (res) successCount++;
    }

    if (successCount > 0) {
      closeModal();
      showToast(`Successfully saved ${successCount} expense${successCount > 1 ? 's' : ''}!`);
      state.chatMessages.push({
        role: 'ai',
        text: `✅ Saved <strong>${successCount}</strong> general expenses via chips! 🎉<br><span style="font-size:11px;color:#888">${items.map(i => `${i.category}: ₹${i.amount.toLocaleString()} (${i.payment_method})`).join(' · ')}</span>`
      });
      if (typeof window.render === 'function') window.render();
      const chatEl = document.getElementById('chat-messages');
      if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    } else {
      showToast('Failed to save expenses', 'error');
    }
  });

  // Adjust modal sizing for multi-chip interface
  const modalEl = document.querySelector('#modal-container .modal');
  if (modalEl) {
    modalEl.style.width = '560px';
    modalEl.style.maxWidth = '96vw';
  }
}

export function updateGeneralExpenseDefaultDate(newDate) {
  if (!newDate) return;
  document.querySelectorAll('#ge-amount-list .ge-row-date').forEach(input => {
    input.value = newDate;
  });
}

export function selectGeneralExpensePayment(chipEl, method) {
  const group = chipEl.closest('#ge-payment-chips');
  if (group) {
    group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  }
  chipEl.classList.add('selected');
  const input = document.getElementById('ge-payment-method');
  if (input) input.value = method;

  document.querySelectorAll('#ge-amount-list .ge-row-pay').forEach(sel => {
    sel.value = method;
  });
}

export function generalExpenseChipToggle(chipEl, category, icon) {
  const isSelected = chipEl.classList.toggle('selected');

  if (category === 'Others') {
    const otherDiv = document.getElementById('ge-other-input-div');
    if (otherDiv) {
      if (isSelected) {
        otherDiv.classList.add('show');
        const input = document.getElementById('ge-other-name');
        if (input) input.focus();
      } else {
        otherDiv.classList.remove('show');
      }
    }
    return;
  }

  const rowId = 'ge-row-' + category.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const amountList = document.getElementById('ge-amount-list');
  if (!amountList) return;

  if (isSelected) {
    if (!document.getElementById(rowId)) {
      const defaultDate = document.getElementById('ge-date')?.value || new Date().toISOString().split('T')[0];
      const defaultMethod = document.getElementById('ge-payment-method')?.value || 'Cash';
      const row = document.createElement('div');
      row.className = 'service-amount-row';
      row.id = rowId;
      row.dataset.category = category;
      row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 12px; margin-bottom:8px; border-radius:10px;';

      row.innerHTML = `
        <div class="sa-name" style="color:#d97706; min-width:110px; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px;">
          <i class="ti ${icon || 'ti-receipt'}"></i>
          <span>${category}</span>
        </div>
        <input type="date" class="form-input ge-row-date" value="${defaultDate}" onclick="try{this.showPicker()}catch(e){}" title="Expense Date" style="flex:1; height:32px !important; min-height:32px !important; font-size:12px; padding:2px 8px; border-radius:6px; min-width:115px; max-width:145px; text-align:left !important;">
        <select class="form-input form-select ge-row-pay" style="width:75px; height:32px; font-size:11px; padding:2px 18px 2px 6px; border-radius:6px;" title="Payment method for this expense">
          <option value="Cash" ${defaultMethod === 'Cash' ? 'selected' : ''}>Cash</option>
          <option value="GPay" ${defaultMethod === 'GPay' ? 'selected' : ''}>GPay</option>
        </select>
        <div style="display:flex; align-items:center; gap:3px;">
          <span style="font-size:13px; color:#888; font-weight:600;">₹</span>
          <input type="number" class="form-input ge-row-amount" placeholder="Amount" oninput="window.updateGeneralExpenseTotal()" style="width:85px; height:32px; font-size:13px; font-weight:600; text-align:right; padding:4px 8px; border-radius:6px;">
        </div>
        <div class="sa-remove" onclick="window.removeGeneralExpenseRow('${rowId}', '${category}')" title="Remove row" style="cursor:pointer; padding:4px; color:#999; display:flex; align-items:center;">
          <i class="ti ti-x" style="font-size:14px"></i>
        </div>
      `;
      amountList.appendChild(row);
      const amtInput = row.querySelector('.ge-row-amount');
      if (amtInput) amtInput.focus();
    }
  } else {
    const row = document.getElementById(rowId);
    if (row) row.remove();
  }

  updateGeneralExpenseTotal();
}

export function addOtherGeneralExpense() {
  const input = document.getElementById('ge-other-name');
  const name = input?.value.trim();
  if (!name) {
    showToast('Please enter an expense category name', 'error');
    return;
  }

  const amountList = document.getElementById('ge-amount-list');
  if (!amountList) return;

  const defaultDate = document.getElementById('ge-date')?.value || new Date().toISOString().split('T')[0];
  const defaultMethod = document.getElementById('ge-payment-method')?.value || 'Cash';
  const rowId = 'ge-row-custom-' + Date.now();
  const row = document.createElement('div');
  row.className = 'service-amount-row';
  row.id = rowId;
  row.dataset.category = name;
  row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 12px; margin-bottom:8px; border-radius:10px;';

  row.innerHTML = `
    <div class="sa-name" style="color:#d97706; min-width:110px; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px;">
      <i class="ti ti-receipt"></i>
      <span>${name}</span>
    </div>
    <input type="date" class="form-input ge-row-date" value="${defaultDate}" onclick="try{this.showPicker()}catch(e){}" title="Expense Date" style="flex:1; height:32px !important; min-height:32px !important; font-size:12px; padding:2px 8px; border-radius:6px; min-width:115px; max-width:145px; text-align:left !important;">
    <select class="form-input form-select ge-row-pay" style="width:75px; height:32px; font-size:11px; padding:2px 18px 2px 6px; border-radius:6px;" title="Payment method for this expense">
      <option value="Cash" ${defaultMethod === 'Cash' ? 'selected' : ''}>Cash</option>
      <option value="GPay" ${defaultMethod === 'GPay' ? 'selected' : ''}>GPay</option>
    </select>
    <div style="display:flex; align-items:center; gap:3px;">
      <span style="font-size:13px; color:#888; font-weight:600;">₹</span>
      <input type="number" class="form-input ge-row-amount" placeholder="Amount" oninput="window.updateGeneralExpenseTotal()" style="width:85px; height:32px; font-size:13px; font-weight:600; text-align:right; padding:4px 8px; border-radius:6px;">
    </div>
    <div class="sa-remove" onclick="window.removeGeneralExpenseRow('${rowId}', null)" title="Remove row" style="cursor:pointer; padding:4px; color:#999; display:flex; align-items:center;">
      <i class="ti ti-x" style="font-size:14px"></i>
    </div>
  `;
  amountList.appendChild(row);

  input.value = '';
  input.focus();
  const amtInput = row.querySelector('.ge-row-amount');
  if (amtInput) amtInput.focus();

  updateGeneralExpenseTotal();
}

export function removeGeneralExpenseRow(rowId, category) {
  const row = document.getElementById(rowId);
  if (row) row.remove();

  if (category) {
    const chips = document.querySelectorAll('#ge-category-chips .chip');
    chips.forEach(c => {
      if (c.dataset.category === category || c.textContent.trim().includes(category)) {
        c.classList.remove('selected');
      }
    });
  }

  updateGeneralExpenseTotal();
}

export function updateGeneralExpenseTotal() {
  const rows = document.querySelectorAll('#ge-amount-list .service-amount-row');
  let total = 0;
  rows.forEach(r => {
    const val = parseInt(r.querySelector('.ge-row-amount')?.value) || 0;
    total += val;
  });

  const emptyHint = document.getElementById('ge-empty-hint');
  if (emptyHint) {
    emptyHint.style.display = rows.length === 0 ? 'block' : 'none';
  }

  const totalBar = document.getElementById('ge-total-bar');
  if (totalBar) {
    totalBar.style.display = rows.length > 0 ? 'flex' : 'none';
  }

  const totalEl = document.getElementById('ge-total-amount');
  if (totalEl) {
    totalEl.textContent = '₹' + total.toLocaleString();
  }
}

export function openBulkExpenseForm() {
  const container = document.getElementById('form-overlay-container');
  if (!container) return;
  container.innerHTML = `
    <div class="form-overlay" onclick="window.closeFormOverlay()">
      <div class="form-panel" onclick="event.stopPropagation()" style="width:650px; max-width:95vw;">
        <div class="form-panel-header">
          <h3><i class="ti ti-receipt-2" style="color:#7c3aed"></i> Bulk Expense Form</h3>
          <div onclick="window.closeFormOverlay()" style="cursor:pointer;color:#999;font-size:22px;padding:4px;display:flex;align-items:center;"><i class="ti ti-x"></i></div>
        </div>
        <div class="form-panel-body" style="max-height:65vh; overflow-y:auto;">
          <p style="font-size:12px; color:#666; margin-bottom:14px;">Add multiple expense transactions at once. Click "+ Add Item" to add more rows.</p>
          
          <div style="display:flex; flex-direction:column; gap:10px;" id="bulk-expense-list">
            <!-- Rows dynamically loaded here -->
          </div>
          
          <button class="btn btn-outline" style="margin-top:14px; width:100%; justify-content:center; border-style:dashed; border-color:#7c3aed; color:#7c3aed;" onclick="window.addBulkExpenseRow()">
            <i class="ti ti-plus"></i> Add Item
          </button>
          
          <div class="sa-total-bar" id="bulk-total-bar" style="margin-top:18px; background:#f5f3ff; border:1px solid #ddd6fe; display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-radius:10px;">
            <span class="sa-total-label" style="color:#6d28d9; font-weight:600;">Grand Total</span>
            <span class="sa-total-value" id="bulk-total-amount" style="color:#7c3aed; font-size:20px; font-weight:700;">₹0</span>
          </div>
        </div>
        <div class="form-panel-footer">
          <button class="btn btn-outline" onclick="window.closeFormOverlay()"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-gold" onclick="window.submitBulkExpenseForm()" id="bulk-submit-btn" style="background:#7c3aed; color:white;"><i class="ti ti-check"></i> Save All Expenses</button>
        </div>
      </div>
    </div>`;

  // Start with 2 initial rows
  state.bulkRowCounter = 0;
  addBulkExpenseRow();
  addBulkExpenseRow();
}

export function addBulkExpenseRow() {
  const today = new Date().toISOString().split('T')[0];
  const list = document.getElementById('bulk-expense-list');
  if (!list) return;
  const rowId = `bulk-row-${state.bulkRowCounter++}`;
  
  const rowDiv = document.createElement('div');
  rowDiv.className = 'bulk-expense-row';
  rowDiv.id = rowId;
  rowDiv.style = "display:grid; grid-template-columns:1.2fr 1.2fr 1fr 1.1fr 1.5fr auto; gap:8px; align-items:center; padding:10px; background:#fcfcfc; border:0.5px solid #ebebeb; border-radius:10px; position:relative;";
  
  rowDiv.innerHTML = `
    <div>
      <select class="form-input form-select" style="padding:6px 8px; font-size:12px; height:32px;" name="category">
        <option value="Products">Products</option>
        <option value="Rent">Rent</option>
        <option value="Salary">Salary</option>
        <option value="Electricity">Electricity</option>
        <option value="Water">Water</option>
        <option value="Travel">Travel</option>
        <option value="Miscellaneous">Miscellaneous</option>
      </select>
    </div>
    <div>
      <select class="form-input form-select" style="padding:6px 8px; font-size:12px; height:32px;" name="payment_method">
        <option value="Cash">Cash</option>
        <option value="GPay">GPay</option>
      </select>
    </div>
    <div>
      <input class="form-input" type="number" placeholder="Amount (₹)" style="padding:6px 8px; font-size:12px; height:32px; text-align:right;" name="amount" oninput="window.updateBulkExpenseTotal()">
    </div>
    <div>
      <input class="form-input" type="date" value="${today}" style="padding:6px 8px; font-size:12px; height:32px;" name="date" onclick="try{this.showPicker()}catch(e){}">
    </div>
    <div>
      <input class="form-input" placeholder="Note (e.g. shampoo)" style="padding:6px 8px; font-size:12px; height:32px;" name="note">
    </div>
    <div>
      <button class="btn btn-danger btn-icon" style="width:32px; height:32px; padding:0; border-radius:8px; display:flex; align-items:center; justify-content:center;" onclick="window.removeBulkExpenseRow('${rowId}')" title="Delete row">
        <i class="ti ti-trash" style="font-size:14px"></i>
      </button>
    </div>
  `;
  
  list.appendChild(rowDiv);
  updateBulkExpenseTotal();
}

export function removeBulkExpenseRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
  }
  updateBulkExpenseTotal();
}

export function updateBulkExpenseTotal() {
  const rows = document.querySelectorAll('#bulk-expense-list .bulk-expense-row');
  let total = 0;
  rows.forEach(r => {
    const amtInput = r.querySelector('input[name="amount"]');
    total += parseInt(amtInput?.value) || 0;
  });
  
  const el = document.getElementById('bulk-total-amount');
  if (el) el.textContent = '₹' + total.toLocaleString();
}

export async function submitBulkExpenseForm() {
  const rows = document.querySelectorAll('#bulk-expense-list .bulk-expense-row');
  const items = [];
  
  rows.forEach(r => {
    const category = r.querySelector('select[name="category"]').value;
    const payment_method = r.querySelector('select[name="payment_method"]').value;
    const amount = parseInt(r.querySelector('input[name="amount"]').value) || 0;
    const date = r.querySelector('input[name="date"]').value || new Date().toISOString().split('T')[0];
    const note = r.querySelector('input[name="note"]').value.trim();
    
    if (amount > 0) {
      items.push({ category, amount, date, payment_method, note: note || category });
    }
  });
  
  if (items.length === 0) {
    showToast('Please enter at least one expense amount greater than 0', 'error');
    return;
  }
  
  const btn = document.getElementById('bulk-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...';
  }
  
  let successCount = 0;
  for (let item of items) {
    const result = await addExpense(item);
    if (result) successCount++;
  }
  
  if (successCount > 0) {
    closeFormOverlay();
    showToast(`Successfully saved ${successCount} expenses!`);
    state.chatMessages.push({
      role: 'ai',
      text: `✅ Saved <strong>${successCount}</strong> bulk expenses via manual form! 🎉<br><span style="font-size:11px;color:#888">${items.map(i => `${i.note}: ₹${i.amount.toLocaleString()}`).join(' · ')}</span>`
    });
    if (typeof window.render === 'function') window.render();
    scrollChatBottom();
  } else {
    showToast('Failed to save expenses', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-check"></i> Save All Expenses';
    }
  }
}

export async function handleDeleteExpense(id) {
  const confirmed = await showConfirmDelete('Delete Expense', 'Are you sure you want to delete this expense transaction? This action cannot be undone.');
  if (!confirmed) return;
  await deleteExpense(id);
  if (typeof window.render === 'function') window.render();
}

export function expenseIcon(cat) {
  const map = {
    Rent: 'ti-building',
    Salary: 'ti-users',
    Electricity: 'ti-bolt',
    Water: 'ti-droplet',
    Travel: 'ti-car',
    Products: 'ti-package',
    Cleaning: 'ti-sparkles',
    'Tea & Snacks': 'ti-cup',
    Maintenance: 'ti-tool',
    Miscellaneous: 'ti-dots'
  };
  return map[cat] || 'ti-receipt';
}

export async function analyzeExpenses() {
  showModal('Operating Expenses AI Analysis', `
    <div class="loading-page" style="height: 180px;">
      <div class="spinner"></div>
      <div style="margin-top:12px;font-weight:500;color:#555;">AI is analyzing salon expenses...</div>
      <div style="font-size:12px;color:#999;margin-top:6px;">Comparing rent, salary, product inventory, and operational utility spend</div>
    </div>
  `, null);
  
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';

  try {
    const expenses = await fetchExpenses();
    
    if (expenses.length === 0) {
      document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center;padding:20px;color:#999;">
          <i class="ti ti-receipt" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>
          No expense entries found to analyze yet.
        </div>`;
      return;
    }

    const resData = await callGroqAPI('chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an elite salon finance analyst. Analyze the provided operational expense data for Kalai Makeover salon.
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
1. Executive Summary: Short overview of operational costs.
2. Metric Grid: Styled list or columns showing: Total Expenses, Number of Transactions, Top Expense Category, Average Transaction Amount.
3. Category Breakdown: Which categories (Rent, Salary, Products, utilities like Electricity/Water) drive the highest overhead.
4. Business Optimization Tips: Actionable suggestions for Kalai to reduce product waste, manage utilities, or negotiate supplier rates to improve net profit margin.
Make it concise, insightful, and formatted beautifully.`
        },
        {
          role: 'user',
          content: `Here is the expense data in JSON format: ${JSON.stringify(expenses.map(e => ({
            category: e.category,
            amount: e.amount,
            date: e.date,
            note: e.note
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

export function openProductExpenseForm(type = 'salon') {
  if (type === 'makeup') {
    openMakeupExpenseForm();
    return;
  }
  openSalonProductExpenseForm();
}

export function openSalonProductExpenseForm() {
  openSingleProductExpenseForm('salon');
}

export function openMakeupExpenseForm() {
  openSingleProductExpenseForm('makeup');
}

export function openSingleProductExpenseForm(type = 'salon') {
  const isSalon = type === 'salon';
  const prevDate = document.getElementById('pe-date')?.value;
  const prevMethod = document.getElementById('pe-payment-method')?.value;
  const prevShop = document.getElementById('pe-shop')?.value;
  const today = prevDate || new Date().toISOString().split('T')[0];
  const activeMethod = prevMethod || 'Cash';
  const shopVal = prevShop || '';
  const container = document.getElementById('form-overlay-container');
  if (!container) return;

  const primaryColor = isSalon ? '#7c3aed' : '#be185d';
  const primaryBg = isSalon ? '#f3e8ff' : '#fce7f3';
  const formIcon = isSalon ? 'ti-package' : 'ti-brush';
  const formTitle = isSalon ? 'Salon Product Items Form' : 'Makeup Items & Accessories Form';
  const formSubtext = isSalon ? 'Hair colors, creams, kits, wipes & salon inventory' : 'Hair extensions, lashes, sprays, pins, flowers & accessories';

  container.innerHTML = `
    <div class="form-overlay" onclick="window.closeFormOverlay()">
      <div class="form-panel" onclick="event.stopPropagation()" style="width:650px; max-width:95vw;">
        <div class="form-panel-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:8px; background:${primaryBg}; color:${primaryColor}; display:flex; align-items:center; justify-content:center; font-size:18px;">
              <i class="ti ${formIcon}"></i>
            </div>
            <div>
              <h3 style="margin:0; font-size:16px;">${formTitle}</h3>
              <div style="font-size:11px; color:#888; margin-top:2px;">${formSubtext}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-outline btn-icon" id="form-mic-btn" onclick="window.startVoiceRecording('product_expense')" title="Fill form with voice" style="width:34px; height:34px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; border-color:#e5e5e5; transition: all 0.2s ease;">
              <i class="ti ti-microphone" style="font-size:16px; color:${primaryColor};"></i>
            </button>
            <div onclick="window.closeFormOverlay()" style="cursor:pointer;color:#999;font-size:22px;padding:4px;display:flex;align-items:center;"><i class="ti ti-x"></i></div>
          </div>
        </div>

        <div class="form-panel-body" style="max-height:65vh; overflow-y:auto;">
          <!-- Form Type Switcher Tabs -->
          <div class="pe-form-tabs">
            <button type="button" class="pe-form-tab-btn" onclick="window.openSalonProductExpenseForm()" style="${isSalon ? 'background:#7c3aed; color:white !important; box-shadow:0 2px 6px rgba(124,58,237,0.3);' : ''}">
              <i class="ti ti-package"></i> Salon Product Items
            </button>
            <button type="button" class="pe-form-tab-btn" onclick="window.openMakeupExpenseForm()" style="${!isSalon ? 'background:#be185d; color:white !important; box-shadow:0 2px 6px rgba(190,24,93,0.3);' : ''}">
              <i class="ti ti-brush"></i> Makeup Items & Accessories
            </button>
          </div>

          <div id="form-voice-container"></div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;align-items:start;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-weight:600;font-size:12px;margin-bottom:6px;">Payment Method</label>
              <div class="chip-group" id="pe-payment-chips" style="margin-top:0;">
                <div class="chip ${activeMethod === 'Cash' ? 'selected' : ''}" onclick="window.selectProductExpensePayment(this, 'Cash')" style="padding:6px 13px;font-size:12px;">
                  <i class="ti ti-cash" style="font-size:14px;color:#16a34a;"></i> Cash
                </div>
                <div class="chip ${activeMethod === 'GPay' ? 'selected' : ''}" onclick="window.selectProductExpensePayment(this, 'GPay')" style="padding:6px 13px;font-size:12px;">
                  <i class="ti ti-brand-google" style="font-size:14px;color:#2563eb;"></i> GPay
                </div>
              </div>
              <input type="hidden" id="pe-payment-method" value="${activeMethod}">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-weight:600;font-size:12px;margin-bottom:6px;">Expense Date</label>
              <input class="form-input" id="pe-date" type="date" value="${today}" onchange="window.updateProductExpenseDefaultDate(this.value)" onclick="try{this.showPicker()}catch(e){}" style="height:36px;font-size:12px;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-weight:600;font-size:12px;margin-bottom:6px;">Shop Name</label>
              <input class="form-input" id="pe-shop" type="text" value="${shopVal}" placeholder="e.g. Cosmo Store" style="height:36px;font-size:12px;">
            </div>
          </div>

          ${isSalon ? `
            <div class="form-section-title" style="color:#6d28d9">
              <i class="ti ti-package"></i> Salon Product Items
              <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap a product, then enter amount</span>
            </div>
            <div class="form-group">
              <div class="chip-group" id="pe-product-chips">
                ${['Hair Color Gell', 'Hair Color Power', 'Hand Glouse', 'Spa Cream', 'Razer', 'Tissues', 'Facial Kit', 'Wiper', 'Rose Water', 'Smoothing Cream', 'Others'].map(s =>
                  `<div class="chip" onclick="window.productExpenseChipToggle(this, 'product')">${s}</div>`
                ).join('')}
              </div>
              <div class="chip-other-input" id="pe-product-other-div">
                <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
                  <input class="form-input" id="pe-product-other" placeholder="Enter custom product name..." style="flex:1">
                  <button class="btn btn-gold" onclick="window.addOtherProductExpenseAmount('product')" style="padding:8px 14px;font-size:12px;white-space:nowrap;background:#7c3aed;border-color:#7c3aed;color:white;"><i class="ti ti-plus" style="font-size:14px"></i> Add</button>
                </div>
              </div>
              <div class="service-amount-list" id="pe-product-amounts"></div>
            </div>
          ` : `
            <div class="form-section-title" style="color:#be185d">
              <i class="ti ti-brush"></i> Makeup Items & Accessories
              <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap an item, then enter amount</span>
            </div>
            <div class="form-group">
              <div class="chip-group" id="pe-makeup-chips">
                ${['Wet Wiper', 'Flashes', 'Hair Extension', 'Holding Spray', 'Shine Spray', 'Hair Pin', 'Safty Pin', 'Fixing Spray', 'Moves', 'Flowers', 'Kajal', 'Others'].map(s =>
                  `<div class="chip" onclick="window.productExpenseChipToggle(this, 'makeup')">${s}</div>`
                ).join('')}
              </div>
              <div class="chip-other-input" id="pe-makeup-other-div">
                <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
                  <input class="form-input" id="pe-makeup-other" placeholder="Enter custom makeup item name..." style="flex:1">
                  <button class="btn btn-gold" onclick="window.addOtherProductExpenseAmount('makeup')" style="padding:8px 14px;font-size:12px;white-space:nowrap;background:#be185d;border-color:#be185d;color:white;"><i class="ti ti-plus" style="font-size:14px"></i> Add</button>
                </div>
              </div>
              <div class="service-amount-list" id="pe-makeup-amounts"></div>
            </div>
          `}

          <div class="sa-total-bar" id="pe-total-bar" style="display:none; background:${primaryBg}; border:1px solid ${isSalon ? '#ddd6fe' : '#fbcfe8'}; justify-content:space-between; align-items:center; padding:12px 16px; border-radius:10px; margin-top: 18px;">
            <span class="sa-total-label" style="color:${primaryColor}; font-weight:600;">Grand Total</span>
            <span class="sa-total-value" id="pe-total-amount" style="color:${primaryColor}; font-size:20px; font-weight:700;">₹0</span>
          </div>
        </div>

        <div class="form-panel-footer">
          <button class="btn btn-outline" onclick="window.closeFormOverlay()"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-gold" onclick="window.submitProductExpenseForm()" id="pe-submit-btn" style="background:${primaryColor}; color:white; border-color:${primaryColor};"><i class="ti ti-check"></i> Save Expenses</button>
        </div>
      </div>
    </div>`;
}

export function selectProductExpensePayment(chipEl, method) {
  const group = chipEl.closest('#pe-payment-chips');
  if (group) {
    group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  }
  chipEl.classList.add('selected');
  const input = document.getElementById('pe-payment-method');
  if (input) input.value = method;

  document.querySelectorAll('#pe-product-amounts .pe-row-pay, #pe-makeup-amounts .pe-row-pay').forEach(sel => {
    sel.value = method;
  });
}

export function updateProductExpenseDefaultDate(newDate) {
  if (!newDate) return;
  document.querySelectorAll('#pe-product-amounts .pe-row-date, #pe-makeup-amounts .pe-row-date').forEach(input => {
    input.value = newDate;
  });
}

export function productExpenseChipToggle(chipEl, category) {
  const name = chipEl.textContent.trim();
  chipEl.classList.toggle('selected');
  
  const targetAmountsId = category === 'product' ? 'pe-product-amounts' : 'pe-makeup-amounts';
  const amountList = document.getElementById(targetAmountsId);
  if (!amountList) return;

  if (name === 'Others') {
    const otherDivId = category === 'product' ? 'pe-product-other-div' : 'pe-makeup-other-div';
    const otherInput = document.getElementById(otherDivId);
    if (chipEl.classList.contains('selected')) {
      if (otherInput) otherInput.classList.add('show');
    } else {
      if (otherInput) otherInput.classList.remove('show');
    }
    return;
  }

  const prefix = category === 'product' ? 'pe-row-prod-' : 'pe-row-make-';
  const rowId = prefix + name.replace(/\s+/g, '-').toLowerCase();

  if (chipEl.classList.contains('selected')) {
    if (!document.getElementById(rowId)) {
      const defaultDate = document.getElementById('pe-date')?.value || new Date().toISOString().split('T')[0];
      const defaultMethod = document.getElementById('pe-payment-method')?.value || 'Cash';
      const row = document.createElement('div');
      row.className = 'service-amount-row';
      row.id = rowId;
      row.dataset.name = name;
      row.dataset.category = category;
      row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 12px; margin-bottom:8px; border-radius:10px;';
      
      const icon = category === 'product' ? 'ti-package' : 'ti-brush';
      const color = category === 'product' ? '#6d28d9' : '#be185d';
      
      row.innerHTML = `
        <div class="sa-name" style="color:${color}; min-width:110px; flex:1; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px;">
          <i class="ti ${icon}"></i>
          <input type="text" class="sa-name-input" value="${name}" style="background:transparent; border:none; color:inherit; font-weight:600; font-size:13px; width:100%; outline:none; text-align:left;">
        </div>
        <input type="date" class="form-input pe-row-date" value="${defaultDate}" onclick="try{this.showPicker()}catch(e){}" title="Expense Date" style="flex:1; height:32px !important; min-height:32px !important; font-size:12px; padding:2px 8px; border-radius:6px; min-width:115px; max-width:145px; text-align:left !important;">
        <select class="form-input form-select pe-row-pay" style="width:75px; height:32px; font-size:11px; padding:2px 18px 2px 6px; border-radius:6px;" title="Payment method for this expense">
          <option value="Cash" ${defaultMethod === 'Cash' ? 'selected' : ''}>Cash</option>
          <option value="GPay" ${defaultMethod === 'GPay' ? 'selected' : ''}>GPay</option>
        </select>
        <div style="display:flex; align-items:center; gap:3px;">
          <span style="font-size:13px; color:#888; font-weight:600;">₹</span>
          <input type="number" class="pe-amount-input" placeholder="Amount" oninput="window.updateProductExpenseTotal()" style="width:85px; height:32px; font-size:13px; font-weight:600; text-align:right; padding:4px 8px; border-radius:6px;">
        </div>
        <div class="sa-remove" onclick="window.removeProductExpenseRow('${rowId}', '${name}', '${category}')" title="Remove" style="cursor:pointer; padding:4px; color:#999; display:flex; align-items:center;">
          <i class="ti ti-x" style="font-size:14px"></i>
        </div>`;
      amountList.appendChild(row);
    }
  } else {
    const row = document.getElementById(rowId);
    if (row) row.remove();
  }
  updateProductExpenseTotal();
}

export function addOtherProductExpenseAmount(category) {
  const otherInputId = category === 'product' ? 'pe-product-other' : 'pe-makeup-other';
  const otherNameInput = document.getElementById(otherInputId);
  const otherName = otherNameInput ? otherNameInput.value.trim() : '';
  if (!otherName) { showToast('Please enter the name first', 'error'); return; }

  const targetAmountsId = category === 'product' ? 'pe-product-amounts' : 'pe-makeup-amounts';
  const amountList = document.getElementById(targetAmountsId);
  if (!amountList) return;

  const defaultDate = document.getElementById('pe-date')?.value || new Date().toISOString().split('T')[0];
  const defaultMethod = document.getElementById('pe-payment-method')?.value || 'Cash';
  const rowId = `pe-row-${category === 'product' ? 'prod' : 'make'}-other-${Date.now()}`;
  const row = document.createElement('div');
  row.className = 'service-amount-row';
  row.id = rowId;
  row.dataset.name = otherName;
  row.dataset.category = category;
  row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 12px; margin-bottom:8px; border-radius:10px;';

  const icon = category === 'product' ? 'ti-package' : 'ti-brush';
  const color = category === 'product' ? '#6d28d9' : '#be185d';

  row.innerHTML = `
    <div class="sa-name" style="color:${color}; min-width:110px; flex:1; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px;">
      <i class="ti ${icon}"></i>
      <input type="text" class="sa-name-input" value="${otherName}" style="background:transparent; border:none; color:inherit; font-weight:600; font-size:13px; width:100%; outline:none; text-align:left;">
    </div>
    <input type="date" class="form-input pe-row-date" value="${defaultDate}" onclick="try{this.showPicker()}catch(e){}" title="Expense Date" style="flex:1; height:32px !important; min-height:32px !important; font-size:12px; padding:2px 8px; border-radius:6px; min-width:115px; max-width:145px; text-align:left !important;">
    <select class="form-input form-select pe-row-pay" style="width:75px; height:32px; font-size:11px; padding:2px 18px 2px 6px; border-radius:6px;" title="Payment method for this expense">
      <option value="Cash" ${defaultMethod === 'Cash' ? 'selected' : ''}>Cash</option>
      <option value="GPay" ${defaultMethod === 'GPay' ? 'selected' : ''}>GPay</option>
    </select>
    <div style="display:flex; align-items:center; gap:3px;">
      <span style="font-size:13px; color:#888; font-weight:600;">₹</span>
      <input type="number" class="pe-amount-input" placeholder="Amount" oninput="window.updateProductExpenseTotal()" style="width:85px; height:32px; font-size:13px; font-weight:600; text-align:right; padding:4px 8px; border-radius:6px;">
    </div>
    <div class="sa-remove" onclick="window.removeProductExpenseRow('${rowId}', null, '${category}')" title="Remove" style="cursor:pointer; padding:4px; color:#999; display:flex; align-items:center;">
      <i class="ti ti-x" style="font-size:14px"></i>
    </div>`;
  amountList.appendChild(row);
  
  otherNameInput.value = '';
  otherNameInput.focus();
  updateProductExpenseTotal();
}

export function removeProductExpenseRow(rowId, name, category) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  if (name) {
    const chipContainerId = category === 'product' ? 'pe-product-chips' : 'pe-makeup-chips';
    const chips = document.querySelectorAll(`#${chipContainerId} .chip`);
    chips.forEach(c => { if (c.textContent.trim() === name) c.classList.remove('selected'); });
  }
  updateProductExpenseTotal();
}

export function updateProductExpenseTotal() {
  const productRows = document.querySelectorAll('#pe-product-amounts .service-amount-row');
  const makeupRows = document.querySelectorAll('#pe-makeup-amounts .service-amount-row');
  
  let total = 0;
  productRows.forEach(r => { total += parseInt(r.querySelector('.pe-amount-input, input[type="number"]')?.value) || 0; });
  makeupRows.forEach(r => { total += parseInt(r.querySelector('.pe-amount-input, input[type="number"]')?.value) || 0; });

  const el = document.getElementById('pe-total-amount');
  if (el) el.textContent = '₹' + total.toLocaleString();

  const bar = document.getElementById('pe-total-bar');
  if (bar) {
    bar.style.display = (productRows.length > 0 || makeupRows.length > 0) ? 'flex' : 'none';
  }
}

export async function submitProductExpenseForm() {
  const productRows = document.querySelectorAll('#pe-product-amounts .service-amount-row');
  const makeupRows = document.querySelectorAll('#pe-makeup-amounts .service-amount-row');
  
  const date = document.getElementById('pe-date')?.value || new Date().toISOString().split('T')[0];
  const defaultMethod = document.getElementById('pe-payment-method')?.value || 'Cash';
  const shopName = document.getElementById('pe-shop')?.value.trim() || '';
  const items = [];

  productRows.forEach(r => {
    const nameInput = r.querySelector('.sa-name-input');
    const name = nameInput ? nameInput.value.trim() : r.dataset.name;
    const amount = parseInt(r.querySelector('.pe-amount-input, input[type="number"]')?.value) || 0;
    const rowDate = r.querySelector('.pe-row-date')?.value || date;
    const payment_method = r.querySelector('.pe-row-pay')?.value || defaultMethod;
    if (amount > 0) {
      const note = shopName ? `Products: ${name} (${shopName})` : `Products: ${name}`;
      items.push({ category: 'Products', amount, date: rowDate, payment_method, note });
    }
  });

  makeupRows.forEach(r => {
    const nameInput = r.querySelector('.sa-name-input');
    const name = nameInput ? nameInput.value.trim() : r.dataset.name;
    const amount = parseInt(r.querySelector('.pe-amount-input, input[type="number"]')?.value) || 0;
    const rowDate = r.querySelector('.pe-row-date')?.value || date;
    const payment_method = r.querySelector('.pe-row-pay')?.value || defaultMethod;
    if (amount > 0) {
      const note = shopName ? `Makeup: ${name} (${shopName})` : `Makeup: ${name}`;
      items.push({ category: 'Products', amount, date: rowDate, payment_method, note });
    }
  });

  if (items.length === 0) {
    showToast('Please enter at least one product/makeup amount greater than 0', 'error');
    return;
  }

  const btn = document.getElementById('pe-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...';
  }

  let successCount = 0;
  for (let item of items) {
    const result = await addExpense(item);
    if (result) successCount++;
  }

  if (successCount > 0) {
    closeFormOverlay();
    showToast(`Successfully saved ${successCount} expenses!`);
    state.chatMessages.push({
      role: 'ai',
      text: `✅ Saved <strong>${successCount}</strong> product/makeup expenses via manual form! 🎉<br><span style="font-size:11px;color:#888">${items.map(i => `${i.note}: ₹${i.amount.toLocaleString()}`).join(' · ')}</span>`
    });
    if (typeof window.render === 'function') window.render();
    
    const chatEl = document.getElementById('chat-messages');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  } else {
    showToast('Failed to save expenses', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-check"></i> Save Expenses';
    }
  }
}

window.setExpenseTab = setExpenseTab;
window.filterExpenseByMonth = filterExpenseByMonth;
window.setExpenseMonth = filterExpenseByMonth;
window.setExpenseTrendView = setExpenseTrendView;
window.openExpenseFormSelector = openExpenseFormSelector;
window.openBulkExpenseForm = openBulkExpenseForm;
window.addBulkExpenseRow = addBulkExpenseRow;
window.removeBulkExpenseRow = removeBulkExpenseRow;
window.updateBulkExpenseTotal = updateBulkExpenseTotal;
window.submitBulkExpenseForm = submitBulkExpenseForm;
window.showAddExpenseModal = showAddExpenseModal;
window.selectGeneralExpensePayment = selectGeneralExpensePayment;
window.generalExpenseChipToggle = generalExpenseChipToggle;
window.addOtherGeneralExpense = addOtherGeneralExpense;
window.removeGeneralExpenseRow = removeGeneralExpenseRow;
window.updateGeneralExpenseTotal = updateGeneralExpenseTotal;
window.updateGeneralExpenseDefaultDate = updateGeneralExpenseDefaultDate;
window.handleDeleteExpense = handleDeleteExpense;
window.analyzeExpenses = analyzeExpenses;
window.expenseIcon = expenseIcon;
window.openProductExpenseForm = openProductExpenseForm;
window.openSalonProductExpenseForm = openSalonProductExpenseForm;
window.openMakeupExpenseForm = openMakeupExpenseForm;
window.openSingleProductExpenseForm = openSingleProductExpenseForm;
window.selectProductExpensePayment = selectProductExpensePayment;
window.updateProductExpenseDefaultDate = updateProductExpenseDefaultDate;
window.productExpenseChipToggle = productExpenseChipToggle;
window.addOtherProductExpenseAmount = addOtherProductExpenseAmount;
window.removeProductExpenseRow = removeProductExpenseRow;
window.updateProductExpenseTotal = updateProductExpenseTotal;
window.submitProductExpenseForm = submitProductExpenseForm;

export function showStartingBalanceModal(monthStr, currentCash = 0, currentGPay = 0) {
  const monthParts = monthStr.split('-');
  const dateObj = new Date(parseInt(monthParts[0]), parseInt(monthParts[1]) - 1);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const displayMonth = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  showModal(`Set Starting Balance — ${displayMonth}`, `
    <div style="font-size:12.5px; color:#555; margin-bottom:14px;">
      Enter the starting Cash in Hand and GPay balance for the month of <strong>${displayMonth}</strong>.
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Cash in Hand Starting (₹) *</label>
        <input class="form-input" id="m-start-cash" type="number" value="${currentCash || ''}" placeholder="e.g. 5000">
      </div>
      <div class="form-group">
        <label class="form-label">GPay Balance Starting (₹) *</label>
        <input class="form-input" id="m-start-gpay" type="number" value="${currentGPay || ''}" placeholder="e.g. 25000">
      </div>
    </div>
  `, async () => {
    const cash = parseInt(document.getElementById('m-start-cash').value) || 0;
    const gpay = parseInt(document.getElementById('m-start-gpay').value) || 0;

    const result = await saveMonthlyBalance({
      month: monthStr,
      cash_balance: cash,
      gpay_balance: gpay
    });

    if (result) {
      closeModal();
      if (typeof window.render === 'function') window.render();
    }
  });
}

window.showStartingBalanceModal = showStartingBalanceModal;
window.initExpenseAnalyticsCharts = initExpenseAnalyticsCharts;
