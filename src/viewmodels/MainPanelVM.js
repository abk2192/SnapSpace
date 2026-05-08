import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';

export class MainPanelVM {
    get activeWorkspace() { return store.state?.workspaces.find(w => w.id === store.state.activeWorkspaceId); }
    get tabs() { return this.activeWorkspace?.tabs || []; }
    get activeTab() { return this.tabs.find(t => t.id === this.activeWorkspace?.activeTabId); }

    updateProjectTitle(title) {
        if (this.activeWorkspace) { this.activeWorkspace.title = title; globalEvents.publish('workspaces:changed'); }
    }

    async resetProject() {
        if(this.activeWorkspace && await window.appConfirm("Are you sure you want to reset the CURRENT project? This will delete all tabs and items inside it.")) {
            const now = Date.now();
            this.activeWorkspace.tabs = [{ id: uid(), name: "Tab 1", scenarios: [{ id: uid(), name:"Item 1", fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now }] }];
            this.activeWorkspace.activeTabId = this.activeWorkspace.tabs[0].id;
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
        }
    }

    setActiveTab(id) {
        if (this.activeWorkspace) {
            this.activeWorkspace.activeTabId = id;
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
        }
    }

    addTab() {
        if (!this.activeWorkspace) return null;
        const name = `Tab ${this.tabs.length + 1}`; 
        const id = uid(); 
        const newScenId = uid();
        const now = Date.now();
        this.activeWorkspace.tabs.push({ id, name, scenarios: [{ id: newScenId, name:"Item 1", fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now }] }); 
        this.activeWorkspace.activeTabId = id; 
        globalEvents.publish('tabs:changed');
        globalEvents.publish('scenarios:changed');
        return newScenId;
    }

    async deleteTab(id) {
        if (!this.activeWorkspace) return;
        const idx = this.tabs.findIndex(t => t.id === id); 
        if (idx < 0) return;
        if(await window.appConfirm("Are you sure you want to delete this tab and all its items?")) {
            this.activeWorkspace.tabs.splice(idx, 1);
            if (this.activeWorkspace.activeTabId === id) { 
                this.activeWorkspace.activeTabId = this.tabs[Math.max(0, idx-1)]?.id || null; 
                if (!this.activeWorkspace.activeTabId) { 
                    this.activeWorkspace.tabs.push({ id: uid(), name: "Tab 1", scenarios: [] }); 
                    this.activeWorkspace.activeTabId = this.tabs[0].id; 
                } 
            }
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
        }
    }

    renameTab(id, newName) {
        const tab = this.tabs.find(t => t.id === id);
        if (tab && newName) { tab.name = newName.trim() || "Untitled"; globalEvents.publish('tabs:changed'); }
    }

    reorderTabs(fromIdx, toIdx) {
        if (fromIdx !== null && fromIdx !== toIdx && this.activeWorkspace) {
            const moved = this.activeWorkspace.tabs.splice(fromIdx, 1)[0];
            this.activeWorkspace.tabs.splice(toIdx, 0, moved);
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
        }
    }

    addScenario() {
        const tab = this.activeTab; if(!tab) return null;
        const newId = uid();
        const defaultName = `Item ${tab.scenarios.length + 1}`;
        const now = Date.now();
        tab.scenarios.unshift({ id: newId, name: defaultName, fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now });
        globalEvents.publish('scenarios:changed');
        return newId;
    }

    reorderScenarios(fromIdx, toIdx) {
        const tab = this.activeTab; if(!tab) return;
        if (!isNaN(fromIdx) && fromIdx !== toIdx) {
            const moved = tab.scenarios.splice(fromIdx, 1)[0];
            tab.scenarios.splice(toIdx, 0, moved);
            globalEvents.publish('scenarios:changed');
        }
    }
    
    toggleAllScenarios() {
        const tab = this.activeTab; if(!tab) return;
        const anyOpen = tab.scenarios.some(sc => sc.isOpen !== false);
        tab.scenarios.forEach(sc => sc.isOpen = !anyOpen);
        globalEvents.publish('scenarios:changed');
    }
    
    duplicateScenario(id) {
        const tab = this.activeTab; if(!tab) return;
        const idx = tab.scenarios.findIndex(s => s.id === id);
        if (idx >= 0) {
            const sc = tab.scenarios[idx];
            const clone = JSON.parse(JSON.stringify(sc));
            clone.id = uid(); clone.name = (clone.name || "Untitled") + " (Copy)";
            clone.fields.forEach(f => f.id = uid());
            const now = Date.now(); clone.createdAt = now; clone.modifiedAt = now;
            tab.scenarios.splice(idx + 1, 0, clone);
            globalEvents.publish('scenarios:changed');
        }
    }
    
    addField(id) {
        const tab = this.activeTab; if(!tab) return;
        const sc = tab.scenarios.find(s => s.id === id);
        if (sc) {
            sc.fields.push({ id: uid(), key: "", val: "" });
            globalEvents.publish('scenarios:changed');
        }
    }
    
    deleteField(scenarioId, fieldId) {
        const tab = this.activeTab; if(!tab) return;
        const sc = tab.scenarios.find(s => s.id === scenarioId);
        if (sc) {
            sc.fields = sc.fields.filter(f => f.id !== fieldId);
            globalEvents.publish('scenarios:changed');
        }
    }

    async deleteScenario(id) {
        const tab = this.activeTab; if(!tab) return;
        if(await window.appConfirm("Are you sure you want to delete this item?")) { 
            tab.scenarios = tab.scenarios.filter(s => s.id !== id); 
            globalEvents.publish('scenarios:changed'); 
        }
    }

    updateScenarioName(sid, name) {
        const tab = this.activeTab; if(!tab) return;
        const sc = tab.scenarios.find(s => s.id === sid);
        if (sc) { sc.name = name; sc.modifiedAt = Date.now(); }
    }

    updateScenarioOpenState(sid, isOpen) {
        const tab = this.activeTab; if(!tab) return;
        const sc = tab.scenarios.find(s => s.id === sid);
        if (sc) sc.isOpen = isOpen; 
    }

    updateFieldKey(sid, fid, key) {
        const tab = this.activeTab; if(!tab) return; const sc = tab.scenarios.find(s => s.id === sid);
        if (sc) { const f = sc.fields.find(f => f.id === fid); if(f) { f.key = key; sc.modifiedAt = Date.now(); globalEvents.publish('tags:updated'); } }
    }

    updateFieldVal(sid, fid, val) {
        const tab = this.activeTab; if(!tab) return; const sc = tab.scenarios.find(s => s.id === sid);
        if (sc) { const f = sc.fields.find(f => f.id === fid); if(f) { f.val = val; sc.modifiedAt = Date.now(); globalEvents.publish('tags:updated'); } }
    }

    updateEvidence(sid, html) {
        const tab = this.activeTab; if(!tab) return; const sc = tab.scenarios.find(s => s.id === sid);
        if (sc) { sc.evidenceHtml = html; sc.modifiedAt = Date.now(); }
    }
}