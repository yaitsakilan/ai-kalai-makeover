// billl/js/pages/analytics.js
import { fetchCustomers, fetchEvents, fetchExpenses } from '../db.js';

export async function renderAnalytics() {
  const [customers, events, expenses] = await Promise.all([
    fetchCustomers(),
    fetchEvents(),
    fetchExpenses()
  ]);

  // Separate normal shop customers and class students
  const shopCustomers = customers.filter(c => !(c.services || []).includes('Classes'));
  const classStudents = customers.filter(c => (c.services || []).includes('Classes'));

  const shopRev = shopCustomers.reduce((s, c) => s + (c.amount || 0), 0);
  const classRev = classStudents.reduce((s, c) => s + (c.amount || 0), 0);
  const eventTotal = events.reduce((s, e) => s + (e.total || 0), 0);
  const eventAdvance = events.reduce((s, e) => s + (e.advance || 0), 0);
  const eventPending = events.reduce((s, e) => s + (e.pending || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalInflow = shopRev + classRev + eventAdvance;

  // Build service popularity (excluding Classes)
  const serviceCounts = {};
  shopCustomers.forEach(c => (c.services || []).forEach(s => { serviceCounts[s] = (serviceCounts[s] || 0) + 1; }));
  const topServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxSvc = topServices.length ? topServices[0][1] : 1;

  // Build wedding/event types popularity
  const eventTypeCounts = {};
  events.forEach(e => { if (e.type) eventTypeCounts[e.type] = (eventTypeCounts[e.type] || 0) + 1; });
  const topEventTypes = Object.entries(eventTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxEvt = topEventTypes.length ? topEventTypes[0][1] : 1;

  // Group expenses by category
  const expGroup = {};
  expenses.forEach(e => { expGroup[e.category] = (expGroup[e.category] || 0) + (e.amount || 0); });

  // Generate dynamic trend months
  const monthKeys = new Set();
  customers.forEach(c => { if (c.last_visit) monthKeys.add(c.last_visit.substring(0, 7)); });
  events.forEach(e => { if (e.date) monthKeys.add(e.date.substring(0, 7)); });
  expenses.forEach(e => { if (e.date) monthKeys.add(e.date.substring(0, 7)); });

  if (monthKeys.size === 0) {
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  const sortedKeys = Array.from(monthKeys).sort().slice(-6);
  const monthsList = sortedKeys.map(k => {
    const [yr, mn] = k.split('-');
    const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
    const mName = d.toLocaleString('en-US', { month: 'short' }) + ' ' + yr.substring(2);
    return { name: mName, key: k, income: 0, expense: 0 };
  });

  // Map data to months
  shopCustomers.forEach(c => {
    if (!c.last_visit) return;
    const mKey = c.last_visit.substring(0, 7);
    const mObj = monthsList.find(m => m.key === mKey);
    if (mObj) mObj.income += (c.amount || 0);
  });
  classStudents.forEach(c => {
    if (!c.last_visit) return;
    const mKey = c.last_visit.substring(0, 7);
    const mObj = monthsList.find(m => m.key === mKey);
    if (mObj) mObj.income += (c.amount || 0);
  });
  events.forEach(e => {
    if (!e.date) return;
    const mKey = e.date.substring(0, 7);
    const mObj = monthsList.find(m => m.key === mKey);
    if (mObj) mObj.income += (e.advance || 0);
  });
  expenses.forEach(e => {
    if (!e.date) return;
    const mKey = e.date.substring(0, 7);
    const mObj = monthsList.find(m => m.key === mKey);
    if (mObj) mObj.expense += (e.amount || 0);
  });

  // Cache data for Charts initialization
  window._analyticsData = {
    monthsLabels: monthsList.map(m => m.name),
    monthsIncome: monthsList.map(m => m.income),
    monthsExpense: monthsList.map(m => m.expense),
    inflowLabels: ['Shop Visits', 'Events (Advance)', 'Classes'],
    inflowData: [shopRev, eventAdvance, classRev],
    expenseLabels: Object.keys(expGroup).length ? Object.keys(expGroup) : ['None'],
    expenseData: Object.values(expGroup).length ? Object.values(expGroup) : [0]
  };

  const cashProfit = totalInflow - totalExpenses;
  const netMargin = totalInflow > 0 ? Math.round((cashProfit / totalInflow) * 100) : 0;

  return `
  <div class="top-bar">
    <h2>Analytics & Insights</h2>
    <div class="date"><i class="ti ti-database" style="color:#d97706;margin-right:4px"></i> Live Business Report</div>
  </div>

  <div class="metric-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
    <div class="metric-card mc-gold">
      <div class="metric-label">Shop Customers</div>
      <div class="metric-value">₹${shopRev.toLocaleString()}</div>
      <div class="metric-sub">${shopCustomers.length} client visits</div>
      <i class="ti ti-users metric-icon"></i>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Event Bookings</div>
      <div class="metric-value">₹${eventTotal.toLocaleString()}</div>
      <div class="metric-sub">${events.length} bookings (₹${eventAdvance.toLocaleString()} paid)</div>
      <i class="ti ti-calendar-event metric-icon"></i>
    </div>
    <div class="metric-card mc-purple">
      <div class="metric-label">Student Classes</div>
      <div class="metric-value">₹${classRev.toLocaleString()}</div>
      <div class="metric-sub">${classStudents.length} student enrollments</div>
      <i class="ti ti-school metric-icon"></i>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Total Expenses</div>
      <div class="metric-value">₹${totalExpenses.toLocaleString()}</div>
      <div class="metric-sub">${expenses.length} expense transactions</div>
      <i class="ti ti-receipt metric-icon"></i>
    </div>
  </div>

  <div class="grid-3" style="grid-template-columns: 2fr 1fr 1fr; margin-bottom: 20px;">
    <div class="card">
      <div class="section-title"><i class="ti ti-chart-bar" style="color:#d97706;margin-right:4px"></i>Cashflow Trend (Last 6 Active Months)</div>
      <div style="position:relative;width:100%;height:200px">
        <canvas id="revTrendChart" role="img" aria-label="Revenue vs Expense trend">Cashflow trend</canvas>
      </div>
    </div>
    <div class="card">
      <div class="section-title"><i class="ti ti-wallet" style="color:#d97706;margin-right:4px"></i>Income Split</div>
      <div style="position:relative;width:100%;height:200px">
        <canvas id="incomeSplitChart" role="img" aria-label="Income source distribution">Income split</canvas>
      </div>
    </div>
    <div class="card">
      <div class="section-title"><i class="ti ti-receipt" style="color:#d97706;margin-right:4px"></i>Expense Split</div>
      <div style="position:relative;width:100%;height:200px">
        <canvas id="expChart" role="img" aria-label="Expense breakdown donut">Expense split</canvas>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="section-title" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; margin-bottom: 12px;">
        <i class="ti ti-users" style="color:#d97706;font-size:16px"></i> Shop Customer Insights
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:#f9f9f9;border-radius:8px;padding:10px">
          <div style="font-size:11px;color:#999;margin-bottom:2px">Average Ticket Size</div>
          <div style="font-size:16px;font-weight:600;color:#1a1a1a">₹${shopCustomers.length ? Math.round(shopRev / shopCustomers.length).toLocaleString() : 0}</div>
        </div>
        <div style="background:#f9f9f9;border-radius:8px;padding:10px">
          <div style="font-size:11px;color:#999;margin-bottom:2px">Regular Customers</div>
          <div style="font-size:16px;font-weight:600;color:#15803d">${shopCustomers.filter(c => (c.visits||0)>=5).length} clients</div>
        </div>
      </div>
      <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px">Popular Shop Services</div>
      ${topServices.length ? topServices.map(([name,count])=>`
        <div class="service-row" style="padding: 6px 0;">
          <div style="font-size:12px;flex:1">${name}</div>
          <div style="flex:2;padding:0 10px">
            <div style="background:#f0f0f0;border-radius:3px;height:5px;overflow:hidden">
              <div class="analytics-bar" style="width:${Math.round((count/maxSvc)*100)}%;background:#f5c842;height:5px;"></div>
            </div>
          </div>
          <div style="font-size:11px;font-weight:600;color:#666;min-width:30px;text-align:right">${count}x</div>
        </div>
      `).join('') : '<div style="color:#999;font-size:12px;text-align:center;padding:10px">No service data yet</div>'}
    </div>

    <div class="card">
      <div class="section-title" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; margin-bottom: 12px;">
        <i class="ti ti-school" style="color:#d97706;font-size:16px"></i> Academy Class Insights
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:#f9f9f9;border-radius:8px;padding:10px">
          <div style="font-size:11px;color:#999;margin-bottom:2px">Average Class Fee</div>
          <div style="font-size:16px;font-weight:600;color:#1a1a1a">₹${classStudents.length ? Math.round(classRev / classStudents.length).toLocaleString() : 0}</div>
        </div>
        <div style="background:#f9f9f9;border-radius:8px;padding:10px">
          <div style="font-size:11px;color:#999;margin-bottom:2px">Inflow Contribution</div>
          <div style="font-size:16px;font-weight:600;color:#7c3aed">${totalInflow > 0 ? Math.round((classRev / totalInflow) * 100) : 0}%</div>
        </div>
      </div>
      <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px">Recent Academy Students</div>
      ${classStudents.length ? classStudents.slice(0, 4).map(s=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid #f5f5f5;font-size:12px">
          <div>
            <span style="font-weight:500">${s.name}</span>
            <span style="color:#999;font-size:10px"> · ${s.last_visit||''}</span>
          </div>
          <div style="font-weight:600;color:#d97706">₹${(s.amount||0).toLocaleString()}</div>
        </div>
      `).join('') : '<div style="color:#999;font-size:12px;text-align:center;padding:10px">No students registered yet</div>'}
    </div>
  </div>

  <div class="grid-2" style="margin-top:14px">
    <div class="card">
      <div class="section-title" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; margin-bottom: 12px;">
        <i class="ti ti-calendar-event" style="color:#d97706;font-size:16px"></i> Event & Wedding Insights
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:#f9f9f9;border-radius:8px;padding:10px">
          <div style="font-size:11px;color:#999;margin-bottom:2px">Advance Collected</div>
          <div style="font-size:16px;font-weight:600;color:#15803d">₹${eventAdvance.toLocaleString()}</div>
        </div>
        <div style="background:#f9f9f9;border-radius:8px;padding:10px">
          <div style="font-size:11px;color:#999;margin-bottom:2px">Pending Receivables</div>
          <div style="font-size:16px;font-weight:600;color:#dc2626">₹${eventPending.toLocaleString()}</div>
        </div>
      </div>
      <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px">Popular Function Types</div>
      ${topEventTypes.length ? topEventTypes.map(([name,count])=>`
        <div class="service-row" style="padding: 6px 0;">
          <div style="font-size:12px;flex:1">${name}</div>
          <div style="flex:2;padding:0 10px">
            <div style="background:#f0f0f0;border-radius:3px;height:5px;overflow:hidden">
              <div class="analytics-bar" style="width:${Math.round((count/maxEvt)*100)}%;background:#14b8a6;height:5px;"></div>
            </div>
          </div>
          <div style="font-size:11px;font-weight:600;color:#666;min-width:30px;text-align:right">${count}x</div>
        </div>
      `).join('') : '<div style="color:#999;font-size:12px;text-align:center;padding:10px">No event data yet</div>'}
    </div>

    <div class="card">
      <div class="section-title" style="border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; margin-bottom: 12px;">
        <i class="ti ti-chart-pie" style="color:#d97706;font-size:16px"></i> Financial Summary (Cash Basis)
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#f9f9f9;border-radius:8px">
          <span style="color:#666">Gross Cash Inflow</span>
          <span style="font-weight:600;color:#15803d">₹${totalInflow.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#f9f9f9;border-radius:8px">
          <span style="color:#666">Total Cash Outflow</span>
          <span style="font-weight:600;color:#dc2626">₹${totalExpenses.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#f5f3ff;border-radius:8px">
          <span style="color:#6d28d9;font-weight:500">Net Cash Surplus</span>
          <span style="font-weight:700;color:#6d28d9">₹${cashProfit.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#fffbeb;border-radius:8px">
          <span style="color:#b45309;font-weight:500">Net Profit Margin</span>
          <span style="font-weight:700;color:#b45309">${netMargin}%</span>
        </div>
      </div>
    </div>
  </div>
  `;
}

export function initAnalyticsCharts() {
  const ad = window._analyticsData;
  if (!ad) return;

  const ctx1 = document.getElementById('revTrendChart');
  if(ctx1) new Chart(ctx1,{
    type:'line',
    data:{
      labels: ad.monthsLabels,
      datasets:[
        {
          label:'Cash Income',
          data: ad.monthsIncome,
          borderColor:'#14b8a6',
          backgroundColor:'rgba(20,184,166,0.05)',
          tension:0.3,
          fill:true,
          pointBackgroundColor:'#14b8a6',
          pointRadius:3
        },
        {
          label:'Expenses',
          data: ad.monthsExpense,
          borderColor:'#fb7185',
          backgroundColor:'rgba(251,113,133,0.05)',
          tension:0.3,
          fill:true,
          pointBackgroundColor:'#fb7185',
          pointRadius:3
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'top',labels:{boxWidth:12,font:{size:10}}}},
      scales:{
        x:{grid:{display:false},ticks:{font:{size:9}}},
        y:{grid:{color:'#f5f5f5'},ticks:{font:{size:9},callback:v=>'₹'+v.toLocaleString()}}
      }
    }
  });

  const ctxSplit = document.getElementById('incomeSplitChart');
  if(ctxSplit) new Chart(ctxSplit,{
    type:'doughnut',
    data:{
      labels: ad.inflowLabels,
      datasets:[{
        data: ad.inflowData,
        backgroundColor:['#f5c842','#14b8a6','#a78bfa']
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:8,font:{size:9},padding:4}}},
      cutout:'60%'
    }
  });

  const ctx2 = document.getElementById('expChart');
  if(ctx2) new Chart(ctx2,{
    type:'doughnut',
    data:{
      labels: ad.expenseLabels,
      datasets:[{
        data: ad.expenseData,
        backgroundColor:['#fb7185','#38bdf8','#34d399','#fbbf24','#a78bfa','#f472b6','#a1a1aa']
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:8,font:{size:9},padding:4}}},
      cutout:'60%'
    }
  });
}

// Bind to window to allow HTML inline event execution
window.renderAnalytics = renderAnalytics;
window.initAnalyticsCharts = initAnalyticsCharts;
