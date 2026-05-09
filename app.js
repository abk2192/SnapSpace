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
import { dialogService } from './src/services/DialogService.js';

/* ========= PWA Service Worker Registration ========= */
registerServiceWorker();

/* ========= Theme Engine ========= */
themeService.applyTheme();
document.querySelectorAll('[data-set-theme]').forEach(el => { el.addEventListener('click', (e) => { themeService.setTheme(e.target.dataset.setTheme); }); });
document.querySelectorAll('[data-set-color]').forEach(el => { el.addEventListener('click', (e) => { themeService.setColor(e.target.dataset.setColor); }); });

/* ========= Viewport / Keyboard Offset Engine ========= */
if (window.visualViewport) {
    const vv = window.visualViewport;
    const updateKeyboardOffset = () => {
        const offset = window.innerHeight - vv.height;
        document.documentElement.style.setProperty('--kb-offset', `${Math.max(0, offset)}px`);
    };
    vv.addEventListener('resize', () => {
        updateKeyboardOffset();
        if (document.activeElement && document.activeElement.tagName !== 'BODY') {
            setTimeout(() => document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        }
    });
    vv.addEventListener('scroll', updateKeyboardOffset);
    updateKeyboardOffset();
}

/* ========= Global Reactivity Subscribers ========= */
globalEvents.subscribe('store:saved', () => {
    const ind = document.getElementById("saveIndicator");
    if(ind) {
        ind.style.opacity = "1";
        clearTimeout(ind.timer);
        ind.timer = setTimeout(() => ind.style.opacity = "0", 2000);
    }
});

window.appAlert = (msg, title="Alert") => {
    return new Promise(resolve => {
        const dlg = document.getElementById("appSysDialog");
        document.getElementById("appSysTitle").textContent = title;
        document.getElementById("appSysMsg").textContent = msg;
        document.getElementById("appSysCancel").style.display = "none";
        document.getElementById("appSysOk").textContent = "OK";
        document.getElementById("appSysOk").onclick = () => { dlg.style.display = "none"; resolve(); };
        dlg.style.display = "flex";
    });
};

window.appConfirm = (msg, title="Confirm") => {
    return new Promise(resolve => {
        const dlg = document.getElementById("appSysDialog");
        document.getElementById("appSysTitle").textContent = title;
        document.getElementById("appSysMsg").textContent = msg;
        document.getElementById("appSysCancel").style.display = "block";
        document.getElementById("appSysOk").textContent = "Yes";
        document.getElementById("appSysCancel").onclick = () => { dlg.style.display = "none"; resolve(false); };
        document.getElementById("appSysOk").onclick = () => { dlg.style.display = "none"; resolve(true); };
        dlg.style.display = "flex";
    });
};

window.appPrompt = (msg, defaultVal="", title="Input Required") => {
    return new Promise(resolve => {
        const dlg = document.getElementById("appSysDialog");
        document.getElementById("appSysTitle").textContent = title;
        document.getElementById("appSysMsg").innerHTML = `<div>${escapeHtml(msg)}</div><input class="input" id="appSysInput" style="margin-top: 12px; width: 100%;" value="${escapeAttr(defaultVal)}" />`;
        document.getElementById("appSysCancel").style.display = "block";
        document.getElementById("appSysOk").textContent = "OK";
        document.getElementById("appSysCancel").onclick = () => { dlg.style.display = "none"; resolve(null); };
        document.getElementById("appSysOk").onclick = () => { dlg.style.display = "none"; resolve(document.getElementById("appSysInput").value); };
        dlg.style.display = "flex";
        setTimeout(() => document.getElementById("appSysInput").focus(), 50);
    });
};

window.appDualPrompt = () => {
    return new Promise(resolve => {
        const dlg = document.getElementById("addFieldBackdrop");
        const kInp = document.getElementById("afKeyInput");
        const vInp = document.getElementById("afValInput");
        kInp.value = ""; vInp.value = "";
        
        const cancel = () => { dlg.style.display = "none"; resolve(null); cleanup(); };
        const save = () => { dlg.style.display = "none"; resolve({ key: kInp.value, val: vInp.value }); cleanup(); };
        
        const onKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.target === kInp) vInp.focus(); else if (e.target === vInp) save();
            }
        };
        document.getElementById("afCancelBtn").onclick = cancel;
        document.getElementById("afSaveBtn").onclick = save;
        kInp.addEventListener('keydown', onKey); vInp.addEventListener('keydown', onKey);
        const cleanup = () => { kInp.removeEventListener('keydown', onKey); vInp.removeEventListener('keydown', onKey); };
        dlg.style.display = "flex"; setTimeout(() => kInp.focus(), 50);
    });
};

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
    
    const tabsbarInner = document.querySelector('.tabsbar-inner');
    if (tabsbarInner && !tabsbarInner.querySelector('.tab-tools')) {
        const tabTools = document.createElement('div');
        tabTools.className = 'tab-tools';
        
        const toggleAllBtn = document.createElement('button');
        toggleAllBtn.className = 'btn secondary icon-only';
        toggleAllBtn.id = 'toggleAllBtn';
        toggleAllBtn.innerHTML = '<span class="material-symbols-outlined">unfold_less</span>';
        toggleAllBtn.title = "Collapse All";
        
        tabTools.appendChild(toggleAllBtn);
        tabsbarInner.appendChild(tabTools);
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
        'addScenarioBtn': 'add',
        'quickNoteBtn': 'add'
    };
    
    document.querySelectorAll('.appbar .actions .btn, .tab-tools .btn').forEach(btn => {
        btn.classList.remove('danger'); // Strip aggressive colors from top bar

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
            <button class="pill-btn pill-add" id="pillAddBtn"><span class="material-symbols-outlined">add</span> <span class="pill-text">Add Note</span></button>
            <button class="pill-btn pill-add" id="pillUnlockBtn" style="display: none;"><span class="material-symbols-outlined">lock</span></button>
            <button class="pill-btn" id="pillMoreBtn" title="More Actions"><span class="material-symbols-outlined">apps</span></button>
        `;
        document.body.appendChild(mobilePill);

        document.getElementById("pillSearchBtn").addEventListener("click", () => {
            document.querySelector('.search-trigger-btn')?.click();
        });
        document.getElementById("pillAddBtn").addEventListener("click", () => {
            document.getElementById("quickNoteBtn")?.click();
        });
        document.getElementById("pillUnlockBtn").addEventListener("click", () => {
            document.getElementById("toggleEditBtn")?.click();
        });
        document.getElementById("pillMoreBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            document.body.classList.toggle("show-mobile-actions");
        });

        // This listener is now responsible for closing the mobile menu when clicking outside
        document.addEventListener('click', e => {
            if (document.body.classList.contains("show-mobile-actions")) {
                const actions = document.querySelector('.appbar .actions');
                const mobileMoreBtn = document.getElementById("pillMoreBtn");
                const clickedActionBtn = e.target.closest('.appbar .actions .btn');
                // Close if click is on an action, or if click is outside the menu AND not on the toggle button
                if (clickedActionBtn || (actions && !actions.contains(e.target) && !mobileMoreBtn.contains(e.target) && e.target !== mobileMoreBtn)) {
                    document.body.classList.remove("show-mobile-actions");
                }
            }
        });
    }

    // Intercept clicks and focus to prevent inline editing and open Quick Note modal instead
    document.addEventListener('click', (e) => {
        const ev = e.target.closest('.scenario .evidence');
        if (ev && !ev.closest('#qnBackdrop')) {
            if (e.target.closest('input[type="checkbox"], a, .copy-att, .editor-checkbox')) return;
            e.preventDefault();
            const sid = ev.dataset.evidence || ev.closest('details.scenario')?.dataset?.id;
            if (sid) window.openQuickNote(sid);
        }
    });

    document.addEventListener('focusin', (e) => {
        if (e.target.classList && e.target.classList.contains('evidence') && !e.target.closest('#qnBackdrop')) {
            e.target.blur();
            const sid = e.target.dataset.evidence || e.target.closest('details.scenario')?.dataset?.id;
            if (sid) window.openQuickNote(sid);
        }
    });

    // Load the reactive proxy state
    await store.init();
    
    dialogService.init();
    
    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

        if (cmdOrCtrl && e.key.toLowerCase() === 's') {
            e.preventDefault(); document.getElementById('exportHtmlBtn')?.click();
        } else if (cmdOrCtrl && e.key.toLowerCase() === 'o') {
            e.preventDefault(); document.getElementById('importBtn')?.click();
        } else if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault(); document.getElementById('quickNoteBtn')?.click();
        } else if (e.altKey && e.key.toLowerCase() === 't') {
            e.preventDefault(); document.querySelector('.tab.plus')?.click();
        } else if (e.altKey && e.key.toLowerCase() === 'r') {
            e.preventDefault(); document.querySelector('.tab.active')?.click();
        } else if (e.altKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            const activeScenario = document.activeElement.closest('details.scenario') || document.querySelector('details.scenario[open]');
            if (activeScenario) {
                activeScenario.querySelector('[data-addfield]')?.click();
            }
        } else if (e.altKey && e.key.toLowerCase() === 'h') {
            e.preventDefault(); document.getElementById('docsBtn')?.click();
        }
    });

    // Initialize Sidebar Subsystem
    const sidebarVM = new SidebarVM();
    const sidebarView = new SidebarView(sidebarVM);
    sidebarView.render();
    
    // Initialize Main Panel Subsystem
    window.mainPanelVM = new MainPanelVM();
    const mainPanelView = new MainPanelView(window.mainPanelVM);
    mainPanelView.render();
    
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
    

    /* ========= Quick Note Subsystem ========= */
    function initQuickNote() {
        const qnBtn = document.getElementById('quickNoteBtn');
        const qnBackdrop = document.getElementById('qnBackdrop');
        const qnTitle = document.getElementById('qnTitle');
        const qnEditor = document.getElementById('qnEditor');
        const qnTags = document.getElementById('qnTags');
        const qnDone = document.getElementById('qnDoneBtn');
        const qnAddField = document.getElementById('qnAddFieldBtn');
        
        let currentFields = [];
        let editingScenarioId = null;
        const renderQnTags = () => { qnTags.innerHTML = currentFields.map(f => `<span class="tag"><b>${escapeHtml(f.key)}:</b> ${escapeHtml(f.val)}</span>`).join(""); };

        window.openQuickNote = (sid = null) => {
            const tab = window.mainPanelVM?.activeTab;
            if(!tab && !sid) { window.appAlert("Please select or create a project/tab first."); return; }
            
            
            let qnToolbar = qnBackdrop.querySelector('.wysiwyg-toolbar');
            if (!qnToolbar) {
                const existingToolbar = document.querySelector('.wysiwyg-toolbar');
                if (existingToolbar) {
                    qnToolbar = existingToolbar.cloneNode(true);
                    qnEditor.parentNode.insertBefore(qnToolbar, qnEditor);
                }
            }
            

            if (sid) {
                editingScenarioId = sid;
                let sc = null;
                for (const t of window.mainPanelVM.tabs) {
                    sc = t.scenarios.find(s => s.id === sid);
                    if (sc) break;
                }
                if (!sc) return;
                qnTitle.value = sc.name || "";
                qnEditor.innerHTML = sc.evidenceHtml || "";
                currentFields = JSON.parse(JSON.stringify(sc.fields || []));
                
                // Open existing note in read-only mode by default
                qnBackdrop.classList.add('qn-read-mode');
                qnEditor.contentEditable = "false";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'edit';
            } else {
                editingScenarioId = null;
                currentFields = []; 
                qnEditor.innerHTML = '';
                const dateStr = new Date().toISOString().split('T')[0];
                qnTitle.value = `Note ${dateStr} ${tab.scenarios.length + 1}`;
                
                // Open new note directly in edit mode
                qnBackdrop.classList.remove('qn-read-mode');
                qnEditor.contentEditable = "true";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'check';
            }
            
            renderQnTags();
            qnBackdrop.style.display = 'flex';
            void qnBackdrop.offsetWidth; // Force reflow
            qnBackdrop.classList.remove('qn-animating');
            
            // Push browser state to handle native back gestures perfectly
            history.pushState({ qnOpen: true }, "");

            if (!sid) {
                setTimeout(() => { qnEditor.focus(); moveCursorToEnd(qnEditor); }, 50);
            }
        };

        qnBtn?.addEventListener('click', (e) => { e.preventDefault(); window.openQuickNote(null); });

        qnEditor.addEventListener('keyup', (e) => {
            // Keep cursor vertically scrolled into view on Enter
            if (e.key === 'Enter') {
                const sel = window.getSelection();
                if (sel && sel.anchorNode) {
                    let el = sel.anchorNode;
                    if (el.nodeType === 3) el = el.parentElement;
                    if (el && typeof el.scrollIntoView === 'function') {
                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            }
        });

        qnAddField?.addEventListener('click', async () => {
            const result = await window.appDualPrompt();
            if (result && result.key) {
                currentFields.push({ id: uid(), key: result.key, val: result.val || "" }); renderQnTags();
            }
        });

        const saveQuickNoteState = () => {
            if (editingScenarioId) {
                window.mainPanelVM.updateScenarioName(editingScenarioId, qnTitle.value.trim() || "Note");
                window.mainPanelVM.updateEvidence(editingScenarioId, qnEditor.innerHTML);
                let targetSc = null;
                for (const t of window.mainPanelVM.tabs) { targetSc = t.scenarios.find(s => s.id === editingScenarioId); if (targetSc) break; }
                if (targetSc) { targetSc.fields = currentFields; targetSc.modifiedAt = Date.now(); globalEvents.publish('scenarios:changed'); }
            } else {
                const isEmptyContent = !qnEditor.textContent.trim() && !qnEditor.querySelector('img') && !qnEditor.querySelector('input[type="checkbox"]');
                const isDefaultTitle = qnTitle.value.startsWith('Note ');
                if (isDefaultTitle && isEmptyContent && currentFields.length === 0) return false;
                
                const newId = window.mainPanelVM?.addScenario();
                if (newId) {
                    window.mainPanelVM.updateScenarioName(newId, qnTitle.value.trim() || "Note");
                    window.mainPanelVM.updateEvidence(newId, qnEditor.innerHTML);
                    const sc = window.mainPanelVM.tabs.flatMap(t => t.scenarios).find(s => s.id === newId);
                    if (sc) { sc.fields = currentFields; globalEvents.publish('scenarios:changed'); }
                    editingScenarioId = newId; 
                }
            }
            return true;
        };
        
        let isClosingQn = false;
        const closeAndSaveQuickNote = (fromPopState = false) => {
            if (isClosingQn || qnBackdrop.style.display === 'none') return;
            isClosingQn = true;
            if (!fromPopState) history.back();
            qnBackdrop.classList.add('qn-animating');
            setTimeout(() => { qnBackdrop.style.display = 'none'; saveQuickNoteState(); isClosingQn = false; }, 300);
        };

        // Global History hook: Triggered natively if user presses the "Back" button or swipes
        window.addEventListener('popstate', () => {
            if (qnBackdrop.style.display === 'flex' && !isClosingQn) {
                closeAndSaveQuickNote(true);
            }
        });

        qnDone?.addEventListener('click', () => {
            if (qnBackdrop.classList.contains('qn-read-mode')) {
                qnBackdrop.classList.remove('qn-read-mode');
                qnEditor.contentEditable = "true";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'check';
                setTimeout(() => { qnEditor.focus(); moveCursorToEnd(qnEditor); }, 50);
            } else {
                qnBackdrop.classList.add('qn-read-mode');
                qnEditor.contentEditable = "false";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'edit';
                saveQuickNoteState();
            }
        });
        document.getElementById('qnCloseBtn')?.addEventListener('click', () => closeAndSaveQuickNote(false));
    }
    initQuickNote();
}

/* Initial render */
bootApp();
