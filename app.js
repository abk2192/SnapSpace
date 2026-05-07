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
import { ShortcutService } from './src/services/ShortcutService.js';

/* ========= PWA Service Worker Registration ========= */
registerServiceWorker();

/* ========= Theme Engine ========= */
themeService.applyTheme();
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

    // Categorize static sidebar elements dynamically
    const sidebarInner = document.querySelector('.sidebar-inner');
    if (sidebarInner) {
        const firstItem = sidebarInner.firstElementChild;
        if (firstItem && !firstItem.classList.contains('menu-category')) {
            const prefCat = document.createElement('div'); prefCat.className = 'menu-category'; prefCat.textContent = 'Preferences';
            sidebarInner.insertBefore(prefCat, firstItem);
        }
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
            <button class="pill-btn pill-add" id="pillAddBtn"><span class="material-symbols-outlined">add</span> <span class="pill-text">Add Item</span></button>
            <button class="pill-btn" id="pillMoreBtn" title="More Actions"><span class="material-symbols-outlined">apps</span></button>
        `;
        document.body.appendChild(mobilePill);

        document.getElementById("pillSearchBtn").addEventListener("click", () => {
            document.querySelector('.search-trigger-btn')?.click();
        });
        document.getElementById("pillAddBtn").addEventListener("click", () => {
            document.getElementById("addScenarioBtn")?.click();
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

    // Load the reactive proxy state
    await store.init();
    
    dialogService.init();
    new ShortcutService();

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
    
    const activeWs = store.state.workspaces.find(w => w.id === store.state.activeWorkspaceId) || store.state.workspaces[0];
    const wsTitleInput = document.getElementById("workspaceTitleInput");
    if(wsTitleInput && activeWs) wsTitleInput.value = activeWs.title || "Project";
}

/* Initial render */
bootApp();
