// billl/js/pages/dashboard.js
import { fetchCustomers, fetchEvents, fetchExpenses, fetchClassEnrollments, fetchJewels, fetchEmployees } from '../db.js';
import { formatEmpTag } from '../utils.js';
import { calculateModuleStreak } from '../streak.js';



// 3. 7-Day Bridal & Event Countdown
function renderEventCountdown(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeEvents = (events || []).filter(e => e.status !== 'Completed' && e.date);
  
  const withCountdown = activeEvents.map(e => {
    const evDate = new Date(e.date);
    evDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((evDate - today) / (1000 * 60 * 60 * 24));
    return { ...e, diffDays };
  }).filter(e => e.diffDays >= 0);

  withCountdown.sort((a, b) => a.diffDays - b.diffDays);
  const displayEvents = withCountdown.slice(0, 4);

  return `
  <div class="card" style="height:100%;">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
      <span style="display:inline-flex; align-items:center; gap:8px;">
        <i class="ti ti-calendar-event" style="color:#d97706;font-size:17px"></i> Upcoming Events
      </span>
      <button class="btn btn-gold" style="padding:4px 8px; font-size:11px; height:24px; display:inline-flex; align-items:center; gap:4px;" onclick="window.openEventCustomerForm()">
        <i class="ti ti-plus" style="font-size:10px;"></i> Book Event
      </button>
    </div>
    ${displayEvents.length === 0 ? `
      <div class="dash-item-sub-muted" style="text-align:center; padding:30px 10px;">
        <i class="ti ti-calendar-off" style="font-size:32px; display:block; margin-bottom:8px; opacity:0.5;"></i>
        No upcoming events scheduled.
      </div>
    ` : displayEvents.map(e => {
      const { cleanText: cleanCustomer, tagHtml: empBadge } = formatEmpTag(e.customer);
      let countdownLabel = `In ${e.diffDays} days`;
      let countdownBadge = 'badge-blue';
      if (e.diffDays === 0) { countdownLabel = 'TODAY! 👑'; countdownBadge = 'badge-red'; }
      else if (e.diffDays === 1) { countdownLabel = 'Tomorrow 🔥'; countdownBadge = 'badge-amber'; }
      else if (e.diffDays <= 3) { countdownBadge = 'badge-purple'; }

      return `
      <div class="event-card dash-subcard" style="padding:12px 14px; margin-bottom:10px; border-radius:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span class="dash-customer-name" style="font-size:13.5px; font-weight:600;">${cleanCustomer}</span>
              ${empBadge}
              <span class="badge ${countdownBadge}" style="font-size:10px; font-weight:700;">${countdownLabel}</span>
            </div>
            <div class="dash-item-sub" style="font-size:11.5px; margin-top:3px;">
              <i class="ti ti-sparkles" style="font-size:11px; color:#d97706;"></i> ${e.type || 'Makeover'} · 📅 ${e.date}${e.time ? ` at ${e.time}` : ''}
            </div>
            ${e.venue ? `<div class="dash-item-sub-muted" style="font-size:11px; margin-top:2px;"><i class="ti ti-map-pin" style="font-size:11px;"></i> ${e.venue}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div class="dash-item-amount" style="font-size:12.5px; font-weight:700;">₹${(e.amount || 0).toLocaleString()}</div>
            <span class="badge ${(e.pending || 0) > 0 ? 'badge-amber' : 'badge-green'}" style="font-size:10px; margin-top:3px;">
              ${(e.pending || 0) > 0 ? `₹${(e.pending || 0).toLocaleString()} due` : 'Paid in Full'}
            </span>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// 4. Pending Money on Event
function renderPendingPaymentReminders(pendingCustomers, pendingEvents) {
  const dues = [];

  (pendingEvents || []).forEach(e => {
    dues.push({
      name: e.customer,
      phone: e.phone,
      amount: e.pending || 0,
      type: `${e.type || 'Event'} Booking`,
      date: e.date || 'Upcoming'
    });
  });

  dues.sort((a, b) => b.amount - a.amount);
  const topDues = dues.slice(0, 4);

  return `
  <div class="card" style="height:100%;">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
      <span style="display:inline-flex; align-items:center; gap:8px;">
        <i class="ti ti-bell-ringing" style="color:#d97706;font-size:17px"></i> Pending Money on Event
      </span>
      <span class="badge badge-amber" style="font-size:11px; font-weight:600;">${dues.length} pending</span>
    </div>
    ${topDues.length === 0 ? `
      <div style="text-align:center; padding:30px 10px; color:#22c55e; font-weight:500;">
        <i class="ti ti-circle-check" style="font-size:36px; display:block; margin-bottom:8px; opacity:0.9;"></i>
        All event payments are up to date! 🎉
      </div>
    ` : topDues.map(d => {
      const { cleanText: cleanName } = formatEmpTag(d.name);
      const cleanPhone = (d.phone || '').replace(/\D/g, '');
      const hasPhone = cleanPhone.length >= 10;
      const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const reminderMsg = `Hello ${cleanName}! Greetings from Kalai Makeover. A gentle reminder regarding your pending balance of ₹${d.amount.toLocaleString()} for ${d.type}. Kindly complete the payment via GPay/PhonePe to 9994644080. Thank you! ✨`;
      const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(reminderMsg)}`;

      return `
      <div class="dash-subcard" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; margin-bottom:8px; border-radius:10px;">
        <div style="flex:1; min-width:0; margin-right:10px;">
          <div class="dash-customer-name" style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${cleanName}
          </div>
          <div class="dash-item-sub-muted" style="font-size:11px;">
            ${d.type} · ${d.date} ${d.phone ? `· ${d.phone}` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="font-size:13px; font-weight:700; color:#ef4444; text-align:right;">
            ₹${d.amount.toLocaleString()}
          </div>
          ${hasPhone ? `
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn" style="background:#25d366; color:#fff; padding:4px 8px; font-size:11px; height:26px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; text-decoration:none;" title="Send polite WhatsApp reminder">
              <i class="ti ti-brand-whatsapp" style="font-size:13px;"></i> Remind
            </a>
          ` : `
            <span class="dash-item-sub-muted" style="font-size:10px; font-style:italic;">No phone</span>
          `}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// 5. Top Services This Month
function parseServicePayment(s, defaultMethod = '') {
  const str = (s || '').trim();
  let method = '';

  if (/\((?:Cash:\s*₹?\d+,\s*GPay:\s*₹?\d+|Both)\)/i.test(str)) {
    method = 'both';
  } else if (/\((?:GPay|UPI|Online)\)/i.test(str)) {
    method = 'gpay';
  } else if (/\(Cash\)/i.test(str)) {
    method = 'cash';
  } else if (defaultMethod) {
    const dm = defaultMethod.toLowerCase();
    if (dm.includes('both')) method = 'both';
    else if (dm.includes('gpay') || dm.includes('upi') || dm.includes('online')) method = 'gpay';
    else if (dm.includes('cash')) method = 'cash';
  }

  const cleanName = str
    .replace(/\s*\((?:Cash:\s*₹?\d+,\s*GPay:\s*₹?\d+|Both|Cash|GPay|Online|UPI)[^)]*\)/gi, '')
    .trim();

  return { cleanName: cleanName || str, method };
}

function renderTopServicesWidget(customers) {
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  const aggregateServices = (filterMonth) => {
    const stats = {};
    (customers || []).forEach(c => {
      if (filterMonth && c.last_visit && !c.last_visit.startsWith(currentMonthStr)) return;
      let list = [];
      if (Array.isArray(c.services)) list = c.services;
      else if (typeof c.services === 'string') list = c.services.split(',');

      list.forEach(s => {
        const { cleanName, method } = parseServicePayment(s, c.payment_method);
        if (!cleanName) return;

        const key = cleanName.toLowerCase();
        if (!stats[key]) {
          stats[key] = {
            name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
            total: 0,
            cash: 0,
            gpay: 0,
            other: 0
          };
        }
        stats[key].total += 1;
        if (method === 'cash') stats[key].cash += 1;
        else if (method === 'gpay') stats[key].gpay += 1;
        else if (method === 'both') {
          stats[key].cash += 1;
          stats[key].gpay += 1;
        } else {
          stats[key].other += 1;
        }
      });
    });
    return stats;
  };

  let serviceStats = aggregateServices(true);
  let sorted = Object.values(serviceStats).sort((a, b) => b.total - a.total).slice(0, 5);

  if (sorted.length === 0) {
    serviceStats = aggregateServices(false);
    sorted = Object.values(serviceStats).sort((a, b) => b.total - a.total).slice(0, 5);
  }

  const maxVal = sorted.length ? Math.max(...sorted.map(s => s.total), 1) : 1;

  return `
  <div class="card" style="height:100%;">
    <div class="section-title">
      <i class="ti ti-award" style="color:#d97706;font-size:17px"></i> Top 5 Salon Services This Month
    </div>
    ${sorted.length === 0 ? `
      <div class="dash-item-sub-muted" style="text-align:center; padding:30px 10px;">No services logged yet.</div>
    ` : sorted.map((data, idx) => {
      const pct = Math.round((data.total / maxVal) * 100);
      const colors = ['#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#f97316'];
      
      const paymentParts = [];
      if (data.cash > 0) paymentParts.push(`${data.cash} Cash`);
      if (data.gpay > 0) paymentParts.push(`${data.gpay} GPay`);
      if (data.other > 0 && paymentParts.length === 0) paymentParts.push(`${data.other} visits`);
      const paymentBreakdown = paymentParts.join(' · ');

      return `
      <div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; margin-bottom:4px; gap:8px;">
          <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
            <span class="dash-customer-name" style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              <span class="dash-item-sub-muted" style="font-size:11px; margin-right:4px;">#${idx + 1}</span> ${data.name}
            </span>
            ${paymentBreakdown ? `
              <span class="dash-item-sub-muted" style="font-size:11px; font-weight:500; white-space:nowrap;">
                (${paymentBreakdown})
              </span>
            ` : ''}
          </div>
          <span style="font-weight:700; color:${colors[idx % colors.length]}; font-size:12px; white-space:nowrap;">
            ${data.total} ${data.total === 1 ? 'visit' : 'visits'}
          </span>
        </div>
        <div class="dash-progress-track" style="border-radius:4px; height:6px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; border-radius:4px; background:${colors[idx % colors.length]};"></div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// 6. Staff Activity Today
function renderStaffActivityToday(customers, events, employees) {
  const todayStr = new Date().toISOString().split('T')[0];
  const staffCounts = {};

  (employees || []).forEach(emp => {
    staffCounts[emp.id] = { id: emp.id, name: emp.name || 'Staff', count: 0, role: emp.role || 'Stylist' };
  });

  (customers || []).filter(c => c.last_visit === todayStr).forEach(c => {
    const raw = `${c.name || ''} ${c.notes || ''}`.toLowerCase();
    (employees || []).forEach(emp => {
      if (emp.name && raw.includes(emp.name.toLowerCase())) {
        staffCounts[emp.id].count++;
      }
    });
  });

  (events || []).filter(e => e.date === todayStr).forEach(e => {
    if (e.assigned_employee && staffCounts[e.assigned_employee]) {
      staffCounts[e.assigned_employee].count++;
    }
  });

  const staffList = Object.values(staffCounts);

  return `
  <div class="card" style="height:100%;">
    <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
      <span style="display:inline-flex; align-items:center; gap:8px;">
        <i class="ti ti-users-group" style="color:#7c3aed;font-size:17px"></i> Staff Activity Today
      </span>
      <button class="btn btn-outline" style="padding:4px 8px; font-size:11px; height:24px;" onclick="showPage('employees')">
        View All
      </button>
    </div>
    ${staffList.length === 0 ? `
      <div class="dash-item-sub-muted" style="text-align:center; padding:30px 10px;">No staff records available.</div>
    ` : staffList.slice(0, 4).map(s => {
      const initials = (s.name || 'S').substring(0, 2).toUpperCase();
      return `
      <div class="dash-subcard" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; margin-bottom:8px; border-radius:10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="dash-staff-avatar" style="width:34px; height:34px; border-radius:10px; font-weight:700; display:flex; align-items:center; justify-content:center; font-size:12px;">
            ${initials}
          </div>
          <div>
            <div class="dash-customer-name" style="font-size:13px; font-weight:600;">${s.name}</div>
            <div class="dash-item-sub-muted" style="font-size:11px;">${s.role}</div>
          </div>
        </div>
        <div>
          <span class="badge ${s.count > 0 ? 'badge-green' : 'badge-gray'}" style="font-size:11px; font-weight:600;">
            ${s.count} ${s.count === 1 ? 'service' : 'services'} today
          </span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// 7. Academy & Bridal Jewellery Snapshot
function renderAcademyAndJewelsSnapshot(students, jewels) {
  const activeStudents = (students || []).filter(s => s.status === 'Active').length;
  const totalStudents = (students || []).length;
  const totalFees = (students || []).reduce((sum, s) => sum + (s.total_fee || s.fee || 0), 0);
  const totalPaid = (students || []).reduce((sum, s) => sum + (s.total_paid || s.paid || 0), 0);
  const pendingFees = Math.max(0, totalFees - totalPaid);
  const isPendingZero = pendingFees === 0;

  const totalJewels = (jewels || []).length;
  const rentedJewels = (jewels || []).filter(j => j.status === 'Rented').length;
  const jewelIncome = (jewels || []).reduce((sum, j) => sum + (j.total_rental_income || 0), 0);

  return `
  <div class="grid-2">
    <!-- Academy Snapshot -->
    <div class="card">
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <i class="ti ti-school" style="color:#2563eb;font-size:17px"></i> Kalai Academy
        </span>
        <button class="btn btn-outline" style="padding:4px 8px; font-size:11px; height:24px; border-color:#2563eb; color:#2563eb;" onclick="showPage('students')">
          Manage Academy →
        </button>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
        <div class="dash-snapshot-card dsc-blue" style="border-radius:10px; padding:12px; text-align:center;">
          <div class="dsc-label" style="font-size:11px; font-weight:600;">Active Students</div>
          <div class="dsc-val" style="font-size:22px; font-weight:800; margin-top:2px;">${activeStudents}</div>
          <div class="dsc-sub" style="font-size:10px;">${totalStudents} total enrolled</div>
        </div>
        <div class="dash-snapshot-card ${isPendingZero ? 'dsc-green' : 'dsc-red'}" style="border-radius:10px; padding:12px; text-align:center;">
          <div class="dsc-label" style="font-size:11px; font-weight:600;">Pending Fees</div>
          <div class="dsc-val" style="font-size:22px; font-weight:800; margin-top:2px;">₹${pendingFees.toLocaleString()}</div>
          <div class="dsc-sub" style="font-size:10px;">${isPendingZero && totalFees > 0 ? `₹${totalPaid.toLocaleString()} collected (100%)` : `₹${totalPaid.toLocaleString()} collected`}</div>
        </div>
      </div>
    </div>

    <!-- Bridal Jewellery Snapshot -->
    <div class="card">
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <i class="ti ti-diamond" style="color:#059669;font-size:17px"></i> Bridal Jewellery Rentals
        </span>
        <button class="btn btn-outline" style="padding:4px 8px; font-size:11px; height:24px; border-color:#059669; color:#059669;" onclick="showPage('jewels')">
          View Jewels →
        </button>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
        <div class="dash-snapshot-card dsc-green" style="border-radius:10px; padding:12px; text-align:center;">
          <div class="dsc-label" style="font-size:11px; font-weight:600;">Out on Rent</div>
          <div class="dsc-val" style="font-size:22px; font-weight:800; margin-top:2px;">${rentedJewels}</div>
          <div class="dsc-sub" style="font-size:10px;">${totalJewels} sets in stock</div>
        </div>
        <div class="dash-snapshot-card dsc-amber" style="border-radius:10px; padding:12px; text-align:center;">
          <div class="dsc-label" style="font-size:11px; font-weight:600;">Rental Income</div>
          <div class="dsc-val" style="font-size:22px; font-weight:800; margin-top:2px;">₹${jewelIncome.toLocaleString()}</div>
          <div class="dsc-sub" style="font-size:10px;">Total earnings</div>
        </div>
      </div>
    </div>
  </div>`;
}



export async function renderDashboard() {
  const [customers, events, expenses, students, jewels, employees] = await Promise.all([
    fetchCustomers(),
    fetchEvents(),
    fetchExpenses(),
    fetchClassEnrollments().catch(() => []),
    fetchJewels().catch(() => []),
    fetchEmployees().catch(() => [])
  ]);

  window._cachedAllModulesData = { customers, events, expenses, students, jewels, employees };
  const customerStreak = calculateModuleStreak(customers, 'last_visit', new Date().getMonth());

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCustomers = customers.filter(c => c.last_visit === todayStr);
  const todayRevenue = todayCustomers.reduce((s, c) => s + (c.amount || 0), 0);
  const monthRevenue = customers.reduce((s, c) => s + (c.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const todayExpenses = expenses.filter(e => e.date === todayStr);
  const todayExpenseTotal = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const pendingCustomers = customers.filter(c => c.payment_status === 'pending');
  const pendingEvents = events.filter(e => (e.pending || 0) > 0);
  const pendingTotal = pendingCustomers.reduce((s, c) => s + (c.amount || 0), 0) + pendingEvents.reduce((s, e) => s + (e.pending || 0), 0);

  // Cache last 4 active months for the dashboard summary bar chart
  const monthKeys = new Set();
  customers.forEach(c => { if (c.last_visit) monthKeys.add(c.last_visit.substring(0, 7)); });
  expenses.forEach(e => { if (e.date) monthKeys.add(e.date.substring(0, 7)); });

  if (monthKeys.size === 0) {
    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  const sortedKeys = Array.from(monthKeys).sort().slice(-4);
  const dashboardMonths = sortedKeys.map(k => {
    const [yr, mn] = k.split('-');
    const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
    const mName = d.toLocaleString('en-US', { month: 'short' });
    return { name: mName, key: k, revenue: 0, expenses: 0 };
  });

  customers.forEach(c => {
    if (!c.last_visit) return;
    const mKey = c.last_visit.substring(0, 7);
    const mObj = dashboardMonths.find(m => m.key === mKey);
    if (mObj) mObj.revenue += (c.amount || 0);
  });

  events.forEach(e => {
    if (!e.date) return;
    const mKey = e.date.substring(0, 7);
    const mObj = dashboardMonths.find(m => m.key === mKey);
    if (mObj) mObj.revenue += (e.advance || 0);
  });

  expenses.forEach(e => {
    if (!e.date) return;
    const mKey = e.date.substring(0, 7);
    const mObj = dashboardMonths.find(m => m.key === mKey);
    if (mObj) mObj.expenses += (e.amount || 0);
  });

  window._dashboardData = {
    labels: dashboardMonths.map(m => m.name),
    revenue: dashboardMonths.map(m => m.revenue),
    expenses: dashboardMonths.map(m => m.expenses)
  };

  return `

  <!-- 2. Salon Master Streak & Customer Entry Gamification Card -->
  <div class="card streak-widget-card" style="margin-bottom:20px; padding:15px 18px; background:linear-gradient(135deg, #1f1b2e, #110e1b); color:#ffffff; border:1px solid #332a4d; border-radius:16px; box-shadow:0 8px 30px rgba(124, 58, 237, 0.15);">
    <!-- Month Date Strip & Daily Entry Status Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:11.5px; text-transform:uppercase; letter-spacing:0.05em; color:rgba(255,255,255,0.5); font-weight:600;">
          Today's Customer Entry:
        </span>
        <span style="font-size:12px; font-weight:700; padding:2px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:5px; ${customerStreak.todayRecorded ? 'background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.35);' : 'background:rgba(245,200,66,0.15); color:#f5c842; border:1px solid rgba(245,200,66,0.3);'}">
          ${customerStreak.todayRecorded ? '✅ Completed' : '⏳ Pending'}
        </span>
        <span style="font-size:11.5px; background:rgba(245,200,66,0.15); color:#f5c842; border:1px solid rgba(245,200,66,0.3); padding:2px 8px; border-radius:10px; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
          Streak: ${customerStreak.currentStreak} Days 🔥
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:8px; font-size:12px;">
        <span style="color:${customerStreak.missedDaysCount > 0 ? '#f87171' : '#34d399'}; font-weight:600;">
          ${customerStreak.missedDaysCount === 0 ? '0 Days Missed' : `${customerStreak.missedDaysCount} Days Missed`}
        </span>
        <span style="color:rgba(255,255,255,0.4);">·</span>
        <span style="color:rgba(255,255,255,0.7); font-weight:500;">
          ${customerStreak.targetMonthName || 'Month'} (${customerStreak.monthActiveDaysCount}/${customerStreak.elapsedDaysInMonth || customerStreak.daysInMonth} days active)
        </span>
      </div>
    </div>

    <!-- Scrollable Month Days Strip (Days 1 to 30) -->
    <div class="scrollbar-hide" style="display:flex; gap:6px; overflow-x:auto; padding:4px 2px 8px; -webkit-overflow-scrolling:touch;" id="dashboard-month-days-strip">
      ${(customerStreak.monthDays || []).map(day => {
        const isToday = !!day.isToday;
        const hasData = !!day.hasData;
        const isFuture = !!day.isFuture;
        const isMissed = !hasData && !isFuture;

        return `
          <div data-day-box="true" data-today="${isToday}" data-has-data="${hasData}" data-missed="${isMissed}" onclick="showPage('customers')" style="flex:0 0 46px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:7px 2px; border-radius:10px; border:1px solid rgba(245,200,66,0.15); cursor:pointer; transition:all 0.15s;" title="${day.dateStr || ''} (${day.dayName}): ${hasData ? `${day.count || 1} customer entry record(s)` : (isFuture ? 'Upcoming day' : 'Missed day')} — Click to open Customers">
            <span class="day-name-label" style="font-size:9px; font-weight:600; text-transform:uppercase;">${day.dayName}</span>
            <span class="day-num-label" style="font-size:12.5px; font-weight:700; margin:2px 0;">${day.dayNum}</span>
            <span style="font-size:13px; line-height:1;">${hasData ? '🔥' : (isFuture ? '·' : '❌')}</span>
            ${isToday ? `<span style="font-size:8px; font-weight:800; color:#f5c842; text-transform:uppercase; margin-top:2px;">Today</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  </div>

  <!-- 4. Key Financial Metrics -->
  <div class="metric-grid">
    <div class="metric-card mc-gold">
      <div class="metric-label">Today's Revenue</div>
      <div class="metric-value">₹${todayRevenue.toLocaleString()}</div>
      <div class="metric-sub">${todayCustomers.length} customers today</div>
      <i class="ti ti-currency-rupee metric-icon"></i>
    </div>
    <div class="metric-card mc-orange">
      <div class="metric-label">Today's Expense</div>
      <div class="metric-value">₹${todayExpenseTotal.toLocaleString()}</div>
      <div class="metric-sub">${todayExpenses.length} entries today</div>
      <i class="ti ti-receipt metric-icon"></i>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Total Revenue</div>
      <div class="metric-value">₹${monthRevenue.toLocaleString()}</div>
      <div class="metric-sub">${customers.length} total customers</div>
      <i class="ti ti-trending-up metric-icon"></i>
    </div>
    <div class="metric-card mc-purple">
      <div class="metric-label">Total Expenses</div>
      <div class="metric-value">₹${totalExpenses.toLocaleString()}</div>
      <div class="metric-sub">Net: ₹${(monthRevenue - totalExpenses).toLocaleString()}</div>
      <i class="ti ti-receipt metric-icon"></i>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Pending Payments</div>
      <div class="metric-value">₹${pendingTotal.toLocaleString()}</div>
      <div class="metric-sub">${pendingEvents.length} event pending</div>
      <i class="ti ti-clock metric-icon"></i>
    </div>
  </div>

  <!-- 5. Upcoming Events (Left) + Pending Money on Event (Right) -->
  <div class="grid-2">
    ${renderEventCountdown(events)}
    ${renderPendingPaymentReminders(pendingCustomers, pendingEvents)}
  </div>

  <!-- 6. Top Services (Left) + Staff Activity Today (Right) -->
  <div class="grid-2">
    ${renderTopServicesWidget(customers)}
    ${renderStaffActivityToday(customers, events, employees)}
  </div>

  <!-- 7. Kalai Academy & Bridal Jewellery Rentals -->
  ${renderAcademyAndJewelsSnapshot(students, jewels)}

  <!-- 9. Recent Customers & Monthly Summary -->
  <div class="grid-2">
    <div class="card">
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <i class="ti ti-users" style="color:#d97706;font-size:16px"></i> Recent Walk-In Customers
        </span>
        <button class="btn btn-gold" style="padding:4px 8px; font-size:11px; height:24px; display:inline-flex; align-items:center; gap:4px;" onclick="openShopCustomerForm()">
          <i class="ti ti-plus" style="font-size:10px;"></i> Add Customer
        </button>
      </div>
      ${customers.slice(0, 4).map((c, i) => {
        const colors = ['av-gold', 'av-teal', 'av-rose', 'av-purple'];
        const { cleanText: cleanName, tagHtml: empBadge } = formatEmpTag(c.name);
        const initials = cleanName.split(' ').map(n => n[0]).join('').slice(0, 2);
        return `<div class="customer-row">
          <div class="avatar ${colors[i % 4]}">${initials}</div>
          <div style="flex:1">
            <div class="dash-customer-name" style="font-size:13px; font-weight:500; display:inline-flex; align-items:center;">${cleanName} ${empBadge}</div>
            <div class="dash-item-sub-muted" style="font-size:11px;">${Array.isArray(c.services) ? c.services.join(', ') : (c.services || '')}</div>
          </div>
          <div style="text-align:right">
            <div class="dash-item-amount" style="font-size:13px; font-weight:600; color:#f59e0b">₹${(c.amount || 0).toLocaleString()}</div>
            <span class="badge ${c.payment_status === 'paid' ? 'badge-green' : 'badge-red'}" style="font-size:10px">${c.payment_status || 'pending'}</span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="card">
      <div class="section-title"><i class="ti ti-chart-donut" style="color:#d97706;font-size:16px"></i> Financial Summary</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px">
        ${[
          { label: 'Total Income', val: '₹' + monthRevenue.toLocaleString(), color: '#22c55e' },
          { label: 'Total Expenses', val: '₹' + totalExpenses.toLocaleString(), color: '#ef4444' },
          { label: 'Pending Dues', val: '₹' + pendingTotal.toLocaleString(), color: '#f59e0b' },
          { label: 'Net Profit', val: '₹' + (monthRevenue - totalExpenses).toLocaleString(), color: '#a855f7' },
        ].map(m => `
          <div class="dash-summary-tile" style="border-radius:10px;padding:12px">
            <div class="dash-item-sub-muted" style="font-size:11px;margin-bottom:4px">${m.label}</div>
            <div style="font-size:17px;font-weight:700;color:${m.color}">${m.val}</div>
          </div>
        `).join('')}
      </div>
      <div style="position:relative;width:100%;height:130px;margin-top:14px">
        <canvas id="revenueChart" role="img" aria-label="Revenue vs expenses bar chart">Revenue ${monthRevenue}, Expenses ${totalExpenses}</canvas>
      </div>
    </div>
  </div>`;
}


export function initCharts() {
  setTimeout(() => {
    const todayEl = document.querySelector('#dashboard-month-days-strip [data-today="true"]');
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, 100);

  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;
  const dd = window._dashboardData || { labels: ['None'], revenue: [0], expenses: [0] };
  
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library is not loaded.');
    return;
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dd.labels,
      datasets: [
        { label: 'Revenue', data: dd.revenue, backgroundColor: '#f5c842', borderRadius: 4 },
        { label: 'Expenses', data: dd.expenses, backgroundColor: '#e5e7eb', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { display: false, grid: { display: false } }
      }
    }
  });
}
