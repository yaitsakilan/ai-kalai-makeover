// billl/js/pages/jewels.js
import { state } from '../state.js';
import { 
  fetchJewels, 
  addJewel, 
  updateJewel, 
  deleteJewel, 
  fetchJewelRentals, 
  addJewelRental, 
  updateJewelRental, 
  deleteJewelRental 
} from '../db.js';
import { showToast, showModal, closeModal, showConfirmDelete } from '../ui.js';
import { validateAndCleanPhone } from '../utils.js';
import { callGroqAPI } from '../api.js';

export async function renderJewels() {
  const jewels = await fetchJewels();
  window._cachedJewels = jewels;

  if (window._jewelSearchQuery === undefined) window._jewelSearchQuery = '';
  if (window._jewelStatusFilter === undefined) window._jewelStatusFilter = 'all';

  // Apply filters
  let filtered = [...jewels];
  if (window._jewelSearchQuery) {
    const q = window._jewelSearchQuery.toLowerCase();
    filtered = filtered.filter(j => 
      (j.name || '').toLowerCase().includes(q) || 
      (j.type || '').toLowerCase().includes(q) ||
      (j.description || '').toLowerCase().includes(q)
    );
  }
  if (window._jewelStatusFilter !== 'all') {
    filtered = filtered.filter(j => j.status === window._jewelStatusFilter);
  }

  return `
  <div class="top-bar">
    <div>
      <h2>Jewellery Rental Tracker</h2>
      <p style="font-size:12px;color:#999;margin-top:2px">Monitor jewel purchases, rental transactions, outstanding deposits, and net ROI</p>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-gold" onclick="window.openAddJewelModal()">
        <i class="ti ti-plus"></i> Add Jewel Purchase
      </button>
    </div>
  </div>

  <div id="jewel-metrics-container">
    ${renderJewelMetrics(filtered)}
  </div>

  <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; margin-bottom:16px; align-items:center;">
    <div class="card" style="padding: 10px 14px;">
      <input class="form-input" placeholder="Search jewels by name, type, description..." id="jewel-search" value="${window._jewelSearchQuery || ''}" oninput="window.filterJewelsList(this.value)" style="border:none; padding:4px;">
    </div>
    <div class="card" style="padding: 8px 12px; display:flex; justify-content:space-around; gap:8px;">
      <span class="chip ${window._jewelStatusFilter === 'all' ? 'selected' : ''}" onclick="window.filterJewelsStatus('all')" style="padding: 4px 10px; font-size:11px;">All</span>
      <span class="chip ${window._jewelStatusFilter === 'Available' ? 'selected' : ''}" onclick="window.filterJewelsStatus('Available')" style="padding: 4px 10px; font-size:11px;">Available</span>
      <span class="chip ${window._jewelStatusFilter === 'Rented' ? 'selected' : ''}" onclick="window.filterJewelsStatus('Rented')" style="padding: 4px 10px; font-size:11px;">Rented</span>
    </div>
  </div>

  <div id="jewels-grid-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
    ${renderJewelCards(filtered)}
  </div>`;
}

function renderJewelMetrics(jewels) {
  const totalJewels = jewels.length;
  const investment = jewels.reduce((sum, j) => sum + (j.purchase_price || 0), 0);
  const income = jewels.reduce((sum, j) => sum + (j.total_rental_income || 0), 0);
  const netProfit = income - investment;
  const activeRentals = jewels.filter(j => j.status === 'Rented').length;

  return `
  <div class="metric-grid" style="margin-bottom: 16px;">
    <div class="metric-card mc-gold">
      <div class="metric-label">Total Jewellery Cost</div>
      <div class="metric-value">₹${investment.toLocaleString('en-IN')}</div>
      <div class="metric-sub">${totalJewels} pieces purchased</div>
      <div class="metric-icon"><i class="ti ti-diamond"></i></div>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Total Rental Income</div>
      <div class="metric-value" style="color:#15803d;">₹${income.toLocaleString('en-IN')}</div>
      <div class="metric-sub">${activeRentals} pieces currently out on rent</div>
      <div class="metric-icon"><i class="ti ti-cash"></i></div>
    </div>
    <div class="metric-card ${netProfit >= 0 ? 'mc-teal' : 'mc-rose'}">
      <div class="metric-label">Net Profit / Loss</div>
      <div class="metric-value" style="color: ${netProfit >= 0 ? '#15803d' : '#b91c1c'};">
        ${netProfit >= 0 ? '+' : ''}₹${netProfit.toLocaleString('en-IN')}
      </div>
      <div class="metric-sub">${investment ? Math.round((income/investment)*100) : 0}% investment recovery rate</div>
      <div class="metric-icon"><i class="ti ti-chart-pie"></i></div>
    </div>
  </div>`;
}

function renderJewelCards(jewels) {
  if (!jewels.length) {
    return `<div class="card" style="grid-column: span 3; text-align:center; padding:50px; color:#999;">
      <i class="ti ti-diamond" style="font-size:42px; display:block; margin-bottom:10px; opacity:0.3;"></i>
      No jewellery items found
    </div>`;
  }

  return jewels.map(j => {
    const cost = j.purchase_price || 0;
    const earned = j.total_rental_income || 0;
    const balance = earned - cost;
    const percent = cost > 0 ? Math.min(100, Math.round((earned / cost) * 100)) : 0;
    
    let statusClass = 'badge-green';
    if (j.status === 'Rented') statusClass = 'badge-amber';
    if (j.status === 'Retired') statusClass = 'badge-red';

    // Progress bar color
    let barColor = 'linear-gradient(90deg, #ef4444, #f59e0b)';
    if (balance >= 0) barColor = 'linear-gradient(90deg, #10b981, #059669)';

    const imageHtml = j.image_url ? `
      <div style="width: 100%; height: 160px; overflow: hidden; border-radius: 8px; margin-bottom: 12px; background: #fcfbfa; display: flex; align-items: center; justify-content: center; border: 0.5px solid #e5e5e5;">
        <img src="${j.image_url}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
    ` : `
      <div style="width: 100%; height: 160px; overflow: hidden; border-radius: 8px; margin-bottom: 12px; background: #fcfbfa; display: flex; align-items: center; justify-content: center; border: 0.5px dashed #e5e5e5; color: #bbb;">
        <i class="ti ti-image" style="font-size: 32px; opacity: 0.5;"></i>
      </div>
    `;

    return `
    <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; min-height: 350px; transition: transform 0.2s, box-shadow 0.2s;">
      <div>
        ${imageHtml}
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div>
            <h3 style="font-size:14px; font-weight:600; color:#1a1a1a; margin-bottom:2px;">${j.name}</h3>
            <span style="font-size:10px; padding: 2px 6px; background:#f3f4f6; border-radius:12px; font-weight:500; color:#4b5563;">${j.type || 'Jewel'}</span>
            <div style="font-size:10.5px; color:#999; margin-top:6px;">Bought: ${j.purchase_date} · Cost: ₹${cost.toLocaleString('en-IN')}</div>
          </div>
          <span class="badge ${statusClass}">${j.status}</span>
        </div>
      </div>

      <div style="margin: 10px 0 14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#888; margin-bottom:4px;">
          <span>Earnings: ₹${earned.toLocaleString('en-IN')}</span>
          <span style="font-weight:700; color:${balance >= 0 ? '#15803d' : '#b91c1c'};">
            ${balance >= 0 ? `Profit: +₹${balance.toLocaleString('en-IN')}` : `Loss: -₹${Math.abs(balance).toLocaleString('en-IN')}`}
          </span>
        </div>
        
        <!-- ROI Progress -->
        <div style="background:#f3f4f6; border-radius:4px; height:8px; overflow:hidden; margin-bottom:4px;">
          <div style="height:100%; border-radius:4px; background:${barColor}; width:${percent}%;"></div>
        </div>
        
        <div style="display:flex; justify-content:space-between; font-size:10px; color:#aaa;">
          <span>${percent}% Cost Recovered</span>
          <span>ROI Tracker</span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; border-top: 1px solid #f3f4f6; padding-top:12px; gap:8px;">
        <div style="display:flex; gap:6px;">
          <button class="btn btn-outline btn-icon" onclick="window.openJewelHistoryModal('${j.id}')" title="Rental History" style="width:32px; height:32px;">
            <i class="ti ti-history" style="font-size:14px;"></i>
          </button>
          <button class="btn btn-outline btn-icon" onclick="window.handleDeleteJewelRecord('${j.id}')" title="Delete Jewel" style="width:32px; height:32px; color:#dc2626;">
            <i class="ti ti-trash" style="font-size:14px;"></i>
          </button>
        </div>
        
        <div style="display:flex; gap:6px;">
          ${j.status === 'Available' ? `
            <button class="btn btn-gold" onclick="window.openRentJewelModal('${j.id}')" style="padding: 6px 12px; font-size:11.5px; height:32px;">
              <i class="ti ti-calendar-share"></i> Rent Out
            </button>
          ` : j.status === 'Rented' ? `
            <button class="btn btn-outline" onclick="window.openReturnJewelModal('${j.id}')" style="padding: 6px 12px; font-size:11.5px; height:32px; color:#d97706; border-color:#d97706;">
              <i class="ti ti-calendar-stats"></i> Mark Returned
            </button>
          ` : `
            <button class="btn btn-outline" onclick="window.updateJewelStatus('${j.id}', 'Available')" style="padding: 6px 12px; font-size:11.5px; height:32px;">
              Make Available
            </button>
          `}
        </div>
      </div>
    </div>`;
  }).join('');
}

export function filterJewelsList(q) {
  window._jewelSearchQuery = q;
  const listEl = document.getElementById('jewels-grid-list');
  const metricsEl = document.getElementById('jewel-metrics-container');
  
  const allJewels = window._cachedJewels || [];
  let filtered = allJewels.filter(j => 
    (j.name || '').toLowerCase().includes(q.toLowerCase()) || 
    (j.type || '').toLowerCase().includes(q.toLowerCase()) ||
    (j.description || '').toLowerCase().includes(q.toLowerCase())
  );
  if (window._jewelStatusFilter !== 'all') {
    filtered = filtered.filter(j => j.status === window._jewelStatusFilter);
  }

  if (listEl) listEl.innerHTML = renderJewelCards(filtered);
  if (metricsEl) metricsEl.innerHTML = renderJewelMetrics(filtered);
}

export function filterJewelsStatus(status) {
  window._jewelStatusFilter = status;
  
  const chips = document.querySelectorAll('.chip');
  chips.forEach(c => c.classList.remove('selected'));
  
  if (typeof window.render === 'function') window.render();
}

export async function updateJewelStatus(id, newStatus) {
  const result = await updateJewel(id, { status: newStatus });
  if (result && typeof window.render === 'function') window.render();
}

export function openAddJewelModal() {
  window._lastJewelImageUrl = null;
  const today = new Date().toISOString().split('T')[0];
  showModal('Add Jewel Purchase', `
    <div class="form-group">
      <label class="form-label">Jewel Photo</label>
      <div class="ocr-zone" onclick="window.triggerJewelImageSelect()" id="mj-image-zone" style="height: 100px; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 1.5px dashed #ccc; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
        <i class="ti ti-camera" style="font-size:24px; color:#aaa; margin-bottom:4px;"></i>
        <span style="font-size:12px; color:#666;">Tap to upload or take a photo</span>
        <span style="font-size:10px; color:#bbb; margin-top:2px;">AI will automatically identify the jewel type & name</span>
      </div>
      <input type="file" id="mj-image-file" accept="image/*" style="display:none;" onchange="window.handleJewelImageUpload(this)">
    </div>
    <div class="form-group">
      <label class="form-label">Jewel Name *</label>
      <input class="form-input" id="mj-name" placeholder="e.g. Antique Choker Necklace">
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Type *</label>
        <select class="form-input form-select" id="mj-type">
          <option value="Necklace">Necklace</option>
          <option value="Bangles">Bangles</option>
          <option value="Earrings">Earrings</option>
          <option value="Maang Tikka">Maang Tikka</option>
          <option value="Waist Chain">Waist Chain</option>
          <option value="Others">Others</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Purchase Price (₹) *</label>
        <input class="form-input" id="mj-price" type="number" placeholder="Cost price">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Purchase Date</label>
      <input class="form-input" id="mj-date" type="date" value="${today}">
    </div>
    <div class="form-group">
      <label class="form-label">Description / Notes</label>
      <input class="form-input" id="mj-desc" placeholder="e.g. Gold plating, bought from Kalyan Jewellers">
    </div>
  `, async () => {
    const name = document.getElementById('mj-name').value.trim();
    if (!name) { showToast('Please enter jewel name', 'error'); return; }

    const type = document.getElementById('mj-type').value;
    const price = parseInt(document.getElementById('mj-price').value) || 0;
    if (price <= 0) { showToast('Please enter purchase price', 'error'); return; }

    const date = document.getElementById('mj-date').value || today;
    const desc = document.getElementById('mj-desc').value.trim();
    const imageUrl = window._lastJewelImageUrl || null;

    const result = await addJewel({
      name,
      type,
      purchase_price: price,
      purchase_date: date,
      description: desc,
      image_url: imageUrl,
      total_rental_income: 0,
      status: 'Available'
    });

    if (result) {
      closeModal();
      if (typeof window.render === 'function') window.render();
    } else {
      const btn = document.getElementById('modal-save-btn');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-check"></i> Save';
      }
    }
  });
}

export function openRentJewelModal(jewelId) {
  const jewel = (window._cachedJewels || []).find(j => j.id === jewelId);
  if (!jewel) return;

  const today = new Date().toISOString().split('T')[0];

  showModal(`Rent Out Jewellery`, `
    <div style="font-size:12.5px; color:#555; margin-bottom:14px;">
      Log rental lease details for <strong>${jewel.name}</strong>.
    </div>
    <div class="form-group">
      <label class="form-label">Customer Name *</label>
      <input class="form-input" id="mr-cust" placeholder="Enter customer name">
    </div>
    <div class="form-group">
      <label class="form-label">Customer Phone</label>
      <input class="form-input" id="mr-phone" placeholder="10-digit phone" maxlength="10">
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Rental Date</label>
        <input class="form-input" id="mr-rent-date" type="date" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">Est. Return Date</label>
        <input class="form-input" id="mr-return-date" type="date" value="${today}">
      </div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label class="form-label">Rental Fee (₹) *</label>
        <input class="form-input" id="mr-fee" type="number" placeholder="Fee received">
      </div>
      <div class="form-group">
        <label class="form-label">Refundable Deposit (₹)</label>
        <input class="form-input" id="mr-deposit" type="number" placeholder="Security deposit">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Rental Note</label>
      <input class="form-input" id="mr-note" placeholder="e.g. Wedding makeup client">
    </div>
  `, async () => {
    const customerName = document.getElementById('mr-cust').value.trim();
    if (!customerName) { showToast('Please enter customer name', 'error'); return; }

    const phoneInput = document.getElementById('mr-phone').value.trim();
    let phoneVal = '';
    if (phoneInput) {
      const cleaned = validateAndCleanPhone(phoneInput);
      if (cleaned === null) { showToast('Please enter a valid phone number', 'error'); return; }
      phoneVal = cleaned;
    }

    const fee = parseInt(document.getElementById('mr-fee').value) || 0;
    if (fee <= 0) { showToast('Please enter rental fee amount', 'error'); return; }

    const deposit = parseInt(document.getElementById('mr-deposit').value) || 0;
    const rentDate = document.getElementById('mr-rent-date').value || today;
    const returnDate = document.getElementById('mr-return-date').value || null;
    const note = document.getElementById('mr-note').value.trim();

    // 1. Add rental transaction
    const rental = await addJewelRental({
      jewel_id: jewelId,
      customer_name: customerName,
      customer_phone: phoneVal,
      rental_date: rentDate,
      return_date: returnDate,
      rental_fee: fee,
      deposit: deposit,
      status: 'Active',
      note: note
    });

    if (rental) {
      // 2. Update Jewel Status and Earnings
      const nextEarnings = (jewel.total_rental_income || 0) + fee;
      await updateJewel(jewelId, {
        status: 'Rented',
        total_rental_income: nextEarnings
      });

      closeModal();
      if (typeof window.render === 'function') window.render();
    } else {
      const btn = document.getElementById('modal-save-btn');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-check"></i> Save';
      }
    }
  });
}

export async function openReturnJewelModal(jewelId) {
  const rentals = await fetchJewelRentals(jewelId);
  const activeRental = rentals.find(r => r.status === 'Active');
  
  if (!activeRental) {
    showToast('No active rental found for this jewel', 'error');
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  showModal('Process Jewel Return', `
    <div style="font-size:13px; color:#555; margin-bottom:14px;">
      Completing return for customer <strong>${activeRental.customer_name}</strong>.
      <br><span style="font-size:11.5px; color:#e53e3e; font-weight:600;">Refundable deposit to return: ₹${(activeRental.deposit || 0).toLocaleString('en-IN')}</span>
    </div>
    <div class="form-group">
      <label class="form-label">Return Date</label>
      <input class="form-input" id="mrt-date" type="date" value="${today}">
    </div>
    <div class="form-group" style="display:flex; align-items:center; gap:6px; margin-top:14px;">
      <input type="checkbox" id="mrt-deposit-returned" checked style="width:16px; height:16px; cursor:pointer;">
      <label for="mrt-deposit-returned" class="form-label" style="margin-bottom:0; cursor:pointer; font-weight:500;">Refundable deposit returned to customer?</label>
    </div>
  `, async () => {
    const returnDate = document.getElementById('mrt-date').value || today;
    const depositReturned = document.getElementById('mrt-deposit-returned').checked;

    const noteUpdate = depositReturned ? 'Deposit fully returned' : 'Deposit not returned / withheld';

    // 1. Update Rental Status
    const res1 = await updateJewelRental(activeRental.id, {
      status: 'Returned',
      return_date: returnDate,
      note: activeRental.note ? `${activeRental.note} (${noteUpdate})` : noteUpdate
    });

    // 2. Make Jewel Available
    const res2 = await updateJewel(jewelId, {
      status: 'Available'
    });

    if (res1 && res2) {
      closeModal();
      if (typeof window.render === 'function') window.render();
    } else {
      const btn = document.getElementById('modal-save-btn');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-check"></i> Complete Return';
      }
    }
  });

  // Make save button look like a primary return button
  setTimeout(() => {
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="ti ti-check"></i> Complete Return';
      saveBtn.style.background = '#d97706';
      saveBtn.style.borderColor = '#d97706';
    }
  }, 50);
}

export async function openJewelHistoryModal(jewelId) {
  const jewel = (window._cachedJewels || []).find(j => j.id === jewelId);
  if (!jewel) return;

  const rentals = await fetchJewelRentals(jewelId);

  let bodyHtml = `
    <div style="font-size:13px; color:#555; margin-bottom:14px;">
      Rental transactions for <strong>${jewel.name}</strong>.
      <br><span style="font-size:11px; color:#999;">Investment Cost: ₹${(jewel.purchase_price || 0).toLocaleString('en-IN')}</span>
    </div>
    <div class="scrollbar-hide" style="max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
  `;

  if (!rentals.length) {
    bodyHtml += `<div style="text-align:center; padding:20px; color:#aaa; font-size:12px;">No rental records logged</div>`;
  } else {
    bodyHtml += rentals.map(r => `
      <div style="background:#fafafa; border: 0.5px solid #eaeaea; border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; font-size:12.5px; color:#1a1a1a;">${r.customer_name} ${r.customer_phone ? `(${r.customer_phone})` : ''}</div>
          <div style="font-size:11px; color:#666; margin-top:2px;">
            Fee: <strong>₹${r.rental_fee}</strong> · Deposit: <strong>₹${r.deposit}</strong>
          </div>
          <div style="font-size:10px; color:#aaa; margin-top:1px;">
            Rented: ${r.rental_date} ${r.return_date ? `· Returned: ${r.return_date}` : '· Out on rent'}
          </div>
          ${r.note ? `<div style="font-size:10px; color:#be185d; margin-top:2px;">Note: ${r.note}</div>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="badge ${r.status === 'Returned' ? 'badge-green' : 'badge-amber'}" style="font-size:9.5px; padding:2px 6px;">${r.status}</span>
          <button class="btn btn-danger btn-icon" onclick="window.handleDeleteJewelRentalRecord('${jewelId}', '${r.id}', ${r.rental_fee})" style="width:28px; height:28px; padding:0; border-radius:6px;" title="Delete Record">
            <i class="ti ti-trash" style="font-size:12px;"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  bodyHtml += `</div>`;

  showModal('Jewellery Rental History', bodyHtml, null);
  
  // Hide save button
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';
}

export async function handleDeleteJewelRentalRecord(jewelId, rentalId, fee) {
  const confirmed = await showConfirmDelete('Delete Rental Log', 'Are you sure you want to delete this rental transaction? This will adjust the total rental earnings for this jewel.');
  if (!confirmed) return;

  const success = await deleteJewelRental(rentalId);
  if (success) {
    const jewel = (window._cachedJewels || []).find(j => j.id === jewelId);
    if (jewel) {
      const nextEarnings = Math.max(0, (jewel.total_rental_income || 0) - fee);
      await updateJewel(jewelId, {
        total_rental_income: nextEarnings,
        status: 'Available' // Return to available in case deleted active rental
      });
    }
    closeModal();
    if (typeof window.render === 'function') window.render();
  }
}

export async function handleDeleteJewelRecord(id) {
  const confirmed = await showConfirmDelete('Delete Jewellery Item', 'Are you sure you want to delete this jewel item and all of its rental transactions? This action cannot be reversed.');
  if (!confirmed) return;

  const success = await deleteJewel(id);
  if (success && typeof window.render === 'function') window.render();
}

export function triggerJewelImageSelect() {
  const el = document.getElementById('mj-image-file');
  if (el) el.click();
}

export function compressImage(file, maxDimension = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        const base64 = e.target.result.split(',')[1];
        resolve({ base64, mimeType: file.type });
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
}

export async function handleJewelImageUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const zone = document.getElementById('mj-image-zone');
  if (zone) {
    zone.innerHTML = '<div class="loading" style="justify-content:center;padding:10px"><div class="dot-anim"><span></span><span></span><span></span></div> Identifying Jewel...</div>';
  }

  try {
    const compressed = await compressImage(file);
    if (!compressed) {
      throw new Error('Image compression failed');
    }
    const { base64, mimeType } = compressed;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    window._lastJewelImageUrl = dataUrl;

    const data = await callGroqAPI('chat/completions', {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Identify the type of jewellery shown in the image from these options: "Necklace", "Bangles", "Earrings", "Maang Tikka", "Waist Chain", "Others". Also, suggest a descriptive name for this jewellery piece (e.g., "Antique Gold Choker", "Emerald Studded Bangles", "Ruby Jhumka Earrings"). Return JSON only: {"type": "Necklace" | "Bangles" | "Earrings" | "Maang Tikka" | "Waist Chain" | "Others", "name": "Suggested Name"}'
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl }
          }
        ]
      }],
      response_format: { type: "json_object" }
    });

    const raw = data.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    } catch (err) {
      parsed = {};
    }

    if (parsed.name) {
      const nameInput = document.getElementById('mj-name');
      if (nameInput) nameInput.value = parsed.name;
    }
    if (parsed.type) {
      const typeSelect = document.getElementById('mj-type');
      if (typeSelect) {
        const validTypes = ["Necklace", "Bangles", "Earrings", "Maang Tikka", "Waist Chain", "Others"];
        if (validTypes.includes(parsed.type)) {
          typeSelect.value = parsed.type;
        } else {
          typeSelect.value = "Others";
        }
      }
    }

    if (zone) {
      zone.innerHTML = `
        <img src="${dataUrl}" style="max-height: 80px; max-width: 100%; border-radius: 6px; object-fit: contain; margin-bottom: 4px;">
        <div style="font-size: 11px; color: #15803d; font-weight: 500;"><i class="ti ti-check"></i> Identified as ${parsed.type || 'Jewel'}</div>
      `;
    }
    showToast('Jewel type and name auto-detected!');
  } catch (err) {
    console.error(err);
    showToast('Could not analyze image. Please try again.', 'error');
    if (zone) {
      zone.innerHTML = `
        <i class="ti ti-camera" style="font-size:24px; color:#aaa; margin-bottom:4px;"></i>
        <span style="font-size:12px; color:#666;">Tap to upload or take a photo</span>
        <span style="font-size:10px; color:#bbb; margin-top:2px;">AI will detect type and suggest name</span>
      `;
    }
  }
}

// Bind to window object
window.filterJewelsList = filterJewelsList;
window.filterJewelsStatus = filterJewelsStatus;
window.updateJewelStatus = updateJewelStatus;
window.openAddJewelModal = openAddJewelModal;
window.openRentJewelModal = openRentJewelModal;
window.openReturnJewelModal = openReturnJewelModal;
window.openJewelHistoryModal = openJewelHistoryModal;
window.handleDeleteJewelRentalRecord = handleDeleteJewelRentalRecord;
window.handleDeleteJewelRecord = handleDeleteJewelRecord;
window.triggerJewelImageSelect = triggerJewelImageSelect;
window.handleJewelImageUpload = handleJewelImageUpload;
