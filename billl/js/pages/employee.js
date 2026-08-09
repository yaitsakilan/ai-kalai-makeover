// billl/js/pages/employee.js
// Role & PIN system — Owner (kalai123) / Employee (emp123)

import { state } from '../state.js';
import { 
  fetchCustomers, 
  fetchEvents, 
  fetchExpenses, 
  fetchClassEnrollments, 
  fetchJewels,
  fetchEmployees,
  fetchAttendance,
  fetchPayslips,
  saveAttendance
} from '../db.js';
import { showToast, showModal, closeModal } from '../ui.js';
const PINS = { owner: 'kalai1610', employee: 'emp123' };

// ─────────────────────────────────────────────
//  ROLE SELECTOR OVERLAY (shown on every load)
// ─────────────────────────────────────────────

export function renderRoleSelector() {
  return `
  <div id="role-selector-overlay" class="role-selector-overlay">
    <div class="role-selector-card" id="role-selector-card">

      <!-- STEP 1: Choose role -->
      <div id="rsc-step-role">
        <div class="role-selector-logo">
          <div class="rsl-emoji">✨</div>
          <h1 class="rsl-title">Kalai Makeover</h1>
          <p class="rsl-sub">AI Business Assistant</p>
        </div>
        <div class="role-selector-title">Welcome! Who are you?</div>
        <p class="role-selector-sub">Select your role to continue</p>
        <div class="role-options">
          <button class="role-option role-owner" onclick="window._rscShowPin('owner')" id="select-owner-btn">
            <div class="role-option-icon"><i class="ti ti-crown"></i></div>
            <div class="role-option-text">
              <div class="role-option-label">Owner</div>
              <div class="role-option-sub">Full access — all features</div>
            </div>
            <i class="ti ti-chevron-right role-option-arrow"></i>
          </button>
          <button class="role-option role-employee" onclick="window._rscShowPin('employee')" id="select-employee-btn">
            <div class="role-option-icon"><i class="ti ti-user-circle"></i></div>
            <div class="role-option-text">
              <div class="role-option-label">Employee</div>
              <div class="role-option-sub">Add customers &amp; classes only</div>
            </div>
            <i class="ti ti-chevron-right role-option-arrow"></i>
          </button>
        </div>
      </div>

      <!-- STEP 2: Enter PIN (hidden by default) -->
      <div id="rsc-step-pin" style="display:none">
        <button class="pin-back-btn" onclick="window._rscBackToRole()" id="pin-back-btn">
          <i class="ti ti-arrow-left"></i> Back
        </button>
        <div class="pin-role-badge" id="pin-role-badge"></div>
        <div class="pin-title" id="pin-title">Enter your PIN</div>
        <div class="pin-sub" id="pin-sub">Enter the PIN to access this mode</div>

        <div class="pin-input-wrap">
          <i class="ti ti-lock pin-input-icon"></i>
          <input
            type="password"
            id="pin-input-field"
            class="pin-input-field"
            placeholder="Enter PIN"
            maxlength="20"
            autocomplete="off"
            onkeydown="window._rscPinKeydown(event)"
            oninput="window._rscClearError()"
          >
          <button class="pin-toggle-btn" onclick="window._rscTogglePinVis(this)" title="Show/hide PIN">
            <i class="ti ti-eye-off"></i>
          </button>
        </div>

        <div class="pin-error-msg" id="pin-error-msg" style="display:none">
          <i class="ti ti-alert-circle"></i> Incorrect PIN. Please try again.
        </div>

        <button class="pin-submit-btn" onclick="window._rscSubmitPin()" id="pin-submit-btn">
          <i class="ti ti-lock-open"></i> Unlock
        </button>
      </div>

    </div>
  </div>`;
}

// ─────────────────────────────────────────────
//  ROLE SELECTOR LOGIC
// ─────────────────────────────────────────────

let _pendingRole = null;

window._rscShowPin = function(role) {
  _pendingRole = role;
  const stepRole = document.getElementById('rsc-step-role');
  const stepPin  = document.getElementById('rsc-step-pin');
  const badge    = document.getElementById('pin-role-badge');
  const title    = document.getElementById('pin-title');
  const sub      = document.getElementById('pin-sub');
  const inp      = document.getElementById('pin-input-field');

  if (role === 'owner') {
    badge.innerHTML = '<i class="ti ti-crown"></i> Owner';
    badge.className = 'pin-role-badge pin-badge-owner';
    title.textContent = 'Enter Owner PIN';
    sub.textContent = 'Enter the PIN to access Owner Mode';
    if (inp) inp.placeholder = 'Enter PIN';
  } else {
    badge.innerHTML = '<i class="ti ti-user-circle"></i> Employee';
    badge.className = 'pin-role-badge pin-badge-employee';
    title.textContent = 'Enter Employee Password';
    sub.textContent = 'Enter your unique password to access your dashboard';
    if (inp) inp.placeholder = 'Enter Password';
  }

  // Slide transition
  stepRole.style.animation = 'slideOutLeft 0.25s ease forwards';
  setTimeout(() => {
    stepRole.style.display = 'none';
    stepPin.style.display  = 'block';
    stepPin.style.animation = 'slideInRight 0.25s ease forwards';
    const inp = document.getElementById('pin-input-field');
    if (inp) { inp.value = ''; inp.focus(); }
    const err = document.getElementById('pin-error-msg');
    if (err) err.style.display = 'none';
  }, 230);
};

window._rscBackToRole = function() {
  _pendingRole = null;
  const stepRole = document.getElementById('rsc-step-role');
  const stepPin  = document.getElementById('rsc-step-pin');
  stepPin.style.animation = 'slideOutRight 0.25s ease forwards';
  setTimeout(() => {
    stepPin.style.display  = 'none';
    stepRole.style.display = 'block';
    stepRole.style.animation = 'slideInLeft 0.25s ease forwards';
  }, 230);
};

window._rscPinKeydown = function(e) {
  if (e.key === 'Enter') window._rscSubmitPin();
};

window._rscClearError = function() {
  const err = document.getElementById('pin-error-msg');
  if (err) err.style.display = 'none';
  const inp = document.getElementById('pin-input-field');
  if (inp) inp.classList.remove('pin-input-error');
};

window._rscTogglePinVis = function(btn) {
  const inp = document.getElementById('pin-input-field');
  if (!inp) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  btn.querySelector('i').className = isPass ? 'ti ti-eye' : 'ti ti-eye-off';
};

window._rscSubmitPin = async function() {
  const inp = document.getElementById('pin-input-field');
  if (!inp || !_pendingRole) return;
  const val = inp.value.trim();

  if (_pendingRole === 'owner') {
    if (val === PINS.owner) {
      const overlay = document.getElementById('role-selector-overlay');
      if (overlay) {
        overlay.style.animation = 'roleFadeOut 0.35s ease forwards';
        setTimeout(() => overlay.remove(), 340);
      }
      enterRole('owner');
    } else {
      showPinError(inp);
    }
  } else {
    // Employee mode — verify password dynamically
    try {
      const employees = await fetchEmployees();
      const match = employees.find(e => e.password && e.password.trim().toLowerCase() === val.toLowerCase());
      if (match) {
        window._selectedPortalEmployeeId = match.id;
        const overlay = document.getElementById('role-selector-overlay');
        if (overlay) {
          overlay.style.animation = 'roleFadeOut 0.35s ease forwards';
          setTimeout(() => overlay.remove(), 340);
        }
        enterRole('employee', match.name);
      } else {
        showPinError(inp, 'Incorrect employee password. Please try again.');
      }
    } catch (err) {
      console.error(err);
      showPinError(inp, 'Failed to connect. Please try again.');
    }
  }
};

function showPinError(inp, customMsg) {
  inp.classList.add('pin-input-error');
  const err = document.getElementById('pin-error-msg');
  if (err) {
    err.style.display = 'flex';
    err.innerHTML = `<i class="ti ti-alert-circle"></i> ${customMsg || 'Incorrect PIN. Please try again.'}`;
  }
  const card = document.getElementById('role-selector-card');
  if (card) { 
    card.classList.add('shake'); 
    setTimeout(() => card.classList.remove('shake'), 500); 
  }
  inp.value = '';
  inp.focus();
}

// ─────────────────────────────────────────────
//  ENTER ROLE (after correct PIN)
// ─────────────────────────────────────────────

export function enterRole(role, empName = null) {
  state.userRole = role;
  applyRoleLayout(role);
  if (typeof window.render === 'function') window.render();
  const msg = role === 'owner' 
    ? 'Welcome back, Kalai! 👑' 
    : `Welcome back, ${empName || 'Employee'}! 👋`;
  if (typeof window.showToast === 'function') window.showToast(msg, 'success');
}

export function applyRoleLayout(role) {
  const app = document.getElementById('app');
  if (!app) return;
  if (role === 'employee') {
    app.classList.add('employee-mode');
    state.currentPage = 'employee';
  } else {
    app.classList.remove('employee-mode');
    if (state.currentPage === 'employee') state.currentPage = 'dashboard';
    // Update sidebar label
    const lbl = document.getElementById('sidebar-role-label');
    const name = document.getElementById('sidebar-user-name');
    if (lbl) lbl.textContent = 'Parlour Owner';
    if (name) name.textContent = 'Kalai';
  }
}

// ─────────────────────────────────────────────
//  IN-APP SWITCH MODAL (PIN re-verification)
// ─────────────────────────────────────────────

export function openSwitchModal(toRole) {
  // Remove any existing switch modal
  const existing = document.getElementById('switch-role-modal');
  if (existing) existing.remove();

  const label = toRole === 'owner' ? 'Owner' : 'Employee';
  const icon  = toRole === 'owner' ? 'ti-crown' : 'ti-user-circle';
  const color = toRole === 'owner' ? '#f5c842' : '#818cf8';
  const inputPlaceholder = toRole === 'owner' ? 'Enter PIN' : 'Enter Password';
  const subText = toRole === 'owner' ? 'Enter the Owner PIN to continue' : 'Enter your unique Employee Password to continue';

  const html = `
  <div id="switch-role-modal" class="switch-modal-overlay" onclick="window._closeSwitchModal(event)">
    <div class="switch-modal-card" id="switch-modal-card">
      <button class="switch-modal-close" onclick="window.closeSwitchModal()">
        <i class="ti ti-x"></i>
      </button>
      <div class="switch-modal-icon" style="background:${color}22;color:${color}">
        <i class="ti ${icon}"></i>
      </div>
      <div class="switch-modal-title">Switch to ${label}</div>
      <div class="switch-modal-sub">${subText}</div>

      <div class="pin-input-wrap" style="margin-top:20px">
        <i class="ti ti-lock pin-input-icon"></i>
        <input
          type="password"
          id="switch-pin-input"
          class="pin-input-field"
          placeholder="${inputPlaceholder}"
          maxlength="20"
          autocomplete="off"
          onkeydown="if(event.key==='Enter') window._submitSwitchPin('${toRole}')"
          oninput="document.getElementById('switch-pin-error').style.display='none'; this.classList.remove('pin-input-error')"
        >
        <button class="pin-toggle-btn" onclick="window._toggleSwitchPinVis(this)">
          <i class="ti ti-eye-off"></i>
        </button>
      </div>

      <div class="pin-error-msg" id="switch-pin-error" style="display:none;margin-top:10px">
        <i class="ti ti-alert-circle"></i> Incorrect PIN. Try again.
      </div>

      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="switch-cancel-btn" onclick="window.closeSwitchModal()">Cancel</button>
        <button class="switch-confirm-btn" style="border-color:${color};color:${color}" onclick="window._submitSwitchPin('${toRole}')">
          <i class="ti ti-lock-open"></i> Switch
        </button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(() => {
    const inp = document.getElementById('switch-pin-input');
    if (inp) inp.focus();
  }, 100);
}

window._closeSwitchModal = function(e) {
  if (e.target.id === 'switch-role-modal') window.closeSwitchModal();
};

window.closeSwitchModal = function() {
  const m = document.getElementById('switch-role-modal');
  if (m) {
    m.style.animation = 'roleFadeOut 0.25s ease forwards';
    setTimeout(() => m.remove(), 250);
  }
};

window._toggleSwitchPinVis = function(btn) {
  const inp = document.getElementById('switch-pin-input');
  if (!inp) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  btn.querySelector('i').className = isPass ? 'ti ti-eye' : 'ti ti-eye-off';
};

window._submitSwitchPin = async function(toRole) {
  const inp = document.getElementById('switch-pin-input');
  if (!inp) return;
  const val = inp.value.trim();

  if (toRole === 'owner') {
    if (val === PINS.owner) {
      window.closeSwitchModal();
      setTimeout(() => {
        enterRole('owner');
        if (typeof window.showToast === 'function') window.showToast('Switched to Owner mode 👑', 'success');
      }, 260);
    } else {
      showSwitchPinError(inp);
    }
  } else {
    // Switch to Employee Mode
    try {
      const employees = await fetchEmployees();
      const match = employees.find(e => e.password && e.password.trim().toLowerCase() === val.toLowerCase());
      if (match) {
        window._selectedPortalEmployeeId = match.id;
        window.closeSwitchModal();
        setTimeout(() => {
          enterRole('employee', match.name);
        }, 260);
      } else {
        showSwitchPinError(inp, 'Incorrect employee password. Try again.');
      }
    } catch(err) {
      showSwitchPinError(inp, 'Error verifying password.');
    }
  }
};

function showSwitchPinError(inp, customMsg) {
  inp.classList.add('pin-input-error');
  const err = document.getElementById('switch-pin-error');
  if (err) {
    err.style.display = 'flex';
    err.innerHTML = `<i class="ti ti-alert-circle"></i> ${customMsg || 'Incorrect PIN. Try again.'}`;
  }
  const card = document.getElementById('switch-modal-card');
  if (card) { card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 500); }
  inp.value = '';
  inp.focus();
}

window._logoutEmployee = function() {
  window._selectedPortalEmployeeId = null;
  state.userRole = null;
  applyRoleLayout(null);
  // Re-insert role selector overlay
  const overlay = document.getElementById('role-selector-overlay');
  if (overlay) overlay.remove();
  document.body.insertAdjacentHTML('beforeend', renderRoleSelector());
  if (typeof window.render === 'function') window.render();
};

// ─────────────────────────────────────────────
//  EMPLOYEE PAGE RENDER
// ─────────────────────────────────────────────

export async function renderEmployeePage() {
  const [customers, events, expenses, students, jewels, employees, attendance, payslips] = await Promise.all([
    fetchCustomers().catch(() => []),
    fetchEvents().catch(() => []),
    fetchExpenses().catch(() => []),
    fetchClassEnrollments().catch(() => []),
    fetchJewels().catch(() => []),
    fetchEmployees().catch(() => []),
    fetchAttendance().catch(() => []),
    fetchPayslips().catch(() => [])
  ]);

  window._cachedAttendance = attendance;
  window._cachedPayslips = payslips;
  window._cachedEmployees = employees;
  window._cachedCustomers = customers;
  window._cachedEvents = events;
  window._cachedExpenses = expenses;
  window._cachedStudents = students;
  window._cachedJewels = jewels;

  const selectedEmp = window._selectedPortalEmployeeId 
    ? employees.find(e => e.id === window._selectedPortalEmployeeId)
    : null;

  let selectedEmpName = null;
  if (selectedEmp) {
    selectedEmpName = selectedEmp.name.toLowerCase();
  }

  const isEmpContribution = (val) => {
    if (!val) return false;
    const valLower = val.toLowerCase();
    const match = valLower.match(/\[emp(?::\s*([^\]]+))?\]/);
    if (!match) return false;
    if (selectedEmpName) {
      const nameInTag = match[1] ? match[1].trim() : '';
      return nameInTag === selectedEmpName;
    }
    return true;
  };

  const empCustomersCount = customers.filter(c => isEmpContribution(c.name)).length;
  const empEventsCount = events.filter(e => isEmpContribution(e.customer)).length;
  const empExpensesCount = expenses.filter(e => isEmpContribution(e.note)).length;
  const empStudentsCount = students.filter(s => isEmpContribution(s.name)).length;
  const empJewelsCount = jewels.filter(j => isEmpContribution(j.name)).length;

  const totalContributions = empCustomersCount + empEventsCount + empExpensesCount + empStudentsCount + empJewelsCount;

  let portalStatusHtml = '<span style="font-size:12.5px; color:#888;">Select your name to check in or out</span>';
  let portalDetailsHtml = '';

  const colors = ['av-gold', 'av-teal', 'av-rose', 'av-purple'];
  const empIndex = selectedEmp ? employees.findIndex(e => e.id === selectedEmp.id) : 0;
  const initials = selectedEmp ? (selectedEmp.name || '').split(' ').map(n => n[0]).join('').slice(0, 2) : '';

  if (selectedEmp) {
    const empId = selectedEmp.id;
    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const todayLog = attendance.find(a => a.employee_id === empId && a.date === todayStr);

    if (!todayLog) {
      portalStatusHtml = `
        <button class="btn btn-gold" onclick="window.handleEmpCheckIn('${empId}')" style="background:#22c55e; color:#fff; font-weight:600; padding:10px 20px; border-radius:8px; border:none; cursor:pointer;">
          <i class="ti ti-login"></i> Tap to Check In Today
        </button>
        <span style="font-size:10.5px; color:#666; margin-top:6px;">Work shift starts now</span>
      `;
    } else if (todayLog.check_in && !todayLog.check_out) {
      const checkInTime = new Date(todayLog.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      portalStatusHtml = `
        <div style="font-size:12px; color:#15803d; font-weight:600; margin-bottom:6px;"><i class="ti ti-circle-check"></i> Checked In at ${checkInTime}</div>
        <button class="btn btn-gold" onclick="window.handleEmpCheckOut('${todayLog.id}')" style="background:#eab308; color:#fff; font-weight:600; padding:10px 20px; border-radius:8px; border:none; cursor:pointer;">
          <i class="ti ti-logout"></i> Tap to Check Out
        </button>
      `;
    } else {
      const checkInTime = new Date(todayLog.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const checkOutTime = new Date(todayLog.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      portalStatusHtml = `
        <div style="color:#15803d; font-weight:700; font-size:14px;"><i class="ti ti-circle-check"></i> Shift Completed!</div>
        <span style="font-size:11.5px; color:#555; margin-top:4px;">In: <strong>${checkInTime}</strong> · Out: <strong>${checkOutTime}</strong></span>
      `;
    }

  }

  // 1. Build profile Header Info (Left)
  const profileHeaderHtml = selectedEmp ? `
    <div onclick="window.showEmployeePerformance('${selectedEmp.id}')" style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Click to view profile & performance">
      ${selectedEmp.photo_url ? `
        <img src="${selectedEmp.photo_url}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1.5px solid #f5c842; flex-shrink:0;" />
      ` : `
        <div class="avatar ${colors[empIndex >= 0 ? empIndex % 4 : 0]}" style="width:38px; height:38px; font-size:12.5px; font-weight:700; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:#f5c842; color:#1a1005;">${initials}</div>
      `}
      <div>
        <div style="font-size:13px; font-weight:700; color:#fff; display:flex; align-items:center; gap:4px; line-height:1.2;">
          ${selectedEmp.name}
          <i class="ti ti-chart-bar" style="color:#f5c842; font-size:11px;"></i>
        </div>
        <div style="font-size:9.5px; color:rgba(255,255,255,0.5); font-weight:600; margin-top:2px;">ID: ${selectedEmp.emp_id || 'kalai-emp-01'}</div>
      </div>
    </div>
  ` : `
    <div style="display:flex; align-items:center; gap:8px;">
      <span class="employee-logo-icon">✨</span>
      <div>
        <div class="employee-logo-title" style="font-size:13.5px; font-weight:700; color:#f5c842;">Kalai Makeover</div>
        <div class="employee-logo-sub" style="font-size:10px; color:rgba(255,255,255,0.4);">Employee Panel</div>
      </div>
    </div>
  `;

  // 2. Build header check-in/out button
  let headerAttendanceHtml = '';
  if (selectedEmp) {
    const empId = selectedEmp.id;
    const todayStr = new Date().toLocaleDateString('sv-SE');
    const todayLog = attendance.find(a => a.employee_id === empId && a.date === todayStr);

    if (!todayLog) {
      headerAttendanceHtml = `
        <button class="btn btn-gold" onclick="window.handleEmpCheckIn('${empId}')" style="background:#22c55e; color:#fff; font-weight:600; padding:4px 12px; font-size:11px; height:30px; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; gap:4px; margin-top:0; box-shadow:0 4px 12px rgba(34,197,94,0.2);">
          <i class="ti ti-login"></i> Check In
        </button>
      `;
    } else if (todayLog.check_in && !todayLog.check_out) {
      const checkInTime = new Date(todayLog.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      headerAttendanceHtml = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:10.5px; color:#22c55e; font-weight:600; background:rgba(34,197,94,0.1); padding:4px 8px; border-radius:8px; border:1px solid rgba(34,197,94,0.25);">In: ${checkInTime}</span>
          <button class="btn btn-gold" onclick="window.handleEmpCheckOut('${todayLog.id}')" style="background:#eab308; color:#fff; font-weight:600; padding:4px 12px; font-size:11px; height:30px; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; gap:4px; margin-top:0; box-shadow:0 4px 12px rgba(234,179,8,0.2);">
            <i class="ti ti-logout"></i> Check Out
          </button>
        </div>
      `;
    } else {
      const checkInTime = new Date(todayLog.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const checkOutTime = new Date(todayLog.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      headerAttendanceHtml = `
        <span style="font-size:10.5px; color:#22c55e; font-weight:700; background:rgba(34,197,94,0.1); padding:4px 8px; border-radius:8px; border:1px solid rgba(34,197,94,0.25); display:inline-flex; align-items:center; gap:4px;" title="In: ${checkInTime} · Out: ${checkOutTime}">
          <i class="ti ti-circle-check"></i> Shift Done
        </span>
      `;
    }
  }

  return `
  <div class="employee-page">
    <style>
      @media (max-width: 600px) {
        .employee-header {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 12px !important;
          padding: 12px 16px !important;
        }
        .emp-header-profile-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }
        .emp-header-controls-section {
          display: flex !important;
          justify-content: space-between !important;
          width: 100% !important;
          gap: 8px !important;
          align-items: center !important;
        }
        .emp-btn-text {
          display: none !important;
        }
        .employee-header .emp-switch-btn {
          padding: 0 10px !important;
          width: 36px !important;
          justify-content: center !important;
        }
        .emp-header-attendance-wrap {
          flex-grow: 1;
        }
        .emp-header-attendance-wrap button, 
        .emp-header-attendance-wrap span {
          width: 100% !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          display: inline-flex !important;
        }
      }
    </style>
    <!-- Header with Profile and Check-in Action -->
    <div class="employee-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; background:rgba(26,16,5,0.9); backdrop-filter:blur(8px); border-bottom:1px solid rgba(245,200,66,0.15); position:sticky; top:0; z-index:100; margin-bottom:20px; width:100%; flex-wrap:wrap; gap:10px;">
      <div class="emp-header-profile-section">
        ${profileHeaderHtml}
      </div>
      
      <div class="emp-header-controls-section" style="display:flex; align-items:center; gap:12px;">
        <div class="emp-header-attendance-wrap">
          ${headerAttendanceHtml}
        </div>
        
        <div class="emp-header-actions-wrap" style="display:flex; align-items:center; gap:6px;">
          <button class="emp-switch-btn" onclick="window.openSwitchModal('owner')" id="emp-switch-to-owner-btn" title="Switch to Owner" style="height:30px; padding:0 12px; font-size:10.5px; display:flex; align-items:center; gap:4px; margin-top:0; border-radius:8px; background:linear-gradient(135deg, #f5c842, #e8a020); color:#1a1005; border:none; font-weight:600;">
            <i class="ti ti-crown"></i> <span class="emp-btn-text">Switch to Owner</span>
          </button>
        </div>
      </div>
    </div>



    <div class="employee-welcome">
      <div class="employee-welcome-icon">
        <i class="ti ti-users"></i>
      </div>
      <h1 class="employee-welcome-title">Employee Actions</h1>
      <p class="employee-welcome-sub">Record customer visits, enrollments, purchases, expenses or event bookings below</p>
    </div>

    <div class="employee-action-grid">
      <button class="employee-action-btn ea-shop" onclick="window.openShopCustomerForm()" id="emp-add-customer-btn">
        <div class="ea-icon"><i class="ti ti-scissors"></i></div>
        <div class="ea-content">
          <div class="ea-title">Shop Customer</div>
          <div class="ea-sub">Service, amount, payment &amp; rating</div>
        </div>
        <i class="ti ti-chevron-right ea-arrow"></i>
      </button>

      <button class="employee-action-btn ea-class" onclick="window.openClassesForm()" id="emp-add-class-btn">
        <div class="ea-icon"><i class="ti ti-school"></i></div>
        <div class="ea-content">
          <div class="ea-title">Class Enrollment</div>
          <div class="ea-sub">Student name, fee &amp; date</div>
        </div>
        <i class="ti ti-chevron-right ea-arrow"></i>
      </button>

      <button class="employee-action-btn ea-jewel" onclick="window.openAddJewelModal()" id="emp-add-jewel-btn">
        <div class="ea-icon"><i class="ti ti-diamond"></i></div>
        <div class="ea-content">
          <div class="ea-title">Add Jewel Purchase</div>
          <div class="ea-sub">Jewel type, price, photo &amp; details</div>
        </div>
        <i class="ti ti-chevron-right ea-arrow"></i>
      </button>

      <button class="employee-action-btn ea-expense-single" onclick="window.showAddExpenseModal()" id="emp-add-expense-btn">
        <div class="ea-icon"><i class="ti ti-receipt"></i></div>
        <div class="ea-content">
          <div class="ea-title">Add General Expense</div>
          <div class="ea-sub">Rent, salary, products, utilities &amp; method</div>
        </div>
        <i class="ti ti-chevron-right ea-arrow"></i>
      </button>

      <button class="employee-action-btn ea-expense-bulk" onclick="window.openBulkExpenseForm()" id="emp-add-bulk-expense-btn">
        <div class="ea-icon"><i class="ti ti-receipt-2"></i></div>
        <div class="ea-content">
          <div class="ea-title">Bulk Expense Form</div>
          <div class="ea-sub">Add multiple expense rows at once</div>
        </div>
        <i class="ti ti-chevron-right ea-arrow"></i>
      </button>

      <button class="employee-action-btn ea-event" onclick="window.openEventCustomerForm()" id="emp-add-event-btn">
        <div class="ea-icon"><i class="ti ti-calendar-heart"></i></div>
        <div class="ea-content">
          <div class="ea-title">Book Event</div>
          <div class="ea-sub">Bridal makeup, function dates &amp; advance</div>
        </div>
        <i class="ti ti-chevron-right ea-arrow"></i>
      </button>
    </div>

    <div class="employee-notice">
      <i class="ti ti-lock" style="font-size:14px;color:#d97706;flex-shrink:0"></i>
      All other features are owner-only. Click "Switch to Owner" above to get full access.
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
//  WINDOW BINDINGS
// ─────────────────────────────────────────────

window.openSwitchModal = openSwitchModal;

window.updateEmpPortalStatus = function() {
  const select = document.getElementById('emp-portal-select');
  if (!select) return;
  const empId = select.value;
  window._selectedPortalEmployeeId = empId || null;
  if (typeof window.render === 'function') {
    window.render();
  }
};

window.handleEmpCheckIn = async function(empId) {
  const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
  
  // Calculate if check-in is Late
  let status = 'Present';
  const employees = window._cachedEmployees || [];
  const emp = employees.find(e => e.id === empId);
  if (emp && emp.shift_start) {
    const [shHour, shMin] = emp.shift_start.split(':').map(Number);
    const now = new Date();
    const shiftTime = new Date(now);
    shiftTime.setHours(shHour, shMin, 0, 0);
    if (now > shiftTime) {
      status = 'Late';
    }
  }

  const result = await saveAttendance({
    employee_id: empId,
    date: todayStr,
    check_in: new Date().toISOString(),
    status: status
  });

  if (result) {
    showToast(status === 'Late' ? 'Checked in! Marked as Late Entry ⏰' : 'Checked in successfully!');
    if (typeof window.render === 'function') await window.render();
  }
};

window.handleEmpCheckOut = async function(logId) {
  const attendance = window._cachedAttendance || [];
  const activeLog = attendance.find(a => a.id === logId);
  if (!activeLog) return;

  const result = await saveAttendance({
    ...activeLog,
    check_out: new Date().toISOString()
  });

  if (result) {
    showToast('Checked out successfully! Shift logged.');
    if (typeof window.render === 'function') await window.render();
  }
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

// Auto-run status update if employee pre-selected on load
setTimeout(() => {
  if (window._selectedPortalEmployeeId) {
    window.updateEmpPortalStatus();
  }
}, 150);
