// billl/js/utils.js

/**
 * Validates and normalizes phone numbers to standard 10-digit formats
 * @param {string|number} phone 
 * @returns {string|null} 10-digit phone string or null if invalid
 */
export function validateAndCleanPhone(phone) {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 10) {
    // Reject all zeros, all identical digits (e.g. 0000000000, 1111111111), or non-mobile prefixes 0-5
    if (/^0+$/.test(cleaned) || /^(.)\1{9}$/.test(cleaned) || /^[0-5]/.test(cleaned)) {
      return null;
    }
    return cleaned;
  }
  return null;
}

/**
 * Extracts comma-separated text values from selected chips in a chip group,
 * including any value from the associated 'Others' text input field.
 * @param {string} groupId - The ID of the chip group element.
 * @returns {string} Comma-separated list of selected items
 */
export function getSelectedChips(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return '';
  const selected = [];
  group.querySelectorAll('.chip.selected').forEach(c => {
    const text = c.textContent.trim();
    if (text !== 'Others') selected.push(text);
  });
  const otherInput = group.parentElement.querySelector('.chip-other-input input');
  if (otherInput && otherInput.value.trim()) {
    selected.push(otherInput.value.trim());
  }
  return selected.join(', ');
}

export function formatEmpTag(text) {
  if (!text) return { cleanText: '', tagHtml: '' };
  const match = text.match(/\[Emp(?::\s*([^\]]+))?\]/i);
  const cleanText = text.replace(/\s*\[Emp(?::\s*([^\]]+))?\]/gi, '').trim();
  let tagHtml = '';
  if (match) {
    const empName = match[1] ? match[1].trim() : '';
    const titleText = empName ? `Added by Employee: ${empName}` : 'Added by Employee';
    const labelText = empName ? `Emp: ${empName}` : 'Emp';
    tagHtml = `<span class="badge-emp" style="display:inline-flex; align-items:center; gap:2px; font-size:9px; font-weight:600; background:#f3e8ff; color:#7e22ce; border: 0.5px solid #d8b4fe; padding:1.5px 5px; border-radius:4px; margin-left:6px; vertical-align:middle; line-height:1.2;" title="${titleText}"><i class="ti ti-user-check" style="font-size:10px"></i> ${labelText}</span>`;
  }
  return { cleanText, tagHtml };
}

/**
 * Formats a date string (YYYY-MM-DD or ISO string) into a friendly date display like "10 Aug 2026"
 * @param {string} dateStr 
 * @returns {string} Formatted date string or 'N/A'
 */
export function formatVisitedDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    // If it's a YYYY-MM-DD string, construct Date using parts to prevent UTC timezone shifts
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Groups customers by phone number or clean name, accumulating total visits and total spend.
 * Handles datasets where repeat visits are saved as separate rows or via accumulated visits property.
 * @param {Array} customers 
 * @returns {Map<string, Object>} Map of unique customer records
 */
export function getUniqueCustomersMap(customers) {
  const map = new Map();
  if (!Array.isArray(customers)) return map;

  customers.forEach(c => {
    const cleanPhone = c.phone ? validateAndCleanPhone(c.phone) : null;
    const cleanName = c.name ? c.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() : '';
    const key = cleanPhone ? `phone:${cleanPhone}` : (cleanName.length > 2 ? `name:${cleanName}` : `id:${c.id || Math.random()}`);

    const itemVisits = (c.visits && typeof c.visits === 'number' && c.visits > 0) ? c.visits : 1;
    const itemSpend = c.total_spend !== undefined && c.total_spend > 0 ? (Number(c.total_spend) || 0) : (Number(c.amount) || 0);

    if (!map.has(key)) {
      map.set(key, {
        primary: c,
        records: [c],
        totalVisits: itemVisits,
        totalSpend: itemSpend
      });
    } else {
      const group = map.get(key);
      group.records.push(c);
      group.totalVisits += itemVisits;
      group.totalSpend += itemSpend;
      if (c.last_visit && (!group.primary.last_visit || c.last_visit > group.primary.last_visit)) {
        group.primary = c;
      }
    }
  });
  return map;
}

/**
 * Gets effective visit count for a single customer object, taking into account any duplicate
 * phone or name entries in the full dataset.
 * @param {Object} customer 
 * @param {Array} allCustomers 
 * @returns {number}
 */
export function getEffectiveVisits(customer, allCustomers) {
  if (!customer) return 1;
  const baseVisits = (customer.visits && typeof customer.visits === 'number' && customer.visits > 0) ? customer.visits : 1;
  if (!allCustomers || !Array.isArray(allCustomers) || allCustomers.length === 0) {
    return baseVisits;
  }

  const cleanPhone = customer.phone ? validateAndCleanPhone(customer.phone) : null;
  const cleanName = customer.name ? customer.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() : '';

  let matchCount = 0;
  if (cleanPhone) {
    matchCount = allCustomers.filter(item => {
      const p = item.phone ? validateAndCleanPhone(item.phone) : null;
      return p && p === cleanPhone;
    }).length;
  } else if (cleanName && cleanName.length > 2) {
    matchCount = allCustomers.filter(item => {
      const n = item.name ? item.name.replace(/\s*\[emp(?::\s*([^\]]+))?\]/gi, '').trim().toLowerCase() : '';
      return n && n === cleanName;
    }).length;
  }

  return Math.max(baseVisits, matchCount);
}

/**
 * Sorts customer array based on selected sort option ('most_visited', 'least_visited', 'date_desc', 'date_asc', 'spend_desc')
 * @param {Array} customerList 
 * @param {string} sortOption 
 * @param {Array} refAllCustomers 
 * @returns {Array}
 */
export function sortCustomersList(customerList, sortOption = 'most_visited', refAllCustomers = null) {
  if (!Array.isArray(customerList)) return [];
  const list = [...customerList];

  return list.sort((a, b) => {
    const visitsA = (a.visits && typeof a.visits === 'number' && a.visits > 1) ? a.visits : getEffectiveVisits(a, refAllCustomers);
    const visitsB = (b.visits && typeof b.visits === 'number' && b.visits > 1) ? b.visits : getEffectiveVisits(b, refAllCustomers);

    const dateA = a.last_visit || a.created_at || '';
    const dateB = b.last_visit || b.created_at || '';

    if (sortOption === 'most_visited') {
      if (visitsB !== visitsA) return visitsB - visitsA;
      return String(dateB).localeCompare(String(dateA));
    } else if (sortOption === 'least_visited') {
      if (visitsA !== visitsB) return visitsA - visitsB;
      return String(dateA).localeCompare(String(dateB));
    } else if (sortOption === 'date_desc') {
      return String(dateB).localeCompare(String(dateA));
    } else if (sortOption === 'date_asc') {
      return String(dateA).localeCompare(String(dateB));
    } else if (sortOption === 'spend_desc') {
      const spendA = a.total_spend || a.amount || 0;
      const spendB = b.total_spend || b.amount || 0;
      return spendB - spendA;
    }
    return 0;
  });
}

/**
 * Triggers the browser's Web Contact Picker API (supported on mobile Chrome/Edge/Opera/Safari)
 * to select a contact from the user's phone contacts list and auto-fill phone and name inputs.
 * @param {string} phoneInputId - The DOM ID of the phone input element
 * @param {string|null} nameInputId - Optional DOM ID of the name input element
 */
export async function pickContact(phoneInputId, nameInputId = null) {
  const phoneInput = document.getElementById(phoneInputId);
  const nameInput = nameInputId ? document.getElementById(nameInputId) : null;

  if ('contacts' in navigator && 'ContactsManager' in window) {
    try {
      const props = ['tel'];
      if (nameInputId) props.push('name');
      const contacts = await navigator.contacts.select(props, { multiple: false });
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        if (phoneInput && contact.tel && contact.tel.length > 0) {
          let rawTel = contact.tel[0];
          let cleanPhone = rawTel.replace(/\D/g, '');
          if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
          phoneInput.value = cleanPhone;
          phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
          phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (nameInput && contact.name && contact.name.length > 0) {
          if (!nameInput.value.trim()) {
            nameInput.value = contact.name[0];
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        if (typeof window.showToast === 'function') {
          window.showToast('Contact imported successfully!', 'success');
        }
      }
    } catch (err) {
      if (err.name !== 'InvalidStateError' && err.name !== 'SecurityError' && err.name !== 'AbortError') {
        console.warn('Contact picker error:', err);
      }
    }
  } else {
    if (typeof window.showToast === 'function') {
      window.showToast('Contact Picker is supported on mobile devices (Android Chrome/Safari). On desktop, enter number manually.', 'info');
    }
  }
}

window.pickContact = pickContact;




