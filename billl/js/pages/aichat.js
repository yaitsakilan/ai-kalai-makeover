// billl/js/pages/aichat.js
import { state } from '../state.js';
import { callGroqAPI, transcribeAudio } from '../api.js';
import { addCustomer, addEvent, addExpense } from '../db.js';
import { showToast } from '../ui.js';
import { validateAndCleanPhone } from '../utils.js';

export function renderAIChat() {
  return `
  <div class="top-bar">
    <div>
      <h2>AI Entry Assistant</h2>
      <p style="font-size:12px;color:#999;margin-top:2px">Type in English or Tamil — I'll extract and save to Database</p>
    </div>
    <button class="btn btn-outline" onclick="window.clearAIChat()">
      <i class="ti ti-refresh"></i> Clear Chat
    </button>
  </div>

  <div class="quick-entry-grid">
    <div class="quick-entry-card qe-shop" onclick="window.openShopCustomerForm()" id="qe-shop-card">
      <div class="qe-icon"><i class="ti ti-scissors"></i></div>
      <div class="qe-title">Shop Customer</div>
      <div class="qe-sub">Service, amount, rating & more</div>
    </div>
    <div class="quick-entry-card qe-event" onclick="window.openEventCustomerForm()" id="qe-event-card">
      <div class="qe-icon"><i class="ti ti-calendar-heart"></i></div>
      <div class="qe-title">Event Customer</div>
      <div class="qe-sub">Function, makeup type & details</div>
    </div>
    <div class="quick-entry-card qe-class" onclick="window.openClassesForm()" id="qe-class-card">
      <div class="qe-icon"><i class="ti ti-school"></i></div>
      <div class="qe-title">Classes</div>
      <div class="qe-sub">Student name, amount & date</div>
    </div>
    <div class="quick-entry-card qe-product-expense" onclick="window.openProductExpenseForm()" id="qe-product-expense-card">
      <div class="qe-icon"><i class="ti ti-receipt-2"></i></div>
      <div class="qe-title">Product Expense</div>
      <div class="qe-sub">Salon products, makeup items & bills</div>
    </div>
  </div>

  <div class="card" style="padding:20px">
    <div class="chat-container">
      <div class="chat-messages scrollbar-hide" id="chat-messages">
        ${state.chatMessages.map(m=>`
          <div class="msg msg-${m.role}">${m.text.replace(/\n/g,'<br>')}</div>
        `).join('')}
        ${state.isTyping ? `<div class="msg msg-ai"><div class="loading"><div class="dot-anim"><span></span><span></span><span></span></div> Thinking...</div></div>` : ''}
      </div>
      ${state.isRecording && state.activeRecordingType === 'chat' ? `
      <div class="rec-panel">
        <div style="display:flex; align-items:center; gap:6px;">
          <div class="rec-dot"></div>
          <span style="font-size: 13px; font-weight: 600; color: #b91c1c; min-width: 38px;" id="recording-timer">00:00</span>
        </div>
        <canvas id="waveform-canvas" style="flex:1; height:34px; background:rgba(255,255,255,0.4); border-radius: 8px;"></canvas>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-danger btn-icon" style="width:34px; height:34px; border-radius:8px;" onclick="window.cancelVoiceRecording()" title="Cancel">
            <i class="ti ti-trash" style="font-size:16px;"></i>
          </button>
          <button class="btn btn-gold btn-icon" style="width:34px; height:34px; border-radius:8px; background:#ef4444; color:white;" onclick="window.stopVoiceRecording()" title="Stop and transcribe">
            <i class="ti ti-player-stop" style="font-size:16px;"></i>
          </button>
        </div>
      </div>
      ` : `
      <div class="chat-input-row">
        <div class="mic-btn" onclick="window.startVoiceRecording('chat')" title="Voice input">
          <i class="ti ti-microphone" style="font-size:17px;color:#666"></i>
        </div>
        <textarea class="chat-input" id="chat-input" placeholder='Try: "Priya facial 1200 paid" or "Bridal Meena 25000 Chennai advance 10000"' rows="1" onkeydown="window.handleChatKey(event)" oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px';"></textarea>
        <button class="btn btn-gold btn-icon" onclick="window.sendChatMessage()" title="Send">
          <i class="ti ti-send" style="font-size:17px"></i>
        </button>
      </div>
      `}
    </div>
  </div>`;
}

export function clearAIChat() {
  state.chatMessages = [{role:'ai', text:'நமஸ்தே! 👋 Ready for new entries!'}];
  if (typeof window.render === 'function') window.render();
}

export function scrollChatBottom() {
  setTimeout(()=>{
    const el = document.getElementById('chat-messages');
    if(el) el.scrollTop = el.scrollHeight;
  },50);
}

export function handleChatKey(e) {
  if(e.key==='Enter' && !e.shiftKey) { 
    e.preventDefault(); 
    sendChatMessage(); 
  }
}

export async function startVoiceRecording(type) {
  if (type === 'shop' || type === 'event') {
    import('../voiceWizard.js').then(m => m.openVoiceWizard(type));
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    state.activeRecordingType = type;
    state.audioChunks = [];
    state.isRecording = true;
    
    if (type === 'chat') {
      if (typeof window.render === 'function') window.render();
      scrollChatBottom();
    } else {
      showFormVoiceRecordingStatus(type);
    }
    
    state.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };
    
    state.mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
      await handleVoiceData(audioBlob, type);
      stream.getTracks().forEach(t => t.stop());
    };
    
    state.mediaRecorder.start();
    
    state.recordingStartTime = Date.now();
    updateTimerDisplay(0);
    state.recordingInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
      updateTimerDisplay(elapsed);
      if (elapsed >= 30) {
        stopVoiceRecording();
      }
    }, 1000);
    
    setTimeout(() => {
      const canvasId = type === 'chat' ? 'waveform-canvas' : 'form-waveform-canvas';
      initWaveformVisualizer(stream, canvasId);
    }, 100);
    
  } catch (err) {
    console.error('Mic access error:', err);
    showToast('Microphone access denied or not supported', 'error');
    state.isRecording = false;
    if (type === 'chat') {
      if (typeof window.render === 'function') window.render();
    } else {
      const container = document.getElementById('form-voice-container');
      if (container) container.innerHTML = '';
    }
  }
}

function updateTimerDisplay(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  const timerEl = document.getElementById(state.activeRecordingType === 'chat' ? 'recording-timer' : 'form-voice-timer');
  if (timerEl) {
    timerEl.textContent = `${m}:${s}`;
  }
}

function initWaveformVisualizer(stream, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  try {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 128;
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    state.sourceNode = state.audioCtx.createMediaStreamSource(stream);
    state.sourceNode.connect(state.analyser);
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    
    function draw() {
      state.animId = requestAnimationFrame(draw);
      state.analyser.getByteTimeDomainData(dataArray);
      
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = state.activeRecordingType === 'chat' ? '#ef4444' : '#d97706';
      ctx.beginPath();
      
      const sliceWidth = w / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    }
    
    draw();
  } catch (e) {
    console.error('Visualizer init failed:', e);
  }
}

export function stopVoiceRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
    state.mediaRecorder.stop();
  }
  cleanupVoiceRecording();
}

export function cancelVoiceRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
    state.mediaRecorder.onstop = () => {
      if (state.mediaRecorder.stream) {
        state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
      }
    };
    state.mediaRecorder.stop();
  }
  cleanupVoiceRecording();
  
  state.isRecording = false;
  if (state.activeRecordingType === 'chat') {
    state.chatMessages.push({ role: 'ai', text: '❌ Recording cancelled.' });
    if (typeof window.render === 'function') window.render();
    scrollChatBottom();
  } else {
    const container = document.getElementById('form-voice-container');
    if (container) container.innerHTML = '';
  }
  state.activeRecordingType = null;
}

function cleanupVoiceRecording() {
  if (state.recordingInterval) {
    clearInterval(state.recordingInterval);
    state.recordingInterval = null;
  }
  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
  if (state.sourceNode) {
    state.sourceNode.disconnect();
    state.sourceNode = null;
  }
  if (state.audioCtx && state.audioCtx.state !== 'closed') {
    state.audioCtx.close();
    state.audioCtx = null;
  }
}

async function handleVoiceData(audioBlob, type) {
  if (type === 'chat') {
    state.isRecording = false;
    state.isTyping = true;
    state.chatMessages.push({ role: 'ai', text: '🎙️ <em>Processing voice input...</em>' });
    if (typeof window.render === 'function') window.render();
    scrollChatBottom();
    
    try {
      const text = await transcribeAudio(audioBlob);
      state.chatMessages.pop();
      state.chatMessages.push({ role: 'user', text: `🎙️ Voice: "${text}"` });
      if (typeof window.render === 'function') window.render();
      scrollChatBottom();
      
      await processAIEntry(text);
    } catch (err) {
      console.error(err);
      state.chatMessages.pop();
      state.chatMessages.push({ role: 'ai', text: '⚠️ Voice transcription failed. Please try again.' });
      if (typeof window.render === 'function') window.render();
      scrollChatBottom();
    }
  } else {
    showFormVoiceStatusProcessing();
    try {
      const text = await transcribeAudio(audioBlob);
      await processFormVoiceInput(text, type);
    } catch (err) {
      console.error(err);
      showToast('Form voice transcription failed', 'error');
      const container = document.getElementById('form-voice-container');
      if (container) container.innerHTML = '';
    }
  }
}

function showFormVoiceRecordingStatus(type) {
  const container = document.getElementById('form-voice-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="form-voice-status-bar">
      <div class="rec-dot"></div>
      <span style="font-size:12px; font-weight:600; color:#b91c1c;" id="form-voice-timer">00:00</span>
      <canvas id="form-waveform-canvas" style="flex:1; height:24px; background:rgba(255,255,255,0.4); border-radius: 6px;"></canvas>
      <button class="btn btn-outline" style="padding:4px 8px; font-size:11px; border:none; background:transparent;" onclick="window.cancelVoiceRecording()">Cancel</button>
      <button class="btn btn-gold" style="padding:4px 8px; font-size:11px; background:#ef4444; color:white; border:none;" onclick="window.stopVoiceRecording()">Stop</button>
    </div>
  `;
}

function showFormVoiceStatusProcessing() {
  const container = document.getElementById('form-voice-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="form-voice-status-bar processing">
      <div class="spinner" style="width:14px; height:14px; border-width:2px; border-top-color:#d97706; margin-right:4px;"></div>
      <span style="font-size:12px; color:#b45309; font-weight:500;">AI is processing voice details...</span>
    </div>
  `;
}

export async function processFormVoiceInput(text, type) {
  try {
    let systemPrompt = '';
    if (type === 'shop') {
      systemPrompt = `You are an AI assistant parsing transcribed voice inputs into structured data for a Shop Customer Form of a beauty salon.
Extract the fields and return ONLY a JSON object:
{
  "name": string (default null),
  "phone": string of 10 digits (default null),
  "location": string (default null),
  "date": "YYYY-MM-DD" format (default null),
  "services": Array of objects: [{"name": string, "amount": number, "method": "Cash" | "GPay" | "Both" (default "Cash")}] (default empty array),
  "rating": number between 1 and 5 (default null),
  "referred_by": string (default null)
}
Guidelines:
- Identify common salon services from Tamil/English inputs (e.g. threading, saree prepleating, facial, haircut, bleach, detan, hair spa, pedicure, wax, smoothening).
- Standardize phone numbers to 10 digits.
- All monetary amounts must be strictly in Indian Rupees (INR). If a currency symbol like $ or currency name like USD/dollar is specified, convert it to INR (assume 1 USD = 80 INR) or treat the numeric value directly as INR, returning a raw number representing INR.
- Extract who referred the customer if mentioned (e.g., "referred by Anita", "Priya recommended me") and store in "referred_by".
- Output ONLY valid JSON, no other text.`;
    } else if (type === 'event') {
      systemPrompt = `You are an AI assistant parsing transcribed voice inputs into structured data for an Event Booking Form of a beauty salon.
Extract the fields and return ONLY a JSON object:
{
  "name": string (default null),
  "phone": string of 10 digits (default null),
  "location": string (default null),
  "date": "YYYY-MM-DD" format (default null),
  "functionType": string (one of: "Puberty Function", "Baby Shower", "Engagement", "Reception", "Muhurtham", "Party Makeup", "Others") (default null),
  "makeupType": string (one of: "Basic Makeup", "HD Makeup", "Advanced Makeup", "Airbrush Makeup", "Glass Skin Makeup", "Others") (default null),
  "amount": number (total main booking fee, default null),
  "advance": number (advance paid, default 0),
  "referred_by": string (default null)
}
Guidelines:
- Standardize phone numbers to 10 digits.
- All monetary amounts (amount, advance) must be strictly in Indian Rupees (INR). If a currency symbol like $ or currency name like USD/dollar is specified, convert it to INR (assume 1 USD = 80 INR) or treat the numeric value directly as INR, returning a raw number representing INR.
- Extract who referred the event booking if mentioned (e.g., "referred by Priya", "recommended by Kavitha") and store in "referred_by".
- Output ONLY valid JSON, no other text.`;
    } else if (type === 'class') {
      systemPrompt = `You are an AI assistant parsing transcribed voice inputs into structured data for a Classes Enrollment Form.
Extract the fields and return ONLY a JSON object:
{
  "name": string (default null),
  "phone": string of 10 digits (default null),
  "amount": number (class fee, default null),
  "date": "YYYY-MM-DD" format (default null),
  "location": string (default null),
  "referred_by": string (default null)
}
Guidelines:
- All monetary amounts (amount) must be strictly in Indian Rupees (INR). If a currency symbol like $ or currency name like USD/dollar is specified, convert it to INR (assume 1 USD = 80 INR) or treat the numeric value directly as INR, returning a raw number representing INR.
- Extract who referred the student if mentioned (e.g., "referred by deepa", "Priya suggested this class") and store in "referred_by".
- Output ONLY valid JSON, no other text.`;
    } else if (type === 'product_expense') {
      systemPrompt = `You are an AI assistant parsing transcribed voice inputs into structured data for a Product Expense Form of a beauty salon.
Extract the fields and return ONLY a JSON object:
{
  "date": "YYYY-MM-DD" format (default null),
  "products": Array of objects: [{"name": string, "amount": number}] (default empty array),
  "makeup": Array of objects: [{"name": string, "amount": number}] (default empty array)
}
Guidelines:
- Salon products ("products") include: thread, facial kit cream, hair color cream, hair color powder, spa cream, pedicure cream, wax cream, smoothening cream, etc.
- Makeup items ("makeup") include: extension, lashes, hair spray, hair pin, safety pin, serum, etc.
- If you hear item name and amount, map them to the correct category ("products" or "makeup").
- All monetary amounts must be strictly in Indian Rupees (INR). If a currency symbol like $ or currency name like USD/dollar is specified, convert it to INR (assume 1 USD = 80 INR) or treat the numeric value directly as INR, returning a raw number representing INR.
- Output ONLY valid JSON, no other text.`;
    }

    const parsed = await callGroqAPI('chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }).then(res => JSON.parse((res.choices?.[0]?.message?.content || '{}').replace(/```json|```/g,'').trim()));

    if (type === 'shop') {
      if (parsed.name) document.getElementById('sf-name').value = parsed.name;
      if (parsed.phone) {
        const cleaned = validateAndCleanPhone(parsed.phone);
        if (cleaned) document.getElementById('sf-phone').value = cleaned;
      }
      if (parsed.location) document.getElementById('sf-location').value = parsed.location;
      if (parsed.date) document.getElementById('sf-date').value = parsed.date;
      if (parsed.rating && typeof window.setStarRating === 'function') window.setStarRating(parsed.rating);
      if (parsed.referred_by) {
        const chk = document.getElementById('sf-referred');
        if (chk) {
          chk.checked = true;
          document.getElementById('sf-referrer-div').style.display = 'block';
          const selectEl = document.getElementById('sf-referrer');
          if (selectEl) {
            const val = parsed.referred_by.toLowerCase();
            if (val.includes('instagram') || val.includes('insta')) {
              selectEl.value = 'Instagram';
            } else {
              selectEl.value = 'Relatives';
            }
          }
        }
      }
      
      document.getElementById('sf-service-amounts').innerHTML = '';
      document.querySelectorAll('#sf-service-chips .chip').forEach(c => c.classList.remove('selected'));
      
      if (parsed.services && parsed.services.length > 0) {
        parsed.services.forEach(svc => {
          const chip = Array.from(document.querySelectorAll('#sf-service-chips .chip'))
            .find(c => c.textContent.trim().toLowerCase() === svc.name.toLowerCase());
          
          if (chip) {
            chip.classList.add('selected');
            const rowId = 'sa-row-' + chip.textContent.trim().replace(/\s+/g, '-').toLowerCase();
            const row = document.createElement('div');
            row.className = 'service-amount-row';
            row.id = rowId;
            row.dataset.service = chip.textContent.trim();
            const svcMethod = svc.method || 'Cash';
            row.innerHTML = window.getServiceRowHtml(chip.textContent.trim(), rowId, svc.amount || 0, svcMethod, chip.textContent.trim());
            document.getElementById('sf-service-amounts').appendChild(row);
          } else {
            const otherChip = Array.from(document.querySelectorAll('#sf-service-chips .chip'))
              .find(c => c.textContent.trim() === 'Others');
            if (otherChip) otherChip.classList.add('selected');
            
            const otherInputDiv = document.querySelector('#sf-service-chips').closest('.form-group').querySelector('.chip-other-input');
            if (otherInputDiv) otherInputDiv.classList.add('show');
            
            const rowId = 'sa-row-other-' + Date.now();
            const row = document.createElement('div');
            row.className = 'service-amount-row';
            row.id = rowId;
            row.dataset.service = svc.name;
            const svcMethod = svc.method || 'Cash';
            row.innerHTML = window.getServiceRowHtml(svc.name, rowId, svc.amount || 0, svcMethod);
            document.getElementById('sf-service-amounts').appendChild(row);
          }
        });
        if (typeof window.updateServiceTotal === 'function') window.updateServiceTotal();
      }
    } else if (type === 'event') {
      if (parsed.name) document.getElementById('ef-name').value = parsed.name;
      if (parsed.phone) {
        const cleaned = validateAndCleanPhone(parsed.phone);
        if (cleaned) document.getElementById('ef-phone').value = cleaned;
      }
      if (parsed.location) document.getElementById('ef-location').value = parsed.location;
      if (parsed.date) document.getElementById('ef-date').value = parsed.date;
      if (parsed.amount) document.getElementById('ef-amount').value = parsed.amount;
      if (parsed.advance) document.getElementById('ef-advance').value = parsed.advance;
      
      if (parsed.functionType) {
        const chips = document.querySelectorAll('#ef-function-chips .chip');
        chips.forEach(c => c.classList.remove('selected'));
        
        const chip = Array.from(chips).find(c => c.textContent.trim().toLowerCase() === parsed.functionType.toLowerCase());
        if (chip) {
          chip.classList.add('selected');
        } else {
          const otherChip = Array.from(chips).find(c => c.textContent.trim() === 'Others');
          if (otherChip) {
            otherChip.classList.add('selected');
            const otherInput = otherChip.closest('.form-group').querySelector('.chip-other-input');
            if (otherInput) otherInput.classList.add('show');
            const otherInpField = otherInput.querySelector('input');
            if (otherInpField) otherInpField.value = parsed.functionType;
          }
        }
      }
      
      if (parsed.makeupType) {
        const chips = document.querySelectorAll('#ef-makeup-chips .chip');
        chips.forEach(c => c.classList.remove('selected'));
        
        const chip = Array.from(chips).find(c => c.textContent.trim().toLowerCase() === parsed.makeupType.toLowerCase());
        if (chip) {
          if (typeof window.makeupTypeChipToggle === 'function') {
            window.makeupTypeChipToggle(chip, 5000);
          } else {
            chip.classList.add('selected');
          }
        } else {
          const otherChip = Array.from(chips).find(c => c.textContent.trim() === 'Others');
          if (otherChip) {
            otherChip.classList.add('selected');
            const otherInput = otherChip.closest('.form-group').querySelector('.chip-other-input');
            if (otherInput) otherInput.classList.add('show');
            const otherInpField = otherInput.querySelector('input');
            if (otherInpField) otherInpField.value = parsed.makeupType;
          }
        }
      }
      if (parsed.referred_by) {
        const chk = document.getElementById('ef-referred');
        if (chk) {
          chk.checked = true;
          document.getElementById('ef-referrer-div').style.display = 'block';
          const selectEl = document.getElementById('ef-referrer');
          if (selectEl) {
            const val = parsed.referred_by.toLowerCase();
            if (val.includes('instagram') || val.includes('insta')) {
              selectEl.value = 'Instagram';
            } else {
              selectEl.value = 'Relatives';
            }
          }
        }
      }
    } else if (type === 'class') {
      if (parsed.name) document.getElementById('cf-name').value = parsed.name;
      if (parsed.phone) {
        const cleaned = validateAndCleanPhone(parsed.phone);
        if (cleaned) document.getElementById('cf-phone').value = cleaned;
      }
      if (parsed.amount) document.getElementById('cf-amount').value = parsed.amount;
      if (parsed.date) document.getElementById('cf-date').value = parsed.date;
      if (parsed.location) document.getElementById('cf-location').value = parsed.location;
      if (parsed.referred_by) {
        const chk = document.getElementById('cf-referred');
        if (chk) {
          chk.checked = true;
          document.getElementById('cf-referrer-div').style.display = 'block';
          const selectEl = document.getElementById('cf-referrer');
          if (selectEl) {
            const val = parsed.referred_by.toLowerCase();
            if (val.includes('instagram') || val.includes('insta')) {
              selectEl.value = 'Instagram';
            } else {
              selectEl.value = 'Relatives';
            }
          }
        }
      }
    } else if (type === 'product_expense') {
      if (parsed.date) document.getElementById('pe-date').value = parsed.date;
      
      document.getElementById('pe-product-amounts').innerHTML = '';
      document.querySelectorAll('#pe-product-chips .chip').forEach(c => c.classList.remove('selected'));
      
      if (parsed.products && parsed.products.length > 0) {
        parsed.products.forEach(prod => {
          const chip = Array.from(document.querySelectorAll('#pe-product-chips .chip'))
            .find(c => c.textContent.trim().toLowerCase() === prod.name.toLowerCase());
          
          if (chip) {
            chip.classList.add('selected');
            const rowId = 'pe-row-prod-' + chip.textContent.trim().replace(/\s+/g, '-').toLowerCase();
            const row = document.createElement('div');
            row.className = 'service-amount-row';
            row.id = rowId;
            row.dataset.name = chip.textContent.trim();
            row.dataset.category = 'product';
            row.innerHTML = `
              <div class="sa-name" style="color:#6d28d9"><i class="ti ti-package"></i>${chip.textContent.trim()}</div>
              <span style="font-size:12px;color:#888">₹</span>
              <input type="number" placeholder="Amount" value="${prod.amount || 0}" oninput="window.updateProductExpenseTotal()">
              <div class="sa-remove" onclick="window.removeProductExpenseRow('${rowId}', '${chip.textContent.trim()}', 'product')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
            document.getElementById('pe-product-amounts').appendChild(row);
          } else {
            const otherChip = Array.from(document.querySelectorAll('#pe-product-chips .chip'))
              .find(c => c.textContent.trim() === 'Others');
            if (otherChip) otherChip.classList.add('selected');
            
            const otherInputDiv = document.getElementById('pe-product-other-div');
            if (otherInputDiv) otherInputDiv.classList.add('show');
            
            const rowId = 'pe-row-prod-other-' + Date.now();
            const row = document.createElement('div');
            row.className = 'service-amount-row';
            row.id = rowId;
            row.dataset.name = prod.name;
            row.dataset.category = 'product';
            row.innerHTML = `
              <div class="sa-name" style="color:#6d28d9"><i class="ti ti-package"></i>${prod.name}</div>
              <span style="font-size:12px;color:#888">₹</span>
              <input type="number" placeholder="Amount" value="${prod.amount || 0}" oninput="window.updateProductExpenseTotal()">
              <div class="sa-remove" onclick="window.removeProductExpenseRow('${rowId}', null, 'product')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
            document.getElementById('pe-product-amounts').appendChild(row);
          }
        });
      }

      document.getElementById('pe-makeup-amounts').innerHTML = '';
      document.querySelectorAll('#pe-makeup-chips .chip').forEach(c => c.classList.remove('selected'));

      if (parsed.makeup && parsed.makeup.length > 0) {
        parsed.makeup.forEach(make => {
          const chip = Array.from(document.querySelectorAll('#pe-makeup-chips .chip'))
            .find(c => c.textContent.trim().toLowerCase() === make.name.toLowerCase());
          
          if (chip) {
            chip.classList.add('selected');
            const rowId = 'pe-row-make-' + chip.textContent.trim().replace(/\s+/g, '-').toLowerCase();
            const row = document.createElement('div');
            row.className = 'service-amount-row';
            row.id = rowId;
            row.dataset.name = chip.textContent.trim();
            row.dataset.category = 'makeup';
            row.innerHTML = `
              <div class="sa-name" style="color:#be185d"><i class="ti ti-brush"></i>${chip.textContent.trim()}</div>
              <span style="font-size:12px;color:#888">₹</span>
              <input type="number" placeholder="Amount" value="${make.amount || 0}" oninput="window.updateProductExpenseTotal()">
              <div class="sa-remove" onclick="window.removeProductExpenseRow('${rowId}', '${chip.textContent.trim()}', 'makeup')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
            document.getElementById('pe-makeup-amounts').appendChild(row);
          } else {
            const otherChip = Array.from(document.querySelectorAll('#pe-makeup-chips .chip'))
              .find(c => c.textContent.trim() === 'Others');
            if (otherChip) otherChip.classList.add('selected');
            
            const otherInputDiv = document.getElementById('pe-makeup-other-div');
            if (otherInputDiv) otherInputDiv.classList.add('show');
            
            const rowId = 'pe-row-make-other-' + Date.now();
            const row = document.createElement('div');
            row.className = 'service-amount-row';
            row.id = rowId;
            row.dataset.name = make.name;
            row.dataset.category = 'makeup';
            row.innerHTML = `
              <div class="sa-name" style="color:#be185d"><i class="ti ti-brush"></i>${make.name}</div>
              <span style="font-size:12px;color:#888">₹</span>
              <input type="number" placeholder="Amount" value="${make.amount || 0}" oninput="window.updateProductExpenseTotal()">
              <div class="sa-remove" onclick="window.removeProductExpenseRow('${rowId}', null, 'makeup')" title="Remove"><i class="ti ti-x" style="font-size:14px"></i></div>`;
            document.getElementById('pe-makeup-amounts').appendChild(row);
          }
        });
      }
      if (typeof window.updateProductExpenseTotal === 'function') window.updateProductExpenseTotal();
    }

    showToast('Form autofilled with voice details!');
  } catch (err) {
    console.error('Form voice parsing error:', err);
    showToast('Could not extract details from voice. Try speaking clearly.', 'error');
  } finally {
    const container = document.getElementById('form-voice-container');
    if (container) container.innerHTML = '';
  }
}

export async function sendChatMessage() {
  const inp = document.getElementById('chat-input');
  if(!inp || !inp.value.trim()) return;
  const text = inp.value.trim();
  inp.value='';
  inp.style.height='auto';
  state.chatMessages.push({role:'user',text});
  state.isTyping=true;
  if (typeof window.render === 'function') window.render();
  scrollChatBottom();

  if(text.toLowerCase().startsWith('confirm')) {
    await confirmEntry();
    return;
  }
  await processAIEntry(text);
}

export async function processAIEntry(text) {
  state.isTyping=true; 
  if (typeof window.render === 'function') window.render();
  scrollChatBottom();
  
  state.lastAIInputText = text;
  try {
    const systemPrompt = `You are a personal AI business assistant for the salon owner, Kalai, who runs Kalai Makeover beauty salon.
Extract structured data from the user's input (which may be Tamil/English mix, transliterated Tamil, or English).

Current state JSON: ${state.pendingData ? JSON.stringify(state.pendingData) : 'null'}

Goal:
1. If "Current state JSON" is not null and the user is providing follow-up details (answering a question, providing missing information), update the fields in the state.
2. If the user's input indicates a new transaction, a different transaction type, a new customer, or a fresh query, DISCARD the current state and extract a new state from scratch.
3. If the user greets you or says something conversational (e.g. "hi", "hello", "thank you"), return type "greeting".

Extract and return ONLY a JSON object with these fields (use null for missing):
{
  "type": "customer_visit" or "event_booking" or "expense" or "multiple_expenses" or "greeting" or "unknown",
  "conversational_reply": string or null,
  "customer": string or null,
  "service": string or null,
  "amount": number or null,
  "payment_status": "paid" or "pending" or "advance" or null,
  "location": string or null,
  "phone": string or null,
  "payment_method": "Cash" or "GPay" or "Both" (default "Cash"),
  "rating": number or null,
  "event_type": string or null,
  "makeup_type": string or null,
  "advance_amount": number or null,
  "date": "YYYY-MM-DD" format or null,
  "expense_category": string or null,
  "expense_note": string or null,
  "expenses": array of objects or null (use ONLY for type: "multiple_expenses", each object: {"expense_category": string, "amount": number, "expense_note": string, "date": "YYYY-MM-DD" or null}),
  "missing_fields": ["list of what is missing"],
  "follow_up_question": string or null (ask for most important missing field)
}

Guidelines:
1. For customer_visit type, target fields to collect: customer, service, amount, payment_status, payment_method, location, phone, rating. If missing, list in missing_fields.
2. For event_booking type, target fields to collect: customer, phone, date, location, event_type (one of: "Puberty Function", "Baby Shower", "Engagement", "Reception", "Muhurtham", "Party Makeup", "Others"), makeup_type (one of: "Basic Makeup", "HD Makeup", "Advanced Makeup", "Airbrush Makeup", "Glass Skin Makeup", "Others"), amount (total booking amount), and advance_amount.
3. For single expense type, target fields: expense_category (Rent, Salary, Products, Electricity, Water, Travel, Miscellaneous), amount, and expense_note (the specific item or description, e.g. "hair dryer", "shampoo", "Rent for June"). Classify inputs about operational costs, salaries, bills, rent, or buying supplies as "expense".
4. For multiple_expenses type, if the user lists multiple items/expenses with their respective amounts (e.g. a list of products purchased or a list of separate operational costs, e.g., "Chutti 159, Gloves 174, Apron 186 on May 31"), classify as "multiple_expenses" and populate the "expenses" array with each item extracted. Map categories for each item appropriately (usually Products for supplies, Utilities for bills, Rent, Travel, etc.).
5. For greeting type, if the user greets you or says hello (e.g. "hi", "hello", "நமஸ்தே", "thank you"), reply back warmly addressing the owner "Kalai" directly (e.g. "Vanakkam Kalai! How can I assist you with your salon management today?" or "Hello Kalai! Ready to update some salon entries?"). Provide a helpful, friendly message in Tamil or English (matching her style). Store this message in "conversational_reply".
6. Common Tamil transliterations: facial=facial, threading=threading, saree prepleating=saree prepleating, paid=paid, advance=advance.
7. Currency and Numeric Rules: All monetary amounts (amount, advance_amount, etc.) must be strictly numeric in Indian Rupees (INR). NEVER output arithmetic expressions (e.g. "100 + 200") for numeric fields. Compute the sum or keep them as separate objects in multiple_expenses. If the user inputs currency symbols/words like "$", "USD", "dollars", convert to INR (1 USD = 80 INR) or interpret directly as INR, returning a raw number.
8. Referrals: Extract who referred the customer/booking (e.g., "referred by Anita") and store in "referred_by".

Return ONLY the JSON, no other text.`;

    const data = await callGroqAPI('chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    
    state.isTyping = false;
    const raw = data.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json|```/g,'').trim()); } catch(e) { parsed = {}; }

    let reply = '';
    if (parsed.type === 'greeting') {
      reply = parsed.conversational_reply || 'Vanakkam Kalai! 👋 How can I help you manage your salon today? You can enter a customer visit or log an expense!';
      state.pendingData = null;
    } else {
      if (parsed.type && parsed.type !== 'unknown') {
        state.pendingData = parsed;
      } else if (!state.pendingData) {
        state.pendingData = parsed;
      }

      if (state.pendingData && state.pendingData.phone) {
        const cleaned = validateAndCleanPhone(state.pendingData.phone);
        if (cleaned !== null) {
          state.pendingData.phone = cleaned;
        }
      }

      if(state.pendingData.type==='unknown' || (!state.pendingData.customer && !state.pendingData.expense_category && (!state.pendingData.expenses || state.pendingData.expenses.length === 0))) {
        reply = `I didn't understand that. Try something like:<br><em>"Priya facial 1200 paid"</em> or <em>"Expense rent 15000"</em>`;
      } else {
        const missing = [];
        if (state.pendingData.type === 'customer_visit') {
          if (!state.pendingData.customer) missing.push('customer');
          if (!state.pendingData.service) missing.push('service');
          if (!state.pendingData.amount) missing.push('amount');
          if (!state.pendingData.phone) missing.push('phone');
          if (!state.pendingData.location) missing.push('location');
          if (!state.pendingData.rating) missing.push('rating');
        } else if (state.pendingData.type === 'event_booking') {
          if (!state.pendingData.customer) missing.push('customer');
          if (!state.pendingData.event_type && !state.pendingData.service) missing.push('event_type');
          if (!state.pendingData.amount) missing.push('amount');
          if (!state.pendingData.date) missing.push('date');
          if (!state.pendingData.location) missing.push('location');
          if (!state.pendingData.makeup_type) missing.push('makeup_type');
        } else if (state.pendingData.type === 'expense') {
          if (!state.pendingData.expense_category) missing.push('expense_category');
          if (!state.pendingData.amount) missing.push('amount');
        } else if (state.pendingData.type === 'multiple_expenses') {
          // No missing fields needed for multiple expenses
        }
        state.pendingData.missing_fields = missing;

        if (missing.length > 0) {
          const questions = {
            customer: "Who is the customer?",
            service: `What service did ${state.pendingData.customer || 'the customer'} avail?`,
            amount: "What is the total booking amount?",
            phone: `What is ${state.pendingData.customer || 'the customer'}'s phone number?`,
            location: "Where is the event located?",
            rating: `How would you rate ${state.pendingData.customer || 'the customer'}? (1-5 stars)`,
            expense_category: "What is the expense category?",
            event_type: "What is the function type?",
            makeup_type: "What is the makeup type?",
            date: "What is the date of the event?"
          };
          state.pendingData.follow_up_question = questions[missing[0]] || "Could you provide the remaining details?";
          const previewHtml = buildPreviewHtml(state.pendingData);
          reply = `Got it! Here's what I found:<br>${previewHtml}<br>❓ ${state.pendingData.follow_up_question}`;
        } else {
          state.pendingData.follow_up_question = null;
          const previewHtml = buildPreviewHtml(state.pendingData);
          reply = `✅ Ready to save:<br>${previewHtml}<br><span style="font-size:12px;color:#888">Type <strong>confirm</strong> to save to Database or click Save above.</span>`;
        }
      }
    }

    state.chatMessages.push({role:'ai', text: reply});
    if (typeof window.render === 'function') window.render();
    scrollChatBottom();
  } catch(e) {
    state.isTyping = false;
    console.error('AI Entry extraction failed:', e);
    state.chatMessages.push({role:'ai',text:`⚠️ Error: ${e.message || 'Connection failed. Please try again.'}`});
    if (typeof window.render === 'function') window.render();
    scrollChatBottom();
  }
}

export function updatePendingDataField(field, value) {
  if (!state.pendingData) return;
  if (field === 'amount' || field === 'rating') {
    state.pendingData[field] = value ? Number(value) : null;
  } else {
    state.pendingData[field] = value;
  }
  updateLastChatMessagePreview();
}

export function toggleEditingPendingCard(isEditing) {
  state.isEditingPendingCard = isEditing;
  updateLastChatMessagePreview();
}

export function cancelPendingCard() {
  state.pendingData = null;
  state.isEditingPendingCard = false;
  state.chatMessages.push({role: 'ai', text: '❌ Entry cancelled.'});
  if (typeof window.render === 'function') window.render();
  scrollChatBottom();
}

export async function savePendingCardDirectly() {
  if (!state.pendingData) return;
  const btn = document.getElementById('pending-save-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="dot-anim"><span></span><span></span><span></span></div> Saving...';
  }
  if (state.pendingData.phone) {
    const cleaned = validateAndCleanPhone(state.pendingData.phone);
    if (cleaned === null) {
      showToast('Please enter a valid 10-digit phone number', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-check"></i> Save to Database';
      }
      return;
    }
    state.pendingData.phone = cleaned;
  }
  await confirmEntry();
  state.isEditingPendingCard = false;
}

function updateLastChatMessagePreview() {
  if (!state.pendingData) return;
  let reply = '';
  const missing = [];
  
  if (state.pendingData.type === 'customer_visit') {
    if (!state.pendingData.customer) missing.push('customer');
    if (!state.pendingData.service) missing.push('service');
    if (!state.pendingData.amount) missing.push('amount');
    if (!state.pendingData.phone) missing.push('phone');
    if (!state.pendingData.location) missing.push('location');
    if (!state.pendingData.rating) missing.push('rating');
  } else if (state.pendingData.type === 'event_booking') {
    if (!state.pendingData.customer) missing.push('customer');
    if (!state.pendingData.event_type && !state.pendingData.service) missing.push('event_type');
    if (!state.pendingData.amount) missing.push('amount');
    if (!state.pendingData.date) missing.push('date');
    if (!state.pendingData.location) missing.push('location');
    if (!state.pendingData.makeup_type) missing.push('makeup_type');
  } else if (state.pendingData.type === 'expense') {
    if (!state.pendingData.expense_category) missing.push('expense_category');
    if (!state.pendingData.amount) missing.push('amount');

  }

  state.pendingData.missing_fields = missing;
  
  if (missing.length > 0) {
    const questions = {
      customer: "Who is the customer?",
      service: `What service did ${state.pendingData.customer || 'the customer'} avail?`,
      amount: "What is the total booking amount?",
      phone: `What is ${state.pendingData.customer || 'the customer'}'s phone number?`,
      location: "Where is the event located?",
      rating: `How would you rate ${state.pendingData.customer || 'the customer'}?`,
      expense_category: "What is the expense category?",

      date: "What is the date of the event?",
      event_type: "What is the function type?",
      makeup_type: "What is the makeup type?"
    };
    state.pendingData.follow_up_question = questions[missing[0]] || "Could you provide the remaining details?";
    const previewHtml = buildPreviewHtml(state.pendingData);
    reply = `Got it! Here's what I found:<br>${previewHtml}<br>❓ ${state.pendingData.follow_up_question}`;
  } else {
    state.pendingData.follow_up_question = null;
    const previewHtml = buildPreviewHtml(state.pendingData);
    reply = `✅ Ready to save:<br>${previewHtml}<br><span style="font-size:12px;color:#888">Type <strong>confirm</strong> to save to Database or click Save above.</span>`;
  }
  
  if (state.chatMessages.length > 0) {
    state.chatMessages[state.chatMessages.length - 1].text = reply;
  }
  if (typeof window.render === 'function') window.render();
}

function buildPreviewHtml(p) {
  if (!p) return '';
  
  const cleanedPhone = validateAndCleanPhone(p.phone);
  const isPhoneValid = !p.phone || cleanedPhone !== null;
  const isEditing = state.isEditingPendingCard;
  
  const fields = [];
  if (p.type === 'customer_visit') {
    fields.push({ key: 'customer', label: 'Customer', value: p.customer || '', placeholder: 'Name (required)', required: true });
    fields.push({ key: 'amount', label: 'Amount', value: p.amount || 0, type: 'number', placeholder: 'Amount' });
    fields.push({ key: 'phone', label: 'Phone', value: p.phone || '', placeholder: '10-digit phone number', error: (!isPhoneValid && p.phone) ? 'Invalid 10-digit number' : null });
    fields.push({ key: 'service', label: 'Service Taken', value: p.service || '', placeholder: 'e.g. Haircut' });
    fields.push({ key: 'payment_method', label: 'Payment Method', value: p.payment_method || 'Cash', type: 'payment_method' });
    fields.push({ key: 'location', label: 'Location', value: p.location || '', placeholder: 'e.g. Chennai' });
    fields.push({ key: 'rating', label: 'Rating', value: p.rating || '', type: 'rating' });
    fields.push({ key: 'referred_by', label: 'Referred By', value: p.referred_by || '', type: 'referred_by' });
  } else if (p.type === 'event_booking') {
    fields.push({ key: 'customer', label: 'Customer', value: p.customer || '', placeholder: 'Name (required)', required: true });
    fields.push({ key: 'phone', label: 'Phone', value: p.phone || '', placeholder: '10-digit phone number', error: (!isPhoneValid && p.phone) ? 'Invalid 10-digit number' : null });
    fields.push({ key: 'date', label: 'Date', value: p.date || '', placeholder: 'YYYY-MM-DD' });
    fields.push({ key: 'location', label: 'Location', value: p.location || '', placeholder: 'e.g. Chennai' });
    fields.push({ key: 'event_type', label: 'Function Type', value: p.event_type || p.service || '', placeholder: 'e.g. Muhurtham' });
    fields.push({ key: 'makeup_type', label: 'Makeup Type', value: p.makeup_type || '', placeholder: 'e.g. HD Makeup' });
    fields.push({ key: 'amount', label: 'Total Amount', value: p.amount || 0, type: 'number', placeholder: 'Total' });
    fields.push({ key: 'advance_amount', label: 'Advance Paid', value: p.advance_amount || 0, type: 'number', placeholder: 'Advance' });
    fields.push({ key: 'referred_by', label: 'Referred By', value: p.referred_by || '', type: 'referred_by' });

  } else if (p.type === 'multiple_expenses') {
    // Custom table rendering for multiple expenses, handled below
  } else {
    fields.push({ key: 'expense_category', label: 'Category', value: p.expense_category || '', placeholder: 'e.g. Rent', required: true });
    fields.push({ key: 'expense_note', label: 'Product / Note', value: p.expense_note || '', placeholder: 'e.g. Wax cream, Rent for June' });
    fields.push({ key: 'amount', label: 'Amount', value: p.amount || 0, type: 'number', placeholder: 'Amount' });
  }

  let fieldsHtml = '';
  if (isEditing) {
    fieldsHtml = fields.map(f => {
      if (f.type === 'payment_method') {
        return `
          <div style="margin-bottom: 8px;">
            <label class="form-label" style="font-size:11px;color:#777;margin-bottom:2px;display:block;">${f.label}</label>
            <select class="form-input" style="padding:6px 8px;font-size:12px;height:30px;" onchange="window.updatePendingDataField('payment_method', this.value)">
              <option value="Cash" ${f.value === 'Cash' ? 'selected' : ''}>Cash</option>
              <option value="GPay" ${f.value === 'GPay' ? 'selected' : ''}>GPay</option>
              <option value="Both" ${f.value === 'Both' ? 'selected' : ''}>Both</option>
            </select>
          </div>`;
      }
      if (f.type === 'rating') {
        return `
          <div style="margin-bottom: 8px;">
            <label class="form-label" style="font-size:11px;color:#777;margin-bottom:2px;display:block;">${f.label}</label>
            <select class="form-input" style="padding:6px 8px;font-size:12px;height:30px;" onchange="window.updatePendingDataField('rating', this.value)">
              <option value="" ${!f.value ? 'selected' : ''}>Select Rating</option>
              <option value="5" ${f.value == 5 ? 'selected' : ''}>5 Stars ⭐⭐⭐⭐⭐</option>
              <option value="4" ${f.value == 4 ? 'selected' : ''}>4 Stars ⭐⭐⭐⭐</option>
              <option value="3" ${f.value == 3 ? 'selected' : ''}>3 Stars ⭐⭐⭐</option>
              <option value="2" ${f.value == 2 ? 'selected' : ''}>2 Stars ⭐⭐</option>
              <option value="1" ${f.value == 1 ? 'selected' : ''}>1 Star ⭐</option>
            </select>
          </div>`;
      }
      if (f.type === 'referred_by') {
        return `
          <div style="margin-bottom: 8px;">
            <label class="form-label" style="font-size:11px;color:#777;margin-bottom:2px;display:block;">${f.label}</label>
            <select class="form-input" style="padding:6px 8px;font-size:12px;height:30px;" onchange="window.updatePendingDataField('referred_by', this.value)">
              <option value="" ${!f.value ? 'selected' : ''}>Not Referred</option>
              <option value="Instagram" ${f.value === 'Instagram' ? 'selected' : ''}>Instagram</option>
              <option value="Relatives" ${f.value === 'Relatives' ? 'selected' : ''}>Relatives</option>
            </select>
          </div>`;
      }

      return `
        <div style="margin-bottom: 8px;">
          <label class="form-label" style="font-size:11px;color:#777;margin-bottom:2px;display:block;">${f.label} ${f.required ? '<span style="color:red">*</span>' : ''}</label>
          <input class="form-input" style="padding:6px 8px;font-size:12px;height:30px;" type="${f.type === 'number' ? 'number' : 'text'}" 
                 value="${f.value}" 
                 placeholder="${f.placeholder}" 
                 oninput="window.updatePendingDataField('${f.key}', this.value)">
          ${f.error ? `<div style="color:#dc2626;font-size:10px;margin-top:2px;">⚠️ ${f.error}</div>` : ''}
        </div>`;
    }).join('');
  } else {
    if (p.type === 'multiple_expenses') {
      const totalAmount = (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
      fieldsHtml = `
        <div style="font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:8px;border-bottom:1px solid #fde68a;padding-bottom:4px;">Expense Items List:</div>
        <div style="max-height:160px;overflow-y:auto;margin-bottom:8px;padding-right:2px;">
          ${(p.expenses || []).map((exp, idx) => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px dashed #eee;font-size:11px;align-items:center;">
              <span style="color:#333;text-align:left;">${idx + 1}. <strong>${exp.expense_note || 'Expense'}</strong> <span style="color:#888;font-size:10px;">(${exp.expense_category || 'Products'})</span></span>
              <span style="font-weight:600;color:#1a1a1a;">₹${(exp.amount || 0).toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px solid #fde68a;font-weight:700;font-size:12px;align-items:center;">
          <span>Total Amount</span>
          <span style="color:#d97706;font-size:13px;">₹${totalAmount.toLocaleString()}</span>
        </div>
        <div style="font-size:11px;color:#777;margin-top:6px;display:flex;justify-content:space-between;">
          <span>Date: ${p.expenses?.[0]?.date || new Date().toISOString().split('T')[0]}</span>
          <span>Count: ${(p.expenses || []).length} items</span>
        </div>
      `;
    } else {
      fieldsHtml = fields.map(f => {
        let displayValue = f.value;
        if (f.key === 'amount' || f.key === 'advance_amount') {
          displayValue = '₹' + (Number(f.value) || 0).toLocaleString();
        } else if (f.key === 'rating') {
          displayValue = f.value ? '★'.repeat(f.value) + '☆'.repeat(5-f.value) : '<span style="color:#d97706;font-weight:500;">Pending</span>';
        } else if (!f.value) {
          displayValue = '<span style="color:#d97706;font-weight:500;">Pending</span>';
        }
        
        let errorIndicator = '';
        if (f.key === 'phone' && f.value && !isPhoneValid) {
          errorIndicator = ' <span style="color:#dc2626;" title="Invalid phone number">⚠️</span>';
        }

        return `
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid #fdf2f2;align-items:center;">
            <span style="color:#777;font-size:12px;">${f.label}</span>
            <span style="font-weight:600;color:#1a1a1a;font-size:12px;">${displayValue}${errorIndicator}</span>
          </div>`;
      }).join('');
    }
  }

  const editIconHtml = !isEditing ? `
    <button onclick="window.toggleEditingPendingCard(true)" style="background:transparent;border:none;cursor:pointer;color:#d97706;padding:4px;display:flex;align-items:center;" title="Edit details">
      <i class="ti ti-edit" style="font-size:16px;"></i>
    </button>` : `
    <button onclick="window.toggleEditingPendingCard(false)" style="background:transparent;border:none;cursor:pointer;color:#15803d;padding:4px;display:flex;align-items:center;" title="View details">
      <i class="ti ti-eye" style="font-size:16px;"></i>
    </button>`;

  let headerTitle = 'Extracted Visit Details';
  let headerIcon = 'ti-id-card';
  if (p.type === 'expense' || p.type === 'multiple_expenses') {
    headerTitle = p.type === 'multiple_expenses' ? 'Extracted Bulk Expenses' : 'Extracted Expense Details';
    headerIcon = 'ti-receipt';
  } else if (p.type === 'event_booking') {
    headerTitle = 'Extracted Event Details';
    headerIcon = 'ti-calendar-event';
  }

  return `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px;margin:12px 0;box-shadow:0 2px 8px rgba(245,200,66,0.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #fef3c7;padding-bottom:6px;">
        <span style="font-weight:700;color:#b45309;font-size:13px;display:flex;align-items:center;gap:6px;">
          <i class="ti ${headerIcon}" style="font-size:16px;"></i> ${headerTitle}
        </span>
        ${editIconHtml}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${fieldsHtml}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
        <button class="btn btn-outline" style="padding:6px 12px;font-size:11px;" onclick="window.cancelPendingCard()">
          <i class="ti ti-x"></i> Cancel
        </button>
        <button class="btn btn-gold" style="padding:6px 12px;font-size:11px;" onclick="window.savePendingCardDirectly()" id="pending-save-btn">
          <i class="ti ti-check"></i> Save
        </button>
      </div>
    </div>`;
}

export async function confirmEntry() {
  if(!state.pendingData) { 
    state.chatMessages.push({role:'ai',text:'No pending data to confirm. Please enter a customer record first.'}); 
    if (typeof window.render === 'function') window.render(); 
    scrollChatBottom(); 
    return; 
  }
  state.isTyping=true; 
  if (typeof window.render === 'function') window.render();
  scrollChatBottom();

  try {
    const p = state.pendingData;
    let saved = false;

    if(p.type === 'customer_visit') {
      const svcMethod = p.payment_method || 'Cash';
      const servicesList = (p.service || 'Others')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => `${s} (${svcMethod})`);

      const result = await addCustomer({
        name: p.customer || 'Unknown',
        phone: p.phone || '',
        location: p.location || '',
        services: servicesList,
        amount: p.amount || 0,
        payment_status: p.payment_status || 'pending',
        payment_method: svcMethod,
        last_visit: new Date().toISOString().split('T')[0],
        total_spend: p.amount || 0,
        visits: 1,
        rating: p.rating || 5,
        referred_by: p.referred_by || null
      });
      saved = !!result;
    } else if(p.type === 'event_booking') {
      const total = p.amount || 0;
      const advance = p.advance_amount || 0;
      const result = await addEvent({
        customer: p.customer || 'Unknown',
        phone: p.phone || '',
        type: p.event_type || p.service || 'Event',
        date: p.date || new Date().toISOString().split('T')[0],
        total: total,
        advance: advance,
        pending: total - advance,
        status: advance >= total ? 'Completed' : 'Booked',
        location: p.location || '',
        makeup_type: p.makeup_type || '',
        additional_makeup: '[]',
        travel_allowance: 0,
        rating: 5,
        referred_by: p.referred_by || null
      });
      saved = !!result;
    } else if(p.type === 'expense') {
      const result = await addExpense({
        category: p.expense_category || 'Miscellaneous',
        amount: p.amount || 0,
        date: new Date().toISOString().split('T')[0],
        note: p.expense_note || state.lastAIInputText || p.expense_category || 'Expense entry'
      });
      saved = !!result;
    } else if(p.type === 'multiple_expenses') {
      let successCount = 0;
      for(let exp of (p.expenses || [])) {
        const result = await addExpense({
          category: exp.expense_category || 'Products',
          amount: exp.amount || 0,
          date: exp.date || new Date().toISOString().split('T')[0],
          note: exp.expense_note || 'Bulk expense item'
        });
        if(result) successCount++;
      }
      saved = successCount > 0;
      p.saved_count = successCount;

    }

    state.isTyping = false;
    const name = p.type === 'multiple_expenses' ? `${p.saved_count || (p.expenses || []).length} bulk expense items` : (p.customer || p.expense_category || 'Record');

    if(saved) {
      let typeName = 'customer records';
      if (p.type === 'expense' || p.type === 'multiple_expenses') typeName = 'expenses';
      else if (p.type === 'event_booking') typeName = 'events';
      
      let viewSection = 'Customers';
      if (p.type === 'expense') viewSection = 'Expenses';
      else if (p.type === 'event_booking') viewSection = 'Events';

      state.chatMessages.push({role:'ai',text:`✅ <strong>${name.length > 60 ? name.substring(0, 60) + '...' : name}</strong> saved to Database successfully! 🎉<br><span style="font-size:11px;color:#888">Record added to ${typeName}. View it in the ${viewSection} section.</span>`});
    } else {
      state.chatMessages.push({role:'ai',text:`⚠️ Could not save <strong>${name.length > 60 ? name.substring(0, 60) + '...' : name}</strong>. Check your Database connection and try again.`});
    }
    state.pendingData = null;
  } catch(err) {
    state.isTyping = false;
    state.chatMessages.push({role:'ai',text:'⚠️ Error saving to database. Please check your connection.'});
  }
  if (typeof window.render === 'function') window.render();
  scrollChatBottom();
}

// Bind to window to allow HTML inline click handlers to execute
window.clearAIChat = clearAIChat;
window.handleChatKey = handleChatKey;
window.startVoiceRecording = startVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;
window.cancelVoiceRecording = cancelVoiceRecording;
window.sendChatMessage = sendChatMessage;
window.updatePendingDataField = updatePendingDataField;
window.toggleEditingPendingCard = toggleEditingPendingCard;
window.cancelPendingCard = cancelPendingCard;
window.savePendingCardDirectly = savePendingCardDirectly;
