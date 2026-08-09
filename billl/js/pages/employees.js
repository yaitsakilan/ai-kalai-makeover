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

  return `
  <div class="top-bar">
    <div>
      <h2>Employee Management</h2>
      <p style="font-size:12px;color:#999;margin-top:2px">Manage staff, track check-in/out attendance, and generate monthly payslips</p>
    </div>
    <div style="display:flex; gap:10px;">
      ${window._employeesTab === 'directory' ? `
        <button class="btn btn-gold" onclick="window.openAddEmployeeModal()">
          <i class="ti ti-user-plus"></i> Add Employee
        </button>
      ` : window._employeesTab === 'attendance' ? `
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
      <div class="card" onclick="window.showEmployeePerformance('${emp.id}')" style="display:flex; flex-direction:column; justify-content:space-between; min-height: 240px; cursor:pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#d97706'; this.style.boxShadow='0 8px 24px rgba(217, 119, 6, 0.08)';" onmouseout="this.style.borderColor=''; this.style.boxShadow='';">
        <div style="display:flex; gap:14px; align-items:flex-start;">
          ${emp.photo_url ? `
            <img src="${emp.photo_url}" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:1px solid #d97706; flex-shrink:0;" />
          ` : `
            <div class="avatar ${colors[i % 4]}" style="width:48px; height:48px; font-size:16px;">${initials}</div>
          `}
          <div style="flex:1;">
            <h3 style="font-size:15px; font-weight:600; color:#1a1a1a; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              ${emp.name} 
              <i class="ti ti-chart-bar" style="color:#d97706; font-size:14px;" title="View Performance Dashboard"></i>
            </h3>
            
            <div style="display:flex; flex-direction:column; gap:4px; margin-top:8px; font-size:11.5px; color:#555;">
              <div><i class="ti ti-phone" style="color:#888; font-size:12px;"></i> <strong>Phone:</strong> ${emp.phone || '—'}</div>
              <div><i class="ti ti-calendar" style="color:#888; font-size:12px;"></i> <strong>Joined:</strong> ${emp.joining_date || '—'}</div>
              <div><i class="ti ti-phone-incoming" style="color:#888; font-size:12px;"></i> <strong>Emergency:</strong> ${emp.emergency_name ? `${emp.emergency_name} (${emp.emergency_number || ''})` : (emp.emergency_contact || '—')}</div>
            </div>

            <div style="font-size:12.5px; color:#1a1a1a; font-weight:600; margin-top:10px; border-top: 0.5px dashed #eee; padding-top:8px;">
              Pay Rate: <span style="color:#d97706;">₹${(emp.base_rate || 0).toLocaleString()}</span>
              <span style="font-size:11px; font-weight:400; color:#888;"> / ${emp.salary_type === 'monthly' ? 'month' : 'day'}</span>
            </div>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; border-top:0.5px solid #f5f5f5; padding-top:12px; margin-top:12px;">
          <button class="btn btn-danger btn-icon" onclick="event.stopPropagation(); window.handleDeleteEmployee('${emp.id}')" style="width:32px; height:32px; padding:0; color:#dc2626;" title="Remove Employee">
            <i class="ti ti-trash" style="font-size:14px;"></i>
          </button>
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
  if (!attendance.length) {
    return `<div class="card" style="text-align:center; padding:50px; color:#999;">
      <i class="ti ti-calendar" style="font-size:42px; display:block; margin-bottom:10px; opacity:0.3;"></i>
      No attendance logs found
    </div>`;
  }

  // Filter out invalid records
  const validAttendance = attendance.filter(a => {
    const emp = employees.find(e => e.id === a.employee_id);
    return !!emp;
  });

  return `
  <div class="card" style="padding:0; overflow:hidden;">
    <div style="padding:16px; border-bottom:0.5px solid #f5f5f5; display:flex; justify-content:space-between; align-items:center;">
      <h3 style="font-size:14px; font-weight:600; color:#1a1a1a;">Daily Check-In logs</h3>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
        <thead>
          <tr style="background:#fafafa; border-bottom:0.5px solid #eaeaea; color:#666;">
            <th style="padding:12px 16px; font-weight:500;">Date</th>
            <th style="padding:12px 16px; font-weight:500;">Employee</th>
            <th style="padding:12px 16px; font-weight:500;">Check In</th>
            <th style="padding:12px 16px; font-weight:500;">Check Out</th>
            <th style="padding:12px 16px; font-weight:500;">Hours Logged</th>
            <th style="padding:12px 16px; font-weight:500;">Status</th>
            <th style="padding:12px 16px; font-weight:500; text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${validAttendance.map(a => {
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

            return `
            <tr style="border-bottom:0.5px solid #f5f5f5;">
              <td style="padding:12px 16px; font-weight:500;">${a.date}</td>
              <td style="padding:12px 16px; font-weight:600; color:#1a1a1a;">${emp.name}</td>
              <td style="padding:12px 16px; color:#555;">${inTime}</td>
              <td style="padding:12px 16px; color:#555;">${outTime}</td>
              <td style="padding:12px 16px; color:#666; font-weight:500;">${hoursStr}</td>
              <td style="padding:12px 16px;"><span class="badge ${badgeClass}">${a.status}</span></td>
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
      <h3 style="font-size:14px; font-weight:600; color:#1a1a1a; margin-bottom:14px; border-bottom:0.5px solid #f5f5f5; padding-bottom:8px;">
        <i class="ti ti-calculator" style="color:#d97706; margin-right:4px;"></i> Generate Monthly Payslip
      </h3>
      
      <div class="form-group">
        <label class="form-label">Select Month</label>
        <input type="month" class="form-input" id="payroll-month" value="${window._payrollSelectedMonth}" onchange="window.handlePayrollMonthChange(this.value)">
      </div>

      <div class="form-group">
        <label class="form-label">Select Employee</label>
        <select class="form-input form-select" id="payroll-emp-id" onchange="window.calculatePayrollEstimate()">
          <option value="">-- Choose Staff --</option>
          ${employees.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('')}
        </select>
      </div>

      <!-- Realtime Calculation Estimate Panel -->
      <div id="payroll-estimate-container" style="display:none; margin: 16px 0; padding:14px; background:#faf9f7; border: 0.5px solid #e5e5e5; border-radius:10px;">
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
      <div style="padding:16px; border-bottom:0.5px solid #f5f5f5;">
        <h3 style="font-size:14px; font-weight:600; color:#1a1a1a;">Payslips History</h3>
      </div>
      <div style="overflow-x:auto;">
        ${!payslips.length ? `
          <div style="text-align:center; padding:40px; color:#bbb; font-size:12.5px;">No payslips generated yet</div>
        ` : `
          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
            <thead>
              <tr style="background:#fafafa; border-bottom:0.5px solid #eaeaea; color:#666;">
                <th style="padding:12px 16px; font-weight:500;">Month</th>
                <th style="padding:12px 16px; font-weight:500;">Employee</th>
                <th style="padding:12px 16px; font-weight:500;">Net Salary</th>
                <th style="padding:12px 16px; font-weight:500;">Status</th>
                <th style="padding:12px 16px; font-weight:500; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${payslips.map(p => {
                const emp = employees.find(e => e.id === p.employee_id);
                if (!emp) return '';
                return `
                <tr style="border-bottom:0.5px solid #f5f5f5;">
                  <td style="padding:12px 16px; font-weight:600;">${p.month}</td>
                  <td style="padding:12px 16px;">${emp.name}</td>
                  <td style="padding:12px 16px; font-weight:700; color:#d97706;">₹${(p.net_pay || 0).toLocaleString()}</td>
                  <td style="padding:12px 16px;">
                    <span class="badge ${p.status === 'Paid' ? 'badge-green' : 'badge-amber'}" onclick="window.togglePayslipStatus('${p.id}', '${p.status}')" style="cursor:pointer;" title="Click to toggle status">
                      ${p.status}
                    </span>
                  </td>
                  <td style="padding:12px 16px; text-align:right; display:flex; justify-content:flex-end; gap:6px;">
                    <button class="btn btn-outline" onclick="window.viewPayslipReceipt('${p.id}')" style="padding:4px 8px; font-size:11px; height:28px;">
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

  container.innerHTML = `
    <div style="font-size:12.5px; font-weight:600; color:#1a1a1a; margin-bottom:8px; display:flex; justify-content:space-between;">
      <span>Calculation Breakdown:</span>
      <span style="color:#d97706;">${emp.salary_type === 'monthly' ? 'Monthly Salary' : 'Daily Wage'}</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#555; padding:3px 0;">
      <span>Present Days:</span>
      <strong>${daysPresent} days</strong>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#555; padding:3px 0;">
      <span>Base Pay Rate:</span>
      <strong>₹${(emp.base_rate || 0).toLocaleString()} / ${emp.salary_type === 'monthly' ? 'mo' : 'day'}</strong>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#15803d; padding:3px 0; border-top: 0.5px dashed #ccc; margin-top:4px;">
      <span>Calculated Base Pay:</span>
      <strong>₹${basePay.toLocaleString()}</strong>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#15803d; padding:3px 0;">
      <span>Event Commission Wages:</span>
      <strong>+₹${eventCommissions.toLocaleString()}</strong>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#dc2626; padding:3px 0;">
      <span>Deductions:</span>
      <strong>-₹${manualDeductions.toLocaleString()}</strong>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:13.5px; font-weight:700; color:#7e22ce; padding:6px 0 0; border-top:1px solid #e5e5e5; margin-top:6px;">
      <span>Total Net Salary:</span>
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
      <input type="date" class="form-input" id="ma-date" value="${today}">
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
  `, async () => {
    const employee_id = document.getElementById('ma-emp-id').value;
    const date = document.getElementById('ma-date').value || today;
    const inTime = document.getElementById('ma-checkin').value;
    const outTime = document.getElementById('ma-checkout').value;
    const status = document.getElementById('ma-status').value;

    const check_in = inTime ? `${date}T${inTime}:00` : null;
    const check_out = outTime ? `${date}T${outTime}:00` : null;

    const result = await saveAttendance({
      employee_id,
      date,
      check_in,
      check_out,
      status
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
      <div style="margin-top:12px;font-weight:500;color:#555;">Loading profile details...</div>
    </div>
  `, null);
  
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
        .modal-tab-btn {
          flex: 1 0 auto;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 10px 4px;
          font-size: 11.5px;
          font-weight: 600;
          color: #666;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          white-space: nowrap;
        }
        .modal-tab-btn:hover {
          color: #d97706;
          background: rgba(217, 119, 6, 0.04);
        }
        .modal-tab-btn.active {
          color: #d97706;
          border-bottom-color: #d97706;
        }
        .profile-grid-item {
          display: flex;
          justify-content: space-between;
          border-bottom: 0.5px solid #f5f5f5;
          padding: 8px 0;
          font-size: 12.5px;
        }
        .profile-grid-item span:first-child {
          color: #666;
          font-weight: 500;
        }
        .profile-grid-item span:last-child {
          color: #1a1a1a;
          font-weight: 600;
          text-align: right;
        }

        /* PREMIUM DARK GOLD GLASSMORPHISM OVERRIDES FOR EMPLOYEE THEME */
        #app.employee-mode ~ #modal-container .modal {
          background: rgba(26, 16, 5, 0.98) !important;
          border: 1px solid rgba(245, 200, 66, 0.2) !important;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8) !important;
          color: #fff !important;
        }
        #app.employee-mode ~ #modal-container .modal-overlay {
          background: rgba(0, 0, 0, 0.7) !important;
          backdrop-filter: blur(8px) !important;
        }
        #app.employee-mode ~ #modal-container .modal .profile-header-card {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(245, 200, 66, 0.15) !important;
        }
        #app.employee-mode ~ #modal-container .modal h3,
        #app.employee-mode ~ #modal-container .modal h4,
        #app.employee-mode ~ #modal-container .modal .profile-grid-item span:last-child {
          color: #fff !important;
        }
        #app.employee-mode ~ #modal-container .modal .profile-grid-item {
          border-bottom-color: rgba(245, 200, 66, 0.1) !important;
        }
        #app.employee-mode ~ #modal-container .modal .profile-grid-item span:first-child {
          color: rgba(255, 255, 255, 0.5) !important;
        }
        #app.employee-mode ~ #modal-container .performance-chip {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(245, 200, 66, 0.2) !important;
          color: rgba(255, 255, 255, 0.9) !important;
        }
        #app.employee-mode ~ #modal-container .modal table td,
        #app.employee-mode ~ #modal-container .modal table td div,
        #app.employee-mode ~ #modal-container .modal table th {
          color: rgba(255, 255, 255, 0.8) !important;
        }
        #app.employee-mode ~ #modal-container .modal table tr {
          border-bottom-color: rgba(245, 200, 66, 0.1) !important;
        }
        #app.employee-mode ~ #modal-container .modal h4 {
          border-bottom-color: rgba(245, 200, 66, 0.15) !important;
        }
        #app.employee-mode ~ #modal-container .modal-tab-menu-wrap {
          border-bottom-color: rgba(245, 200, 66, 0.15) !important;
        }
        #app.employee-mode ~ #modal-container .modal-tab-btn {
          color: rgba(255, 255, 255, 0.4) !important;
        }
        #app.employee-mode ~ #modal-container .modal-tab-btn:hover {
          color: #f5c842 !important;
          background: rgba(245, 200, 66, 0.05) !important;
        }
        #app.employee-mode ~ #modal-container .modal-tab-btn.active {
          color: #f5c842 !important;
          border-bottom-color: #f5c842 !important;
        }
        #app.employee-mode ~ #modal-container .edit-profile-header {
          border-bottom-color: rgba(245, 200, 66, 0.15) !important;
          color: #f5c842 !important;
        }
        #app.employee-mode ~ #modal-container .edit-profile-footer {
          border-top-color: rgba(245, 200, 66, 0.15) !important;
        }
        #app.employee-mode ~ #modal-container .form-label {
          color: rgba(255, 255, 255, 0.7) !important;
        }
        #app.employee-mode ~ #modal-container .form-input {
          background: rgba(26, 16, 5, 0.6) !important;
          border: 1px solid rgba(245, 200, 66, 0.2) !important;
          color: #fff !important;
        }
        #app.employee-mode ~ #modal-container .form-input:focus {
          border-color: #f5c842 !important;
          box-shadow: 0 0 0 2px rgba(245, 200, 66, 0.15) !important;
        }
        #app.employee-mode ~ #modal-container .form-input:disabled {
          background: rgba(255, 255, 255, 0.02) !important;
          border-color: rgba(255, 255, 255, 0.05) !important;
          color: rgba(255, 255, 255, 0.35) !important;
        }
        #app.employee-mode ~ #modal-container .btn-outline {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(245, 200, 66, 0.15) !important;
          color: rgba(255, 255, 255, 0.8) !important;
        }
        #app.employee-mode ~ #modal-container .btn-outline:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        #app.employee-mode ~ #modal-container .modal-close-icon {
          color: rgba(255, 255, 255, 0.4) !important;
        }
      </style>
    `;

    const bodyHtml = `
      ${styles}
      <div style="max-height:75vh; overflow-y:auto; padding-right:4px;" class="scrollbar-hide">
        
        <!-- Header Profile Card -->
        <div class="profile-header-card" style="display:flex; gap:16px; align-items:center; background:#faf9f6; border:1px solid #e5e5e5; padding:16px; border-radius:12px; margin-bottom:16px;">
          ${photoUrl ? `
            <img src="${photoUrl}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #d97706;" />
          ` : `
            <div class="avatar ${colors[empIndex >= 0 ? empIndex % 4 : 0]}" style="width:60px; height:60px; font-size:18px; font-weight:700; flex-shrink:0;">${initials}</div>
          `}
          <div style="flex:1; min-width:0;">
            <h3 style="font-size:17px; font-weight:700; color:#1a1a1a; margin:0 0 2px 0;">${emp.name}</h3>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:4px;">
              <span class="badge ${emp.status === 'Active' ? 'badge-green' : emp.status === 'On Leave' ? 'badge-amber' : 'badge-red'}" style="font-size:9.5px; padding:2px 8px;">
                ${emp.status || 'Active'}
              </span>
              <span style="font-size:11px; color:#888; font-weight:600;">ID: ${emp.emp_id || 'kalai-emp-XX'}</span>
            </div>
          </div>
          ${isOwner ? `
            <button class="btn btn-outline" onclick="window.toggleEditProfile('${empId}')" style="padding:6px 12px; font-size:11.5px; height:32px;">
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
        <div class="modal-tab-menu-wrap" style="display:flex; border-bottom:1px solid #eaeaea; margin-bottom:16px; overflow-x:auto;">
          <button class="modal-tab-btn active" data-tab="profile" onclick="window.switchModalTab('profile')">👤 Profile</button>
          <button class="modal-tab-btn" data-tab="employment" onclick="window.switchModalTab('employment')">💼 Employment</button>
          <button class="modal-tab-btn" data-tab="attendance" onclick="window.switchModalTab('attendance')">📅 Attendance</button>
          <button class="modal-tab-btn" data-tab="performance" onclick="window.switchModalTab('performance')">📈 Performance</button>
          <button class="modal-tab-btn" data-tab="payslips" onclick="window.switchModalTab('payslips')">💵 Payslips</button>
          <button class="modal-tab-btn" data-tab="notes" onclick="window.switchModalTab('notes')">💬 Notes &amp; Messages</button>
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
            <div class="profile-grid-item"><span>Employee Status</span><span>${emp.status || 'Active'}</span></div>
            <div class="profile-grid-item"><span>Leave Balance</span><span>${emp.leave_balance || 0} Days</span></div>
            <div class="profile-grid-item"><span>Salary/Wage Basis</span><span>${emp.salary_type === 'monthly' ? 'Monthly Salary' : 'Daily Wages'}</span></div>
            <div class="profile-grid-item"><span>Base Pay Rate</span><span style="color:#b45309;">₹${(emp.base_rate || 0).toLocaleString()} / ${emp.salary_type === 'monthly' ? 'month' : 'day'}</span></div>
            <div class="profile-grid-item" style="border-bottom:none;"><span>Shift Start Time</span><span>${emp.shift_start || '09:00'}</span></div>
          </div>
        </div>

        <!-- Tab 3: Attendance Pane -->
        <div id="tab-pane-attendance" class="modal-tab-pane" style="display:none;">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:16px;">
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:8px; text-align:center;">
              <div style="font-size:10px; color:#166534; font-weight:600; text-transform:uppercase;">Present Days</div>
              <div style="font-size:17px; font-weight:700; color:#14532d; margin-top:2px;">${daysPresent}</div>
            </div>
            <div style="background:#fffbeb; border:1px solid #fde68a; padding:10px; border-radius:8px; text-align:center;">
              <div style="font-size:10px; color:#92400e; font-weight:600; text-transform:uppercase;">Late Entries</div>
              <div style="font-size:17px; font-weight:700; color:#78350f; margin-top:2px;">${lateEntries}</div>
            </div>
            <div style="background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px; text-align:center;">
              <div style="font-size:10px; color:#991b1b; font-weight:600; text-transform:uppercase;">Absent Days</div>
              <div style="font-size:17px; font-weight:700; color:#7f1d1d; margin-top:2px;">${daysAbsent}</div>
            </div>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:10px; border-radius:8px; text-align:center;">
              <div style="font-size:10px; color:#1e40af; font-weight:600; text-transform:uppercase;">Total Hours</div>
              <div style="font-size:17px; font-weight:700; color:#1e3a8a; margin-top:2px;">${formattedHours}h</div>
            </div>
          </div>



          <h4 style="font-size:12.5px; font-weight:600; color:#1a1a1a; margin-bottom:8px; border-bottom:0.5px solid #eee; padding-bottom:4px;">Recent Shift History</h4>
          ${empAttendance.length === 0 ? `
            <div style="font-size:11px; color:#999; text-align:center; padding:10px 0;">No shifts recorded.</div>
          ` : `
            <table style="width:100%; font-size:12px; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="border-bottom:1px solid #eee; color:#666;">
                  <th style="padding:6px 0;">Date</th>
                  <th style="padding:6px 0;">Check In</th>
                  <th style="padding:6px 0;">Check Out</th>
                  <th style="padding:6px 0; text-align:right;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${empAttendance.slice(0, 5).map(a => `
                  <tr style="border-bottom:0.5px solid #f5f5f5;">
                    <td style="padding:6px 0; font-weight:500;">${a.date}</td>
                    <td style="padding:6px 0; color:#555;">${a.check_in ? new Date(a.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style="padding:6px 0; color:#555;">${a.check_out ? new Date(a.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style="padding:6px 0; text-align:right;"><span class="badge ${a.status === 'Present' ? 'badge-green' : a.status === 'Late' ? 'badge-amber' : a.status === 'Half-day' ? 'badge-blue' : 'badge-red'}" style="font-size:9px; padding:1px 5px;">${a.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- Tab 4: Performance Pane -->
        <div id="tab-pane-performance" class="modal-tab-pane" style="display:none;">
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-bottom:16px;">
            <div style="background:#faf5ff; border:1px solid #f3e8ff; padding:12px; border-radius:8px; text-align:center;">
              <div style="font-size:10px; color:#6b21a8; font-weight:600; text-transform:uppercase;">Customers Served</div>
              <div style="font-size:22px; font-weight:700; color:#581c87; margin-top:2px;">${customersServed}</div>
            </div>
            <div style="background:#fffbeb; border:1px solid #fef3c7; padding:12px; border-radius:8px; text-align:center;">
              <div style="font-size:10px; color:#b45309; font-weight:600; text-transform:uppercase;">Average Customer Rating</div>
              <div style="font-size:22px; font-weight:700; color:#78350f; margin-top:2px; display:flex; align-items:center; justify-content:center; gap:4px;">
                ${avgRating} <span style="color:#d97706; font-size:18px;">★</span>
              </div>
            </div>
            <div style="background:#ecfeff; border:1px solid #cffafe; padding:12px; border-radius:8px; text-align:center; grid-column: span 2;">
              <div style="font-size:10px; color:#0e7490; font-weight:600; text-transform:uppercase;">Total Revenue Generated</div>
              <div style="font-size:24px; font-weight:800; color:#155e75; margin-top:2px;">₹${totalRevenue.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <h4 style="font-size:12.5px; font-weight:600; color:#1a1a1a; margin-bottom:8px; border-bottom:0.5px solid #eee; padding-bottom:4px;">Services Breakdown</h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
            <span class="performance-chip" style="background:#fafafa; border:1px solid #eaeaea; padding:4px 10px; border-radius:15px; font-size:11.5px;">Customers: <strong>${empCounts.customers}</strong></span>
            <span class="performance-chip" style="background:#fafafa; border:1px solid #eaeaea; padding:4px 10px; border-radius:15px; font-size:11.5px;">Events Booked: <strong>${empCounts.events}</strong></span>
            <span class="performance-chip" style="background:#fafafa; border:1px solid #eaeaea; padding:4px 10px; border-radius:15px; font-size:11.5px;">Expenses Logged: <strong>${empCounts.expenses}</strong></span>
            <span class="performance-chip" style="background:#fafafa; border:1px solid #eaeaea; padding:4px 10px; border-radius:15px; font-size:11.5px;">Students Registered: <strong>${empCounts.students}</strong></span>
            <span class="performance-chip" style="background:#fafafa; border:1px solid #eaeaea; padding:4px 10px; border-radius:15px; font-size:11.5px;">Jewel Purchases: <strong>${empCounts.jewels}</strong></span>
          </div>

          <h4 style="font-size:12.5px; font-weight:600; color:#1a1a1a; margin-bottom:8px; border-bottom:0.5px solid #eee; padding-bottom:4px;">Recent Customer Entries</h4>
          ${empCustomers.length === 0 ? `
            <div style="font-size:11px; color:#999; text-align:center; padding:10px 0;">No client entries logged.</div>
          ` : `
            <table style="width:100%; font-size:11.5px; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="border-bottom:1px solid #eee; color:#666;">
                  <th style="padding:6px 0;">Customer / Services</th>
                  <th style="padding:6px 0;">Amount</th>
                  <th style="padding:6px 0; text-align:right;">Rating</th>
                </tr>
              </thead>
              <tbody>
                ${empCustomers.slice(0, 5).map(c => `
                  <tr style="border-bottom:0.5px solid #f5f5f5;">
                    <td style="padding:6px 0; font-weight:500;">
                      <div style="color:#1a1a1a; font-weight:600;">${c.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim()}</div>
                      <div style="font-size:10px; color:#666; margin-top:2px;">${Array.isArray(c.services) ? c.services.join(', ') : (c.services || 'Service')}</div>
                    </td>
                    <td style="padding:6px 0; color:#1a1a1a; font-weight:700;">₹${(c.amount || c.total_spend || 0).toLocaleString()}</td>
                    <td style="padding:6px 0; text-align:right; color:#d97706;">
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
          <h4 style="font-size:12.5px; font-weight:600; color:#1a1a1a; margin-bottom:12px; border-bottom:0.5px solid #eee; padding-bottom:6px;">Salary Payslip History</h4>
          ${empPayslips.length === 0 ? `
            <div style="font-size:12.5px; color:#999; text-align:center; padding:20px 0;">
              <i class="ti ti-file-x" style="font-size:24px; display:block; margin-bottom:8px; opacity:0.5;"></i>
              No payslips generated for this employee yet.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${empPayslips.map(p => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#fafafa; border:0.5px solid #eaeaea; padding:10px 14px; border-radius:10px;">
                  <div>
                    <div style="font-size:13px; font-weight:600; color:#1a1a1a;">${p.month}</div>
                    <div style="font-size:11.5px; color:#555; margin-top:2px;">Net Pay: <strong>₹${(p.net_pay || 0).toLocaleString()}</strong></div>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge ${p.status === 'Paid' ? 'badge-green' : 'badge-amber'}" style="font-size:9.5px; padding:2px 6px;">${p.status}</span>
                    <button class="btn btn-outline" onclick="window.viewPayslipReceipt('${p.id}')" style="padding:4px 8px; font-size:10.5px; height:26px;">
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
            <div style="background:#fffbeb; border:1px solid #fcd34d; border-radius:10px; padding:14px; margin-bottom:16px;">
              <h4 style="font-size:13px; font-weight:700; color:#78350f; margin:0 0 10px 0; display:flex; align-items:center; gap:4px;">
                <i class="ti ti-lock" style="font-size:14px;"></i> Owner Private Notes (Owner Only)
              </h4>
              <textarea id="owner-notes-textarea" class="form-input" style="width:100%; height:120px; font-size:12.5px; border-color:#fcd34d; font-family:inherit; padding:8px; resize:none;" placeholder="Type confidential notes about employee performance, reviews, leaves, etc.">${emp.owner_notes || ''}</textarea>
              <button class="btn btn-gold" onclick="window.saveOwnerNotes('${empId}')" style="margin-top:10px; background:#d97706; border:none; height:32px; padding:0 12px; font-size:12px; color:#fff;">
                Save Private Notes
              </button>
            </div>
            
            <!-- MESSAGES RECEIVED FROM EMPLOYEE -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
              <h4 style="font-size:13px; font-weight:700; color:#334155; margin:0 0 10px 0; display:flex; align-items:center; justify-content:space-between; width:100%;">
                <span><i class="ti ti-message" style="color:#d97706; margin-right:4px;"></i> Suggestions &amp; Alerts from Employee</span>
                ${emp.employee_msg ? `
                  <button onclick="window.clearEmployeeMessages('${empId}')" style="background:none; border:none; color:#dc2626; font-size:10.5px; font-weight:600; cursor:pointer;">Clear Log</button>
                ` : ''}
              </h4>
              ${emp.employee_msg ? `
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; max-height:150px; overflow-y:auto; font-size:12px; font-family:'Courier New', monospace; white-space:pre-wrap; line-height:1.4;">${emp.employee_msg}</div>
              ` : `
                <div style="text-align:center; padding:15px; color:#64748b; font-size:11.5px; font-style:italic;">No suggestions received from employee yet.</div>
              `}
            </div>
          ` : `
            <!-- EMPLOYEE MESSAGES TO OWNER -->
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px; margin-bottom:16px;">
              <h4 style="font-size:13px; font-weight:700; color:#1e40af; margin:0 0 8px 0; display:flex; align-items:center; gap:4px;">
                <i class="ti ti-send"></i> Send Suggestion / Message to Owner
              </h4>
              <p style="font-size:11px; color:#555; margin:0 0 10px 0;">Alert the owner about customer updates, feedback, or scheduling queries.</p>
              <textarea id="emp-message-input" class="form-input" style="width:100%; height:80px; font-size:12.5px; border-color:#bfdbfe; font-family:inherit; padding:8px; resize:none;" placeholder="e.g. Meena customer told she will meet you tomorrow at 4 PM..."></textarea>
              <button class="btn btn-gold" onclick="window.sendEmployeeMessageToOwner('${empId}')" style="margin-top:10px; background:#1d4ed8; border:none; height:32px; padding:0 12px; font-size:12px; color:#fff;">
                Send Message
              </button>
            </div>

            <!-- LOG OF PREVIOUS SENT MESSAGES -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
              <h4 style="font-size:13px; font-weight:700; color:#334155; margin:0 0 10px 0;"><i class="ti ti-history"></i> Your Message Log</h4>
              ${emp.employee_msg ? `
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; max-height:150px; overflow-y:auto; font-size:12px; font-family:'Courier New', monospace; white-space:pre-wrap; line-height:1.4;">${emp.employee_msg}</div>
              ` : `
                <div style="text-align:center; padding:15px; color:#64748b; font-size:11.5px; font-style:italic;">No messages sent yet.</div>
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
      <h3 class="edit-profile-header" style="font-size:15px; font-weight:700; color:#1a1a1a; margin-bottom:16px; border-bottom:1px solid #eee; padding-bottom:6px;">
        <i class="ti ti-edit"></i> Edit Employee Profile: ${emp.name}
      </h3>
      
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label" style="font-weight:600;">Update Profile Photo</label>
        <input type="file" class="form-input" id="edit-emp-photo-file" accept="image/*">
      </div>

      <div class="form-group">
        <label class="form-label" style="font-weight:600;">Full Name *</label>
        <input class="form-input" id="edit-emp-name" value="${emp.name || ''}" placeholder="Employee Full Name">
      </div>

      <div class="form-group">
        <label class="form-label" style="font-weight:600;">Phone Number</label>
        <input class="form-input" id="edit-emp-phone" value="${emp.phone || ''}" placeholder="10-digit phone" maxlength="10">
      </div>

      <div class="form-group">
        <label class="form-label" style="font-weight:600;">Date of Birth</label>
        <input type="date" class="form-input" id="edit-emp-dob" value="${emp.dob || ''}">
      </div>

      <div class="form-group">
        <label class="form-label" style="font-weight:600;">Residential Address</label>
        <input class="form-input" id="edit-emp-address" value="${emp.address || ''}" placeholder="Address">
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Emergency Contact Name</label>
          <input class="form-input" id="edit-emp-emerg-name" value="${emp.emergency_name || ''}" placeholder="Name">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Emergency Contact Number</label>
          <input class="form-input" id="edit-emp-emerg-num" value="${emp.emergency_number || ''}" placeholder="Phone number" maxlength="10">
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Employment Type</label>
          <select class="form-input form-select" id="edit-emp-type" ${!isOwner ? 'disabled' : ''}>
            <option value="Full Time" ${emp.employment_type === 'Full Time' ? 'selected' : ''}>Full Time</option>
            <option value="Part Time" ${emp.employment_type === 'Part Time' ? 'selected' : ''}>Part Time</option>
            <option value="Intern" ${emp.employment_type === 'Intern' ? 'selected' : ''}>Intern</option>
            <option value="Freelance" ${emp.employment_type === 'Freelance' ? 'selected' : ''}>Freelance</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Status</label>
          <select class="form-input form-select" id="edit-emp-status" ${!isOwner ? 'disabled' : ''}>
            <option value="Active" ${emp.status === 'Active' ? 'selected' : ''}>Active</option>
            <option value="On Leave" ${emp.status === 'On Leave' ? 'selected' : ''}>On Leave</option>
            <option value="Resigned" ${emp.status === 'Resigned' ? 'selected' : ''}>Resigned</option>
            <option value="Terminated" ${emp.status === 'Terminated' ? 'selected' : ''}>Terminated</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Leave Balance</label>
          <input type="number" class="form-input" id="edit-emp-leaves" value="${emp.leave_balance || 0}" ${!isOwner ? 'disabled' : ''}>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Base Pay Rate (₹) *</label>
          <input type="number" class="form-input" id="edit-emp-rate" value="${emp.base_rate || 0}" ${!isOwner ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Salary Type</label>
          <select class="form-input form-select" id="edit-emp-salary-type" ${!isOwner ? 'disabled' : ''}>
            <option value="monthly" ${emp.salary_type === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="daily" ${emp.salary_type === 'daily' ? 'selected' : ''}>Daily</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Shift Start Time *</label>
          <input type="time" class="form-input" id="edit-emp-shift-start" value="${emp.shift_start || '09:00'}" ${!isOwner ? 'disabled' : ''}>
        </div>
      </div>



      <div class="form-group">
        <label class="form-label" style="font-weight:600;">Login Password / PIN *</label>
        <input class="form-input" id="edit-emp-password" value="${emp.password || ''}" placeholder="Login password">
      </div>

      <div class="edit-profile-footer" style="display:flex; gap:10px; margin-top:20px; border-top:1px solid #eee; padding-top:14px;">
        <button class="btn btn-outline" onclick="window.showEmployeePerformance('${empId}')" style="flex:1;">Cancel</button>
        <button class="btn btn-gold" onclick="window.saveEditedProfile('${empId}')" style="flex:1; background:#d97706; color:#fff; border:none;">Save Profile</button>
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
