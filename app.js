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
import { SearchVM } from './src/viewmodels/SearchVM.js';
import { SearchView } from './src/views/SearchView.js';
import { CompareVM } from './src/viewmodels/CompareVM.js';
import { CompareView } from './src/views/CompareView.js';
import { TemplatesVM } from './src/viewmodels/TemplatesVM.js';
import { TemplatesView } from './src/views/TemplatesView.js';
import { MoveItemVM } from './src/viewmodels/MoveItemVM.js';
import { MoveItemView } from './src/views/MoveItemView.js';
import { TransferVM } from './src/viewmodels/TransferVM.js';
import { TransferView } from './src/views/TransferView.js';
import { EditorVM } from './src/viewmodels/EditorVM.js';
import { EditorView } from './src/views/EditorView.js';

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

let appState = null; 
let state = null; // Pointer to the active project

async function bootApp() {
  
    document.getElementById("renameTabBtn")?.remove();

    // Wrap title and input into a single unified Appbar component
    const titleEl = document.querySelector('.title');
    const wsInput = document.getElementById("workspaceTitleInput");
    if (titleEl && wsInput && titleEl.parentNode === wsInput.parentNode && !titleEl.closest('.title-group')) {
        const group = document.createElement('div');
        group.className = 'title-group';
        titleEl.parentNode.insertBefore(group, titleEl);
        group.appendChild(titleEl);
        group.appendChild(wsInput);
    }

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
    
    // Initialize Search Subsystem
    const searchVM = new SearchVM();
    new SearchView(searchVM);
    
    // Initialize Compare Mode Subsystem
    const compareVM = new CompareVM();
    new CompareView(compareVM);
    
    // Initialize Templates Subsystem
    const templatesVM = new TemplatesVM();
    new TemplatesView(templatesVM);
    
    // Initialize Move Item Subsystem
    const moveItemVM = new MoveItemVM();
    new MoveItemView(moveItemVM);
    
    // Initialize Transfer Subsystem (Import, Export, Backup, Restore)
    const transferVM = new TransferVM();
    new TransferView(transferVM);
    
    // Initialize Editor Subsystem (WYSIWYG, Paste, File Handling)
    const editorVM = new EditorVM();
    new EditorView(editorVM);
    
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
        const now = Date.now();
        state.tabs = [{ id: uid(), name: "Tab 1", scenarios: [{ id: uid(), name:"Item 1", fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now }] }];
        state.activeTabId = state.tabs[0].id;
        render();
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

  // Handle Edit Name Pencil/Action
  const editNameBtn = e.target.closest(".edit-name-btn, [data-edit-name]");
  if (editNameBtn) {
      e.preventDefault(); e.stopPropagation();
      const scId = editNameBtn.dataset.editName || editNameBtn.closest('.scenario')?.dataset.sid;
      if (scId) {
          const input = document.querySelector(`input[data-sid="${scId}"][data-field="name"]`);
          if (input) {
              const card = input.closest('details');
              if (card && !card.open) card.open = true; // ensure card is open
              input.classList.add("editing");
              setTimeout(() => {
                  input.focus();
                  input.setSelectionRange(input.value.length, input.value.length);
              }, 50);
          }
      }
  } else if (!e.target.closest('.header-name-input')) {
      // Remove editing state if clicked anywhere outside the input
      document.querySelectorAll('.header-name-input.editing').forEach(el => el.classList.remove('editing'));
  }
});


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

// Create File Dialog
const cfBackdrop = document.getElementById('cfBackdrop');
const cfName = document.getElementById('cfName');
const cfContent = document.getElementById('cfContent');
const cfCancel = document.getElementById('cfCancel');

if(cfBackdrop) cfBackdrop.addEventListener('click', (e) => { if (e.target === cfBackdrop) cfCancel?.click(); });

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
      e.target.classList.remove('editing');
      if (!e.target.value.trim()) {
          e.target.value = e.target.placeholder;
          e.target.dispatchEvent(new Event("input", {bubbles: true}));
      }
  }
});

document.addEventListener("input", (e) => {
  const nameInp = e.target.closest("input[data-field='name']");
  if (nameInp) { const sc = findScenario(nameInp.dataset.sid); if (sc) { sc.name = nameInp.value; sc.modifiedAt = Date.now(); } return; }
  const keyInp = e.target.closest("input[data-fkey]");
  if (keyInp) { const sc = findScenario(keyInp.dataset.sid); const field = sc.fields.find(f => f.id === keyInp.dataset.fkey); if (field) { field.key = keyInp.value; sc.modifiedAt = Date.now(); globalEvents.publish('tags:updated'); } return; }
  const valInp = e.target.closest("input[data-fval]");
  if (valInp) { const sc = findScenario(valInp.dataset.sid); const field = sc.fields.find(f => f.id === valInp.dataset.fval); if (field) { field.val = valInp.value; sc.modifiedAt = Date.now(); globalEvents.publish('tags:updated'); } return; }
});

document.addEventListener("input", (e) => {
  const ev = e.target.closest(".evidence[data-evidence]");
  if (!ev) return;
  const sc = findScenario(ev.getAttribute("data-evidence"));
  if (!sc) return;
  sc.evidenceHtml = ev.innerHTML; sc.modifiedAt = Date.now(); saveState();
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
      }
      return; 
  }

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

  if (cmdOrCtrl && e.key.toLowerCase() === 's') { e.preventDefault(); document.getElementById("exportHtmlBtn")?.click(); }
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
      if (sc) {
         sc.fields.push({ id: uid(), key:"", val:"" }); render();
         setTimeout(() => { const inputs = document.querySelectorAll(`input[data-sid="${sc.id}"][data-fkey]`); if(inputs.length > 0) inputs[inputs.length - 1].focus(); }, 50);
      }
    }
  }
});

/* ========= Helpers ========= */

function findScenario(sid){ for (const ws of appState.workspaces) { for (const t of ws.tabs){ const sc = t.scenarios.find(s => s.id === sid); if (sc) return sc; } } return null; }


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
