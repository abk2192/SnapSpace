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
                if (store.state.activeWorkspaceId === destWsId || store.state.activeWorkspaceId === item.projectId) {
                    if (window.mainPanelVM) window.mainPanelVM.loadProjectData(false);
                }
            });
        }
    }
}