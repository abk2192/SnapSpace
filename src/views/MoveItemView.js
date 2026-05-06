import { escapeHtml } from '../utils/dom.js';

export class MoveItemView {
    constructor(vm) {
        this.vm = vm;
        this.moveBackdrop = document.getElementById("moveBackdrop");
        this.moveSelect = document.getElementById("moveSelect");
        this.moveCancelBtn = document.getElementById("moveCancelBtn");
        this.moveConfirmBtn = document.getElementById("moveConfirmBtn");
        this.scenarioToMoveId = null;
        this.lastMoveStructureHash = null;
        this.bindEvents();
    }
    
    bindEvents() {
        document.addEventListener('click', (e) => { const mBtn = e.target.closest("[data-move]"); if (mBtn) this.open(mBtn.dataset.move); });
        this.moveCancelBtn?.addEventListener("click", () => { if(this.moveBackdrop) this.moveBackdrop.style.display = 'none'; this.scenarioToMoveId = null; });
        if(this.moveBackdrop) this.moveBackdrop.addEventListener("click", (e) => { if(e.target === this.moveBackdrop) this.moveCancelBtn?.click(); });
        
        this.moveConfirmBtn?.addEventListener("click", () => {
            const val = this.moveSelect?.value; if(!this.scenarioToMoveId || !val) return;
            const [destWsId, destTabId] = val.split('|');
            this.vm.moveItem(this.scenarioToMoveId, destWsId, destTabId);
            if(this.moveBackdrop) this.moveBackdrop.style.display = 'none'; this.scenarioToMoveId = null;
        });
    }

    open(sid) {
        const currentHash = this.vm.getTreeHash();
        if (this.lastMoveStructureHash !== currentHash) {
            this.moveSelect.innerHTML = this.vm.workspaces.map(ws => { return `<optgroup label="${escapeHtml(ws.title || 'Untitled')}">` + ws.tabs.map(t => `<option value="${ws.id}|${t.id}">${escapeHtml(t.name)}</option>`).join('') + `</optgroup>`; }).join('');
            this.lastMoveStructureHash = currentHash;
        }
        this.scenarioToMoveId = sid;
        if(this.moveBackdrop) this.moveBackdrop.style.display = 'flex';
    }
}