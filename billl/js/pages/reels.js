// billl/js/pages/reels.js
import { fetchReelsIdeas, addReelsIdea, updateReelsIdea, deleteReelsIdea } from '../db.js';
import { showToast, showModal, closeModal } from '../ui.js';

export async function renderReels() {
  const ideas = await fetchReelsIdeas();
  window._cachedReelsIdeas = ideas;
  
  const totalIdeas = ideas.length;
  const plannedCount = ideas.filter(i => i.status === 'Planned').length;
  const draftedCount = ideas.filter(i => i.status === 'Drafted').length;
  const postedCount = ideas.filter(i => i.status === 'Posted').length;

  return `
  <div class="top-bar">
    <div>
      <h2>Instagram Reels Ideas</h2>
      <p style="font-size:12px;color:#999">Save and manage content creation ideas for your salon's social media</p>
    </div>
    <button class="btn btn-gold" onclick="window.showAddReelsIdeaModal()">
      <i class="ti ti-plus"></i> Add Reels Idea
    </button>
  </div>
  
  <div class="metric-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
    <div class="metric-card mc-gold">
      <div class="metric-label">Total Ideas</div>
      <div class="metric-value">${totalIdeas}</div>
      <div class="metric-sub">Brainstormed concepts</div>
      <i class="ti ti-brand-instagram metric-icon"></i>
    </div>
    <div class="metric-card mc-rose">
      <div class="metric-label">Planned</div>
      <div class="metric-value">${plannedCount}</div>
      <div class="metric-sub">To be scripted</div>
      <i class="ti ti-clock metric-icon"></i>
    </div>
    <div class="metric-card mc-purple">
      <div class="metric-label">Drafted</div>
      <div class="metric-value">${draftedCount}</div>
      <div class="metric-sub">Recorded & editing</div>
      <i class="ti ti-video metric-icon"></i>
    </div>
    <div class="metric-card mc-teal">
      <div class="metric-label">Posted</div>
      <div class="metric-value">${postedCount}</div>
      <div class="metric-sub">Shared on Instagram</div>
      <i class="ti ti-circle-check metric-icon"></i>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:10px">
      <input class="form-input" style="flex:1" placeholder="Search ideas..." id="reels-search" oninput="window.filterReelsIdeas(this.value)">
      <select class="form-input form-select" style="width:160px" onchange="window.filterReelsByStatus(this.value)">
        <option value="all">All Statuses</option>
        <option value="Planned">Planned</option>
        <option value="Drafted">Drafted</option>
        <option value="Posted">Posted</option>
      </select>
    </div>
  </div>

  <div id="reels-list-container">
    ${renderReelsList(ideas)}
  </div>`;
}

export function renderReelsList(ideas) {
  if(!ideas.length) {
    return `<div class="card" style="text-align:center;padding:40px;color:#999">
      <i class="ti ti-brand-instagram" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.3"></i>
      No Reels ideas found. Start by adding one or talking to the chatbot!
    </div>`;
  }
  
  return ideas.map(i => {
    let badgeClass = 'badge-amber';
    if(i.status === 'Drafted') badgeClass = 'badge-blue';
    else if(i.status === 'Posted') badgeClass = 'badge-green';
    
    const dateStr = i.created_at ? new Date(i.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : 'Recently';

    return `
      <div class="card" style="margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; gap:16px;">
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:500; color:#1a1a1a; line-height:1.4; white-space:pre-wrap;">${i.idea}</div>
          <div style="font-size:11px; color:#bbb; margin-top:6px;">Added on ${dateStr}</div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
          <span class="badge ${badgeClass}" style="cursor:pointer; user-select:none; transition: transform 0.1s;" onclick="window.cycleReelsIdeaStatus('${i.id}', '${i.status}')" title="Click to cycle status">
            ${i.status}
          </span>
          <button onclick="window.handleDeleteReelsIdea('${i.id}')" class="btn btn-outline btn-icon" style="width:34px; height:34px; padding:0; border-radius:8px; border:none; background:transparent; display:flex; align-items:center; justify-content:center; color:#ccc;" onmouseover="this.style.color='#dc2626';this.style.background='#fee2e2'" onmouseout="this.style.color='#ccc';this.style.background='transparent'">
            <i class="ti ti-trash" style="font-size:16px"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export async function cycleReelsIdeaStatus(id, currentStatus) {
  const statuses = ['Planned', 'Drafted', 'Posted'];
  const currentIndex = statuses.indexOf(currentStatus);
  const nextStatus = statuses[(currentIndex + 1) % statuses.length];
  
  const updated = await updateReelsIdea(id, { status: nextStatus });
  if (updated) {
    showToast(`Status updated to ${nextStatus}`);
    if (typeof window.render === 'function') window.render();
  }
}

export async function handleDeleteReelsIdea(id) {
  if(!confirm('Delete this reels idea?')) return;
  const success = await deleteReelsIdea(id);
  if(success) {
    if (typeof window.render === 'function') window.render();
  }
}

export function filterReelsIdeas(q) {
  const ideas = (window._cachedReelsIdeas || []).filter(i =>
    (i.idea || '').toLowerCase().includes(q.toLowerCase())
  );
  const el = document.getElementById('reels-list-container');
  if(el) el.innerHTML = renderReelsList(ideas);
}

export function filterReelsByStatus(status) {
  let ideas = window._cachedReelsIdeas || [];
  if(status !== 'all') {
    ideas = ideas.filter(i => i.status === status);
  }
  const el = document.getElementById('reels-list-container');
  if(el) el.innerHTML = renderReelsList(ideas);
}

export function showAddReelsIdeaModal() {
  showModal('Add New Reels Idea', `
    <div id="form-voice-container"></div>
    <div class="form-group" style="position:relative">
      <label class="form-label" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
        <span>Idea Description *</span>
        <button class="btn btn-outline btn-icon" id="form-mic-btn" onclick="window.startVoiceRecording('reels_idea')" title="Fill with voice" style="width:28px; height:28px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; border-color:#e5e5e5; transition: all 0.2s ease;">
          <i class="ti ti-microphone" style="font-size:13px; color:#d97706;"></i>
        </button>
      </label>
      <textarea class="form-input" id="m-reels-text" placeholder="e.g. Before-after transition video showing bridal makeup on Anita" rows="4" style="resize:vertical;"></textarea>
    </div>
  `, async () => {
    const ideaText = document.getElementById('m-reels-text').value.trim();
    if(!ideaText) { showToast('Please enter the idea details','error'); return; }
    
    const result = await addReelsIdea(ideaText);
    closeModal();
    if (result) {
      if (typeof window.render === 'function') window.render();
    }
  });
}

// Bind to window to allow HTML inline click handlers to execute
window.showAddReelsIdeaModal = showAddReelsIdeaModal;
window.filterReelsIdeas = filterReelsIdeas;
window.filterReelsByStatus = filterReelsByStatus;
window.cycleReelsIdeaStatus = cycleReelsIdeaStatus;
window.handleDeleteReelsIdea = handleDeleteReelsIdea;
