// billl/js/app.js
import { state } from './state.js';
import { initDb } from './db.js';
import { renderDashboard, initCharts } from './pages/dashboard.js';
import { renderAIChat, scrollChatBottom } from './pages/aichat.js';
import { renderCustomers } from './pages/customers.js';
import { renderEvents } from './pages/events.js';
import { renderExpenses } from './pages/expenses.js';
import { renderReels } from './pages/reels.js';
import { renderAnalytics, initAnalyticsCharts } from './pages/analytics.js';
import { renderOCR } from './pages/ocr.js';

export function toggleSidebar() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('App container not found!');
    return;
  }
  app.classList.toggle('sidebar-collapsed');
  const isCollapsed = app.classList.contains('sidebar-collapsed');
  localStorage.setItem('sidebar-collapsed', isCollapsed ? 'true' : 'false');
  
  const icon = document.getElementById('sidebar-toggle-icon');
  if (icon) {
    if (isCollapsed) {
      icon.className = 'ti ti-chevron-right';
    } else {
      icon.className = 'ti ti-chevron-left';
    }
  }
  
  if (typeof window.showToast === 'function') {
    window.showToast(isCollapsed ? 'Sidebar collapsed' : 'Sidebar expanded', 'info');
  }
}

export function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
  const btn = document.getElementById('mobile-menu-btn').querySelector('i');
  btn.className = document.getElementById('sidebar').classList.contains('open') ? 'ti ti-x' : 'ti ti-menu-2';
}

export function showPage(page) {
  state.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if(navEl) navEl.classList.add('active');
  // Close sidebar on mobile after navigation
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
    document.getElementById('mobile-menu-btn').querySelector('i').className = 'ti ti-menu-2';
  }
  render();
}

export function loadingHtml() {
  return '<div class="loading-page"><div class="spinner"></div>Loading data from Database...</div>';
}

export async function render() {
  const main = document.getElementById('main-content');
  const client = initDb();
  if(!client) {
    main.innerHTML = '<div class="loading-page"><div style="color:#dc2626;font-size:16px;font-weight:600">⚠️ Database not connected</div><div style="color:#888;font-size:13px;margin-top:8px">The Database library failed to load. Check your internet connection and reload.</div></div>';
    return;
  }
  try {
    switch(state.currentPage) {
      case 'dashboard':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderDashboard();
        initCharts();
        break;
      case 'ai-chat':
        main.innerHTML = renderAIChat();
        scrollChatBottom();
        break;
      case 'customers':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderCustomers();
        break;
      case 'events':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderEvents();
        break;
      case 'expenses':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderExpenses();
        break;
      case 'analytics':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderAnalytics();
        initAnalyticsCharts();
        break;
      case 'ocr':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderOCR();
        break;
      case 'reels':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderReels();
        break;
    }
  } catch(err) {
    console.error('Render error:', err);
    main.innerHTML = `<div class="loading-page"><div style="color:#dc2626;font-size:16px;font-weight:600">⚠️ Error loading page</div><div style="color:#888;font-size:13px;margin-top:8px">${err.message}</div><button class="btn btn-gold" style="margin-top:16px" onclick="window.render()"><i class="ti ti-refresh"></i> Retry</button></div>`;
  }
}

// Bind layout functions to window for inline HTML onclick attributes
window.toggleSidebar = toggleSidebar;
window.toggleMobileSidebar = toggleMobileSidebar;
window.showPage = showPage;
window.render = render;

// Bootstrap application on load
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    const app = document.getElementById('app');
    if (app) app.classList.add('sidebar-collapsed');
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.className = 'ti ti-chevron-right';
  }
  render();
});
