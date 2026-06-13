import { dbService } from '../services/Database.js';
import { globalEvents } from './PubSub.js';
import { uid } from '../utils/dom.js';

/**
 * Central Reactive State Management
 * Phase 3 Decoupling: Store no longer proxies the entire legacy tree or saves the massive JSON.
 * It only maintains the active pointers (`activeWorkspaceId`, `activeTabId`) and reconstructs the memory state on boot from the flat IndexedDB.
 */
class Store {
    constructor() {
        this.state = {
            activeWorkspaceId: null,
            workspaces: []
        };
        this.saveTimeout = null;
    }

    async init() {
        const flatProjects = await dbService.getAllProjects();
        let loadedPointers = await dbService.load();
        
        // Phase 3 Fix: Restore strict backward compatibility for v16/v17 users 
        // who haven't migrated their localStorage yet.
        if (!loadedPointers && (!flatProjects || flatProjects.length === 0)) {
            try { 
                const oldLocal = localStorage.getItem("test_recorder_tabs_v17") || localStorage.getItem("test_recorder_tabs_v16");
                if (oldLocal) {
                    loadedPointers = JSON.parse(oldLocal); 
                    await dbService.save(loadedPointers); // Save to IndexedDB so migration catches it
                }
            } catch (e) { console.error("Legacy local storage fallback failed", e); }
        }

        if (flatProjects && flatProjects.length > 0) {
            // Reconstruct memory tree dynamically from Flat DB for backwards compatibility
            this.state.activeWorkspaceId = loadedPointers?.activeWorkspaceId || flatProjects[0].id;
            this.state.workspaces = [];
            
            for (const proj of flatProjects) {
                const views = await dbService.getViewsByProject(proj.id);
                const tabs = [];
                
                for (const v of views) {
                    const items = await dbService.getItemsByTab(v.id);
                    tabs.push({
                        id: v.id,
                        name: v.name,
                        scenarios: items.sort((a, b) => b.createdAt - a.createdAt)
                    });
                }
                
                this.state.workspaces.push({
                    id: proj.id,
                    title: proj.title,
                    activeTabId: proj.activeTabId || (tabs[0] ? tabs[0].id : "dashboard"),
                    tabs: tabs
                });
            }
        } else if (loadedPointers && loadedPointers.workspaces) {
            // Phase 1 migration fallback if not fully migrated yet
            this.state.activeWorkspaceId = loadedPointers.activeWorkspaceId || "default";
            this.state.workspaces = loadedPointers.workspaces;
        } else {
            // Brand new structure
            const defaultWsId = uid(); const defaultTabId = uid();
            const defaultScId = uid();
            const now = Date.now();
            const dateStr = new Date().toISOString().split('T')[0];
            this.state.activeWorkspaceId = defaultWsId;
            this.state.workspaces = [{
                id: defaultWsId, title: "Project 1", activeTabId: "dashboard",
                tabs: [{ id: defaultTabId, name: "Tab 1", scenarios: [{ id: defaultScId, name:`Note ${dateStr} 1`, fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now }] }]
            }];

            // Save new structure to DB immediately to avoid orphaned items and data loss on reload
            try {
                await dbService.putProject({id: defaultWsId, title: "Project 1", activeTabId: "dashboard", updatedAt: now});
                await dbService.putView({id: defaultTabId, projectId: defaultWsId, name: "Tab 1", query: `tabId:${defaultTabId}`, createdAt: now, updatedAt: now});
                await dbService.putItem({
                    id: defaultScId, projectId: defaultWsId, 
                    name: `Note ${dateStr} 1`, noteDate: dateStr, 
                    fields: [], evidenceHtml: "", isOpen: true, 
                    createdAt: now, modifiedAt: now, 
                    _tags: [`tabId:${defaultTabId}`], 
                    linkedTo: [], linkedFrom: []
                });
                await dbService.save({ activeWorkspaceId: defaultWsId });
            } catch (e) { console.error("Failed to initialize new flat database", e); }
        }

        // Proxy only the top level so changing activeWorkspaceId triggers save
        this.state = new Proxy(this.state, {
            set: (target, property, value) => {
                target[property] = value;
                if (property === 'activeWorkspaceId') this.scheduleSave();
                return true;
            }
        });

        return this.state;
    }

    scheduleSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => { 
            // Persist ONLY active pointers, decoupling the legacy monolithic save!
            const persistentState = { activeWorkspaceId: this.state.activeWorkspaceId };
            const success = await dbService.save(persistentState); 
            if (success) { globalEvents.publish('store:saved'); } 
        }, 500);
    }
}

export const store = new Store();