import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';
import { dbService } from '../services/Database.js';

export class MainPanelVM {
    dashboardDateFilter = null;
    viewMode = 'dashboard'; // 'dashboard' or 'maximized'
    temporarySearchTab = null;
    _tempActiveTabId = null;

    constructor() {
        this._activeProject = null;
        this._views = [];
        this._items = [];
        
        globalEvents.subscribe('workspace:selected', () => this.loadProjectData(true));
        
        if (store.state.activeWorkspaceId) {
            this.loadProjectData(false);
        }
    }

    async loadProjectData(switchDashboard = false) {
        const projectId = store.state.activeWorkspaceId;
        if (!projectId) {
            this._activeProject = null; this._views = []; this._items = [];
            return;
        }

        const projects = await dbService.getAllProjects();
        this._activeProject = projects.find(p => p.id === projectId) || null;
        
        if (switchDashboard && this._activeProject && this._activeProject.activeTabId !== "dashboard") {
            this._activeProject.activeTabId = "dashboard";
            this.viewMode = 'dashboard';
            await dbService.putProject(this._activeProject);
        }
        
        this._views = await dbService.getViewsByProject(projectId);
        this._views.sort((a, b) => (a.order !== undefined ? a.order : a.createdAt || 0) - (b.order !== undefined ? b.order : b.createdAt || 0));

        this._items = await dbService.getItemsByProject(projectId);
        this._items.sort((a, b) => (a.order || 0) - (b.order || 0));

        globalEvents.publish('tabs:changed');
        globalEvents.publish('scenarios:changed');
    }

    get activeWorkspace() { return this._activeProject; }
    get workspaces() { return store.state?.workspaces || []; }
    
    get tabs() { 
        if (!this._activeProject) return [];
        const realTabs = this._views.map(v => {
            const viewItems = this._items.filter(item => (item._tags || []).includes(`tabid:${v.id}`));
            viewItems.sort((a, b) => (a.order || 0) - (b.order || 0));
            return { id: v.id, name: v.name, scenarios: viewItems, isTemporary: false };
        });

        if (this.temporarySearchTab) return [...realTabs, this.temporarySearchTab];
        return realTabs;
    }
    get activeTabId() { return this._tempActiveTabId || this.activeWorkspace?.activeTabId; }
    get activeTab() { return this.tabs.find(t => t.id === this.activeTabId); }

    get calendarMonth() { return this._calMonth !== undefined ? this._calMonth : new Date().getMonth(); }
    get calendarYear() { return this._calYear !== undefined ? this._calYear : new Date().getFullYear(); }

    changeCalendarMonth(offset) {
        let m = this.calendarMonth + offset;
        let y = this.calendarYear;
        if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
        this._calMonth = m; this._calYear = y;
        globalEvents.publish('tabs:changed');
        globalEvents.publish('scenarios:changed');
    }

    updateProjectTitle(title) {
        if (this._activeProject) { 
            this._activeProject.title = title;
            this._activeProject.updatedAt = Date.now();
            globalEvents.publish('workspaces:changed'); 
            dbService.putProject(this._activeProject).then(() => globalEvents.publish('store:saved'));
        }
    }

    async resetProject() {
        if(this._activeProject && await window.appConfirm("Are you sure you want to reset the CURRENT project? This will delete all tabs and notes inside it.")) {
            const now = Date.now();
            const projectId = this._activeProject.id;
            
            const newTabId = uid();
            const newScenId = uid();
            
            this._views = [{ id: newTabId, projectId, name: "Tab 1", query: `tabId:${newTabId}`, createdAt: now, updatedAt: now, order: 0 }];
            this._items = [{ id: newScenId, projectId, name: `Note ${new Date().toISOString().split('T')[0]} 1`, fields: [], evidenceHtml: "", isOpen: true, createdAt: now, modifiedAt: now, _tags: [`tabid:${newTabId}`], linkedTo: [], linkedFrom: [], order: 0 }];
            this._activeProject.activeTabId = newTabId;
            
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
            
            (async () => {
                const oldViews = await dbService.getViewsByProject(projectId);
                const oldItems = await dbService.getItemsByProject(projectId);
                for (const v of oldViews) await dbService.deleteView(v.id);
                for (const i of oldItems) await dbService.deleteItem(i.id);
                
                await dbService.putView(this._views[0]);
                await dbService.putItem(this._items[0]);
                await dbService.putProject(this._activeProject);
                globalEvents.publish('store:saved');
            })();
        }
    }

    setActiveTab(id, mode = 'dashboard') {
        if (id === 'search_results') {
            this._tempActiveTabId = id;
            this.viewMode = mode;
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
            return;
        }
        this._tempActiveTabId = null;
        if (this._activeProject) {
            this._activeProject.activeTabId = id;
            this.viewMode = mode;
            
            if (id !== "dashboard" && mode === 'maximized') {
                const tab = this.tabs.find(t => t.id === id);
                if (tab) {
                    tab.scenarios.forEach(sc => sc.isOpen = false);
                }
            }
            
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
            
            (async () => {
                await dbService.putProject(this._activeProject);
                if (id !== "dashboard" && mode === 'maximized') {
                    const tab = this.tabs.find(t => t.id === id);
                    if (tab) {
                        for (const sc of tab.scenarios) await dbService.putItem(sc);
                    }
                }
            })();
        }
    }

    async setTemporarySearchTab(query, _ignoredResults) {
        const items = await dbService.queryItems(query);
        const projects = await dbService.getAllProjects();
        const views = [];
        for (const p of projects) {
            const pViews = await dbService.getViewsByProject(p.id);
            views.push(...pViews);
        }

        const scenarios = items.map(item => {
            const p = projects.find(pr => pr.id === item.projectId);
            const tabTag = (item._tags || []).find(t => t.startsWith('tabid:'));
            const tabId = tabTag ? tabTag.split(':')[1] : null;
            const v = views.find(vw => vw.id === tabId);
            
            return { ...item, _wsId: item.projectId, _tabId: tabId, _tabName: v ? v.name : "Unknown Tab", _wsTitle: p ? p.title : "Unknown Project" };
        });

        this.temporarySearchTab = {
            id: 'search_results',
            name: `Search: ${query}`,
            isTemporary: true,
            scenarios: scenarios
        };
        this.setActiveTab('search_results', 'maximized');
    }

    closeTemporarySearchTab() {
        this.temporarySearchTab = null;
        if (this._tempActiveTabId === 'search_results') {
            this._tempActiveTabId = null;
            if (this._activeProject && this._views.length > 0 && this._activeProject.activeTabId !== 'dashboard') {
                this.setActiveTab(this._activeProject.activeTabId, 'maximized');
            } else {
                this.setActiveTab('dashboard', 'dashboard');
            }
        } else {
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
        }
    }

    setDashboardDateFilter(dateStr) {
        if (this.dashboardDateFilter === dateStr) this.dashboardDateFilter = null;
        else this.dashboardDateFilter = dateStr;
        globalEvents.publish('tabs:changed');
        globalEvents.publish('scenarios:changed');
    }

    addTab() {
        if (!this._activeProject) return null;
        const name = `Tab ${this.tabs.length + 1}`; 
        const id = uid(); 
        const newScenId = uid();
        const now = Date.now();
        const dateStr = this.dashboardDateFilter || new Date().toISOString().split('T')[0];
        
        const newView = { id, projectId: this._activeProject.id, name, query: `tabId:${id}`, createdAt: now, updatedAt: now, order: this._views.length };
        const newItem = { id: newScenId, projectId: this._activeProject.id, name:`Note ${dateStr} 1`, noteDate: dateStr, fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now, _tags: [`tabid:${id}`], linkedTo: [], linkedFrom: [], order: 0 };
        
        this._views.push(newView);
        this._items.push(newItem);
        this._activeProject.activeTabId = id; 
        
        (async () => {
            await dbService.putView(newView);
            await dbService.putItem(newItem);
            await dbService.putProject(this._activeProject);
            globalEvents.publish('store:saved');
        })();
        
        globalEvents.publish('tabs:changed');
        globalEvents.publish('scenarios:changed');
        return newScenId;
    }

    async deleteTab(id) {
        if (!this._activeProject) return;
        const idx = this.tabs.findIndex(t => t.id === id); 
        if (idx < 0) return;
        if(await window.appConfirm("Are you sure you want to delete this tab and all its notes?")) {
            this._views = this._views.filter(v => v.id !== id);
            
            const itemsToDelete = this._items.filter(i => (i._tags || []).includes(`tabid:${id}`));
            this._items = this._items.filter(i => !(i._tags || []).includes(`tabid:${id}`));
            
            if (this._activeProject.activeTabId === id) { 
                this._activeProject.activeTabId = this.tabs[Math.max(0, idx-1)]?.id || null; 
                if (!this._activeProject.activeTabId) { 
                    const newId = uid();
                    const newView = { id: newId, projectId: this._activeProject.id, name: "Tab 1", query: `tabId:${newId}`, createdAt: Date.now(), updatedAt: Date.now(), order: 0 };
                    this._views.push(newView);
                    this._activeProject.activeTabId = newId; 
                    dbService.putView(newView);
                } 
                dbService.putProject(this._activeProject);
            }
            
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
            
            (async () => {
                await dbService.deleteView(id);
                for (const item of itemsToDelete) await dbService.deleteItem(item.id);
                globalEvents.publish('store:saved');
            })();
        }
    }

    renameTab(id, newName) {
        const view = this._views.find(v => v.id === id);
        if (view && newName) { 
            view.name = newName.trim() || "Untitled"; 
            view.updatedAt = Date.now();
            globalEvents.publish('tabs:changed'); 
            dbService.putView(view).then(() => globalEvents.publish('store:saved'));
        }
    }

    reorderTabs(fromIdx, toIdx) {
        if (fromIdx !== null && fromIdx !== toIdx && this._activeProject) {
            const moved = this._views.splice(fromIdx, 1)[0];
            this._views.splice(toIdx, 0, moved);
            
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
            
            (async () => {
                for (let i = 0; i < this._views.length; i++) {
                    this._views[i].order = i;
                    await dbService.putView(this._views[i]);
                }
                globalEvents.publish('store:saved');
            })();
        }
    }

    addScenario() {
        let tab = this.activeTab; if(!tab || tab.isTemporary) tab = this.tabs[0]; if(!tab) return null;
        const newId = uid();
        const dateStr = this.dashboardDateFilter || new Date().toISOString().split('T')[0];
        const defaultName = `Note ${dateStr} ${tab.scenarios.length + 1}`;
        const now = Date.now();
        
        const newItem = { id: newId, projectId: this._activeProject.id, name: defaultName, noteDate: dateStr, fields: [], evidenceHtml: "", isOpen: true, createdAt: now, modifiedAt: now, _tags: [`tabid:${tab.id}`], linkedTo: [], linkedFrom: [], order: -1 };
        this._items.unshift(newItem);
        
        (async () => {
            const tabItems = this._items.filter(i => (i._tags || []).includes(`tabid:${tab.id}`));
            for (let i = 0; i < tabItems.length; i++) {
                tabItems[i].order = i;
                await dbService.putItem(tabItems[i]);
            }
            globalEvents.publish('store:saved');
        })();
        
        globalEvents.publish('scenarios:changed');
        return newId;
    }

    reorderScenarios(fromIdx, toIdx) {
        const tab = this.activeTab; if(!tab || tab.isTemporary) return;
        if (!isNaN(fromIdx) && fromIdx !== toIdx) {
            const tabItems = this._items.filter(i => (i._tags || []).includes(`tabid:${tab.id}`));
            tabItems.sort((a, b) => (a.order || 0) - (b.order || 0));
            const moved = tabItems.splice(fromIdx, 1)[0];
            tabItems.splice(toIdx, 0, moved);
            for (let i = 0; i < tabItems.length; i++) tabItems[i].order = i;
            globalEvents.publish('scenarios:changed');
            (async () => {
                for (let i = 0; i < tabItems.length; i++) await dbService.putItem(tabItems[i]);
                globalEvents.publish('store:saved');
            })();
        }
    }
    
    toggleAllScenarios() {
        const tab = this.activeTab; if(!tab || tab.isTemporary) return;
        const anyOpen = tab.scenarios.some(sc => sc.isOpen !== false);
        const newState = !anyOpen;
        
        tab.scenarios.forEach(sc => { const item = this._items.find(i => i.id === sc.id); if (item) item.isOpen = newState; });
        globalEvents.publish('scenarios:changed');
        
        (async () => {
            for (const sc of tab.scenarios) {
                const item = this._items.find(i => i.id === sc.id);
                if (item) await dbService.putItem(item);
            }
        })();
    }
    
    duplicateScenario(id) {
        let item = this._items.find(i => i.id === id);
        if (!item && this.temporarySearchTab) item = this.temporarySearchTab.scenarios.find(s => s.id === id);
        if (!item) return;

        const clone = JSON.parse(JSON.stringify(item));
        clone.id = uid(); clone.name = (clone.name || "Untitled") + " (Copy)";
        if (clone.fields) clone.fields.forEach(f => f.id = uid());
        const now = Date.now(); clone.createdAt = now; clone.modifiedAt = now;
        
        const tabTag = (clone._tags || []).find(t => t.startsWith('tabid:'));
        if (!tabTag) return;
        
        if (item.projectId === this._activeProject?.id) {
            const tabItems = this._items.filter(i => (i._tags || []).includes(tabTag));
            tabItems.sort((a, b) => (a.order || 0) - (b.order || 0));
            const idx = tabItems.findIndex(i => i.id === id);
            
            if (idx >= 0) {
                tabItems.splice(idx + 1, 0, clone);
                this._items.push(clone);
                for (let i = 0; i < tabItems.length; i++) tabItems[i].order = i;
                
                globalEvents.publish('scenarios:changed');
                (async () => {
                    for (let i = 0; i < tabItems.length; i++) await dbService.putItem(tabItems[i]);
                    globalEvents.publish('store:saved');
                })();
            }
        } else {
            if (this.temporarySearchTab) {
                const tempIdx = this.temporarySearchTab.scenarios.findIndex(s => s.id === id);
                if (tempIdx >= 0) {
                    const mappedClone = { ...clone, _wsId: item._wsId, _tabId: item._tabId, _tabName: item._tabName, _wsTitle: item._wsTitle };
                    this.temporarySearchTab.scenarios.splice(tempIdx + 1, 0, mappedClone);
                }
            }
            globalEvents.publish('scenarios:changed');
            dbService.putItem(clone).then(() => globalEvents.publish('store:saved'));
        }
    }

    _updateItem(sid, updateFn) {
        let item = this._items.find(i => i.id === sid);
        let isExternal = false;
        if (!item && this.temporarySearchTab) { item = this.temporarySearchTab.scenarios.find(s => s.id === sid); isExternal = true; }
        if (item) {
            updateFn(item);
            item.modifiedAt = Date.now();
            dbService.putItem(item).then(() => {
                globalEvents.publish('store:saved');
                if (isExternal) globalEvents.publish('scenarios:changed');
            });
        }
    }

    async deleteScenario(id) {
        if(await window.appConfirm("Are you sure you want to delete this note?")) { 
            const idx = this._items.findIndex(i => i.id === id);
            if (idx !== -1) {
                this._items.splice(idx, 1);
                globalEvents.publish('scenarios:changed'); 
                dbService.deleteItem(id).then(() => globalEvents.publish('store:saved'));
            } else if (this.temporarySearchTab) {
                const tempIdx = this.temporarySearchTab.scenarios.findIndex(s => s.id === id);
                if (tempIdx !== -1) {
                    this.temporarySearchTab.scenarios.splice(tempIdx, 1);
                    globalEvents.publish('scenarios:changed'); 
                    dbService.deleteItem(id).then(() => globalEvents.publish('store:saved'));
                }
            }
        }
    }

    updateScenarioName(sid, name) { this._updateItem(sid, item => item.name = name); }
    updateScenarioOpenState(sid, isOpen) { this._updateItem(sid, item => item.isOpen = isOpen); }
    updateEvidence(sid, html) { this._updateItem(sid, item => item.evidenceHtml = html); }

    updateFieldKey(sid, fid, key) {
        this._updateItem(sid, item => {
            if (item.fields) {
                const f = item.fields.find(f => f.id === fid);
                if (f) { f.key = key; item._tags = [ ...item._tags.filter(t => t.startsWith('tabid:')), ...item.fields.map(f => (f.key || "").toLowerCase().trim()).filter(Boolean) ]; globalEvents.publish('tags:updated'); }
            }
        });
    }

    updateFieldVal(sid, fid, val) {
        this._updateItem(sid, item => {
            if (item.fields) {
                const f = item.fields.find(f => f.id === fid);
                if (f) { f.val = val; globalEvents.publish('tags:updated'); }
            }
        });
    }
    
    addField(id, key, val) {
        this._updateItem(id, item => {
            if (!item.fields) item.fields = [];
            item.fields.push({ id: uid(), key: key || "", val: val || "" });
            if (key) { if (!item._tags) item._tags = []; item._tags.push(key.toLowerCase().trim()); }
            globalEvents.publish('scenarios:changed');
        });
    }
    
    deleteField(scenarioId, fieldId) {
        this._updateItem(scenarioId, item => {
            if (item.fields) {
                item.fields = item.fields.filter(f => f.id !== fieldId);
                item._tags = [ ...item._tags.filter(t => t.startsWith('tabid:')), ...item.fields.map(f => (f.key || "").toLowerCase().trim()).filter(Boolean) ];
                globalEvents.publish('scenarios:changed');
            }
        });
    }

    async linkItem(sourceId, targetId) {
        await dbService.linkItems(sourceId, targetId);
        await this.loadProjectData(false);
    }
    
    async unlinkItem(sourceId, targetId) {
        await dbService.unlinkItems(sourceId, targetId);
        await this.loadProjectData(false);
    }
}