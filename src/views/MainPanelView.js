import { escapeHtml, escapeAttr } from '../utils/dom.js';
import { globalEvents } from '../core/PubSub.js';

export class MainPanelView {
    constructor(vm) {
        this.vm = vm;
        this.tabsEl = document.getElementById("tabs");
        this.panelEl = document.getElementById("panel");
        this.draggedTabIdx = null;

        this.bindEvents();

        globalEvents.subscribe('workspaces:changed', () => this.render());
        globalEvents.subscribe('workspace:selected', () => this.render());
        globalEvents.subscribe('tabs:changed', () => this.renderTabs());
        globalEvents.subscribe('scenarios:changed', () => this.renderPanel());
        globalEvents.subscribe('tags:updated', () => this.updateTagsOnly());
    }

    bindEvents() {
        document.body.addEventListener("click", (e) => {
            const addBtn = e.target.closest("#addScenarioBtn");
            if (addBtn) {
                const newId = this.vm.addScenario();
                if (newId) {
                    setTimeout(() => { 
                        const inp = document.querySelector(`input[data-sid="${newId}"][data-field="name"]`); 
                        if (inp) { inp.focus(); inp.select(); } 
                    }, 50);
                }
            }

            const toggleAllBtn = e.target.closest("#toggleAllBtn");
            if (toggleAllBtn) {
                this.vm.toggleAllScenarios();
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
                    if (window.promptDialog) window.promptDialog("Rename tab", tab.name, "Give this tab a short name.", (val) => { this.vm.renameTab(tab.id, val); });
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
            if(newScenId) setTimeout(() => { const inp = document.querySelector(`input[data-sid="${newScenId}"][data-field="name"]`); if (inp) { inp.focus(); inp.select(); } }, 50);
        });
        this.tabsEl.appendChild(plus);
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

        d.innerHTML = `<summary><div class="summary-content"><div style="display:flex; align-items:center; gap:6px; width: 100%;"><span class="material-symbols-outlined" style="font-size: 18px; cursor: grab; color: var(--muted);" onmousedown="this.closest('details').draggable=true" onmouseup="this.closest('details').draggable=false" onmouseleave="this.closest('details').draggable=false">drag_indicator</span><input class="header-name-input" data-field="name" data-sid="${sc.id}" value="${escapeAttr(sc.name||"")}" placeholder="Item ${idx+1}" onclick="event.stopPropagation()" /></div>${tagsHtml ? `<div class="summary-tags">${tagsHtml}</div>` : ``}</div><div class="summary-actions"><div class="scen-more-wrap"><button class="btn secondary action-btn icon-only scen-more-btn" type="button" title="More Actions"><span class="material-symbols-outlined">more_vert</span></button><div class="scen-more-menu"><button class="btn secondary action-btn" type="button" title="Save as Template" data-template="${sc.id}"><span class="material-symbols-outlined">bookmark_add</span> <span class="btn-text">Save Template</span></button><button class="btn secondary action-btn" type="button" title="Duplicate Item" data-duplicate="${sc.id}"><span class="material-symbols-outlined">content_copy</span> <span class="btn-text">Duplicate</span></button><button class="btn secondary action-btn" type="button" title="Move Item" data-move="${sc.id}"><span class="material-symbols-outlined">move_item</span> <span class="btn-text">Move</span></button><button class="btn danger action-btn" type="button" title="Delete Item" data-delete="${sc.id}"><span class="material-symbols-outlined">delete</span> <span class="btn-text">Delete Item</span></button></div></div><div class="chev"><span class="material-symbols-outlined">expand_more</span></div></div></summary><div class="card-body"><div class="label"><span class="material-symbols-outlined" style="font-size: 14px;">tune</span> Properties</div><div class="field-list">${fieldsHtml}<div><button class="btn secondary action-btn" type="button" data-addfield="${sc.id}" style="font-size: 12px; padding: 6px 12px;"><span class="material-symbols-outlined">add</span> Add Field</button></div></div><div class="evidence-wrap"><div class="label" style="margin-bottom: 6px;"><span class="material-symbols-outlined" style="font-size: 14px;">image</span> Notes & Media</div><div class="wysiwyg-toolbar action-btn"><button class="btn secondary" type="button" data-cmd="bold" title="Bold"><span class="material-symbols-outlined" style="margin:0;">format_bold</span></button><button class="btn secondary" type="button" data-cmd="italic" title="Italic"><span class="material-symbols-outlined" style="margin:0;">format_italic</span></button><button class="btn secondary" type="button" data-cmd="insertUnorderedList" title="Bullet List"><span class="material-symbols-outlined" style="margin:0;">format_list_bulleted</span> <span class="btn-text">List</span></button><button class="btn secondary" type="button" data-cmd="createLink" title="Insert Link"><span class="material-symbols-outlined" style="margin:0;">link</span></button><div style="width: 1px; height: 20px; background: var(--outline-2); margin: 0 4px;"></div><button class="btn secondary action-btn" type="button" data-createfile="${sc.id}" title="Create Text/XML File"><span class="material-symbols-outlined" style="font-size: 16px;">note_add</span> <span class="btn-text">New File</span></button><button class="btn secondary action-btn" type="button" data-attach="${sc.id}" title="Attach File"><span class="material-symbols-outlined" style="font-size: 16px;">attach_file</span> <span class="btn-text">Attach</span></button></div><div class="evidence" contenteditable="true" data-evidence="${sc.id}" spellcheck="false"></div><div class="hint"><span class="material-symbols-outlined" style="font-size: 14px;">info</span> Paste screenshots (Ctrl+V) or use the toolbar to format. Double-click images to view full size.</div><input type="file" hidden data-file="${sc.id}" /></div></div>`;

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