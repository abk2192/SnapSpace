import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';
import { themeService } from '../services/Theme.js';
import { dbService } from '../services/Database.js';

export class TransferVM {
    get activeProject() { return window.mainPanelVM?.activeWorkspace; }
    get theme() { return themeService.getTheme(); }
    get color() { return themeService.getColor(); }

    async getFullState() {
        const projects = await dbService.getAllProjects();
        const views = [];
        const items = [];
        for (const p of projects) {
            views.push(...(await dbService.getViewsByProject(p.id)));
            items.push(...(await dbService.getItemsByProject(p.id)));
        }
        return { version: 2, projects, views, items };
    }

    async restoreBackup(mode, importedData) {
        if (mode === "replace") {
            const currentProjects = await dbService.getAllProjects();
            for (const p of currentProjects) await dbService.deleteProject(p.id);
            
            if (importedData.version === 2) {
                for (const p of importedData.projects) await dbService.putProject(p);
                for (const v of importedData.views) await dbService.putView(v);
                for (const i of importedData.items) await dbService.putItem(i);
            }
        } else if (mode === "append" && importedData.version === 2) {
            for (const p of importedData.projects) {
                const newWsId = uid();
                const oldWsId = p.id;
                p.id = newWsId;
                await dbService.putProject(p);
                
                const pViews = importedData.views.filter(v => v.projectId === oldWsId);
                for (const v of pViews) {
                    const newTabId = uid();
                    const oldTabId = v.id;
                    v.id = newTabId;
                    v.projectId = newWsId;
                    v.query = `tabId:${newTabId}`;
                    await dbService.putView(v);
                    
                    const pItems = importedData.items.filter(i => (i._tags || []).includes(`tabid:${oldTabId}`));
                    for (const item of pItems) {
                        item.id = uid();
                        item.projectId = newWsId;
                        let tags = item._tags || [];
                        tags = tags.filter(t => !t.startsWith('tabid:'));
                        tags.push(`tabid:${newTabId}`);
                        item._tags = tags;
                        await dbService.putItem(item);
                    }
                }
            }
        }
        
        // Force full UI reload
        const projects = await dbService.getAllProjects();
        if (projects.length > 0) store.state.activeWorkspaceId = projects[0].id;
        
        window.location.reload();
    }

    async importProject(mode, pendingData) {
        if (!pendingData) return;
        const activeProjectId = store.state.activeWorkspaceId;

        if (mode === "new_project") {
            const newWsId = uid();
            await dbService.putProject({
                id: newWsId,
                title: (pendingData.title || "Imported Project") + " (Import)",
                activeTabId: pendingData.activeTabId || pendingData.tabs[0]?.id,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            
            for (const t of pendingData.tabs) {
                const newTabId = uid();
                await dbService.putView({ id: newTabId, projectId: newWsId, name: t.name, query: `tabId:${newTabId}`, createdAt: Date.now(), updatedAt: Date.now() });
                for (const s of t.scenarios) {
                    const newItemId = uid();
                    s.id = newItemId; s.projectId = newWsId;
                    s._tags = [`tabid:${newTabId}`, ...(s.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean)];
                    await dbService.putItem(s);
                }
            }
            store.state.activeWorkspaceId = newWsId;
            
            globalEvents.publish('store:saved');
            window.location.reload(); // Simplest way to cleanly swap all UI states to the new project
        }
        else if (mode === "replace" && activeProjectId) {
            const oldViews = await dbService.getViewsByProject(activeProjectId);
            for (const v of oldViews) await dbService.deleteView(v.id);
            const oldItems = await dbService.getItemsByProject(activeProjectId);
            for (const i of oldItems) await dbService.deleteItem(i.id);
            
            for (const t of pendingData.tabs) {
                const newTabId = uid();
                await dbService.putView({ id: newTabId, projectId: activeProjectId, name: t.name, query: `tabId:${newTabId}`, createdAt: Date.now(), updatedAt: Date.now() });
                for (const s of t.scenarios) {
                    s.id = uid(); s.projectId = activeProjectId;
                    s._tags = [`tabid:${newTabId}`, ...(s.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean)];
                    await dbService.putItem(s);
                }
            }
        } 
        else if (mode === "append" && activeProjectId) {
            pendingData.tabs.forEach(t => {
                const newTabId = uid();
                dbService.putView({ id: newTabId, projectId: activeProjectId, name: (t.name || "Untitled") + " - Imported", query: `tabId:${newTabId}`, createdAt: Date.now(), updatedAt: Date.now() });
                t.scenarios.forEach(s => {
                    s.id = uid(); s.projectId = activeProjectId; s.name = (s.name || "Note") + " - Imported";
                    s._tags = [`tabid:${newTabId}`, ...(s.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean)];
                    dbService.putItem(s);
                });
            });
        } 
        else if (mode === "merge" && activeProjectId) {
            const activeTabId = window.mainPanelVM?.activeTabId;
            if(activeTabId && activeTabId !== "dashboard") {
                pendingData.tabs.forEach(t => {
                    t.scenarios.forEach(s => {
                        s.id = uid(); s.projectId = activeProjectId; s.name = (s.name || "Note") + " - Imported";
                        s._tags = [`tabid:${activeTabId}`, ...(s.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean)];
                        dbService.putItem(s);
                    });
                });
            }
        }
        globalEvents.publish('store:saved');
        if (window.mainPanelVM) window.mainPanelVM.loadProjectData(false);
    }
}