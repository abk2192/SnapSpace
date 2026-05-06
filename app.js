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
let savedRange = null; 

let appState = null; 
let state = null; // Pointer to the active project

async function bootApp() {
  
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
