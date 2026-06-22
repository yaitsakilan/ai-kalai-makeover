// billl/js/ui.js
import { state } from './state.js';

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: 'ti-check', error: 'ti-x', info: 'ti-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="ti ${icons[type] || 'ti-info-circle'}" style="font-size:16px"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function showModal(title, bodyHtml, onSave) {
  const container = document.getElementById('modal-container');
  if (!container) return;
  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h3 style="font-family:'Playfair Display',serif;font-size:18px;color:#1a1a1a">${title}</h3>
          <div onclick="closeModal()" style="cursor:pointer;color:#999;font-size:20px"><i class="ti ti-x"></i></div>
        </div>
        <div id="modal-body">${bodyHtml}</div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
          <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
          <button class="btn btn-gold" id="modal-save-btn" onclick="handleModalSave()"><i class="ti ti-check"></i> Save</button>
        </div>
      </div>
    </div>`;
  window._modalSaveHandler = onSave;
}

export function closeModal() {
  if (state.isRecording && typeof window.cancelVoiceRecording === 'function') {
    window.cancelVoiceRecording();
  }
  const container = document.getElementById('modal-container');
  if (container) container.innerHTML = '';
  window._modalSaveHandler = null;
}

export async function handleModalSave() {
  const btn = document.getElementById('modal-save-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...';
  }
  if (window._modalSaveHandler) {
    try {
      await window._modalSaveHandler();
    } catch (err) {
      console.error('Modal save error:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-check"></i> Save';
      }
    }
  }
}

export function closeFormOverlay() {
  if (state.isRecording && typeof window.cancelVoiceRecording === 'function') {
    window.cancelVoiceRecording();
  }
  const container = document.getElementById('form-overlay-container');
  if (container) container.innerHTML = '';
}

export function chipToggle(groupName, chipEl, isSingle) {
  const group = chipEl.closest('.chip-group');
  if (!group) return;
  if (isSingle) {
    group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    chipEl.classList.add('selected');
  } else {
    chipEl.classList.toggle('selected');
  }
  // Handle "Others" chip
  const chipText = chipEl.textContent.trim();
  const otherInput = group.parentElement.querySelector('.chip-other-input');
  if (chipText === 'Others') {
    if (chipEl.classList.contains('selected')) {
      if (otherInput) otherInput.classList.add('show');
    } else {
      if (otherInput) otherInput.classList.remove('show');
    }
  }
}

// Bind to window to allow HTML inline handlers to function
window.closeModal = closeModal;
window.handleModalSave = handleModalSave;
window.closeFormOverlay = closeFormOverlay;
window.chipToggle = chipToggle;
