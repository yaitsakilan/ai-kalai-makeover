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
