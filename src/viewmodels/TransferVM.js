import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';
import { dbService } from '../services/Database.js';
import { themeService } from '../services/Theme.js';

export class TransferVM {
    get fullState() { return store.state; }
    get activeProject() { return store.state?.workspaces.find(w => w.id === store.state.activeWorkspaceId); }
    get theme() { return themeService.getTheme(); }
    get color() { return themeService.getColor(); }

    async restoreBackup(mode, importedData) {
        const projects = await dbService.getAllProjects();
        for (const p of projects) await dbService.deleteProject(p.id);

        const now = Date.now();
        for (const ws of importedData.workspaces) {
            await dbService.putProject({id: ws.id, title: ws.title || "Project", activeTabId: ws.activeTabId, createdAt: now, updatedAt: now});
            for (const t of ws.tabs || []) {
                await dbService.putView({id: t.id, projectId: ws.id, name: t.name, query: `tabId:${t.id}`, createdAt: now, updatedAt: now});
                for (const s of t.scenarios || []) {
                    const tags = (s.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean);
                    tags.push(`tabId:${t.id}`);
                    await dbService.putItem({
                        id: s.id, projectId: ws.id, name: s.name, fields: s.fields, evidenceHtml: s.evidenceHtml, isOpen: s.isOpen !== false,
                        noteDate: s.noteDate, createdAt: s.createdAt || now, modifiedAt: s.modifiedAt || now, _tags: tags, linkedTo: s.linkedTo || [], linkedFrom: s.linkedFrom || []
                    });
                }
            }
        }

        store.state = importedData;
        globalEvents.publish('workspaces:changed');
        globalEvents.publish('workspace:selected');
    }

    async importProject(mode, pendingData) {
        if (!pendingData) return;
        const active = this.activeProject;
        const now = Date.now();

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

            await dbService.putProject({id: newWsId, title: newWs.title, activeTabId: newWs.activeTabId, createdAt: now, updatedAt: now});
            for (const t of newWs.tabs) {
                await dbService.putView({id: t.id, projectId: newWsId, name: t.name, query: `tabId:${t.id}`, createdAt: now, updatedAt: now});
                for (const s of t.scenarios) {
                    const tags = (s.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean);
                    tags.push(`tabId:${t.id}`);
                    await dbService.putItem({ id: s.id, projectId: newWsId, name: s.name, fields: s.fields, evidenceHtml: s.evidenceHtml, isOpen: s.isOpen !== false, noteDate: s.noteDate, createdAt: s.createdAt || now, modifiedAt: s.modifiedAt || now, _tags: tags, linkedTo: s.linkedTo || [], linkedFrom: s.linkedFrom || [] });
                }
            }

            this.fullState.workspaces.push(newWs);
            this.fullState.activeWorkspaceId = newWsId;
            globalEvents.publish('workspaces:changed');
            globalEvents.publish('workspace:selected');
        }
        else if (mode === "replace" && active) {
            const oldViews = await dbService.getViewsByProject(active.id);
            for (const ov of oldViews) await dbService.deleteView(ov.id);
            const oldItems = await dbService.getItemsByProject(active.id);
            for (const oi of oldItems) await dbService.deleteItem(oi.id);

            for (const t of pendingData.tabs) {
                t.id = uid();
                await dbService.putView({id: t.id, projectId: active.id, name: t.name, query: `tabId:${t.id}`, createdAt: now, updatedAt: now});
                for (const s of t.scenarios) {
                    s.id = uid();
                    const tags = (s.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean);
                    tags.push(`tabId:${t.id}`);
                    await dbService.putItem({ id: s.id, projectId: active.id, name: s.name, fields: s.fields, evidenceHtml: s.evidenceHtml, isOpen: s.isOpen !== false, noteDate: s.noteDate, createdAt: s.createdAt || now, modifiedAt: s.modifiedAt || now, _tags: tags, linkedTo: s.linkedTo || [], linkedFrom: s.linkedFrom || [] });
                }
            }
            active.tabs = pendingData.tabs;
            active.activeTabId = pendingData.activeTabId || pendingData.tabs[0]?.id;
        } 
        else if (mode === "append" && active) {
            for (const t of pendingData.tabs) {
                const clonedTab = JSON.parse(JSON.stringify(t));
                clonedTab.id = uid(); 
                clonedTab.name = (clonedTab.name || "Untitled") + " - Imported";
                await dbService.putView({id: clonedTab.id, projectId: active.id, name: clonedTab.name, query: `tabId:${clonedTab.id}`, createdAt: now, updatedAt: now});

                for (const s of clonedTab.scenarios) { 
                    s.id = uid(); 
                    if(s.name) s.name += " - Imported"; 
                    const tags = (s.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean);
                    tags.push(`tabId:${clonedTab.id}`);
                    await dbService.putItem({ id: s.id, projectId: active.id, name: s.name, fields: s.fields, evidenceHtml: s.evidenceHtml, isOpen: s.isOpen !== false, noteDate: s.noteDate, createdAt: s.createdAt || now, modifiedAt: s.modifiedAt || now, _tags: tags, linkedTo: s.linkedTo || [], linkedFrom: s.linkedFrom || [] });
                } 
                active.tabs.push(clonedTab);
            }
        } 
        else if (mode === "merge" && active) {
            const activeTab = active.tabs.find(t => t.id === active.activeTabId);
            if(activeTab) {
                for (const t of pendingData.tabs) {
                    for (const s of t.scenarios) {
                        const clonedScen = JSON.parse(JSON.stringify(s));
                        clonedScen.id = uid(); 
                        if(clonedScen.name) clonedScen.name += " - Imported";
                        
                        const tags = (clonedScen.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean);
                        tags.push(`tabId:${activeTab.id}`);
                        await dbService.putItem({ id: clonedScen.id, projectId: active.id, name: clonedScen.name, fields: clonedScen.fields, evidenceHtml: clonedScen.evidenceHtml, isOpen: clonedScen.isOpen !== false, noteDate: clonedScen.noteDate, createdAt: clonedScen.createdAt || now, modifiedAt: clonedScen.modifiedAt || now, _tags: tags, linkedTo: clonedScen.linkedTo || [], linkedFrom: clonedScen.linkedFrom || [] });
                        
                        activeTab.scenarios.push(clonedScen);
                    }
                }
            }
        }
        globalEvents.publish('store:saved');
        globalEvents.publish('tabs:changed');
        globalEvents.publish('scenarios:changed');
    }
}