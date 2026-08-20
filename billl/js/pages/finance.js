// billl/js/pages/finance.js
import { fetchFinancialSummary } from '../db.js';
import { isReadOnlyMode } from '../state.js';

function formatMonthLabel(mKey) {
  if (!mKey || mKey === 'all') return 'All Time Overall';
  const [yr, mn] = mKey.split('-');
  const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export async function renderFinance() {
  window._selectedFinanceMonth = window._selectedFinanceMonth || 'all';
  const fin = await fetchFinancialSummary(window._selectedFinanceMonth);
  const readOnly = isReadOnlyMode();

  window._financeData = fin;

  return `
    <div class="top-bar">
      <div>
        <h2 style="display:flex;align-items:center;gap:10px">
          💰 Financial Statements & Accounts
          ${readOnly ? '<span class="badge badge-amber" style="font-size:11px;font-family:sans-serif;font-weight:normal"><i class="ti ti-lock" style="margin-right:4px"></i> Read-Only Mode</span>' : ''}
        </h2>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <select class="form-input form-select" style="width:auto;height:36px;font-size:12px;padding:4px 28px 4px 10px;border-color:#e5e5e5;font-weight:500;background-color:#fff" onchange="window.filterFinanceMonth(this.value)" title="Choose Month Filter">
          <option value="all" ${fin.selectedMonth === 'all' ? 'selected' : ''}>📅 All Months Summary</option>
          ${fin.availableMonths.map(m => `
            <option value="${m}" ${fin.selectedMonth === m ? 'selected' : ''}>
              📅 ${formatMonthLabel(m)}
            </option>
          `).join('')}
        </select>
        <button class="btn btn-gold" onclick="window.downloadFinancePDF()" title="Download Financial Statement as PDF">
          <i class="ti ti-file-text"></i> Save PDF
        </button>
      </div>
    </div>

    <!-- Metric Cards -->
    <div class="metric-grid">
      <div class="metric-card mc-gold">
        <div class="metric-label">Gross Revenue</div>
        <div class="metric-value">₹${fin.totalGrossRevenue.toLocaleString()}</div>
        <div class="metric-sub">Shop, Events, Academy & Jewels</div>
        <i class="ti ti-trending-up metric-icon"></i>
      </div>

      <div class="metric-card mc-orange">
        <div class="metric-label">Total Expenses</div>
        <div class="metric-value">₹${fin.totalExpenses.toLocaleString()}</div>
        <div class="metric-sub">Operating, Payroll & Staff Wages</div>
        <i class="ti ti-receipt metric-icon"></i>
      </div>

      <div class="metric-card mc-teal">
        <div class="metric-label">Net Profit</div>
        <div class="metric-value" style="color:${fin.netOperatingProfit >= 0 ? '#0d9488' : '#dc2626'}">
          ₹${fin.netOperatingProfit.toLocaleString()}
        </div>
        <div class="metric-sub">Net Margin: ${fin.totalGrossRevenue > 0 ? ((fin.netOperatingProfit / fin.totalGrossRevenue) * 100).toFixed(1) : 0}%</div>
        <i class="ti ti-cash metric-icon"></i>
      </div>

      <div class="metric-card mc-rose">
        <div class="metric-label">Dues Receivable</div>
        <div class="metric-value">₹${fin.totalReceivables.toLocaleString()}</div>
        <div class="metric-sub">Uncollected customer & event balances</div>
        <i class="ti ti-alert-circle metric-icon"></i>
      </div>
    </div>

    <!-- Cash vs Digital Breakdown -->
    <div class="grid-2" style="margin-bottom:20px">
      <div class="card" style="background:linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);border-color:#fde68a">
        <div class="section-title" style="color:#b45309">
          <i class="ti ti-cash" style="font-size:18px"></i> Cash in Hand (Drawer)
        </div>
        <div style="font-size:28px;font-weight:700;color:#92400e">₹${fin.cashTotal.toLocaleString()}</div>
        <div style="font-size:12px;color:#b45309;margin-top:4px">Physical cash collections logged across shop & services</div>
      </div>

      <div class="card" style="background:linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);border-color:#bbf7d0">
        <div class="section-title" style="color:#15803d">
          <i class="ti ti-brand-google" style="font-size:18px"></i> Digital Receipts (GPay / Bank)
        </div>
        <div style="font-size:28px;font-weight:700;color:#166534">₹${fin.gpayTotal.toLocaleString()}</div>
        <div style="font-size:12px;color:#15803d;margin-top:4px">Direct bank transfer and online UPI payment receipts</div>
      </div>
    </div>

    <!-- P&L Table & Revenue Charts -->
    <div class="grid-2">
      <div class="card">
        <div class="section-title">
          <i class="ti ti-report-money" style="color:#d97706"></i> Profit & Loss Statement (P&L)
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:2px solid #eee;text-align:left">
              <th style="padding:8px 0;color:#888;font-weight:500">Category</th>
              <th style="padding:8px 0;text-align:right;color:#888;font-weight:500">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <!-- Revenue Section -->
            <tr style="background:#fcfcfc">
              <td colspan="2" style="padding:8px 0 4px;font-weight:600;color:#15803d">🟢 REVENUE STREAMS</td>
            </tr>
            <tr style="border-bottom:1px solid #f5f5f5">
              <td style="padding:6px 12px;color:#444">Salon Shop Services</td>
              <td style="padding:6px 0;text-align:right;font-weight:500">₹${fin.shopRevenue.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:1px solid #f5f5f5">
              <td style="padding:6px 12px;color:#444">Bridal & Event Bookings</td>
              <td style="padding:6px 0;text-align:right;font-weight:500">₹${fin.eventRevenue.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:1px solid #f5f5f5">
              <td style="padding:6px 12px;color:#444">Academy Tuition Installments</td>
              <td style="padding:6px 0;text-align:right;font-weight:500">₹${fin.academyRevenue.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:1px solid #f5f5f5">
              <td style="padding:6px 12px;color:#444">Jewelry Rental Receipts</td>
              <td style="padding:6px 0;text-align:right;font-weight:500">₹${fin.jewelRevenue.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:2px solid #ddd;background:#f0fdf4">
              <td style="padding:8px 12px;font-weight:600;color:#166534">Total Gross Revenue</td>
              <td style="padding:8px 0;text-align:right;font-weight:700;color:#166534">₹${fin.totalGrossRevenue.toLocaleString()}</td>
            </tr>

            <!-- Expense Section -->
            <tr style="background:#fcfcfc">
              <td colspan="2" style="padding:12px 0 4px;font-weight:600;color:#dc2626">🔴 OPERATING EXPENSES</td>
            </tr>
            <tr style="border-bottom:1px solid #f5f5f5">
              <td style="padding:6px 12px;color:#444">General & Product Purchases</td>
              <td style="padding:6px 0;text-align:right;font-weight:500">₹${fin.generalExpenses.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:1px solid #f5f5f5">
              <td style="padding:6px 12px;color:#444">Employee Salaries & Payroll</td>
              <td style="padding:6px 0;text-align:right;font-weight:500">₹${fin.payrollExpenses.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:1px solid #f5f5f5">
              <td style="padding:6px 12px;color:#444">Event Staff Daily Wages</td>
              <td style="padding:6px 0;text-align:right;font-weight:500">₹${fin.eventStaffWages.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:1px solid #f5f5f5">
              <td style="padding:6px 12px;color:#444">Event Travel Allowances</td>
              <td style="padding:6px 0;text-align:right;font-weight:500">₹${fin.eventTravelCosts.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom:2px solid #ddd;background:#fef2f2">
              <td style="padding:8px 12px;font-weight:600;color:#991b1b">Total Expenses</td>
              <td style="padding:8px 0;text-align:right;font-weight:700;color:#991b1b">₹${fin.totalExpenses.toLocaleString()}</td>
            </tr>

            <!-- Net Result -->
            <tr style="background:#fafafa">
              <td style="padding:10px 12px;font-weight:700;font-size:14px">NET OPERATING PROFIT</td>
              <td style="padding:10px 0;text-align:right;font-weight:700;font-size:15px;color:${fin.netOperatingProfit >= 0 ? '#15803d' : '#dc2626'}">
                ₹${fin.netOperatingProfit.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="section-title">
          <i class="ti ti-chart-donut" style="color:#d97706"></i> Revenue Source Distribution
        </div>
        <div style="position:relative;width:100%;height:220px">
          <canvas id="financeRevenueDonut"></canvas>
        </div>

        <div style="margin-top:20px">
          <div class="section-title" style="font-size:12px">Income vs. Expense Breakdown</div>
          <div style="position:relative;width:100%;height:140px">
            <canvas id="financeBarChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Dues & Receivables Ledger -->
    <div class="card" style="margin-top:20px">
      <div class="section-title">
        <i class="ti ti-clock" style="color:#d97706"></i> Accounts Receivable (Outstanding Dues Ledger)
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <!-- Customer Dues -->
        <div>
          <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px">Unpaid Customer Salon Bills</div>
          ${fin.customers.filter(c => c.payment_status === 'pending').map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #f5f5f5">
              <div>
                <div style="font-size:13px;font-weight:500">${c.name}</div>
                <div style="font-size:11px;color:#888">${c.phone || 'No phone'} · ${c.location || 'Chennai'}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:13px;font-weight:600;color:#dc2626">₹${(c.amount || 0).toLocaleString()}</div>
                <span class="badge badge-red" style="font-size:10px">Pending</span>
              </div>
            </div>
          `).join('') || '<div style="font-size:12px;color:#aaa;padding:10px 0">No pending customer bills 🎉</div>'}
        </div>

        <!-- Event Dues -->
        <div>
          <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px">Pending Event Bookings Balance</div>
          ${fin.events.filter(e => (e.pending || 0) > 0).map(e => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #f5f5f5">
              <div>
                <div style="font-size:13px;font-weight:500">${e.customer}</div>
                <div style="font-size:11px;color:#888">${e.type} · Date: ${e.date || 'TBD'}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:13px;font-weight:600;color:#d97706">₹${(e.pending || 0).toLocaleString()}</div>
                <span class="badge badge-amber" style="font-size:10px">Pending</span>
              </div>
            </div>
          `).join('') || '<div style="font-size:12px;color:#aaa;padding:10px 0">No pending event balances 🎉</div>'}
        </div>
      </div>
    </div>
  `;
}

export function initFinanceCharts() {
  const fin = window._financeData;
  if (!fin || typeof Chart === 'undefined') return;

  const donutCtx = document.getElementById('financeRevenueDonut');
  if (donutCtx) {
    new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: ['Salon Shop', 'Event Bookings', 'Academy', 'Jewel Rentals'],
        datasets: [{
          data: [fin.shopRevenue, fin.eventRevenue, fin.academyRevenue, fin.jewelRevenue],
          backgroundColor: ['#f5c842', '#14b8a6', '#a78bfa', '#fb7185']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } }
      }
    });
  }

  const barCtx = document.getElementById('financeBarChart');
  if (barCtx) {
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Revenue', 'Expenses', 'Net Profit'],
        datasets: [{
          label: 'Amount (₹)',
          data: [fin.totalGrossRevenue, fin.totalExpenses, Math.max(0, fin.netOperatingProfit)],
          backgroundColor: ['#10b981', '#ef4444', '#6366f1'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { display: true, ticks: { font: { size: 10 } } } }
      }
    });
  }
}

// Global Export Functions
window.exportFinanceReport = function() {
  const fin = window._financeData;
  if (!fin) return;

  let csv = 'Category,Amount (INR)\n';
  csv += `Salon Shop Revenue,${fin.shopRevenue}\n`;
  csv += `Bridal Event Revenue,${fin.eventRevenue}\n`;
  csv += `Academy Tuition Revenue,${fin.academyRevenue}\n`;
  csv += `Jewelry Rental Revenue,${fin.jewelRevenue}\n`;
  csv += `GROSS REVENUE,${fin.totalGrossRevenue}\n`;
  csv += `General Expenses,${fin.generalExpenses}\n`;
  csv += `Payroll Expenses,${fin.payrollExpenses}\n`;
  csv += `Event Staff Wages,${fin.eventStaffWages}\n`;
  csv += `Travel Allowances,${fin.eventTravelCosts}\n`;
  csv += `TOTAL EXPENSES,${fin.totalExpenses}\n`;
  csv += `NET OPERATING PROFIT,${fin.netOperatingProfit}\n`;
  csv += `Cash in Drawer,${fin.cashTotal}\n`;
  csv += `Digital GPay Receipts,${fin.gpayTotal}\n`;
  csv += `Outstanding Receivables,${fin.totalReceivables}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `Kalai_Makeover_Financial_Statement_${new Date().toISOString().substring(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.downloadFinancePDF = function() {
  window.print();
};

window.filterFinanceMonth = function(month) {
  window._selectedFinanceMonth = month;
  if (typeof window.render === 'function') window.render();
};
