// billl/js/pages/dashboard.js
import { fetchCustomers, fetchEvents, fetchExpenses, fetchClassEnrollments, fetchJewels } from '../db.js';
import { formatEmpTag } from '../utils.js';
import { calculateMonthlyGamification, showMonthlyReportModal } from '../streak.js';

const MOTIVATIONAL_QUOTES = [
  "Your business grows when you help others feel beautiful and confident. ✨",
  "Great things are done by a series of small things brought together. Keep styling! 💄",
  "Success isn't about being perfect; it's about making progress every day. 🌟",
  "The beauty you create today is the success you celebrate tomorrow. 💅",
  "Every customer is an opportunity to make someone's day a little brighter. ☀️",
  "Invest in your dreams. Grasp opportunities. Love your craft. 💫",
  "Believe you can and you're halfway there. Keep shining, Kalai! 👑",
  "Success is the sum of small efforts repeated day in and day out. 📈",
  "Behind every successful makeover is a story of hard work and passion. 💕",
  "Create your own style. Let it be unique and identifiable. 🌸",
  "Your passion is your power. Keep making the world beautiful! 🎨",
  "Success is the courage to continue that counts. Keep going! 🚀",
  "Energy and persistence conquer all things. Have a great day of styling! ⚡",
  "Do what you love, love what you do, and success will follow. 💖",
  "Every face is a blank canvas, and you are the artist. Keep creating! 🎨"
];

function getDailyQuote() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const index = dayOfYear % MOTIVATIONAL_QUOTES.length;
  return MOTIVATIONAL_QUOTES[index];
}

export async function renderDashboard() {
  const [customers, events, expenses, students, jewels] = await Promise.all([
    fetchCustomers(),
    fetchEvents(),
    fetchExpenses(),
    fetchClassEnrollments().catch(() => []),
    fetchJewels().catch(() => [])
  ]);

  window._cachedAllModulesData = { customers, events, expenses, students, jewels };
  const stats = calculateMonthlyGamification(window._cachedAllModulesData);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCustomers = customers.filter(c => c.last_visit === todayStr);
  const todayRevenue = todayCustomers.reduce((s,c) => s + (c.amount||0), 0);
  const monthRevenue = customers.reduce((s,c) => s + (c.amount||0), 0);
  const totalExpenses = expenses.reduce((s,e) => s + (e.amount||0), 0);
  const todayExpenses = expenses.filter(e => e.date === todayStr);
  const todayExpenseTotal = todayExpenses.reduce((s,e) => s + (e.amount||0), 0);
  const pendingCustomers = customers.filter(c => c.payment_status === 'pending');
  const pendingEvents = events.filter(e => (e.pending||0) > 0);
  const pendingTotal = pendingCustomers.reduce((s,c) => s + (c.amount||0), 0) + pendingEvents.reduce((s,e) => s + (e.pending||0), 0);

  // Cache last 4 active months for the dashboard summary bar chart
  const monthKeys = new Set();
  customers.forEach(c => { if(c.last_visit) monthKeys.add(c.last_visit.substring(0,7)); });
  expenses.forEach(e => { if(e.date) monthKeys.add(e.date.substring(0,7)); });

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
    if(!c.last_visit) return;
    const mKey = c.last_visit.substring(0,7);
    const mObj = dashboardMonths.find(m => m.key === mKey);
    if(mObj) mObj.revenue += (c.amount || 0);
  });

  events.forEach(e => {
    if(!e.date) return;
    const mKey = e.date.substring(0,7);
    const mObj = dashboardMonths.find(m => m.key === mKey);
    if(mObj) mObj.revenue += (e.advance || 0);
  });

  expenses.forEach(e => {
    if(!e.date) return;
    const mKey = e.date.substring(0,7);
    const mObj = dashboardMonths.find(m => m.key === mKey);
    if(mObj) mObj.expenses += (e.amount || 0);
  });

  window._dashboardData = {
    labels: dashboardMonths.map(m => m.name),
    revenue: dashboardMonths.map(m => m.revenue),
    expenses: dashboardMonths.map(m => m.expenses)
  };

  // Dynamic reminders based on real data
  const dynamicReminders = [];
  pendingCustomers.forEach(c => dynamicReminders.push({text:`${c.name} has ₹${(c.amount||0).toLocaleString()} pending payment`, level:'red', icon:'ti-alert-circle'}));
  pendingEvents.forEach(e => dynamicReminders.push({text:`${e.customer}'s ${e.type} on ${e.date} — ₹${(e.pending||0).toLocaleString()} pending`, level:'amber', icon:'ti-calendar-event'}));
  if(dynamicReminders.length === 0) dynamicReminders.push({text:'All payments are up to date! 🎉', level:'blue', icon:'ti-check'});

  const today = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dailyQuote = getDailyQuote();

  return `
  <div class="top-bar">
    <div>
      <h2>Good ${today.getHours()<12?'morning':today.getHours()<17?'afternoon':'evening'}, Kalai! ☀️</h2>
      <p style="font-size:12px;color:#999;margin-top:2px">${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}</p>
      <div style="font-size:12px;font-style:italic;color:#d97706;margin-top:8px;background:rgba(245,200,66,0.06);border-left:3px solid #f5c842;padding:6px 12px;border-radius:0 8px 8px 0;max-width:600px;display:flex;align-items:center;gap:6px;">
        <i class="ti ti-quote" style="font-size:14px;color:#d97706;"></i> <span>"${dailyQuote}"</span>
      </div>
    </div>
    <div class="date" style="align-self:flex-start;"><i class="ti ti-sparkles" style="color:#d97706;margin-right:4px"></i>Kalai Makeover</div>
  </div>

  <!-- Salon Master Streak & Gamification Card -->
  <div class="card" style="margin-bottom:20px; padding:20px; background:linear-gradient(135deg, #1f1b2e, #110e1b); color:#ffffff; border:1px solid #332a4d; border-radius:16px; box-shadow:0 8px 30px rgba(124, 58, 237, 0.15);">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:14px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#f59e0b,#ea580c); display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 4px 14px rgba(245,158,11,0.4);">
          🔥
        </div>
        <div>
          <div style="font-size:18px; font-weight:700; color:#ffffff; display:flex; align-items:center; gap:8px;">
            Overall Salon Master Streak
            <span style="font-size:11px; background:rgba(245,200,66,0.2); color:#f5c842; border:1px solid rgba(245,200,66,0.4); padding:2px 8px; border-radius:12px;">
              ${stats.title}
            </span>
          </div>
          <div style="font-size:12px; color:rgba(255,255,255,0.65); margin-top:2px;">
            Monthly Points: <strong style="color:#f5c842">${stats.totalPoints.toLocaleString()} Pts</strong> · Consistency: <strong style="color:#34d399">${stats.consistencyRate}%</strong>
          </div>
        </div>
      </div>
      <button class="btn btn-gold" onclick="window.showMonthlyReportModal(window._cachedAllModulesData)" style="box-shadow:0 4px 12px rgba(245,200,66,0.3); font-size:12px; height:34px; padding:0 16px;">
        <i class="ti ti-trophy"></i> Monthly Report Scorecard
      </button>
    </div>

    <!-- Today's 3-Module Entry Matrix -->
    <div style="font-size:11.5px; text-transform:uppercase; letter-spacing:0.05em; color:rgba(255,255,255,0.5); font-weight:600; margin-bottom:10px;">
      Today's Data Entry Matrix (${stats.todayCompletedCount}/3 Completed)
    </div>
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
      <div onclick="showPage('customers')" style="background:${stats.todayMatrix.customers ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${stats.todayMatrix.customers ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}; padding:12px; border-radius:10px; text-align:center; cursor:pointer;" title="Go to Customers">
        <div style="font-size:12px; color:${stats.todayMatrix.customers ? '#4ade80' : 'rgba(255,255,255,0.5)'}; font-weight:600;">👥 Customers</div>
        <div style="font-size:18px; margin-top:4px;">${stats.todayMatrix.customers ? '✅' : '⏳'}</div>
      </div>
      <div onclick="showPage('expenses')" style="background:${stats.todayMatrix.expenses ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${stats.todayMatrix.expenses ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}; padding:12px; border-radius:10px; text-align:center; cursor:pointer;" title="Go to Expenses">
        <div style="font-size:12px; color:${stats.todayMatrix.expenses ? '#4ade80' : 'rgba(255,255,255,0.5)'}; font-weight:600;">💸 Expenses</div>
        <div style="font-size:18px; margin-top:4px;">${stats.todayMatrix.expenses ? '✅' : '⏳'}</div>
      </div>
      <div onclick="showPage('events')" style="background:${stats.todayMatrix.events ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${stats.todayMatrix.events ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}; padding:12px; border-radius:10px; text-align:center; cursor:pointer;" title="Go to Events">
        <div style="font-size:12px; color:${stats.todayMatrix.events ? '#4ade80' : 'rgba(255,255,255,0.5)'}; font-weight:600;">🎉 Events</div>
        <div style="font-size:18px; margin-top:4px;">${stats.todayMatrix.events ? '✅' : '⏳'}</div>
      </div>
    </div>
  </div>

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
      <div class="metric-sub">${pendingCustomers.length + pendingEvents.length} pending</div>
      <i class="ti ti-clock metric-icon"></i>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <i class="ti ti-calendar-event" style="color:#d97706;font-size:16px"></i> Upcoming Events
        </span>
        <button class="btn btn-gold" style="padding:4px 8px; font-size:11px; height:24px; display:inline-flex; align-items:center; gap:4px;" onclick="openEventCustomerForm()">
          <i class="ti ti-plus" style="font-size:10px;"></i> Book Event
        </button>
      </div>
      ${events.filter(e=>e.status!=='Completed').slice(0,4).map(e=>{
        const { cleanText: cleanCustomer, tagHtml: empBadge } = formatEmpTag(e.customer);
        return `
        <div class="event-card" style="padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:13px;font-weight:600;color:#1a1a1a;display:inline-flex;align-items:center;">${cleanCustomer} ${empBadge}</div>
              <div style="font-size:11px;color:#888">${e.type} · ${e.date}</div>
            </div>
            <span class="badge ${(e.pending||0)>0?'badge-amber':'badge-green'}">${(e.pending||0)>0?'₹'+(e.pending||0).toLocaleString()+' pending':'Paid'}</span>
          </div>
        </div>
      `; }).join('')}
    </div>

    <div class="card">
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <i class="ti ti-users" style="color:#d97706;font-size:16px"></i> Recent Customers
        </span>
        <button class="btn btn-gold" style="padding:4px 8px; font-size:11px; height:24px; display:inline-flex; align-items:center; gap:4px;" onclick="openShopCustomerForm()">
          <i class="ti ti-plus" style="font-size:10px;"></i> Add Customer
        </button>
      </div>
      ${customers.slice(0,4).map((c,i)=>{
        const colors=['av-gold','av-teal','av-rose','av-purple'];
        const { cleanText: cleanName, tagHtml: empBadge } = formatEmpTag(c.name);
        const initials = cleanName.split(' ').map(n=>n[0]).join('').slice(0,2);
        return `<div class="customer-row">
          <div class="avatar ${colors[i%4]}">${initials}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500;display:inline-flex;align-items:center;">${cleanName} ${empBadge}</div>
            <div style="font-size:11px;color:#999">${Array.isArray(c.services) ? c.services.join(', ') : (c.services || '')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:600;color:#d97706">₹${(c.amount||0).toLocaleString()}</div>
            <span class="badge ${c.payment_status==='paid'?'badge-green':'badge-red'}" style="font-size:10px">${c.payment_status||'pending'}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <div class="card">
    <div class="section-title"><i class="ti ti-chart-donut" style="color:#d97706;font-size:16px"></i>Summary</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px">
      ${[
        {label:'Total Income',val:'₹'+monthRevenue.toLocaleString(),color:'#15803d'},
        {label:'Total Expenses',val:'₹'+totalExpenses.toLocaleString(),color:'#dc2626'},
        {label:'Pending',val:'₹'+pendingTotal.toLocaleString(),color:'#d97706'},
        {label:'Net Profit',val:'₹'+(monthRevenue-totalExpenses).toLocaleString(),color:'#7c3aed'},
      ].map(m=>`
        <div style="background:#f9f9f9;border-radius:10px;padding:12px">
          <div style="font-size:11px;color:#999;margin-bottom:4px">${m.label}</div>
          <div style="font-size:18px;font-weight:600;color:${m.color}">${m.val}</div>
        </div>
      `).join('')}
    </div>
    <div style="position:relative;width:100%;height:140px;margin-top:14px">
      <canvas id="revenueChart" role="img" aria-label="Revenue vs expenses bar chart">Revenue ${monthRevenue}, Expenses ${totalExpenses}</canvas>
    </div>
  </div>`;
}

export function initCharts() {
  const ctx = document.getElementById('revenueChart');
  if(!ctx) return;
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
        {label:'Revenue',data: dd.revenue,backgroundColor:'#f5c842',borderRadius:4},
        {label:'Expenses',data: dd.expenses,backgroundColor:'#e5e7eb',borderRadius:4}
      ]
    },
    options: {
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{font:{size:11}}},y:{display:false,grid:{display:false}}}
    }
  });
}
