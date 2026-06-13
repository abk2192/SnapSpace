import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';
import { dbService } from '../services/Database.js';

export class SidebarVM {
    get workspaces() {
        return store.state ? store.state.workspaces : [];
    }

    get activeId() {
        return store.state ? store.state.activeWorkspaceId : null;
    }

    async addWorkspace() {
        const newId = uid(); 
        const newTabId = uid();
        const newScenId = uid();
        const now = Date.now();
        const dateStr = new Date().toISOString().split('T')[0];
        
        const newWs = {
            id: newId, title: "New Project", activeTabId: newTabId,
            tabs: [{ id: newTabId, name: "Tab 1", scenarios: [{ id: newScenId, name:`Note ${dateStr} 1`, noteDate: dateStr, fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now }] }]
        };
        
        await dbService.putProject({ id: newId, title: "New Project", activeTabId: newTabId, createdAt: now, updatedAt: now });
        await dbService.putView({ id: newTabId, projectId: newId, name: "Tab 1", query: `tabId:${newTabId}`, createdAt: now, updatedAt: now });
        await dbService.putItem({
            id: newScenId, 
            projectId: newId, 
            name: `Note ${dateStr} 1`, 
            noteDate: dateStr, 
            fields: [], 
            evidenceHtml: "", 
            isOpen: true, 
            createdAt: now, 
            modifiedAt: now, 
            _tags: [`tabId:${newTabId}`], 
            linkedTo: [], 
            linkedFrom: []
        });

        store.state.workspaces.push(newWs);
        this.setActiveWorkspace(newId);
    }

    async deleteWorkspace(id) {
        const wsTitle = this.workspaces.find(w => w.id === id)?.title || "Project";
        if(await window.appConfirm(`Are you sure you want to delete the project "${wsTitle}"?`)) {
            await dbService.deleteProject(id);
            store.state.workspaces = store.state.workspaces.filter(x => x.id !== id);
            
            if(store.state.activeWorkspaceId === id && store.state.workspaces.length > 0) {
                this.setActiveWorkspace(store.state.workspaces[0].id);
            } else {
                globalEvents.publish('workspaces:changed');
            }
        }
    }

    setActiveWorkspace(id) {
        store.state.activeWorkspaceId = id;
        globalEvents.publish('workspaces:changed');
        globalEvents.publish('workspace:selected'); 
    }

    reorderWorkspaces(draggedId, targetId) {
        if (draggedId && draggedId !== targetId) {
            const fromIdx = store.state.workspaces.findIndex(w => w.id === draggedId);
            const toIdx = store.state.workspaces.findIndex(w => w.id === targetId);
            if(fromIdx >= 0 && toIdx >= 0) {
                const moved = store.state.workspaces.splice(fromIdx, 1)[0];
                store.state.workspaces.splice(toIdx, 0, moved);
                globalEvents.publish('workspaces:changed');
            }
        }
    }
}