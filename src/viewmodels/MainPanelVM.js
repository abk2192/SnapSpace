import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';
import { uid } from '../utils/dom.js';
import { dbService } from '../services/Database.js';

export class MainPanelVM {
    dashboardDateFilter = null;
    viewMode = 'dashboard'; // 'dashboard' or 'maximized'
    temporarySearchTab = null;
    _tempActiveTabId = null;

    get activeWorkspace() { return store.state?.workspaces.find(w => w.id === store.state.activeWorkspaceId); }
    get workspaces() { return store.state?.workspaces || []; }
    get tabs() { 
        const realTabs = this.activeWorkspace?.tabs || []; 
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
        if (this.activeWorkspace) { 
            this.activeWorkspace.title = title; 
            dbService.putProject({id: this.activeWorkspace.id, title: title, activeTabId: this.activeWorkspace.activeTabId, updatedAt: Date.now()}).then(() => globalEvents.publish('store:saved')).catch(console.error);
            globalEvents.publish('workspaces:changed'); 
        }
    }

    async resetProject() {
        if(this.activeWorkspace && await window.appConfirm("Are you sure you want to reset the CURRENT project? This will delete all tabs and notes inside it.")) {
            const views = await dbService.getViewsByProject(this.activeWorkspace.id);
            for (const v of views) await dbService.deleteView(v.id);
            const items = await dbService.getItemsByProject(this.activeWorkspace.id);
            for (const i of items) await dbService.deleteItem(i.id);

            const now = Date.now();
            const defaultTabId = uid();
            const defaultScId = uid();
            const dateStr = new Date().toISOString().split('T')[0];

            this.activeWorkspace.tabs = [{ id: defaultTabId, name: "Tab 1", scenarios: [{ id: defaultScId, name:`Note ${dateStr} 1`, fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now }] }];
            this.activeWorkspace.activeTabId = defaultTabId;
            
            await dbService.putProject({id: this.activeWorkspace.id, title: this.activeWorkspace.title, activeTabId: defaultTabId, updatedAt: now});
            await dbService.putView({id: defaultTabId, projectId: this.activeWorkspace.id, name: "Tab 1", query: `tabId:${defaultTabId}`, createdAt: now, updatedAt: now});
            await this._syncScenarioToDB(defaultScId);

            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
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
        if (this.activeWorkspace) {
            this.activeWorkspace.activeTabId = id;
            dbService.putProject({id: this.activeWorkspace.id, title: this.activeWorkspace.title, activeTabId: id, updatedAt: Date.now()}).catch(console.error);
            this.viewMode = mode;
            if (id !== "dashboard" && mode === 'maximized') {
                const tab = this.activeWorkspace.tabs.find(t => t.id === id);
                if (tab) tab.scenarios.forEach(sc => sc.isOpen = false);
            }
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
        }
    }

    setTemporarySearchTab(query, results) {
        const scenarios = results.map((r, idx) => {
            let sc = null;
            const ws = this.workspaces.find(w => w.id === r.wsId);
            if (ws) {
                const t = ws.tabs.find(t => t.id === r.tabId);
                if (t) sc = t.scenarios.find(s => s.id === r.scId);
            }
            if (sc) return { ...sc, _wsId: r.wsId, _tabId: r.tabId, _tabName: r.tabName, _wsTitle: r.wsTitle };
            return null;
        }).filter(Boolean);

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
            if (this.activeWorkspace && this.activeWorkspace.tabs.length > 0 && this.activeWorkspace.activeTabId !== 'dashboard') {
                this.setActiveTab(this.activeWorkspace.activeTabId, 'maximized');
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
        if (!this.activeWorkspace) return null;
        const name = `Tab ${this.tabs.length + 1}`; 
        const id = uid(); 
        const newScenId = uid();
        const now = Date.now();
        const dateStr = this.dashboardDateFilter || new Date().toISOString().split('T')[0];
        this.activeWorkspace.tabs.push({ id, name, scenarios: [{ id: newScenId, name:`Note ${dateStr} 1`, noteDate: dateStr, fields: [], evidenceHtml:"", isOpen: true, createdAt: now, modifiedAt: now }] }); 
        this.activeWorkspace.activeTabId = id; 
        
        dbService.putView({id, projectId: this.activeWorkspace.id, name, query: `tabId:${id}`, createdAt: now, updatedAt: now}).catch(console.error);
        dbService.putProject({id: this.activeWorkspace.id, title: this.activeWorkspace.title, activeTabId: id, updatedAt: now}).catch(console.error);
        this._syncScenarioToDB(newScenId).catch(console.error);

        globalEvents.publish('tabs:changed');
        globalEvents.publish('scenarios:changed');
        return newScenId;
    }

    async deleteTab(id) {
        if (!this.activeWorkspace) return;
        const idx = this.tabs.findIndex(t => t.id === id); 
        if (idx < 0) return;
        if(await window.appConfirm("Are you sure you want to delete this tab and all its notes?")) {
            this.activeWorkspace.tabs.splice(idx, 1);
            
            await dbService.deleteView(id);
            const items = await dbService.getItemsByTab(id);
            for(const item of items) await dbService.deleteItem(item.id);

            if (this.activeWorkspace.activeTabId === id) { 
                this.activeWorkspace.activeTabId = this.tabs[Math.max(0, idx-1)]?.id || null; 
                if (!this.activeWorkspace.activeTabId) { 
                    const newTabId = uid();
                    this.activeWorkspace.tabs.push({ id: newTabId, name: "Tab 1", scenarios: [] }); 
                    this.activeWorkspace.activeTabId = newTabId; 
                    await dbService.putView({id: newTabId, projectId: this.activeWorkspace.id, name: "Tab 1", query: `tabId:${newTabId}`, createdAt: Date.now(), updatedAt: Date.now()});
                } 
                await dbService.putProject({id: this.activeWorkspace.id, title: this.activeWorkspace.title, activeTabId: this.activeWorkspace.activeTabId, updatedAt: Date.now()});
            }
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
        }
    }

    renameTab(id, newName) {
        const tab = this.tabs.find(t => t.id === id);
        if (tab && newName) { 
            tab.name = newName.trim() || "Untitled"; 
            dbService.putView({id: tab.id, projectId: this.activeWorkspace.id, name: tab.name, query: `tabId:${tab.id}`, updatedAt: Date.now()}).then(() => globalEvents.publish('store:saved')).catch(console.error);
            globalEvents.publish('tabs:changed'); 
        }
    }

    reorderTabs(fromIdx, toIdx) {
        if (fromIdx !== null && fromIdx !== toIdx && this.activeWorkspace) {
            const moved = this.activeWorkspace.tabs.splice(fromIdx, 1)[0];
            this.activeWorkspace.tabs.splice(toIdx, 0, moved);
            globalEvents.publish('tabs:changed');
            globalEvents.publish('scenarios:changed');
        }
    }

    _findRealScenario(sid) {
        for (const t of this.workspaces.flatMap(w => w.tabs)) {
            const sc = t.scenarios.find(s => s.id === sid);
            if (sc) return sc;
        }
        return null;
    }

    // Helper: Dual-Writes a scenario from the legacy memory tree into the flat IndexedDB
    async _syncScenarioToDB(sid) {
        let parentWs = null, parentTab = null, sc = null;
        for (const ws of this.workspaces) {
            for (const t of ws.tabs) {
                sc = t.scenarios.find(s => s.id === sid);
                if (sc) { parentWs = ws; parentTab = t; break; }
            }
            if (sc) break;
        }
        if (!sc || !parentWs || !parentTab) return;

        const tags = (sc.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean);
        tags.push(`tabId:${parentTab.id}`); // Retain implicit linkage tag

        const flatItem = {
            id: sc.id,
            projectId: parentWs.id,
            name: sc.name || "Untitled",
            noteDate: sc.noteDate || null,
            fields: JSON.parse(JSON.stringify(sc.fields || [])),
            evidenceHtml: sc.evidenceHtml || "",
            isOpen: sc.isOpen !== false,
            createdAt: sc.createdAt || Date.now(),
            modifiedAt: sc.modifiedAt || Date.now(),
            _tags: tags,
            linkedTo: sc.linkedTo || [],
            linkedFrom: sc.linkedFrom || []
        };
        await dbService.putItem(flatItem);
        globalEvents.publish('store:saved');
    }

    addScenario() {
        let tab = this.activeTab; if(!tab || tab.isTemporary) tab = this.activeWorkspace?.tabs[0]; if(!tab) return null;
        const newId = uid();
        const dateStr = this.dashboardDateFilter || new Date().toISOString().split('T')[0];
        const defaultName = `Note ${dateStr} ${tab.scenarios.length + 1}`;
        const now = Date.now();
        
        // 1. Build the new schema for the flat IndexedDB
        const newScenario = { 
            id: newId, 
            projectId: this.activeWorkspace?.id,
            name: defaultName, 
            noteDate: dateStr, 
            fields: [], 
            evidenceHtml: "", 
            isOpen: true, 
            createdAt: now, 
            modifiedAt: now,
            _tags: [`tabId:${tab.id}`], // Required implicit linkage for flat relational views
            linkedTo: [],
            linkedFrom: []
        };

        // 2. Dual-Write: Save to the background DB asynchronously and push to the legacy memory array
        dbService.putItem(newScenario).catch(console.error);
        tab.scenarios.unshift(newScenario);
        
        globalEvents.publish('scenarios:changed');
        return newId;
    }

    reorderScenarios(fromIdx, toIdx) {
        const tab = this.activeTab; if(!tab || tab.isTemporary) return;
        if (!isNaN(fromIdx) && fromIdx !== toIdx) {
            const moved = tab.scenarios.splice(fromIdx, 1)[0];
            tab.scenarios.splice(toIdx, 0, moved);
            globalEvents.publish('scenarios:changed');
        }
    }
    
    toggleAllScenarios() {
        const tab = this.activeTab; if(!tab || tab.isTemporary) return;
        const anyOpen = tab.scenarios.some(sc => sc.isOpen !== false);
        tab.scenarios.forEach(sc => { 
            sc.isOpen = !anyOpen; 
            this._syncScenarioToDB(sc.id).catch(console.error); 
        });
        globalEvents.publish('scenarios:changed');
    }
    
    duplicateScenario(id) {
        for (const t of this.workspaces.flatMap(w => w.tabs)) {
            const idx = t.scenarios.findIndex(s => s.id === id);
            if (idx >= 0) {
                const sc = t.scenarios[idx];
                const clone = JSON.parse(JSON.stringify(sc));
                clone.id = uid(); clone.name = (clone.name || "Untitled") + " (Copy)";
                clone.fields.forEach(f => f.id = uid());
                const now = Date.now(); clone.createdAt = now; clone.modifiedAt = now;
                t.scenarios.splice(idx + 1, 0, clone);
                this._syncScenarioToDB(clone.id).catch(console.error);
                globalEvents.publish('scenarios:changed');
                return;
            }
        }
    }
    
    addField(id, key, val) {
        const sc = this._findRealScenario(id);
        if (sc) {
            sc.fields.push({ id: uid(), key: key || "", val: val || "" });
            sc.modifiedAt = Date.now();
            this._syncScenarioToDB(id).catch(console.error);
            globalEvents.publish('scenarios:changed');
        }
    }
    
    deleteField(scenarioId, fieldId) {
        const sc = this._findRealScenario(scenarioId);
        if (sc) {
            sc.fields = sc.fields.filter(f => f.id !== fieldId);
            sc.modifiedAt = Date.now();
            this._syncScenarioToDB(scenarioId).catch(console.error);
            globalEvents.publish('scenarios:changed');
        }
    }

    async deleteScenario(id) {
        if(await window.appConfirm("Are you sure you want to delete this note?")) { 
            // 1. Delete from the flat IndexedDB
            await dbService.deleteItem(id);
            
            // 2. Clean up legacy memory array
            for (const t of this.workspaces.flatMap(w => w.tabs)) {
                const idx = t.scenarios.findIndex(s => s.id === id);
                if (idx !== -1) {
                    t.scenarios.splice(idx, 1);
                    globalEvents.publish('scenarios:changed'); 
                    return;
                }
            }
        }
    }

    updateScenarioName(sid, name) {
        const sc = this._findRealScenario(sid);
        if (sc) { sc.name = name; sc.modifiedAt = Date.now(); this._syncScenarioToDB(sid).catch(console.error); }
    }

    updateScenarioOpenState(sid, isOpen) {
        const sc = this._findRealScenario(sid);
        if (sc) { sc.isOpen = isOpen; this._syncScenarioToDB(sid).catch(console.error); } 
    }

    updateFieldKey(sid, fid, key) {
        const sc = this._findRealScenario(sid);
        if (sc) { const f = sc.fields.find(f => f.id === fid); if(f) { f.key = key; sc.modifiedAt = Date.now(); this._syncScenarioToDB(sid).catch(console.error); globalEvents.publish('tags:updated'); } }
    }

    updateFieldVal(sid, fid, val) {
        const sc = this._findRealScenario(sid);
        if (sc) { const f = sc.fields.find(f => f.id === fid); if(f) { f.val = val; sc.modifiedAt = Date.now(); this._syncScenarioToDB(sid).catch(console.error); globalEvents.publish('tags:updated'); } }
    }

    updateEvidence(sid, html) {
        const sc = this._findRealScenario(sid);
        if (sc) { sc.evidenceHtml = html; sc.modifiedAt = Date.now(); this._syncScenarioToDB(sid).catch(console.error); }
    }
}