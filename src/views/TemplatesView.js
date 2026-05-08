import { escapeHtml, uid } from '../utils/dom.js';

export class TemplatesView {
    constructor(vm) {
        this.vm = vm;
        this.tplOpenBtn = document.getElementById("tplOpenBtn");
        this.tplBackdrop = document.getElementById("tplBackdrop");
        this.tplCloseBtn = document.getElementById("tplCloseBtn");
        this.tplListEl = document.getElementById("tplList");
        this.tplExportTrigger = document.getElementById("tplExportTrigger");
        this.tplImportTrigger = document.getElementById("tplImportTrigger");
        this.tplImportFile = document.getElementById("tplImportFile");

        this.bindEvents();
    }

    bindEvents() {
        this.tplOpenBtn?.addEventListener("click", () => { document.body.classList.remove("sidebar-show"); this.render(); if(this.tplBackdrop) this.tplBackdrop.style.display = "flex"; });
        this.tplCloseBtn?.addEventListener("click", () => { if(this.tplBackdrop) this.tplBackdrop.style.display = "none"; });
        if(this.tplBackdrop) this.tplBackdrop.addEventListener("click", (e) => { if(e.target === this.tplBackdrop) this.tplBackdrop.style.display = "none"; });

        document.addEventListener('click', async (e) => {
            const tplBtn = e.target.closest("[data-template]");
            if (tplBtn) {
                const sc = this.vm.getScenarioById(tplBtn.dataset.template);
                if (sc) {
                    const name = await window.appPrompt("Name your template:", (sc.name || "Item") + " Template", "Save Template");
                    if(!name) return;
                    this.vm.addTemplate(name, sc);
                }
            }
        });

        this.tplListEl?.addEventListener("click", (e) => {
            const useBtn = e.target.closest("[data-use-tpl]");
            if (useBtn) { this.vm.useTemplate(useBtn.dataset.useTpl); if(this.tplBackdrop) this.tplBackdrop.style.display = "none"; return; }
            
            const delBtn = e.target.closest("[data-del-tpl]");
            if (delBtn) { this.vm.deleteTemplate(delBtn.dataset.delTpl); this.render(); }
        });

        this.tplExportTrigger?.addEventListener("click", () => {
            const blob = new Blob([JSON.stringify(this.vm.getTemplates())], {type:"application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "item_templates.json";
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        });

        this.tplImportTrigger?.addEventListener("click", () => this.tplImportFile?.click());
        this.tplImportFile?.addEventListener("change", (e) => {
            const file = e.target.files[0]; if(!file) return;
            const r = new FileReader();
            r.onload = (event) => {
                try {
                    const loaded = JSON.parse(event.target.result);
                    if(Array.isArray(loaded)) { loaded.forEach(l => { l.id = uid(); this.vm.templates.push(l); }); this.vm.saveTemplates(); this.render(); window.appAlert("Templates imported successfully!"); }
                } catch(err) { window.appAlert("Invalid template JSON file."); }
            };
            r.readAsText(file); e.target.value = '';
        });
    }

    render() {
        if (!this.tplListEl) return;
        this.tplListEl.innerHTML = '';
        const templates = this.vm.getTemplates();
        if(templates.length === 0) { this.tplListEl.innerHTML = '<div style="color:var(--muted); font-style:italic; padding: 10px;">No templates saved. Save one from an item card header!</div>'; return; }
        
        templates.forEach(t => {
            const div = document.createElement("div"); div.className = "tpl-item";
            div.innerHTML = `<div><div class="tpl-name">${escapeHtml(t.name)}</div><div class="tpl-meta">${t.data.fields.length} Fields • ${t.data.evidenceHtml ? "Has Content" : "No Content"}</div></div>
                <div style="display:flex; gap:6px;"><button class="btn secondary" style="padding:6px 10px; font-size:12px;" data-use-tpl="${t.id}">Use Template</button><button class="btn danger icon-only" data-del-tpl="${t.id}"><span class="material-symbols-outlined">delete</span></button></div>`;
            this.tplListEl.appendChild(div);
        });
    }
}