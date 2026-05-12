import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';
import { dbService } from '../services/Database.js';

export class SidebarVM {
    constructor() {
        this._workspaces = [];
        this.loadWorkspaces();
    }

    get workspaces() {
        return this._workspaces;
    }

    get activeId() {
        return store.state ? store.state.activeWorkspaceId : null;
    }

    async loadWorkspaces() {
        const projects = await dbService.getAllProjects();
        this._workspaces = projects.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        if (this._workspaces.length > 0 && !store.state.activeWorkspaceId) {
            store.state.activeWorkspaceId = this._workspaces[0].id;
        }
        globalEvents.publish('workspaces:changed');
    }

    async addWorkspace() {
        const newId = uid(); 
        const newTabId = uid();
        
        await dbService.putProject({ id: newId, title: "New Project", activeTabId: newTabId, createdAt: Date.now(), updatedAt: Date.now() });
        await dbService.putView({ id: newTabId, projectId: newId, name: "Tab 1", query: `tabId:${newTabId}`, createdAt: Date.now(), updatedAt: Date.now() });
        
        globalEvents.publish('store:saved');
        await this.loadWorkspaces();
        this.setActiveWorkspace(newId);
    }

    async deleteWorkspace(id) {
        const wsTitle = this.workspaces.find(w => w.id === id)?.title || "Project";
        if(confirm(`Are you sure you want to delete the project "${wsTitle}"?`)) {
            await dbService.deleteProject(id);
            globalEvents.publish('store:saved');
            await this.loadWorkspaces();
            
            if(store.state.activeWorkspaceId === id && this._workspaces.length > 0) {
                this.setActiveWorkspace(this._workspaces[0].id);
            }
        }
    }

    setActiveWorkspace(id) {
        store.state.activeWorkspaceId = id;
        // UI Proxy now automatically publishes 'workspace:selected', 
        // but SidebarView depends on 'workspaces:changed' to trigger active styling rendering.
        globalEvents.publish('workspaces:changed');
    }

    async reorderWorkspaces(draggedId, targetId) {
        if (draggedId && draggedId !== targetId) {
            const fromIdx = this._workspaces.findIndex(w => w.id === draggedId);
            const toIdx = this._workspaces.findIndex(w => w.id === targetId);
            if(fromIdx >= 0 && toIdx >= 0) {
                const moved = this._workspaces.splice(fromIdx, 1)[0];
                this._workspaces.splice(toIdx, 0, moved);
                
                this._workspaces.forEach((w, idx) => {
                    w.order = idx;
                    dbService.putProject(w);
                });
                
                globalEvents.publish('workspaces:changed');
            }
        }
    }

    async updateProjectTitle(id, title) {
        const ws = this.workspaces.find(w => w.id === id);
        if (ws) {
            ws.title = title;
            ws.updatedAt = Date.now();
            await dbService.putProject(ws);
            globalEvents.publish('store:saved');
            await this.loadWorkspaces();
        }
    }
}