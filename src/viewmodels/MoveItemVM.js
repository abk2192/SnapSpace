import { globalEvents } from '../core/PubSub.js';
import { dbService } from '../services/Database.js';

export class MoveItemVM {
    async getWorkspacesWithTabs() {
        const projects = await dbService.getAllProjects();
        const tree = [];
        for (const p of projects) {
            const tabs = await dbService.getViewsByProject(p.id);
            tree.push({ id: p.id, title: p.title, tabs });
        }
        return tree;
    }

    async moveItem(scenarioId, destWsId, destTabId) {
        // Fetch item to move
        const items = await dbService.queryItems(scenarioId);
        const item = items.find(i => i.id === scenarioId);
        
        if (item) {
            // Remove old tabId tag and add new one
            item.projectId = destWsId;
            
            let oldTags = item._tags || [];
            oldTags = oldTags.filter(t => !t.startsWith('tabid:'));
            oldTags.push(`tabid:${destTabId}`);
            item._tags = oldTags;
            
            item.modifiedAt = Date.now();
            await dbService.putItem(item);
            
            globalEvents.publish('store:saved');
            
            import('../core/Store.js').then(({store}) => {
                let movedScen = null;
                for (const ws of store.state.workspaces) {
                    for (const t of ws.tabs) {
                        const idx = t.scenarios.findIndex(s => s.id === scenarioId);
                        if (idx !== -1) { movedScen = t.scenarios.splice(idx, 1)[0]; break; }
                    }
                    if (movedScen) break;
                }
                
                if (movedScen) {
                    const destWs = store.state.workspaces.find(w => w.id === destWsId);
                    if (destWs) {
                        const destTab = destWs.tabs.find(t => t.id === destTabId);
                        if (destTab) destTab.scenarios.push(movedScen);
                    }
                }

                if (store.state.activeWorkspaceId === destWsId || store.state.activeWorkspaceId === item.projectId) {
                    globalEvents.publish('tabs:changed');
                    globalEvents.publish('scenarios:changed');
                }
            });
        }
    }
}