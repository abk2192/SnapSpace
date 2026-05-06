import { escapeHtml } from '../utils/dom.js';

export class CompareView {
    constructor(vm) {
        this.vm = vm;
        this.compareBtn = document.getElementById("compareBtn");
        this.compBackdrop = document.getElementById("compareBackdrop");
        this.compCloseBtn = document.getElementById("compCloseBtn");
        
        this.leftTab = document.getElementById("compLeftTab");
        this.leftScen = document.getElementById("compLeftScen");
        this.leftEv = document.getElementById("compLeftEv");
        
        this.rightTab = document.getElementById("compRightTab");
        this.rightScen = document.getElementById("compRightScen");
        this.rightEv = document.getElementById("compRightEv");
        
        this.compSync = document.getElementById('compSync');
        
        this.lastCompStructureHash = null;
        this.isSyncingLeft = false;
        this.isSyncingRight = false;

        this.bindEvents();
    }

    bindEvents() {
        this.compareBtn?.addEventListener('click', () => {
            document.body.classList.remove("sidebar-show");
            this.populateSelects();
            if(this.vm.getTabs().length > 0) {
                this.renderEv(this.leftScen, this.leftEv);
                this.renderEv(this.rightScen, this.rightEv);
            }
            if(this.compBackdrop) this.compBackdrop.style.display = 'flex';
        });

        this.compCloseBtn?.addEventListener('click', () => {
            if(this.compBackdrop) this.compBackdrop.style.display = 'none';
        });

        this.leftTab?.addEventListener('change', () => { this.updateScenarios(this.leftTab, this.leftScen); this.renderEv(this.leftScen, this.leftEv); });
        this.leftScen?.addEventListener('change', () => { this.renderEv(this.leftScen, this.leftEv); });

        this.rightTab?.addEventListener('change', () => { this.updateScenarios(this.rightTab, this.rightScen); this.renderEv(this.rightScen, this.rightEv); });
        this.rightScen?.addEventListener('change', () => { this.renderEv(this.rightScen, this.rightEv); });

        this.leftEv?.addEventListener('scroll', () => {
            if(!this.compSync?.checked || this.isSyncingLeft) { this.isSyncingLeft = false; return; }
            this.isSyncingRight = true;
            const percentage = this.leftEv.scrollTop / (this.leftEv.scrollHeight - this.leftEv.clientHeight || 1);
            if(this.rightEv) this.rightEv.scrollTop = percentage * (this.rightEv.scrollHeight - this.rightEv.clientHeight);
        });

        this.rightEv?.addEventListener('scroll', () => {
            if(!this.compSync?.checked || this.isSyncingRight) { this.isSyncingRight = false; return; }
            this.isSyncingLeft = true;
            const percentage = this.rightEv.scrollTop / (this.rightEv.scrollHeight - this.rightEv.clientHeight || 1);
            if(this.leftEv) this.leftEv.scrollTop = percentage * (this.leftEv.scrollHeight - this.leftEv.clientHeight);
        });
    }

    populateSelects() {
        const currentHash = this.vm.generateFingerprint();
        if (this.lastCompStructureHash !== currentHash) {
            let optionsHtml = '';
            this.vm.getTabs().forEach((t, idx) => { optionsHtml += `<option value="${t.id}">${escapeHtml(t.name || `Tab ${idx+1}`)}</option>`; });
            
            if (this.leftTab) this.leftTab.innerHTML = optionsHtml;
            if (this.rightTab) this.rightTab.innerHTML = optionsHtml;
            
            this.updateScenarios(this.leftTab, this.leftScen); this.updateScenarios(this.rightTab, this.rightScen);
            this.lastCompStructureHash = currentHash;
        }
    }

    updateScenarios(tabSelect, scenSelect) {
        if (!tabSelect || !scenSelect) return;
        const scenarios = this.vm.getScenariosForTab(tabSelect.value);
        scenSelect.innerHTML = '';
        scenarios.forEach((sc, idx) => { scenSelect.innerHTML += `<option value="${sc.id}">${escapeHtml((sc.name || "").trim() || `Item ${idx+1}`)}</option>`; });
    }

    renderEv(scenSelect, evDiv) {
        if (!scenSelect || !evDiv) return;
        const html = this.vm.getEvidenceHtml(scenSelect.value);
        evDiv.innerHTML = html !== null ? html : '<div style="color:var(--muted); font-style:italic;">No content found.</div>';
    }
}