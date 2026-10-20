// billl/js/pages/employees.js
import { state } from '../state.js';
import { 
  fetchEmployees, 
  addEmployee, 
  updateEmployee,
  deleteEmployee, 
  fetchAttendance, 
  saveAttendance, 
  fetchPayslips, 
  savePayslip,
  fetchEvents,
  fetchCustomers,
  fetchExpenses,
  fetchClassEnrollments,
  fetchJewels
} from '../db.js';
import { showToast, showModal, closeModal, showConfirmDelete } from '../ui.js';
import { 
  renderWifiAttendanceCard, 
  initLiveWifiStatus, 
  openCaptureWifiModal, 
  openWifiSettingsModal, 
  openQuickWifiPunchModal 
} from '../wifi.js';

export async function renderEmployees() {
  const employees = await fetchEmployees();
  const attendance = await fetchAttendance();
  const payslips = await fetchPayslips();
  const events = await fetchEvents();

  window._cachedEmployees = employees;
  window._cachedAttendance = attendance;
  window._cachedPayslips = payslips;
  window._cachedEvents = events;

  if (window._employeesTab === undefined) window._employeesTab = 'directory';
  if (window._payrollSelectedMonth === undefined) {
    const d = new Date();
    window._payrollSelectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  if (window._employeesTab === 'attendance') {
    initLiveWifiStatus();
  }

  return `
  <div class="top-bar">
    <div>
      <h2>Employee Management</h2>
    </div>
    <div style="display:flex; gap:10px; align-items:center;">
      ${window._employeesTab === 'directory' ? `
        <button class="btn btn-gold" onclick="window.openAddEmployeeModal()">
          <i class="ti ti-user-plus"></i> Add Employee
        </button>
      ` : window._employeesTab === 'attendance' ? `
        <button class="btn btn-outline" onclick="window.openCaptureWifiModal()" style="border-color:#d97706; color:#d97706; display:inline-flex; align-items:center; gap:6px;" title="Capture Salon WiFi Router">
          <i class="ti ti-wifi"></i> Capture Shop WiFi
        </button>
        <button class="btn btn-gold" onclick="window.openManualAttendanceModal()">
          <i class="ti ti-calendar-plus"></i> Log Manual Attendance
        </button>
      ` : ''}
    </div>
  </div>

  <div class="tab-row">
    <div class="tab ${window._employeesTab === 'directory' ? 'active' : ''}" onclick="window.switchEmployeesTab('directory')">
      <i class="ti ti-users" style="margin-right:4px;"></i> Staff Directory
    </div>
    <div class="tab ${window._employeesTab === 'attendance' ? 'active' : ''}" onclick="window.switchEmployeesTab('attendance')">
      <i class="ti ti-calendar-event" style="margin-right:4px;"></i> Attendance Log
    </div>
    <div class="tab ${window._employeesTab === 'payroll' ? 'active' : ''}" onclick="window.switchEmployeesTab('payroll')">
      <i class="ti ti-wallet" style="margin-right:4px;"></i> Payroll & Payslips
    </div>
  </div>

  <div id="employees-content-container">
    ${window._employeesTab === 'directory' ? renderDirectoryTab(employees) :
      window._employeesTab === 'attendance' ? renderAttendanceTab(employees, attendance) :
      renderPayrollTab(employees, attendance, payslips, events)}
  </div>
  `;
}

// ────────────────────────────────────────────────────────
//  DIRECTORY TAB
// ────────────────────────────────────────────────────────

function renderDirectoryTab(employees) {
  if (!employees.length) {
    return `<div class="card" style="text-align:center; padding:50px; color:#999;">
      <i class="ti ti-users" style="font-size:42px; display:block; margin-bottom:10px; opacity:0.3;"></i>
      No employees registered. Click "Add Employee" to register staff.
    </div>`;
  }

  const colors = ['av-gold', 'av-teal', 'av-rose', 'av-purple'];

  return `
  <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
    ${employees.map((emp, i) => {
      const initials = (emp.name || '').split(' ').map(n => n[0]).join('').slice(0, 2);
      return `
      <div class="emp-directory-card card" onclick="window.showEmployeePerformance('${emp.id}')" title="Click to view full profile & performance">
        <div style="display:flex; gap:14px; align-items:flex-start;">
          ${emp.photo_url ? `
            <img src="${emp.photo_url}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:2px solid #f5c842; flex-shrink:0;" />
          ` : `
            <div class="avatar ${colors[i % 4]}" style="width:50px; height:50px; font-size:16px; font-weight:700; flex-shrink:0;">${initials}</div>
          `}
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
              <h3 class="emp-card-name" style="font-size:15px; font-weight:700; margin:0 0 4px 0; display:flex; align-items:center; gap:6px;">
                ${emp.name} 
                <i class="ti ti-chart-bar" style="color:#f5c842; font-size:14px;" title="View Performance Dashboard"></i>
              </h3>
              <span class="badge ${emp.status === 'Active' ? 'badge-green' : emp.status === 'On Leave' ? 'badge-amber' : 'badge-red'}" style="font-size:9.5px; padding:2px 7px;">
                ${emp.status || 'Active'}
              </span>
            </div>
            
            <div class="emp-card-meta" style="display:flex; flex-direction:column; gap:5px; margin-top:8px; font-size:12px;">
              <div><i class="ti ti-phone"></i> <strong>Phone:</strong> ${emp.phone || '—'}</div>
              <div><i class="ti ti-calendar"></i> <strong>Joined:</strong> ${emp.joining_date || '—'}</div>
              <div><i class="ti ti-phone-incoming"></i> <strong>Emergency:</strong> ${emp.emergency_name ? `${emp.emergency_name} (${emp.emergency_number || ''})` : (emp.emergency_contact || '—')}</div>
            </div>

            <div class="emp-card-pay-rate" style="font-size:12px; margin-top:10px; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
              <span>Base Pay Rate:</span>
              <span><strong>₹${(emp.base_rate || 0).toLocaleString()}</strong> <span style="font-size:10.5px; opacity:0.8;">/ ${emp.salary_type === 'monthly' ? 'month' : 'day'}</span></span>
            </div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(245,200,66,0.12); padding-top:10px; margin-top:12px;">
          <span style="font-size:11px; color:#f5c842; font-weight:600; display:flex; align-items:center; gap:4px;">
            <i class="ti ti-id"></i> ${emp.emp_id || 'Staff'}
          </span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-outline" onclick="event.stopPropagation(); window.showEmployeePerformance('${emp.id}')" style="height:28px; padding:0 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;" title="View Performance">
              <i class="ti ti-eye"></i> View Profile
            </button>
            <button class="btn btn-danger btn-icon" onclick="event.stopPropagation(); window.handleDeleteEmployee('${emp.id}')" style="width:28px; height:28px; padding:0; color:#dc2626;" title="Remove Employee">
              <i class="ti ti-trash" style="font-size:13px;"></i>
            </button>
          </div>
        </div>
      </div>
      `;
    }).join('')}
  </div>
  `;
}

// ────────────────────────────────────────────────────────
//  ATTENDANCE TAB
// ────────────────────────────────────────────────────────

function renderAttendanceTab(employees, attendance) {
  // Filter out invalid records
  const validAttendance = attendance.filter(a => {
    const emp = employees.find(e => e.id === a.employee_id);
    return !!emp;
  });

  return `
  ${renderWifiAttendanceCard(employees)}

  <div class="card" style="padding:0; overflow:hidden;">
    <div style="padding:16px 20px; border-bottom:1px solid rgba(245,200,66,0.15); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <h3 style="font-size:15px; font-weight:700; margin:0; display:flex; align-items:center; gap:8px;">
        <i class="ti ti-calendar-check" style="color:#f5c842;"></i> Daily Check-In Logs
      </h3>
      <div style="font-size:11.5px; opacity:0.8;">
        Showing ${validAttendance.length} attendance record${validAttendance.length === 1 ? '' : 's'}
      </div>
    </div>
    <div style="overflow-x:auto;">
      <table class="emp-modal-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:12.5px;">
        <thead>
          <tr>
            <th style="padding:12px 16px;">Date</th>
            <th style="padding:12px 16px;">Employee</th>
            <th style="padding:12px 16px;">Check In</th>
            <th style="padding:12px 16px;">Check Out</th>
            <th style="padding:12px 16px;">Hours Logged</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;">WiFi / Network</th>
            <th style="padding:12px 16px; text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${!validAttendance.length ? `
            <tr>
              <td colspan="8" style="text-align:center; padding:36px; opacity:0.7;">
                <i class="ti ti-calendar" style="font-size:32px; display:block; margin-bottom:8px; opacity:0.4;"></i>
                No attendance logs found yet. Tap "Punch Check-In" or "Log Manual Attendance" to add a log.
              </td>
            </tr>
          ` : validAttendance.map(a => {
            const emp = employees.find(e => e.id === a.employee_id);
            const inTime = a.check_in ? new Date(a.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
            const outTime = a.check_out ? new Date(a.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

            let hoursStr = '—';
            if (a.check_in && a.check_out) {
              const diffMs = new Date(a.check_out) - new Date(a.check_in);
              const hrs = Math.floor(diffMs / (1000 * 60 * 60));
              const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              hoursStr = `${hrs}h ${mins}m`;
            }

            let badgeClass = 'badge-green';
            if (a.status === 'Late') badgeClass = 'badge-amber';
            if (a.status === 'Half-day') badgeClass = 'badge-blue';
            if (a.status === 'Absent') badgeClass = 'badge-red';

            const isWifiVerified = a.notes && a.notes.toLowerCase().includes('wifi');
            const wifiBadge = isWifiVerified
              ? `<span class="badge badge-green" style="font-size:10.5px; padding:2px 7px; display:inline-flex; align-items:center; gap:3px;" title="${a.notes || 'Verified on salon WiFi router'}"><i class="ti ti-wifi"></i> WiFi Verified</span>`
              : `<span class="badge badge-gray" style="font-size:10.5px; padding:2px 7px; display:inline-flex; align-items:center; gap:3px;" title="${a.notes || 'Manual Entry'}"><i class="ti ti-pencil"></i> Manual Entry</span>`;

            return `
            <tr>
              <td style="padding:12px 16px; font-weight:600;">${a.date}</td>
              <td style="padding:12px 16px; font-weight:700;">${emp.name}</td>
              <td style="padding:12px 16px; opacity:0.85;">${inTime}</td>
              <td style="padding:12px 16px; opacity:0.85;">${outTime}</td>
              <td style="padding:12px 16px; font-weight:600; color:#f5c842;">${hoursStr}</td>
              <td style="padding:12px 16px;"><span class="badge ${badgeClass}">${a.status}</span></td>
              <td style="padding:12px 16px;">${wifiBadge}</td>
              <td style="padding:12px 16px; text-align:right;">
                <button class="btn btn-danger btn-icon" onclick="window.handleDeleteAttendance('${a.id}')" style="width:28px; height:28px; padding:0; color:#dc2626;" title="Delete log">
                  <i class="ti ti-trash" style="font-size:12px;"></i>
                </button>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>
  `;
}

// ────────────────────────────────────────────────────────
//  PAYROLL & PAYSLIPS TAB
// ────────────────────────────────────────────────────────

function renderPayrollTab(employees, attendance, payslips, events) {
  if (!employees.length) {
    return `<div class="card" style="text-align:center; padding:50px; color:#999;">
      No employees registered yet. Add employees under the Directory tab.
    </div>`;
  }

  return `
  <div style="display:grid; grid-template-columns: 1fr 2fr; gap:16px; align-items:start;">
    <!-- LEFT PANEL: GENERATE PAYSLIP FORM -->
    <div class="card">
      <h3 style="font-size:15px; font-weight:700; margin-bottom:14px; border-bottom:1px solid rgba(245,200,66,0.15); padding-bottom:10px; display:flex; align-items:center; gap:8px;">
        <i class="ti ti-calculator" style="color:#f5c842;"></i> Generate Monthly Payslip
      </h3>
      
      <div class="form-group">
        <label class="form-label">Select Month</label>
        <input type="month" class="form-input" id="payroll-month" value="${window._payrollSelectedMonth}" onchange="window.handlePayrollMonthChange(this.value)">
      </div>

      <div class="form-group">
        <label class="form-label">Select Employee</label>
        <select class="form-input form-select" id="payroll-emp-id" onchange="window.calculatePayrollEstimate()">
          <option value="">-- Choose Staff --</option>
          ${employees.map(e => `<option value="${e.id}">${e.name} (${e.role || 'Staff'})</option>`).join('')}
        </select>
      </div>

      <!-- Realtime Calculation Estimate Panel -->
      <div id="payroll-estimate-container" class="emp-payroll-estimate-card" style="display:none;">
        <!-- Calculated values will inject here dynamically -->
      </div>

      <div class="form-group">
        <label class="form-label">Manual Deductions (₹)</label>
        <input type="number" class="form-input" id="payroll-deductions" placeholder="e.g. advances, unpaid leaves" value="0" oninput="window.calculatePayrollEstimate()">
      </div>

      <div class="form-group">
        <label class="form-label">Payment Mode</label>
        <select class="form-input form-select" id="payroll-status">
          <option value="Pending">Pending / Unpaid</option>
          <option value="Paid">Paid</option>
        </select>
      </div>

      <button class="btn btn-gold" onclick="window.handleSavePayslip()" style="width:100%; justify-content:center; margin-top:8px;">
        <i class="ti ti-check"></i> Generate & Save Payslip
      </button>
    </div>

    <!-- RIGHT PANEL: EXISTING PAYSLIPS HISTORY -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div style="padding:16px 20px; border-bottom:1px solid rgba(245,200,66,0.15);">
        <h3 style="font-size:15px; font-weight:700; margin:0; display:flex; align-items:center; gap:8px;">
          <i class="ti ti-file-invoice" style="color:#f5c842;"></i> Payslips History
        </h3>
      </div>
      <div style="overflow-x:auto;">
        ${!payslips.length ? `
          <div style="text-align:center; padding:40px; opacity:0.7; font-size:12.5px;">No payslips generated yet</div>
        ` : `
          <table class="emp-modal-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:12.5px;">
            <thead>
              <tr>
                <th style="padding:12px 16px;">Month</th>
                <th style="padding:12px 16px;">Employee</th>
                <th style="padding:12px 16px;">Net Salary</th>
                <th style="padding:12px 16px;">Status</th>
                <th style="padding:12px 16px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${payslips.map(p => {
                const emp = employees.find(e => e.id === p.employee_id);
                if (!emp) return '';
                return `
                <tr>
                  <td style="padding:12px 16px; font-weight:700;">${p.month}</td>
                  <td style="padding:12px 16px; font-weight:600;">${emp.name}</td>
                  <td style="padding:12px 16px; font-weight:800; color:#f5c842;">₹${(p.net_pay || 0).toLocaleString()}</td>
                  <td style="padding:12px 16px;">
                    <span class="badge ${p.status === 'Paid' ? 'badge-green' : 'badge-amber'}" onclick="window.togglePayslipStatus('${p.id}', '${p.status}')" style="cursor:pointer;" title="Click to toggle status">
                      ${p.status}
                    </span>
                  </td>
                  <td style="padding:12px 16px; text-align:right; display:flex; justify-content:flex-end; gap:6px;">
                    <button class="btn btn-outline" onclick="window.viewPayslipReceipt('${p.id}')" style="padding:4px 8px; font-size:11px; height:28px; display:inline-flex; align-items:center; gap:4px;">
                      <i class="ti ti-printer"></i> View & Print
                    </button>
                    <button class="btn btn-danger btn-icon" onclick="window.handleDeletePayslip('${p.id}')" style="width:28px; height:28px; padding:0; color:#dc2626;">
                      <i class="ti ti-trash"></i>
                    </button>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  </div>
  `;
}

// ────────────────────────────────────────────────────────
//  CALCULATION & EVENT WAGES PARSING
// ────────────────────────────────────────────────────────

window.calculatePayrollEstimate = function() {
  const empId = document.getElementById('payroll-emp-id').value;
  const container = document.getElementById('payroll-estimate-container');
  if (!empId) {
    container.style.display = 'none';
    return;
  }

  const emp = (window._cachedEmployees || []).find(e => e.id === empId);
  if (!emp) return;

  const month = document.getElementById('payroll-month').value;
  const attendance = window._cachedAttendance || [];
  const events = window._cachedEvents || [];
  const manualDeductions = parseInt(document.getElementById('payroll-deductions').value) || 0;

  // 1. Calculate attendance days in selected month
  const empAttendance = attendance.filter(a => a.employee_id === empId && a.date.startsWith(month));
  const daysPresent = empAttendance.reduce((sum, a) => {
    if (a.status === 'Present' || a.status === 'Late') return sum + 1;
    if (a.status === 'Half-day') return sum + 0.5;
    return sum;
  }, 0);

  // 2. Base Pay Math
  let basePay = 0;
  if (emp.salary_type === 'monthly') {
    basePay = emp.base_rate || 0;
  } else {
    basePay = (emp.base_rate || 0) * daysPresent;
  }

  // 3. Allowances (Event Commissions / Staff Wages)
  // Check if staff name matches either the full name or short name
  const staffNameLower = emp.name.toLowerCase();
  let eventCommissions = 0;

  events.forEach(e => {
    if (e.date && e.date.startsWith(month) && e.staff_wages) {
      try {
        const wages = typeof e.staff_wages === 'string' ? JSON.parse(e.staff_wages) : e.staff_wages;
        if (Array.isArray(wages)) {
          wages.forEach(w => {
            if (w.name && w.name.toLowerCase().includes(staffNameLower) || staffNameLower.includes(w.name.toLowerCase())) {
              eventCommissions += (w.amount || 0);
            }
          });
        }
      } catch (err) {}
    }
  });

  const netPay = Math.max(0, basePay + eventCommissions - manualDeductions);

  // Store calculated values in window object for the save click
  window._tempPayrollCalculations = {
    employee_id: empId,
    month: month,
    base_pay: basePay,
    allowances: eventCommissions,
    deductions: manualDeductions,
    net_pay: netPay,
    days_present: daysPresent
  };

  container.className = 'emp-payroll-estimate-card';
  container.innerHTML = `
    <div class="emp-pe-title" style="font-size:13px; font-weight:700; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
      <span><i class="ti ti-chart-pie"></i> Calculation Breakdown:</span>
      <span class="badge badge-amber">${emp.salary_type === 'monthly' ? 'Monthly Salary' : 'Daily Wage'}</span>
    </div>
    <div class="emp-pe-row" style="display:flex; justify-content:space-between; font-size:12.5px; padding:4px 0;">
      <span>Present Days:</span>
      <strong>${daysPresent} days</strong>
    </div>
    <div class="emp-pe-row" style="display:flex; justify-content:space-between; font-size:12.5px; padding:4px 0;">
      <span>Base Pay Rate:</span>
      <strong>₹${(emp.base_rate || 0).toLocaleString()} / ${emp.salary_type === 'monthly' ? 'mo' : 'day'}</strong>
    </div>
    <div class="emp-pe-row emp-pe-add" style="display:flex; justify-content:space-between; font-size:12.5px; padding:4px 0; border-top:1px dashed rgba(245,200,66,0.2); margin-top:6px;">
      <span>Calculated Base Pay:</span>
      <strong>₹${basePay.toLocaleString()}</strong>
    </div>
    <div class="emp-pe-row emp-pe-add" style="display:flex; justify-content:space-between; font-size:12.5px; padding:4px 0;">
      <span>Event Commission Wages:</span>
      <strong>+₹${eventCommissions.toLocaleString()}</strong>
    </div>
    <div class="emp-pe-row emp-pe-sub" style="display:flex; justify-content:space-between; font-size:12.5px; padding:4px 0;">
      <span>Deductions:</span>
      <strong>-₹${manualDeductions.toLocaleString()}</strong>
    </div>
    <div class="emp-pe-net" style="display:flex; justify-content:space-between; font-size:15px; font-weight:800; padding:10px 0 2px; margin-top:8px;">
      <span>Total Net Take-Home:</span>
      <span>₹${netPay.toLocaleString()}</span>
    </div>
  `;
  container.style.display = 'block';
};

// ────────────────────────────────────────────────────────
//  INTERACTIVE ACTIONS
// ────────────────────────────────────────────────────────

window.switchEmployeesTab = function(tab) {
  window._employeesTab = tab;
  if (typeof window.render === 'function') window.render();
};

window.handlePayrollMonthChange = function(month) {
  window._payrollSelectedMonth = month;
  window.calculatePayrollEstimate();
};

window.handleSavePayslip = async function() {
  const calculations = window._tempPayrollCalculations;
  if (!calculations) {
    showToast('Please select employee to generate payroll calculations', 'error');
    return;
  }

  const status = document.getElementById('payroll-status').value;
  const result = await savePayslip({
    ...calculations,
    status: status,
    paid_date: status === 'Paid' ? new Date().toISOString().split('T')[0] : null
  });

  if (result) {
    showToast('Payslip generated and saved successfully!');
    if (typeof window.render === 'function') window.render();
  }
};

window.togglePayslipStatus = async function(id, currentStatus) {
  const nextStatus = currentStatus === 'Paid' ? 'Pending' : 'Paid';
  const payslip = (window._cachedPayslips || []).find(p => p.id === id);
  if (!payslip) return;

  const result = await savePayslip({
    ...payslip,
    status: nextStatus,
    paid_date: nextStatus === 'Paid' ? new Date().toISOString().split('T')[0] : null
  });

  if (result) {
    showToast(`Payslip marked as ${nextStatus}!`);
    if (typeof window.render === 'function') window.render();
  }
};

window.handleDeleteEmployee = async function(id) {
  const confirmed = await showConfirmDelete('Remove Staff', 'Are you sure you want to remove this employee record? All their check-in and payroll records will also be deleted.');
  if (!confirmed) return;

  const success = await deleteEmployee(id);
  if (success && typeof window.render === 'function') window.render();
};

window.handleDeleteAttendance = async function(id) {
  const confirmed = await showConfirmDelete('Delete Attendance Record', 'Are you sure you want to delete this check-in entry?');
  if (!confirmed) return;

  // Locally log delete
  try {
    let local = JSON.parse(localStorage.getItem('attendance') || '[]');
    local = local.filter(a => a.id !== id);
    localStorage.setItem('attendance', JSON.stringify(local));
  } catch(e) {}

  // Attempt database delete
  const client = window.initDb ? window.initDb() : null;
  if (client) {
    await client.from('attendance').delete().eq('id', id);
  }

  showToast('Attendance entry deleted!');
  if (typeof window.render === 'function') window.render();
};

window.handleDeletePayslip = async function(id) {
  const confirmed = await showConfirmDelete('Delete Payslip', 'Are you sure you want to delete this payslip?');
  if (!confirmed) return;

  try {
    let local = JSON.parse(localStorage.getItem('payslips') || '[]');
    local = local.filter(p => p.id !== id);
    localStorage.setItem('payslips', JSON.stringify(local));
  } catch(e) {}

  const client = window.initDb ? window.initDb() : null;
  if (client) {
    await client.from('payslips').delete().eq('id', id);
  }

  showToast('Payslip record deleted!');
  if (typeof window.render === 'function') window.render();
};

// ────────────────────────────────────────────────────────
//  MODALS & POPUPS
// ────────────────────────────────────────────────────────

window.openAddEmployeeModal = function() {
  const today = new Date().toISOString().split('T')[0];
  showModal('Add Employee', `
    <div class="form-group">
      <label class="form-label">Employee Full Name *</label>
      <input class="form-input" id="me-name" placeholder="e.g. Priya Sharma">
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Salary Type</label>
        <select class="form-input form-select" id="me-salary-type">
          <option value="monthly">Monthly Salary</option>
          <option value="daily">Daily Wages</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Base Pay Rate (₹) *</label>
        <input type="number" class="form-input" id="me-rate" placeholder="Amount">
      </div>
      <div class="form-group">
        <label class="form-label">Shift Start Time *</label>
        <input type="time" class="form-input" id="me-shift-start" value="09:00">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Login Password / PIN *</label>
      <input class="form-input" id="me-password" placeholder="e.g. Priya@123">
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Employment Type</label>
        <select class="form-input form-select" id="me-type">
          <option value="Full Time">Full Time</option>
          <option value="Part Time">Part Time</option>
          <option value="Intern">Intern</option>
          <option value="Freelance">Freelance</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Employee Status</label>
        <select class="form-input form-select" id="me-status">
          <option value="Active">Active</option>
          <option value="On Leave">On Leave</option>
          <option value="Resigned">Resigned</option>
          <option value="Terminated">Terminated</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Leave Balance</label>
        <input type="number" class="form-input" id="me-leaves" value="12">
      </div>
    </div>
  `, async () => {
    const name = document.getElementById('me-name').value.trim();
    if (!name) { showToast('Please enter employee name', 'error'); return; }

    const phone = '';
    const email = '';
    const role = 'Stylist';
    const joiningDate = today;
    const salaryType = document.getElementById('me-salary-type').value;
    const rate = parseInt(document.getElementById('me-rate').value) || 0;
    if (rate <= 0) { showToast('Please enter base pay rate', 'error'); return; }

    const password = document.getElementById('me-password').value.trim();
    if (!password) { showToast('Please enter a login password/PIN for employee', 'error'); return; }

    const dob = null;
    const aadhaar_number = '';
    const address = '';
    const emergency_name = '';
    const emergency_number = '';
    const employment_type = document.getElementById('me-type').value;
    const status = document.getElementById('me-status').value;
    const leave_balance = parseInt(document.getElementById('me-leaves').value) || 0;
    const shift_start = document.getElementById('me-shift-start').value || '09:00';
    const bankDetails = '';
    const photo_url = '';
    const aadhaar_photo_url = '';

    const result = await addEmployee({
      name,
      phone,
      email,
      role,
      joining_date: joiningDate,
      salary_type: salaryType,
      base_rate: rate,
      password,
      dob,
      aadhaar_number,
      address,
      emergency_name,
      emergency_number,
      employment_type,
      status,
      leave_balance,
      shift_start,
      bank_details: bankDetails,
      photo_url,
      aadhaar_photo_url,
      owner_notes: '',
      employee_msg: ''
    });

    if (result) {
      closeModal();
      if (typeof window.render === 'function') window.render();
    }
  });
};

window.openManualAttendanceModal = function() {
  const employees = window._cachedEmployees || [];
  if (!employees.length) {
    showToast('Add employees first to log attendance', 'error');
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  showModal('Log Attendance', `
    <div class="form-group">
      <label class="form-label">Select Employee</label>
      <select class="form-input form-select" id="ma-emp-id">
        ${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input type="date" class="form-input" id="ma-date" value="${today}" onclick="try{this.showPicker()}catch(e){}">
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Check-In Time</label>
        <input type="time" class="form-input" id="ma-checkin" value="09:30">
      </div>
      <div class="form-group">
        <label class="form-label">Check-Out Time</label>
        <input type="time" class="form-input" id="ma-checkout" value="18:30">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Status</label>
      <select class="form-input form-select" id="ma-status">
        <option value="Present">Present</option>
        <option value="Late">Late</option>
        <option value="Half-day">Half-day</option>
        <option value="Absent">Absent</option>
      </select>
    </div>
    <div style="margin-top:10px; padding:10px 12px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:8px;">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; margin:0; font-weight:600; color:#22c55e;">
        <input type="checkbox" id="ma-wifi-check" checked style="width:16px; height:16px; accent-color:#22c55e;">
        <span><i class="ti ti-wifi"></i> Verified via Salon WiFi Router</span>
      </label>
    </div>
  `, async () => {
    const employee_id = document.getElementById('ma-emp-id').value;
    const date = document.getElementById('ma-date').value || today;
    const inTime = document.getElementById('ma-checkin').value;
    const outTime = document.getElementById('ma-checkout').value;
    const status = document.getElementById('ma-status').value;
    const isWifi = document.getElementById('ma-wifi-check')?.checked ?? true;

    const check_in = inTime ? `${date}T${inTime}:00` : null;
    const check_out = outTime ? `${date}T${outTime}:00` : null;

    const result = await saveAttendance({
      employee_id,
      date,
      check_in,
      check_out,
      status,
      notes: isWifi ? 'WiFi Verified (Manual / Salon Router)' : 'Manual Attendance Entry'
    });

    if (result) {
      showToast('Attendance logged successfully!');
      closeModal();
      if (typeof window.render === 'function') window.render();
    }
  });
};

window.viewPayslipReceipt = function(payslipId) {
  const payslip = (window._cachedPayslips || []).find(p => p.id === payslipId);
  if (!payslip) return;

  const emp = (window._cachedEmployees || []).find(e => e.id === payslip.employee_id);
  if (!emp) return;

  showModal('Salary Payslip', `
    <div id="payslip-print-section" style="padding:10px; font-family:'Courier New', monospace; color:#000; background:#fff;">
      <div style="text-align:center; border-bottom: 2px dashed #000; padding-bottom:12px; margin-bottom:12px;">
        <h2 style="font-size:17px; font-weight:700; margin:0;">KALAI MAKEOVER</h2>
        <p style="font-size:11px; margin:2px 0;">Premium Makeup & Hair Salon</p>
        <p style="font-size:11px; margin:0;">EMPLOYEE SALARY PAYSLIP</p>
      </div>

      <div style="font-size:12px; line-height:1.5; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between;">
          <span>Employee Name:</span>
          <strong>${emp.name}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Designation:</span>
          <strong>${emp.role || 'Staff'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Salary Month:</span>
          <strong>${payslip.month}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Wage Type:</span>
          <strong>${emp.salary_type === 'monthly' ? 'Monthly Contract' : 'Daily wage basis'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Status:</span>
          <strong>${payslip.status.toUpperCase()}</strong>
        </div>
        ${payslip.paid_date ? `
        <div style="display:flex; justify-content:space-between;">
          <span>Paid Date:</span>
          <strong>${payslip.paid_date}</strong>
        </div>
        ` : ''}
      </div>

      <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin-bottom:14px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:4px;">
          <span>Earnings Description</span>
          <span>Amount</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:2px 0;">
          <span>Base Salary / Wages:</span>
          <span>₹${(payslip.base_pay || 0).toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:2px 0;">
          <span>Event Commissions / Allowances:</span>
          <span>+₹${(payslip.allowances || 0).toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:2px 0; color:#dc2626;">
          <span>Deductions:</span>
          <span>-₹${(payslip.deductions || 0).toLocaleString()}</span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:700; border-bottom: 2px dashed #000; padding-bottom:8px; margin-bottom:20px;">
        <span>NET TAKE-HOME:</span>
        <span>₹${(payslip.net_pay || 0).toLocaleString()}</span>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:50px; font-size:10px;">
        <div style="text-align:center; width:45%;">
          <div style="border-top: 1px solid #000; padding-top:4px;">Employee Signature</div>
        </div>
        <div style="text-align:center; width:45%;">
          <div style="border-top: 1px solid #000; padding-top:4px;">Authorized Signatory</div>
        </div>
      </div>
    </div>
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn btn-gold" onclick="window.printPayslipElement()" style="flex:1; justify-content:center;">
        <i class="ti ti-printer"></i> Print Payslip
      </button>
    </div>
  `, null);

  // Hide default save button in Modal
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';
};

window.printPayslipElement = function() {
  const content = document.getElementById('payslip-print-section').innerHTML;
  const printWindow = window.open('', '_blank', 'width=600,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>Payslip - Print</title>
        <style>
          body { padding: 40px; margin: 0; }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

window.showEmployeePerformance = async function(empId) {
  const emp = (window._cachedEmployees || []).find(e => e.id === empId);
  if (!emp) return;

  // Show loading modal first
  showModal('Employee Profile & Performance Dashboard', `
    <div class="loading-page" style="height: 180px; display:flex; flex-direction:column; justify-content:center; align-items:center;">
      <div class="spinner"></div>
      <div style="margin-top:12px;font-weight:600;color:#f5c842;">Loading profile details...</div>
    </div>
  `, null);
  
  // Attach custom wide dashboard modal class
  const modalEl = document.querySelector('#modal-container .modal');
  if (modalEl) {
    modalEl.classList.add('emp-dashboard-modal');
  }

  // Hide modal save button and make cancel button say Close
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';

  try {
    const [customers, events, expenses, students, jewels, attendanceList, payslipsList] = await Promise.all([
      fetchCustomers().catch(() => []),
      fetchEvents().catch(() => []),
      fetchExpenses().catch(() => []),
      fetchClassEnrollments().catch(() => []),
      fetchJewels().catch(() => []),
      fetchAttendance().catch(() => []),
      fetchPayslips().catch(() => [])
    ]);

    const nameLower = emp.name.toLowerCase();

    // 1. Attendance Metrics
    const empAttendance = attendanceList.filter(a => a.employee_id === empId);
    const totalLogs = empAttendance.length;
    const statusCounts = { Present: 0, Late: 0, 'Half-day': 0, Absent: 0 };
    empAttendance.forEach(a => {
      if (statusCounts.hasOwnProperty(a.status)) {
        statusCounts[a.status]++;
      }
    });
    const daysPresent = statusCounts.Present + statusCounts.Late + (statusCounts['Half-day'] * 0.5);
    const daysAbsent = statusCounts.Absent;
    const lateEntries = statusCounts.Late;

    const empPayslips = payslipsList.filter(p => p.employee_id === empId);

    // Calculate working hours (assuming standard 8 hours per shift)
    let totalWorkingHours = 0;
    empAttendance.forEach(a => {
      if (a.check_in && a.check_out) {
        const diffMs = new Date(a.check_out) - new Date(a.check_in);
        totalWorkingHours += diffMs / (1000 * 60 * 60);
      } else if (a.status === 'Present' || a.status === 'Late') {
        totalWorkingHours += 8;
      } else if (a.status === 'Half-day') {
        totalWorkingHours += 4;
      }
    });
    const formattedHours = Math.round(totalWorkingHours);
    const attendanceRate = totalLogs > 0 ? Math.round((daysPresent / totalLogs) * 100) : 100;

    // 2. Events Worked & Wages
    const empEvents = [];
    let totalEventWages = 0;
    events.forEach(e => {
      if (e.staff_wages) {
        try {
          const wages = typeof e.staff_wages === 'string' ? JSON.parse(e.staff_wages) : e.staff_wages;
          if (Array.isArray(wages)) {
            wages.forEach(w => {
              if (w.name && w.name.toLowerCase().includes(nameLower) || nameLower.includes(w.name.toLowerCase())) {
                totalEventWages += (w.amount || 0);
                empEvents.push({
                  date: e.date || '—',
                  customer: e.customer || 'Unknown',
                  type: e.type || 'Event',
                  wageAmount: w.amount || 0
                });
              }
            });
          }
        } catch (err) {}
      }
    });

    // 3. System Contributions Added By Him/Her ([Emp: Name])
    const isEmpRecord = (val) => {
      if (!val) return false;
      const valLower = val.toLowerCase();
      const match = valLower.match(/\[emp(?::\s*([^\]]+))?\]/);
      if (!match) return false;
      const nameInTag = match[1] ? match[1].trim() : '';
      return nameInTag === nameLower;
    };

    const empCustomers = customers.filter(c => isEmpRecord(c.name));
    const empCounts = {
      customers: empCustomers.length,
      events: events.filter(e => isEmpRecord(e.customer)).length,
      expenses: expenses.filter(e => isEmpRecord(e.note)).length,
      students: students.filter(s => isEmpRecord(s.name)).length,
      jewels: jewels.filter(j => isEmpRecord(j.name)).length
    };
    const totalEntries = empCounts.customers + empCounts.events + empCounts.expenses + empCounts.students + empCounts.jewels;

    const customersServed = empCustomers.length;
    const totalRevenue = empCustomers.reduce((sum, c) => sum + (c.amount || c.total_spend || 0), 0);
    const ratedCustomers = empCustomers.filter(c => (c.rating || 0) > 0);
    const avgRating = ratedCustomers.length > 0 
      ? (ratedCustomers.reduce((sum, c) => sum + c.rating, 0) / ratedCustomers.length).toFixed(1) 
      : '—';

    // 4. Photos and CSS
    const photoUrl = emp.photo_url || '';
    const aadhaarPhotoUrl = emp.aadhaar_photo_url || '';

    // Colors list matching indices
    const colors = ['av-gold', 'av-teal', 'av-rose', 'av-purple'];
    const empIndex = (window._cachedEmployees || []).findIndex(e => e.id === empId);
    const initials = (emp.name || '').split(' ').map(n => n[0]).join('').slice(0, 2);

    const isOwner = state.userRole === 'owner';

    const styles = `
      <style>
        #modal-container .modal {
          max-width: 680px !important;
          width: 95vw !important;
        }
        .modal-tab-menu-wrap {
          display: flex !important;
          gap: 4px !important;
          border-bottom: 1.5px solid rgba(245, 200, 66, 0.2) !important;
          margin-bottom: 16px !important;
          overflow-x: auto !important;
          padding-bottom: 2px !important;
        }
        .modal-tab-btn {
          flex: 0 0 auto !important;
          background: none !important;
          border: none !important;
          border-bottom: 2.5px solid transparent !important;
          padding: 8px 12px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: rgba(255, 255, 255, 0.65) !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          white-space: nowrap !important;
          border-radius: 6px 6px 0 0 !important;
          font-family: inherit !important;
        }
        body.theme-light .modal-tab-btn {
          color: #555 !important;
        }
        .modal-tab-btn:hover {
          color: #f5c842 !important;
          background: rgba(245, 200, 66, 0.08) !important;
        }
        .modal-tab-btn.active {
          color: #f5c842 !important;
          border-bottom-color: #f5c842 !important;
          background: rgba(245, 200, 66, 0.08) !important;
        }
        body.theme-light .modal-tab-btn.active {
          color: #d97706 !important;
          border-bottom-color: #d97706 !important;
          background: rgba(217, 119, 6, 0.06) !important;
        }

        /* Profile & Employment Items - 100% High Contrast */
        .profile-grid-item {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          border-bottom: 1px solid rgba(245, 200, 66, 0.12) !important;
          padding: 10px 4px !important;
          font-size: 13px !important;
        }
        .profile-grid-item:last-child {
          border-bottom: none !important;
        }
        .profile-grid-item span:first-child {
          color: rgba(255, 255, 255, 0.65) !important;
          font-weight: 500 !important;
        }
        .profile-grid-item span:last-child {
          color: #ffffff !important;
          font-weight: 600 !important;
          text-align: right !important;
        }
        body.theme-light .profile-grid-item {
          border-bottom: 1px solid #f0f0f0 !important;
        }
        body.theme-light .profile-grid-item span:first-child {
          color: #4b5563 !important;
        }
        body.theme-light .profile-grid-item span:last-child {
          color: #0f172a !important;
        }

        .profile-header-card {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(245, 200, 66, 0.22) !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
          padding: 16px !important;
          border-radius: 14px !important;
          margin-bottom: 16px !important;
        }
        body.theme-light .profile-header-card {
          background: #faf9f6 !important;
          border: 1px solid #e5e5e5 !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
        }

        #modal-container .modal h3,
        #modal-container .modal h4 {
          color: #ffffff !important;
        }
        body.theme-light #modal-container .modal h3,
        body.theme-light #modal-container .modal h4 {
          color: #1a1a1a !important;
        }
      </style>
    `;

    const bodyHtml = `
      ${styles}
      <div style="max-height:75vh; overflow-y:auto; padding-right:4px;" class="scrollbar-hide">
        
        <!-- Header Profile Card -->
        <div class="profile-header-card" style="display:flex; gap:16px; align-items:center;">
          ${photoUrl ? `
            <img src="${photoUrl}" style="width:64px; height:64px; border-radius:50%; object-fit:cover; border:2px solid #f5c842; flex-shrink:0;" />
          ` : `
            <div class="avatar ${colors[empIndex >= 0 ? empIndex % 4 : 0]}" style="width:64px; height:64px; font-size:20px; font-weight:700; flex-shrink:0;">${initials}</div>
          `}
          <div style="flex:1; min-width:0;">
            <h3 style="font-size:18px; font-weight:700; margin:0 0 4px 0;">${emp.name}</h3>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:4px;">
              <span class="badge ${emp.status === 'Active' ? 'badge-green' : emp.status === 'On Leave' ? 'badge-amber' : 'badge-red'}" style="font-size:10px; padding:2px 8px;">
                ${emp.status || 'Active'}
              </span>
              <span style="font-size:12px; font-weight:600; opacity:0.8;">ID: ${emp.emp_id || 'kalai-emp-XX'}</span>
              <span style="font-size:12px; opacity:0.7;">· ${emp.role || 'Staff'}</span>
            </div>
          </div>
          ${isOwner ? `
            <button class="btn btn-outline" onclick="window.toggleEditProfile('${empId}')" style="padding:6px 14px; font-size:12px; height:34px; display:inline-flex; align-items:center; gap:6px;">
              <i class="ti ti-edit"></i> Edit Profile
            </button>
          ` : `
            <div style="display:flex; gap:6px;">
              <button class="btn btn-outline" onclick="window.toggleEditProfile('${empId}')" style="padding:6px 12px; font-size:11.5px; height:32px;">
                <i class="ti ti-edit"></i> Edit Profile
              </button>
              <button class="btn btn-outline" onclick="window._logoutEmployee(); closeModal();" style="padding:6px 12px; font-size:11.5px; height:32px; border-color:#dc2626; color:#dc2626; background:rgba(220,38,38,0.05); font-weight:600; display:flex; align-items:center; gap:4px;">
                <i class="ti ti-logout"></i> Log Out
              </button>
            </div>
          `}
        </div>

        <!-- Tabs Menu -->
        <div class="modal-tab-menu-wrap">
          <button class="modal-tab-btn active" data-tab="profile" onclick="window.switchModalTab('profile')"><i class="ti ti-user"></i> Profile</button>
          <button class="modal-tab-btn" data-tab="employment" onclick="window.switchModalTab('employment')"><i class="ti ti-briefcase"></i> Employment</button>
          <button class="modal-tab-btn" data-tab="attendance" onclick="window.switchModalTab('attendance')"><i class="ti ti-calendar"></i> Attendance</button>
          <button class="modal-tab-btn" data-tab="performance" onclick="window.switchModalTab('performance')"><i class="ti ti-chart-bar"></i> Performance</button>
          <button class="modal-tab-btn" data-tab="payslips" onclick="window.switchModalTab('payslips')"><i class="ti ti-file-invoice"></i> Payslips</button>
          <button class="modal-tab-btn" data-tab="notes" onclick="window.switchModalTab('notes')"><i class="ti ti-message-dots"></i> Notes &amp; Messages</button>
        </div>

        <!-- TAB PANES -->
        
        <!-- Tab 1: Profile Pane -->
        <div id="tab-pane-profile" class="modal-tab-pane" style="display:block;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div class="profile-grid-item"><span>Full Name</span><span>${emp.name}</span></div>
            <div class="profile-grid-item"><span>Employee ID</span><span>${emp.emp_id || 'kalai-emp-XX'}</span></div>
            <div class="profile-grid-item"><span>Date of Birth</span><span>${emp.dob || '—'}</span></div>
            <div class="profile-grid-item"><span>Mobile Number</span><span>${emp.phone || '—'}</span></div>
            <div class="profile-grid-item"><span>Residential Address</span><span>${emp.address || '—'}</span></div>
            <div class="profile-grid-item"><span>Emergency Contact Name</span><span>${emp.emergency_name || '—'}</span></div>
            <div class="profile-grid-item" style="border-bottom:none;"><span>Emergency Contact Number</span><span>${emp.emergency_number || '—'}</span></div>
          </div>
        </div>

        <!-- Tab 2: Employment Pane -->
        <div id="tab-pane-employment" class="modal-tab-pane" style="display:none;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div class="profile-grid-item"><span>Date of Joining</span><span>${emp.joining_date || '—'}</span></div>
            <div class="profile-grid-item"><span>Employment Type</span><span>${emp.employment_type || 'Full Time'}</span></div>
            <div class="profile-grid-item"><span>Employee Status</span><span><span class="badge ${emp.status === 'Active' ? 'badge-green' : emp.status === 'On Leave' ? 'badge-amber' : 'badge-red'}" style="font-size:9.5px; padding:2px 7px;">${emp.status || 'Active'}</span></span></div>
            <div class="profile-grid-item"><span>Leave Balance</span><span>${emp.leave_balance || 0} Days</span></div>
            <div class="profile-grid-item"><span>Salary/Wage Basis</span><span>${emp.salary_type === 'monthly' ? 'Monthly Salary' : 'Daily Wages'}</span></div>
            <div class="profile-grid-item"><span>Base Pay Rate</span><span style="color:#f5c842; font-weight:700;">₹${(emp.base_rate || 0).toLocaleString()} / ${emp.salary_type === 'monthly' ? 'month' : 'day'}</span></div>
            <div class="profile-grid-item" style="border-bottom:none;"><span>Shift Start Time</span><span>${emp.shift_start || '09:00'}</span></div>
          </div>
        </div>

        <!-- Tab 3: Attendance Pane -->
        <div id="tab-pane-attendance" class="modal-tab-pane" style="display:none;">
          <div class="emp-stat-grid-4">
            <div class="emp-stat-card stat-green">
              <div class="stat-label">Present Days</div>
              <div class="stat-value">${daysPresent}</div>
            </div>
            <div class="emp-stat-card stat-amber">
              <div class="stat-label">Late Entries</div>
              <div class="stat-value">${lateEntries}</div>
            </div>
            <div class="emp-stat-card stat-red">
              <div class="stat-label">Absent Days</div>
              <div class="stat-value">${daysAbsent}</div>
            </div>
            <div class="emp-stat-card stat-blue">
              <div class="stat-label">Total Hours</div>
              <div class="stat-value">${formattedHours}h</div>
            </div>
          </div>

          <h4 class="emp-section-subhead"><i class="ti ti-history"></i> Recent Shift History</h4>
          ${empAttendance.length === 0 ? `
            <div style="font-size:12px; opacity:0.7; text-align:center; padding:16px 0;">No shifts recorded.</div>
          ` : `
            <table class="emp-modal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th style="text-align:right;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${empAttendance.slice(0, 5).map(a => `
                  <tr>
                    <td style="font-weight:600;">${a.date}</td>
                    <td style="opacity:0.85;">${a.check_in ? new Date(a.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style="opacity:0.85;">${a.check_out ? new Date(a.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style="text-align:right;"><span class="badge ${a.status === 'Present' ? 'badge-green' : a.status === 'Late' ? 'badge-amber' : a.status === 'Half-day' ? 'badge-blue' : 'badge-red'}" style="font-size:9.5px; padding:1px 6px;">${a.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- Tab 4: Performance Pane -->
        <div id="tab-pane-performance" class="modal-tab-pane" style="display:none;">
          <div class="emp-stat-grid-2">
            <div class="emp-stat-card stat-purple">
              <div class="stat-label">Customers Served</div>
              <div class="stat-value">${customersServed}</div>
            </div>
            <div class="emp-stat-card stat-amber">
              <div class="stat-label">Average Customer Rating</div>
              <div class="stat-value" style="display:flex; align-items:center; justify-content:center; gap:4px;">
                ${avgRating} <span style="font-size:18px;">★</span>
              </div>
            </div>
            <div class="emp-stat-card stat-cyan" style="grid-column: span 2;">
              <div class="stat-label">Total Revenue Generated</div>
              <div class="stat-value" style="font-size:26px;">₹${totalRevenue.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <h4 class="emp-section-subhead"><i class="ti ti-apps"></i> System Activity Breakdown</h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
            <span class="performance-chip" style="background:rgba(255,255,255,0.06); border:1px solid rgba(245,200,66,0.2); padding:5px 12px; border-radius:15px; font-size:12px;">Customers: <strong style="color:#f5c842;">${empCounts.customers}</strong></span>
            <span class="performance-chip" style="background:rgba(255,255,255,0.06); border:1px solid rgba(245,200,66,0.2); padding:5px 12px; border-radius:15px; font-size:12px;">Events Booked: <strong style="color:#f5c842;">${empCounts.events}</strong></span>
            <span class="performance-chip" style="background:rgba(255,255,255,0.06); border:1px solid rgba(245,200,66,0.2); padding:5px 12px; border-radius:15px; font-size:12px;">Expenses Logged: <strong style="color:#f5c842;">${empCounts.expenses}</strong></span>
            <span class="performance-chip" style="background:rgba(255,255,255,0.06); border:1px solid rgba(245,200,66,0.2); padding:5px 12px; border-radius:15px; font-size:12px;">Students Registered: <strong style="color:#f5c842;">${empCounts.students}</strong></span>
            <span class="performance-chip" style="background:rgba(255,255,255,0.06); border:1px solid rgba(245,200,66,0.2); padding:5px 12px; border-radius:15px; font-size:12px;">Jewel Purchases: <strong style="color:#f5c842;">${empCounts.jewels}</strong></span>
          </div>

          <h4 class="emp-section-subhead"><i class="ti ti-users"></i> Recent Customer Entries Logged</h4>
          ${empCustomers.length === 0 ? `
            <div style="font-size:12px; opacity:0.7; text-align:center; padding:16px 0;">No client entries logged.</div>
          ` : `
            <table class="emp-modal-table">
              <thead>
                <tr>
                  <th>Customer / Services</th>
                  <th>Amount</th>
                  <th style="text-align:right;">Rating</th>
                </tr>
              </thead>
              <tbody>
                ${empCustomers.slice(0, 5).map(c => `
                  <tr>
                    <td>
                      <div style="font-weight:600;">${c.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim()}</div>
                      <div style="font-size:10.5px; opacity:0.75; margin-top:2px;">${Array.isArray(c.services) ? c.services.join(', ') : (c.services || 'Service')}</div>
                    </td>
                    <td style="font-weight:700; color:#f5c842;">₹${(c.amount || c.total_spend || 0).toLocaleString()}</td>
                    <td style="text-align:right; color:#f5c842; letter-spacing:1px;">
                      ${c.rating ? '★'.repeat(c.rating) + '☆'.repeat(5 - c.rating) : '—'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- Tab: Payslips Pane -->
        <div id="tab-pane-payslips" class="modal-tab-pane" style="display:none;">
          <h4 class="emp-section-subhead"><i class="ti ti-receipt-2"></i> Salary Payslip History</h4>
          ${empPayslips.length === 0 ? `
            <div style="font-size:12.5px; opacity:0.7; text-align:center; padding:24px 0;">
              <i class="ti ti-file-x" style="font-size:28px; display:block; margin-bottom:8px; opacity:0.4;"></i>
              No payslips generated for this employee yet.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${empPayslips.map(p => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); border:1px solid rgba(245,200,66,0.18); padding:12px 16px; border-radius:12px;">
                  <div>
                    <div style="font-size:14px; font-weight:700;">${p.month}</div>
                    <div style="font-size:12px; opacity:0.8; margin-top:2px;">Net Take-Home: <strong style="color:#f5c842;">₹${(p.net_pay || 0).toLocaleString()}</strong></div>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge ${p.status === 'Paid' ? 'badge-green' : 'badge-amber'}" style="font-size:10px; padding:2px 8px;">${p.status}</span>
                    <button class="btn btn-outline" onclick="window.viewPayslipReceipt('${p.id}')" style="padding:4px 10px; font-size:11px; height:28px; display:inline-flex; align-items:center; gap:4px;">
                      <i class="ti ti-printer"></i> Receipt
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Tab 6: Notes & Messages Pane -->
        <div id="tab-pane-notes" class="modal-tab-pane" style="display:none;">
          ${isOwner ? `
            <!-- OWNER PRIVATE NOTES -->
            <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,200,66,0.3); border-radius:12px; padding:16px; margin-bottom:16px;">
              <h4 style="font-size:13.5px; font-weight:700; color:#f5c842; margin:0 0 10px 0; display:flex; align-items:center; gap:6px;">
                <i class="ti ti-lock" style="font-size:15px;"></i> Owner Private Notes (Confidential)
              </h4>
              <textarea id="owner-notes-textarea" class="form-input" style="width:100%; height:120px; font-size:13px; font-family:inherit; padding:10px; resize:none;" placeholder="Type confidential notes about employee performance, reviews, leaves, etc.">${emp.owner_notes || ''}</textarea>
              <button class="btn btn-gold" onclick="window.saveOwnerNotes('${empId}')" style="margin-top:10px; font-size:12px; font-weight:600; height:34px; padding:0 14px;">
                <i class="ti ti-device-floppy"></i> Save Private Notes
              </button>
            </div>
            
            <!-- MESSAGES RECEIVED FROM EMPLOYEE -->
            <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(245,200,66,0.18); border-radius:12px; padding:16px;">
              <h4 style="font-size:13.5px; font-weight:700; margin:0 0 10px 0; display:flex; align-items:center; justify-content:space-between; width:100%;">
                <span style="display:flex; align-items:center; gap:6px;"><i class="ti ti-message" style="color:#f5c842;"></i> Suggestions &amp; Alerts from Employee</span>
                ${emp.employee_msg ? `
                  <button onclick="window.clearEmployeeMessages('${empId}')" style="background:none; border:none; color:#dc2626; font-size:11px; font-weight:600; cursor:pointer;">Clear Log</button>
                ` : ''}
              </h4>
              ${emp.employee_msg ? `
                <div style="background:rgba(20,12,4,0.85); border:1px solid rgba(245,200,66,0.2); border-radius:8px; padding:12px; max-height:160px; overflow-y:auto; font-size:12px; font-family:monospace; white-space:pre-wrap; line-height:1.5;">${emp.employee_msg}</div>
              ` : `
                <div style="text-align:center; padding:16px; opacity:0.6; font-size:12px; font-style:italic;">No suggestions received from employee yet.</div>
              `}
            </div>
          ` : `
            <!-- EMPLOYEE MESSAGES TO OWNER -->
            <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); border-radius:12px; padding:16px; margin-bottom:16px;">
              <h4 style="font-size:13.5px; font-weight:700; color:#60a5fa; margin:0 0 8px 0; display:flex; align-items:center; gap:6px;">
                <i class="ti ti-send"></i> Send Suggestion / Message to Owner
              </h4>
              <p style="font-size:11.5px; opacity:0.8; margin:0 0 10px 0;">Alert the owner about customer updates, feedback, or scheduling queries.</p>
              <textarea id="emp-message-input" class="form-input" style="width:100%; height:90px; font-size:13px; font-family:inherit; padding:10px; resize:none;" placeholder="e.g. Meena customer told she will meet you tomorrow at 4 PM..."></textarea>
              <button class="btn btn-gold" onclick="window.sendEmployeeMessageToOwner('${empId}')" style="margin-top:10px; background:#2563eb; color:#fff; border:none; height:34px; padding:0 14px; font-size:12px; font-weight:600;">
                <i class="ti ti-send"></i> Send Message
              </button>
            </div>

            <!-- LOG OF PREVIOUS SENT MESSAGES -->
            <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(245,200,66,0.18); border-radius:12px; padding:16px;">
              <h4 style="font-size:13.5px; font-weight:700; margin:0 0 10px 0; display:flex; align-items:center; gap:6px;"><i class="ti ti-history" style="color:#f5c842;"></i> Your Message Log</h4>
              ${emp.employee_msg ? `
                <div style="background:rgba(20,12,4,0.85); border:1px solid rgba(245,200,66,0.2); border-radius:8px; padding:12px; max-height:160px; overflow-y:auto; font-size:12px; font-family:monospace; white-space:pre-wrap; line-height:1.5;">${emp.employee_msg}</div>
              ` : `
                <div style="text-align:center; padding:16px; opacity:0.6; font-size:12px; font-style:italic;">No messages sent yet.</div>
              `}
            </div>
          `}
        </div>

      </div>
    `;

    const modalBody = document.getElementById('modal-body');
    if (modalBody) {
      modalBody.innerHTML = bodyHtml;
    }
  } catch (err) {
    console.error('Performance load error:', err);
    const modalBody = document.getElementById('modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="color:#dc2626;text-align:center;padding:20px;">
          <i class="ti ti-alert-triangle" style="font-size:32px;display:block;margin-bottom:10px;"></i>
          Failed to load performance dashboard.
        </div>`;
    }
  }
};

// ────────────────────────────────────────────────────────
//  MODAL ACTIONS HELPERS
// ────────────────────────────────────────────────────────

window.switchModalTab = function(tabName) {
  document.querySelectorAll('.modal-tab-pane').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
  
  const targetPane = document.getElementById(`tab-pane-${tabName}`);
  if (targetPane) targetPane.style.display = 'block';
  
  const targetBtn = document.querySelector(`.modal-tab-btn[data-tab="${tabName}"]`);
  if (targetBtn) targetBtn.classList.add('active');
};

window.saveOwnerNotes = async function(empId) {
  const notesText = document.getElementById('owner-notes-textarea').value.trim();
  const result = await updateEmployee({ id: empId, owner_notes: notesText });
  if (result) {
    // Update local cache
    const idx = (window._cachedEmployees || []).findIndex(e => e.id === empId);
    if (idx !== -1) window._cachedEmployees[idx].owner_notes = notesText;
    showToast('Private notes saved successfully!');
  }
};

window.clearEmployeeMessages = async function(empId) {
  const result = await updateEmployee({ id: empId, employee_msg: '' });
  if (result) {
    const idx = (window._cachedEmployees || []).findIndex(e => e.id === empId);
    if (idx !== -1) window._cachedEmployees[idx].employee_msg = '';
    showToast('Employee messages log cleared!');
    window.showEmployeePerformance(empId);
  }
};

window.sendEmployeeMessageToOwner = async function(empId) {
  const msgInput = document.getElementById('emp-message-input');
  if (!msgInput || !msgInput.value.trim()) {
    showToast('Please type a message first', 'error');
    return;
  }
  
  const emp = (window._cachedEmployees || []).find(e => e.id === empId);
  if (!emp) return;

  const newMsg = msgInput.value.trim();
  const timeStr = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  const updatedLog = (emp.employee_msg || '') + `[${timeStr}] ${newMsg}\n`;
  
  const result = await updateEmployee({ id: empId, employee_msg: updatedLog });
  if (result) {
    const idx = (window._cachedEmployees || []).findIndex(e => e.id === empId);
    if (idx !== -1) window._cachedEmployees[idx].employee_msg = updatedLog;
    showToast('Message sent to Owner! ✉️');
    window.showEmployeePerformance(empId);
  }
};

window.openImageFullScreen = function(imgSrc) {
  const fullScreenModalHtml = `
    <div id="image-fullscreen-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:99999; display:flex; justify-content:center; align-items:center;" onclick="this.remove()">
      <img src="${imgSrc}" style="max-width:95vw; max-height:95vh; object-fit:contain; border-radius:8px; border:1px solid #fff;" />
      <button style="position:absolute; top:20px; right:20px; background:none; border:none; color:#fff; font-size:24px; cursor:pointer;" onclick="document.getElementById('image-fullscreen-overlay').remove()">
        <i class="ti ti-x"></i>
      </button>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', fullScreenModalHtml);
};

window.toggleEditProfile = function(empId) {
  const emp = (window._cachedEmployees || []).find(e => e.id === empId);
  if (!emp) return;

  const isOwner = state.userRole === 'owner';

  const editHtml = `
    <div style="max-height:75vh; overflow-y:auto; padding-right:6px;" class="scrollbar-hide">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid var(--border-gold-subtle, rgba(245,200,66,0.18));">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg, rgba(245,200,66,0.2), rgba(217,119,6,0.1)); border:1px solid rgba(245,200,66,0.3); display:flex; align-items:center; justify-content:center; color:#f5c842; font-size:18px;">
            <i class="ti ti-user-edit"></i>
          </div>
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0;" class="emp-profile-name">
              Edit Profile: ${emp.name}
            </h3>
            <div style="font-size:11.5px; opacity:0.8; font-family:monospace;">ID: ${emp.emp_id || 'Staff'}</div>
          </div>
        </div>
        <button class="btn btn-outline" onclick="window.showEmployeePerformance('${empId}')" style="padding:5px 12px; font-size:11.5px; height:30px; display:inline-flex; align-items:center; gap:4px;">
          <i class="ti ti-arrow-left"></i> Cancel Edit
        </button>
      </div>
      
      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;">Update Profile Photo</label>
        <input type="file" class="form-input" id="edit-emp-photo-file" accept="image/*">
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;">Full Name *</label>
        <input class="form-input" id="edit-emp-name" value="${emp.name || ''}" placeholder="Employee Full Name">
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;">Phone Number</label>
        <input class="form-input" id="edit-emp-phone" value="${emp.phone || ''}" placeholder="10-digit phone" maxlength="10">
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;">Date of Birth</label>
        <input type="date" class="form-input" id="edit-emp-dob" value="${emp.dob || ''}" onclick="try{this.showPicker()}catch(e){}">
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;">Residential Address</label>
        <input class="form-input" id="edit-emp-address" value="${emp.address || ''}" placeholder="Address">
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:14px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600;">Emergency Contact Name</label>
          <input class="form-input" id="edit-emp-emerg-name" value="${emp.emergency_name || ''}" placeholder="Name">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600;">Emergency Contact Number</label>
          <input class="form-input" id="edit-emp-emerg-num" value="${emp.emergency_number || ''}" placeholder="Phone number" maxlength="10">
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:14px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600;">Employment Type</label>
          <select class="form-input form-select" id="edit-emp-type" ${!isOwner ? 'disabled' : ''}>
            <option value="Full Time" ${emp.employment_type === 'Full Time' ? 'selected' : ''}>Full Time</option>
            <option value="Part Time" ${emp.employment_type === 'Part Time' ? 'selected' : ''}>Part Time</option>
            <option value="Intern" ${emp.employment_type === 'Intern' ? 'selected' : ''}>Intern</option>
            <option value="Freelance" ${emp.employment_type === 'Freelance' ? 'selected' : ''}>Freelance</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600;">Status</label>
          <select class="form-input form-select" id="edit-emp-status" ${!isOwner ? 'disabled' : ''}>
            <option value="Active" ${emp.status === 'Active' ? 'selected' : ''}>Active</option>
            <option value="On Leave" ${emp.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
            <option value="Resigned" ${emp.status === 'Resigned' ? 'selected' : ''}>Resigned</option>
            <option value="Terminated" ${emp.status === 'Terminated' ? 'selected' : ''}>Terminated</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600;">Leave Balance</label>
          <input type="number" class="form-input" id="edit-emp-leaves" value="${emp.leave_balance || 0}" ${!isOwner ? 'disabled' : ''}>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:14px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600;">Base Pay Rate (₹) *</label>
          <input type="number" class="form-input" id="edit-emp-rate" value="${emp.base_rate || 0}" ${!isOwner ? 'disabled' : ''}>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600;">Salary Type</label>
          <select class="form-input form-select" id="edit-emp-salary-type" ${!isOwner ? 'disabled' : ''}>
            <option value="monthly" ${emp.salary_type === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="daily" ${emp.salary_type === 'daily' ? 'selected' : ''}>Daily</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600;">Shift Start Time *</label>
          <input type="time" class="form-input" id="edit-emp-shift-start" value="${emp.shift_start || '09:00'}" ${!isOwner ? 'disabled' : ''}>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;">Login Password / PIN *</label>
        <input class="form-input" id="edit-emp-password" value="${emp.password || ''}" placeholder="Login password">
      </div>

      <div class="edit-profile-footer" style="display:flex; gap:12px; margin-top:22px; border-top:1px solid var(--border-gold-subtle, rgba(245,200,66,0.18)); padding-top:16px;">
        <button class="btn btn-outline" onclick="window.showEmployeePerformance('${empId}')" style="flex:1; justify-content:center;">Cancel</button>
        <button class="btn btn-gold" onclick="window.saveEditedProfile('${empId}')" style="flex:1.5; justify-content:center; background:linear-gradient(135deg, #f5c842, #e8a020); color:#1a1005; font-weight:700;">
          <i class="ti ti-device-floppy"></i> Save Profile
        </button>
      </div>
    </div>
  `;

  document.getElementById('modal-body').innerHTML = editHtml;
};

window.saveEditedProfile = async function(empId) {
  const emp = (window._cachedEmployees || []).find(e => e.id === empId);
  if (!emp) return;

  const name = document.getElementById('edit-emp-name').value.trim();
  if (!name) { showToast('Please enter name', 'error'); return; }

  const phone = document.getElementById('edit-emp-phone').value.trim();
  const email = emp.email || '';
  const role = document.getElementById('edit-emp-name').value.trim() ? emp.role : 'Stylist'; // fallback
  const dob = document.getElementById('edit-emp-dob').value || null;
  const address = document.getElementById('edit-emp-address').value.trim();
  const emergency_name = document.getElementById('edit-emp-emerg-name').value.trim();
  const emergency_number = document.getElementById('edit-emp-emerg-num').value.trim();
  const aadhaar_number = emp.aadhaar_number || '';
  const employment_type = document.getElementById('edit-emp-type').value;
  const status = document.getElementById('edit-emp-status').value;
  const leave_balance = parseInt(document.getElementById('edit-emp-leaves').value) || 0;
  const base_rate = parseInt(document.getElementById('edit-emp-rate').value) || 0;
  const salary_type = document.getElementById('edit-emp-salary-type').value;
  const bank_details = emp.bank_details || '';
  const password = document.getElementById('edit-emp-password').value.trim();
  const shift_start = document.getElementById('edit-emp-shift-start').value || '09:00';

  if (!password) { showToast('Password is required', 'error'); return; }

  // Read base64 files
  const photoFile = document.getElementById('edit-emp-photo-file').files[0];

  const readAsBase64 = (file) => {
    return new Promise((resolve) => {
      if (!file) resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  };

  const photo_url = photoFile ? await readAsBase64(photoFile) : emp.photo_url;
  const aadhaar_photo_url = emp.aadhaar_photo_url || '';

  const updatedPayload = {
    id: empId,
    name,
    phone,
    email,
    dob,
    address,
    emergency_name,
    emergency_number,
    aadhaar_number,
    employment_type,
    status,
    leave_balance,
    base_rate,
    salary_type,
    shift_start,
    bank_details,
    password,
    photo_url,
    aadhaar_photo_url
  };

  const result = await updateEmployee(updatedPayload);
  if (result) {
    // Update local cache
    const idx = (window._cachedEmployees || []).findIndex(e => e.id === empId);
    if (idx !== -1) {
      window._cachedEmployees[idx] = { ...window._cachedEmployees[idx], ...updatedPayload };
    }
    showToast('Employee profile updated!');
    window.showEmployeePerformance(empId);
    if (typeof window.render === 'function') window.render();
  }
};
