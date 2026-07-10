// billl/js/pages/employee.js
// Role & PIN system — Owner (kalai123) / Employee (emp123)

import { state } from '../state.js';

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

  if (role === 'owner') {
    badge.innerHTML = '<i class="ti ti-crown"></i> Owner';
    badge.className = 'pin-role-badge pin-badge-owner';
    title.textContent = 'Enter Owner PIN';
  } else {
    badge.innerHTML = '<i class="ti ti-user-circle"></i> Employee';
    badge.className = 'pin-role-badge pin-badge-employee';
    title.textContent = 'Enter Employee PIN';
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

window._rscSubmitPin = function() {
  const inp = document.getElementById('pin-input-field');
  if (!inp || !_pendingRole) return;
  const val = inp.value.trim();

  if (val === PINS[_pendingRole]) {
    // Correct PIN — enter app
    const overlay = document.getElementById('role-selector-overlay');
    if (overlay) {
      overlay.style.animation = 'roleFadeOut 0.35s ease forwards';
      setTimeout(() => overlay.remove(), 340);
    }
    enterRole(_pendingRole);
  } else {
    // Wrong PIN — shake + error
    inp.classList.add('pin-input-error');
    const err = document.getElementById('pin-error-msg');
    if (err) err.style.display = 'flex';
    const card = document.getElementById('role-selector-card');
    if (card) { card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 500); }
    inp.value = '';
    inp.focus();
  }
};

// ─────────────────────────────────────────────
//  ENTER ROLE (after correct PIN)
// ─────────────────────────────────────────────

export function enterRole(role) {
  state.userRole = role;
  applyRoleLayout(role);
  if (typeof window.render === 'function') window.render();
  const msg = role === 'owner' ? 'Welcome back, Kalai! 👑' : 'Welcome! 👋 Employee mode active.';
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
  const badgeClass = toRole === 'owner' ? 'pin-badge-owner' : 'pin-badge-employee';

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
      <div class="switch-modal-sub">Enter the ${label} PIN to continue</div>

      <div class="pin-input-wrap" style="margin-top:20px">
        <i class="ti ti-lock pin-input-icon"></i>
        <input
          type="password"
          id="switch-pin-input"
          class="pin-input-field"
          placeholder="Enter PIN"
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

window._submitSwitchPin = function(toRole) {
  const inp = document.getElementById('switch-pin-input');
  if (!inp) return;
  const val = inp.value.trim();

  if (val === PINS[toRole]) {
    window.closeSwitchModal();
    setTimeout(() => {
      enterRole(toRole);
      if (toRole === 'owner') {
        // Show role selector is NOT needed — direct switch
        if (typeof window.showToast === 'function') window.showToast('Switched to Owner mode 👑', 'success');
      } else {
        if (typeof window.showToast === 'function') window.showToast('Switched to Employee mode', 'success');
      }
    }, 260);
  } else {
    inp.classList.add('pin-input-error');
    const err = document.getElementById('switch-pin-error');
    if (err) err.style.display = 'flex';
    const card = document.getElementById('switch-modal-card');
    if (card) { card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 500); }
    inp.value = '';
    inp.focus();
  }
};

// ─────────────────────────────────────────────
//  EMPLOYEE PAGE RENDER
// ─────────────────────────────────────────────

export function renderEmployeePage() {
  return `
  <div class="employee-page">
    <div class="employee-header">
      <div class="employee-logo">
        <span class="employee-logo-icon">✨</span>
        <div>
          <div class="employee-logo-title">Kalai Makeover</div>
          <div class="employee-logo-sub">Employee Panel</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="employee-badge">
          <i class="ti ti-shield-check"></i> Employee Mode
        </div>
        <button class="emp-switch-btn" onclick="window.openSwitchModal('owner')" id="emp-switch-to-owner-btn" title="Switch to Owner">
          <i class="ti ti-crown"></i> Switch to Owner
        </button>
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
          <div class="ea-title">Add Expense</div>
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
