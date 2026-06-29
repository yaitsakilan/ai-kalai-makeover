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

  // Handle Event Booking Form default base amount on makeup selection
  if (groupName === 'makeup' && chipEl.classList.contains('selected')) {
    const baseInput = document.getElementById('ef-amount');
    if (baseInput && (!baseInput.value || parseInt(baseInput.value) === 0)) {
      baseInput.value = 5000;
      if (typeof window.updateEventTotalDisplay === 'function') {
        window.updateEventTotalDisplay();
      }
    }
  }
}

// Bind to window to allow HTML inline handlers to function
window.closeModal = closeModal;
window.handleModalSave = handleModalSave;
window.closeFormOverlay = closeFormOverlay;
window.chipToggle = chipToggle;

export function showConfirmDelete(title, message) {
  return new Promise((resolve) => {
    const container = document.getElementById('modal-container');
    if (!container) {
      resolve(false);
      return;
    }

    container.innerHTML = `
      <div class="confirm-modal-overlay" id="confirm-overlay">
        <div class="confirm-modal" onclick="event.stopPropagation()">
          <div class="pulse-danger-icon" style="margin: 0 auto 20px; width: 60px; height: 60px; border-radius: 50%; background: #fee2e2; display: flex; align-items: center; justify-content: center; color: #dc2626; box-shadow: 0 10px 25px rgba(220, 38, 38, 0.15);">
            <i class="ti ti-alert-triangle" style="font-size: 28px;"></i>
          </div>
          <h3 style="font-family:'Playfair Display',serif; font-size: 19px; color: #1a1a1a; margin-bottom: 10px; font-weight: 600;">${title}</h3>
          <p style="font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 24px; padding: 0 8px;">${message}</p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-outline" id="confirm-cancel-btn" style="flex: 1; justify-content: center;">Cancel</button>
            <button class="btn btn-danger" id="confirm-ok-btn" style="flex: 1; justify-content: center; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; font-weight: 600; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.18);">Delete</button>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById('confirm-overlay');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const okBtn = document.getElementById('confirm-ok-btn');

    function cleanUpAndResolve(result) {
      if (container) container.innerHTML = '';
      resolve(result);
    }

    cancelBtn.addEventListener('click', () => cleanUpAndResolve(false));
    okBtn.addEventListener('click', () => cleanUpAndResolve(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanUpAndResolve(false);
      }
    });
  });
}

window.showConfirmDelete = showConfirmDelete;

