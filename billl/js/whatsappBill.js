// billl/js/whatsappBill.js
// Customer bills always go out from the owner's WhatsApp. A wa.me link sends from whichever WhatsApp is
// logged in on the phone that opens it, so on staff phones the bill is queued for the owner to send.
import { state } from './state.js';
import { showToast, closeModal } from './ui.js';
import { addPendingBill } from './db.js';

export function openWhatsAppChat(phone, message) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

// Label for the bill modal's send button
export function billSendButtonHtml(label) {
  return state.userRole === 'employee'
    ? '<i class="ti ti-send"></i> Send to Owner'
    : `<i class="ti ti-brand-whatsapp"></i> ${label}`;
}

// Sends the bill from the bill modal's save handler: opens WhatsApp on the owner's phone, queues it on staff phones
export async function sendCustomerBill({ customerName, phone, message, kind }) {
  if (state.userRole !== 'employee') {
    openWhatsAppChat(phone, message);
    closeModal();
    showToast('WhatsApp opened in a new tab!');
    return true;
  }

  const employee = (window._cachedEmployees || []).find(e => e.id === window._selectedPortalEmployeeId);
  const queued = await addPendingBill({
    customer_name: customerName,
    phone,
    message,
    kind,
    created_by: employee?.name || 'Staff'
  });

  if (!queued) {
    showToast('Couldn\'t send the bill to the owner. Check the internet and try again.', 'error');
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = billSendButtonHtml('Send Bill');
    }
    return false;
  }

  closeModal();
  showToast('Bill sent to the owner. It will go out from the owner\'s WhatsApp.');
  return true;
}
