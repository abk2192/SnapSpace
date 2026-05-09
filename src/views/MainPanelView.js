import { escapeHtml, escapeAttr } from '../utils/dom.js';
import { globalEvents } from '../core/PubSub.js';
import { dialogService } from '../services/DialogService.js';

export class MainPanelView {
    constructor(vm) {
        this.vm = vm;
        this.tabsEl = document.getElementById("tabs");
        this.panelEl = document.getElementById("panel");
        this.draggedTabIdx = null;

        this.bindEvents();
        globalEvents.subscribe('workspaces:changed', () => this.render());
        globalEvents.subscribe('workspace:selected', () => {
            const wsTitleInput = document.getElementById("workspaceTitleInput");
            if (wsTitleInput && this.vm.activeWorkspace) wsTitleInput.value = this.vm.activeWorkspace.title || "Project";
            this.render();
        });
        globalEvents.subscribe('tabs:changed', () => this.renderTabs());
        globalEvents.subscribe('scenarios:changed', () => this.renderPanel());
        globalEvents.subscribe('tags:updated', () => this.updateTagsOnly());
    }

    bindEvents() {
        const wsTitleInput = document.getElementById("workspaceTitleInput");
        wsTitleInput?.addEventListener("input", (e) => this.vm.updateProjectTitle(e.target.value));

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

            const toggleEditBtn = e.target.closest("#toggleEditBtn");
            if (toggleEditBtn) {
                document.body.classList.toggle("readonly");
                const isLocked = document.body.classList.contains("readonly");
                toggleEditBtn.innerHTML = `<span class="material-symbols-outlined">${isLocked ? 'lock' : 'lock_open'}</span> <span class="btn-text">${isLocked ? 'Unlock Mode' : 'Read-Only Mode'}</span>`;
                toggleEditBtn.title = isLocked ? "Unlock (Edit Mode)" : "Lock (Read-Only Mode)";
                document.querySelectorAll('.evidence').forEach(el => el.setAttribute('contenteditable', isLocked ? 'false' : 'true'));
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
                this.vm.addField(addFBtn.dataset.addfield); 
                setTimeout(() => { const inputs = document.querySelectorAll(`input[data-sid="${addFBtn.dataset.addfield}"][data-fkey]`); if(inputs.length > 0) inputs[inputs.length - 1].focus(); }, 50);
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
            if (e.target.matches("details.scenario") && e.target.isConnected) this.vm.updateScenarioOpenState(e.target.dataset.sid, e.target.open);
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
                const tabs = this.vm.tabs;
                if (!tabs || tabs.length <= 1) return;
                const activeId = this.vm.activeTab?.id;
                const currentIndex = tabs.findIndex(t => t.id === activeId);
                
                if (xDiff > 0) { // Swiped left -> Next tab
                    if (currentIndex < tabs.length - 1) this.vm.setActiveTab(tabs[currentIndex + 1].id);
                } else { // Swiped right -> Previous tab
                    if (currentIndex > 0) this.vm.setActiveTab(tabs[currentIndex - 1].id);
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
    }

    render() {
        this.renderTabs();
        this.renderPanel();
    }

    renderTabs() {
        if(!this.tabsEl) return;
        this.tabsEl.innerHTML = "";
        const tabs = this.vm.tabs;
        const activeTabId = this.vm.activeTab?.id;

        tabs.forEach((tab, index) => {
            const btn = document.createElement("button");
            btn.className = "tab" + (tab.id === activeTabId ? " active" : "");
            btn.type = "button";
            
            let finalHtml = `
            <span class="tab-name-wrapper">
                <span class="tab-label" title="${escapeAttr(tab.name)}">${escapeHtml(tab.name)}</span>
                <span class="tab-count">${tab.scenarios.length}</span>
            </span>
            `;
            if (tabs.length > 1) { finalHtml += `<span class="x" title="Close tab" data-close-tab="${tab.id}">×</span>`; }
            btn.innerHTML = finalHtml;

            btn.draggable = true;
            btn.ondragstart = (e) => { this.draggedTabIdx = index; e.dataTransfer.effectAllowed = 'move'; setTimeout(()=>btn.classList.add('dragging'), 0); };
            btn.ondragend = () => { this.draggedTabIdx = null; btn.classList.remove('dragging'); };
            btn.ondragover = (e) => { e.preventDefault(); btn.classList.add('drag-over'); };
            btn.ondragleave = () => { btn.classList.remove('drag-over'); };
            btn.ondrop = (e) => { e.preventDefault(); btn.classList.remove('drag-over'); this.vm.reorderTabs(this.draggedTabIdx, index); };

            btn.addEventListener("click", (e) => {
                const close = e.target.closest("[data-close-tab]");
                if (close){ e.stopPropagation(); this.vm.deleteTab(close.getAttribute("data-close-tab")); return; }
                if (tab.id === activeTabId) {
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
                this.vm.setActiveTab(tab.id);
            });
            this.tabsEl.appendChild(btn);
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
        this.tabsEl.appendChild(plus);

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

    renderPanel() {
        if(!this.tabsEl || !this.panelEl) return;
        this.panelEl.innerHTML = "";
        const tabs = this.vm.tabs;
        const activeTabId = this.vm.activeTab?.id;

        tabs.forEach(tab => {
            const wrap = document.createElement("div"); wrap.className = "tab-panel";
            if (tab.id === activeTabId) wrap.style.display = "block";
            tab.scenarios.forEach((sc, idx) => { wrap.appendChild(this.renderScenarioCard(sc, idx)); });
            this.panelEl.appendChild(wrap);
        });
        
        const pMeta = document.getElementById("panelMeta"); if (pMeta) pMeta.style.display = "none";

        const active = this.vm.activeTab; const toggleAllBtn = document.getElementById('toggleAllBtn');
        if (toggleAllBtn && active) {
            const anyOpen = active.scenarios.some(sc => sc.isOpen !== false);
            toggleAllBtn.innerHTML = `<span class="material-symbols-outlined">${anyOpen ? 'unfold_less' : 'unfold_more'}</span>`;
            toggleAllBtn.title = anyOpen ? 'Collapse All' : 'Expand All';
        }
    }

    renderScenarioCard(sc, idx) {
        const isLocked = document.body.classList.contains('readonly');
        const d = document.createElement("details");
        d.className = "scenario"; d.dataset.sid = sc.id; d.open = sc.isOpen !== false; d.draggable = false; 
        
        d.ondragstart = (e) => { e.dataTransfer.setData('text/plain', idx); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => d.classList.add('dragging'), 0); };
        d.ondragend = () => { d.classList.remove('dragging'); d.draggable = false; };
        d.ondragover = (e) => { e.preventDefault(); d.classList.add('drag-over-scenario'); };
        d.ondragleave = () => { d.classList.remove('drag-over-scenario'); };
        d.ondrop = (e) => { e.preventDefault(); d.classList.remove('drag-over-scenario'); d.draggable = false; const fromIdx = parseInt(e.dataTransfer.getData('text/plain')); this.vm.reorderScenarios(fromIdx, idx); };

        const validFields = (sc.fields || []).filter(f => f.key.trim() || f.val.trim());
        const tagsHtml = validFields.map(f => `<span class="tag"><b>${escapeHtml(f.key || "Field")}:</b> ${escapeHtml(f.val || "-")}</span>`).join("");

        const fieldsHtml = (sc.fields || []).map(f => `
            <div class="field-row">
            <input class="input" data-fkey="${f.id}" data-sid="${sc.id}" value="${escapeAttr(f.key)}" placeholder="Field Name (e.g., Env, Policy)" />
            <input class="input" data-fval="${f.id}" data-sid="${sc.id}" value="${escapeAttr(f.val)}" placeholder="Value" />
            <button class="btn secondary del action-btn icon-only" type="button" data-delfield="${f.id}" data-sid="${sc.id}"><span class="material-symbols-outlined">close</span></button>
            </div>
        `).join("");

        d.innerHTML = `<summary><div class="summary-content"><div style="display:flex; align-items:center; gap:6px; width: 100%;"><span class="drag-handle material-symbols-outlined" style="font-size: 18px; cursor: grab; color: var(--muted);" onmousedown="this.closest('details').draggable=true" onmouseup="this.closest('details').draggable=false" onmouseleave="this.closest('details').draggable=false">drag_indicator</span><input class="header-name-input" data-field="name" data-sid="${sc.id}" value="${escapeAttr(sc.name||"")}" placeholder="Item ${idx+1}" readonly /><button class="btn secondary action-btn icon-only edit-name-btn" type="button" title="Edit Name"><span class="material-symbols-outlined">edit</span></button></div>${tagsHtml ? `<div class="summary-tags">${tagsHtml}</div>` : ``}</div><div class="summary-actions"><div class="scen-more-wrap"><button class="btn secondary action-btn icon-only scen-more-btn" type="button" title="More Actions"><span class="material-symbols-outlined">more_vert</span></button><div class="scen-more-menu"><button class="btn secondary action-btn" type="button" title="Edit Name" data-edit-name="${sc.id}"><span class="material-symbols-outlined">edit</span> <span class="btn-text">Edit Name</span></button><button class="btn secondary action-btn" type="button" title="Save as Template" data-template="${sc.id}"><span class="material-symbols-outlined">bookmark_add</span> <span class="btn-text">Save Template</span></button><button class="btn secondary action-btn" type="button" title="Duplicate Item" data-duplicate="${sc.id}"><span class="material-symbols-outlined">content_copy</span> <span class="btn-text">Duplicate</span></button><button class="btn secondary action-btn" type="button" title="Move Item" data-move="${sc.id}"><span class="material-symbols-outlined">move_item</span> <span class="btn-text">Move</span></button><button class="btn danger action-btn" type="button" title="Delete Item" data-delete="${sc.id}"><span class="material-symbols-outlined">delete</span> <span class="btn-text">Delete Item</span></button></div></div><div class="chev"><span class="material-symbols-outlined">expand_more</span></div></div></summary><div class="card-body"><div class="label" style="justify-content: space-between;"><span style="display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size: 14px;">tune</span> Properties</span><button class="btn secondary action-btn icon-only" type="button" data-addfield="${sc.id}" style="padding: 2px; min-height: auto; border: none; background: transparent; color: var(--primary); box-shadow: none;" title="Add Property Field"><span class="material-symbols-outlined" style="font-size: 18px;">add_circle</span></button></div><div class="field-list">${fieldsHtml}</div><div class="evidence-wrap"><div class="label" style="margin-bottom: 6px;"><span class="material-symbols-outlined" style="font-size: 14px;">image</span> Notes & Media</div><div class="tbl-controls tbl-row-controls"><button class="tbl-btn tbl-add-row" data-cmd="tableAddRow" title="Add Row Below"><span class="material-symbols-outlined">add</span></button><div class="tbl-divider"></div><button class="tbl-btn tbl-del-row" data-cmd="tableDelRow" title="Delete Row"><span class="material-symbols-outlined">remove</span></button></div><div class="tbl-controls tbl-col-controls"><button class="tbl-btn tbl-add-col" data-cmd="tableAddCol" title="Add Column Right"><span class="material-symbols-outlined">add</span></button><div class="tbl-divider"></div><button class="tbl-btn tbl-del-col" data-cmd="tableDelCol" title="Delete Column"><span class="material-symbols-outlined">remove</span></button></div><div class="wysiwyg-toolbar action-btn"><button class="btn secondary" type="button" data-cmd="bold" title="Bold"><span class="material-symbols-outlined" style="margin:0;">format_bold</span></button><button class="btn secondary" type="button" data-cmd="italic" title="Italic"><span class="material-symbols-outlined" style="margin:0;">format_italic</span></button><button class="btn secondary" type="button" data-cmd="strikeThrough" title="Strikethrough"><span class="material-symbols-outlined" style="margin:0;">strikethrough_s</span></button><button class="btn secondary" type="button" data-cmd="insertUnorderedList" title="Bullet List"><span class="material-symbols-outlined" style="margin:0;">format_list_bulleted</span> <span class="btn-text">List</span></button><button class="btn secondary" type="button" data-cmd="insertOrderedList" title="Numbered List"><span class="material-symbols-outlined" style="margin:0;">format_list_numbered</span> <span class="btn-text">Num List</span></button><button class="btn secondary" type="button" data-cmd="insertCheckbox" title="Insert Checkbox"><span class="material-symbols-outlined" style="margin:0;">check_box</span> <span class="btn-text">Checkbox</span></button><div style="width: 1px; height: 20px; background: var(--outline-2); margin: 0 4px;"></div><button class="btn secondary" type="button" data-cmd="outdent" title="Outdent"><span class="material-symbols-outlined" style="margin:0;">format_indent_decrease</span></button><button class="btn secondary" type="button" data-cmd="indent" title="Indent"><span class="material-symbols-outlined" style="margin:0;">format_indent_increase</span></button><div style="width: 1px; height: 20px; background: var(--outline-2); margin: 0 4px;"></div><button class="btn secondary" type="button" data-cmd="createLink" title="Insert Link"><span class="material-symbols-outlined" style="margin:0;">link</span></button><button class="btn secondary" type="button" data-cmd="insertTable" title="Insert Table"><span class="material-symbols-outlined" style="margin:0;">table_chart</span></button><div style="width: 1px; height: 20px; background: var(--outline-2); margin: 0 4px;"></div><button class="btn secondary action-btn" type="button" data-createfile="${sc.id}" title="Create Text/XML File"><span class="material-symbols-outlined" style="font-size: 16px;">note_add</span> <span class="btn-text">New File</span></button><button class="btn secondary action-btn" type="button" data-attach="${sc.id}" title="Attach File"><span class="material-symbols-outlined" style="font-size: 16px;">attach_file</span> <span class="btn-text">Attach</span></button><button class="btn secondary" type="button" data-cmd="closeKeyboard" title="Close Keyboard"><span class="material-symbols-outlined" style="margin:0; font-size: 20px;">keyboard_hide</span></button></div><div class="evidence" contenteditable="${isLocked ? 'false' : 'true'}" data-evidence="${sc.id}" spellcheck="false"></div><input type="file" hidden data-file="${sc.id}" /></div></div>`;

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

    updateTagsOnly() {
        const tab = this.vm.activeTab; if (!tab) return;
        const panels = [...document.querySelectorAll(".tab-panel")];
        panels.forEach(panel => {
            const cards = [...panel.querySelectorAll("details.scenario")];
            cards.forEach((card, idx) => {
                const sid = card.dataset.sid; const sc = tab.scenarios.find(s => s.id === sid); if(!sc) return;
                const tagsContainer = card.querySelector(".summary-tags") || card.querySelector(".summary-sub");
                const validFields = sc.fields.filter(f => f.key.trim() || f.val.trim());
                if(validFields.length > 0) {
                    const tagsHtml = validFields.map(f => `<span class="tag"><b>${escapeHtml(f.key || "Field")}:</b> ${escapeHtml(f.val || "-")}</span>`).join("");
                    if(!tagsContainer || tagsContainer.className === "summary-sub") { card.querySelector('.summary-content').innerHTML += `<div class="summary-tags">${tagsHtml}</div>`; } else { tagsContainer.innerHTML = tagsHtml; }
                } else { if(tagsContainer && tagsContainer.className === "summary-tags") { tagsContainer.remove(); } }
            });
        });
    }
}