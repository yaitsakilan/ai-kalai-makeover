// billl/js/pages/ocr.js
import { fetchBillScans, addBillScan, addExpense, deleteBillScan } from '../db.js';
import { callGroqAPI } from '../api.js';
import { showToast } from '../ui.js';

export function normalizeOcrDate(rawDate) {
  if (!rawDate) return '';
  let d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  const match = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    let parsedDate = new Date(`${year}-${month}-${day}`);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }
  return '';
}

export async function renderOCR() {
  const scans = await fetchBillScans();
  const hasResult = !!window._lastOcrResult;

  setTimeout(() => {
    if (hasResult) {
      renderOcrResult();
      const clearBtn = document.getElementById('clear-ocr-btn');
      if (clearBtn) clearBtn.style.display = 'inline-flex';
    }
  }, 100);

  return `
  <div class="top-bar">
    <div>
      <h2>Bill Scanner</h2>
      <p style="font-size:12px;color:#999">Upload a receipt photo — AI will extract and save to Database</p>
    </div>
    <button class="btn btn-outline" onclick="window.clearOcrData()" id="clear-ocr-btn" style="display:${hasResult ? 'inline-flex' : 'none'}; align-items:center; gap:6px;">
      <i class="ti ti-refresh"></i> Clear Data
    </button>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="ocr-zone" onclick="window.triggerFileInput()" id="ocr-zone">
      <i class="ti ti-scan" style="font-size:40px;display:block;margin-bottom:10px;color:#ccc"></i>
      <div style="font-size:14px;font-weight:500;color:#555;margin-bottom:4px">Tap to upload bill photo</div>
      <div style="font-size:12px;color:#bbb">Supports JPG, PNG · Camera or gallery</div>
    </div>
    <input type="file" id="bill-file-input" accept="image/*" capture="environment" style="display:none" onchange="window.handleBillUpload(this)">
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-gold" style="flex:1" onclick="window.triggerFileInput()">
        <i class="ti ti-camera"></i> Camera
      </button>
      <button class="btn btn-outline" style="flex:1" onclick="window.triggerFileInput()">
        <i class="ti ti-upload"></i> Upload Photo
      </button>
    </div>
  </div>
  <div class="card" id="ocr-result" style="display:none">
    <div class="section-title"><i class="ti ti-file-text" style="color:#d97706"></i> Extracted Bill Details</div>
    <div id="ocr-data"></div>
  </div>
  <div class="card">
    <div class="section-title"><i class="ti ti-clock" style="color:#d97706;font-size:15px"></i> Recent Scans (from Database)</div>
    ${scans.length ? scans.map(s=>`
      <div class="expense-row">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${s.store||'Unknown Store'}</div>
          <div style="font-size:11px;color:#bbb">${(s.items||[]).map(i=>i.name).join(', ')} · ${s.scan_date||''}</div>
        </div>
        <div style="font-size:14px;font-weight:600;color:#d97706;margin-right:12px">₹${(s.total||0).toLocaleString()}</div>
        <div onclick="window.handleDeleteBillScan('${s.id}')" style="cursor:pointer;color:#ccc;padding:4px" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#ccc'">
          <i class="ti ti-trash" style="font-size:15px"></i>
        </div>
      </div>
    `).join('') : '<div style="text-align:center;padding:20px;color:#999;font-size:13px">No scans yet. Upload a bill to get started!</div>'}
  </div>`;
}

export function triggerFileInput() {
  const el = document.getElementById('bill-file-input');
  if(el) el.click();
}

function compressImage(file, maxDimension = 1200, quality = 0.8) {
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
        
        // Export to jpeg base64
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        // Fallback: use the original base64
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

export async function handleBillUpload(input) {
  const file = input.files[0];
  if(!file) return;

  const zone = document.getElementById('ocr-zone');
  if(zone) zone.innerHTML = '<div class="loading" style="justify-content:center;padding:20px"><div class="dot-anim"><span></span><span></span><span></span></div> Scanning bill with AI...</div>';

  try {
    const compressed = await compressImage(file);
    if (!compressed) {
      throw new Error('Image compression failed');
    }
    const { base64, mimeType } = compressed;

    const data = await callGroqAPI('chat/completions', {
      model:'meta-llama/llama-4-scout-17b-16e-instruct',
      messages:[{role:'user',content:[
        {type:'text',text:'Extract bill details from this receipt. All extracted amounts (items and total) must be strictly in INR (Indian Rupees). If the receipt is in a foreign currency like USD, EUR, or GBP, convert the amounts to INR (e.g. assume 1 USD = 80 INR) before returning them. The "date" field must be in YYYY-MM-DD format (e.g. "2024-01-15") if a date is found on the bill, otherwise empty string. Return JSON only: {"store":"","items":[{"name":"","amount":0}],"total":0,"date":""}'},
        {type:'image_url',image_url:{url:`data:${mimeType};base64,${base64}`}}
      ]}],
      response_format:{type:"json_object"}
    });
    
    const raw = data.choices?.[0]?.message?.content||'{}';
    let parsed;
    try { 
      parsed = JSON.parse(raw.replace(/```json|```/g,'').trim()); 
      if (parsed && parsed.items) {
        parsed.items = parsed.items.map(it => ({
          name: it.name,
          amount: Math.round(Number(it.amount) || 0)
        }));
      }
      if (parsed && parsed.total) {
        parsed.total = Math.round(Number(parsed.total) || 0);
      }
    } catch(err) { 
      parsed = {}; 
    }

    // Store parsed data for saving
    window._lastOcrResult = parsed;

    const clearBtn = document.getElementById('clear-ocr-btn');
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    renderOcrResult();
    if(zone) zone.innerHTML = '<i class="ti ti-check" style="font-size:32px;display:block;margin-bottom:8px;color:#15803d"></i><div style="font-size:13px;color:#15803d;font-weight:500">Bill scanned successfully!</div>';
  } catch(err) {
    console.error(err);
    showToast('Could not process image. Please try again.','error');
    if (zone) {
      zone.innerHTML = `
        <i class="ti ti-scan" style="font-size:40px;display:block;margin-bottom:10px;color:#ccc"></i>
        <div style="font-size:14px;font-weight:500;color:#555;margin-bottom:4px">Tap to upload bill photo</div>
        <div style="font-size:12px;color:#bbb">Supports JPG, PNG · Camera or gallery</div>
      `;
    }
  }
}

export async function saveOcrToSupabase() {
  const parsed = window._lastOcrResult;
  if(!parsed) { showToast('No scan data to save','error'); return; }

  const storeName = document.getElementById('ocr-store')?.value || parsed.store || 'Unknown';
  const billDate = document.getElementById('ocr-date')?.value || new Date().toISOString().split('T')[0];
  const itemSummary = (parsed.items || []).map(i => `${i.name} (₹${(i.amount || 0).toLocaleString()})`).join(', ');

  // Save as bill scan
  await addBillScan({
    store: storeName,
    items: parsed.items || [],
    total: parsed.total || 0,
    scan_date: billDate
  });

  // Also save as expense
  await addExpense({
    category: 'Products',
    amount: parsed.total || 0,
    date: billDate,
    note: `Bill from ${storeName}${itemSummary ? ' | Items: ' + itemSummary : ''}`
  });

  clearOcrData();
  if (typeof window.render === 'function') window.render();
}

export function renderOcrResult() {
  const resultEl = document.getElementById('ocr-result');
  const dataEl = document.getElementById('ocr-data');
  const parsed = window._lastOcrResult;
  if (!parsed || !resultEl || !dataEl) return;

  resultEl.style.display = 'block';
  
  parsed.total = (parsed.items || []).reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  
  const dateFromBill = normalizeOcrDate(parsed.date);
  const displayDate = dateFromBill || new Date().toISOString().split('T')[0];
  const dateWarning = dateFromBill ? '' : '<span style="color:#d97706;font-size:11px;margin-top:4px;display:block;"><i class="ti ti-alert-triangle"></i> Date not found in bill. Defaulted to today. Please check and adjust manually.</span>';

  dataEl.innerHTML = `
    <div style="margin-bottom:12px">
      <div class="form-label">Store / Vendor</div>
      <input class="form-input" id="ocr-store" value="${parsed.store || ''}" oninput="window._lastOcrResult.store = this.value">
    </div>
    <div style="margin-bottom:12px">
      <div class="form-label">Bill Date</div>
      <input class="form-input" id="ocr-date" type="date" value="${displayDate}" oninput="window._lastOcrResult.date = this.value">
      ${dateWarning}
    </div>
    <div style="margin-bottom:12px">
      <div class="form-label" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
        <span>Items</span>
        <button class="btn btn-outline" style="padding: 4px 10px; font-size: 11px; height: 26px; gap: 4px; display: inline-flex; align-items: center;" onclick="window.addOcrItem()"><i class="ti ti-plus"></i> Add Item</button>
      </div>
      ${(parsed.items || []).map((it, idx) => `
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;" id="ocr-item-row-${idx}">
          <input class="form-input" style="flex:2" id="ocr-item-name-${idx}" value="${it.name || ''}" oninput="window.updateOcrItem(${idx}, 'name', this.value)">
          <input class="form-input" style="flex:1; text-align:right;" id="ocr-item-amt-${idx}" type="number" value="${it.amount || 0}" oninput="window.updateOcrItem(${idx}, 'amount', this.value)">
          <button class="btn btn-danger btn-icon" style="width:34px; height:34px; border-radius:8px; padding:0; flex-shrink:0; display:flex; align-items:center; justify-content:center;" onclick="window.deleteOcrItem(${idx})" title="Delete item">
            <i class="ti ti-trash" style="font-size:15px;"></i>
          </button>
        </div>
      `).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#fffbeb;border-radius:10px;margin-bottom:12px">
      <span style="font-weight:600">Total Amount</span>
      <span style="font-size:18px;font-weight:700;color:#d97706" id="ocr-total-display">₹${(parsed.total || 0).toLocaleString()}</span>
    </div>
    <button class="btn btn-gold" style="width:100%" onclick="window.saveOcrToSupabase()"><i class="ti ti-check"></i> Save as Expense to Database</button>`;
}

export function updateOcrItem(idx, field, value) {
  if (!window._lastOcrResult || !window._lastOcrResult.items || !window._lastOcrResult.items[idx]) return;
  if (field === 'amount') {
    window._lastOcrResult.items[idx].amount = Number(value) || 0;
    const total = window._lastOcrResult.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    window._lastOcrResult.total = total;
    const totalDisp = document.getElementById('ocr-total-display');
    if (totalDisp) totalDisp.textContent = '₹' + total.toLocaleString();
  } else {
    window._lastOcrResult.items[idx].name = value;
  }
}

export function deleteOcrItem(idx) {
  if (!window._lastOcrResult || !window._lastOcrResult.items) return;
  window._lastOcrResult.items.splice(idx, 1);
  renderOcrResult();
}

export function addOcrItem() {
  if (!window._lastOcrResult) return;
  if (!window._lastOcrResult.items) window._lastOcrResult.items = [];
  window._lastOcrResult.items.push({ name: '', amount: 0 });
  renderOcrResult();
}

export function clearOcrData() {
  window._lastOcrResult = null;
  const resultEl = document.getElementById('ocr-result');
  if (resultEl) resultEl.style.display = 'none';
  
  const clearBtn = document.getElementById('clear-ocr-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  
  const zone = document.getElementById('ocr-zone');
  if (zone) {
    zone.innerHTML = `
      <i class="ti ti-scan" style="font-size:40px;display:block;margin-bottom:10px;color:#ccc"></i>
      <div style="font-size:14px;font-weight:500;color:#555;margin-bottom:4px">Tap to upload bill photo</div>
      <div style="font-size:12px;color:#bbb">Supports JPG, PNG · Camera or gallery</div>
    `;
  }
}

export async function handleDeleteBillScan(id) {
  if(!confirm('Delete this bill scan?')) return;
  await deleteBillScan(id);
  if (typeof window.render === 'function') window.render();
}

// Bind to window to allow HTML inline click handlers to execute
window.renderOCR = renderOCR;
window.triggerFileInput = triggerFileInput;
window.handleBillUpload = handleBillUpload;
window.saveOcrToSupabase = saveOcrToSupabase;
window.updateOcrItem = updateOcrItem;
window.deleteOcrItem = deleteOcrItem;
window.addOcrItem = addOcrItem;
window.clearOcrData = clearOcrData;
window.handleDeleteBillScan = handleDeleteBillScan;
