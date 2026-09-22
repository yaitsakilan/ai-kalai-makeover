// billl/js/app.js
import { state } from './state.js';
import { initDb } from './db.js';
import { renderDashboard, initCharts } from './pages/dashboard.js';
import { renderAIChat, scrollChatBottom } from './pages/aichat.js';
import { renderCustomers } from './pages/customers.js';
import { renderEvents } from './pages/events.js';
import { renderExpenses, initExpenseAnalyticsCharts } from './pages/expenses.js';
import { renderAnalytics, initAnalyticsCharts } from './pages/analytics.js';
import { renderOCR } from './pages/ocr.js';
import { renderEmployeePage, renderRoleSelector, applyRoleLayout, enterRole, openSwitchModal } from './pages/employee.js';
import { renderStudents } from './pages/students.js';
import { renderJewels } from './pages/jewels.js';
import { renderEmployees } from './pages/employees.js';
import { renderFinance, initFinanceCharts } from './pages/finance.js';

// Global Chart.js luxury dark / light theme configuration
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#cbd5e1';
  Chart.defaults.borderColor = 'rgba(245, 200, 66, 0.12)';
  if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
    Chart.defaults.plugins.tooltip.backgroundColor = '#1c1308';
    Chart.defaults.plugins.tooltip.titleColor = '#f5c842';
    Chart.defaults.plugins.tooltip.bodyColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(245, 200, 66, 0.3)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
  }
}

// ─────────────────────────────────────────────
//  THEME MANAGEMENT (Luxury Dark vs Clean White)
// ─────────────────────────────────────────────

export function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme, false);
}

export function applyTheme(theme, showNotice = false) {
  const isLight = theme === 'light';
  if (isLight) {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    document.documentElement.classList.remove('theme-dark');
    document.documentElement.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    document.documentElement.classList.remove('theme-light');
    document.documentElement.classList.add('theme-dark');
  }
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  state.theme = isLight ? 'light' : 'dark';

  // Update meta theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isLight ? '#faf9f7' : '#0d0904');
  }

  // Update Chart.js defaults
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = isLight ? '#475569' : '#cbd5e1';
    Chart.defaults.borderColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(245, 200, 66, 0.12)';
    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
      Chart.defaults.plugins.tooltip.backgroundColor = isLight ? '#ffffff' : '#1c1308';
      Chart.defaults.plugins.tooltip.titleColor = isLight ? '#b45309' : '#f5c842';
      Chart.defaults.plugins.tooltip.bodyColor = isLight ? '#1e293b' : '#f8fafc';
      Chart.defaults.plugins.tooltip.borderColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(245, 200, 66, 0.3)';
      Chart.defaults.plugins.tooltip.borderWidth = 1;
    }
  }

  updateThemeButtonsUI(isLight);

  if (showNotice && typeof window.showToast === 'function') {
    window.showToast(isLight ? 'Switched to White Theme ☀️' : 'Switched to Dark Theme 🌙', 'info');
  }
}

export function toggleTheme() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme, true);

  // If currently on a chart page, re-render to apply updated chart theme
  if (['dashboard', 'analytics', 'finance'].includes(state.currentPage)) {
    render();
  }
}

export function updateThemeButtonsUI(isLight) {
  // Floating quick button
  const quickBtn = document.getElementById('theme-quick-btn');
  const quickIcon = document.getElementById('theme-quick-icon');
  const quickText = document.getElementById('theme-quick-text');
  if (quickBtn) {
    if (isLight) {
      if (quickIcon) quickIcon.className = 'ti ti-moon';
      if (quickText) quickText.textContent = 'Dark Theme';
      quickBtn.setAttribute('title', 'Switch to Dark Theme');
    } else {
      if (quickIcon) quickIcon.className = 'ti ti-sun';
      if (quickText) quickText.textContent = 'White Theme';
      quickBtn.setAttribute('title', 'Switch to White Theme');
    }
  }

  // Sidebar footer button
  const sidebarBtn = document.getElementById('sidebar-theme-toggle-btn');
  const sidebarIcon = document.getElementById('sidebar-theme-icon');
  const sidebarText = document.getElementById('sidebar-theme-text');
  const sidebarPill = document.getElementById('sidebar-theme-pill');
  if (sidebarBtn) {
    if (sidebarIcon) {
      sidebarIcon.className = isLight ? 'ti ti-sun' : 'ti ti-moon';
      sidebarIcon.style.color = isLight ? '#d97706' : '#f5c842';
    }
    if (sidebarText) {
      sidebarText.textContent = isLight ? 'White Theme' : 'Dark Theme';
    }
    if (sidebarPill) {
      sidebarPill.textContent = isLight ? '☀️ Light' : '🌙 Dark';
    }
  }
}

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
    window._selectedMonth = undefined;
    window._searchQuery = '';
    window._monthFilterExpanded = false;
    window._searchFieldExpanded = false;
  }
  if (page === 'events') {
    window._selectedEventMonth = 'all';
    window._eventSearchQuery = '';
    window._eventMonthFilterExpanded = false;
    window._eventSearchFieldExpanded = false;
    window._eventStatusFilter = 'all';
    window._eventActiveTab = 'history';
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
    main.innerHTML = await renderEmployeePage();
    return;
  }

  if (typeof supabase === 'undefined') {
    main.innerHTML = '<div class="loading-page"><div style="color:#dc2626;font-size:16px;font-weight:600">⚠️ Database library not loaded</div><div style="color:#888;font-size:13px;margin-top:8px">The Supabase library failed to load from CDN. Check your internet connection and reload.</div></div>';
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
      case 'product-expenses':
      case 'expenses':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderExpenses();
        initExpenseAnalyticsCharts();
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
      case 'employees':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderEmployees();
        break;
      case 'finance':
        main.innerHTML = loadingHtml();
        main.innerHTML = await renderFinance();
        initFinanceCharts();
        break;
    }
  } catch(err) {
    console.error('Render error:', err);
    main.innerHTML = `<div class="loading-page"><div style="color:#dc2626;font-size:16px;font-weight:600">⚠️ Error loading page</div><div style="color:#888;font-size:13px;margin-top:8px">${err.message}</div><button class="btn btn-gold" style="margin-top:16px" onclick="window.render()"><i class="ti ti-refresh"></i> Retry</button></div>`;
  }
}

// Bind layout & theme functions to window for inline HTML onclick attributes
window.toggleSidebar = toggleSidebar;
window.toggleMobileSidebar = toggleMobileSidebar;
window.showPage = showPage;
window.render = render;
window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;

// Sidebar "Switch to Employee" button
window.openSwitchRoleModal = function() {
  openSwitchModal('employee');
};

// Immediately initialize theme
initTheme();

// Bootstrap application on load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

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

// ─────────────────────────────────────────────
// 📅 UNIVERSAL DATE PICKER HANDLER
// Automatically triggers the native calendar picker popup whenever
// ANY date input anywhere across the website is clicked or tapped.
// Uses capture phase (true) so it works even inside modals with stopPropagation.
// ─────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const dateInput = e.target && e.target.closest ? e.target.closest('input[type="date"]') : (e.target && e.target.matches && e.target.matches('input[type="date"]') ? e.target : null);
  if (dateInput && typeof dateInput.showPicker === 'function') {
    try {
      dateInput.showPicker();
    } catch (err) {
      // Ignored if already open or not supported
    }
  }
}, true);

