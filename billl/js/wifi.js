// billl/js/wifi.js
// WiFi Router Capture & Enforced Attendance Check-in for Kalai Makeover
import { showToast, showModal, closeModal, showConfirmDelete } from './ui.js';
import { state } from './state.js';
import { saveAttendance, fetchAttendance, fetchEmployees, fetchShopSetting, saveShopSetting } from './db.js';

// This phone's copy of the shop WiFi; the shared one is the 'shop_wifi' row in shop_settings
const WIFI_CONFIG_KEY = 'kalai_shop_wifi_router_config';
const WIFI_SETTING_KEY = 'shop_wifi';
const NOT_SHARED_MESSAGE = 'Saved on this phone only, so staff phones can\'t check in. Run shop_settings_migration.sql in Supabase, then capture the WiFi again.';

// Phones on the salon router share its public IPv4 address, but each phone gets its own IPv6 address,
// so only IPv4 answers can be compared with the captured router IP
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const IP_LOOKUPS = [
  { url: 'https://api.ipify.org?format=json', read: data => data.ip },
  { url: 'https://httpbin.org/ip', read: data => String(data.origin || '').split(',')[0] }
];

const DEFAULT_WIFI_CONFIG = {
  configured: false,
  router_name: 'Kalai Makeover Studio WiFi',
  router_ip: '',
  allowed_ips: [],
  enforce_wifi: true,
  captured_at: null,
  captured_by: 'Owner (Kalai)'
};

/**
 * Detect current network public IPv4 address from browser client. Always a fresh lookup, so joining the
 * salon WiFi and tapping Check In again works straight away.
 */
export async function detectCurrentNetwork() {
  for (const lookup of IP_LOOKUPS) {
    try {
      const res = await fetch(lookup.url, { cache: 'no-store' });
      if (!res.ok) continue;
      const ip = String(lookup.read(await res.json()) || '').trim();
      if (IPV4_PATTERN.test(ip)) return { ip, timestamp: new Date().toISOString() };
    } catch (e) {}
  }

  return { ip: null, error: 'Offline or network check failed' };
}

function getDeviceWifiCopy() {
  try {
    const raw = localStorage.getItem(WIFI_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}
  return null;
}

/**
 * Get registered salon WiFi configuration as last loaded (call loadShopWifiConfig first for the shared one)
 */
export function getShopWifiConfig() {
  return window._cachedShopWifiConfig || getDeviceWifiCopy() || { ...DEFAULT_WIFI_CONFIG };
}

/**
 * Load the salon WiFi shared by every phone. Sets window._shopWifiShareState to 'shared', 'device-only'
 * (captured on this phone but never stored in the database) or 'unavailable' (database can't be read).
 */
export async function loadShopWifiConfig() {
  let shared;
  try {
    shared = await fetchShopSetting(WIFI_SETTING_KEY);
  } catch (e) {
    console.warn('Shop WiFi setting could not be loaded, using this phone\'s copy:', e);
    window._shopWifiShareState = 'unavailable';
    window._cachedShopWifiConfig = getDeviceWifiCopy() || { ...DEFAULT_WIFI_CONFIG };
    return window._cachedShopWifiConfig;
  }

  if (shared) {
    const config = { ...DEFAULT_WIFI_CONFIG, ...shared };
    try { localStorage.setItem(WIFI_CONFIG_KEY, JSON.stringify(config)); } catch (e) {}
    window._shopWifiShareState = 'shared';
    window._cachedShopWifiConfig = config;
    return config;
  }

  // Never stored in the database: a WiFi captured on this phone earlier still applies here
  window._shopWifiShareState = 'device-only';
  window._cachedShopWifiConfig = getDeviceWifiCopy() || { ...DEFAULT_WIFI_CONFIG };
  return window._cachedShopWifiConfig;
}

/**
 * Save registered salon WiFi configuration for every phone. Returns { config, shared }, where shared is
 * false when it could only be kept on this phone.
 */
export async function saveShopWifiConfig(config) {
  const current = getShopWifiConfig();
  const updated = {
    ...current,
    ...config,
    configured: !!(config.router_ip && config.router_ip.trim()),
    updated_at: new Date().toISOString()
  };
  try { localStorage.setItem(WIFI_CONFIG_KEY, JSON.stringify(updated)); } catch (e) {}
  window._cachedShopWifiConfig = updated;

  const shared = await saveShopSetting(WIFI_SETTING_KEY, updated);
  window._shopWifiShareState = shared ? 'shared' : 'unavailable';
  return { config: updated, shared };
}

/**
 * Verify whether active device is on the registered salon WiFi router
 */
export async function verifyShopWifiConnection() {
  const config = await loadShopWifiConfig();

  // Nobody can check in by WiFi until the owner has captured the salon WiFi
  if (!config.configured || !config.router_ip) {
    return {
      isVerified: false,
      configured: false,
      enforced: true,
      routerName: config.router_name || 'Shop WiFi',
      currentIp: null,
      reason: 'Shop WiFi is not set up yet. Ask the owner to capture the salon WiFi.'
    };
  }

  // If owner toggled strict enforcement off
  if (config.enforce_wifi === false) {
    return {
      isVerified: true,
      configured: true,
      enforced: false,
      routerName: config.router_name,
      currentIp: null,
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
      <div class="wifi-radar-icon-wrap" style="width:54px; height:54px; border-radius:50%; background:rgba(217,119,6,0.15); color:#f5c842; display:inline-flex; align-items:center; justify-content:center; font-size:26px; margin-bottom:10px; border:1px solid rgba(245,200,66,0.3);">
        <i class="ti ti-wifi"></i>
      </div>
      <div style="font-weight:700; font-size:15px; color:var(--text-primary, #ffffff);" id="cw-modal-heading">Detecting Salon WiFi Router...</div>
      <div style="font-size:12px; color:var(--text-muted, #94a3b8); margin-top:3px;">Ensure this device is currently connected to the salon's WiFi router</div>
    </div>

    <div id="cw-detect-state" style="padding:14px; background:rgba(245,200,66,0.06); border:1px solid rgba(245,200,66,0.2); border-radius:10px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-secondary, #cbd5e1);" id="cw-detect-spinner">
        <div class="spinner" style="width:16px; height:16px; border-width:2px;"></div>
        <span>Querying active router gateway IP...</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" style="font-weight:600;">Salon WiFi Router Name / SSID *</label>
      <input class="form-input" id="cw-router-name" value="${config.router_name || 'Kalai Makeover Studio WiFi'}" placeholder="e.g. Kalai Makeover Studio 5G">
      <div style="font-size:10.5px; color:var(--text-muted, #94a3b8); margin-top:3px;">Friendly label displayed to staff on check-in screens</div>
    </div>

    <div class="form-group">
      <label class="form-label" style="font-weight:600;">Captured Router Public IP *</label>
      <input class="form-input" id="cw-router-ip" value="${config.router_ip || ''}" placeholder="e.g. 49.37.202.189" style="font-family:monospace; font-weight:600; color:#f5c842;">
      <div style="font-size:10.5px; color:var(--text-muted, #94a3b8); margin-top:3px;">All phones and computers connected to this salon router share this public IP</div>
    </div>

    <div style="margin-top:14px; padding:12px; border-radius:10px; background:rgba(245,200,66,0.08); border:1px solid rgba(245,200,66,0.25);">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:600; color:var(--text-primary, #ffffff); margin:0;">
        <input type="checkbox" id="cw-enforce" ${config.enforce_wifi !== false ? 'checked' : ''} style="width:16px; height:16px; accent-color:#f5c842; cursor:pointer;">
        <span>Enforce Strict WiFi Check-In (Recommended)</span>
      </label>
      <div style="font-size:11px; color:var(--text-muted, #94a3b8); margin-left:24px; margin-top:4px;">
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
    if (!IPV4_PATTERN.test(routerIp)) {
      showToast('Enter the router IP as 4 numbers, e.g. 49.37.202.189', 'error');
      return;
    }

    const { shared } = await saveShopWifiConfig({
      router_name: routerName,
      router_ip: routerIp,
      enforce_wifi: enforceWifi,
      captured_at: new Date().toISOString(),
      captured_by: 'Owner (Kalai)'
    });

    closeModal();
    showToast(shared ? `WiFi Router captured: ${routerName} (${routerIp})` : NOT_SHARED_MESSAGE, shared ? 'success' : 'error');
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
              <strong style="font-size:12.5px; color:#22c55e; font-family:monospace;">${net.ip}</strong>
            </div>
            <span style="font-size:11px; color:#22c55e; font-weight:600;">Live Router Match</span>
          </div>
        `;
        stateEl.style.background = 'rgba(34,197,94,0.12)';
        stateEl.style.borderColor = 'rgba(34,197,94,0.35)';
      }
    } else {
      if (headingEl) headingEl.textContent = 'WiFi Detection Offline';
      if (stateEl) {
        stateEl.innerHTML = `
          <div style="font-size:12px; color:#ef4444; display:flex; align-items:center; gap:6px;">
            <i class="ti ti-alert-triangle"></i> Unable to auto-detect IP. You can type the router IP manually below.
          </div>
        `;
        stateEl.style.background = 'rgba(220,38,38,0.1)';
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
      <label class="form-label" style="font-weight:600;">WiFi Router Name</label>
      <input class="form-input" id="ws-router-name" value="${config.router_name || 'Kalai Makeover Studio WiFi'}">
    </div>

    <div class="form-group">
      <label class="form-label" style="font-weight:600;">Primary Router IP</label>
      <input class="form-input" id="ws-router-ip" value="${config.router_ip || ''}" style="font-family:monospace; font-weight:600; color:#f5c842;">
    </div>

    <div class="form-group">
      <label class="form-label" style="font-weight:600;">Secondary / Backup Router IPs (Optional)</label>
      <input class="form-input" id="ws-allowed-ips" value="${(config.allowed_ips || []).join(', ')}" placeholder="e.g. 49.37.202.190, 157.48.20.11">
      <div style="font-size:10.5px; color:var(--text-muted, #94a3b8); margin-top:3px;">Comma-separated if your shop has a 2nd WiFi router or backup hotspot</div>
    </div>

    <div style="margin-top:14px; padding:12px; border-radius:10px; background:rgba(245,200,66,0.08); border:1px solid rgba(245,200,66,0.25);">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:600; color:var(--text-primary, #ffffff); margin:0;">
        <input type="checkbox" id="ws-enforce" ${config.enforce_wifi !== false ? 'checked' : ''} style="width:16px; height:16px; accent-color:#f5c842; cursor:pointer;">
        <span>Enforce Strict WiFi Check-In</span>
      </label>
      <div style="font-size:11px; color:var(--text-muted, #94a3b8); margin-left:24px; margin-top:4px;">
        When unchecked, staff can check in from any network (useful for offsite events)
      </div>
    </div>
  `, async () => {
    const routerName = document.getElementById('ws-router-name')?.value.trim();
    const routerIp = document.getElementById('ws-router-ip')?.value.trim();
    const rawAllowed = document.getElementById('ws-allowed-ips')?.value.trim() || '';
    const allowedIps = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
    const enforceWifi = document.getElementById('ws-enforce')?.checked ?? true;

    // Without a router IP nobody could check in; turning off the strict check is the way to allow any network
    if (!routerIp) {
      showToast('Please enter the router IP', 'error');
      return;
    }
    const badIp = [routerIp, ...allowedIps].find(ip => !IPV4_PATTERN.test(ip));
    if (badIp) {
      showToast(`"${badIp}" is not a router IP. Use 4 numbers, e.g. 49.37.202.189`, 'error');
      return;
    }

    const { shared } = await saveShopWifiConfig({
      router_name: routerName,
      router_ip: routerIp,
      allowed_ips: allowedIps,
      enforce_wifi: enforceWifi
    });

    closeModal();
    showToast(shared ? 'WiFi attendance settings updated!' : NOT_SHARED_MESSAGE, shared ? 'success' : 'error');
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
    <div style="padding: 12px; background: rgba(245,200,66,0.06); border: 1px solid rgba(245,200,66,0.2); border-radius: 10px; margin-bottom: 16px;" id="qp-wifi-check-box">
      <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-secondary, #cbd5e1);">
        <div class="spinner" style="width:16px; height:16px; border-width:2px;"></div>
        <span>Verifying salon WiFi router connection...</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" style="font-weight:600;">Select Employee *</label>
      <select class="form-input form-select" id="qp-emp-select" style="font-size:13px; font-weight:600;">
        ${employees.map(e => `<option value="${e.id}">${e.name} (${e.emp_id || 'ID: Staff'})</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label" style="font-weight:600;">Punch Type</label>
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
            <span style="font-size:12px; font-weight:600; color:#22c55e;">${verify.routerName}</span>
          </div>
          <span style="font-size:10.5px; opacity:0.8; font-family:monospace;">${verify.currentIp || ''}</span>
        </div>
      `;
      box.style.background = 'rgba(34,197,94,0.12)';
      box.style.borderColor = 'rgba(34,197,94,0.35)';
    } else if (!verify.configured) {
      box.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; color:#ef4444; font-weight:600; font-size:12.5px;">
          <i class="ti ti-wifi-off"></i> ${verify.reason}
        </div>
      `;
      box.style.background = 'rgba(220,38,38,0.1)';
      box.style.borderColor = 'rgba(220,38,38,0.3)';

      if (saveBtn) {
        saveBtn.innerHTML = '<i class="ti ti-lock"></i> Blocked (WiFi Only)';
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.6';
      }
    } else {
      box.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; gap:6px; color:#ef4444; font-weight:600; font-size:12.5px;">
            <i class="ti ti-wifi-off"></i> Not Connected to Salon WiFi
          </div>
          <div style="font-size:11px; color:var(--text-muted, #94a3b8);">
            Current Network: <code style="color:#ef4444; font-weight:600;">${verify.currentIp || 'Unknown'}</code> · Required Router: <code style="color:#22c55e; font-weight:600;">${verify.registeredIp}</code>
          </div>
        </div>
      `;
      box.style.background = 'rgba(220,38,38,0.1)';
      box.style.borderColor = 'rgba(220,38,38,0.3)';

      if (saveBtn && verify.enforced) {
        saveBtn.innerHTML = '<i class="ti ti-lock"></i> Blocked (WiFi Only)';
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.6';
      }
    }
  }, 50);
}

let checkInInProgress = false;

/**
 * Handle WiFi-verified check in for an employee
 */
export async function handleWifiCheckIn(empId, isOwnerOverride = false) {
  // A second tap while the first is still being verified would save the day twice
  if (checkInInProgress) return false;
  checkInInProgress = true;
  try {
    return await checkInEmployee(empId, isOwnerOverride);
  } finally {
    checkInInProgress = false;
  }
}

async function checkInEmployee(empId, isOwnerOverride) {
  const todayStr = new Date().toLocaleDateString('sv-SE');
  const todayLog = (await fetchAttendance()).find(a => a.employee_id === empId && a.date === todayStr && a.check_in);
  if (todayLog) {
    const checkInTime = new Date(todayLog.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    showToast(todayLog.status === 'Pending'
      ? `Today's check-in (${checkInTime}) is waiting for the owner's approval`
      : `Already checked in today at ${checkInTime}`, 'error');
    return false;
  }

  const verify = await verifyShopWifiConnection();
  const config = getShopWifiConfig();

  // Staff off the shop WiFi can still check in by giving a reason; it counts once the owner approves
  if (!verify.isVerified && state.userRole === 'employee') {
    openOffWifiCheckInModal(empId, todayStr, verify, config);
    return false;
  }

  if (!verify.isVerified && !isOwnerOverride) {
    showModal('Attendance Check-In Blocked', `
      <div style="text-align:center; padding: 10px 0 16px;">
        <div style="width:54px; height:54px; border-radius:50%; background:rgba(220,38,38,0.12); color:#ef4444; display:inline-flex; align-items:center; justify-content:center; font-size:26px; margin-bottom:10px; border:1px solid rgba(220,38,38,0.25);">
          <i class="ti ti-wifi-off"></i>
        </div>
        <h3 style="font-size:16px; font-weight:700; color:#ef4444; margin:0 0 6px;">${verify.configured ? 'Wrong Network Detected' : 'Shop WiFi Not Set Up'}</h3>
        <p style="font-size:12.5px; color:var(--text-muted, #cbd5e1); margin:0;">${verify.configured ? 'You must be connected to the salon WiFi router to punch attendance.' : verify.reason}</p>
      </div>

      ${verify.configured ? `<div style="padding:14px; background:rgba(220,38,38,0.08); border:1px solid rgba(220,38,38,0.25); border-radius:10px; font-size:12px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:var(--text-muted, #94a3b8);">Required Salon WiFi:</span>
          <strong style="color:#22c55e;">${config.router_name}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:var(--text-muted, #94a3b8);">Salon Router IP:</span>
          <strong style="font-family:monospace; color:#22c55e;">${config.router_ip || 'Not Configured'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-top:1px dashed rgba(220,38,38,0.3); padding-top:6px;">
          <span style="color:var(--text-muted, #94a3b8);">Your Detected Network:</span>
          <strong style="font-family:monospace; color:#ef4444;">${verify.currentIp || 'Mobile Data / Remote'}</strong>
        </div>
      </div>

      <div style="font-size:11.5px; color:var(--text-secondary, #cbd5e1); line-height:1.5;">
        <strong>Instructions:</strong> Please turn on WiFi on your phone, connect to <strong>"${config.router_name}"</strong>, and tap Check In again.
      </div>` : ''}
    `, () => {
      closeModal();
    });

    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.style.display = 'none';
    const cancelBtn = document.querySelector('#modal-container .btn-outline');
    if (cancelBtn) cancelBtn.textContent = 'Got It';
    return false;
  }

  const emp = (window._cachedEmployees || []).find(e => e.id === empId);
  const status = getCheckInStatus(emp, new Date());

  // Only a real match is recorded as "WiFi Verified" (the attendance log shows the badge from this)
  const notesText = !verify.isVerified
    ? `Owner Override (${verify.currentIp || 'Manual'})`
    : verify.enforced
      ? `WiFi Verified (${config.router_name} - ${verify.currentIp})`
      : 'Network not checked (strict check turned off by owner)';

  const result = await saveAttendance({
    employee_id: empId,
    date: todayStr,
    check_in: new Date().toISOString(),
    status: status,
    notes: notesText
  });

  if (result) {
    closeModal();
    if (!verify.enforced) {
      showToast(status === 'Late' ? '⏰ Checked in! Marked as Late Entry' : 'Checked in successfully!');
    } else {
      showToast(status === 'Late'
        ? '⏰ Checked in! Marked as Late Entry (WiFi Verified)'
        : '🎉 WiFi Verified! Checked in successfully via Salon Router');
    }
    if (typeof window.render === 'function') await window.render();
    return true;
  }
  return false;
}

// Present or Late, from the employee's shift start and the time they checked in
function getCheckInStatus(emp, checkInTime) {
  if (!emp || !emp.shift_start) return 'Present';
  const [shHour, shMin] = emp.shift_start.split(':').map(Number);
  const shiftTime = new Date(checkInTime);
  shiftTime.setHours(shHour, shMin, 0, 0);
  return checkInTime > shiftTime ? 'Late' : 'Present';
}

// Off-WiFi check-ins are saved with status 'Pending' and notes "Off WiFi · Reason: … · Network: …".
// The owner's decision is put in front of the notes, and the status becomes Present/Late or Rejected.
const OFF_WIFI_NOTE = 'Off WiFi';

export function getOffWifiReason(notes) {
  const text = String(notes || '');
  const start = text.indexOf(`${OFF_WIFI_NOTE} · Reason: `);
  if (start < 0) return '';
  const reasonStart = start + `${OFF_WIFI_NOTE} · Reason: `.length;
  const end = text.lastIndexOf(' · Network: ');
  return text.slice(reasonStart, end > reasonStart ? end : undefined);
}

function resetModalSaveButton(html) {
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = html;
  }
}

const SEND_FOR_APPROVAL_HTML = '<i class="ti ti-send"></i> Send for Approval';

function openOffWifiCheckInModal(empId, todayStr, verify, config) {
  showModal('Check In Without Shop WiFi', `
    <div style="text-align:center; padding: 4px 0 14px;">
      <div style="width:50px; height:50px; border-radius:50%; background:rgba(217,119,6,0.12); color:#d97706; display:inline-flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:10px;">
        <i class="ti ti-wifi-off"></i>
      </div>
      <p style="font-size:13px; margin:0; line-height:1.5;">
        ${verify.configured
          ? `You're not connected to <strong>${config.router_name}</strong>. Connect to it and tap Check In again.`
          : 'The shop WiFi is not set up yet.'}
      </p>
    </div>
    <div class="form-group" style="margin-bottom:0;">
      <label class="form-label">Why are you checking in without the shop WiFi? *</label>
      <textarea class="form-input" id="ow-reason" rows="3" placeholder="e.g. Bridal makeup at the client's home"></textarea>
      <div style="font-size:11px; color:var(--text-muted, #94a3b8); margin-top:4px;">It counts as attendance once the owner approves it.</div>
    </div>
  `, async () => {
    const reason = document.getElementById('ow-reason').value.trim();
    if (reason.length < 3) {
      showToast('Please write why you are checking in without the shop WiFi', 'error');
      resetModalSaveButton(SEND_FOR_APPROVAL_HTML);
      return;
    }

    const result = await saveAttendance({
      employee_id: empId,
      date: todayStr,
      check_in: new Date().toISOString(),
      status: 'Pending',
      notes: `${OFF_WIFI_NOTE} · Reason: ${reason} · Network: ${verify.currentIp || 'Unknown'}`
    });

    if (result) {
      closeModal();
      showToast('Check-in sent to the owner for approval');
      if (typeof window.render === 'function') await window.render();
    } else {
      showToast('Could not send the check-in. Please try again.', 'error');
      resetModalSaveButton(SEND_FOR_APPROVAL_HTML);
    }
  });

  resetModalSaveButton(SEND_FOR_APPROVAL_HTML);
}

async function findPendingCheckIn(logId) {
  const log = (await fetchAttendance()).find(a => a.id === logId);
  if (!log || log.status !== 'Pending') {
    showToast('This check-in was already decided', 'error');
    if (typeof window.render === 'function') await window.render();
    return null;
  }
  return log;
}

/**
 * Owner approves an off-WiFi check-in: it counts as Present or Late from the time they checked in
 */
export async function approveOffWifiCheckIn(logId) {
  const log = await findPendingCheckIn(logId);
  if (!log) return false;

  const emp = (await fetchEmployees().catch(() => [])).find(e => e.id === log.employee_id);
  const result = await saveAttendance({
    ...log,
    status: getCheckInStatus(emp, new Date(log.check_in)),
    notes: `Approved by owner · ${log.notes}`
  });
  if (!result) return false;

  showToast('Check-in approved');
  if (typeof window.render === 'function') await window.render();
  return true;
}

/**
 * Owner rejects an off-WiFi check-in: it stays in the log but never counts as attendance
 */
export async function rejectOffWifiCheckIn(logId) {
  const confirmed = await showConfirmDelete('Don\'t Approve Check-In', 'This day will not count as attendance for this employee.', 'Don\'t Approve');
  if (!confirmed) return false;

  const log = await findPendingCheckIn(logId);
  if (!log) return false;

  const result = await saveAttendance({ ...log, status: 'Rejected', notes: `Not approved by owner · ${log.notes}` });
  if (!result) return false;

  showToast('Check-in not approved');
  if (typeof window.render === 'function') await window.render();
  return true;
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
            <h3 class="wifi-card-title" style="font-size:15px; font-weight:700; margin:0;">Salon WiFi Router Attendance Capture</h3>
            <span class="badge ${isConfigured ? 'badge-green' : 'badge-amber'}" style="font-size:10.5px; padding:2px 8px;">
              ${isConfigured ? '📶 Active Protected Router' : '⚠️ WiFi Router Not Captured'}
            </span>
          </div>
          
          <div style="font-size:11.5px; color:var(--text-muted, #94a3b8); margin-top:3px;">
            Geo-fenced check-in: Employees can only record attendance when connected to the shop's physical WiFi router.
          </div>

          <!-- Dynamic Live Status Pill -->
          <div id="wifi-live-status-pill" style="margin-top:10px; display:inline-flex; align-items:center; gap:8px; padding:5px 12px; border-radius:20px; font-size:11.5px; font-weight:600; background:rgba(217,119,6,0.1); border:1px solid rgba(217,119,6,0.25); color:#f5c842;">
            <div class="spinner" style="width:12px; height:12px; border-width:2px;"></div>
            <span>Checking live WiFi router connection...</span>
          </div>

          <!-- Router Config Summary Chips -->
          <div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap; font-size:11px;">
            <div style="padding:3px 10px; border-radius:6px; background:rgba(245,200,66,0.1); border:1px solid rgba(245,200,66,0.25); color:#f5c842; display:flex; align-items:center; gap:4px;">
              <i class="ti ti-router"></i> <strong>${config.router_name}</strong>
            </div>
            <div style="padding:3px 10px; border-radius:6px; background:rgba(245,200,66,0.1); border:1px solid rgba(245,200,66,0.25); font-family:monospace; color:#f5c842;">
              IP: ${config.router_ip || 'Not Set'}
            </div>
            <div style="padding:3px 10px; border-radius:6px; background:${config.enforce_wifi ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.15)'}; border:1px solid ${config.enforce_wifi ? 'rgba(34,197,94,0.35)' : 'rgba(156,163,175,0.3)'}; color:${config.enforce_wifi ? '#22c55e' : '#cbd5e1'};">
              ${config.enforce_wifi ? '🔒 Strict (WiFi Only)' : '🔓 Flexible (Any Network)'}
            </div>
            ${config.captured_at ? `
              <div style="color:var(--text-muted, #94a3b8); font-size:10px;">
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
      pill.innerHTML = `<i class="ti ti-alert-triangle" style="font-size:14px; color:#d97706;"></i> <span>Shop WiFi not captured yet, so staff can't check in. Connect to salon router and tap <strong>"Capture Shop WiFi Router"</strong></span>`;
      pill.style.background = 'rgba(217,119,6,0.1)';
      pill.style.borderColor = 'rgba(217,119,6,0.3)';
      pill.style.color = '#b45309';
      return;
    }

    // Staff phones only get the WiFi once it is stored in the database
    if (window._shopWifiShareState !== 'shared') {
      pill.innerHTML = window._shopWifiShareState === 'unavailable'
        ? `<i class="ti ti-alert-triangle" style="font-size:14px; color:#d97706;"></i> <span>Staff phones can't read the shop WiFi. If not done yet, run <strong>shop_settings_migration.sql</strong> in Supabase, then tap <strong>"Re-capture Shop WiFi"</strong> at the salon</span>`
        : `<i class="ti ti-alert-triangle" style="font-size:14px; color:#d97706;"></i> <span>Shop WiFi is saved on this phone only, so staff can't check in. Tap <strong>"Re-capture Shop WiFi"</strong> at the salon</span>`;
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
window.approveOffWifiCheckIn = approveOffWifiCheckIn;
window.rejectOffWifiCheckIn = rejectOffWifiCheckIn;
window.verifyShopWifiConnection = verifyShopWifiConnection;
window.getShopWifiConfig = getShopWifiConfig;
window.loadShopWifiConfig = loadShopWifiConfig;
window.saveShopWifiConfig = saveShopWifiConfig;
window.detectCurrentNetwork = detectCurrentNetwork;
window.renderWifiAttendanceCard = renderWifiAttendanceCard;
window.initLiveWifiStatus = initLiveWifiStatus;
