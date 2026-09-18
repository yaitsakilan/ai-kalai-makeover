// billl/js/wifi.js
// WiFi Router Capture & Enforced Attendance Check-in for Kalai Makeover
import { showToast, showModal, closeModal } from './ui.js';
import { saveAttendance, fetchAttendance, fetchEmployees } from './db.js';

const WIFI_CONFIG_KEY = 'kalai_shop_wifi_router_config';

/**
 * Detect current network public IP address from browser client
 */
export async function detectCurrentNetwork() {
  const now = Date.now();
  if (window._cachedNetworkIp && window._cachedNetworkIpTime && (now - window._cachedNetworkIpTime < 45000)) {
    return { ip: window._cachedNetworkIp, timestamp: new Date(window._cachedNetworkIpTime).toISOString() };
  }

  // Method 1: ipify
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        const ip = data.ip.trim();
        window._cachedNetworkIp = ip;
        window._cachedNetworkIpTime = now;
        return { ip, timestamp: new Date().toISOString() };
      }
    }
  } catch (e) {}

  // Method 2: httpbin fallback
  try {
    const res2 = await fetch('https://httpbin.org/ip', { cache: 'no-store' });
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && data2.origin) {
        const ip = data2.origin.split(',')[0].trim();
        window._cachedNetworkIp = ip;
        window._cachedNetworkIpTime = now;
        return { ip, timestamp: new Date().toISOString() };
      }
    }
  } catch (e2) {}

  // Method 3: api64 fallback
  try {
    const res3 = await fetch('https://api64.ipify.org?format=json', { cache: 'no-store' });
    if (res3.ok) {
      const data3 = await res3.json();
      if (data3 && data3.ip) {
        const ip = data3.ip.trim();
        window._cachedNetworkIp = ip;
        window._cachedNetworkIpTime = now;
        return { ip, timestamp: new Date().toISOString() };
      }
    }
  } catch (e3) {}

  return { ip: null, error: 'Offline or network check failed' };
}

/**
 * Get registered salon WiFi configuration
 */
export function getShopWifiConfig() {
  try {
    const raw = localStorage.getItem(WIFI_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}

  return {
    configured: false,
    router_name: 'Kalai Makeover Studio WiFi',
    router_ip: '',
    allowed_ips: [],
    enforce_wifi: true,
    captured_at: null,
    captured_by: 'Owner (Kalai)'
  };
}

/**
 * Save registered salon WiFi configuration
 */
export function saveShopWifiConfig(config) {
  const current = getShopWifiConfig();
  const updated = {
    ...current,
    ...config,
    configured: !!(config.router_ip && config.router_ip.trim()),
    updated_at: new Date().toISOString()
  };
  localStorage.setItem(WIFI_CONFIG_KEY, JSON.stringify(updated));
  window._cachedShopWifiConfig = updated;
  return updated;
}

/**
 * Verify whether active device is on the registered salon WiFi router
 */
export async function verifyShopWifiConnection() {
  const config = getShopWifiConfig();

  // If WiFi has not been captured yet by owner, do not block staff until configured
  if (!config.configured || !config.router_ip) {
    return {
      isVerified: true,
      configured: false,
      enforced: false,
      routerName: config.router_name || 'Shop WiFi',
      currentIp: window._cachedNetworkIp || 'Unknown',
      reason: 'WiFi router not yet captured. Please capture salon WiFi.'
    };
  }

  // If owner toggled strict enforcement off
  if (config.enforce_wifi === false) {
    return {
      isVerified: true,
      configured: true,
      enforced: false,
      routerName: config.router_name,
      currentIp: window._cachedNetworkIp || 'Unknown',
      reason: 'WiFi restriction temporarily disabled by salon owner.'
    };
  }

  const net = await detectCurrentNetwork();
  const currentIp = net.ip;

  if (!currentIp) {
    return {
      isVerified: false,
      configured: true,
      enforced: true,
      currentIp: null,
      registeredIp: config.router_ip,
      routerName: config.router_name,
      reason: 'Unable to detect network. Please connect to salon WiFi.'
    };
  }

  const allowed = [config.router_ip, ...(config.allowed_ips || [])]
    .map(ip => String(ip).trim().toLowerCase())
    .filter(Boolean);

  const isMatch = allowed.includes(String(currentIp).trim().toLowerCase());

  return {
    isVerified: isMatch,
    configured: true,
    enforced: true,
    currentIp,
    registeredIp: config.router_ip,
    routerName: config.router_name,
    reason: isMatch ? 'Connected to salon WiFi router.' : 'Not connected to salon WiFi router.'
  };
}

/**
 * Modal to capture or re-capture current WiFi router
 */
export async function openCaptureWifiModal() {
  const config = getShopWifiConfig();

  showModal('Capture Salon WiFi Router', `
    <div style="text-align:center; padding: 10px 0 16px;">
      <div class="wifi-radar-icon-wrap" style="width:54px; height:54px; border-radius:50%; background:rgba(217,119,6,0.12); color:#d97706; display:inline-flex; align-items:center; justify-content:center; font-size:26px; margin-bottom:10px; border:1px solid rgba(217,119,6,0.25);">
        <i class="ti ti-wifi"></i>
      </div>
      <div style="font-weight:700; font-size:15px; color:#1a1a1a;" id="cw-modal-heading">Detecting Salon WiFi Router...</div>
      <div style="font-size:12px; color:#777; margin-top:3px;">Ensure this device is currently connected to the salon's WiFi router</div>
    </div>

    <div id="cw-detect-state" style="padding:14px; background:#fafafa; border:1px solid #ebebeb; border-radius:10px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#666;" id="cw-detect-spinner">
        <div class="spinner" style="width:16px; height:16px; border-width:2px;"></div>
        <span>Querying active router gateway IP...</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Salon WiFi Router Name / SSID *</label>
      <input class="form-input" id="cw-router-name" value="${config.router_name || 'Kalai Makeover Studio WiFi'}" placeholder="e.g. Kalai Makeover Studio 5G">
      <div style="font-size:10.5px; color:#888; margin-top:3px;">Friendly label displayed to staff on check-in screens</div>
    </div>

    <div class="form-group">
      <label class="form-label">Captured Router Public IP *</label>
      <input class="form-input" id="cw-router-ip" value="${config.router_ip || ''}" placeholder="e.g. 49.37.202.189" style="font-family:monospace; font-weight:600; color:#d97706;">
      <div style="font-size:10.5px; color:#888; margin-top:3px;">All phones and computers connected to this salon router share this public IP</div>
    </div>

    <div style="margin-top:14px; padding:12px; border-radius:10px; background:rgba(245,200,66,0.08); border:1px solid rgba(245,200,66,0.2);">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:600; color:#1a1a1a; margin:0;">
        <input type="checkbox" id="cw-enforce" ${config.enforce_wifi !== false ? 'checked' : ''} style="width:16px; height:16px; accent-color:#d97706; cursor:pointer;">
        <span>Enforce Strict WiFi Check-In (Recommended)</span>
      </label>
      <div style="font-size:11px; color:#777; margin-left:24px; margin-top:4px;">
        Staff can <strong>ONLY</strong> check in when connected to this WiFi router. Anyone on mobile data or at home will be blocked.
      </div>
    </div>
  `, async () => {
    const routerName = document.getElementById('cw-router-name')?.value.trim();
    const routerIp = document.getElementById('cw-router-ip')?.value.trim();
    const enforceWifi = document.getElementById('cw-enforce')?.checked ?? true;

    if (!routerName) {
      showToast('Please enter a name for the salon WiFi router', 'error');
      return;
    }
    if (!routerIp) {
      showToast('Please enter or detect the router IP', 'error');
      return;
    }

    saveShopWifiConfig({
      router_name: routerName,
      router_ip: routerIp,
      enforce_wifi: enforceWifi,
      captured_at: new Date().toISOString(),
      captured_by: 'Owner (Kalai)'
    });

    closeModal();
    showToast(`WiFi Router captured: ${routerName} (${routerIp})`);
    if (typeof window.render === 'function') await window.render();
  });

  // Automatically detect network in background and prefill
  setTimeout(async () => {
    const net = await detectCurrentNetwork();
    const stateEl = document.getElementById('cw-detect-state');
    const ipInput = document.getElementById('cw-router-ip');
    const headingEl = document.getElementById('cw-modal-heading');

    if (net.ip) {
      if (ipInput) ipInput.value = net.ip;
      if (headingEl) headingEl.textContent = 'Active Salon WiFi Router Detected!';
      if (stateEl) {
        stateEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge badge-green" style="font-size:11px; padding:3px 8px;"><i class="ti ti-circle-check"></i> Connected</span>
              <strong style="font-size:12.5px; color:#1a1a1a; font-family:monospace;">${net.ip}</strong>
            </div>
            <span style="font-size:11px; color:#15803d; font-weight:600;">Live Router Match</span>
          </div>
        `;
        stateEl.style.background = 'rgba(34,197,94,0.08)';
        stateEl.style.borderColor = 'rgba(34,197,94,0.3)';
      }
    } else {
      if (headingEl) headingEl.textContent = 'WiFi Detection Offline';
      if (stateEl) {
        stateEl.innerHTML = `
          <div style="font-size:12px; color:#dc2626; display:flex; align-items:center; gap:6px;">
            <i class="ti ti-alert-triangle"></i> Unable to auto-detect IP. You can type the router IP manually below.
          </div>
        `;
        stateEl.style.background = 'rgba(220,38,38,0.08)';
        stateEl.style.borderColor = 'rgba(220,38,38,0.3)';
      }
    }
  }, 100);
}

/**
 * Modal to edit WiFi router settings
 */
export function openWifiSettingsModal() {
  const config = getShopWifiConfig();

  showModal('Salon WiFi Attendance Settings', `
    <div class="form-group">
      <label class="form-label">WiFi Router Name</label>
      <input class="form-input" id="ws-router-name" value="${config.router_name || 'Kalai Makeover Studio WiFi'}">
    </div>

    <div class="form-group">
      <label class="form-label">Primary Router IP</label>
      <input class="form-input" id="ws-router-ip" value="${config.router_ip || ''}" style="font-family:monospace; font-weight:600;">
    </div>

    <div class="form-group">
      <label class="form-label">Secondary / Backup Router IPs (Optional)</label>
      <input class="form-input" id="ws-allowed-ips" value="${(config.allowed_ips || []).join(', ')}" placeholder="e.g. 49.37.202.190, 157.48.20.11">
      <div style="font-size:10.5px; color:#888; margin-top:3px;">Comma-separated if your shop has a 2nd WiFi router or backup hotspot</div>
    </div>

    <div style="margin-top:14px; padding:12px; border-radius:10px; background:rgba(245,200,66,0.08); border:1px solid rgba(245,200,66,0.2);">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:600; color:#1a1a1a; margin:0;">
        <input type="checkbox" id="ws-enforce" ${config.enforce_wifi !== false ? 'checked' : ''} style="width:16px; height:16px; accent-color:#d97706; cursor:pointer;">
        <span>Enforce Strict WiFi Check-In</span>
      </label>
      <div style="font-size:11px; color:#777; margin-left:24px; margin-top:4px;">
        When unchecked, staff can check in from any network (useful for offsite events)
      </div>
    </div>
  `, async () => {
    const routerName = document.getElementById('ws-router-name')?.value.trim();
    const routerIp = document.getElementById('ws-router-ip')?.value.trim();
    const rawAllowed = document.getElementById('ws-allowed-ips')?.value.trim() || '';
    const allowedIps = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
    const enforceWifi = document.getElementById('ws-enforce')?.checked ?? true;

    saveShopWifiConfig({
      router_name: routerName,
      router_ip: routerIp,
      allowed_ips: allowedIps,
      enforce_wifi: enforceWifi
    });

    closeModal();
    showToast('WiFi attendance settings updated!');
    if (typeof window.render === 'function') await window.render();
  });
}

/**
 * Quick Check-in modal from Attendance Log tab with instant WiFi verification
 */
export async function openQuickWifiPunchModal(employees = window._cachedEmployees || []) {
  if (!employees.length) {
    showToast('No employees registered in system.', 'error');
    return;
  }

  showModal('Quick Employee Attendance Punch', `
    <div style="padding: 12px; background: #fafafa; border: 1px solid #ebebeb; border-radius: 10px; margin-bottom: 16px;" id="qp-wifi-check-box">
      <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#666;">
        <div class="spinner" style="width:16px; height:16px; border-width:2px;"></div>
        <span>Verifying salon WiFi router connection...</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Select Employee *</label>
      <select class="form-input form-select" id="qp-emp-select" style="font-size:13px; font-weight:600;">
        ${employees.map(e => `<option value="${e.id}">${e.name} (${e.emp_id || 'ID: Staff'})</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Punch Type</label>
      <select class="form-input form-select" id="qp-punch-type">
        <option value="checkin">🟢 Check In (Start Shift)</option>
        <option value="checkout">🔴 Check Out (End Shift)</option>
      </select>
    </div>
  `, async () => {
    const empId = document.getElementById('qp-emp-select')?.value;
    const punchType = document.getElementById('qp-punch-type')?.value;
    if (!empId) {
      showToast('Please select an employee', 'error');
      return;
    }

    if (punchType === 'checkin') {
      await handleWifiCheckIn(empId);
    } else {
      // Checkout
      const attendance = window._cachedAttendance || [];
      const todayStr = new Date().toLocaleDateString('sv-SE');
      const activeLog = attendance.find(a => a.employee_id === empId && a.date === todayStr && a.check_in && !a.check_out);
      if (!activeLog) {
        showToast('No active check-in found for this employee today.', 'error');
        return;
      }
      await saveAttendance({
        ...activeLog,
        check_out: new Date().toISOString()
      });
      showToast('Checked out successfully!');
      closeModal();
      if (typeof window.render === 'function') await window.render();
    }
  });

  // Verify connection in modal background
  setTimeout(async () => {
    const box = document.getElementById('qp-wifi-check-box');
    const saveBtn = document.getElementById('modal-save-btn');
    const verify = await verifyShopWifiConnection();

    if (!box) return;

    if (verify.isVerified) {
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge badge-green" style="font-size:11px; padding:3px 8px;"><i class="ti ti-wifi"></i> WiFi Verified</span>
            <span style="font-size:12px; font-weight:600; color:#15803d;">${verify.routerName}</span>
          </div>
          <span style="font-size:10.5px; color:#888; font-family:monospace;">${verify.currentIp || ''}</span>
        </div>
      `;
      box.style.background = 'rgba(34,197,94,0.08)';
      box.style.borderColor = 'rgba(34,197,94,0.3)';
    } else {
      box.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; gap:6px; color:#dc2626; font-weight:600; font-size:12.5px;">
            <i class="ti ti-wifi-off"></i> Not Connected to Salon WiFi
          </div>
          <div style="font-size:11px; color:#666;">
            Current Network: <code style="color:#dc2626;">${verify.currentIp || 'Unknown'}</code> · Required Router: <code style="color:#15803d;">${verify.registeredIp}</code>
          </div>
        </div>
      `;
      box.style.background = 'rgba(220,38,38,0.08)';
      box.style.borderColor = 'rgba(220,38,38,0.3)';

      if (saveBtn && verify.enforced) {
        saveBtn.innerHTML = '<i class="ti ti-lock"></i> Blocked (WiFi Only)';
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.6';
      }
    }
  }, 50);
}

/**
 * Handle WiFi-verified check in for an employee
 */
export async function handleWifiCheckIn(empId, isOwnerOverride = false) {
  const config = getShopWifiConfig();
  const verify = await verifyShopWifiConnection();

  if (!verify.isVerified && !isOwnerOverride) {
    showModal('Attendance Check-In Blocked', `
      <div style="text-align:center; padding: 10px 0 16px;">
        <div style="width:54px; height:54px; border-radius:50%; background:rgba(220,38,38,0.12); color:#dc2626; display:inline-flex; align-items:center; justify-content:center; font-size:26px; margin-bottom:10px; border:1px solid rgba(220,38,38,0.25);">
          <i class="ti ti-wifi-off"></i>
        </div>
        <h3 style="font-size:16px; font-weight:700; color:#dc2626; margin:0 0 6px;">Wrong Network Detected</h3>
        <p style="font-size:12.5px; color:#666; margin:0;">You must be connected to the salon WiFi router to punch attendance.</p>
      </div>

      <div style="padding:14px; background:#fff5f5; border:1px solid #fecaca; border-radius:10px; font-size:12px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:#666;">Required Salon WiFi:</span>
          <strong style="color:#15803d;">${config.router_name}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:#666;">Salon Router IP:</span>
          <strong style="font-family:monospace; color:#15803d;">${config.router_ip || 'Not Configured'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-top:1px dashed #fca5a5; padding-top:6px;">
          <span style="color:#666;">Your Detected Network:</span>
          <strong style="font-family:monospace; color:#dc2626;">${verify.currentIp || 'Mobile Data / Remote'}</strong>
        </div>
      </div>

      <div style="font-size:11.5px; color:#777; line-height:1.5;">
        <strong>Instructions:</strong> Please turn on WiFi on your phone, connect to <strong>"${config.router_name}"</strong>, and tap Check In again.
      </div>
    `, () => {
      closeModal();
    });

    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.style.display = 'none';
    const cancelBtn = document.querySelector('#modal-container .btn-outline');
    if (cancelBtn) cancelBtn.textContent = 'Got It';
    return false;
  }

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

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const notesText = verify.isVerified 
    ? `WiFi Verified (${config.router_name} - ${verify.currentIp || 'Salon Router'})`
    : `Owner Override (${verify.currentIp || 'Manual'})`;

  const result = await saveAttendance({
    employee_id: empId,
    date: todayStr,
    check_in: new Date().toISOString(),
    status: status,
    notes: notesText
  });

  if (result) {
    closeModal();
    showToast(status === 'Late' 
      ? '⏰ Checked in! Marked as Late Entry (WiFi Verified)' 
      : '🎉 WiFi Verified! Checked in successfully via Salon Router');
    if (typeof window.render === 'function') await window.render();
    return true;
  }
  return false;
}

/**
 * Render the dedicated Salon WiFi Router Attendance Setup Card
 */
export function renderWifiAttendanceCard(employees = window._cachedEmployees || []) {
  const config = getShopWifiConfig();
  const isConfigured = config.configured && !!config.router_ip;

  return `
  <div class="card wifi-attendance-card" style="padding:18px 20px; margin-bottom:20px; border:1px solid rgba(217,119,6,0.25); position:relative; overflow:hidden;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
      
      <!-- Left: Title, Live Status & Info -->
      <div style="display:flex; align-items:flex-start; gap:14px; flex:1; min-width:280px;">
        <div class="wifi-radar-wrap" style="width:46px; height:46px; border-radius:12px; background:rgba(245,200,66,0.15); display:flex; align-items:center; justify-content:center; color:#d97706; font-size:24px; flex-shrink:0; border:1px solid rgba(245,200,66,0.3);">
          <i class="ti ti-wifi"></i>
        </div>

        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <h3 style="font-size:15px; font-weight:700; color:#1a1a1a; margin:0;">Salon WiFi Router Attendance Capture</h3>
            <span class="badge ${isConfigured ? 'badge-green' : 'badge-amber'}" style="font-size:10.5px; padding:2px 8px;">
              ${isConfigured ? '📶 Active Protected Router' : '⚠️ WiFi Router Not Captured'}
            </span>
          </div>
          
          <div style="font-size:11.5px; color:#888; margin-top:3px;">
            Geo-fenced check-in: Employees can only record attendance when connected to the shop's physical WiFi router.
          </div>

          <!-- Dynamic Live Status Pill -->
          <div id="wifi-live-status-pill" style="margin-top:10px; display:inline-flex; align-items:center; gap:8px; padding:5px 12px; border-radius:20px; font-size:11.5px; font-weight:600; background:rgba(217,119,6,0.08); border:1px solid rgba(217,119,6,0.2); color:#b45309;">
            <div class="spinner" style="width:12px; height:12px; border-width:2px;"></div>
            <span>Checking live WiFi router connection...</span>
          </div>

          <!-- Router Config Summary Chips -->
          <div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap; font-size:11px;">
            <div style="padding:3px 10px; border-radius:6px; background:rgba(245,200,66,0.1); border:1px solid rgba(245,200,66,0.25); color:#d97706; display:flex; align-items:center; gap:4px;">
              <i class="ti ti-router"></i> <strong>${config.router_name}</strong>
            </div>
            <div style="padding:3px 10px; border-radius:6px; background:rgba(245,200,66,0.1); border:1px solid rgba(245,200,66,0.25); font-family:monospace; color:#d97706;">
              IP: ${config.router_ip || 'Not Set'}
            </div>
            <div style="padding:3px 10px; border-radius:6px; background:${config.enforce_wifi ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.15)'}; border:1px solid ${config.enforce_wifi ? 'rgba(34,197,94,0.3)' : 'rgba(156,163,175,0.3)'}; color:${config.enforce_wifi ? '#15803d' : '#666'};">
              ${config.enforce_wifi ? '🔒 Strict (WiFi Only)' : '🔓 Flexible (Any Network)'}
            </div>
            ${config.captured_at ? `
              <div style="color:#999; font-size:10px;">
                Captured: ${new Date(config.captured_at).toLocaleDateString('en-IN')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Right: Action Buttons -->
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="btn btn-gold" onclick="window.openCaptureWifiModal()" style="font-size:12px; padding:6px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:6px;">
          <i class="ti ti-wifi"></i> ${isConfigured ? 'Re-capture Shop WiFi' : 'Capture Shop WiFi Router'}
        </button>

        <button class="btn btn-outline" onclick="window.openQuickWifiPunchModal()" style="font-size:12px; padding:6px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:6px;">
          <i class="ti ti-clock-check"></i> Punch Check-In
        </button>

        <button class="btn btn-outline btn-icon" onclick="window.openWifiSettingsModal()" title="WiFi Attendance Settings" style="width:34px; height:34px; padding:0; border-radius:8px; display:flex; align-items:center; justify-content:center;">
          <i class="ti ti-settings" style="font-size:16px;"></i>
        </button>
      </div>

    </div>
  </div>
  `;
}

/**
 * Initialize live WiFi status check on page load without blocking rendering
 */
export function initLiveWifiStatus() {
  setTimeout(async () => {
    const pill = document.getElementById('wifi-live-status-pill');
    if (!pill) return;

    const verify = await verifyShopWifiConnection();
    const config = getShopWifiConfig();

    if (!config.configured) {
      pill.innerHTML = `<i class="ti ti-alert-triangle" style="font-size:14px; color:#d97706;"></i> <span>Shop WiFi not captured yet. Connect to salon router and tap <strong>"Capture Shop WiFi Router"</strong></span>`;
      pill.style.background = 'rgba(217,119,6,0.1)';
      pill.style.borderColor = 'rgba(217,119,6,0.3)';
      pill.style.color = '#b45309';
      return;
    }

    if (verify.isVerified) {
      pill.innerHTML = `<i class="ti ti-circle-check" style="font-size:14px; color:#22c55e;"></i> <span>Connected to Salon WiFi Router (<strong>${config.router_name}</strong>) · IP: <code style="font-family:monospace;">${verify.currentIp || config.router_ip}</code> · Check-In Ready</span>`;
      pill.style.background = 'rgba(34,197,94,0.1)';
      pill.style.borderColor = 'rgba(34,197,94,0.3)';
      pill.style.color = '#15803d';
    } else {
      pill.innerHTML = `<i class="ti ti-wifi-off" style="font-size:14px; color:#dc2626;"></i> <span>Not on Salon WiFi (Your IP: <code style="font-family:monospace;">${verify.currentIp || 'Unknown'}</code> ≠ Shop: <code style="font-family:monospace;">${config.router_ip}</code>) · Check-in will be blocked</span>`;
      pill.style.background = 'rgba(220,38,38,0.1)';
      pill.style.borderColor = 'rgba(220,38,38,0.3)';
      pill.style.color = '#dc2626';
    }
  }, 100);
}

// Window bindings
window.openCaptureWifiModal = openCaptureWifiModal;
window.openWifiSettingsModal = openWifiSettingsModal;
window.openQuickWifiPunchModal = openQuickWifiPunchModal;
window.handleWifiCheckIn = handleWifiCheckIn;
window.verifyShopWifiConnection = verifyShopWifiConnection;
window.getShopWifiConfig = getShopWifiConfig;
window.saveShopWifiConfig = saveShopWifiConfig;
window.detectCurrentNetwork = detectCurrentNetwork;
window.renderWifiAttendanceCard = renderWifiAttendanceCard;
window.initLiveWifiStatus = initLiveWifiStatus;
