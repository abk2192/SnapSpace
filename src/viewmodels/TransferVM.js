import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';
import { themeService } from '../services/Theme.js';

export class TransferVM {
    get fullState() { return store.state; }
    get activeProject() { return store.state?.workspaces.find(w => w.id === store.state.activeWorkspaceId); }
    get theme() { return themeService.getTheme(); }
    get color() { return themeService.getColor(); }

    restoreBackup(importedData) {
        store.state = importedData;
        globalEvents.publish('workspaces:changed');
        globalEvents.publish('workspace:selected');
    }

    importProject(mode, pendingData) {
        if (!pendingData) return;
        const active = this.activeProject;

        if (mode === "new_project") {
            const newWsId = uid();
            const newWs = {
                id: newWsId,
                title: (pendingData.title || "Imported Project") + " (Import)",
                activeTabId: pendingData.activeTabId || pendingData.tabs[0]?.id,
                tabs: pendingData.tabs.map(t => {
                    const clonedTab = JSON.parse(JSON.stringify(t));
                    clonedTab.id = uid();
                    clonedTab.scenarios.forEach(s => { s.id = uid(); });
                    return clonedTab;
                })
            };
            this.fullState.workspaces.push(newWs);
            this.fullState.activeWorkspaceId = newWsId;
            globalEvents.publish('workspaces:changed');
            globalEvents.publish('workspace:selected');
        }
        else if (mode === "replace" && active) {
            active.tabs = pendingData.tabs;
            active.activeTabId = pendingData.activeTabId || pendingData.tabs[0]?.id;
        } 
        else if (mode === "append" && active) {
            pendingData.tabs.forEach(t => {
                const clonedTab = JSON.parse(JSON.stringify(t));
                clonedTab.id = uid(); 
                clonedTab.name = (clonedTab.name || "Untitled") + " - Imported";
                clonedTab.scenarios.forEach(s => { 
                    s.id = uid(); 
                    if(s.name) s.name += " - Imported"; 
                }); 
                active.tabs.push(clonedTab);
            });
        } 
        else if (mode === "merge" && active) {
            const activeTab = active.tabs.find(t => t.id === active.activeTabId);
            if(activeTab) {
                pendingData.tabs.forEach(t => {
                    t.scenarios.forEach(s => {
                        const clonedScen = JSON.parse(JSON.stringify(s));
                        clonedScen.id = uid(); 
                        if(clonedScen.name) clonedScen.name += " - Imported";
                        activeTab.scenarios.push(clonedScen);
                    });
                });
            }
        }
        globalEvents.publish('tabs:changed');
        globalEvents.publish('scenarios:changed');
    }
}