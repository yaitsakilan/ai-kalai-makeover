// billl/js/pages/students.js
import { state } from '../state.js';
import { 
  fetchClassEnrollments, 
  updateClassEnrollment, 
  deleteClassEnrollment, 
  fetchClassPayments, 
  addClassPayment, 
  deleteClassPayment 
} from '../db.js';
import { showToast, showModal, closeModal, showConfirmDelete } from '../ui.js';
import { validateAndCleanPhone } from '../utils.js';

export async function renderStudents() {
  const students = await fetchClassEnrollments();
  window._cachedStudents = students;

  if (window._studentSearchQuery === undefined) window._studentSearchQuery = '';
  if (window._studentStatusFilter === undefined) window._studentStatusFilter = 'all';

  // Apply filters
  let filtered = [...students];
  if (window._studentSearchQuery) {
    const q = window._studentSearchQuery.toLowerCase();
    filtered = filtered.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.phone || '').includes(q)
    );
  }
  if (window._studentStatusFilter !== 'all') {
    filtered = filtered.filter(s => s.status === window._studentStatusFilter);
  }

  return `
  <div class="top-bar">
    <div>
      <h2>Student Management</h2>
      <p style="font-size:12px;color:#999;margin-top:2px">Track course enrollments, fees, monthly installments, and collection progress</p>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-gold" onclick="window.openClassesForm()">
        <i class="ti ti-plus"></i> Enroll Student
      </button>
    </div>
  </div>

  <div id="student-metrics-container">
    ${renderStudentMetrics(filtered)}
  </div>

  <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; margin-bottom:16px; align-items:center;">
    <div class="card" style="padding: 10px 14px;">
      <input class="form-input" placeholder="Search students by name or phone..." id="student-search" value="${window._studentSearchQuery || ''}" oninput="window.filterStudentsList(this.value)" style="border:none; padding:4px;">
    </div>
    <div class="card" style="padding: 8px 12px; display:flex; justify-content:space-around; gap:8px;">
      <span class="chip ${window._studentStatusFilter === 'all' ? 'selected' : ''}" onclick="window.filterStudentsStatus('all')" style="padding: 4px 10px; font-size:11px;">All</span>
      <span class="chip ${window._studentStatusFilter === 'Active' ? 'selected' : ''}" onclick="window.filterStudentsStatus('Active')" style="padding: 4px 10px; font-size:11px;">Active</span>
      <span class="chip ${window._studentStatusFilter === 'Completed' ? 'selected' : ''}" onclick="window.filterStudentsStatus('Completed')" style="padding: 4px 10px; font-size:11px;">Completed</span>
    </div>
  </div>

  <div id="students-grid-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
    ${renderStudentsCards(filtered)}
  </div>`;
}

function renderStudentMetrics(students) {
  const totalStudents = students.length;
  const activeCount = students.filter(s => s.status === 'Active').length;
  const totalFees = students.reduce((sum, s) => sum + (s.total_fee || 0), 0);
  const totalPaid = students.reduce((sum, s) => sum + (s.total_paid || 0), 0);
  const totalPending = totalFees - totalPaid;

  return `
  <div class="metric-grid" style="margin-bottom: 16px;">
    <div class="metric-card mc-gold">
      <div class="metric-label">Total Students</div>
      <div class="metric-value">${totalStudents}</div>
      <div class="metric-sub">${activeCount} active enrollments</div>
      <div class="metric-icon"><i class="ti ti-school"></i></div>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Total Course Fees</div>
      <div class="metric-value">₹${totalFees.toLocaleString('en-IN')}</div>
      <div class="metric-sub">Across all courses</div>
      <div class="metric-icon"><i class="ti ti-currency-rupee"></i></div>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Total Paid (Collected)</div>
      <div class="metric-value" style="color:#15803d;">₹${totalPaid.toLocaleString('en-IN')}</div>
      <div class="metric-sub">${totalFees ? Math.round((totalPaid/totalFees)*100) : 0}% of course fees collected</div>
      <div class="metric-icon"><i class="ti ti-cash"></i></div>
    </div>
    <div class="metric-card mc-purple">
      <div class="metric-label">Outstanding Balance</div>
      <div class="metric-value" style="color:#b91c1c;">₹${totalPending.toLocaleString('en-IN')}</div>
      <div class="metric-sub">Dues to be collected</div>
      <div class="metric-icon"><i class="ti ti-alert-circle"></i></div>
    </div>
  </div>`;
}

function renderStudentsCards(students) {
  if (!students.length) {
    return `<div class="card" style="grid-column: span 3; text-align:center; padding:50px; color:#999;">
      <i class="ti ti-school" style="font-size:42px; display:block; margin-bottom:10px; opacity:0.3;"></i>
      No students found
    </div>`;
  }

  return students.map(s => {
    const totalFee = s.total_fee || 0;
    const paid = s.total_paid || 0;
    const pending = totalFee - paid;
    const percent = totalFee > 0 ? Math.round((paid / totalFee) * 100) : 0;
    
    // Choose status badge color
    let statusClass = 'badge-amber';
    if (s.status === 'Completed') statusClass = 'badge-green';
    if (s.status === 'Dropped') statusClass = 'badge-red';

    return `
    <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; position:relative; min-height: 220px; transition: transform 0.2s, box-shadow 0.2s;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
        <div>
          <h3 style="font-size:15px; font-weight:600; color:#1a1a1a; margin-bottom:3px;">${s.name}</h3>
          <div style="font-size:11px; color:#666; display:flex; align-items:center; gap:4px; margin-bottom:4px;">
            <i class="ti ti-phone" style="font-size:12px;"></i> ${s.phone || 'No phone'}
            ${s.location ? `· <i class="ti ti-map-pin" style="font-size:12px;"></i> ${s.location}` : ''}
          </div>
          <div style="font-size:11px; color:#aaa;">Joined: ${s.start_date || 'N/A'}</div>
        </div>
        <span class="badge ${statusClass}">${s.status}</span>
      </div>

      <div style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#888; margin-bottom:4px;">
          <span>Classes:</span>
          <span style="font-weight:600; color:#333;">${(s.classes || []).join(', ')}</span>
        </div>
        
        <!-- Progress bar -->
        <div style="background:#f0f0f0; border-radius:4px; height:8px; overflow:hidden; margin:8px 0 4px;">
          <div style="height:100%; border-radius:4px; background:linear-gradient(90deg, #f5c842, #e8a020); width:${percent}%;"></div>
        </div>
        
        <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:500;">
          <span style="color:#15803d;">Paid: ₹${paid.toLocaleString('en-IN')} (${percent}%)</span>
          <span style="color:${pending > 0 ? '#b91c1c' : '#15803d'};">Pending: ₹${pending.toLocaleString('en-IN')}</span>
        </div>
        <div style="font-size:12px; font-weight:700; text-align:right; margin-top:6px; color:#d97706;">
          Total Fee: ₹${totalFee.toLocaleString('en-IN')}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; border-top: 1px solid #f3f4f6; padding-top:12px; gap:8px;">
        <div style="display:flex; gap:6px;">
          <button class="btn btn-outline btn-icon" onclick="window.openPaymentHistoryModal('${s.id}')" title="Payment History" style="width:32px; height:32px;">
            <i class="ti ti-history" style="font-size:14px;"></i>
          </button>
          <button class="btn btn-outline btn-icon" onclick="window.promptStudentWhatsAppBill('${s.id}')" title="Send WhatsApp Bill" style="width:32px; height:32px; color:#25d366;">
            <i class="ti ti-brand-whatsapp" style="font-size:14px;"></i>
          </button>
          <button class="btn btn-outline btn-icon" onclick="window.handleDeleteStudentEnrollment('${s.id}')" title="Delete Student" style="width:32px; height:32px; color:#dc2626;">
            <i class="ti ti-trash" style="font-size:14px;"></i>
          </button>
        </div>
        
        <div style="display:flex; gap:6px;">
          ${s.status === 'Active' && pending > 0 ? `
            <button class="btn btn-gold" onclick="window.openRecordPaymentModal('${s.id}')" style="padding: 6px 12px; font-size:12px; height:32px;">
              <i class="ti ti-cash"></i> Record Payment
            </button>
          ` : s.status === 'Active' && pending === 0 ? `
            <button class="btn btn-outline" onclick="window.toggleStudentStatus('${s.id}', 'Completed')" style="padding: 6px 12px; font-size:12px; height:32px; color:#15803d; border-color:#15803d;">
              <i class="ti ti-checkbox"></i> Complete
            </button>
          ` : `
            <button class="btn btn-outline" onclick="window.toggleStudentStatus('${s.id}', 'Active')" style="padding: 6px 12px; font-size:12px; height:32px;">
              Reopen
            </button>
          `}
        </div>
      </div>
    </div>`;
  }).join('');
}

export function filterStudentsList(q) {
  window._studentSearchQuery = q;
  const listEl = document.getElementById('students-grid-list');
  const metricsEl = document.getElementById('student-metrics-container');
  
  const allStudents = window._cachedStudents || [];
  let filtered = allStudents.filter(s => 
    (s.name || '').toLowerCase().includes(q.toLowerCase()) || 
    (s.phone || '').includes(q)
  );
  if (window._studentStatusFilter !== 'all') {
    filtered = filtered.filter(s => s.status === window._studentStatusFilter);
  }

  if (listEl) listEl.innerHTML = renderStudentsCards(filtered);
  if (metricsEl) metricsEl.innerHTML = renderStudentMetrics(filtered);
}

export function filterStudentsStatus(status) {
  window._studentStatusFilter = status;
  
  const chips = document.querySelectorAll('.chip');
  chips.forEach(c => c.classList.remove('selected'));
  
  if (typeof window.render === 'function') window.render();
}

export async function toggleStudentStatus(id, newStatus) {
  const result = await updateClassEnrollment(id, { status: newStatus });
  if (result && typeof window.render === 'function') window.render();
}

export async function openRecordPaymentModal(studentId) {
  const student = (window._cachedStudents || []).find(s => s.id === studentId);
  if (!student) return;

  const pending = (student.total_fee || 0) - (student.total_paid || 0);
  const today = new Date().toISOString().split('T')[0];

  showModal(`Record Installment Payment`, `
    <div style="font-size:13px; color:#555; margin-bottom:14px;">
      Log installment payment for <strong>${student.name}</strong>.
      <br><span style="font-size:11px; color:#999;">Remaining Balance: ₹${pending.toLocaleString('en-IN')}</span>
    </div>
    <div class="form-group">
      <label class="form-label">Amount (₹) *</label>
      <input class="form-input" id="m-pay-amount" type="number" value="${pending}" max="${pending}">
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Payment Date</label>
        <input class="form-input" id="m-pay-date" type="date" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">Method</label>
        <select class="form-input form-select" id="m-pay-method" onchange="window.handleRecordPaymentMethodChange(this)">
          <option value="Cash">Cash</option>
          <option value="GPay">GPay</option>
          <option value="Both">Both</option>
        </select>
      </div>
    </div>
    <div id="m-pay-both-container" style="display:none; margin-bottom:14px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">Cash Portion (₹) *</label>
          <input class="form-input" id="m-pay-both-cash" type="number" placeholder="Cash amount" oninput="window.updateRecordPaymentBothTotal()">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">GPay Portion (₹) *</label>
          <input class="form-input" id="m-pay-both-gpay" type="number" placeholder="GPay amount" oninput="window.updateRecordPaymentBothTotal()">
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Note / Reference</label>
      <input class="form-input" id="m-pay-note" placeholder="e.g. Installment 2, cash handover">
    </div>
  `, async () => {
    const amtVal = parseInt(document.getElementById('m-pay-amount').value) || 0;
    if (amtVal <= 0) { showToast('Please enter a valid amount', 'error'); return; }
    if (amtVal > pending) { showToast('Amount cannot exceed outstanding balance', 'error'); return; }

    const dateVal = document.getElementById('m-pay-date').value || today;
    const methodVal = document.getElementById('m-pay-method').value;
    const notePrefix = document.getElementById('m-pay-note').value.trim() || 'Installment Payment';
    let noteVal = notePrefix;

    if (methodVal === 'Both') {
      const cashPortion = parseInt(document.getElementById('m-pay-both-cash').value) || 0;
      const gpayPortion = parseInt(document.getElementById('m-pay-both-gpay').value) || 0;
      if (cashPortion <= 0 || gpayPortion <= 0) {
        showToast('Please enter both Cash and GPay portion amounts', 'error');
        return;
      }
      if (cashPortion + gpayPortion !== amtVal) {
        showToast(`Sum of Cash (₹${cashPortion}) & GPay (₹${gpayPortion}) must equal payment amount (₹${amtVal})`, 'error');
        return;
      }
      noteVal = `${notePrefix} (Cash: ₹${cashPortion}, GPay: ₹${gpayPortion})`;
    }

    // 1. Add class payment
    const payment = await addClassPayment({
      enrollment_id: studentId,
      amount: amtVal,
      payment_method: methodVal,
      date: dateVal,
      note: noteVal
    });

    if (payment) {
      // 2. Update class enrollment paid amount
      const nextPaid = (student.total_paid || 0) + amtVal;
      const nextStatus = nextPaid >= student.total_fee ? 'Completed' : 'Active';
      
      await updateClassEnrollment(studentId, {
        total_paid: nextPaid,
        status: nextStatus
      });

      closeModal();
      if (typeof window.render === 'function') window.render();
      
      // Prompt for invoice WhatsApp message
      setTimeout(() => {
        window.promptStudentWhatsAppBill(studentId, amtVal, dateVal, methodVal);
      }, 500);
    }
  });
}

export async function openPaymentHistoryModal(studentId) {
  const student = (window._cachedStudents || []).find(s => s.id === studentId);
  if (!student) return;

  const payments = await fetchClassPayments(studentId);

  let bodyHtml = `
    <div style="font-size:13px; color:#555; margin-bottom:14px;">
      Payment timeline for <strong>${student.name}</strong>.
      <br><span style="font-size:11px; color:#999;">Total Course Fee: ₹${(student.total_fee || 0).toLocaleString('en-IN')}</span>
    </div>
    <div class="scrollbar-hide" style="max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
  `;

  if (!payments.length) {
    bodyHtml += `<div style="text-align:center; padding:20px; color:#aaa; font-size:12px;">No payment records found</div>`;
  } else {
    bodyHtml += payments.map(p => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#fafafa; border: 0.5px solid #eaeaea; border-radius:8px; padding:10px 14px;">
        <div>
          <div style="font-size:13px; font-weight:600; color:#1a1a1a;">₹${p.amount.toLocaleString('en-IN')}</div>
          <div style="font-size:11px; color:#888;">${p.date} · ${p.payment_method}</div>
          <div style="font-size:10px; color:#bbb; margin-top:2px;">${p.note || ''}</div>
        </div>
        <button class="btn btn-danger btn-icon" onclick="window.handleDeleteStudentPayment('${studentId}', '${p.id}', ${p.amount})" style="width:28px; height:28px; padding:0; border-radius:6px;" title="Delete Payment Record">
          <i class="ti ti-trash" style="font-size:12px;"></i>
        </button>
      </div>
    `).join('');
  }

  bodyHtml += `</div>`;

  showModal(`Payment History`, bodyHtml, null);
  
  // Hide save button because this is a view modal
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';
}

export async function handleDeleteStudentPayment(studentId, paymentId, amount) {
  const confirmed = await showConfirmDelete('Delete Payment Record', 'Are you sure you want to delete this payment record? This will reduce the student\'s total paid amount.');
  if (!confirmed) return;

  const success = await deleteClassPayment(paymentId);
  if (success) {
    const student = (window._cachedStudents || []).find(s => s.id === studentId);
    if (student) {
      const nextPaid = Math.max(0, (student.total_paid || 0) - amount);
      await updateClassEnrollment(studentId, {
        total_paid: nextPaid,
        status: 'Active' // Reopen enrollment if balance returns
      });
    }
    closeModal();
    if (typeof window.render === 'function') window.render();
  }
}

export async function handleDeleteStudentEnrollment(id) {
  const confirmed = await showConfirmDelete('Delete Student Record', 'Are you sure you want to delete this student enrollment and all associated payment logs? This cannot be undone.');
  if (!confirmed) return;

  const success = await deleteClassEnrollment(id);
  if (success && typeof window.render === 'function') window.render();
}

export function promptStudentWhatsAppBill(studentId, paidAmount = null, paymentDate = null, paymentMethod = null) {
  const student = (window._cachedStudents || []).find(s => s.id === studentId);
  if (!student) return;

  const phone = student.phone;
  if (!phone) {
    showToast('Student phone number is missing!', 'error');
    return;
  }

  const cleanedPhone = validateAndCleanPhone(phone);
  if (!cleanedPhone) {
    showToast('Invalid phone number format', 'error');
    return;
  }

  const totalFee = student.total_fee || 0;
  const totalPaid = student.total_paid || 0;
  const pending = totalFee - totalPaid;

  const classesStr = (student.classes || []).join(', ');
  const formattedDate = paymentDate 
    ? new Date(paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  let billHeadline = paidAmount 
    ? `✨ KALAI MAKEOVER — PAYMENT RECEIPT ✨` 
    : `✨ KALAI MAKEOVER — STUDENT ACCOUNT DETAILS ✨`;

  let transactionPart = paidAmount
    ? `An installment payment of *₹${paidAmount.toLocaleString('en-IN')}* was received via *${paymentMethod || 'Cash'}* on *${formattedDate}*.\n`
    : '';

  const defaultMessage = `${billHeadline}

Hello ${student.name},

Here is the update regarding your course enrollment fees.

Course Details:
• Course Name: ${classesStr}
• Total Course Fee: ₹${totalFee.toLocaleString('en-IN')}

Payment Transactions:
${transactionPart}----------------------------------
💰 Total Collected: ₹${totalPaid.toLocaleString('en-IN')}
⚠️ Outstanding Balance: ₹${pending.toLocaleString('en-IN')}

${pending > 0 ? 'Please complete the remaining course payments as scheduled.' : 'Congratulations! Your course fee is fully paid. 🎉'}

Thank you,
Kalai Makeover
📞 8870236006`;

  showModal('Send Receipt via WhatsApp', `
    <div style="font-size:13px; color:#555; margin-bottom:14px;">
      Customize WhatsApp invoice message for <strong>${student.name}</strong>:
    </div>
    <div class="form-group">
      <label class="form-label">WhatsApp Message Preview</label>
      <textarea class="form-input" id="wa-student-message" style="height:220px; font-family:monospace; white-space:pre-wrap; resize:vertical; line-height:1.4;">${defaultMessage}</textarea>
    </div>
  `, () => {
    const editedMessage = document.getElementById('wa-student-message').value.trim();
    if (!editedMessage) {
      showToast('Message text cannot be empty.', 'error');
      return;
    }
    const fullPhone = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(editedMessage)}`;
    window.open(url, '_blank');
    closeModal();
    showToast('WhatsApp opened in a new tab!');
  });

  // Customize modal button
  setTimeout(() => {
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="ti ti-brand-whatsapp"></i> Send Status';
      saveBtn.style.background = '#25d366';
      saveBtn.style.borderColor = '#25d366';
      saveBtn.style.color = '#fff';
    }
  }, 50);
}

export function handleRecordPaymentMethodChange(selectEl) {
  const container = document.getElementById('m-pay-both-container');
  const amountInput = document.getElementById('m-pay-amount');
  if (!container || !amountInput) return;

  if (selectEl.value === 'Both') {
    container.style.display = 'block';
    amountInput.readOnly = true;

    // Split the current amount in half for cash/gpay portion inputs
    const currentVal = parseInt(amountInput.value) || 0;
    const half = Math.round(currentVal / 2);
    const cashEl = document.getElementById('m-pay-both-cash');
    const gpayEl = document.getElementById('m-pay-both-gpay');
    if (cashEl) cashEl.value = half;
    if (gpayEl) gpayEl.value = currentVal - half;
  } else {
    container.style.display = 'none';
    amountInput.readOnly = false;
  }
}

export function updateRecordPaymentBothTotal() {
  const cash = parseInt(document.getElementById('m-pay-both-cash').value) || 0;
  const gpay = parseInt(document.getElementById('m-pay-both-gpay').value) || 0;
  const amountInput = document.getElementById('m-pay-amount');
  if (amountInput) {
    amountInput.value = cash + gpay;
  }
}

// Bind methods to window object
window.filterStudentsList = filterStudentsList;
window.filterStudentsStatus = filterStudentsStatus;
window.toggleStudentStatus = toggleStudentStatus;
window.openRecordPaymentModal = openRecordPaymentModal;
window.openPaymentHistoryModal = openPaymentHistoryModal;
window.handleDeleteStudentPayment = handleDeleteStudentPayment;
window.handleDeleteStudentEnrollment = handleDeleteStudentEnrollment;
window.promptStudentWhatsAppBill = promptStudentWhatsAppBill;
window.handleRecordPaymentMethodChange = handleRecordPaymentMethodChange;
window.updateRecordPaymentBothTotal = updateRecordPaymentBothTotal;
