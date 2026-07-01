// billl/js/app.js
import { state } from './state.js';
import { initDb } from './db.js';
import { renderDashboard, initCharts } from './pages/dashboard.js';
import { renderAIChat, scrollChatBottom } from './pages/aichat.js';
import { renderCustomers } from './pages/customers.js';
import { renderEvents } from './pages/events.js';
import { renderExpenses } from './pages/expenses.js';
import { renderAnalytics, initAnalyticsCharts } from './pages/analytics.js';
import { renderOCR } from './pages/ocr.js';
import { renderEmployeePage, renderRoleSelector, applyRoleLayout, enterRole, openSwitchModal } from './pages/employee.js';
import { renderStudents } from './pages/students.js';
import { renderJewels } from './pages/jewels.js';

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
  if (state.userRole === 'employee') return; // sidebar hidden in employee mode
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
  const btn = document.getElementById('mobile-menu-btn').querySelector('i');
  btn.className = document.getElementById('sidebar').classList.contains('open') ? 'ti ti-x' : 'ti ti-menu-2';
}

export function showPage(page) {
  // Block owner-only pages in employee mode
  const employeeAllowed = ['employee'];
  if (state.userRole === 'employee' && !employeeAllowed.includes(page)) {
    if (typeof window.showToast === 'function') {
      window.showToast('Access restricted to owner only', 'error');
    }
    return;
  }

  state.currentPage = page;
  if (page === 'customers') {
    window._selectedMonth = 'all';
    window._searchQuery = '';
    window._monthFilterExpanded = false;
    window._searchFieldExpanded = false;
  }
  if (page === 'events') {
    window._selectedEventMonth = 'all';
    window._eventSearchQuery = '';
    window._eventMonthFilterExpanded = false;
    window._eventSearchFieldExpanded = false;
  }
  if (page === 'students') {
    window._studentSearchQuery = '';
    window._studentStatusFilter = 'all';
  }
  if (page === 'jewels') {
    window._jewelSearchQuery = '';
    window._jewelStatusFilter = 'all';
  }
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

  // Employee mode: always show employee page
  if (state.userRole === 'employee') {
    main.innerHTML = renderEmployeePage();
    return;
  }

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
      case 'students':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderStudents();
        break;
      case 'jewels':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderJewels();
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

// Sidebar "Switch to Employee" button
window.openSwitchRoleModal = function() {
  openSwitchModal('employee');
};

// Bootstrap application on load
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    const app = document.getElementById('app');
    if (app) app.classList.add('sidebar-collapsed');
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.className = 'ti ti-chevron-right';
  }

  // Always show role selector on every page load — PIN required each time
  state.userRole = null;
  document.body.insertAdjacentHTML('beforeend', renderRoleSelector());

  render();
});
