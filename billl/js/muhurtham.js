// billl/js/muhurtham.js
// Live Panchangam & Subha Muhurtham Dates integration using Nitya Panchangam API
// Free tier with CC-BY attribution: https://nityapanchangam.com/api/

import { showToast } from './ui.js';

const API_BASE = 'https://nityapanchangam.com/api/panchangam.php';
const CACHE_PREFIX = 'panchangam_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Pre-curated Subha Muhurtham dates for Tamil Nadu / Hindu Calendar (2025, 2026, 2027)
export const SUBHA_MUHURTHAM_DATABASE = {
  2025: {
    0: ['2025-01-23', '2025-01-24', '2025-01-26', '2025-01-30'],
    1: ['2025-02-02', '2025-02-06', '2025-02-07', '2025-02-13', '2025-02-14', '2025-02-20', '2025-02-21', '2025-02-23'],
    2: ['2025-03-02', '2025-03-06', '2025-03-13', '2025-03-26', '2025-03-27', '2025-03-30'],
    3: ['2025-04-14', '2025-04-17', '2025-04-18', '2025-04-24', '2025-04-25'],
    4: ['2025-05-01', '2025-05-02', '2025-05-08', '2025-05-09', '2025-05-14', '2025-05-15', '2025-05-18', '2025-05-22', '2025-05-23', '2025-05-28'],
    5: ['2025-06-01', '2025-06-05', '2025-06-06', '2025-06-12', '2025-06-13', '2025-06-19', '2025-06-26'],
    6: ['2025-07-03', '2025-07-04', '2025-07-10', '2025-07-11'],
    7: ['2025-08-21', '2025-08-22', '2025-08-28', '2025-08-29'],
    8: ['2025-09-04', '2025-09-05', '2025-09-11', '2025-09-12', '2025-09-25'],
    9: ['2025-10-23', '2025-10-24', '2025-10-29', '2025-10-30'],
    10: ['2025-11-06', '2025-11-07', '2025-11-13', '2025-11-20', '2025-11-21', '2025-11-27'],
    11: ['2025-12-04', '2025-12-05', '2025-12-11', '2025-12-12']
  },
  2026: {
    0: ['2026-01-18', '2026-01-22', '2026-01-23', '2026-01-28', '2026-01-29'],
    1: ['2026-02-05', '2026-02-08', '2026-02-15', '2026-02-19', '2026-02-22', '2026-02-26'],
    2: ['2026-03-05', '2026-03-08', '2026-03-12', '2026-03-25', '2026-03-26', '2026-03-29'],
    3: ['2026-04-16', '2026-04-17', '2026-04-23', '2026-04-24', '2026-04-29', '2026-04-30'],
    4: ['2026-05-01', '2026-05-07', '2026-05-08', '2026-05-14', '2026-05-21', '2026-05-28'],
    5: ['2026-06-04', '2026-06-11', '2026-06-12', '2026-06-18', '2026-06-25'],
    6: ['2026-07-02', '2026-07-09', '2026-07-10'],
    7: ['2026-08-20', '2026-08-21', '2026-08-27', '2026-08-28'],
    8: ['2026-09-03', '2026-09-04', '2026-09-10', '2026-09-11', '2026-09-18', '2026-09-24', '2026-09-25'],
    9: ['2026-10-22', '2026-10-23', '2026-10-29', '2026-10-30'],
    10: ['2026-11-05', '2026-11-19', '2026-11-20', '2026-11-26', '2026-11-27'],
    11: ['2026-12-03', '2026-12-04', '2026-12-10', '2026-12-11']
  },
  2027: {
    0: ['2027-01-21', '2027-01-22', '2027-01-28', '2027-01-29'],
    1: ['2027-02-04', '2027-02-07', '2027-02-11', '2027-02-12', '2027-02-18', '2027-02-25'],
    2: ['2027-03-04', '2027-03-05', '2027-03-11', '2027-03-25', '2027-03-26'],
    3: ['2027-04-15', '2027-04-16', '2027-04-22', '2027-04-23', '2027-04-29'],
    4: ['2027-05-06', '2027-05-07', '2027-05-13', '2027-05-14', '2027-05-20', '2027-05-27'],
    5: ['2027-06-03', '2027-06-10', '2027-06-11', '2027-06-17', '2027-06-24'],
    6: ['2027-07-01', '2027-07-08', '2027-07-09'],
    7: ['2027-08-19', '2027-08-20', '2027-08-26', '2027-08-27'],
    8: ['2027-09-02', '2027-09-03', '2027-09-09', '2027-09-10', '2027-09-23', '2027-09-24'],
    9: ['2027-10-21', '2027-10-22', '2027-10-28', '2027-10-29'],
    10: ['2027-11-04', '2027-11-18', '2027-11-19', '2027-11-25', '2027-11-26'],
    11: ['2027-12-02', '2027-12-03', '2027-12-09', '2027-12-10']
  }
};

/**
 * Fetch panchangam for a specific date with local storage caching
 */
export async function fetchPanchangam(dateStr, city = 'chennai') {
  if (!dateStr) {
    dateStr = new Date().toISOString().split('T')[0];
  }
  const cacheKey = `${CACHE_PREFIX}${city}_${dateStr}`;
  
  // Try reading from cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && (Date.now() - parsed.timestamp) < CACHE_TTL_MS && parsed.data) {
        return parsed.data;
      }
    }
  } catch (e) {
    console.warn('Panchangam cache read error:', e);
  }

  // Fetch from live Nitya Panchangam API
  try {
    const url = `${API_BASE}?city=${encodeURIComponent(city)}&date=${encodeURIComponent(dateStr)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    const data = await response.json();
    
    // Save to cache
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch (e) {}

    return data;
  } catch (err) {
    console.warn('Nitya Panchangam API fetch error:', err);
    // Return graceful fallback object
    return {
      date: dateStr,
      city: city.charAt(0).toUpperCase() + city.slice(1),
      tithi: { name: 'Shubha Tithi' },
      nakshatra: { name: 'Auspicious Nakshatra' },
      muhurta: {
        abhijit_muhurtam: '11:45 AM – 12:35 PM',
        rahu_kalam: 'Avoid Rahu Kalam'
      },
      attribution: {
        source: 'Nitya Panchangam Free API',
        url: 'https://nityapanchangam.com/api/'
      },
      fallback: true
    };
  }
}

/**
 * Get Subha Muhurtham dates for a month
 */
export function getMuhurthamDatesForMonth(year, monthIndex) {
  const yData = SUBHA_MUHURTHAM_DATABASE[year];
  if (yData && yData[monthIndex]) {
    return [...yData[monthIndex]];
  }
  
  // Fallback: generate auspicious Fridays & Thursdays in that month
  const dates = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, monthIndex, d);
    const dayOfWeek = dateObj.getDay();
    // Friday (5) or Thursday (4) or Sunday (0)
    if (dayOfWeek === 5 || dayOfWeek === 4 || dayOfWeek === 0) {
      const padM = String(monthIndex + 1).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      dates.push(`${year}-${padM}-${padD}`);
    }
  }
  return dates.slice(0, 5);
}

/**
 * Get upcoming Subha Muhurtham dates
 */
export function getUpcomingMuhurthamDates(count = 6) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentYear = today.getFullYear();
  const allDates = [];

  for (let y = currentYear; y <= currentYear + 1; y++) {
    const yData = SUBHA_MUHURTHAM_DATABASE[y];
    if (yData) {
      for (let m = 0; m < 12; m++) {
        if (yData[m]) {
          allDates.push(...yData[m]);
        }
      }
    }
  }

  const future = allDates.filter(d => d >= todayStr).sort();
  return future.slice(0, count);
}

/**
 * Tap action to book an event for that Muhurtham date
 */
export function bookMuhurthamEvent(dateStr) {
  if (typeof window.openEventCustomerForm === 'function') {
    showToast(`✨ Booking auspicious Muhurtham event on ${dateStr}!`, 'info');
    window.openEventCustomerForm(null, dateStr, 'Muhurtham');
  } else {
    console.error('openEventCustomerForm not found on window');
  }
}

/**
 * Render the Muhurtham & Vedic Panchangam Widget
 */
export function renderMuhurthamWidget(events = [], selectedMonth = 'all') {
  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0];
  const currentYear = todayObj.getFullYear();
  const currentMonthIdx = todayObj.getMonth();

  const activeMonthIdx = (selectedMonth === 'all' || selectedMonth === undefined)
    ? currentMonthIdx
    : parseInt(selectedMonth, 10);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const activeMonthName = monthNames[activeMonthIdx];

  // Get Muhurtham dates for active month
  let muhurthamDates = getMuhurthamDatesForMonth(currentYear, activeMonthIdx);
  if (!muhurthamDates || muhurthamDates.length === 0) {
    muhurthamDates = getUpcomingMuhurthamDates(6);
  }

  // Create count map of existing bookings per date
  const bookingCountMap = {};
  events.forEach(e => {
    if (e.date) {
      const dStr = String(e.date).split('T')[0];
      bookingCountMap[dStr] = (bookingCountMap[dStr] || 0) + 1;
    }
  });

  const widgetId = `muhurtham-widget-${Date.now()}`;

  // Schedule async data enrichment for today & dates
  setTimeout(() => {
    enrichMuhurthamWidget(todayStr, muhurthamDates);
  }, 50);

  return `
  <div class="muhurtham-widget-card" id="${widgetId}" style="background:linear-gradient(145deg, #181107, #110b04); border:1px solid rgba(245,200,66,0.24); border-radius:16px; padding:18px 22px; margin-bottom:22px; box-shadow:0 4px 24px rgba(0,0,0,0.45); position:relative; overflow:hidden;">
    
    <!-- Decorative background glow -->
    <div style="position:absolute; right:-30px; top:-30px; width:160px; height:160px; background:radial-gradient(circle, rgba(245,200,66,0.15) 0%, rgba(245,200,66,0) 70%); border-radius:50%; pointer-events:none;"></div>

    <!-- Top Header: Title, Live City badge, Attribution -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:14px; position:relative; z-index:2;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:46px; height:46px; border-radius:12px; background:linear-gradient(135deg, rgba(245,200,66,0.18), rgba(217,119,6,0.1)); border:1px solid rgba(245,200,66,0.3); display:flex; align-items:center; justify-content:center; font-size:24px; color:#f5c842; box-shadow:0 3px 12px rgba(245,200,66,0.15);">
          ✨
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:17px; font-weight:700; color:#fffbeb; font-family:'DM Sans',sans-serif;">
              Shuba Muhurtham & Auspicious Dates
            </span>
            <span class="badge" style="background:rgba(245,200,66,0.12); color:#fde68a; border:1px solid rgba(245,200,66,0.28); font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;">
              <i class="ti ti-map-pin" style="font-size:12px;"></i> Chennai
            </span>
            <span class="badge" style="background:rgba(16,185,129,0.12); color:#6ee7b7; border:1px solid rgba(16,185,129,0.25); font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;">
              <i class="ti ti-calendar-heart" style="font-size:12px;"></i> ${activeMonthName} ${currentYear}
            </span>
          </div>
          <div style="font-size:12px; color:#94a3b8; margin-top:3px; display:flex; align-items:center; gap:6px;">
            <span>Tap any Muhurtham date to mark & book your wedding or function immediately</span>
          </div>
        </div>
      </div>

      <!-- Attribution & Live Sync -->
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
        <div style="font-size:11px; color:#94a3b8; display:flex; align-items:center; gap:4px;">
          <span style="width:7px; height:7px; border-radius:50%; background:#10b981; display:inline-block;"></span>
          <span>Live Vedic Panchangam</span>
        </div>
        <a href="https://nityapanchangam.com/api/" target="_blank" rel="noopener noreferrer" style="font-size:10.5px; color:#f5c842; text-decoration:none; font-weight:500; display:inline-flex; align-items:center; gap:3px;" title="Vedic calculations powered by Nitya Panchangam Free API">
          <i class="ti ti-external-link" style="font-size:11px;"></i> Powered by Nitya Panchangam
        </a>
      </div>
    </div>

    <!-- Live Today Banner: Abhijit Muhurtham & Rahu Kalam -->
    <div id="today-panchangam-strip" style="background:linear-gradient(90deg, rgba(245,200,66,0.1), rgba(217,119,6,0.05)); border:1px solid rgba(245,200,66,0.22); border-radius:12px; padding:10px 16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:11px; font-weight:700; color:#fde68a; text-transform:uppercase; letter-spacing:0.04em; background:rgba(245,200,66,0.14); border:1px solid rgba(245,200,66,0.28); padding:3px 8px; border-radius:6px;">
          Today's Panchangam
        </span>
        <span id="today-tithi-nakshatra" style="font-size:12px; font-weight:600; color:#e2e8f0;">
          Loading Vedic details...
        </span>
      </div>

      <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:#6ee7b7; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); padding:4px 10px; border-radius:8px;">
          <i class="ti ti-sun" style="font-size:14px; color:#f5c842;"></i>
          <span><strong>Abhijit Muhurtham:</strong> <span id="today-abhijit-time">Calculating...</span></span>
        </div>
        <div style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:#fca5a5; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.25); padding:4px 10px; border-radius:8px;" title="Rahu Kalam inauspicious window to avoid">
          <i class="ti ti-alert-triangle" style="font-size:13px; color:#ef4444;"></i>
          <span><strong>Rahu Kalam:</strong> <span id="today-rahu-time">Calculating...</span></span>
        </div>
        <button class="btn btn-gold" onclick="window.bookMuhurthamEvent('${todayStr}')" style="padding:4px 10px; font-size:11.5px; height:28px; border-radius:6px; white-space:nowrap; gap:4px;">
          <i class="ti ti-plus"></i> Book Today
        </button>
      </div>
    </div>

    <!-- Scrollable Subha Muhurtham Dates Strip -->
    <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:11.5px; font-weight:600; color:#cbd5e1; text-transform:uppercase; letter-spacing:0.04em; display:flex; align-items:center; gap:6px;">
        <i class="ti ti-sparkles" style="color:#f5c842;"></i> Subha Muhurtham Dates for ${activeMonthName} (${muhurthamDates.length} Auspicious Days)
      </div>
      <div style="font-size:11px; color:#94a3b8; display:flex; align-items:center; gap:4px;">
        <span>👈 Swipe / Click any date to book 👉</span>
      </div>
    </div>

    <div class="scrollbar-hide" style="display:flex; gap:10px; overflow-x:auto; padding:4px 2px 10px; -webkit-overflow-scrolling:touch;" id="muhurtham-dates-strip">
      ${muhurthamDates.map(dateStr => {
        const dObj = new Date(dateStr + 'T00:00:00');
        const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
        const monthShort = dObj.toLocaleDateString('en-US', { month: 'short' });
        const dayNum = dObj.getDate();
        const isToday = dateStr === todayStr;
        const bookedCount = bookingCountMap[dateStr] || 0;

        return `
          <div class="muhurtham-card-item" onclick="window.bookMuhurthamEvent('${dateStr}')" data-date="${dateStr}" style="flex:0 0 160px; background:${isToday ? '#26190a' : '#1c1308'}; border:${isToday ? '2px solid #f5c842' : '1px solid rgba(245,200,66,0.16)'}; border-radius:12px; padding:12px 10px; cursor:pointer; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:0 2px 8px rgba(0,0,0,0.25); display:flex; flex-direction:column; justify-content:space-between; text-align:center; position:relative; overflow:hidden;" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='#f5c842'; this.style.boxShadow='0 8px 18px rgba(245,200,66,0.18)';" onmouseout="this.style.transform='none'; this.style.borderColor='${isToday ? '#f5c842' : 'rgba(245,200,66,0.16)'}'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.25)';" title="Click to book event on ${dayName}, ${dayNum} ${monthShort}">
            
            ${isToday ? `
              <div style="position:absolute; top:0; left:0; right:0; background:#f5c842; color:#1a1005; font-size:9px; font-weight:700; text-transform:uppercase; padding:1px 0; letter-spacing:0.05em;">
                Today
              </div>
            ` : ''}

            <div style="margin-top:${isToday ? '6px' : '0'};">
              <span style="font-size:10px; font-weight:700; color:#f5c842; text-transform:uppercase; letter-spacing:0.04em; display:block;">
                ${dayName}
              </span>
              <div style="font-size:22px; font-weight:700; color:#fffbeb; line-height:1.2; margin:2px 0;">
                ${dayNum} <span style="font-size:12px; font-weight:500; color:#94a3b8;">${monthShort}</span>
              </div>
            </div>

            <!-- Panchangam Details Placeholder (Enriched live via API) -->
            <div id="p-info-${dateStr}" style="margin:6px 0; font-size:10px; color:#cbd5e1; line-height:1.3; min-height:26px; display:flex; flex-direction:column; justify-content:center;">
              <span class="badge-nakshatra" style="color:#fde68a; font-weight:600;">✨ Auspicious Muhurtham</span>
            </div>

            <!-- Booking Status Tag -->
            <div style="margin-top:4px;">
              ${bookedCount > 0 ? `
                <span class="badge" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; font-size:9.5px; font-weight:600; padding:2px 6px; border-radius:12px; display:inline-flex; align-items:center; gap:3px;">
                  <i class="ti ti-calendar-check"></i> ${bookedCount} Booked
                </span>
              ` : `
                <span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:9.5px; font-weight:600; padding:2px 6px; border-radius:12px; display:inline-flex; align-items:center; gap:3px;">
                  <i class="ti ti-circle-plus"></i> Tap to Book
                </span>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </div>
  `;
}

/**
 * Enriches the widget with live API data for today and each date
 */
async function enrichMuhurthamWidget(todayStr, datesToEnrich) {
  // 1. Fetch Today's Live Panchangam
  try {
    const todayData = await fetchPanchangam(todayStr, 'chennai');
    if (todayData) {
      const tithiEl = document.getElementById('today-tithi-nakshatra');
      if (tithiEl) {
        const tithiName = todayData.tithi?.name || '';
        const nakshatraName = todayData.nakshatra?.name || '';
        tithiEl.innerHTML = `
          <span style="color:#1e293b;">${tithiName}</span> 
          ${nakshatraName ? `• <span style="color:#d97706;">⭐ ${nakshatraName}</span>` : ''}
        `;
      }

      const abhijitEl = document.getElementById('today-abhijit-time');
      if (abhijitEl) {
        abhijitEl.textContent = todayData.muhurta?.abhijit_muhurtam || '11:40 AM – 12:30 PM';
      }

      const rahuEl = document.getElementById('today-rahu-time');
      if (rahuEl) {
        rahuEl.textContent = todayData.muhurta?.rahu_kalam || 'N/A';
      }
    }
  } catch (e) {
    console.warn('Failed to enrich today panchangam:', e);
  }

  // 2. Fetch Panchangam for first few dates to populate Tithi/Nakshatra without quota exhaustion
  // We limit concurrent fetches to first 5 dates, cached for 24h
  const sampleDates = datesToEnrich.slice(0, 6);
  for (const dStr of sampleDates) {
    try {
      const data = await fetchPanchangam(dStr, 'chennai');
      const el = document.getElementById(`p-info-${dStr}`);
      if (el && data) {
        const nakshatra = data.nakshatra?.name || '';
        const abhijit = data.muhurta?.abhijit_muhurtam || '';
        el.innerHTML = `
          <span style="color:#d97706; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">⭐ ${nakshatra || 'Subha Muhurtham'}</span>
          ${abhijit ? `<span style="color:#166534; font-size:9px; white-space:nowrap;">🕐 ${abhijit.split('–')[0]?.trim()}</span>` : ''}
        `;
      }
    } catch (e) {}
  }
}

// Bind to window object
window.bookMuhurthamEvent = bookMuhurthamEvent;
window.fetchPanchangam = fetchPanchangam;
