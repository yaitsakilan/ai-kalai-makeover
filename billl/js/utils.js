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
