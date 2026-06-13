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
        if (offset > 100) {
            document.body.classList.add('keyboard-up');
        } else {
            document.body.classList.remove('keyboard-up');
        }
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
    if (msg.toLowerCase().includes("cancel") || title.toLowerCase().includes("cancel") || msg.toLowerCase().includes("search")) {
        return Promise.resolve(true); // Automatically bypass confirmations for search cancellations
    }
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
    // Setup history for double-back exit and view state navigation
    history.replaceState({ page: 'root' }, "");
    history.pushState({ page: 'app' }, "");
    let lastBackPress = 0;

    window.addEventListener('popstate', (e) => {
        const qnBackdrop = document.getElementById('qnBackdrop');
        if (qnBackdrop && qnBackdrop.style.display === 'flex') { history.pushState({ page: 'app' }, ""); return; }
        
        const lnBackdrop = document.getElementById('linkNotesBackdrop');
        if (lnBackdrop && lnBackdrop.style.display === 'flex') { history.pushState({ page: 'app' }, ""); return; }

        const cfBackdrop = document.getElementById('cfBackdrop');
        const filePreviewBackdrop = document.getElementById('filePreviewBackdrop');
        if ((cfBackdrop && cfBackdrop.style.display === 'flex') || (filePreviewBackdrop && filePreviewBackdrop.style.display === 'flex')) {
            if (cfBackdrop) cfBackdrop.style.display = 'none';
            if (filePreviewBackdrop) filePreviewBackdrop.style.display = 'none';
            history.pushState({ page: 'app' }, "");
            return;
        }

        if (window.mainPanelVM && window.mainPanelVM.viewMode === 'maximized') {
            window.mainPanelVM.setActiveTab(window.mainPanelVM.activeWorkspace?.activeTabId, 'dashboard');
            history.pushState({ page: 'app' }, "");
        } else {
            const now = Date.now();
            if (now - lastBackPress < 2000) { history.back(); } 
            else {
                lastBackPress = now;
                window.appAlert("Press back again to exit.", "Exit");
                history.pushState({ page: 'app' }, "");
            }
        }
    });

    document.getElementById("renameTabBtn")?.remove();

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
            <button class="pill-btn" id="pillMoreBtn" title="More Actions"><span class="material-symbols-outlined">apps</span></button>
        `;
        document.body.appendChild(mobilePill);

        document.getElementById("pillSearchBtn").addEventListener("click", () => {
            document.querySelector('.search-trigger-btn')?.click();
        });
        document.getElementById("pillAddBtn").addEventListener("click", () => {
            document.getElementById("quickNoteBtn")?.click();
        });
        document.getElementById("pillMoreBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            const actionsMenu = document.querySelector(".appbar .actions");
            if (actionsMenu && window.innerWidth <= 768) {
                actionsMenu.classList.toggle("active");
            } else {
                document.getElementById("mainMenuBtn")?.click();
            }
        });
        document.addEventListener("click", (e) => {
            const actionsMenu = document.querySelector(".appbar .actions");
            if (actionsMenu && actionsMenu.classList.contains("active") && !e.target.closest(".appbar .actions") && !e.target.closest("#pillMoreBtn")) {
                actionsMenu.classList.remove("active");
            }
        });
        document.querySelector(".appbar .actions")?.addEventListener("click", (e) => {
            if (e.target.closest(".btn")) {
                e.currentTarget.classList.remove("active");
            }
        });
    }

    // Load the reactive proxy state
    await store.init();
    
    // Execute Phase 1 DB Migration in background 
    // (This runs parallel to your legacy state, ensuring the UI remains unbroken while we build the new DB backend)
    await dbService.migrateToFlatData().catch(err => console.error("[DB Migration] Error:", err));

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
        const renderQnTags = () => { 
            qnTags.innerHTML = currentFields.map(f => `<span class="tag qn-del-tag" data-id="${f.id}" style="cursor:pointer;" title="Click to remove"><b>${escapeHtml(f.key)}:</b> ${escapeHtml(f.val)} <span class="material-symbols-outlined" style="font-size:14px; margin-left:4px;">close</span></span>`).join(""); 
        };
        qnTags?.addEventListener('click', (e) => {
            const tag = e.target.closest('.qn-del-tag');
            if (tag && !qnBackdrop.classList.contains('qn-read-mode')) {
                currentFields = currentFields.filter(f => f.id !== tag.dataset.id);
                renderQnTags();
            }
        });

        window.openQuickNote = (sid = null) => {
            const tab = window.mainPanelVM?.activeTab || window.mainPanelVM?.tabs[0];
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
                
                // Open existing note in edit mode
                qnBackdrop.classList.remove('qn-read-mode');
                qnEditor.contentEditable = "true";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'check';
                if (qnAddField) qnAddField.style.display = 'grid';
            } else {
                editingScenarioId = null;
                currentFields = []; 
                qnEditor.innerHTML = '';
                const dateStr = window.mainPanelVM?.dashboardDateFilter || new Date().toISOString().split('T')[0];
                qnTitle.value = `Note ${dateStr} ${tab.scenarios.length + 1}`;
                
                // Open new note directly in edit mode
                qnBackdrop.classList.remove('qn-read-mode');
                qnEditor.contentEditable = "true";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'check';
                if (qnAddField) qnAddField.style.display = 'grid';
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

        qnBtn?.addEventListener('click', (e) => { 
            e.preventDefault(); 
            if (window.mainPanelVM) {
                const newId = window.mainPanelVM.addScenario();
                if (newId) {
                    setTimeout(() => {
                        const targetCard = document.querySelector(`details.scenario[data-sid="${newId}"]`);
                        if (targetCard) {
                            targetCard.open = true;
                            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetCard.style.transition = 'box-shadow 0.3s ease';
                            targetCard.style.boxShadow = '0 0 0 2px var(--primary), var(--shadow)';
                            setTimeout(() => { targetCard.style.transition = 'all 0.2s ease'; targetCard.style.boxShadow = ''; }, 2000);
                        }
                        const ev = document.querySelector(`.evidence[data-evidence="${newId}"]`);
                        if (ev) ev.focus({ preventScroll: true });
                    }, 50);
                } else {
                    window.appAlert("Please select or create a project/tab first.");
                }
            }
        });

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

        const saveQuickNoteState = async () => {
            if (editingScenarioId) {
                const targetSc = window.mainPanelVM._findRealScenario(editingScenarioId);
                if (targetSc) {
                    targetSc.name = qnTitle.value.trim() || "Note";
                    targetSc.evidenceHtml = qnEditor.innerHTML;
                    targetSc.fields = currentFields;
                    targetSc.modifiedAt = Date.now();
                    await window.mainPanelVM._syncScenarioToDB(editingScenarioId);
                    globalEvents.publish('scenarios:changed');
                }
            } else {
                const isEmptyContent = !qnEditor.textContent.trim() && !qnEditor.querySelector('img') && !qnEditor.querySelector('input[type="checkbox"]');
                const isDefaultTitle = qnTitle.value.startsWith('Note ');
                if (isDefaultTitle && isEmptyContent && currentFields.length === 0) return false;
                
                const newId = window.mainPanelVM?.addScenario();
                if (newId) {
                    const sc = window.mainPanelVM._findRealScenario(newId);
                    if (sc) { 
                        sc.name = qnTitle.value.trim() || "Note";
                        sc.evidenceHtml = qnEditor.innerHTML;
                        sc.fields = currentFields;
                        sc.modifiedAt = Date.now();
                        await window.mainPanelVM._syncScenarioToDB(newId);
                        globalEvents.publish('scenarios:changed'); 
                    }
                    editingScenarioId = newId; 
                }
            }
            return true;
        };
        
        let isClosingQn = false;
        const closeAndSaveQuickNote = async (fromPopState = false) => {
            if (isClosingQn || qnBackdrop.style.display === 'none') return;
            isClosingQn = true;
            if (!fromPopState) history.back();
            qnBackdrop.classList.add('qn-animating');
            await saveQuickNoteState();
            setTimeout(() => { qnBackdrop.style.display = 'none'; isClosingQn = false; }, 300);
        };
        
        document.getElementById('qnReadModeBtn')?.addEventListener('click', async () => {
            if (!qnBackdrop.classList.contains('qn-read-mode')) {
                qnBackdrop.classList.add('qn-read-mode');
                qnEditor.contentEditable = "false";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'edit';
                if (qnAddField) qnAddField.style.display = 'none';
                await saveQuickNoteState();
            }
        });

        // Global History hook: Triggered natively if user presses the "Back" button or swipes
        window.addEventListener('popstate', () => {
            if (qnBackdrop.style.display === 'flex' && !isClosingQn) {
                closeAndSaveQuickNote(true);
            }
        });

        qnDone?.addEventListener('click', async () => {
            if (qnBackdrop.classList.contains('qn-read-mode')) {
                qnBackdrop.classList.remove('qn-read-mode');
                qnEditor.contentEditable = "true";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'check';
                if (qnAddField) qnAddField.style.display = 'grid';
                setTimeout(() => { qnEditor.focus(); moveCursorToEnd(qnEditor); }, 50);
            } else {
                qnBackdrop.classList.add('qn-read-mode');
                qnEditor.contentEditable = "false";
                qnDone.querySelector('.material-symbols-outlined').textContent = 'edit';
                if (qnAddField) qnAddField.style.display = 'none';
                await saveQuickNoteState();
            }
        });
        document.getElementById('qnCloseBtn')?.addEventListener('click', () => closeAndSaveQuickNote(false));
    }
    initQuickNote();

    /* ========= Link Notes Subsystem ========= */
    function initLinkNotes() {
        const lnBackdrop = document.createElement('div');
        lnBackdrop.id = 'linkNotesBackdrop';
        lnBackdrop.className = 'qn-backdrop';
        lnBackdrop.style.zIndex = '10003';
        lnBackdrop.innerHTML = `
            <div class="qn-header" style="flex-direction: row; align-items: center; gap: 12px; padding: max(24px, env(safe-area-inset-top)) 20px 16px;">
                <button class="btn secondary icon-only" id="lnCloseBtn" style="border: none; box-shadow: none; background: transparent;"><span class="material-symbols-outlined">arrow_back</span></button>
                <input type="text" id="lnSearchInput" class="qn-title-input" placeholder="Search notes to link..." />
            </div>
            <div class="qn-body" style="padding: 16px; overflow-y: auto;" id="lnResults">
            </div>
            <div class="qn-fab-stack" style="bottom: 24px;">
                <button class="qn-float-btn qn-done-btn" id="lnDoneBtn"><span class="material-symbols-outlined">check</span></button>
            </div>
        `;
        document.body.appendChild(lnBackdrop);

        let currentSourceId = null;
        let originalLinks = new Set();
        let currentLinks = new Set();
        let searchTimeout = null;

        window.openLinkNotes = async (sid) => {
            currentSourceId = sid;
            const sc = window.mainPanelVM._findRealScenario(sid);
            if (!sc) return;
            
            originalLinks = new Set([...(sc.linkedTo || []), ...(sc.linkedFrom || [])]);
            currentLinks = new Set(originalLinks);
            
            document.getElementById('lnSearchInput').value = '';
            document.getElementById('lnResults').innerHTML = '<div style="text-align:center; padding: 24px; color: var(--muted);">Type to search notes...</div>';
            lnBackdrop.style.display = 'flex';
            setTimeout(() => document.getElementById('lnSearchInput').focus(), 50);
            
            history.pushState({ lnOpen: true }, "");
        };

        const renderResults = async (query) => {
            const resultsContainer = document.getElementById('lnResults');
            if (!query.trim()) {
                resultsContainer.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--muted);">Type to search notes...</div>';
                return;
            }
            
            resultsContainer.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--muted);">Searching...</div>';
            
            let allItems = [];
            try {
                const projects = await dbService.getAllProjects();
                for (const p of projects) { allItems.push(...(await dbService.getItemsByProject(p.id))); }
            } catch (e) { console.error("Link Notes Search Error", e); }
            
            const q = query.toLowerCase();
            const filtered = allItems.filter(r => 
                r.id !== currentSourceId && 
                ((r.name && r.name.toLowerCase().includes(q)) || (r.evidenceHtml && r.evidenceHtml.toLowerCase().includes(q)))
            );

            if (filtered.length === 0) {
                resultsContainer.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--muted);">No notes found.</div>';
                return;
            }
            
            let html = '';
            for (const res of filtered) {
                let rawText = (res.evidenceHtml || "").replace(/<[^>]*>?/gm, '').trim();
                let snippet = rawText.length > 100 ? rawText.substring(0, 100) + '...' : rawText;
                let isChecked = currentLinks.has(res.id);
                
                html += `
                <div class="link-res-item" style="display: flex; align-items: flex-start; gap: 12px; background: var(--surface); padding: 12px; border-radius: 12px; margin-bottom: 8px; border: 1px solid var(--outline-2);">
                    <input type="checkbox" class="link-res-cb" data-sid="${res.id}" style="margin-top: 4px; width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer;" ${isChecked ? 'checked' : ''} />
                    <div class="link-res-content" style="flex: 1; cursor: pointer;">
                        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${escapeHtml(res.name)}</div>
                        <div class="link-res-snippet" style="font-size: 12px; color: var(--muted); line-height: 1.4;">${escapeHtml(snippet)}</div>
                        <div class="link-res-full" style="display: none; margin-top: 8px; border-top: 1px dashed var(--outline-2); padding-top: 8px; font-size: 13px; color: var(--text);">
                            ${res.evidenceHtml}
                        </div>
                    </div>
                </div>`;
            }
            resultsContainer.innerHTML = html;
        };

        document.getElementById('lnSearchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => renderResults(e.target.value), 300);
        });

        document.getElementById('lnResults').addEventListener('click', (e) => {
            const cb = e.target.closest('.link-res-cb');
            if (cb) {
                if (cb.checked) currentLinks.add(cb.dataset.sid);
                else currentLinks.delete(cb.dataset.sid);
                return;
            }
            
            const content = e.target.closest('.link-res-content');
            if (content) {
                const full = content.querySelector('.link-res-full');
                const snippet = content.querySelector('.link-res-snippet');
                if (full.style.display === 'none') {
                    full.style.display = 'block';
                    snippet.style.display = 'none';
                } else {
                    full.style.display = 'none';
                    snippet.style.display = 'block';
                }
            }
        });

        const closeLinkNotes = async (fromPopState = false) => {
            if (lnBackdrop.style.display === 'none') return;
            lnBackdrop.style.display = 'none';
            if (!fromPopState) history.back();
            
            const added = [...currentLinks].filter(id => !originalLinks.has(id));
            const removed = [...originalLinks].filter(id => !currentLinks.has(id));
            
            for (const id of added) await dbService.linkItems(currentSourceId, id);
            for (const id of removed) await dbService.unlinkItems(currentSourceId, id);
            
            if (added.length > 0 || removed.length > 0) {
                const sc = window.mainPanelVM._findRealScenario(currentSourceId);
                if (sc) {
                    sc.linkedTo = [...new Set([...(sc.linkedTo || []), ...added])].filter(id => !removed.includes(id));
                }
                for (const id of added) {
                    const targetSc = window.mainPanelVM._findRealScenario(id);
                    if (targetSc) targetSc.linkedFrom = [...new Set([...(targetSc.linkedFrom || []), currentSourceId])];
                }
                for (const id of removed) {
                    const targetSc = window.mainPanelVM._findRealScenario(id);
                    if (targetSc) targetSc.linkedFrom = (targetSc.linkedFrom || []).filter(tid => tid !== currentSourceId);
                }
                globalEvents.publish('scenarios:changed');
            }
        };

        document.getElementById('lnCloseBtn').addEventListener('click', () => closeLinkNotes(false));
        document.getElementById('lnDoneBtn').addEventListener('click', () => closeLinkNotes(false));

        window.addEventListener('popstate', () => {
            if (lnBackdrop.style.display === 'flex') closeLinkNotes(true);
        });
    }
    initLinkNotes();
}

/* Initial render */
bootApp();
