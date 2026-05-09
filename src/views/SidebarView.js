import { escapeHtml } from '../utils/dom.js';
import { globalEvents } from '../core/PubSub.js';

export class SidebarView {
    constructor(vm) {
        this.vm = vm;
        this.listEl = document.getElementById("workspaceListItems");
        this.addBtn = document.getElementById("addWorkspaceBtn");
        this.draggedWsId = null;

        this.bindEvents();
        
        // Automatically re-render sidebar HTML whenever the store changes
        globalEvents.subscribe('workspaces:changed', () => this.render());
    }

    bindEvents() {
        // Add New Project
        this.addBtn?.addEventListener("click", () => {
            this.vm.addWorkspace();
            this.closeMobileSidebar();
        });

        // Hamburger Menu Logic
        const mainMenuBtn = document.getElementById("mainMenuBtn");
        const sidebarBackdrop = document.getElementById("sidebarBackdrop");
        const mobileSidebarClose = document.getElementById("mobileSidebarClose");

        mainMenuBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (window.innerWidth >= 900) document.body.classList.toggle("sidebar-hide");
            else {
                document.body.classList.toggle("sidebar-show");
                if(sidebarBackdrop) setTimeout(() => sidebarBackdrop.style.opacity = "1", 10);
            }
        });

        mobileSidebarClose?.addEventListener("click", () => this.closeMobileSidebar());
        sidebarBackdrop?.addEventListener("click", () => this.closeMobileSidebar());

        document.querySelectorAll('#sidebarMenu .menu-item:not(#addWorkspaceBtn)').forEach(item => {
            item.addEventListener("click", () => {
                if(window.innerWidth < 900) this.closeMobileSidebar();
            });
        });

        // Sidebar Width Resizer Logic
        const sidebarResizer = document.getElementById("sidebarResizer");
        let isResizingSidebar = false;

        const savedSidebarWidth = localStorage.getItem('snapspace_sidebar_width');
        if (savedSidebarWidth) document.documentElement.style.setProperty('--sidebar-width', savedSidebarWidth);

        sidebarResizer?.addEventListener("mousedown", () => {
            isResizingSidebar = true; sidebarResizer.classList.add('active');
            document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none';
        });
        document.addEventListener("mousemove", (e) => {
            if (!isResizingSidebar) return;
            let newWidth = Math.max(200, Math.min(e.clientX, 600));
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
        });
        document.addEventListener("mouseup", () => {
            if (isResizingSidebar) {
                isResizingSidebar = false; sidebarResizer?.classList.remove('active');
                document.body.style.cursor = ''; document.body.style.userSelect = '';
                localStorage.setItem('snapspace_sidebar_width', document.documentElement.style.getPropertyValue('--sidebar-width'));
            }
        });
    }

    closeMobileSidebar() {
        const sidebarBackdrop = document.getElementById("sidebarBackdrop");
        if(sidebarBackdrop) {
            sidebarBackdrop.style.opacity = "0";
            setTimeout(() => document.body.classList.remove("sidebar-show"), 300);
        }
    }

    render() {
        if(!this.listEl) return;
        this.listEl.innerHTML = "";
        
        this.vm.workspaces.forEach((ws) => {
            const btn = document.createElement("button");
            btn.className = "menu-item ws-item" + (ws.id === this.vm.activeId ? " active-ws" : "");
            
            btn.innerHTML = `
               <span class="material-symbols-outlined" style="font-size:18px;">workspaces</span> 
               <span class="ws-name">${escapeHtml(ws.title || 'Untitled')}</span>
               ${this.vm.workspaces.length > 1 ? `<span class="material-symbols-outlined ws-del" data-del-ws="${ws.id}" title="Delete Project">delete</span>` : ''}
            `;
            
            btn.draggable = true;
            btn.ondragstart = (e) => { this.draggedWsId = ws.id; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => btn.classList.add('dragging'), 0); };
            btn.ondragend = () => { this.draggedWsId = null; btn.classList.remove('dragging'); };
            btn.ondragover = (e) => { e.preventDefault(); btn.classList.add('drag-over-ws'); };
            btn.ondragleave = () => { btn.classList.remove('drag-over-ws'); };
            btn.ondrop = (e) => { e.preventDefault(); btn.classList.remove('drag-over-ws'); this.vm.reorderWorkspaces(this.draggedWsId, ws.id); };

            btn.addEventListener("click", (e) => {
                const del = e.target.closest("[data-del-ws]");
                if (del) { e.stopPropagation(); this.vm.deleteWorkspace(ws.id); return; }
                this.vm.setActiveWorkspace(ws.id);
            });
            this.listEl.appendChild(btn);
        });
    }
}