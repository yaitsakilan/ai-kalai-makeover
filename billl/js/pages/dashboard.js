// billl/js/pages/dashboard.js
import { fetchCustomers, fetchEvents, fetchExpenses } from '../db.js';

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
  const [customers, events, expenses] = await Promise.all([fetchCustomers(), fetchEvents(), fetchExpenses()]);

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
      <div class="section-title">
        <i class="ti ti-bell" style="color:#d97706;font-size:16px"></i>
        Reminders & Alerts
        <span class="badge badge-red" style="margin-left:auto">${dynamicReminders.filter(r=>r.level==='red').length} urgent</span>
      </div>
      ${dynamicReminders.slice(0,5).map(r=>`
        <div class="reminder-item">
          <div class="reminder-dot" style="background:${r.level==='red'?'#ef4444':r.level==='amber'?'#f59e0b':'#3b82f6'}"></div>
          <div>
            <div style="font-size:12px;color:#333">${r.text}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <i class="ti ti-calendar-event" style="color:#d97706;font-size:16px"></i> Upcoming Events
        </span>
        <button class="btn btn-gold" style="padding:4px 8px; font-size:11px; height:24px; display:inline-flex; align-items:center; gap:4px;" onclick="openEventCustomerForm()">
          <i class="ti ti-plus" style="font-size:10px;"></i> Book Event
        </button>
      </div>
      ${events.filter(e=>e.status!=='Completed').slice(0,4).map(e=>`
        <div class="event-card" style="padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:13px;font-weight:600;color:#1a1a1a">${e.customer}</div>
              <div style="font-size:11px;color:#888">${e.type} · ${e.date}</div>
            </div>
            <span class="badge ${(e.pending||0)>0?'badge-amber':'badge-green'}">${(e.pending||0)>0?'₹'+(e.pending||0).toLocaleString()+' pending':'Paid'}</span>
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="grid-2">
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
        const initials = (c.name||'').split(' ').map(n=>n[0]).join('').slice(0,2);
        return `<div class="customer-row">
          <div class="avatar ${colors[i%4]}">${initials}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500">${c.name}</div>
            <div style="font-size:11px;color:#999">${(c.services||[]).join(', ')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:600;color:#d97706">₹${(c.amount||0).toLocaleString()}</div>
            <span class="badge ${c.payment_status==='paid'?'badge-green':'badge-red'}" style="font-size:10px">${c.payment_status||'pending'}</span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="card">
      <div class="section-title"><i class="ti ti-chart-donut" style="color:#d97706;font-size:16px"></i>Summary</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
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
      <div style="position:relative;width:100%;height:120px;margin-top:14px">
        <canvas id="revenueChart" role="img" aria-label="Revenue vs expenses bar chart">Revenue ${monthRevenue}, Expenses ${totalExpenses}</canvas>
      </div>
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
