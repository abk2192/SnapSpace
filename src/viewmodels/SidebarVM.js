import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';

export class SidebarVM {
    get workspaces() {
        return store.state ? store.state.workspaces : [];
    }

    get activeId() {
        return store.state ? store.state.activeWorkspaceId : null;
    }

    addWorkspace() {
        const newId = uid(); 
        const newTabId = uid();
        const newWs = {
            id: newId, title: "New Project", activeTabId: newTabId,
            tabs: [{ id: newTabId, name: "Tab 1", scenarios: [{ id: uid(), name:`Note ${new Date().toISOString().split('T')[0]} 1`, fields: [], evidenceHtml:"", isOpen: true }] }]
        };
        store.state.workspaces.push(newWs);
        this.setActiveWorkspace(newId);
    }

    deleteWorkspace(id) {
        const wsTitle = this.workspaces.find(w => w.id === id)?.title || "Project";
        if(confirm(`Are you sure you want to delete the project "${wsTitle}"?`)) {
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

    updateProjectTitle(id, title) {
        const ws = this.workspaces.find(w => w.id === id);
        if (ws) {
            ws.title = title;
            globalEvents.publish('workspaces:changed');
        }
    }
}