
/* ========= PWA Service Worker Registration ========= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.error('SW registration failed:', err);
    });
  });
}


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
const rootParams = document.documentElement;
let currentTheme = localStorage.getItem('test_recorder_theme') || 'light';
let currentColor = localStorage.getItem('test_recorder_color') || 'blue';

function applyTheme() {
  rootParams.setAttribute('data-theme', currentTheme);
  rootParams.setAttribute('data-color', currentColor);
  localStorage.setItem('test_recorder_theme', currentTheme);
  localStorage.setItem('test_recorder_color', currentColor);
  
  document.querySelectorAll('[data-set-theme]').forEach(el => { el.classList.toggle('active', el.dataset.setTheme === currentTheme); });
  document.querySelectorAll('[data-set-color]').forEach(el => { el.classList.toggle('active', el.dataset.setColor === currentColor); });
}
applyTheme();

const themeBtn = document.getElementById("themeBtn");
const themeBackdrop = document.getElementById("themeBackdrop");
const themeClose = document.getElementById("themeClose");
themeBtn?.addEventListener("click", () => { document.body.classList.remove("sidebar-show"); if(themeBackdrop) themeBackdrop.style.display = "flex"; });
themeClose?.addEventListener("click", () => { if(themeBackdrop) themeBackdrop.style.display = "none"; });
themeBackdrop?.addEventListener("click", (e) => { if(e.target === themeBackdrop) themeBackdrop.style.display = "none"; });
document.querySelectorAll('[data-set-theme]').forEach(el => { el.addEventListener('click', (e) => { currentTheme = e.target.dataset.setTheme; applyTheme(); }); });
document.querySelectorAll('[data-set-color]').forEach(el => { el.addEventListener('click', (e) => { currentColor = e.target.dataset.setColor; applyTheme(); }); });

/* ========= Sidebar Resizer ========= */
const sidebarResizer = document.getElementById("sidebarResizer");
let isResizingSidebar = false;

// Load saved width
const savedSidebarWidth = localStorage.getItem('snapspace_sidebar_width');
if (savedSidebarWidth) { document.documentElement.style.setProperty('--sidebar-width', savedSidebarWidth); }

sidebarResizer?.addEventListener("mousedown", (e) => {
    isResizingSidebar = true;
    sidebarResizer.classList.add('active');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
});
document.addEventListener("mousemove", (e) => {
    if (!isResizingSidebar) return;
    let newWidth = e.clientX;
    if (newWidth < 200) newWidth = 200;
    if (newWidth > 600) newWidth = 600;
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
});
document.addEventListener("mouseup", () => {
    if (isResizingSidebar) {
        isResizingSidebar = false;
        sidebarResizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('snapspace_sidebar_width', document.documentElement.style.getPropertyValue('--sidebar-width'));
    }
});

/* ========= Sidebar Hamburger Menu Logic ========= */
const mainMenuBtn = document.getElementById("mainMenuBtn");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const mobileSidebarClose = document.getElementById("mobileSidebarClose");

mainMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.innerWidth >= 1100) {
        document.body.classList.toggle("sidebar-hide");
    } else {
        document.body.classList.toggle("sidebar-show");
        if(sidebarBackdrop) setTimeout(() => sidebarBackdrop.style.opacity = "1", 10);
    }
});

mobileSidebarClose?.addEventListener("click", () => {
   if(!sidebarBackdrop) return;
   sidebarBackdrop.style.opacity = "0";
   setTimeout(() => document.body.classList.remove("sidebar-show"), 300);
});

if(sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
        sidebarBackdrop.style.opacity = "0";
        setTimeout(() => document.body.classList.remove("sidebar-show"), 300);
    });
}

document.querySelectorAll('#sidebarMenu .menu-item:not(#addWorkspaceBtn)').forEach(item => {
    item.addEventListener("click", () => {
        if(window.innerWidth < 1100) {
           sidebarBackdrop.style.opacity = "0";
           setTimeout(() => document.body.classList.remove("sidebar-show"), 300);
        }
    });
});

/* ========= Async Database Engine (IndexedDB) ========= */
const DB_NAME = "SnapSpaceDB";
const STORE_NAME = "workspace";
const DB_VERSION = 1;
const STATE_KEY = "test_recorder_tabs_v18"; 

let dbInstance = null;

function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (e) => reject("DB Error: " + e.target.errorCode);
        request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function saveState() {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(JSON.stringify(appState), STATE_KEY);
        
        const ind = document.getElementById("saveIndicator");
        if(ind) {
            ind.style.opacity = "1";
            clearTimeout(ind.timer);
            ind.timer = setTimeout(() => ind.style.opacity = "0", 2000);
        }
    } catch (err) { console.error("Failed to save state:", err); }
}

async function loadStateFromDB() {
    return new Promise(async (resolve) => {
        try {
            const db = await initDB();
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(STATE_KEY);
            request.onsuccess = () => { if (request.result) resolve(JSON.parse(request.result)); else resolve(null); };
            request.onerror = () => resolve(null);
        } catch (err) { resolve(null); }
    });
}

/* ========= State Initialization (Multi-Project) ========= */
let lastFocusedScenarioId = null; 
let targetScenarioForFile = null; 
let pendingImportData = null; 
let savedRange = null; 

let appState = null; 
let state = null; // Pointer to the active project

let templates = JSON.parse(localStorage.getItem('test_recorder_templates') || '[]');
function saveTemplates(){ localStorage.setItem('test_recorder_templates', JSON.stringify(templates)); }
function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }

async function bootApp() {
  
    
    let loadedState = await loadStateFromDB();
    
    if (!loadedState) {
        try { 
            const oldLocal = localStorage.getItem("test_recorder_tabs_v17");
            if (oldLocal) loadedState = JSON.parse(oldLocal); 
        } catch (e) {}
    }

    if (loadedState && loadedState.workspaces) {
        appState = loadedState;
    } else if (loadedState) {
        appState = {
            activeWorkspaceId: "default",
            workspaces: [{
                id: "default",
                title: loadedState.workspaceTitle || "Project 1",
                activeTabId: loadedState.activeTabId,
                tabs: loadedState.tabs || []
            }]
        };
    } else {
        const defaultWsId = uid(); const defaultTabId = uid();
        appState = {
            activeWorkspaceId: defaultWsId,
            workspaces: [{
                id: defaultWsId, title: "Project 1", activeTabId: defaultTabId,
                tabs: [{ id: defaultTabId, name: "Tab 1", scenarios: [{ id: uid(), name:"", fields: [], evidenceHtml:"", isOpen: true }] }]
            }]
        };

    }
    
    state = appState.workspaces.find(w => w.id === appState.activeWorkspaceId) || appState.workspaces[0];
    workspaceTitleInput.value = state.title || "Project";
    
    renderWorkspaces();
    render(); 
}

const workspaceTitleInput = document.getElementById("workspaceTitleInput");
workspaceTitleInput.addEventListener("input", (e) => {
    if (state) {
        state.title = e.target.value;
        renderWorkspaces();
        saveState();
    }
});

/* ========= Sidebar Project Management (Drag & Drop added) ========= */
let draggedWsId = null;

function renderWorkspaces() {
    const list = document.getElementById("workspaceListItems");
    list.innerHTML = "";
    appState.workspaces.forEach((ws) => {
        const btn = document.createElement("button");
        btn.className = "menu-item ws-item" + (ws.id === appState.activeWorkspaceId ? " active-ws" : "");
        
        btn.innerHTML = `
           <span class="material-symbols-outlined" style="font-size:18px;">workspaces</span> 
           <span class="ws-name">${escapeHtml(ws.title || 'Untitled')}</span>
           ${appState.workspaces.length > 1 ? `<span class="material-symbols-outlined ws-del" data-del-ws="${ws.id}" title="Delete Project">delete</span>` : ''}
        `;
        
        btn.draggable = true;
        btn.ondragstart = (e) => { draggedWsId = ws.id; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => btn.classList.add('dragging'), 0); };
        btn.ondragend = () => { draggedWsId = null; btn.classList.remove('dragging'); };
        btn.ondragover = (e) => { e.preventDefault(); btn.classList.add('drag-over-ws'); };
        btn.ondragleave = () => { btn.classList.remove('drag-over-ws'); };
        btn.ondrop = (e) => {
            e.preventDefault(); btn.classList.remove('drag-over-ws');
            if (draggedWsId && draggedWsId !== ws.id) {
                const fromIdx = appState.workspaces.findIndex(w => w.id === draggedWsId);
                const toIdx = appState.workspaces.findIndex(w => w.id === ws.id);
                if(fromIdx >= 0 && toIdx >= 0) {
                    const moved = appState.workspaces.splice(fromIdx, 1)[0];
                    appState.workspaces.splice(toIdx, 0, moved);
                    renderWorkspaces(); saveState();
                }
            }
        };

        btn.addEventListener("click", (e) => {
            const del = e.target.closest("[data-del-ws]");
            if (del) {
                e.stopPropagation();
                if(confirm(`Are you sure you want to delete the project "${ws.title}"?`)) {
                    appState.workspaces = appState.workspaces.filter(x => x.id !== ws.id);
                    if(appState.activeWorkspaceId === ws.id) {
                        appState.activeWorkspaceId = appState.workspaces[0].id;
                        state = appState.workspaces[0];
                        workspaceTitleInput.value = state.title;
                        render();
                    }
                    renderWorkspaces(); saveState();
                }
                return;
            }
            
            appState.activeWorkspaceId = ws.id;
            state = appState.workspaces.find(w => w.id === ws.id);
            workspaceTitleInput.value = state.title;
            if(window.innerWidth < 1100) {
               sidebarBackdrop.style.opacity = "0";
               setTimeout(() => document.body.classList.remove("sidebar-show"), 300);
            }
            render(); renderWorkspaces(); saveState();
        });
        list.appendChild(btn);
    });
}

document.getElementById("addWorkspaceBtn")?.addEventListener("click", () => {
    const newId = uid(); const newTabId = uid();
    const newWs = {
        id: newId, title: "New Project", activeTabId: newTabId,
        tabs: [{ id: newTabId, name: "Tab 1", scenarios: [{ id: uid(), name:"", fields: [], evidenceHtml:"", isOpen: true }] }]
    };
    appState.workspaces.push(newWs);
    appState.activeWorkspaceId = newId;
    state = newWs;
    workspaceTitleInput.value = state.title;
    
    if(window.innerWidth < 1100) {
       sidebarBackdrop.style.opacity = "0";
       setTimeout(() => document.body.classList.remove("sidebar-show"), 300);
    }
    renderWorkspaces(); render(); saveState();
});

const resetBtn = document.getElementById("resetBtn");
resetBtn?.addEventListener("click", () => {
    if(confirm("Are you sure you want to reset the CURRENT project? This will delete all tabs and items inside it.")) {
        state.tabs = [{ id: uid(), name: "Tab 1", scenarios: [{ id: uid(), name:"", fields: [], evidenceHtml:"", isOpen: true }] }];
        state.activeTabId = state.tabs[0].id;
        render();
    }
});

/* ========= Global Live Search Engine Dropdown ========= */
const searchWrap = document.getElementById("searchWrap");
const searchInput = document.getElementById("searchInput");
const searchDropdown = document.getElementById("searchDropdown");

// Focus handling for expanding the bar
searchInput?.addEventListener("focus", () => {
    if(searchWrap) searchWrap.classList.add("active-search");
    const q = searchInput.value.trim();
    if(q.length >= 3) {
        if(searchDropdown) searchDropdown.style.display = "flex";
        performSearch(q);
    } else {
        if(searchDropdown) searchDropdown.style.display = "none";
    }
});

// Click outside to close dropdown and shrink bar
document.addEventListener("click", (e) => {
    if(searchWrap && !searchWrap.contains(e.target)) {
        searchWrap.classList.remove("active-search");
        if(searchDropdown) searchDropdown.style.display = "none";
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
        return; 
    }
    if(searchDropdown) searchDropdown.style.display = "flex";
    searchTimeout = setTimeout(() => { performSearch(q); }, 200);
});

function performSearch(query) {
    const q = query.toLowerCase();
    let resultsHtml = "";
    let matchCount = 0;

    appState.workspaces.forEach(ws => {
        ws.tabs.forEach(tab => {
            tab.scenarios.forEach((sc, idx) => {
                let hasMatch = false;
                let snippets = [];

                if ((sc.name || "").toLowerCase().includes(q)) {
                    hasMatch = true; snippets.push(`<b>Title:</b> ${highlightText(sc.name, query)}`);
                }
                
                (sc.fields || []).forEach(f => {
                    if (f.key.toLowerCase().includes(q) || f.val.toLowerCase().includes(q)) {
                        hasMatch = true; snippets.push(`<b>Field:</b> ${highlightText(f.key, query)} = ${highlightText(f.val, query)}`);
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
                    resultsHtml += `
                        <div class="search-result" data-ws="${ws.id}" data-tab="${tab.id}" data-sc="${sc.id}">
                            <div class="res-title">
                               <span class="res-tab">${escapeHtml(ws.title)} > ${escapeHtml(tab.name)}</span>
                               ${escapeHtml(sc.name || `Item ${idx+1}`)}
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
        
        renderWorkspaces();
        render();
        if(searchWrap) searchWrap.classList.remove("active-search");
        if(searchDropdown) searchDropdown.style.display = "none";
        if(searchInput) searchInput.value = ""; // Clear after selection
        
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
const tabsEl = document.getElementById("tabs");
const panelEl = document.getElementById("panel");

function activeTab(){ return state.tabs.find(t => t.id === state.activeTabId); }

function render(){ renderTabs(); renderPanel(); saveState(); }

let draggedTabIdx = null;
function renderTabs(){
  tabsEl.innerHTML = "";
  state.tabs.forEach((tab, index) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (tab.id === state.activeTabId ? " active" : "");
    btn.type = "button";
    btn.innerHTML = `<span>${escapeHtml(tab.name)}</span>${state.tabs.length > 1 ? `<span class="x" title="Close tab" data-close-tab="${tab.id}">×</span>` : ``}`;
    
    btn.draggable = true;
    btn.ondragstart = (e) => { draggedTabIdx = index; e.dataTransfer.effectAllowed = 'move'; setTimeout(()=>btn.classList.add('dragging'), 0); };
    btn.ondragend = () => { draggedTabIdx = null; btn.classList.remove('dragging'); };
    btn.ondragover = (e) => { e.preventDefault(); btn.classList.add('drag-over'); };
    btn.ondragleave = () => { btn.classList.remove('drag-over'); };
    btn.ondrop = (e) => {
        e.preventDefault(); btn.classList.remove('drag-over');
        if (draggedTabIdx !== null && draggedTabIdx !== index) {
            const moved = state.tabs.splice(draggedTabIdx, 1)[0];
            state.tabs.splice(index, 0, moved);
            render();
        }
    };

    btn.addEventListener("click", (e) => {
      const close = e.target.closest("[data-close-tab]");
      if (close){ e.stopPropagation(); closeTab(close.getAttribute("data-close-tab")); return; }
      state.activeTabId = tab.id; render();
    });
    tabsEl.appendChild(btn);
  });
  const plus = document.createElement("button");
  plus.className = "tab plus"; plus.type = "button"; plus.textContent = "＋ New tab";
  plus.addEventListener("click", () => promptNewTab());
  tabsEl.appendChild(plus);
}

function renderPanel(){
  if(!tabsEl) return;
  if(!panelEl) return;
  panelEl.innerHTML = "";
  state.tabs.forEach(tab => {
    const wrap = document.createElement("div");
    wrap.className = "tab-panel";
    if (tab.id === state.activeTabId) wrap.style.display = "block";
    tab.scenarios.forEach((sc, idx) => { wrap.appendChild(renderScenarioCard(sc, idx)); });
    panelEl.appendChild(wrap);
  });
  const active = activeTab();
  const pMeta = document.getElementById("panelMeta");
  if (active && pMeta) pMeta.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">lightbulb</span> Active: ${active.name} • Items: ${active.scenarios.length} • Shortcut: Ctrl+Shift+F to search all projects.`;
}

function renderScenarioCard(sc, idx){
  const d = document.createElement("details");
  d.className = "scenario"; d.dataset.sid = sc.id; d.open = sc.isOpen !== false; 
  d.draggable = false; 
  
  d.ondragstart = (e) => { e.dataTransfer.setData('text/plain', idx); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => d.classList.add('dragging'), 0); };
  d.ondragend = () => { d.classList.remove('dragging'); d.draggable = false; };
  d.ondragover = (e) => { e.preventDefault(); d.classList.add('drag-over-scenario'); };
  d.ondragleave = () => { d.classList.remove('drag-over-scenario'); };
  d.ondrop = (e) => {
      e.preventDefault(); d.classList.remove('drag-over-scenario');
      d.draggable = false;
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(fromIdx) && fromIdx !== idx) {
          const tab = activeTab();
          const moved = tab.scenarios.splice(fromIdx, 1)[0];
          tab.scenarios.splice(idx, 0, moved);
          render();
      }
  };

  const validFields = (sc.fields || []).filter(f => f.key.trim() || f.val.trim());
  const tagsHtml = validFields.map(f => `<span class="tag"><b>${escapeHtml(f.key || "Field")}:</b> ${escapeHtml(f.val || "-")}</span>`).join("");

  const fieldsHtml = (sc.fields || []).map(f => `
    <div class="field-row">
      <input class="input" data-fkey="${f.id}" data-sid="${sc.id}" value="${escapeAttr(f.key)}" placeholder="Field Name (e.g., Env, Policy)" />
      <input class="input" data-fval="${f.id}" data-sid="${sc.id}" value="${escapeAttr(f.val)}" placeholder="Value" />
      <button class="btn secondary del action-btn icon-only" type="button" data-delfield="${f.id}" data-sid="${sc.id}"><span class="material-symbols-outlined">close</span></button>
    </div>
  `).join("");

  d.innerHTML = `
    <summary>
      <div class="summary-content">
        <div style="display:flex; align-items:center; gap:6px; width: 100%;">
          <div style="font-weight: 750; font-size: 14px; color: var(--text); white-space:nowrap;">
            <span class="material-symbols-outlined" style="font-size: 16px; cursor: grab; color: var(--muted); margin-right: 4px;" onmousedown="this.closest('details').draggable=true" onmouseup="this.closest('details').draggable=false" onmouseleave="this.closest('details').draggable=false">drag_indicator</span>
            Item ${idx+1}
          </div>
          <span style="color: var(--muted); font-weight: 400;">—</span>
          <input class="header-name-input" data-field="name" data-sid="${sc.id}" value="${escapeAttr(sc.name||"")}" placeholder="Item Name..." onclick="event.stopPropagation()" />
        </div>
        ${tagsHtml ? `<div class="summary-tags">${tagsHtml}</div>` : `<div class="summary-sub">Click to expand/collapse</div>`}
      </div>
      <div class="summary-actions">
        <button class="btn secondary action-btn icon-only" type="button" title="Save as Template" data-template="${sc.id}"><span class="material-symbols-outlined">bookmark_add</span></button>
        <button class="btn secondary action-btn icon-only" type="button" title="Duplicate Item" data-duplicate="${sc.id}"><span class="material-symbols-outlined">content_copy</span></button>
        <button class="btn secondary action-btn icon-only" type="button" title="Move Item" data-move="${sc.id}"><span class="material-symbols-outlined">move_item</span></button>
        <button class="btn danger action-btn icon-only" type="button" title="Delete Item" data-delete="${sc.id}"><span class="material-symbols-outlined">delete</span></button>
        <div class="chev"><span class="material-symbols-outlined">expand_more</span></div>
      </div>
    </summary>

    <div class="card-body">
      <div class="label"><span class="material-symbols-outlined" style="font-size: 14px;">tune</span> Properties</div>
      <div class="field-list">
        ${fieldsHtml}
        <div><button class="btn secondary action-btn" type="button" data-addfield="${sc.id}" style="font-size: 12px; padding: 6px 12px;"><span class="material-symbols-outlined">add</span> Add Field</button></div>
      </div>

      <div class="evidence-wrap">
        <div class="label" style="margin-bottom: 6px;"><span class="material-symbols-outlined" style="font-size: 14px;">image</span> Notes & Media</div>
        <div class="wysiwyg-toolbar action-btn">
           <button class="btn secondary" type="button" data-cmd="bold" title="Bold"><span class="material-symbols-outlined" style="margin:0;">format_bold</span></button>
           <button class="btn secondary" type="button" data-cmd="italic" title="Italic"><span class="material-symbols-outlined" style="margin:0;">format_italic</span></button>
           <button class="btn secondary" type="button" data-cmd="insertUnorderedList" title="Bullet List"><span class="material-symbols-outlined" style="margin:0;">format_list_bulleted</span> List</button>
			<button class="btn secondary" type="button" data-cmd="createLink" title="Insert Link"><span class="material-symbols-outlined" style="margin:0;">link</span></button>
           
           <div style="width: 1px; height: 20px; background: var(--outline-2); margin: 0 4px;"></div>
           
           <button class="btn secondary action-btn" type="button" data-createfile="${sc.id}" title="Create Text/XML File"><span class="material-symbols-outlined" style="font-size: 16px;">note_add</span> New File</button>
           <button class="btn secondary action-btn" type="button" data-attach="${sc.id}"><span class="material-symbols-outlined" style="font-size: 16px;">attach_file</span> Attach</button>
        </div>
        <div class="evidence" contenteditable="true" data-evidence="${sc.id}" spellcheck="false"></div>
        <div class="hint"><span class="material-symbols-outlined" style="font-size: 14px;">info</span> Paste screenshots (Ctrl+V) or use the toolbar to format. Double-click images to view full size.</div>
        <input type="file" hidden data-file="${sc.id}" />
      </div>
    </div>
  `;

  const evidence = d.querySelector(`[data-evidence="${sc.id}"]`);
  evidence.innerHTML = sc.evidenceHtml || "";

  let htmlUpdated = false;
  evidence.querySelectorAll('.attachment').forEach(att => {
    if(!att.querySelector('.copy-att')) {
      const link = att.querySelector('a');
      if(link && link.dataset.dataurl) {
        const copyBtn = document.createElement("span");
        copyBtn.className = "copy-att material-symbols-outlined"; copyBtn.textContent = "content_copy"; 
        copyBtn.title = "Copy content"; copyBtn.dataset.copy = link.dataset.dataurl;
        copyBtn.contentEditable = "false";
        att.appendChild(copyBtn);
        htmlUpdated = true;
      }
    }
  });
  if (htmlUpdated) { sc.evidenceHtml = evidence.innerHTML; saveState(); }

  return d;
}

/* ========= Interactions ========= */

// Prevent item cards from expanding/collapsing when interacting with field tags
document.addEventListener("click", (e) => {
  const summary = e.target.closest("summary");
  if (summary) {
    // If clicking directly on a tag, OR if text is currently highlighted (drag-select)
    if (e.target.closest(".tag") || window.getSelection().toString().trim().length > 0) {
      e.preventDefault(); // Stops the <details> element from toggling
    }
  }
});

/* ========= Expand / Collapse All ========= */
document.getElementById("expandAllBtn").addEventListener("click", () => {
  const tab = activeTab();
  if (tab && tab.scenarios) {
    tab.scenarios.forEach(sc => sc.isOpen = true);
    render();
  }
});

document.getElementById("expandAllBtn")?.addEventListener("click", () => {
document.getElementById("collapseAllBtn")?.addEventListener("click", () => {
  const tab = activeTab();
  if (tab && tab.scenarios) {
    tab.scenarios.forEach(sc => sc.isOpen = false);
    render();
  }
});

document.addEventListener("mousedown", (e) => { if (e.target.closest('[data-cmd]')) { e.preventDefault(); } });

function updateToolbarState() {
  document.querySelectorAll('.wysiwyg-toolbar .btn').forEach(b => b.classList.remove('active-format'));
  const sel = window.getSelection(); if (!sel.rangeCount) return; let node = sel.anchorNode; if (!node) return; if (node.nodeType === 3) node = node.parentElement;
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
  if (sel.rangeCount > 0) {
    let node = sel.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    if (node && node.closest && node.closest('.evidence')) { savedRange = sel.getRangeAt(0); }
  }
});

function restoreSelectionAndInsert(ev, html) {
  ev.focus();
  if (savedRange && savedRange.commonAncestorContainer) {
    let node = savedRange.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    if (node && node.closest && node.closest('.evidence') === ev) {
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
      const label = name ? `Item ${idx+1} — ${name}` : `Item ${idx+1}`;
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
    renderWorkspaces();
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

document.getElementById("addScenarioBtn")?.addEventListener("click", () => {
  const tab = activeTab(); const newId = uid();
  tab.scenarios.push({ id: newId, name:"", fields: [], evidenceHtml:"", isOpen: true });
  render();
  setTimeout(() => { const inp = document.querySelector(`input[data-sid="${newId}"][data-field="name"]`); if (inp) inp.focus(); }, 50);
});

document.getElementById("renameTabBtn")?.addEventListener("click", () => {
  const tab = activeTab();
  promptDialog("Rename tab", tab.name, "Give this tab a short name.", (val) => { tab.name = (val || "Untitled").trim(); render(); });
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

document.addEventListener("input", (e) => {
  const nameInp = e.target.closest("input[data-field='name']");
  if (nameInp) { const sc = findScenario(nameInp.dataset.sid); if (sc) { sc.name = nameInp.value; saveState(); } return; }
  const keyInp = e.target.closest("input[data-fkey]");
  if (keyInp) { const sc = findScenario(keyInp.dataset.sid); const field = sc.fields.find(f => f.id === keyInp.dataset.fkey); if (field) { field.key = keyInp.value; saveState(); renderPanelOnly(); } return; }
  const valInp = e.target.closest("input[data-fval]");
  if (valInp) { const sc = findScenario(valInp.dataset.sid); const field = sc.fields.find(f => f.id === valInp.dataset.fval); if (field) { field.val = valInp.value; saveState(); renderPanelOnly(); } return; }
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

  if (document.getElementById("dlgBackdrop").style.display === "flex" || 
      document.getElementById("themeBackdrop").style.display === "flex" ||
      document.getElementById("docsBackdrop").style.display === "flex" ||
      document.getElementById("cfBackdrop").style.display === "flex" ||
      document.getElementById("exportBackdrop").style.display === "flex" ||
      document.getElementById("importBackdrop").style.display === "flex" ||
      document.getElementById("compareBackdrop").style.display === "flex" ||
      document.getElementById("filePreviewBackdrop").style.display === "flex" ||
      document.getElementById("imgPreviewBackdrop").style.display === "flex" ||
      document.getElementById("tplBackdrop").style.display === "flex" ||
      document.getElementById("moveBackdrop").style.display === "flex") {
      
      if (e.key === "Escape") {
         document.getElementById("dlgCancel").click();
         document.getElementById("themeClose").click();
         const docsClose = document.getElementById("docsCloseBtn");
         if(docsClose) docsClose.click();
         document.getElementById("cfCancel").click();
         document.getElementById("exportCancelBtn").click();
         document.getElementById("importCancelBtn").click();
         document.getElementById("compCloseBtn").click();
         document.getElementById("fpCloseBtn").click();
         document.getElementById("tplCloseBtn").click();
         document.getElementById("moveCancelBtn").click();
         document.getElementById("imgPreviewBackdrop").style.display = "none";
      }
      return; 
  }

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

  // New Global Search Shortcut
  if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      document.getElementById("searchInput")?.focus();
  }
  else if (cmdOrCtrl && e.key.toLowerCase() === 's') { e.preventDefault(); document.getElementById("exportHtmlBtn")?.click(); }
  else if (cmdOrCtrl && e.key.toLowerCase() === 'o') { e.preventDefault(); document.getElementById("importBtn")?.click(); }
  else if (e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'n') { e.preventDefault(); document.getElementById("addScenarioBtn")?.click(); }
    if (key === 'r') { e.preventDefault(); document.getElementById("renameTabBtn")?.click(); }
    if (key === 't') { e.preventDefault(); promptNewTab(); }
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
function renderPanelOnly(){
  const tab = activeTab(); if (!tab) return;
  const panels = [...document.querySelectorAll(".tab-panel")];
  panels.forEach(panel => {
    const cards = [...panel.querySelectorAll("details.scenario")];
    cards.forEach((card, idx) => {
      const sid = card.dataset.sid; const sc = findScenario(sid); if(!sc) return;
      const tagsContainer = card.querySelector(".summary-tags") || card.querySelector(".summary-sub");
      const validFields = sc.fields.filter(f => f.key.trim() || f.val.trim());
      if(validFields.length > 0) {
        const tagsHtml = validFields.map(f => `<span class="tag"><b>${escapeHtml(f.key || "Field")}:</b> ${escapeHtml(f.val || "-")}</span>`).join("");
        if(tagsContainer.className === "summary-sub") { tagsContainer.outerHTML = `<div class="summary-tags">${tagsHtml}</div>`; } else { tagsContainer.innerHTML = tagsHtml; }
      } else { if(tagsContainer.className === "summary-tags") { tagsContainer.outerHTML = `<div class="summary-sub">Click to expand/collapse</div>`; } }
    });
  });
}

function findScenario(sid){ for (const ws of appState.workspaces) { for (const t of ws.tabs){ const sc = t.scenarios.find(s => s.id === sid); if (sc) return sc; } } return null; }
function deleteScenario(sid){ const tab = activeTab(); if(confirm("Are you sure you want to delete this item?")) { tab.scenarios = tab.scenarios.filter(s => s.id !== sid); render(); } }
function moveCursorToEnd(el) { el.focus(); const range = document.createRange(); range.selectNodeContents(el); range.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }

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

/* ========= Tabs CRUD ========= */
function promptNewTab(){
  promptDialog("New tab", `Tab ${state.tabs.length+1}`, "Enter a name for the new tab.", (val) => {
    const name = (val || "Untitled").trim(); const id = uid(); const newScenId = uid();
    state.tabs.push({ id, name, scenarios: [{ id: newScenId, name:"", fields: [], evidenceHtml:"", isOpen: true }] }); state.activeTabId = id; render();
    setTimeout(() => { const inp = document.querySelector(`input[data-sid="${newScenId}"][data-field="name"]`); if (inp) inp.focus(); }, 50);
  });
}

function closeTab(id){
  const idx = state.tabs.findIndex(t => t.id === id); if (idx < 0) return;
  if(confirm("Are you sure you want to delete this tab and all its items?")) {
    state.tabs.splice(idx, 1);
    if (state.activeTabId === id){ state.activeTabId = state.tabs[Math.max(0, idx-1)]?.id || null; if (!state.activeTabId) { state.tabs.push({ id: uid(), name: "Tab 1", scenarios: [] }); state.activeTabId = state.tabs[0].id; } }
    render();
  }
}

/* ========= Export HTML ========= */
function exportHTML(exportData, filename){
  const styles = document.querySelector('style').innerHTML;
  const payloadStr = JSON.stringify(exportData).replace(/</g, '\\u003c');

  const exportTemplate = `<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}" data-color="${currentColor}">
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
      tabsEl.innerHTML = state.tabs.map(tab => \`<button class="tab \${tab.id === activeTabId ? 'active' : ''}" data-tab="\${tab.id}">\${escapeHtml(tab.name)}</button>\`).join("");
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
                  <div style="font-weight: 750; font-size: 14px; color: var(--text); white-space:nowrap;">Item \${idx+1}</div>
                  <span style="color: var(--muted); font-weight: 400;">—</span>
                  <input class="header-name-input" value="\${escapeAttr(sc.name||"")}" placeholder="Untitled Item" readonly />
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

/* ========= Utils ========= */
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({"&":"&","<":"<",">":">",'"':"&quot;","'":"&#39;"}[s])); }
function escapeAttr(str){ return escapeHtml(str).replace(/"/g, "&quot;"); }

/* Initial render */
bootApp();
