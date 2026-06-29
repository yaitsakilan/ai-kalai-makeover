// billl/js/pages/expenses.js
import { state } from '../state.js';
import { fetchExpenses, addExpense, deleteExpense } from '../db.js';
import { showToast, showModal, closeModal, closeFormOverlay, showConfirmDelete } from '../ui.js';
import { callGroqAPI } from '../api.js';

export async function renderExpenses() {
  const expenses = await fetchExpenses();
  const total = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const cats = {};
  expenses.forEach(e=>{ cats[e.category]=(cats[e.category]||0)+(e.amount||0); });

  return `
  <div class="top-bar">
    <h2>Expense Management</h2>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-outline" onclick="window.analyzeExpenses()">
        <i class="ti ti-chart-bar" style="color:#d97706"></i> AI Analysis
      </button>
      <button class="btn btn-outline" onclick="window.openBulkExpenseForm()" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;border:none;"><i class="ti ti-receipt-2"></i> Bulk Expense</button>
      <button class="btn btn-gold" onclick="window.showAddExpenseModal()"><i class="ti ti-plus"></i> Add Expense</button>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px;padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div class="section-title" style="margin-bottom:0">All Expenses</div>
      <div style="font-size:22px;font-weight:700;color:#dc2626">₹${total.toLocaleString()}</div>
    </div>
    ${Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`
      <div class="service-row">
        <div style="width:30px;height:30px;border-radius:8px;background:#fef3c7;display:flex;align-items:center;justify-content:center">
          <i class="ti ${expenseIcon(cat)}" style="font-size:15px;color:#d97706"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${cat}</div>
          <div style="background:#f0f0f0;border-radius:3px;height:5px;margin-top:5px;overflow:hidden">
            <div style="height:5px;border-radius:3px;background:#f5c842;width:${total?Math.round((amt/total)*100):0}%"></div>
          </div>
        </div>
        <div style="text-align:right;min-width:80px">
          <div style="font-size:13px;font-weight:600">₹${amt.toLocaleString()}</div>
          <div style="font-size:11px;color:#bbb">${total?Math.round((amt/total)*100):0}%</div>
        </div>
      </div>
    `).join('')}
  </div>
  <div class="card">
    <div class="section-title">Transaction History</div>
    ${expenses.map(e=>`
      <div class="expense-row">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${e.note||e.category}</div>
          <div style="font-size:11px;color:#bbb">${e.category} · ${e.date}</div>
        </div>
        <div style="font-size:14px;font-weight:600;color:#dc2626;margin-right:12px">-₹${(e.amount||0).toLocaleString()}</div>
        <div onclick="window.handleDeleteExpense('${e.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#ccc'">
          <i class="ti ti-trash" style="font-size:15px"></i>
        </div>
      </div>
    `).join('')}
  </div>`;
}

export function showAddExpenseModal() {
  showModal('Add Expense', `
    <div class="form-group">
      <label class="form-label">Category *</label>
      <select class="form-input form-select" id="m-exp-category">
        <option>Rent</option><option>Salary</option><option>Products</option><option>Electricity</option>
        <option>Water</option><option>Travel</option><option>Miscellaneous</option>
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Amount (₹) *</label>
        <input class="form-input" id="m-exp-amount" type="number" placeholder="5000">
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" id="m-exp-date" type="date" value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Note</label>
      <input class="form-input" id="m-exp-note" placeholder="Description...">
    </div>
  `, async () => {
    const amount = parseInt(document.getElementById('m-exp-amount').value);
    if(!amount) { showToast('Please enter amount','error'); return; }
    await addExpense({
      category: document.getElementById('m-exp-category').value,
      amount,
      date: document.getElementById('m-exp-date').value || new Date().toISOString().split('T')[0],
      note: document.getElementById('m-exp-note').value.trim() || document.getElementById('m-exp-category').value
    });
    closeModal();
    if (typeof window.render === 'function') window.render();
  });
}

export function openBulkExpenseForm() {
  const container = document.getElementById('form-overlay-container');
  if (!container) return;
  container.innerHTML = `
    <div class="form-overlay" onclick="window.closeFormOverlay()">
      <div class="form-panel" onclick="event.stopPropagation()" style="width:650px; max-width:95vw;">
        <div class="form-panel-header">
          <h3><i class="ti ti-receipt-2" style="color:#7c3aed"></i> Bulk Expense Form</h3>
          <div onclick="window.closeFormOverlay()" style="cursor:pointer;color:#999;font-size:22px;padding:4px;display:flex;align-items:center;"><i class="ti ti-x"></i></div>
        </div>
        <div class="form-panel-body" style="max-height:65vh; overflow-y:auto;">
          <p style="font-size:12px; color:#666; margin-bottom:14px;">Add multiple expense transactions at once. Click "+ Add Item" to add more rows.</p>
          
          <div style="display:flex; flex-direction:column; gap:10px;" id="bulk-expense-list">
            <!-- Rows dynamically loaded here -->
          </div>
          
          <button class="btn btn-outline" style="margin-top:14px; width:100%; justify-content:center; border-style:dashed; border-color:#7c3aed; color:#7c3aed;" onclick="window.addBulkExpenseRow()">
            <i class="ti ti-plus"></i> Add Item
          </button>
          
          <div class="sa-total-bar" id="bulk-total-bar" style="margin-top:18px; background:#f5f3ff; border:1px solid #ddd6fe; display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-radius:10px;">
            <span class="sa-total-label" style="color:#6d28d9; font-weight:600;">Grand Total</span>
            <span class="sa-total-value" id="bulk-total-amount" style="color:#7c3aed; font-size:20px; font-weight:700;">₹0</span>
          </div>
        </div>
        <div class="form-panel-footer">
          <button class="btn btn-outline" onclick="window.closeFormOverlay()"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-gold" onclick="window.submitBulkExpenseForm()" id="bulk-submit-btn" style="background:#7c3aed; color:white;"><i class="ti ti-check"></i> Save All Expenses</button>
        </div>
      </div>
    </div>`;

  // Start with 2 initial rows
  state.bulkRowCounter = 0;
  addBulkExpenseRow();
  addBulkExpenseRow();
}

export function addBulkExpenseRow() {
  const today = new Date().toISOString().split('T')[0];
  const list = document.getElementById('bulk-expense-list');
  if (!list) return;
  const rowId = `bulk-row-${state.bulkRowCounter++}`;
  
  const rowDiv = document.createElement('div');
  rowDiv.className = 'bulk-expense-row';
  rowDiv.id = rowId;
  rowDiv.style = "display:grid; grid-template-columns:1.5fr 1.2fr 1.2fr 2fr auto; gap:8px; align-items:center; padding:10px; background:#fcfcfc; border:0.5px solid #ebebeb; border-radius:10px; position:relative;";
  
  rowDiv.innerHTML = `
    <div>
      <select class="form-input form-select" style="padding:6px 8px; font-size:12px; height:32px;" name="category">
        <option value="Products">Products</option>
        <option value="Rent">Rent</option>
        <option value="Salary">Salary</option>
        <option value="Electricity">Electricity</option>
        <option value="Water">Water</option>
        <option value="Travel">Travel</option>
        <option value="Miscellaneous">Miscellaneous</option>
      </select>
    </div>
    <div>
      <input class="form-input" type="number" placeholder="Amount (₹)" style="padding:6px 8px; font-size:12px; height:32px; text-align:right;" name="amount" oninput="window.updateBulkExpenseTotal()">
    </div>
    <div>
      <input class="form-input" type="date" value="${today}" style="padding:6px 8px; font-size:12px; height:32px;" name="date">
    </div>
    <div>
      <input class="form-input" placeholder="Note (e.g. shampoo, June Rent)" style="padding:6px 8px; font-size:12px; height:32px;" name="note">
    </div>
    <div>
      <button class="btn btn-danger btn-icon" style="width:32px; height:32px; padding:0; border-radius:8px; display:flex; align-items:center; justify-content:center;" onclick="window.removeBulkExpenseRow('${rowId}')" title="Delete row">
        <i class="ti ti-trash" style="font-size:14px"></i>
      </button>
    </div>
  `;
  
  list.appendChild(rowDiv);
  updateBulkExpenseTotal();
}

export function removeBulkExpenseRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
  }
  updateBulkExpenseTotal();
}

export function updateBulkExpenseTotal() {
  const rows = document.querySelectorAll('#bulk-expense-list .bulk-expense-row');
  let total = 0;
  rows.forEach(r => {
    const amtInput = r.querySelector('input[name="amount"]');
    total += parseInt(amtInput?.value) || 0;
  });
  
  const el = document.getElementById('bulk-total-amount');
  if (el) el.textContent = '₹' + total.toLocaleString();
}

export async function submitBulkExpenseForm() {
  const rows = document.querySelectorAll('#bulk-expense-list .bulk-expense-row');
  const items = [];
  
  rows.forEach(r => {
    const category = r.querySelector('select[name="category"]').value;
    const amount = parseInt(r.querySelector('input[name="amount"]').value) || 0;
    const date = r.querySelector('input[name="date"]').value || new Date().toISOString().split('T')[0];
    const note = r.querySelector('input[name="note"]').value.trim();
    
    if (amount > 0) {
      items.push({ category, amount, date, note: note || category });
    }
  });
  
  if (items.length === 0) {
    showToast('Please enter at least one expense amount greater than 0', 'error');
    return;
  }
  
  const btn = document.getElementById('bulk-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...';
  }
  
  let successCount = 0;
  for (let item of items) {
    const result = await addExpense(item);
    if (result) successCount++;
  }
  
  if (successCount > 0) {
    closeFormOverlay();
    showToast(`Successfully saved ${successCount} expenses!`);
    state.chatMessages.push({
      role: 'ai',
      text: `✅ Saved <strong>${successCount}</strong> bulk expenses via manual form! 🎉<br><span style="font-size:11px;color:#888">${items.map(i => `${i.note}: ₹${i.amount.toLocaleString()}`).join(' · ')}</span>`
    });
    if (typeof window.render === 'function') window.render();
    scrollChatBottom();
  } else {
    showToast('Failed to save expenses', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-check"></i> Save All Expenses';
    }
  }
}

export async function handleDeleteExpense(id) {
  const confirmed = await showConfirmDelete('Delete Expense', 'Are you sure you want to delete this expense transaction? This action cannot be undone.');
  if (!confirmed) return;
  await deleteExpense(id);
  if (typeof window.render === 'function') window.render();
}

export function expenseIcon(cat) {
  const map={Rent:'ti-building',Salary:'ti-users',Electricity:'ti-bolt',Water:'ti-droplet',Travel:'ti-car',Products:'ti-package',Miscellaneous:'ti-dots'};
  return map[cat]||'ti-receipt';
}

export async function analyzeExpenses() {
  showModal('Operating Expenses AI Analysis', `
    <div class="loading-page" style="height: 180px;">
      <div class="spinner"></div>
      <div style="margin-top:12px;font-weight:500;color:#555;">AI is analyzing salon expenses...</div>
      <div style="font-size:12px;color:#999;margin-top:6px;">Comparing rent, salary, product inventory, and operational utility spend</div>
    </div>
  `, null);
  
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  const cancelBtn = document.querySelector('#modal-container .btn-outline');
  if (cancelBtn) cancelBtn.textContent = 'Close';

  try {
    const expenses = await fetchExpenses();
    
    if (expenses.length === 0) {
      document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center;padding:20px;color:#999;">
          <i class="ti ti-receipt" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>
          No expense entries found to analyze yet.
        </div>`;
      return;
    }

    const resData = await callGroqAPI('chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an elite salon finance analyst. Analyze the provided operational expense data for Kalai Makeover salon.
Format the output as clean HTML suitable for the inner body of a modal window.
Do NOT use html, head, or body tags. Start directly with report content.
Use standard classes from our app:
- <div class="form-section-title"><i class="ti ti-..."></i> Title</div> for section headers
- <span class="badge badge-green">...</span>, badge-amber, badge-blue, badge-gray for values
- Use grids or list items for clean layout
- Style key metrics prominently.

Guidelines:
- All monetary values in the report must be strictly formatted in INR using the Rupee symbol (₹) (e.g., ₹12,500). Never use USD, dollars, or the $ symbol.

The HTML should contain:
1. Executive Summary: Short overview of operational costs.
2. Metric Grid: Styled list or columns showing: Total Expenses, Number of Transactions, Top Expense Category, Average Transaction Amount.
3. Category Breakdown: Which categories (Rent, Salary, Products, utilities like Electricity/Water) drive the highest overhead.
4. Business Optimization Tips: Actionable suggestions for Kalai to reduce product waste, manage utilities, or negotiate supplier rates to improve net profit margin.
Make it concise, insightful, and formatted beautifully.`
        },
        {
          role: 'user',
          content: `Here is the expense data in JSON format: ${JSON.stringify(expenses.map(e => ({
            category: e.category,
            amount: e.amount,
            date: e.date,
            note: e.note
          })))}`
        }
      ],
      temperature: 0.2
    });

    const htmlReport = resData.choices?.[0]?.message?.content || '<p>Analysis could not be generated.</p>';
    const cleanedReport = htmlReport.replace(/```html|```/g, '').trim();

    document.getElementById('modal-body').innerHTML = `
      <div style="max-height:60vh;overflow-y:auto;padding-right:4px;" class="scrollbar-hide">
        ${cleanedReport}
      </div>`;

  } catch (err) {
    console.error('Analysis error:', err);
    document.getElementById('modal-body').innerHTML = `
      <div style="color:#dc2626;text-align:center;padding:20px;">
        <i class="ti ti-alert-triangle" style="font-size:32px;display:block;margin-bottom:10px;"></i>
        Failed to load AI Analysis. Please try again.
      </div>`;
  }
}

export function openProductExpenseForm() {
  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('form-overlay-container');
  if (!container) return;
  container.innerHTML = `
    <div class="form-overlay" onclick="window.closeFormOverlay()">
      <div class="form-panel" onclick="event.stopPropagation()" style="width:650px; max-width:95vw;">
        <div class="form-panel-header">
          <h3><i class="ti ti-receipt-2" style="color:#7c3aed"></i> Product Expense Form</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-outline btn-icon" id="form-mic-btn" onclick="window.startVoiceRecording('product_expense')" title="Fill form with voice" style="width:34px; height:34px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; border-color:#e5e5e5; transition: all 0.2s ease;">
              <i class="ti ti-microphone" style="font-size:16px; color:#7c3aed;"></i>
            </button>
            <div onclick="window.closeFormOverlay()" style="cursor:pointer;color:#999;font-size:22px;padding:4px;display:flex;align-items:center;"><i class="ti ti-x"></i></div>
          </div>
        </div>
        <div class="form-panel-body" style="max-height:65vh; overflow-y:auto;">
          <div id="form-voice-container"></div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Expense Date</label>
              <input class="form-input" id="pe-date" type="date" value="${today}">
            </div>
            <div class="form-group">
              <label class="form-label">Shop Name</label>
              <input class="form-input" id="pe-shop" type="text" placeholder="e.g. Cosmo Store">
            </div>
          </div>

          <div class="form-section-title" style="color:#6d28d9">
            <i class="ti ti-package"></i> Salon Product Items
            <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap a product, then enter amount</span>
          </div>
          <div class="form-group">
            <div class="chip-group" id="pe-product-chips">
              ${['Hair Color Gell', 'Hair Color Power', 'Hand Glouse', 'Spa Cream', 'Razer', 'Tissues', 'Facial Kit', 'Wiper', 'Rose Water', 'Smoothing Cream', 'Others'].map(s =>
                `<div class="chip" onclick="window.productExpenseChipToggle(this, 'product')">${s}</div>`
              ).join('')}
            </div>
            <div class="chip-other-input" id="pe-product-other-div">
              <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
                <input class="form-input" id="pe-product-other" placeholder="Enter custom product name..." style="flex:1">
                <button class="btn btn-gold" onclick="window.addOtherProductExpenseAmount('product')" style="padding:8px 14px;font-size:12px;white-space:nowrap;background:#7c3aed;border-color:#7c3aed;color:white;"><i class="ti ti-plus" style="font-size:14px"></i> Add</button>
              </div>
            </div>
            <div class="service-amount-list" id="pe-product-amounts"></div>
          </div>

          <div class="form-section-title" style="color:#be185d">
            <i class="ti ti-brush"></i> Makeup Items & Accessories
            <span style="margin-left:auto;font-size:10px;color:#bbb;text-transform:none;letter-spacing:0;font-weight:400">Tap an item, then enter amount</span>
          </div>
          <div class="form-group">
            <div class="chip-group" id="pe-makeup-chips">
              ${['Wet Wiper', 'Flashes', 'Hair Extension', 'Holding Spray', 'Shine Spray', 'Hair Pin', 'Safty Pin', 'Fixing Spray', 'Moves', 'Flowers', 'Kajal', 'Others'].map(s =>
                `<div class="chip" onclick="window.productExpenseChipToggle(this, 'makeup')">${s}</div>`
              ).join('')}
            </div>
            <div class="chip-other-input" id="pe-makeup-other-div">
              <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
                <input class="form-input" id="pe-makeup-other" placeholder="Enter custom makeup item name..." style="flex:1">
                <button class="btn btn-gold" onclick="window.addOtherProductExpenseAmount('makeup')" style="padding:8px 14px;font-size:12px;white-space:nowrap;background:#be185d;border-color:#be185d;color:white;"><i class="ti ti-plus" style="font-size:14px"></i> Add</button>
              </div>
            </div>
            <div class="service-amount-list" id="pe-makeup-amounts"></div>
          </div>

          <div class="sa-total-bar" id="pe-total-bar" style="display:none; background:#f5f3ff; border:1px solid #ddd6fe; justify-content:space-between; align-items:center; padding:12px 16px; border-radius:10px; margin-top: 18px;">
            <span class="sa-total-label" style="color:#6d28d9; font-weight:600;">Grand Total</span>
            <span class="sa-total-value" id="pe-total-amount" style="color:#7c3aed; font-size:20px; font-weight:700;">₹0</span>
          </div>
        </div>
        <div class="form-panel-footer">
          <button class="btn btn-outline" onclick="window.closeFormOverlay()"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-gold" onclick="window.submitProductExpenseForm()" id="pe-submit-btn" style="background:#7c3aed; color:white; border-color:#7c3aed;"><i class="ti ti-check"></i> Save Expenses</button>
        </div>
      </div>
    </div>`;
}

export function productExpenseChipToggle(chipEl, category) {
  const name = chipEl.textContent.trim();
  chipEl.classList.toggle('selected');
  
  const targetAmountsId = category === 'product' ? 'pe-product-amounts' : 'pe-makeup-amounts';
  const amountList = document.getElementById(targetAmountsId);
  if (!amountList) return;

  if (name === 'Others') {
    const otherDivId = category === 'product' ? 'pe-product-other-div' : 'pe-makeup-other-div';
    const otherInput = document.getElementById(otherDivId);
    if (chipEl.classList.contains('selected')) {
      if (otherInput) otherInput.classList.add('show');
    } else {
      if (otherInput) otherInput.classList.remove('show');
    }
    return;
  }

  const prefix = category === 'product' ? 'pe-row-prod-' : 'pe-row-make-';
  const rowId = prefix + name.replace(/\s+/g, '-').toLowerCase();

  if (chipEl.classList.contains('selected')) {
    if (!document.getElementById(rowId)) {
      const row = document.createElement('div');
      row.className = 'service-amount-row';
      row.id = rowId;
      row.dataset.name = name;
      row.dataset.category = category;
      
      const icon = category === 'product' ? 'ti-package' : 'ti-brush';
      const color = category === 'product' ? '#6d28d9' : '#be185d';
      
      row.innerHTML = `
        <div class="sa-name" style="color:${color}"><i class="ti ${icon}"></i><input type="text" class="sa-name-input" value="${name}"></div>
        <span style="font-size:12px;color:#888">₹</span>
        <input type="number" placeholder="Amount" oninput="window.updateProductExpenseTotal()" style="width: 80px;">
        <div class="sa-remove" onclick="window.removeProductExpenseRow('${rowId}', '${name}', '${category}')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
      amountList.appendChild(row);
    }
  } else {
    const row = document.getElementById(rowId);
    if (row) row.remove();
  }
  updateProductExpenseTotal();
}

export function addOtherProductExpenseAmount(category) {
  const otherInputId = category === 'product' ? 'pe-product-other' : 'pe-makeup-other';
  const otherNameInput = document.getElementById(otherInputId);
  const otherName = otherNameInput ? otherNameInput.value.trim() : '';
  if (!otherName) { showToast('Please enter the name first', 'error'); return; }

  const targetAmountsId = category === 'product' ? 'pe-product-amounts' : 'pe-makeup-amounts';
  const amountList = document.getElementById(targetAmountsId);
  if (!amountList) return;

  const rowId = `pe-row-${category === 'product' ? 'prod' : 'make'}-other-${Date.now()}`;
  const row = document.createElement('div');
  row.className = 'service-amount-row';
  row.id = rowId;
  row.dataset.name = otherName;
  row.dataset.category = category;

  const icon = category === 'product' ? 'ti-package' : 'ti-brush';
  const color = category === 'product' ? '#6d28d9' : '#be185d';

  row.innerHTML = `
    <div class="sa-name" style="color:${color}"><i class="ti ${icon}"></i><input type="text" class="sa-name-input" value="${otherName}"></div>
    <span style="font-size:12px;color:#888">₹</span>
    <input type="number" placeholder="Amount" oninput="window.updateProductExpenseTotal()" style="width: 80px;">
    <div class="sa-remove" onclick="window.removeProductExpenseRow('${rowId}', null, '${category}')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
  amountList.appendChild(row);
  
  otherNameInput.value = '';
  otherNameInput.focus();
  updateProductExpenseTotal();
}

export function removeProductExpenseRow(rowId, name, category) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  if (name) {
    const chipContainerId = category === 'product' ? 'pe-product-chips' : 'pe-makeup-chips';
    const chips = document.querySelectorAll(`#${chipContainerId} .chip`);
    chips.forEach(c => { if (c.textContent.trim() === name) c.classList.remove('selected'); });
  }
  updateProductExpenseTotal();
}

export function updateProductExpenseTotal() {
  const productRows = document.querySelectorAll('#pe-product-amounts .service-amount-row');
  const makeupRows = document.querySelectorAll('#pe-makeup-amounts .service-amount-row');
  
  let total = 0;
  productRows.forEach(r => { total += parseInt(r.querySelector('input')?.value) || 0; });
  makeupRows.forEach(r => { total += parseInt(r.querySelector('input')?.value) || 0; });

  const el = document.getElementById('pe-total-amount');
  if (el) el.textContent = '₹' + total.toLocaleString();

  const bar = document.getElementById('pe-total-bar');
  if (bar) {
    bar.style.display = (productRows.length > 0 || makeupRows.length > 0) ? 'flex' : 'none';
  }
}

export async function submitProductExpenseForm() {
  const productRows = document.querySelectorAll('#pe-product-amounts .service-amount-row');
  const makeupRows = document.querySelectorAll('#pe-makeup-amounts .service-amount-row');
  
  const date = document.getElementById('pe-date').value || new Date().toISOString().split('T')[0];
  const shopName = document.getElementById('pe-shop')?.value.trim() || '';
  const items = [];

  productRows.forEach(r => {
    const nameInput = r.querySelector('.sa-name-input');
    const name = nameInput ? nameInput.value.trim() : r.dataset.name;
    const amount = parseInt(r.querySelector('input')?.value) || 0;
    if (amount > 0) {
      const note = shopName ? `Products: ${name} (${shopName})` : `Products: ${name}`;
      items.push({ category: 'Products', amount, date, note });
    }
  });

  makeupRows.forEach(r => {
    const nameInput = r.querySelector('.sa-name-input');
    const name = nameInput ? nameInput.value.trim() : r.dataset.name;
    const amount = parseInt(r.querySelector('input')?.value) || 0;
    if (amount > 0) {
      const note = shopName ? `Makeup: ${name} (${shopName})` : `Makeup: ${name}`;
      items.push({ category: 'Products', amount, date, note });
    }
  });

  if (items.length === 0) {
    showToast('Please enter at least one product/makeup amount greater than 0', 'error');
    return;
  }

  const btn = document.getElementById('pe-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...';
  }

  let successCount = 0;
  for (let item of items) {
    const result = await addExpense(item);
    if (result) successCount++;
  }

  if (successCount > 0) {
    closeFormOverlay();
    showToast(`Successfully saved ${successCount} expenses!`);
    state.chatMessages.push({
      role: 'ai',
      text: `✅ Saved <strong>${successCount}</strong> product/makeup expenses via manual form! 🎉<br><span style="font-size:11px;color:#888">${items.map(i => `${i.note}: ₹${i.amount.toLocaleString()}`).join(' · ')}</span>`
    });
    if (typeof window.render === 'function') window.render();
    
    const chatEl = document.getElementById('chat-messages');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  } else {
    showToast('Failed to save expenses', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-check"></i> Save Expenses';
    }
  }
}

// Bind to window to allow HTML inline click handlers to execute
window.openBulkExpenseForm = openBulkExpenseForm;
window.addBulkExpenseRow = addBulkExpenseRow;
window.removeBulkExpenseRow = removeBulkExpenseRow;
window.updateBulkExpenseTotal = updateBulkExpenseTotal;
window.submitBulkExpenseForm = submitBulkExpenseForm;
window.showAddExpenseModal = showAddExpenseModal;
window.handleDeleteExpense = handleDeleteExpense;
window.analyzeExpenses = analyzeExpenses;
window.expenseIcon = expenseIcon;
window.openProductExpenseForm = openProductExpenseForm;
window.productExpenseChipToggle = productExpenseChipToggle;
window.addOtherProductExpenseAmount = addOtherProductExpenseAmount;
window.removeProductExpenseRow = removeProductExpenseRow;
window.updateProductExpenseTotal = updateProductExpenseTotal;
window.submitProductExpenseForm = submitProductExpenseForm;
