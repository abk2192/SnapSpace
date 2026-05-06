import { escapeHtml, escapeAttr, uid, moveCursorToEnd } from './src/utils/dom.js';
import { registerServiceWorker } from './src/services/pwa.js';
import { dbService } from './src/services/Database.js';
import { themeService } from './src/services/Theme.js';
import { store } from './src/core/Store.js';
import { globalEvents } from './src/core/PubSub.js';
import { SidebarVM } from './src/viewmodels/SidebarVM.js';
import { SidebarView } from './src/views/SidebarView.js';
import { MainPanelVM } from './src/viewmodels/MainPanelVM.js';
import { MainPanelView } from './src/views/MainPanelView.js';

/* ========= PWA Service Worker Registration ========= */
registerServiceWorker();

/* ========= Documentation Dialog ========= */
const docsBtn = document.getElementById("docsBtn");
const docsBackdrop = document.getElementById("docsBackdrop");
const docsCloseBtn = document.getElementById("docsCloseBtn");

docsBtn?.addEventListener("click", () => { 
    document.body.classList.remove("sidebar-show"); 
    if(docsBackdrop) docsBackdrop.style.display = "flex"; 
});
docsCloseBtn?.addEventListener("click", () => { if(docsBackdrop) docsBackdrop.style.display = "none"; });
docsBackdrop?.addEventListener("click", (e) => { if(e.target === docsBackdrop) docsBackdrop.style.display = "none"; });

/* ========= Theme Engine ========= */
themeService.applyTheme();

const themeBtn = document.getElementById("themeBtn");
const themeBackdrop = document.getElementById("themeBackdrop");
const themeClose = document.getElementById("themeClose");
themeBtn?.addEventListener("click", () => { document.body.classList.remove("sidebar-show"); if(themeBackdrop) themeBackdrop.style.display = "flex"; });
themeClose?.addEventListener("click", () => { if(themeBackdrop) themeBackdrop.style.display = "none"; });
themeBackdrop?.addEventListener("click", (e) => { if(e.target === themeBackdrop) themeBackdrop.style.display = "none"; });
document.querySelectorAll('[data-set-theme]').forEach(el => { el.addEventListener('click', (e) => { themeService.setTheme(e.target.dataset.setTheme); }); });
document.querySelectorAll('[data-set-color]').forEach(el => { el.addEventListener('click', (e) => { themeService.setColor(e.target.dataset.setColor); }); });

/* ========= Global Reactivity Subscribers ========= */
globalEvents.subscribe('store:saved', () => {
    const ind = document.getElementById("saveIndicator");
    if(ind) {
        ind.style.opacity = "1";
        clearTimeout(ind.timer);
        ind.timer = setTimeout(() => ind.style.opacity = "0", 2000);
    }
});

globalEvents.subscribe('workspace:selected', () => {
    state = store.state.workspaces.find(w => w.id === store.state.activeWorkspaceId);
    workspaceTitleInput.value = state.title || "Project";
    render();
});

/* ========= Reactivity Compatibility ========= */
// The Store Proxy now automatically handles saving on data mutation.
// We leave this empty function to safely absorb legacy saveState() calls until Phase 3/4.
function saveState() {}

/* ========= State Initialization (Multi-Project) ========= */
let lastFocusedScenarioId = null; 
let targetScenarioForFile = null; 
let pendingImportData = null; 
let savedRange = null; 

let appState = null; 
let state = null; // Pointer to the active project

let templates = JSON.parse(localStorage.getItem('test_recorder_templates') || '[]');
function saveTemplates(){ localStorage.setItem('test_recorder_templates', JSON.stringify(templates)); }

// ========= Backup and Restore UI Injection & Logic =========
function injectBackupRestoreButtons() {
    try {
        let sidebarInner = document.getElementById('sidebarMenu') || document.querySelector('.sidebar-inner') || document.querySelector('.sidebar');
        
        if (sidebarInner && !document.getElementById('backupBtn')) {
            const backupBtn = document.createElement('button');
            backupBtn.className = 'menu-item';
            backupBtn.id = 'backupBtn';
            backupBtn.title = 'Backup Database (JSON)';
            backupBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Backup Data';
            
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'menu-item';
            restoreBtn.id = 'restoreBtn';
            restoreBtn.title = 'Restore Database (JSON)';
            restoreBtn.innerHTML = '<span class="material-symbols-outlined">settings_backup_restore</span> Restore Data';
            
            const forceUpdateBtn = document.createElement('button');
            forceUpdateBtn.className = 'menu-item';
            forceUpdateBtn.id = 'forceUpdateBtn';
            forceUpdateBtn.title = 'Clear Cache & Reload App';
            forceUpdateBtn.innerHTML = '<span class="material-symbols-outlined">system_update_alt</span> Force Update';
            
            sidebarInner.appendChild(backupBtn);
            sidebarInner.appendChild(restoreBtn);
            sidebarInner.appendChild(forceUpdateBtn);
        }
    } catch(err) {
        console.error("Backup button injection failed:", err);
    }
}

document.addEventListener('click', (e) => {
    const forceUpdateBtn = e.target.closest('#forceUpdateBtn');
    if (forceUpdateBtn) {
        if (confirm("This will clear the app's cache and fetch the latest version from the server. Your saved projects will NOT be deleted. Proceed?")) {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                        registration.unregister();
                    }
                });
            }
            if ('caches' in window) {
                caches.keys().then((keyList) => {
                    return Promise.all(keyList.map((key) => caches.delete(key)));
                }).then(() => {
                    window.location.reload(true);
                });
            } else {
                window.location.reload(true);
            }
        }
        return;
    }

    const backupBtn = e.target.closest('#backupBtn');
    if (backupBtn) {
        const dataStr = JSON.stringify(appState, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `SnapSpace_Backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }

    const restoreBtn = e.target.closest('#restoreBtn');
    if (restoreBtn) {
        let fileInput = document.getElementById('restoreFileInput');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'restoreFileInput';
            fileInput.accept = '.json';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const importedData = JSON.parse(event.target.result);
                        if (importedData && importedData.workspaces) {
                            if (confirm("WARNING: This will replace ALL your current projects and data. Are you sure you want to proceed?")) {
                                appState = importedData;
                                state = appState.workspaces.find(w => w.id === appState.activeWorkspaceId) || appState.workspaces[0];
                                store.state = appState; // Re-sync proxy baseline
                                workspaceTitleInput.value = state.title || "Project";
                                render();
                                globalEvents.publish('workspaces:changed');
                                store.scheduleSave();
                                alert("Data restored successfully!");
                            }
                        } else {
                            alert("Invalid backup file format.");
                        }
                    } catch (err) {
                        alert("Error parsing backup file.");
                    }
                    fileInput.value = ""; 
                };
                reader.readAsText(file);
            });
        }
        fileInput.click();
        return;
    }
});

async function bootApp() {
  
    injectBackupRestoreButtons();
    document.getElementById("renameTabBtn")?.remove();

    // Reorder Global Kebab Menu Actions (Only the tools meant for the top bar)
    const actionsContainer = document.querySelector('.appbar .actions');
    if (actionsContainer) {
        const btnOrder = ['importBtn', 'exportHtmlBtn', 'resetBtn'];
        btnOrder.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) actionsContainer.appendChild(btn);
        });
    }

    // Create a single Toggle Expand/Collapse button for space saving
    const expandAllBtn = document.getElementById('expandAllBtn');
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    if (expandAllBtn) expandAllBtn.style.display = 'none';
    if (collapseAllBtn) collapseAllBtn.style.display = 'none';
    
    const tabsbar = document.querySelector('.tabsbar');
    if (tabsbar && !tabsbar.querySelector('.tab-tools')) {
        const tabTools = document.createElement('div');
        tabTools.className = 'tab-tools';
        
        const toggleAllBtn = document.createElement('button');
        toggleAllBtn.className = 'btn secondary icon-only';
        toggleAllBtn.id = 'toggleAllBtn';
        toggleAllBtn.innerHTML = '<span class="material-symbols-outlined">unfold_less</span>';
        toggleAllBtn.title = "Collapse All";
        
        tabTools.appendChild(toggleAllBtn);
        tabsbar.appendChild(tabTools);
    }
    
    // Ensure all buttons in header/panel actions have icons and titles for mobile icon-only mode
    const actionIcons = {
        'exportHtmlBtn': 'ios_share',
        'importBtn': 'upload_file',
        'compareBtn': 'compare_arrows',
        'themeBtn': 'palette',
        'docsBtn': 'description',
        'expandAllBtn': 'unfold_more',
        'collapseAllBtn': 'unfold_less',
        'resetBtn': 'restart_alt',
        'addScenarioBtn': 'add'
    };
    
    document.querySelectorAll('.appbar .actions .btn, .tab-tools .btn').forEach(btn => {
        if (!btn.title) {
            let text = "";
            btn.childNodes.forEach(n => { if (n.nodeType === 3) text += n.textContent; });
            btn.title = text.trim() || "Action";
        }
        
        // Wrap text nodes in span.btn-text for reliable mobile hiding
        Array.from(btn.childNodes).forEach(n => {
            if (n.nodeType === 3 && n.textContent.trim().length > 0) {
                const span = document.createElement('span');
                span.className = 'btn-text';
                span.textContent = n.textContent;
                btn.replaceChild(span, n);
            }
        });

        if (!btn.querySelector('.material-symbols-outlined')) {
            const iconName = actionIcons[btn.id] || 'smart_button';
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-symbols-outlined';
            iconSpan.textContent = iconName;
            btn.insertBefore(iconSpan, btn.firstChild);
        }
    });

    // Inject Mobile Bottom Action Pill
    let mobilePill = document.getElementById("mobileActionPill");
    if (!mobilePill) {
        mobilePill = document.createElement("div");
        mobilePill.id = "mobileActionPill";
        mobilePill.className = "mobile-action-pill";
        mobilePill.innerHTML = `
            <button class="pill-btn" id="pillSearchBtn" title="Search"><span class="material-symbols-outlined">search</span></button>
            <button class="pill-btn pill-add" id="pillAddBtn"><span class="material-symbols-outlined">add</span> <span class="pill-text">Add Item</span></button>
            <button class="pill-btn" id="pillMoreBtn" title="More Actions"><span class="material-symbols-outlined">more_vert</span></button>
        `;
        document.body.appendChild(mobilePill);

        document.getElementById("pillSearchBtn").addEventListener("click", () => {
            if (typeof openCommandPalette === 'function') openCommandPalette();
        });
        document.getElementById("pillAddBtn").addEventListener("click", () => {
            document.getElementById("addScenarioBtn")?.click();
        });
        document.getElementById("pillMoreBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            document.body.classList.toggle("show-mobile-actions");
        });
    }

    // Load the reactive proxy state
    appState = await store.init();
    
    state = appState.workspaces.find(w => w.id === appState.activeWorkspaceId) || appState.workspaces[0];
    
    // Initialize Sidebar Subsystem
    const sidebarVM = new SidebarVM();
    const sidebarView = new SidebarView(sidebarVM);
    sidebarView.render();
    
    // Initialize Main Panel Subsystem
    window.mainPanelVM = new MainPanelVM();
    const mainPanelView = new MainPanelView(window.mainPanelVM);
    mainPanelView.render();
    window.promptDialog = promptDialog;
    
    workspaceTitleInput.value = state.title || "Project";
    
    render(); 
}

const workspaceTitleInput = document.getElementById("workspaceTitleInput");
workspaceTitleInput.addEventListener("input", (e) => {
    if (state) {
        state.title = e.target.value;
        globalEvents.publish('workspaces:changed');
        saveState();
    }
});

const resetBtn = document.getElementById("resetBtn");
resetBtn?.addEventListener("click", () => {
    if(confirm("Are you sure you want to reset the CURRENT project? This will delete all tabs and items inside it.")) {
        state.tabs = [{ id: uid(), name: "Tab 1", scenarios: [{ id: uid(), name:"Item 1", fields: [], evidenceHtml:"", isOpen: true }] }];
        state.activeTabId = state.tabs[0].id;
        render();
    }
});

/* ========= Global Live Search Engine Dropdown ========= */
const searchWrap = document.getElementById("searchWrap");
const searchInput = document.getElementById("searchInput");
const searchDropdown = document.getElementById("searchDropdown");

let searchBackdrop = document.getElementById("searchBackdrop");
if (!searchBackdrop && searchDropdown) {
    searchBackdrop = document.createElement("div");
    searchBackdrop.id = "searchBackdrop";
    searchBackdrop.className = "search-backdrop";
    document.body.appendChild(searchBackdrop);
}

function openCommandPalette() {
    if(searchWrap) searchWrap.classList.add("active-search");
    if(searchBackdrop) searchBackdrop.style.display = "block";
    setTimeout(() => searchInput?.focus(), 50);
    const q = searchInput?.value.trim() || "";
    if(q.length >= 3) {
        if(searchDropdown) searchDropdown.style.display = "flex";
        performSearch(q);
    }
}

function closeCommandPalette() {
    if(searchWrap) searchWrap.classList.remove("active-search");
    if(searchBackdrop) searchBackdrop.style.display = "none";
    if(searchDropdown) searchDropdown.style.display = "none";
    if(searchInput) searchInput.value = "";
    const appbar = document.querySelector('.appbar');
    if(appbar) appbar.classList.remove("search-active");
}

if (searchWrap && searchWrap.parentElement !== document.body) {
    if (searchDropdown && searchDropdown.parentElement !== searchWrap) {
        searchWrap.appendChild(searchDropdown);
    }
    document.body.appendChild(searchWrap);
    searchWrap.classList.add("command-palette");
}

let searchTriggerBtn = document.getElementById("searchTriggerBtn");
if (!searchTriggerBtn && searchWrap) {
    searchTriggerBtn = document.createElement("button");
    searchTriggerBtn.id = "searchTriggerBtn";
    searchTriggerBtn.className = "search-trigger-btn";
    searchTriggerBtn.innerHTML = '<span class="material-symbols-outlined">search</span><span class="st-text">Search...</span><kbd>Ctrl+K</kbd>';
    const appbarInner = document.querySelector('.appbar-inner');
    const actions = document.querySelector('.appbar .actions');
    if (appbarInner && actions) {
        appbarInner.insertBefore(searchTriggerBtn, actions);
    }
    searchTriggerBtn.addEventListener("click", openCommandPalette);
}

// Click outside to close dropdown and shrink bar
document.addEventListener("click", (e) => {
    const pillSearchBtn = document.getElementById("pillSearchBtn");
    if (pillSearchBtn && pillSearchBtn.contains(e.target)) return;
    if (searchTriggerBtn && searchTriggerBtn.contains(e.target)) return;
    if(searchWrap && !searchWrap.contains(e.target) && searchWrap.classList.contains("active-search")) {
        closeCommandPalette();
    }
});

function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="search-hl">$1</span>');
}

// Live search on input
let searchTimeout;
searchInput?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (q.length < 3) { 
        if(searchDropdown) { searchDropdown.style.display = "none"; searchDropdown.innerHTML = ""; }
        if(searchBackdrop) searchBackdrop.style.display = "none";
        return; 
    }
    if(searchDropdown) searchDropdown.style.display = "flex";
    if(searchBackdrop) searchBackdrop.style.display = "block";
    searchTimeout = setTimeout(() => { performSearch(q); }, 200);
});

function performSearch(query) {
    const q = query.toLowerCase();
    let resultsHtml = "";
    let matchCount = 0;

    appState.workspaces.forEach(ws => {
        const wsMatch = (ws.title || "").toLowerCase().includes(q);
        ws.tabs.forEach(tab => {
            const tabMatch = (tab.name || "").toLowerCase().includes(q);
            tab.scenarios.forEach((sc, idx) => {
                let hasMatch = false;
                let snippets = [];

                if (wsMatch) {
                    hasMatch = true; snippets.push(`<b>Project:</b> ${highlightText(ws.title || "", query)}`);
                }
                if (tabMatch) {
                    hasMatch = true; snippets.push(`<b>Tab:</b> ${highlightText(tab.name || "", query)}`);
                }
                if ((sc.name || "").toLowerCase().includes(q)) {
                    hasMatch = true; snippets.push(`<b>Title:</b> ${highlightText(sc.name || "", query)}`);
                }
                
                (sc.fields || []).forEach(f => {
                    const keyStr = f.key || "";
                    const valStr = f.val || "";
                    if (keyStr.toLowerCase().includes(q) || valStr.toLowerCase().includes(q)) {
                        hasMatch = true; snippets.push(`<b>Field:</b> ${highlightText(keyStr, query)} = ${highlightText(valStr, query)}`);
                    }
                });

                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = sc.evidenceHtml || "";
                const rawText = tempDiv.textContent || tempDiv.innerText || "";
                
                if (rawText.toLowerCase().includes(q)) {
                    hasMatch = true;
                    const matchIdx = rawText.toLowerCase().indexOf(q);
                    const start = Math.max(0, matchIdx - 30);
                    const end = Math.min(rawText.length, matchIdx + q.length + 30);
                    const snippetText = (start > 0 ? "..." : "") + rawText.substring(start, end) + (end < rawText.length ? "..." : "");
                    snippets.push(`<b>Notes:</b> ${highlightText(snippetText, query)}`);
                }

                if (hasMatch) {
                    matchCount++;
                    const wsTitleDisp = wsMatch ? highlightText(ws.title || "", query) : escapeHtml(ws.title || "");
                    const tabNameDisp = tabMatch ? highlightText(tab.name || "", query) : escapeHtml(tab.name || "");
                    const scNameDisp = ((sc.name || "").toLowerCase().includes(q)) ? highlightText(sc.name || "", query) : escapeHtml(sc.name || `Item ${idx+1}`);

                    resultsHtml += `
                        <div class="search-result" data-ws="${ws.id}" data-tab="${tab.id}" data-sc="${sc.id}">
                            <div class="res-title">
                               <span class="res-tab">${wsTitleDisp} > ${tabNameDisp}</span>
                               ${scNameDisp}
                            </div>
                            <div class="res-snip">${snippets.join("<br>")}</div>
                        </div>
                    `;
                }
            });
        });
    });

    if (matchCount === 0) {
        searchDropdown.innerHTML = `<div style="text-align:center; padding: 12px; color: var(--muted); font-size: 13px;">No results found for "${escapeHtml(query)}".</div>`;
    } else {
        searchDropdown.innerHTML = `<div style="padding: 4px 8px; font-weight:bold; font-size:12px; color:var(--muted);">Found ${matchCount} matches:</div>` + resultsHtml;
    }
}

searchDropdown?.addEventListener("click", (e) => {
    const res = e.target.closest('.search-result');
    if (res) {
        // Switch context to correct project and tab
        appState.activeWorkspaceId = res.dataset.ws;
        state = appState.workspaces.find(w => w.id === appState.activeWorkspaceId);
        workspaceTitleInput.value = state.title;
        state.activeTabId = res.dataset.tab;
        
        globalEvents.publish('workspaces:changed');
        render();
        closeCommandPalette();
        
        setTimeout(() => {
            const scCard = document.querySelector(`details[data-sid="${res.dataset.sc}"]`);
            if (scCard) {
                scCard.open = true;
                scCard.scrollIntoView({ behavior: "smooth", block: "center" });
                scCard.style.boxShadow = "0 0 0 3px var(--primary)";
                setTimeout(() => scCard.style.boxShadow = "var(--shadow)", 2000);
            }
        }, 100);
    }
});


/* ========= Rendering ========= */
// Expose Bridge functions for Modals until Phase 5
function activeTab(){ return window.mainPanelVM?.activeTab; }
function render(){ globalEvents.publish('tabs:changed'); globalEvents.publish('scenarios:changed'); }

/* ========= Interactions ========= */

// Prevent item cards from expanding/collapsing when interacting with field tags
document.addEventListener("click", (e) => {
  // Close open scenario more menus
  const moreBtn = e.target.closest('.scen-more-btn');
  document.querySelectorAll('.scen-more-wrap.active').forEach(w => {
      if (moreBtn && w === moreBtn.parentElement) return;
      w.classList.remove('active');
  });
  if (moreBtn) {
      moreBtn.parentElement.classList.toggle('active');
  }

  const summary = e.target.closest("summary");
  if (summary) {
    // If clicking directly on a tag, OR if text is currently highlighted (drag-select)
    if (e.target.closest(".tag") || e.target.closest(".scen-more-wrap") || window.getSelection().toString().trim().length > 0) {
      e.preventDefault(); // Stops the <details> element from toggling
    }
  }

  // Close mobile action menu when clicking outside
  if (document.body.classList.contains("show-mobile-actions")) {
      const actions = document.querySelector('.appbar .actions');
      const moreBtn = document.getElementById("pillMoreBtn");
      const clickedActionBtn = e.target.closest('.appbar .actions .btn');
      if ((actions && !actions.contains(e.target) && e.target !== moreBtn) || clickedActionBtn) {
          document.body.classList.remove("show-mobile-actions");
      }
  }
});


document.addEventListener("mousedown", (e) => { if (e.target.closest('[data-cmd]')) { e.preventDefault(); } });

function updateToolbarState() {
  document.querySelectorAll('.wysiwyg-toolbar .btn').forEach(b => b.classList.remove('active-format'));
  const sel = window.getSelection(); 
  if (!sel || !sel.rangeCount) return; 
  let node = sel.anchorNode; 
  if (!node) return; 
  if (node?.nodeType === 3) node = node.parentNode || null;
  if (!node || typeof node.closest !== 'function') return;
  const ev = node.closest('.evidence');
  if (ev) {
    const toolbar = ev.previousElementSibling;
    if (toolbar && toolbar.classList.contains('wysiwyg-toolbar')) {
       ['bold', 'italic', 'insertUnorderedList'].forEach(cmd => {
          if (document.queryCommandState(cmd)) { const btn = toolbar.querySelector(`[data-cmd="${cmd}"]`); if (btn) btn.classList.add('active-format'); }
       });
    }
  }
}

document.addEventListener("selectionchange", () => {
  updateToolbarState();
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    let node = range?.commonAncestorContainer || null;
    if (node?.nodeType === 3) node = node.parentNode || null;
    if (node && typeof node.closest === 'function' && node.closest('.evidence')) { savedRange = range; }
  }
});

function restoreSelectionAndInsert(ev, html) {
  ev.focus();
  if (savedRange && savedRange.commonAncestorContainer) {
    let node = savedRange?.commonAncestorContainer || null;
    if (node?.nodeType === 3) node = node.parentNode || null;
    if (node && typeof node.closest === 'function' && node.closest('.evidence') === ev) {
       const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange);
    } else { moveCursorToEnd(ev); }
  } else { moveCursorToEnd(ev); }
  document.execCommand("insertHTML", false, html);
  persistEvidence(ev);
}

document.addEventListener("focusin", (e) => { const scWrapper = e.target.closest(".scenario"); if (scWrapper) lastFocusedScenarioId = scWrapper.dataset.sid; });

// File Preview & Image Lightbox Modals
const fpBackdrop = document.getElementById("filePreviewBackdrop");
const fpCloseBtn = document.getElementById("fpCloseBtn");
const fpCopyBtn = document.getElementById("fpCopyBtn");
fpCloseBtn?.addEventListener("click", () => { if(fpBackdrop) fpBackdrop.style.display = "none"; });
if(fpBackdrop) fpBackdrop.addEventListener("click", (e) => { if(e.target === fpBackdrop) fpBackdrop.style.display = "none"; });

fpCopyBtn?.addEventListener("click", async () => {
  const textToCopy = document.getElementById("fpContent").textContent;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    const orig = fpCopyBtn.innerHTML; fpCopyBtn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Copied!`;
    setTimeout(() => { fpCopyBtn.innerHTML = orig; }, 1500);
  } catch(err) { alert("Failed to copy text. Your browser may block this feature."); }
});

const imgBackdrop = document.getElementById("imgPreviewBackdrop");
if(imgBackdrop) imgBackdrop.addEventListener("click", () => { imgBackdrop.style.display = "none"; });

let imgClickTimer = null;
document.addEventListener("click", (e) => {
  const img = e.target.closest(".evidence img"); if (!img) return;
  if (e.detail > 1) return; 
  
  clearTimeout(imgClickTimer);
  imgClickTimer = setTimeout(() => {
    let w = Number(img.dataset.w || 100); w = (w <= 40) ? 100 : (w - 20); img.dataset.w = String(w); img.style.width = w + "%";
    const ev = img.closest('.evidence');
    if (ev) persistEvidence(ev); 
  }, 200);
});

document.addEventListener("dblclick", (e) => {
  const img = e.target.closest(".evidence img");
  if (img) { 
    clearTimeout(imgClickTimer);
    const el = document.getElementById("imgPreviewEl"); if(el) el.src = img.src; 
    if(imgBackdrop) imgBackdrop.style.display = "flex"; 
    window.getSelection().removeAllRanges(); 
  }
});

// ========= TEMPLATES ENGINE =========
const tplOpenBtn = document.getElementById("tplOpenBtn");
const tplBackdrop = document.getElementById("tplBackdrop");
const tplCloseBtn = document.getElementById("tplCloseBtn");
const tplListEl = document.getElementById("tplList");
const tplExportTrigger = document.getElementById("tplExportTrigger");
const tplImportTrigger = document.getElementById("tplImportTrigger");
const tplImportFile = document.getElementById("tplImportFile");

function renderTemplates() {
    tplListEl.innerHTML = '';
    if(templates.length === 0) {
        tplListEl.innerHTML = '<div style="color:var(--muted); font-style:italic; padding: 10px;">No templates saved. Save one from an item card header!</div>';
        return;
    }
    templates.forEach(t => {
        const div = document.createElement("div"); div.className = "tpl-item";
        div.innerHTML = `
            <div>
                <div class="tpl-name">${escapeHtml(t.name)}</div>
                <div class="tpl-meta">${t.data.fields.length} Fields • ${t.data.evidenceHtml ? "Has Content" : "No Content"}</div>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn secondary" style="padding:6px 10px; font-size:12px;" data-use-tpl="${t.id}">Use Template</button>
                <button class="btn danger icon-only" data-del-tpl="${t.id}"><span class="material-symbols-outlined">delete</span></button>
            </div>
        `;
        tplListEl.appendChild(div);
    });
}

tplOpenBtn?.addEventListener("click", () => { document.body.classList.remove("sidebar-show"); renderTemplates(); if(tplBackdrop) tplBackdrop.style.display = "flex"; });
tplCloseBtn?.addEventListener("click", () => { if(tplBackdrop) tplBackdrop.style.display = "none"; });
if(tplBackdrop) tplBackdrop.addEventListener("click", (e) => { if(e.target === tplBackdrop) tplBackdrop.style.display = "none"; });

tplListEl?.addEventListener("click", (e) => {
    const useBtn = e.target.closest("[data-use-tpl]");
    if (useBtn) {
        const tpl = templates.find(x => x.id === useBtn.dataset.useTpl);
        if (tpl) {
            const clone = JSON.parse(JSON.stringify(tpl.data));
            clone.id = uid();
            clone.name = clone.name || tpl.name;
            clone.fields.forEach(f => f.id = uid());
            activeTab().scenarios.push(clone);
            render(); tplBackdrop.style.display = "none";
        }
        return;
    }
    const delBtn = e.target.closest("[data-del-tpl]");
    if (delBtn) {
        templates = templates.filter(x => x.id !== delBtn.dataset.delTpl);
        saveTemplates(); renderTemplates();
    }
});

tplExportTrigger?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(templates)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "item_templates.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

tplImportTrigger?.addEventListener("click", () => tplImportFile?.click());
tplImportFile?.addEventListener("change", (e) => {
    const file = e.target.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = (event) => {
        try {
            const loaded = JSON.parse(event.target.result);
            if(Array.isArray(loaded)) {
                loaded.forEach(l => { l.id = uid(); templates.push(l); });
                saveTemplates(); renderTemplates(); alert("Templates imported successfully!");
            }
        } catch(err) { alert("Invalid template JSON file."); }
    };
    r.readAsText(file); e.target.value = '';
});

// ========= MOVE SCENARIO MODAL (Cross-Project enabled) =========
const moveBackdrop = document.getElementById("moveBackdrop");
const moveSelect = document.getElementById("moveSelect");
const moveCancelBtn = document.getElementById("moveCancelBtn");
const moveConfirmBtn = document.getElementById("moveConfirmBtn");
let scenarioToMoveId = null;

let lastMoveStructureHash = null;
 
function openMoveDialog(sid) {
    // 1. Generate a lightning-fast structural fingerprint
    let currentHash = "";
    for(let w of appState.workspaces) {
       currentHash += w.id + w.title;
       for(let t of w.tabs) currentHash += t.id + t.name;
    }
    
    // 2. Only rebuild the DOM if the structure actually changed
    if (lastMoveStructureHash !== currentHash) {
        moveSelect.innerHTML = appState.workspaces.map(ws => {
            return `<optgroup label="${escapeHtml(ws.title)}">` +
                   ws.tabs.map(t => `<option value="${ws.id}|${t.id}">${escapeHtml(t.name)}</option>`).join('') +
                   `</optgroup>`;
        }).join('');
        lastMoveStructureHash = currentHash;
    }
    
    scenarioToMoveId = sid;
    if(moveBackdrop) moveBackdrop.style.display = 'flex';
}
moveCancelBtn?.addEventListener("click", () => { if(moveBackdrop) moveBackdrop.style.display = 'none'; scenarioToMoveId = null; });
if(moveBackdrop) moveBackdrop.addEventListener("click", (e) => { if(e.target === moveBackdrop) moveCancelBtn?.click(); });
moveConfirmBtn?.addEventListener("click", () => {
    const val = moveSelect.value;
    if(!scenarioToMoveId || !val) return;
    
    const [destWsId, destTabId] = val.split('|');
    const srcTab = activeTab(); 
    const destWs = appState.workspaces.find(w => w.id === destWsId);
    const destTab = destWs ? destWs.tabs.find(t => t.id === destTabId) : null;
    
    if(srcTab && destTab) {
        const scIdx = srcTab.scenarios.findIndex(s => s.id === scenarioToMoveId);
        if(scIdx >= 0) {
            const sc = srcTab.scenarios.splice(scIdx, 1)[0];
            destTab.scenarios.push(sc);
            render();
        }
    }
    if(moveBackdrop) moveBackdrop.style.display = 'none'; scenarioToMoveId = null;
});

// ========= COMPARE MODE LOGIC =========
const compareBtn = document.getElementById("compareBtn");
const compBackdrop = document.getElementById("compareBackdrop");
const compCloseBtn = document.getElementById("compCloseBtn");

const compLeftTab = document.getElementById("compLeftTab");
const compLeftScen = document.getElementById("compLeftScen");
const compLeftEv = document.getElementById("compLeftEv");

const compRightTab = document.getElementById("compRightTab");
const compRightScen = document.getElementById("compRightScen");
const compRightEv = document.getElementById("compRightEv");

let lastCompStructureHash = null;
 
function populateCompareSelects() {
  // Generate a fingerprint of current tabs and item names
  let currentHash = "";
  for(let t of state.tabs) {
     currentHash += t.id + t.name;
     for(let s of t.scenarios) currentHash += s.id + s.name;
  }
  
  if (lastCompStructureHash !== currentHash) {
      let optionsHtml = '';
      state.tabs.forEach((t, idx) => {
        optionsHtml += `<option value="${t.id}">${escapeHtml(t.name || `Tab ${idx+1}`)}</option>`;
      });
      
      compLeftTab.innerHTML = optionsHtml;
      compRightTab.innerHTML = optionsHtml;
      updateCompScenarios(compLeftTab, compLeftScen);
      updateCompScenarios(compRightTab, compRightScen);
      
      lastCompStructureHash = currentHash;
  }
}

function updateCompScenarios(tabSelect, scenSelect) {
  const t = state.tabs.find(x => x.id === tabSelect.value);
  scenSelect.innerHTML = '';
  if(t) {
    t.scenarios.forEach((sc, idx) => {
      const name = (sc.name || "").trim();
      const label = name || `Item ${idx+1}`;
      scenSelect.innerHTML += `<option value="${sc.id}">${escapeHtml(label)}</option>`;
    });
  }
}

function renderCompEv(scenSelect, evDiv) {
   let found = null;
   for(let t of state.tabs) {
     let sc = t.scenarios.find(x => x.id === scenSelect.value);
     if(sc) { found = sc; break; }
   }
   evDiv.innerHTML = found ? found.evidenceHtml : '<div style="color:var(--muted); font-style:italic;">No content found.</div>';
}

compLeftTab?.addEventListener('change', () => { updateCompScenarios(compLeftTab, compLeftScen); renderCompEv(compLeftScen, compLeftEv); });
compLeftScen?.addEventListener('change', () => { renderCompEv(compLeftScen, compLeftEv); });

compRightTab?.addEventListener('change', () => { updateCompScenarios(compRightTab, compRightScen); renderCompEv(compRightScen, compRightEv); });
compRightScen?.addEventListener('change', () => { renderCompEv(compRightScen, compRightEv); });

compareBtn?.addEventListener('click', () => {
  document.body.classList.remove("sidebar-show");
  populateCompareSelects();
  if(state.tabs.length > 0) {
    renderCompEv(compLeftScen, compLeftEv);
    renderCompEv(compRightScen, compRightEv);
  }
  if(compBackdrop) compBackdrop.style.display = 'flex';
});

compCloseBtn?.addEventListener('click', () => { if(compBackdrop) compBackdrop.style.display = 'none'; });

const compSync = document.getElementById('compSync');
let isSyncingLeft = false, isSyncingRight = false;

compLeftEv?.addEventListener('scroll', () => {
   if(!compSync?.checked || isSyncingLeft) { isSyncingLeft = false; return; }
   isSyncingRight = true;
   const percentage = compLeftEv.scrollTop / (compLeftEv.scrollHeight - compLeftEv.clientHeight || 1);
   if(compRightEv) compRightEv.scrollTop = percentage * (compRightEv.scrollHeight - compRightEv.clientHeight);
});

compRightEv?.addEventListener('scroll', () => {
   if(!compSync?.checked || isSyncingRight) { isSyncingRight = false; return; }
   isSyncingLeft = true;
   const percentage = compRightEv.scrollTop / (compRightEv.scrollHeight - compRightEv.clientHeight || 1);
   if(compLeftEv) compLeftEv.scrollTop = percentage * (compLeftEv.scrollHeight - compLeftEv.clientHeight);
});

// Create File Dialog
const cfBackdrop = document.getElementById('cfBackdrop');
const cfName = document.getElementById('cfName');
const cfContent = document.getElementById('cfContent');
const cfCancel = document.getElementById('cfCancel');
const cfOk = document.getElementById('cfOk');

function openCreateFileDialog(sid) {
  targetScenarioForFile = sid; if(cfName) cfName.value = ''; if(cfContent) cfContent.value = '';
  if(cfBackdrop) cfBackdrop.style.display = 'flex'; setTimeout(() => cfName?.focus(), 50);
}
cfCancel?.addEventListener('click', () => { if(cfBackdrop) cfBackdrop.style.display = 'none'; targetScenarioForFile = null; });
if(cfBackdrop) cfBackdrop.addEventListener('click', (e) => { if (e.target === cfBackdrop) cfCancel?.click(); });
cfOk?.addEventListener('click', () => {
  const name = cfName?.value.trim() || 'document.txt'; const content = cfContent?.value;
  if(!content) { alert("File content cannot be empty."); return; }
  const ev = document.querySelector(`.evidence[data-evidence="${targetScenarioForFile}"]`);
  if(ev) {
    const blob = new Blob([content], { type: 'text/plain' }); const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result; 
      const html = `<span class="attachment" contenteditable="false"><a href="${dataUrl}" download="${name}" data-name="${name}" data-dataurl="${dataUrl}"><span class="material-symbols-outlined" style="font-size:16px;">attachment</span> ${name}</a><span class="copy-att material-symbols-outlined" title="Copy file" data-copy="${dataUrl}" contenteditable="false">content_copy</span></span>&nbsp;`;
      restoreSelectionAndInsert(ev, html);
    }; reader.readAsDataURL(blob);
  }
  if(cfBackdrop) cfBackdrop.style.display = 'none'; targetScenarioForFile = null;
});

// ========= IMPORT LOGIC (Smart Merge + Import as New Project) =========
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");
const importBackdrop = document.getElementById("importBackdrop");
const importCancelBtn = document.getElementById("importCancelBtn");
const importConfirmBtn = document.getElementById("importConfirmBtn");

importBtn?.addEventListener("click", () => { importInput?.click(); });
importInput?.addEventListener("change", (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parser = new DOMParser(); const doc = parser.parseFromString(event.target.result, "text/html");
      const payloadEl = doc.getElementById('data-payload');
      if (payloadEl) {
        pendingImportData = JSON.parse(payloadEl.textContent);
        if (pendingImportData && pendingImportData.tabs) {
          const tCount = pendingImportData.tabs.length;
          const sCount = pendingImportData.tabs.reduce((sum, t) => sum + t.scenarios.length, 0);
          const detailsEl = document.getElementById("importDetails"); if(detailsEl) detailsEl.textContent = `Found ${tCount} tab(s) and ${sCount} item(s). How would you like to load them?`;
          if(importBackdrop) importBackdrop.style.display = "flex";
        } else { alert("Invalid export format."); }
      } else { alert("No data found in this HTML file."); }
    } catch (err) { alert("Error reading file."); }
    e.target.value = ""; 
  };
  reader.readAsText(file);
});

importCancelBtn?.addEventListener("click", () => { if(importBackdrop) importBackdrop.style.display = "none"; pendingImportData = null; });
if(importBackdrop) importBackdrop.addEventListener("click", (e) => { if(e.target === importBackdrop) importCancelBtn?.click(); });

importConfirmBtn?.addEventListener("click", () => {
  if(!pendingImportData) return;
  const modeRadio = document.querySelector('input[name="importMode"]:checked');
  const mode = modeRadio ? modeRadio.value : "append";
  
  if (mode === "new_project") {
    const newWsId = uid();
    const newWs = {
        id: newWsId,
        title: (pendingImportData.title || "Imported Project") + " (Import)",
        activeTabId: pendingImportData.activeTabId || pendingImportData.tabs[0].id,
        tabs: pendingImportData.tabs.map(t => {
            const clonedTab = JSON.parse(JSON.stringify(t));
            clonedTab.id = uid();
            clonedTab.scenarios.forEach(s => { s.id = uid(); });
            return clonedTab;
        })
    };
    appState.workspaces.push(newWs);
    appState.activeWorkspaceId = newWsId;
    state = newWs;
    workspaceTitleInput.value = state.title;
    globalEvents.publish('workspaces:changed');
  }
  else if (mode === "replace") {
    state.tabs = pendingImportData.tabs;
    state.activeTabId = pendingImportData.activeTabId || pendingImportData.tabs[0].id;
  } 
  else if (mode === "append") {
    pendingImportData.tabs.forEach(t => {
      const clonedTab = JSON.parse(JSON.stringify(t));
      clonedTab.id = uid(); 
      clonedTab.name = (clonedTab.name || "Untitled") + " - Imported";
      clonedTab.scenarios.forEach(s => { 
        s.id = uid(); 
        if(s.name) s.name += " - Imported"; 
      }); 
      state.tabs.push(clonedTab);
    });
  } 
  else if (mode === "merge") {
    const activeT = activeTab();
    pendingImportData.tabs.forEach(t => {
      t.scenarios.forEach(s => {
        const clonedScen = JSON.parse(JSON.stringify(s));
        clonedScen.id = uid(); 
        if(clonedScen.name) clonedScen.name += " - Imported";
        activeT.scenarios.push(clonedScen);
      });
    });
  }
  
  render(); if(importBackdrop) importBackdrop.style.display = "none"; pendingImportData = null;
});

// ========= EXPORT LOGIC =========
const exportHtmlBtn = document.getElementById("exportHtmlBtn");
const exportBackdrop = document.getElementById("exportBackdrop");
const exportCancelBtn = document.getElementById("exportCancelBtn");
const exportConfirmBtn = document.getElementById("exportConfirmBtn");

exportHtmlBtn?.addEventListener("click", () => {
  const now = new Date(); 
  
  const safeTitle = (state.title || "Project").replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
  const expInput = document.getElementById("exportFilenameInput"); if(expInput) expInput.value = `${safeTitle}_Export_${now.toISOString().slice(0,10)}.html`;
    
  const list = document.getElementById("exportChecklist"); list.innerHTML = "";
  if(!list) return;
  state.tabs.forEach((tab, tIdx) => {
    const group = document.createElement("div"); group.className = "export-tab-group";
    const tLabel = document.createElement("label"); tLabel.className = "export-tab-label";
    const tCheck = document.createElement("input"); tCheck.type = "checkbox"; tCheck.checked = true; tCheck.dataset.tabId = tab.id;
    tLabel.appendChild(tCheck); tLabel.appendChild(document.createTextNode(tab.name || `Tab ${tIdx+1}`)); group.appendChild(tLabel);

    const sList = document.createElement("div"); sList.className = "export-scen-list";
    tab.scenarios.forEach((sc, sIdx) => {
      const sLabel = document.createElement("label"); sLabel.className = "export-scen-label";
      const sCheck = document.createElement("input"); sCheck.type = "checkbox"; sCheck.checked = true; sCheck.dataset.tabId = tab.id; sCheck.dataset.scenId = sc.id;
      
      const sName = (sc.name || "").trim();
      sLabel.appendChild(sCheck); sLabel.appendChild(document.createTextNode(sName ? `${sIdx+1}. ${sName}` : `Item ${sIdx+1}`)); sList.appendChild(sLabel);
    });

    tCheck.addEventListener("change", (e) => { sList.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = e.target.checked); });
    sList.addEventListener("change", () => {
      const all = sList.querySelectorAll('input[type="checkbox"]').length;
      const checked = sList.querySelectorAll('input[type="checkbox"]:checked').length;
      tCheck.checked = (all === checked && all > 0); tCheck.indeterminate = (checked > 0 && checked < all);
    });
    group.appendChild(sList); list.appendChild(group);
  });
  if(exportBackdrop) exportBackdrop.style.display = "flex";
});

exportCancelBtn?.addEventListener("click", () => { if(exportBackdrop) exportBackdrop.style.display = "none"; });
if(exportBackdrop) exportBackdrop.addEventListener("click", (e) => { if(e.target === exportBackdrop) exportCancelBtn?.click(); });

exportConfirmBtn?.addEventListener("click", () => {
  const filteredState = { activeTabId: null, title: state.title, tabs: [] };
  const tabGroups = document.querySelectorAll('.export-tab-group');
  tabGroups.forEach(group => {
    const tCheck = group.querySelector('.export-tab-label input');
    if (tCheck.checked || tCheck.indeterminate) {
      const originalTab = state.tabs.find(t => t.id === tCheck.dataset.tabId);
      if (originalTab) {
        const newTab = { ...originalTab, scenarios: [] };
        group.querySelectorAll('.export-scen-list input:checked').forEach(sCheck => {
           const originalScen = originalTab.scenarios.find(s => s.id === sCheck.dataset.scenId);
           if(originalScen) newTab.scenarios.push({...originalScen});
        });
        if (newTab.scenarios.length > 0 || tCheck.checked) { filteredState.tabs.push(newTab); }
      }
    }
  });

  if (filteredState.tabs.length === 0) { alert("Please select at least one item to export."); return; }
  filteredState.activeTabId = filteredState.tabs[0].id;
  if(exportBackdrop) exportBackdrop.style.display = "none";
  
  const expInput = document.getElementById("exportFilenameInput");
  let customFilename = (expInput ? expInput.value.trim() : "") || "SnapSpace_Export.html";
  if (!customFilename.endsWith(".html")) customFilename += ".html";
  
  exportHTML(filteredState, customFilename); 
});

document.addEventListener("toggle", (e) => {
  // We added "&& e.target.isConnected" to prevent the browser
  // from closing the item during rapid redraws
  if (e.target.matches("details.scenario") && e.target.isConnected) {
    const sc = findScenario(e.target.dataset.sid);
    if (sc) { sc.isOpen = e.target.open; saveState(); }
  }
}, true);

document.addEventListener("focusout", (e) => {
  if (e.target.matches("input[data-field='name']")) {
      if (!e.target.value.trim()) {
          e.target.value = e.target.placeholder;
          e.target.dispatchEvent(new Event("input", {bubbles: true}));
      }
  }
});

document.addEventListener("input", (e) => {
  const nameInp = e.target.closest("input[data-field='name']");
  if (nameInp) { const sc = findScenario(nameInp.dataset.sid); if (sc) { sc.name = nameInp.value; } return; }
  const keyInp = e.target.closest("input[data-fkey]");
  if (keyInp) { const sc = findScenario(keyInp.dataset.sid); const field = sc.fields.find(f => f.id === keyInp.dataset.fkey); if (field) { field.key = keyInp.value; globalEvents.publish('tags:updated'); } return; }
  const valInp = e.target.closest("input[data-fval]");
  if (valInp) { const sc = findScenario(valInp.dataset.sid); const field = sc.fields.find(f => f.id === valInp.dataset.fval); if (field) { field.val = valInp.value; globalEvents.publish('tags:updated'); } return; }
});

document.addEventListener("input", (e) => {
  const ev = e.target.closest(".evidence[data-evidence]");
  if (!ev) return;
  const sc = findScenario(ev.getAttribute("data-evidence"));
  if (!sc) return;
  sc.evidenceHtml = ev.innerHTML; saveState();
});

document.addEventListener("click", (e) => {
  const actionBtn = e.target.closest('.action-btn');
  if(actionBtn && e.target.closest('summary')) { e.preventDefault(); }

  const cfBtn = e.target.closest("[data-createfile]");
  if (cfBtn) { openCreateFileDialog(cfBtn.dataset.createfile); return; }

  // Action Buttons
  const dupBtn = e.target.closest("[data-duplicate]");
  if (dupBtn) {
      const sc = findScenario(dupBtn.dataset.duplicate);
      if(sc) {
          const clone = JSON.parse(JSON.stringify(sc));
          clone.id = uid(); clone.name = (clone.name || "Untitled") + " (Copy)";
          clone.fields.forEach(f => f.id = uid());
          const tab = activeTab();
          const idx = tab.scenarios.findIndex(s => s.id === sc.id);
          tab.scenarios.splice(idx + 1, 0, clone);
          render();
      }
      return;
  }

  const mBtn = e.target.closest("[data-move]");
  if (mBtn) { openMoveDialog(mBtn.dataset.move); return; }

  const tplBtn = e.target.closest("[data-template]");
  if (tplBtn) {
      const sc = findScenario(tplBtn.dataset.template);
      if(sc) {
          promptDialog("Save Template", (sc.name || "Item") + " Template", "Name your template:", (name) => {
              if(!name) return;
              const tpl = JSON.parse(JSON.stringify(sc)); delete tpl.id; tpl.fields.forEach(f => delete f.id);
              templates.push({ id: uid(), name: name, data: tpl });
              saveTemplates();
          });
      }
      return;
  }

  const cmdBtn = e.target.closest('[data-cmd]');
  if (cmdBtn) {
    e.preventDefault(); const cmd = cmdBtn.dataset.cmd; let val = cmdBtn.dataset.val || null;
    if (cmd === 'createLink') {
       val = prompt("Enter the URL:");
       if (!val) return;
       if (!/^https?:\/\//i.test(val)) val = 'https://' + val; 
    }
    document.execCommand(cmd, false, val); updateToolbarState();
    const ev = cmdBtn.closest('.evidence-wrap').querySelector('.evidence');
    if (ev) persistEvidence(ev);
    return;
  }
  
  const evidenceLink = e.target.closest(".evidence a");
  if (evidenceLink && !evidenceLink.closest(".attachment") && !evidenceLink.hasAttribute("data-dataurl")) {
      e.preventDefault();
      window.open(evidenceLink.href, '_blank');
      return;
  }

  const del = e.target.closest("[data-delete]"); if (del){ deleteScenario(del.dataset.delete); return; }
  const att = e.target.closest("[data-attach]"); if (att){ openFilePicker(att.dataset.attach); return; }
  const addF = e.target.closest("[data-addfield]");
  if (addF){
    const sc = findScenario(addF.dataset.addfield);
    if(sc) { sc.fields.push({ id: uid(), key:"", val:"" }); render(); setTimeout(() => { const inputs = document.querySelectorAll(`input[data-sid="${sc.id}"][data-fkey]`); if(inputs.length > 0) inputs[inputs.length - 1].focus(); }, 50); }
    return;
  }
  const delF = e.target.closest("[data-delfield]"); if (delF){ const sc = findScenario(delF.dataset.sid); if(sc) { sc.fields = sc.fields.filter(f => f.id !== delF.dataset.delfield); render(); } return; }
});

document.addEventListener("paste", (e) => {
  const ev = e.target.closest(".evidence[data-evidence]"); if (!ev) return;
  const dt = e.clipboardData; if (!dt) return;
  
  const files = [...dt.files || []]; const imgFile = files.find(f => f.type && f.type.startsWith("image/"));
  if (imgFile){
      e.preventDefault();
      const sel = window.getSelection(); if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0);
      insertImageFileIntoEvidence(imgFile, ev);
      return;
  }
 
  const text = dt.getData("text/plain");
  const urlRegex = /^(https?:\/\/[^\s]+)$/i;
  if (text && urlRegex.test(text.trim())) {
      e.preventDefault();
      const url = text.trim();
      const sel = window.getSelection(); if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0);
      const html = `<a href="${url}" target="_blank" style="color: var(--primary); text-decoration: underline; cursor: pointer;">${url}</a>&nbsp;`;
      restoreSelectionAndInsert(ev, html);
      return;
  }
});

// QUICK COPY ATTACHMENT LOGIC
document.addEventListener("click", async (e) => {
  const copyBtn = e.target.closest(".copy-att");
  if (copyBtn) {
    e.preventDefault(); e.stopPropagation();
    const attachmentSpan = copyBtn.closest('.attachment');
    if (!attachmentSpan) return;

    try {
      const clone = attachmentSpan.cloneNode(true);
      const html = clone.outerHTML + "&nbsp;";
      const plainText = clone.innerText || "Attachment";
      
      if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" })
        });
        await navigator.clipboard.write([item]);
      } else {
        throw new Error("ClipboardItem not supported or not secure context");
      }
    } catch(err) {
      const temp = document.createElement("div");
      temp.contentEditable = "true";
      temp.innerHTML = attachmentSpan.outerHTML + "&nbsp;";
      temp.style.position = "fixed"; temp.style.opacity = "0";
      document.body.appendChild(temp);
      const range = document.createRange(); range.selectNodeContents(temp);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      document.execCommand("copy");
      document.body.removeChild(temp);
    }

    const oldTxt = copyBtn.innerHTML; copyBtn.innerHTML = "check_circle"; 
    setTimeout(() => copyBtn.innerHTML = oldTxt, 1500);
    return;
  }
});

// The core attachment preview/download logic
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-dataurl]"); if (!a) return; e.preventDefault();
  const dataurl = a.dataset.dataurl; if (!dataurl) return;
  const name = a.dataset.name || a.getAttribute("download") || "attachment";
  
  const parts = dataurl.split(",");
  const meta = parts[0] || ""; const b64 = parts[1] || "";
  const m = /data:(.*?);base64/.exec(meta); const mime = (m && m[1]) ? m[1] : "application/octet-stream";
  
  const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], {type:mime});
  
  const extMatch = name.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : "";
  const binaryExts = ["doc", "docx", "xls", "xlsx", "pdf", "zip", "tar", "gz", "exe", "dll"];
  
  const isText = !binaryExts.includes(ext) && (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('sql') || mime.includes('javascript') || mime.includes('plain'));

  if (isText) {
    const reader = new FileReader();
    reader.onload = (readEvent) => {
      const fpTitle = document.getElementById('fpTitle'); if(fpTitle) fpTitle.textContent = name;
      const fpContent = document.getElementById('fpContent'); if(fpContent) fpContent.textContent = readEvent.target.result;
      const filePreviewBackdrop = document.getElementById('filePreviewBackdrop'); if(filePreviewBackdrop) filePreviewBackdrop.style.display = 'flex';
      const fpDownloadBtn = document.getElementById('fpDownloadBtn'); if(fpDownloadBtn) fpDownloadBtn.onclick = () => {
        const url = URL.createObjectURL(blob); const tmp = document.createElement("a");
        tmp.href = url; tmp.download = name; document.body.appendChild(tmp); tmp.click();
        setTimeout(() => { tmp.remove(); URL.revokeObjectURL(url); }, 500);
      };
    }; reader.readAsText(blob); return;
  }
  const url = URL.createObjectURL(blob); const tmp = document.createElement("a"); tmp.href = url; tmp.download = name;
  document.body.appendChild(tmp); tmp.click(); setTimeout(() => { tmp.remove(); URL.revokeObjectURL(url); }, 500);
});

/* ========= Global Keyboard Shortcuts ========= */
document.addEventListener("keydown", (e) => {
  if (e.target.matches("summary .header-name-input")) {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (!document.execCommand("insertText", false, " ")) {
          const start = e.target.selectionStart; const end = e.target.selectionEnd;
          e.target.value = e.target.value.substring(0, start) + " " + e.target.value.substring(end);
          e.target.selectionStart = e.target.selectionEnd = start + 1;
          e.target.dispatchEvent(new Event("input", {bubbles:true}));
      }
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); e.target.blur(); return; }
  }

  if (document.getElementById("dlgBackdrop")?.style.display === "flex" || 
      document.getElementById("themeBackdrop")?.style.display === "flex" ||
      document.getElementById("docsBackdrop")?.style.display === "flex" ||
      document.getElementById("cfBackdrop")?.style.display === "flex" ||
      document.getElementById("exportBackdrop")?.style.display === "flex" ||
      document.getElementById("importBackdrop")?.style.display === "flex" ||
      document.getElementById("compareBackdrop")?.style.display === "flex" ||
      document.getElementById("filePreviewBackdrop")?.style.display === "flex" ||
      document.getElementById("imgPreviewBackdrop")?.style.display === "flex" ||
      document.getElementById("tplBackdrop")?.style.display === "flex" ||
      document.getElementById("moveBackdrop")?.style.display === "flex" ||
      document.getElementById("restoreBackdrop")?.style.display === "flex" ||
      document.getElementById("searchBackdrop")?.style.display === "block") {
      
      if (e.key === "Escape") {
         document.getElementById("dlgCancel")?.click();
         document.getElementById("themeClose")?.click();
         const docsClose = document.getElementById("docsCloseBtn");
         if(docsClose) docsClose.click();
         document.getElementById("cfCancel")?.click();
         document.getElementById("exportCancelBtn")?.click();
         document.getElementById("importCancelBtn")?.click();
         document.getElementById("compCloseBtn")?.click();
         document.getElementById("fpCloseBtn")?.click();
         document.getElementById("tplCloseBtn")?.click();
         document.getElementById("moveCancelBtn")?.click();
         if (document.getElementById("imgPreviewBackdrop")) document.getElementById("imgPreviewBackdrop").style.display = "none";
         const restoreCancel = document.getElementById("restoreCancelBtn");
         if (restoreCancel) restoreCancel.click();
         if (document.getElementById("searchBackdrop")) {
             closeCommandPalette();
         }
      }
      return; 
  }

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

  // New Global Search Shortcut
  if (cmdOrCtrl && (e.key.toLowerCase() === 'k' || (e.shiftKey && e.key.toLowerCase() === 'f'))) {
      e.preventDefault();
      if (typeof openCommandPalette === 'function') openCommandPalette();
  }
  else if (cmdOrCtrl && e.key.toLowerCase() === 's') { e.preventDefault(); document.getElementById("exportHtmlBtn")?.click(); }
  else if (cmdOrCtrl && e.key.toLowerCase() === 'o') { e.preventDefault(); document.getElementById("importBtn")?.click(); }
  else if (e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'n') { e.preventDefault(); document.getElementById("addScenarioBtn")?.click(); }
    if (key === 'r') { e.preventDefault(); document.getElementById("renameTabBtn")?.click(); }
    if (key === 't') { e.preventDefault(); window.mainPanelVM?.addTab(); }
    if (key === 'c') { e.preventDefault(); document.getElementById("themeBtn")?.click(); }
    if (key === 'v') { e.preventDefault(); document.getElementById("compareBtn")?.click(); }
    if (key === 'f') { 
      e.preventDefault(); let sc = null;
      if (lastFocusedScenarioId) sc = findScenario(lastFocusedScenarioId);
      if (!sc) { const tab = activeTab(); if(tab && tab.scenarios.length > 0) sc = tab.scenarios[tab.scenarios.length - 1]; }
      if (sc) {
         sc.fields.push({ id: uid(), key:"", val:"" }); render();
         setTimeout(() => { const inputs = document.querySelectorAll(`input[data-sid="${sc.id}"][data-fkey]`); if(inputs.length > 0) inputs[inputs.length - 1].focus(); }, 50);
      }
    }
  }
});

/* ========= Helpers ========= */

function findScenario(sid){ for (const ws of appState.workspaces) { for (const t of ws.tabs){ const sc = t.scenarios.find(s => s.id === sid); if (sc) return sc; } } return null; }
function deleteScenario(sid){ window.mainPanelVM?.deleteScenario(sid); }

function openFilePicker(sid){
  const input = document.querySelector(`input[type="file"][data-file="${sid}"]`); const ev = document.querySelector(`.evidence[data-evidence="${sid}"]`);
  if (!input || !ev) return;
  input.onchange = () => {
    const f = input.files && input.files[0]; if (!f) return;
    if (f.type && f.type.startsWith("image/")){ insertImageFileIntoEvidence(f, ev, f.name); input.value = ""; return; }
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result; 
      const html = `<span class="attachment" contenteditable="false"><a href="${dataUrl}" download="${f.name}" data-name="${f.name}" data-dataurl="${dataUrl}"><span class="material-symbols-outlined" style="font-size:16px;">attachment</span> ${f.name}</a><span class="copy-att material-symbols-outlined" title="Copy file" data-copy="${dataUrl}" contenteditable="false">content_copy</span></span>&nbsp;`;
      restoreSelectionAndInsert(ev, html);
      input.value = ""; 
    }; r.readAsDataURL(f);
  }; input.click();
}

function insertImageFileIntoEvidence(file, ev, altText){
  const r = new FileReader();
  r.onload = () => {
    const html = `<img src="${r.result}" alt="${altText || 'attached image'}" style="width:100%;" data-w="100" contenteditable="false" />&nbsp;`;
    restoreSelectionAndInsert(ev, html);
  }; r.readAsDataURL(file);
}

function persistEvidence(ev){ const sid = ev.getAttribute("data-evidence"); const sc = findScenario(sid); if (!sc) return; sc.evidenceHtml = ev.innerHTML; saveState(); }


/* ========= Export HTML ========= */
function exportHTML(exportData, filename){
  const styles = document.querySelector('style').innerHTML;
  const payloadStr = JSON.stringify(exportData).replace(/</g, '\\u003c');

  const exportTemplate = `<!DOCTYPE html>
<html lang="en" data-theme="${themeService.getTheme()}" data-color="${themeService.getColor()}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SnapSpace Export</title>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
<style>${styles}</style>
</head>
<body class="readonly">
  <header class="appbar"><div class="appbar-inner"><div class="title"><div class="badge"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M9 15l2 2 4-4"></path></svg></div> SnapSpace Export</div></div></header>
  <div class="tabsbar"><div class="tabs" id="tabs"></div></div>
  <main><div id="panel"></div></main>

  <script id="data-payload" type="application/json">${payloadStr}<\/script>
  <script>
    const state = JSON.parse(document.getElementById('data-payload').textContent);
    let activeTabId = state.activeTabId;

    function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({"&":"&","<":"<",">":">",'"':"&quot;","'":"&#39;"}[s])); }
    function escapeAttr(str){ return escapeHtml(str).replace(/"/g, "&quot;"); }

    function renderView() {
      const tabsEl = document.getElementById("tabs");
      tabsEl.innerHTML = state.tabs.map(tab => \`<button class="tab \${tab.id === activeTabId ? 'active' : ''}" data-tab="\${tab.id}"><span class="tab-label" title="\${escapeAttr(tab.name)}">\${escapeHtml(tab.name)}</span></button>\`).join("");
      const panelEl = document.getElementById("panel");
      const activeTab = state.tabs.find(t => t.id === activeTabId);
      if(!activeTab) return;

      const scenariosHtml = activeTab.scenarios.map((sc, idx) => {
        const validFields = (sc.fields || []).filter(f => f.key.trim() || f.val.trim());
        const tagsHtml = validFields.map(f => \`<span class="tag"><b>\${escapeHtml(f.key || "Field")}:</b> \${escapeHtml(f.val || "-")}</span>\`).join("");
        
        const fieldsHtml = validFields.map(f => \`
          <div class="field-row" style="margin-bottom: 8px; display: flex; gap: 8px;">
            <input class="input" value="\${escapeAttr(f.key)}" readonly style="width: 30%; background: transparent; border-color: var(--outline-2); font-weight: 700; user-select: text;" />
            <input class="input" value="\${escapeAttr(f.val)}" readonly style="flex: 1; background: var(--surface-2); border-color: var(--outline-2); user-select: text;" />
          </div>
        \`).join("");

        const fieldsSection = fieldsHtml ? \`
          <div class="label" style="margin-bottom: 8px;"><span class="material-symbols-outlined" style="font-size: 14px;">tune</span> Properties</div>
          <div class="field-list" style="margin-bottom: 16px;">\${fieldsHtml}</div>
        \` : '';

        return \`<details class="scenario" \${sc.isOpen !== false ? 'open' : ''}>
            <summary>
              <div class="summary-content">
                <div style="display:flex; align-items:center; gap:6px; width: 100%;">
                  <input class="header-name-input" value="\${escapeAttr(sc.name||"")}" placeholder="Item \${idx+1}" readonly style="padding-left: 0;" />
                </div>
                \${tagsHtml ? \`<div class="summary-tags">\${tagsHtml}</div>\` : ''}
              </div>
              <div class="summary-actions">
                <div class="chev"><span class="material-symbols-outlined">expand_more</span></div>
              </div>
            </summary>
            <div class="card-body">
              \${fieldsSection}
              <div class="evidence-wrap" style="margin-top: 0;">
                <div class="label" style="margin-bottom: 6px;"><span class="material-symbols-outlined" style="font-size: 14px;">image</span> Notes & Media</div>
                <div class="evidence">\${sc.evidenceHtml}</div>
              </div>
            </div>
          </details>\`;
      }).join("");
      panelEl.innerHTML = scenariosHtml;
    }

    let imgClickTimerExport = null;
    document.addEventListener("click", (e) => {
      const img = e.target.closest(".evidence img"); 
      if (img){ 
        if(e.detail > 1) return; 
        clearTimeout(imgClickTimerExport);
        imgClickTimerExport = setTimeout(() => {
          let w = Number(img.dataset.w || 100); w = (w <= 40) ? 100 : (w - 20); img.dataset.w = String(w); img.style.width = w + "%"; 
        }, 200);
        return; 
      }
      
      const tabBtn = e.target.closest(".tab"); if(tabBtn) { activeTabId = tabBtn.dataset.tab; renderView(); return; }
      
      const copyBtn = e.target.closest(".copy-att");
      if (copyBtn) {
        e.preventDefault(); e.stopPropagation();
        const attachmentSpan = copyBtn.closest('.attachment');
        if (!attachmentSpan) return;

        try {
          const clone = attachmentSpan.cloneNode(true);
          const html = clone.outerHTML + "&nbsp;";
          const plainText = clone.innerText || "Attachment";
          
          if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
            const item = new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([plainText], { type: "text/plain" })
            });
            navigator.clipboard.write([item]);
          } else { throw new Error("Fallback"); }
        } catch(err) {
          const temp = document.createElement("div"); temp.contentEditable = "true";
          temp.innerHTML = attachmentSpan.outerHTML + "&nbsp;"; temp.style.position = "fixed"; temp.style.opacity = "0";
          document.body.appendChild(temp); const range = document.createRange(); range.selectNodeContents(temp);
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); document.execCommand("copy");
          document.body.removeChild(temp);
        }
        const oldTxt = copyBtn.innerHTML; copyBtn.innerHTML = "check_circle"; setTimeout(() => copyBtn.innerHTML = oldTxt, 1500);
        return;
      }

      const a = e.target.closest("a[data-dataurl]"); if (!a) return; e.preventDefault(); const dataurl = a.dataset.dataurl; if (!dataurl) return;
      const name = a.dataset.name || a.getAttribute("download") || "attachment";
      const parts = dataurl.split(","); const meta = parts[0] || ""; const b64 = parts[1] || ""; const m = /data:(.*?);base64/.exec(meta); const mime = (m && m[1]) ? m[1] : "application/octet-stream";
      
      const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], {type:mime});
      const isText = mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('sql') || mime.includes('javascript') || mime.includes('plain');

      if (isText) {
        const reader = new FileReader();
        reader.onload = (re) => {
           let fpBackdrop = document.getElementById("fpBackdropExport");
           if (!fpBackdrop) {
              fpBackdrop = document.createElement("div"); fpBackdrop.id = "fpBackdropExport";
              fpBackdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";
              fpBackdrop.innerHTML = '<div style="background:var(--surface);width:min(800px, 100%);max-height:90vh;display:flex;flex-direction:column;border-radius:18px;box-shadow:var(--shadow);overflow:hidden;"><div style="padding:14px 16px;border-bottom:1px solid var(--outline-2);display:flex;justify-content:space-between;align-items:center;font-weight:bold;color:var(--text);"><span id="fpTitleExport" style="word-break:break-all;"></span><div><button id="fpCopyExport" style="margin-right:8px;padding:6px 12px;cursor:pointer;border-radius:999px;border:1px solid var(--outline);background:var(--surface);color:var(--text);font-weight:600;"><span class="material-symbols-outlined">content_copy</span> Copy Text</button><button id="fpDlExport" style="margin-right:8px;padding:6px 12px;cursor:pointer;border-radius:999px;border:1px solid transparent;background:var(--primary);color:#fff;font-weight:600;"><span class="material-symbols-outlined">download</span> Download</button><button id="fpCloseExport" style="padding:6px 12px;cursor:pointer;border-radius:999px;border:1px solid var(--outline);background:var(--surface);color:var(--text);font-weight:600;">Close</button></div></div><div style="flex:1;overflow:auto;background:var(--input-bg);"><pre id="fpContentExport" style="margin:0;padding:16px;font-family:monospace;font-size:13px;white-space:pre-wrap;word-wrap:break-word;color:var(--text);"></pre></div></div>';
              document.body.appendChild(fpBackdrop);
              document.getElementById("fpCloseExport").onclick = () => fpBackdrop.style.display = "none";
              fpBackdrop.onclick = (ev) => { if(ev.target === fpBackdrop) fpBackdrop.style.display = "none"; };
              
              document.getElementById("fpCopyExport").onclick = async () => {
                const textToCopy = document.getElementById("fpContentExport").textContent;
                try {
                  if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(textToCopy);
                  } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = textToCopy;
                    textArea.style.position = "fixed";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                  }
                  const btn = document.getElementById("fpCopyExport"); const orig = btn.innerHTML; btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Copied!';
                  setTimeout(() => { btn.innerHTML = orig; }, 1500);
                } catch(err) { alert("Failed to copy text."); }
              };
           }
           document.getElementById("fpTitleExport").textContent = name;
           document.getElementById("fpContentExport").textContent = re.target.result;
           document.getElementById("fpDlExport").onclick = () => {
               const url = URL.createObjectURL(blob); const tmp = document.createElement("a");
               tmp.href = url; tmp.download = name; document.body.appendChild(tmp); tmp.click();
               setTimeout(() => { tmp.remove(); URL.revokeObjectURL(url); }, 500);
           };
           fpBackdrop.style.display = "flex";
        };
        reader.readAsText(blob); return;
      }
      
      const url = URL.createObjectURL(blob); const tmp = document.createElement("a"); tmp.href = url; tmp.download = name;
      document.body.appendChild(tmp); tmp.click(); setTimeout(() => { tmp.remove(); URL.revokeObjectURL(url); }, 500);
    });

    document.addEventListener("dblclick", (e) => {
      const img = e.target.closest(".evidence img");
      if (img){
        let backdrop = document.getElementById("imgPreviewBackdropExport");
        if (!backdrop) {
          backdrop = document.createElement("div"); backdrop.id = "imgPreviewBackdropExport";
          backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;";
          const imgEl = document.createElement("img"); imgEl.id = "imgPreviewElExport";
          imgEl.style.cssText = "max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:var(--shadow);background:var(--surface);";
          backdrop.appendChild(imgEl); document.body.appendChild(backdrop);
          backdrop.onclick = () => backdrop.style.display = "none";
        }
        document.getElementById("imgPreviewElExport").src = img.src;
        backdrop.style.display = "flex"; window.getSelection().removeAllRanges();
      }
    });

    renderView(); 
  <\/script>
</body>
</html>`;

  const blob = new Blob([exportTemplate], {type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  
  a.download = filename; 
  
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

/* ========= Dialog utility ========= */
const dlgBackdrop = document.getElementById("dlgBackdrop");
const dlgTitle = document.getElementById("dlgTitle");
const dlgInput = document.getElementById("dlgInput");
const dlgHint = document.getElementById("dlgHint");
const dlgCancel = document.getElementById("dlgCancel");
const dlgOk = document.getElementById("dlgOk");
let dlgCallback = null;

function promptDialog(title, initial, hint, onOk){
  if(dlgTitle) dlgTitle.textContent = title; if(dlgHint) dlgHint.textContent = hint || ""; if(dlgInput) dlgInput.value = initial || "";
  dlgCallback = onOk; if(dlgBackdrop) dlgBackdrop.style.display = "flex"; setTimeout(() => dlgInput?.focus(), 0);
}

dlgInput?.addEventListener("keydown", (e) => { if(e.key === "Enter" && dlgBackdrop?.style.display === "flex") { e.preventDefault(); dlgOk?.click(); } });
dlgCancel?.addEventListener("click", () => { if(dlgBackdrop) dlgBackdrop.style.display = "none"; dlgCallback = null; });
dlgOk?.addEventListener("click", () => { const val = dlgInput?.value; if(dlgBackdrop) dlgBackdrop.style.display = "none"; const cb = dlgCallback; dlgCallback = null; if (cb) cb(val); });
if(dlgBackdrop) dlgBackdrop.addEventListener("click", (e) => { if (e.target === dlgBackdrop) dlgCancel?.click(); });

/* Initial render */
bootApp();
