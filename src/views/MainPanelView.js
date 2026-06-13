import { escapeHtml, escapeAttr } from '../utils/dom.js';
import { globalEvents } from '../core/PubSub.js';
import { dialogService } from '../services/DialogService.js';
import { dbService } from '../services/Database.js';

export class MainPanelView {
    constructor(vm) {
        this.vm = vm;
        this.tabsEl = document.getElementById("tabs");
        this.panelEl = document.getElementById("panel");
        this.draggedTabIdx = null;

        this.bindEvents();
        globalEvents.subscribe('workspaces:changed', () => this.render());
        globalEvents.subscribe('workspace:selected', () => {
            if (this.vm.activeWorkspace) this.vm.activeWorkspace.activeTabId = "dashboard";
            this.render();
        });
        globalEvents.subscribe('tabs:changed', () => this.renderTabs());
        globalEvents.subscribe('scenarios:changed', () => this.renderPanel());
        globalEvents.subscribe('tags:updated', () => this.updateTagsOnly());
    }

    bindEvents() {
        const wsSwitcherWrap = document.getElementById("wsSwitcherWrap");
        wsSwitcherWrap?.addEventListener("click", (e) => {
            if (e.target.closest('#wsRenameBtn')) {
                e.stopPropagation();
                wsSwitcherWrap.classList.remove('active');
                dialogService.prompt("Rename Project", this.vm.activeWorkspace?.title || "Project", "Enter new project name:").then((val) => {
                    if (val !== null && val !== undefined && val.trim() !== "") this.vm.updateProjectTitle(val);
                });
                return;
            }
            const switchBtn = e.target.closest('[data-switch-ws]');
            if (switchBtn) {
                e.stopPropagation();
                wsSwitcherWrap.classList.remove('active');
                import('../core/Store.js').then(({store}) => {
                    store.state.activeWorkspaceId = switchBtn.dataset.switchWs;
                    globalEvents.publish('workspaces:changed');
                    globalEvents.publish('workspace:selected');
                });
                return;
            }
            wsSwitcherWrap.classList.toggle('active');
        });
        
        document.addEventListener('click', (e) => {
            if (wsSwitcherWrap && !wsSwitcherWrap.contains(e.target)) {
                wsSwitcherWrap.classList.remove('active');
            }
        });

        document.addEventListener('click', e => {
            const calDay = e.target.closest('.cal-day');
            if (calDay) { 
                this.vm.setActiveTab("dashboard", "dashboard");
                this.vm.setDashboardDateFilter(calDay.dataset.date); 
                return; 
            }
            
            if (e.target.closest('#clearDashFilterBtn')) {
                this.vm.setDashboardDateFilter(null);
                return;
            }
            
            if (e.target.closest('#calPrevBtn')) { this.vm.changeCalendarMonth(-1); return; }
            if (e.target.closest('#calNextBtn')) { this.vm.changeCalendarMonth(1); return; }
        });

        document.addEventListener('change', e => {
            if (e.target.id === 'calDatePicker') {
                const date = new Date(e.target.value);
                if (!isNaN(date)) {
                    const parts = e.target.value.split('-');
                    this.vm._calYear = parseInt(parts[0]);
                    this.vm._calMonth = parseInt(parts[1]) - 1;
                    this.vm.setActiveTab("dashboard", "dashboard");
                    this.vm.setDashboardDateFilter(e.target.value);
                }
            }
        });

        const resetBtn = document.getElementById("resetBtn");
        resetBtn?.addEventListener("click", () => this.vm.resetProject());

        document.body.addEventListener("click", (e) => {
            // Original panel click bindings
            const addBtn = e.target.closest("#addScenarioBtn");
            if (addBtn) {
                const newId = this.vm.addScenario();
                if (newId) {
                    setTimeout(() => { 
                        const inp = document.querySelector(`input[data-sid="${newId}"][data-field="name"]`); 
                        if (inp) { 
                            inp.readOnly = false;
                            inp.classList.add("editing");
                            inp.focus(); 
                            inp.select(); 
                        } 
                    }, 50);
                }
            }

            const toggleAllBtn = e.target.closest("#toggleAllBtn");
            if (toggleAllBtn) {
                this.vm.toggleAllScenarios();
            }
            
            const dupBtn = e.target.closest("[data-duplicate]");
            if (dupBtn) { this.vm.duplicateScenario(dupBtn.dataset.duplicate); return; }
            
            const delBtn = e.target.closest("[data-delete]");
            if (delBtn) { this.vm.deleteScenario(delBtn.dataset.delete); return; }
            
            const addFBtn = e.target.closest("[data-addfield]");
            if (addFBtn) { 
                window.appDualPrompt().then(res => {
                    if (res && res.key) {
                        this.vm.addField(addFBtn.dataset.addfield, res.key, res.val); 
                    }
                });
                return; 
            }
            
            const delFBtn = e.target.closest("[data-delfield]");
            if (delFBtn) { this.vm.deleteField(delFBtn.dataset.sid, delFBtn.dataset.delfield); return; }

            // Structural UX interactions migrated from app.js
            const moreBtn = e.target.closest('.scen-more-btn');
            document.querySelectorAll('.scen-more-wrap.active').forEach(w => {
                if (moreBtn && w === moreBtn.parentElement) return;
                w.classList.remove('active');
            });
            if (moreBtn) moreBtn.parentElement.classList.toggle('active');

            const summary = e.target.closest("summary");
            if (summary) {
                if (e.target.closest(".tag") || e.target.closest(".scen-more-wrap") || window.getSelection().toString().trim().length > 0) e.preventDefault();
            }

            const editNameBtn = e.target.closest(".edit-name-btn, [data-edit-name]");
            if (editNameBtn) {
                e.preventDefault(); e.stopPropagation();
                const scId = editNameBtn.dataset.editName || editNameBtn.closest('.scenario')?.dataset.sid;
                if (scId) {
                    const input = document.querySelector(`input[data-sid="${scId}"][data-field="name"]`);
                    if (input) {
                        const card = input.closest('details'); 
                        if (card && !card.open) card.open = true;
                        input.readOnly = false;
                        input.classList.add("editing"); 
                        setTimeout(() => { input.focus(); input.select(); }, 50);
                    }
                }
            } else if (!e.target.closest('.header-name-input')) {
                document.querySelectorAll('.header-name-input.editing').forEach(el => { el.classList.remove('editing'); el.readOnly = true; });
            }
        });

        document.body.addEventListener("input", (e) => {
            const nameInp = e.target.closest("input[data-field='name']");
            if (nameInp) { this.vm.updateScenarioName(nameInp.dataset.sid, nameInp.value); return; }
            const keyInp = e.target.closest("input[data-fkey]");
            if (keyInp) { this.vm.updateFieldKey(keyInp.dataset.sid, keyInp.dataset.fkey, keyInp.value); return; }
            const valInp = e.target.closest("input[data-fval]");
            if (valInp) { this.vm.updateFieldVal(valInp.dataset.sid, valInp.dataset.fval, valInp.value); return; }
            const ev = e.target.closest(".evidence[data-evidence]");
            if (ev) { this.vm.updateEvidence(ev.dataset.evidence, ev.innerHTML); return; }
        });

        document.body.addEventListener("toggle", (e) => {
            if (e.target.matches("details.scenario") && e.target.isConnected) {
                this.vm.updateScenarioOpenState(e.target.dataset.sid, e.target.open);
                if (e.target.open) {
                    // Scroll into view centering it, leaving one item above and below
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                }
            }
        }, true);

        document.body.addEventListener("focusout", (e) => {
            if (e.target.matches("input[data-field='name']")) {
                e.target.readOnly = true;
                e.target.classList.remove('editing');
                if (!e.target.value.trim()) { e.target.value = e.target.placeholder; e.target.dispatchEvent(new Event("input", {bubbles: true})); }
            }
        });

        // Touch gestures for Swipe-to-switch Tabs
        let touchStartX = 0; let touchStartY = 0;
        document.addEventListener('touchstart', e => {
            if (e.target.closest('.tabs') || e.target.closest('.evidence-table') || e.target.closest('.evidence')) return;
            if (e.touches && e.touches.length > 0) {
                touchStartX = e.touches[0].screenX;
                touchStartY = e.touches[0].screenY;
            }
        }, {passive: true});

        document.addEventListener('touchend', e => {
            if (e.target.closest('.tabs') || e.target.closest('.evidence-table') || e.target.closest('.evidence')) return;
            if (!e.changedTouches || e.changedTouches.length === 0) return;
            
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            const xDiff = touchStartX - touchEndX;
            const yDiff = touchStartY - touchEndY;
            
            if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 80) { // 80px horizontal swipe threshold
                const tabs = [{id: "dashboard"}, ...this.vm.tabs];
                if (!tabs || tabs.length === 0) return;
                const activeId = this.vm.activeWorkspace?.activeTabId;
                let currentIndex = tabs.findIndex(t => t.id === activeId);
                if (currentIndex === -1) currentIndex = 0;
                
                if (xDiff > 0) { // Swiped left -> Next tab
                    if (currentIndex < tabs.length - 1) {
                        const targetId = tabs[currentIndex + 1].id;
                        this.vm.setActiveTab(targetId, targetId === 'dashboard' ? 'dashboard' : this.vm.viewMode);
                    }
                } else { // Swiped right -> Previous tab
                    if (currentIndex > 0) {
                        const targetId = tabs[currentIndex - 1].id;
                        this.vm.setActiveTab(targetId, targetId === 'dashboard' ? 'dashboard' : this.vm.viewMode);
                    }
                }
            }
        }, {passive: true});

        // Mobile Touch Drag & Drop for Items
        let touchDragEl = null; let touchDragGhost = null; let touchDragFromIdx = -1;

        document.addEventListener("touchstart", (e) => {
            const handle = e.target.closest('.drag-handle');
            if (handle) {
                const scenario = handle.closest('details.scenario');
                if (scenario) {
                    touchDragEl = scenario;
                    touchDragFromIdx = Array.from(scenario.parentNode.children).indexOf(scenario);
                    
                    touchDragGhost = scenario.cloneNode(true);
                    touchDragGhost.style.position = 'fixed'; touchDragGhost.style.zIndex = '9999';
                    touchDragGhost.style.opacity = '0.8'; touchDragGhost.style.pointerEvents = 'none';
                    touchDragGhost.style.width = scenario.offsetWidth + 'px';
                    touchDragGhost.style.left = scenario.getBoundingClientRect().left + 'px';
                    touchDragGhost.style.top = scenario.getBoundingClientRect().top + 'px';
                    touchDragGhost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
                    document.body.appendChild(touchDragGhost);
                    
                    scenario.style.opacity = '0.3';
                }
            }
        }, {passive: false});

        document.addEventListener("touchmove", (e) => {
            if (touchDragGhost && touchDragEl) {
                e.preventDefault(); // Stop page scroll smoothly during reorder
                const touch = e.touches[0];
                touchDragGhost.style.top = (touch.clientY - 20) + 'px';
                
                const overEl = document.elementFromPoint(touch.clientX, touch.clientY);
                if (overEl) {
                    const overScenario = overEl.closest('details.scenario');
                    document.querySelectorAll('.drag-over-scenario').forEach(el => el.classList.remove('drag-over-scenario'));
                    if (overScenario && overScenario !== touchDragEl) overScenario.classList.add('drag-over-scenario');
                }
            }
        }, {passive: false});

        document.addEventListener("touchend", (e) => {
            if (touchDragGhost && touchDragEl) {
                const touch = e.changedTouches[0];
                const overEl = document.elementFromPoint(touch.clientX, touch.clientY);
                let toIdx = -1;
                
                if (overEl) {
                    const overScenario = overEl.closest('details.scenario');
                    if (overScenario && overScenario !== touchDragEl) toIdx = Array.from(overScenario.parentNode.children).indexOf(overScenario);
                }
                
                touchDragGhost.remove(); touchDragGhost = null;
                touchDragEl.style.opacity = '1';
                document.querySelectorAll('.drag-over-scenario').forEach(el => el.classList.remove('drag-over-scenario'));
                
                if (toIdx !== -1 && touchDragFromIdx !== -1 && toIdx !== touchDragFromIdx) this.vm.reorderScenarios(touchDragFromIdx, toIdx);
                touchDragEl = null; touchDragFromIdx = -1;
            }
        });

        let isDesktop = window.innerWidth > 900;
        window.addEventListener('resize', () => {
            const nowDesktop = window.innerWidth > 900;
            if (isDesktop !== nowDesktop) {
                isDesktop = nowDesktop;
                this.renderTabs();
                if (this.vm.viewMode === 'dashboard') this.renderPanel();
            }
        });
    }

    renderWorkspaceSwitcher() {
        const wsDisplay = document.getElementById("workspaceTitleDisplay");
        if (wsDisplay && this.vm.activeWorkspace) wsDisplay.textContent = this.vm.activeWorkspace.title || "Project";
        
        const menu = document.getElementById("wsDropdownMenu");
        if (menu) {
            let html = `
                <button class="btn secondary action-btn" type="button" id="wsRenameBtn">
                    <span class="material-symbols-outlined">edit</span> <span class="btn-text">Rename Project</span>
                </button>
                <div style="height: 1px; background: var(--outline-2); margin: 4px 0;"></div>
                <div style="padding: 4px 12px; font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase;">Switch Project</div>
            `;
            this.vm.workspaces.forEach(ws => {
                const isActive = ws.id === this.vm.activeWorkspace?.id;
                html += `
                    <button class="btn secondary action-btn" type="button" data-switch-ws="${ws.id}" style="${isActive ? 'color: var(--primary); background: var(--primary-light);' : ''}">
                        <span class="material-symbols-outlined">${isActive ? 'check' : 'workspaces'}</span>
                        <span class="btn-text" style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(ws.title || 'Untitled')}</span>
                    </button>
                `;
            });
            menu.innerHTML = html;
        }
    }

    render() {
        this.renderWorkspaceSwitcher();
        this.renderTabs();
        this.renderPanel();
    }

    async renderTabs() {
        if(!this.tabsEl) return;
        const savedScrollLeft = this.tabsEl.scrollLeft;

        const daysWithNotes = new Set();
        const tabCounts = {};
        if (this.vm.activeWorkspace) {
            const items = await dbService.getItemsByProject(this.vm.activeWorkspace.id);
            items.forEach(sc => {
                let dStr = sc.noteDate;
                if (!dStr) {
                    const d = new Date(sc.createdAt || sc.modifiedAt || Date.now());
                    dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }
                daysWithNotes.add(dStr);
                
                const tabTag = (sc._tags || []).find(t => t.toLowerCase().startsWith('tabid:'));
                const tId = tabTag ? tabTag.split(':')[1] : null;
                if (tId) tabCounts[tId] = (tabCounts[tId] || 0) + 1;
            });
        }

        this.tabsEl.innerHTML = "";
        const tabs = this.vm.tabs;
        const activeTabId = this.vm.activeTabId || (this.vm.activeWorkspace?.activeTabId === "dashboard" ? "dashboard" : null);

        const calWrap = document.getElementById("dashCalendarWrap");
        if (this.vm.viewMode === "dashboard" || window.innerWidth > 900) {
            calWrap.style.display = "block";
            
            const year = this.vm.calendarYear; const month = this.vm.calendarMonth; 
            const now = new Date();
            const todayStr = `${year}-${String(month+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
            
            let daysHtml = ''; const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            dayNames.forEach(d => daysHtml += `<div style="font-weight: 700; color: var(--muted); padding: 4px 0; font-size: 11px; text-align: center;">${d}</div>`);
            for (let i = 0; i < firstDay; i++) { daysHtml += `<div></div>`; }
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const isSunday = new Date(year, month, i).getDay() === 0;
                const isToday = dateStr === todayStr; const isSelected = this.vm.dashboardDateFilter === dateStr; const hasNotes = daysWithNotes.has(dateStr);
                
                let classes = "cal-day";
                if (isSunday) classes += " sunday";
                if (isToday) classes += " today";
                if (isSelected) classes += " selected";
                if (hasNotes && !isSelected) classes += " has-notes";
                daysHtml += `<div class="${classes}" data-date="${dateStr}">${i}</div>`;
            }

            calWrap.innerHTML = `
                <div style="max-width: 400px; width: 100%; margin: 0 auto; padding: 12px 16px; overflow: hidden; box-sizing: border-box;">
                    <div style="font-weight: 800; font-size: 15px; margin-bottom: 12px; color: var(--text); display: flex; align-items: center; justify-content: space-between;">
                        <button class="btn secondary icon-only" id="calPrevBtn" style="padding: 4px; height: 28px; width: 28px; min-height: 0;"><span class="material-symbols-outlined">chevron_left</span></button>
                        <label style="position: relative; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <span>${monthName} ${year}</span>
                            <input type="date" id="calDatePicker" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; left: 0; top: 0;" />
                        </label>
                        <button class="btn secondary icon-only" id="calNextBtn" style="padding: 4px; height: 28px; width: 28px; min-height: 0;"><span class="material-symbols-outlined">chevron_right</span></button>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; gap: 4px 0;">${daysHtml}</div>
                </div>`;
        } else { calWrap.style.display = "none"; }

        const fragment = document.createDocumentFragment();

        // Dashboard Tab
        const dashBtn = document.createElement("button");
        dashBtn.className = "tab" + (activeTabId === "dashboard" ? " active" : "");
        dashBtn.type = "button";
        dashBtn.innerHTML = `
            <span class="tab-name-wrapper">
                <span class="material-symbols-outlined" style="font-size: 16px;">dashboard</span>
                <span class="tab-label">Dashboard</span>
            </span>
        `;
        dashBtn.addEventListener("click", () => { this.vm.setActiveTab("dashboard", 'dashboard'); });
        fragment.appendChild(dashBtn);

        tabs.forEach((tab, index) => {
            const btn = document.createElement("button");
            btn.className = "tab" + (tab.id === activeTabId ? " active" : "");
            btn.type = "button";
            
            let finalHtml = `
            <span class="tab-name-wrapper">
                <span class="tab-label" title="${escapeAttr(tab.name)}">${escapeHtml(tab.name)}</span>
                <span class="tab-count">${tab.isTemporary ? (tab.scenarios?.length || 0) : (tabCounts[tab.id] || 0)}</span>
            </span>
            `;
            if (tab.isTemporary) {
                finalHtml += `<span class="x" title="Close search" data-close-temp="true">×</span>`;
            } else if (tabs.length > 1) { 
                finalHtml += `<span class="x" title="Close tab" data-close-tab="${tab.id}">×</span>`; 
            }
            btn.innerHTML = finalHtml;

            if (!tab.isTemporary) {
                btn.draggable = true;
                btn.ondragstart = (e) => { this.draggedTabIdx = index; e.dataTransfer.effectAllowed = 'move'; setTimeout(()=>btn.classList.add('dragging'), 0); };
                btn.ondragend = () => { this.draggedTabIdx = null; btn.classList.remove('dragging'); };
                btn.ondragover = (e) => { e.preventDefault(); btn.classList.add('drag-over'); };
                btn.ondragleave = () => { btn.classList.remove('drag-over'); };
                btn.ondrop = (e) => { e.preventDefault(); btn.classList.remove('drag-over'); this.vm.reorderTabs(this.draggedTabIdx, index); };
            }

            btn.addEventListener("click", (e) => {
                if (e.target.closest("[data-close-temp]")) { e.stopPropagation(); this.vm.closeTemporarySearchTab(); return; }
                const close = e.target.closest("[data-close-tab]");
                if (close){ e.stopPropagation(); this.vm.deleteTab(close.getAttribute("data-close-tab")); return; }
                if (tab.id === activeTabId && this.vm.viewMode === 'maximized' && !tab.isTemporary) {
                    e.stopPropagation();
                    dialogService.prompt("Rename tab", tab.name, "Give this tab a short name.").then((val) => {
                        if (val !== undefined && val !== null) this.vm.renameTab(tab.id, val);
                    });
                    setTimeout(() => {
                        const dlgInput = document.getElementById("dlgInput");
                        if (dlgInput) { dlgInput.focus(); dlgInput.select(); }
                    }, 100);
                    return;
                }
                this.vm.setActiveTab(tab.id, 'maximized');
            });
            fragment.appendChild(btn);
        });
        const plus = document.createElement("button");
        plus.className = "tab plus"; plus.type = "button"; plus.textContent = "＋ New tab";
        plus.addEventListener("click", () => {
            const newScenId = this.vm.addTab();
            if(newScenId) setTimeout(() => { 
                const inp = document.querySelector(`input[data-sid="${newScenId}"][data-field="name"]`); 
                if (inp) { 
                    inp.readOnly = false;
                    inp.classList.add("editing");
                    inp.focus(); 
                    inp.select(); 
                } 
            }, 50);
        });
        fragment.appendChild(plus);

        this.tabsEl.innerHTML = "";
        this.tabsEl.appendChild(fragment);
        this.tabsEl.scrollLeft = savedScrollLeft;

        // Ensure active tab and surrounding tabs remain visible on swipe/click
        setTimeout(() => {
            const activeTabEl = this.tabsEl.querySelector('.tab.active');
            if (activeTabEl) {
                const prev = activeTabEl.previousElementSibling;
                const next = activeTabEl.nextElementSibling;
                
                const elLeft = (prev && prev.classList.contains('tab')) ? prev : activeTabEl;
                const elRight = (next && next.classList.contains('tab') && !next.classList.contains('plus')) ? next : activeTabEl;
                
                const cRect = this.tabsEl.getBoundingClientRect();
                const lRect = elLeft.getBoundingClientRect();
                const rRect = elRight.getBoundingClientRect();
                
                if (lRect.left < cRect.left) {
                    this.tabsEl.scrollBy({ left: lRect.left - cRect.left - 16, behavior: 'smooth' });
                } else if (rRect.right > cRect.right) {
                    this.tabsEl.scrollBy({ left: rRect.right - cRect.right + 16, behavior: 'smooth' });
                }
            }
        }, 50);
    }

    async renderPanel() {
        if(!this.tabsEl || !this.panelEl) return;
        
        const activeTabId = this.vm.activeTabId;
        const currentWsId = this.vm.activeWorkspace?.id;
        if (!currentWsId && !this.vm.temporarySearchTab) {
            this.panelEl.innerHTML = "";
            return;
        }

        const wrap = document.createElement("div"); wrap.className = "tab-panel"; wrap.style.display = "block";

        if (this.vm.viewMode === "dashboard") {
            let allScenarios = [];
            if (currentWsId) {
                if (activeTabId === "dashboard") {
                    const items = await dbService.getItemsByProject(currentWsId);
                    const views = await dbService.getViewsByProject(currentWsId);
                    items.forEach(sc => {
                        const tabTag = (sc._tags || []).find(t => t.toLowerCase().startsWith('tabid:'));
                        const tId = tabTag ? tabTag.split(':')[1] : null;
                        const view = views.find(v => v.id === tId);
                        allScenarios.push({ ...sc, _tabId: tId, _tabName: view ? view.name : "Unknown", _wsId: currentWsId });
                    });
                } else {
                    const items = await dbService.getItemsByTab(activeTabId);
                    const views = await dbService.getViewsByProject(currentWsId);
                    const view = views.find(v => v.id === activeTabId);
                    items.forEach(sc => {
                        allScenarios.push({ ...sc, _tabId: activeTabId, _tabName: view ? view.name : "Unknown", _wsId: currentWsId });
                    });
                }
            }
            
            if (this.vm.dashboardDateFilter) {
                allScenarios = allScenarios.filter(sc => {
                    let dStr = sc.noteDate;
                    if (!dStr) {
                        const d = new Date(sc.createdAt || sc.modifiedAt || Date.now());
                        dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    }
                    return dStr === this.vm.dashboardDateFilter;
                });
            }

            // Sort descending by modifiedAt
            allScenarios.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
            const limit = window.innerWidth > 900 ? undefined : 5;
            const recent = limit ? allScenarios.slice(0, limit) : allScenarios;
            
            if (recent.length === 0) {
                wrap.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--muted); border: 1px dashed var(--outline); border-radius: var(--r12); margin-top: 16px;">${this.vm.dashboardDateFilter ? 'No notes found for this date.' : 'No notes yet. Create one to see it on your dashboard!'}</div>`;
            } else {
                const header = document.createElement("div");
                const filterText = this.vm.dashboardDateFilter ? `Notes from ${this.vm.dashboardDateFilter}` : 'Recent Notes';
                header.innerHTML = `<div style="font-weight: 800; font-size: 16px; margin: 16px 0 12px; color: var(--text); display: flex; justify-content: space-between; align-items: center;"><span>${filterText}</span>${this.vm.dashboardDateFilter ? `<button class="btn secondary icon-only" id="clearDashFilterBtn" style="padding: 4px; height: 24px; width: 24px; min-height: 0;" title="Clear Filter"><span class="material-symbols-outlined" style="font-size: 16px;">close</span></button>` : ''}</div>`;
                wrap.appendChild(header);
                recent.forEach((sc, idx) => { wrap.appendChild(this.renderScenarioCard(sc, idx, true)); });
            }

            this.panelEl.innerHTML = "";
            this.panelEl.appendChild(wrap);
            const pMeta = document.getElementById("panelMeta"); if (pMeta) pMeta.style.display = "block";
            const panelHeadActions = document.querySelector('.panel-head > div:nth-child(2)');
            if (panelHeadActions) panelHeadActions.style.display = "none";
            return;
        }

        let renderScenarios = [];
        let isTemp = false;
        if (activeTabId === 'search_results' && this.vm.temporarySearchTab) {
            renderScenarios = this.vm.temporarySearchTab.scenarios || [];
            isTemp = true;
        } else if (activeTabId) {
            renderScenarios = await dbService.getItemsByTab(activeTabId);
            renderScenarios.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }
        
        renderScenarios.forEach((sc, idx) => { wrap.appendChild(this.renderScenarioCard(sc, idx, false, isTemp)); });
        
        this.panelEl.innerHTML = "";
        this.panelEl.appendChild(wrap);

        const pMeta = document.getElementById("panelMeta"); if (pMeta) pMeta.style.display = "none";
        
        const panelHeadActions = document.querySelector('.panel-head > div:nth-child(2)');
        if (panelHeadActions) panelHeadActions.style.display = "flex";

        const toggleAllBtn = document.getElementById('toggleAllBtn');
        if (toggleAllBtn && renderScenarios.length > 0) {
            const anyOpen = renderScenarios.some(sc => sc.isOpen !== false);
            toggleAllBtn.innerHTML = `<span class="material-symbols-outlined">${anyOpen ? 'unfold_less' : 'unfold_more'}</span>`;
            toggleAllBtn.title = anyOpen ? 'Collapse All' : 'Expand All';
        }
    }

    renderScenarioCard(sc, idx, isDashboard = false, isTempSearch = false) {
        const isLocked = document.body.classList.contains('readonly');
        const d = document.createElement("details");
        d.className = "scenario"; d.dataset.sid = sc.id; d.open = (isDashboard || isTempSearch) ? false : (sc.isOpen !== false); d.draggable = false; 
        
        if (!isDashboard && !isTempSearch) {
            d.ondragstart = (e) => { e.dataTransfer.setData('text/plain', idx); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => d.classList.add('dragging'), 0); };
            d.ondragend = () => { d.classList.remove('dragging'); d.draggable = false; };
            d.ondragover = (e) => { e.preventDefault(); d.classList.add('drag-over-scenario'); };
            d.ondragleave = () => { d.classList.remove('drag-over-scenario'); };
            d.ondrop = (e) => { e.preventDefault(); d.classList.remove('drag-over-scenario'); d.draggable = false; const fromIdx = parseInt(e.dataTransfer.getData('text/plain')); this.vm.reorderScenarios(fromIdx, idx); };
        }

        const validFields = (sc.fields || []).filter(f => f.key.trim() || f.val.trim());
        const tagsHtml = validFields.map(f => `<span class="tag"><b>${escapeHtml(f.key || "Field")}:</b> ${escapeHtml(f.val || "-")}</span>`).join("");

        let dashBadge = "";
        let dashSnippet = "";
        if (isDashboard || isTempSearch) {
            dashBadge = `<span class="tag dash-badge-link" style="background: var(--primary-light); color: var(--primary); border: none; margin-right: 4px; cursor: pointer;">${escapeHtml(sc._tabName || "")}</span>`;
        }

        if (sc.evidenceHtml) {
            let html = sc.evidenceHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<li>/gi, '• ').replace(/<\/li>/gi, '\n');
            let rawText = html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").trim();
            rawText = rawText.replace(/\n\s*\n/g, '\n'); // Remove extra blank lines
            if (rawText) {
                dashSnippet = `<div class="summary-sub" style="margin-top: 6px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; font-size: 12px; color: var(--muted);">${escapeHtml(rawText)}</div>`;
            }
        }

        const fieldsHtml = (sc.fields || []).map(f => `
            <div class="field-row">
            <input class="input" data-fkey="${f.id}" data-sid="${sc.id}" value="${escapeAttr(f.key)}" placeholder="Field Name (e.g., Env, Policy)" />
            <input class="input" data-fval="${f.id}" data-sid="${sc.id}" value="${escapeAttr(f.val)}" placeholder="Value" />
            <button class="btn secondary del action-btn icon-only" type="button" data-delfield="${f.id}" data-sid="${sc.id}"><span class="material-symbols-outlined">close</span></button>
            </div>
        `).join("");

        if (isDashboard || isTempSearch) {
            d.addEventListener('click', (e) => {
                if (e.target.closest('.dash-badge-link')) { 
                    e.preventDefault(); e.stopPropagation(); 
                    if (sc._wsId && sc._wsId !== this.vm.activeWorkspace?.id) {
                        import('../core/Store.js').then(({store}) => {
                            store.state.activeWorkspaceId = sc._wsId;
                            globalEvents.publish('workspaces:changed');
                            globalEvents.publish('workspace:selected');
                            this.vm.setActiveTab(sc._tabId, 'maximized');
                        });
                    } else {
                        this.vm.setActiveTab(sc._tabId, 'maximized');
                        setTimeout(() => {
                            const targetCard = document.querySelector(`details.scenario[data-sid="${sc.id}"]`);
                            if (targetCard) { targetCard.open = true; targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                        }, 50);
                    }
                    return; 
                }
                
                if (e.target.closest('.scen-more-wrap') || e.target.closest('.edit-name-btn') || e.target.closest('.header-name-input.editing')) {
                    return; 
                }

                if (e.target.closest('summary')) {
                    e.preventDefault(); e.stopPropagation();
                    if (sc._wsId && sc._wsId !== this.vm.activeWorkspace?.id) {
                        import('../core/Store.js').then(({store}) => {
                            store.state.activeWorkspaceId = sc._wsId;
                            globalEvents.publish('workspaces:changed');
                            globalEvents.publish('workspace:selected');
                            this.vm.setActiveTab(sc._tabId, 'maximized');
                        });
                    } else {
                        this.vm.setActiveTab(sc._tabId, 'maximized');
                        setTimeout(() => {
                            const targetCard = document.querySelector(`details.scenario[data-sid="${sc.id}"]`);
                            if (targetCard) { targetCard.open = true; targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                        }, 50);
                    }
                }
            });
        }

        const dateHtml = `
            <div style="font-size: 11px; color: var(--muted); text-align: right; margin-top: 8px; position: relative; height: 16px;">
                <span style="position: absolute; right: 0; top: 0; animation: fade1 8s infinite;">Updated on ${new Date(sc.modifiedAt || Date.now()).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span style="position: absolute; right: 0; top: 0; animation: fade2 8s infinite;">Created on ${new Date(sc.createdAt || sc.modifiedAt || Date.now()).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        `;

        const dragHandleHtml = (!isDashboard && !isTempSearch) 
            ? `<span class="drag-handle material-symbols-outlined" style="font-size: 18px; cursor: grab; color: var(--muted);" onmousedown="this.closest('details').draggable=true" onmouseup="this.closest('details').draggable=false" onmouseleave="this.closest('details').draggable=false">drag_indicator</span>`
            : '';

        d.innerHTML = `<summary><div class="summary-content"><div style="display:flex; align-items:center; gap:6px; width: 100%;">${dragHandleHtml}<input class="header-name-input" data-field="name" data-sid="${sc.id}" value="${escapeAttr(sc.name||"")}" placeholder="Item ${idx+1}" readonly /><button class="btn secondary action-btn icon-only edit-name-btn" type="button" title="Edit Name"><span class="material-symbols-outlined">edit</span></button></div>${dashSnippet}${tagsHtml ? `<div class="summary-tags">${tagsHtml}</div>` : ``}</div><div class="summary-actions">${dashBadge}<div class="scen-more-wrap"><button class="btn secondary action-btn icon-only scen-more-btn" type="button" title="More Actions"><span class="material-symbols-outlined">more_vert</span></button><div class="scen-more-menu"><button class="btn secondary action-btn" type="button" title="Edit Name" data-edit-name="${sc.id}"><span class="material-symbols-outlined">edit</span> <span class="btn-text">Edit Name</span></button><button class="btn secondary action-btn" type="button" title="Save as Template" data-template="${sc.id}"><span class="material-symbols-outlined">bookmark_add</span> <span class="btn-text">Save Template</span></button><button class="btn secondary action-btn" type="button" title="Duplicate Item" data-duplicate="${sc.id}"><span class="material-symbols-outlined">content_copy</span> <span class="btn-text">Duplicate</span></button><button class="btn secondary action-btn" type="button" title="Move Item" data-move="${sc.id}"><span class="material-symbols-outlined">move_item</span> <span class="btn-text">Move</span></button><button class="btn danger action-btn" type="button" title="Delete Item" data-delete="${sc.id}"><span class="material-symbols-outlined">delete</span> <span class="btn-text">Delete Item</span></button></div></div><div class="chev"><span class="material-symbols-outlined">expand_more</span></div></div></summary><div class="card-body"><div class="label" style="justify-content: space-between;"><span style="display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size: 14px;">tune</span> Properties</span><button class="btn secondary action-btn icon-only" type="button" data-addfield="${sc.id}" style="padding: 2px; min-height: auto; border: none; background: transparent; color: var(--primary); box-shadow: none;" title="Add Property Field"><span class="material-symbols-outlined" style="font-size: 18px;">add_circle</span></button></div><div class="field-list">${fieldsHtml}</div><div class="evidence-wrap"><div class="label" style="margin-bottom: 6px;"><span class="material-symbols-outlined" style="font-size: 14px;">image</span> Notes & Media</div><div class="tbl-controls tbl-row-controls"><button class="tbl-btn tbl-add-row" data-cmd="tableAddRow" title="Add Row Below"><span class="material-symbols-outlined">add</span></button><div class="tbl-divider"></div><button class="tbl-btn tbl-del-row" data-cmd="tableDelRow" title="Delete Row"><span class="material-symbols-outlined">remove</span></button></div><div class="tbl-controls tbl-col-controls"><button class="tbl-btn tbl-add-col" data-cmd="tableAddCol" title="Add Column Right"><span class="material-symbols-outlined">add</span></button><div class="tbl-divider"></div><button class="tbl-btn tbl-del-col" data-cmd="tableDelCol" title="Delete Column"><span class="material-symbols-outlined">remove</span></button></div><div class="wysiwyg-toolbar action-btn"><button class="btn secondary" type="button" data-cmd="bold" title="Bold"><span class="material-symbols-outlined" style="margin:0;">format_bold</span></button><button class="btn secondary" type="button" data-cmd="italic" title="Italic"><span class="material-symbols-outlined" style="margin:0;">format_italic</span></button><button class="btn secondary" type="button" data-cmd="strikeThrough" title="Strikethrough"><span class="material-symbols-outlined" style="margin:0;">strikethrough_s</span></button><button class="btn secondary" type="button" data-cmd="insertUnorderedList" title="Bullet List"><span class="material-symbols-outlined" style="margin:0;">format_list_bulleted</span> <span class="btn-text">List</span></button><button class="btn secondary" type="button" data-cmd="insertOrderedList" title="Numbered List"><span class="material-symbols-outlined" style="margin:0;">format_list_numbered</span> <span class="btn-text">Num List</span></button><button class="btn secondary" type="button" data-cmd="insertCheckbox" title="Insert Checkbox"><span class="material-symbols-outlined" style="margin:0;">check_box</span> <span class="btn-text">Checkbox</span></button><div style="width: 1px; height: 20px; background: var(--outline-2); margin: 0 4px;"></div><button class="btn secondary" type="button" data-cmd="outdent" title="Outdent"><span class="material-symbols-outlined" style="margin:0;">format_indent_decrease</span></button><button class="btn secondary" type="button" data-cmd="indent" title="Indent"><span class="material-symbols-outlined" style="margin:0;">format_indent_increase</span></button><div style="width: 1px; height: 20px; background: var(--outline-2); margin: 0 4px;"></div><button class="btn secondary" type="button" data-cmd="createLink" title="Insert Link"><span class="material-symbols-outlined" style="margin:0;">link</span></button><button class="btn secondary" type="button" data-cmd="insertTable" title="Insert Table"><span class="material-symbols-outlined" style="margin:0;">table_chart</span></button><div style="width: 1px; height: 20px; background: var(--outline-2); margin: 0 4px;"></div><button class="btn secondary action-btn" type="button" data-createfile="${sc.id}" title="Create Text/XML File"><span class="material-symbols-outlined" style="font-size: 16px;">note_add</span> <span class="btn-text">New File</span></button><button class="btn secondary action-btn" type="button" data-attach="${sc.id}" title="Attach File"><span class="material-symbols-outlined" style="font-size: 16px;">attach_file</span> <span class="btn-text">Attach</span></button><button class="btn secondary" type="button" data-cmd="closeKeyboard" title="Close Keyboard"><span class="material-symbols-outlined" style="margin:0; font-size: 20px;">keyboard_hide</span></button></div><div class="evidence" contenteditable="${isLocked ? 'false' : 'true'}" data-evidence="${sc.id}" spellcheck="false"></div><input type="file" hidden data-file="${sc.id}" /></div>${dateHtml}</div>`;

        const evidence = d.querySelector(`[data-evidence="${sc.id}"]`);
        evidence.innerHTML = sc.evidenceHtml || "";

        let htmlUpdated = false;
        evidence.querySelectorAll('.attachment').forEach(att => {
            if(!att.querySelector('.copy-att')) {
                const link = att.querySelector('a');
                if(link && link.dataset.dataurl) {
                    const copyBtn = document.createElement("span");
                    copyBtn.className = "copy-att material-symbols-outlined"; copyBtn.textContent = "content_copy"; 
                    copyBtn.title = "Copy content"; copyBtn.dataset.copy = link.dataset.dataurl; copyBtn.contentEditable = "false";
                    att.appendChild(copyBtn); htmlUpdated = true;
                }
            }
        });
        if (htmlUpdated) sc.evidenceHtml = evidence.innerHTML; 
        return d;
    }

    async updateTagsOnly() {
        const activeTabId = this.vm.activeTabId; if (!activeTabId) return;
        let scenarios = [];
        if (activeTabId === 'search_results' && this.vm.temporarySearchTab) {
            scenarios = this.vm.temporarySearchTab.scenarios;
        } else {
            scenarios = await dbService.getItemsByTab(activeTabId);
        }

        const panels = [...document.querySelectorAll(".tab-panel")];
        panels.forEach(panel => {
            const cards = [...panel.querySelectorAll("details.scenario")];
            cards.forEach((card) => {
                const sid = card.dataset.sid; const sc = scenarios.find(s => s.id === sid); if(!sc) return;
                const tagsContainer = card.querySelector(".summary-tags") || card.querySelector(".summary-sub");
                const validFields = (sc.fields || []).filter(f => f.key.trim() || f.val.trim());
                if(validFields.length > 0) {
                    const tagsHtml = validFields.map(f => `<span class="tag"><b>${escapeHtml(f.key || "Field")}:</b> ${escapeHtml(f.val || "-")}</span>`).join("");
                    if(!tagsContainer || tagsContainer.className === "summary-sub") { card.querySelector('.summary-content').innerHTML += `<div class="summary-tags">${tagsHtml}</div>`; } else { tagsContainer.innerHTML = tagsHtml; }
                } else { if(tagsContainer && tagsContainer.className === "summary-tags") { tagsContainer.remove(); } }
            });
        });
    }
}