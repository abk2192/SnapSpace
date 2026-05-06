import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';

export class TemplatesVM {
    constructor() {
        this.templates = JSON.parse(localStorage.getItem('test_recorder_templates') || '[]');
    }
    
    getTemplates() { return this.templates; }
    
    saveTemplates() { localStorage.setItem('test_recorder_templates', JSON.stringify(this.templates)); }
    
    getScenarioById(sid) {
        for (const ws of store.state.workspaces) { 
            for (const t of ws.tabs) { 
                const sc = t.scenarios.find(s => s.id === sid); 
                if (sc) return sc; 
            } 
        } 
        return null; 
    }

    addTemplate(name, scenarioData) {
        const tpl = JSON.parse(JSON.stringify(scenarioData)); 
        delete tpl.id; 
        tpl.fields.forEach(f => delete f.id);
        this.templates.push({ id: uid(), name: name, data: tpl });
        this.saveTemplates();
    }
    
    deleteTemplate(id) {
        this.templates = this.templates.filter(x => x.id !== id);
        this.saveTemplates();
    }
    
    useTemplate(tplId) {
        const tpl = this.templates.find(x => x.id === tplId);
        if (!tpl) return;
        const clone = JSON.parse(JSON.stringify(tpl.data));
        clone.id = uid(); clone.name = clone.name || tpl.name; clone.fields.forEach(f => f.id = uid());
        const now = Date.now(); clone.createdAt = now; clone.modifiedAt = now;
        
        const activeWs = store.state.workspaces.find(w => w.id === store.state.activeWorkspaceId);
        const activeTab = activeWs ? activeWs.tabs.find(t => t.id === activeWs.activeTabId) : null;
        
        if (activeTab) { activeTab.scenarios.unshift(clone); globalEvents.publish('scenarios:changed'); }
    }
}