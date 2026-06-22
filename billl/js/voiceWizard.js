// billl/js/voiceWizard.js
import { transcribeAudio } from './api.js';
import { showToast } from './ui.js';
import { processFormVoiceInput } from './pages/aichat.js';

let activeType = null;
let currentStep = 0;
let steps = [];
let collectedAnswers = {};
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let recordingStartTime = null;
let audioContext = null;
let analyser = null;
let animFrameId = null;
let sourceNode = null;

const SHOP_STEPS = [
  {
    key: 'name',
    label: 'Customer Name',
    question: "What is the customer's name?",
    tamilQuestion: "வாடிக்கையாளரின் பெயர் என்ன?",
    placeholder: "e.g. Priya Lakshmi"
  },
  {
    key: 'phone',
    label: 'Phone Number',
    question: "What is their phone number?",
    tamilQuestion: "அலைபேசி எண் என்ன?",
    placeholder: "e.g. 9876543210"
  },
  {
    key: 'location',
    label: 'Location',
    question: "Where is the customer from?",
    tamilQuestion: "அவர்கள் எந்த ஊர்/பகுதி?",
    placeholder: "e.g. Chennai"
  },
  {
    key: 'referred_by',
    label: 'Referral Details',
    question: "Did they come from a referral? (If yes, who referred them?)",
    tamilQuestion: "யாராவது பரிந்துரைத்தார்களா? (பரிந்துரைத்தவர் பெயர், இல்லையென்றால் No)",
    placeholder: "e.g. Anita Sharma (or 'No')"
  },
  {
    key: 'services',
    label: 'Services Taken',
    question: "What services did they receive?",
    tamilQuestion: "என்னென்ன சேவைகள் செய்தார்கள்?",
    placeholder: "e.g. Threading and Facial"
  },
  {
    key: 'amount',
    label: 'Total Bill Amount',
    question: "What is the total bill amount?",
    tamilQuestion: "மொத்த கட்டணம் எவ்வளவு?",
    placeholder: "e.g. 1500"
  },
  {
    key: 'rating',
    label: 'Customer Rating',
    question: "How would you rate this customer experience? (1 to 5 stars)",
    tamilQuestion: "வாடிக்கையாளர் அனுபவம் எப்படி இருந்தது? (1 முதல் 5 ஸ்டார்)",
    placeholder: "e.g. 5"
  }
];

const EVENT_STEPS = [
  {
    key: 'name',
    label: 'Customer Name',
    question: "Who is the event customer?",
    tamilQuestion: "வாடிக்கையாளரின் பெயர் என்ன?",
    placeholder: "e.g. Anita Sharma"
  },
  {
    key: 'phone',
    label: 'Phone Number',
    question: "What is their phone number?",
    tamilQuestion: "அலைபேசி எண் என்ன?",
    placeholder: "e.g. 9876543210"
  },
  {
    key: 'location',
    label: 'Event Location',
    question: "Where is the event location?",
    tamilQuestion: "விழா நடக்கும் இடம் எங்கே?",
    placeholder: "e.g. Tambaram, Chennai"
  },
  {
    key: 'referred_by',
    label: 'Referral Details',
    question: "Did they book via a referral? (If yes, who referred them?)",
    tamilQuestion: "யாராவது பரிந்துரைத்தார்களா? (பரிந்துரைத்தவர் பெயர், இல்லையென்றால் No)",
    placeholder: "e.g. Priya Nair (or 'No')"
  },
  {
    key: 'functionType',
    label: 'Function Type',
    question: "What is the function type?",
    tamilQuestion: "என்ன விழா? (வளைகாப்பு, நிச்சயம், வரவேற்பு, முகூர்த்தம்)",
    placeholder: "e.g. Muhurtham"
  },
  {
    key: 'makeupType',
    label: 'Makeup Type',
    question: "What makeup package did they book?",
    tamilQuestion: "என்ன மேக்கப் வகை? (HD மேக்கப், ஏர்பிரஷ் மேக்கப்)",
    placeholder: "e.g. HD Makeup"
  },
  {
    key: 'payment',
    label: 'Total & Advance Payment',
    question: "What is the total booking rate and advance paid?",
    tamilQuestion: "மொத்த கட்டணம் மற்றும் அட்வான்ஸ் தொகை எவ்வளவு?",
    placeholder: "e.g. Total 25000, advance 10000"
  }
];

export function openVoiceWizard(type) {
  activeType = type;
  currentStep = 0;
  steps = type === 'shop' ? SHOP_STEPS : EVENT_STEPS;
  collectedAnswers = {};
  isRecording = false;

  // Create wizard container overlay
  let container = document.getElementById('voice-wizard-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'voice-wizard-container';
    document.body.appendChild(container);
  }

  renderWizardStep();

  // Auto start recording for the first step
  setTimeout(() => {
    startStepRecording();
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

  const isLast = currentStep === steps.length;
  const titleText = activeType === 'shop' ? 'Shop Booking Voice Assistant' : 'Event Booking Voice Assistant';
  const progressPercent = Math.round((currentStep / steps.length) * 100);

  if (isLast) {
    // Render summary screen
    container.innerHTML = `
      <div class="voice-wizard-overlay" onclick="window.closeVoiceWizard()">
        <div class="voice-wizard-card" onclick="event.stopPropagation()">
          <div class="vw-header">
            <h3><i class="ti ti-checklist" style="color:#10b981"></i> Voice Entry Summary</h3>
            <div onclick="window.closeVoiceWizard()" style="cursor:pointer;color:#999;font-size:20px"><i class="ti ti-x"></i></div>
          </div>
          <div class="vw-body">
            <p style="font-size:13px; color:#555; margin-bottom:4px;">Please review the extracted voice answers. You can edit any field before saving.</p>
            <div class="vw-summary-list scrollbar-hide">
              ${steps.map(s => `
                <div class="vw-summary-item">
                  <span class="vw-summary-label">${s.label}</span>
                  <input class="vw-input" style="padding: 6px 10px; font-size: 13px;" id="vw-summary-input-${s.key}" value="${collectedAnswers[s.key] || ''}">
                </div>
              `).join('')}
            </div>
          </div>
          <div class="vw-footer">
            <button class="vw-nav-btn" onclick="window.prevWizardStep()"><i class="ti ti-chevron-left"></i> Back</button>
            <button class="vw-nav-btn primary" onclick="window.finishVoiceWizard()"><i class="ti ti-check"></i> Fill Form & Close</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const step = steps[currentStep];
  const currentValue = collectedAnswers[step.key] || '';

  container.innerHTML = `
    <div class="voice-wizard-overlay" onclick="window.closeVoiceWizard()">
      <div class="voice-wizard-card" onclick="event.stopPropagation()">
        <div class="vw-header">
          <h3><i class="ti ${activeType === 'shop' ? 'ti-scissors' : 'ti-calendar-heart'}" style="color:#d97706"></i> ${titleText}</h3>
          <div onclick="window.closeVoiceWizard()" style="cursor:pointer;color:#999;font-size:20px"><i class="ti ti-x"></i></div>
        </div>
        <div class="vw-body">
          <div class="vw-step-indicator">
            ${steps.map((s, idx) => `
              <div class="vw-dot ${idx === currentStep ? 'active' : (idx < currentStep ? 'completed' : '')}"></div>
            `).join('')}
            <div class="vw-dot ${currentStep === steps.length ? 'active' : ''}"></div>
          </div>
          
          <div style="font-size:12px; color:#f5c842; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Step ${currentStep + 1} of ${steps.length}</div>
          <div class="vw-question">${step.question}</div>
          <div style="font-size:13px; color:#888; font-style:italic; margin-top:-10px;">${step.tamilQuestion}</div>
          
          <div class="vw-mic-container">
            <button class="vw-mic-btn ${isRecording ? 'recording' : ''}" id="vw-mic-trigger" onclick="window.toggleStepRecording()">
              <i class="ti ${isRecording ? 'ti-player-stop' : 'ti-microphone'}"></i>
            </button>
            <div class="vw-pulse-ring"></div>
          </div>
          
          <div class="vw-status-text" id="vw-record-status">${isRecording ? 'Recording... (Tap to stop)' : 'Tap mic to speak'}</div>
          
          <div class="vw-transcript-container" id="vw-transcript-container" style="display: ${currentValue ? 'flex' : 'none'}">
            <span class="vw-transcript-label">Transcribed Answer:</span>
            <input class="vw-input" id="vw-step-input" value="${currentValue}" placeholder="${step.placeholder}" oninput="window.updateStepValue(this.value)">
          </div>
        </div>
        <div class="vw-footer">
          <button class="vw-nav-btn" onclick="window.prevWizardStep()" ${currentStep === 0 ? 'disabled' : ''}><i class="ti ti-chevron-left"></i> Back</button>
          <div style="display:flex; gap:8px;">
            <button class="vw-nav-btn" onclick="window.skipWizardStep()">Skip</button>
            <button class="vw-nav-btn primary" onclick="window.nextWizardStep()">Next <i class="ti ti-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Start visualizer canvas if recording
  if (isRecording) {
    setTimeout(() => {
      initWaveform();
    }, 50);
  }
}

export function updateStepValue(val) {
  const step = steps[currentStep];
  if (step) {
    collectedAnswers[step.key] = val;
  }
}

export async function toggleStepRecording() {
  if (isRecording) {
    stopStepRecording();
  } else {
    startStepRecording();
  }
}

async function startStepRecording() {
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
      await processAudioStep(audioBlob);
    };
    
    mediaRecorder.start();
    recordingStartTime = Date.now();
    
    // Auto stop after 12 seconds
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      if (elapsed >= 12) {
        stopStepRecording();
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

function stopStepRecording() {
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
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
}

async function processAudioStep(audioBlob) {
  try {
    const text = await transcribeAudio(audioBlob);
    const step = steps[currentStep];
    if (step && text.trim()) {
      collectedAnswers[step.key] = text.trim();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to transcribe voice', 'error');
  } finally {
    isRecording = false;
    // Auto-advance to the next step
    nextWizardStep();
  }
}

export function prevWizardStep() {
  if (currentStep > 0) {
    cleanupRecording();
    isRecording = false;
    currentStep--;
    renderWizardStep();
    
    // Auto start recording for the previous step
    setTimeout(() => {
      if (currentStep < steps.length) {
        startStepRecording();
      }
    }, 300);
  }
}

export function nextWizardStep() {
  cleanupRecording();
  isRecording = false;
  
  // Read current input value if visible
  const inputEl = document.getElementById('vw-step-input');
  if (inputEl) {
    collectedAnswers[steps[currentStep].key] = inputEl.value.trim();
  }
  
  currentStep++;
  renderWizardStep();

  // Auto start recording for the next step
  setTimeout(() => {
    if (currentStep < steps.length) {
      startStepRecording();
    }
  }, 300);
}

export function skipWizardStep() {
  cleanupRecording();
  isRecording = false;
  collectedAnswers[steps[currentStep].key] = '';
  currentStep++;
  renderWizardStep();

  // Auto start recording for the next step
  setTimeout(() => {
    if (currentStep < steps.length) {
      startStepRecording();
    }
  }, 300);
}

export async function finishVoiceWizard() {
  // Read updated inputs from summary screen
  steps.forEach(s => {
    const inputEl = document.getElementById(`vw-summary-input-${s.key}`);
    if (inputEl) {
      collectedAnswers[s.key] = inputEl.value.trim();
    }
  });

  closeVoiceWizard();

  // Compile collected answers into structured paragraph
  let compiledText = '';
  if (activeType === 'shop') {
    compiledText = `Customer details:
- Name: ${collectedAnswers.name || ''}
- Phone: ${collectedAnswers.phone || ''}
- Location: ${collectedAnswers.location || ''}
- Referral details: ${collectedAnswers.referred_by || ''}
- Services taken: ${collectedAnswers.services || ''}
- Bill amount: ${collectedAnswers.amount || ''} INR
- Customer rating: ${collectedAnswers.rating || ''} stars`;
  } else if (activeType === 'event') {
    compiledText = `Event Booking details:
- Customer Name: ${collectedAnswers.name || ''}
- Customer Phone: ${collectedAnswers.phone || ''}
- Event Location: ${collectedAnswers.location || ''}
- Referral details: ${collectedAnswers.referred_by || ''}
- Function Type: ${collectedAnswers.functionType || ''}
- Makeup Type: ${collectedAnswers.makeupType || ''}
- Payment details (total and advance): ${collectedAnswers.payment || ''}`;
  }

  showToast('Processing wizard voice entry...');
  
  // Autofill forms using aichat processFormVoiceInput logic
  await processFormVoiceInput(compiledText, activeType);
}

function initWaveform() {
  // Optional: Simple visualizer placeholder or visual pulses can be used.
}

// Bind to window to allow HTML inline click handlers to execute
window.closeVoiceWizard = closeVoiceWizard;
window.toggleStepRecording = toggleStepRecording;
window.prevWizardStep = prevWizardStep;
window.nextWizardStep = nextWizardStep;
window.skipWizardStep = skipWizardStep;
window.updateStepValue = updateStepValue;
window.finishVoiceWizard = finishVoiceWizard;
