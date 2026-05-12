import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';
import { dbService } from '../services/Database.js';

export class TemplatesVM {
    constructor() {
        this.templates = JSON.parse(localStorage.getItem('test_recorder_templates') || '[]');
    }
    
    getTemplates() { return this.templates; }
    
    saveTemplates() { localStorage.setItem('test_recorder_templates', JSON.stringify(this.templates)); }
    
    getScenarioById(sid) {
        if (window.mainPanelVM) {
            const tab = window.mainPanelVM.tabs.find(t => t.scenarios.some(s => s.id === sid));
            if (tab) return tab.scenarios.find(s => s.id === sid);
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
    
    async useTemplate(tplId) {
        const tpl = this.templates.find(x => x.id === tplId);
        if (!tpl) return;
        
        const projectId = store.state.activeWorkspaceId;
        const activeTabId = window.mainPanelVM?.activeTabId;
        
        if (!projectId || !activeTabId || activeTabId === 'dashboard') {
            window.appAlert("Please open a project tab to insert a template.");
            return;
        }
        
        const clone = JSON.parse(JSON.stringify(tpl.data));
        clone.id = uid(); clone.name = clone.name || tpl.name; clone.fields.forEach(f => f.id = uid());
        clone.projectId = projectId;
        clone._tags = [`tabid:${activeTabId}`, ...clone.fields.map(f => (f.key || "").toLowerCase().trim()).filter(Boolean)];
        const now = Date.now(); clone.createdAt = now; clone.modifiedAt = now;
        
        await dbService.putItem(clone);
        globalEvents.publish('store:saved');
        
        if (window.mainPanelVM) await window.mainPanelVM.loadProjectData(false);
    }
}