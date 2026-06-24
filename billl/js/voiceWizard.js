// billl/js/voiceWizard.js
import { transcribeAudio } from './api.js';
import { showToast } from './ui.js';
import { processFormVoiceInput } from './pages/aichat.js';

let activeType = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let recordingStartTime = null;
let transcriptText = '';

export function openVoiceWizard(type) {
  activeType = type;
  isRecording = false;
  transcriptText = '';

  // Create wizard container overlay
  let container = document.getElementById('voice-wizard-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'voice-wizard-container';
    document.body.appendChild(container);
  }

  renderWizardStep();

  // Auto start recording
  setTimeout(() => {
    startVoiceRecording();
  }, 300);
}

function closeVoiceWizard() {
  cleanupRecording();
  const container = document.getElementById('voice-wizard-container');
  if (container) {
    container.remove();
  }
}

function renderWizardStep() {
  const container = document.getElementById('voice-wizard-container');
  if (!container) return;

  const titleText = activeType === 'shop' ? 'Shop Booking Voice Assistant' : 'Event Booking Voice Assistant';
  const placeholderText = activeType === 'shop'
    ? 'e.g. Priya 9876543210 Chennai facial 1500 rating 5'
    : 'e.g. Anita 9876543210 Tambaram Muhurtham HD Makeup 25000 advance 10000';

  const fieldList = activeType === 'shop'
    ? ['Name', 'Phone', 'Location', 'Referral', 'Date', 'Services', 'Amount', 'Rating']
    : ['Name', 'Phone', 'Location', 'Referral', 'Date', 'Function Type', 'Makeup Type', 'Payment'];

  container.innerHTML = `
    <div class="voice-wizard-overlay" onclick="window.closeVoiceWizard()">
      <div class="voice-wizard-card ${activeType}" onclick="event.stopPropagation()">
        <div class="vw-header">
          <h3><i class="ti ${activeType === 'shop' ? 'ti-scissors' : 'ti-calendar-heart'}" style="color:${activeType === 'shop' ? '#d97706' : '#ec4899'}"></i> ${titleText}</h3>
          <div onclick="window.closeVoiceWizard()" style="cursor:pointer;color:#999;font-size:20px"><i class="ti ti-x"></i></div>
        </div>
        <div style="padding: 14px 24px 0; text-align: left;">
          <span style="font-size: 11px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Speak these details:</span>
          <div class="vw-field-chips">
            ${fieldList.map(f => `<span class="vw-field-chip">${f}</span>`).join('')}
          </div>
        </div>
        <div class="vw-body" style="padding-top: 14px; gap: 14px; align-items: stretch; text-align: left;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.05em;">Voice Transcript</label>
            <textarea class="vw-textarea" 
                      id="vw-transcript-text" 
                      placeholder='${placeholderText}'
                      oninput="window.updateTranscriptValue(this.value)">${transcriptText}</textarea>
          </div>
          
          <div class="vw-mic-section" style="border-top: none; margin-top: 0; padding-top: 0;">
            <button class="vw-mic-btn-main ${isRecording ? 'recording' : ''}" onclick="window.toggleStepRecording()">
              <i class="ti ${isRecording ? 'ti-player-stop' : 'ti-microphone'}"></i>
            </button>
            <div class="vw-status-text" id="vw-record-status" style="font-size: 12px; color: #666; height: 18px; font-weight: 500; display: flex; align-items: center; justify-content: center;">
              ${isRecording ? 'Recording... Speak everything at once (Tap mic to stop)' : 'Tap microphone to start speaking'}
            </div>
          </div>
        </div>
        <div class="vw-footer">
          <button class="vw-nav-btn" onclick="window.closeVoiceWizard()">Cancel</button>
          <div style="display:flex; gap:8px;">
            <button class="vw-nav-btn" onclick="window.clearTranscript()"><i class="ti ti-trash"></i> Clear</button>
            <button class="vw-nav-btn primary" onclick="window.finishVoiceWizard()"><i class="ti ti-check"></i> Fill Form</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function updateTranscriptValue(val) {
  transcriptText = val;
}

export function clearTranscript() {
  cleanupRecording();
  isRecording = false;
  transcriptText = '';
  renderWizardStep();
}

export async function toggleStepRecording() {
  if (isRecording) {
    stopVoiceRecording();
  } else {
    startVoiceRecording();
  }
}

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    isRecording = true;
    audioChunks = [];
    
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(t => t.stop());
      await processAudioData(audioBlob);
    };
    
    mediaRecorder.start();
    recordingStartTime = Date.now();
    
    // Auto stop after 30 seconds
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      if (elapsed >= 30) {
        stopVoiceRecording();
      }
    }, 1000);
    
    renderWizardStep();
  } catch (err) {
    console.error('Mic access error in wizard:', err);
    showToast('Microphone access denied', 'error');
    isRecording = false;
    renderWizardStep();
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  cleanupRecording();
  isRecording = false;
  
  const statusEl = document.getElementById('vw-record-status');
  if (statusEl) {
    statusEl.innerHTML = '<div class="loading" style="justify-content:center;"><div class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#d97706;margin-right:6px;"></div> Transcribing audio...</div>';
  }
}

function cleanupRecording() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function processAudioData(audioBlob) {
  try {
    const text = await transcribeAudio(audioBlob);
    if (text.trim()) {
      transcriptText = text.trim();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to transcribe voice', 'error');
  } finally {
    isRecording = false;
    renderWizardStep();
  }
}

export async function finishVoiceWizard() {
  const textEl = document.getElementById('vw-transcript-text');
  if (textEl) {
    transcriptText = textEl.value.trim();
  }

  if (!transcriptText) {
    showToast('Please type or record something first', 'error');
    return;
  }

  closeVoiceWizard();

  showToast('Processing voice details...');
  await processFormVoiceInput(transcriptText, activeType);
}

// Bind to window to allow HTML inline click handlers to execute
window.closeVoiceWizard = closeVoiceWizard;
window.toggleStepRecording = toggleStepRecording;
window.updateTranscriptValue = updateTranscriptValue;
window.clearTranscript = clearTranscript;
window.finishVoiceWizard = finishVoiceWizard;
