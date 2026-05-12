const DB_NAME = "SnapSpaceDB";
const STORE_NAME = "workspace";
const DB_VERSION = 2; // Incremented for Phase 1 Restructuring
const STATE_KEY = "test_recorder_tabs_v18"; 

/**
 * DatabaseService
 * Abstracted storage layer. Currently implements IndexedDB.
 * Designed to be easily swappable with a dedicated SQLite implementation in the future.
 */
class DatabaseService {
    constructor() {
        this.dbInstance = null;
        this.searchWorker = null;
        this.workerCallbacks = new Map();
        this._initWorker();
    }

    _initWorker() {
        try {
            this.searchWorker = new Worker('./src/workers/searchWorker.js');
            this.searchWorker.onmessage = (e) => {
                const { id, success, data, error } = e.data;
                const cb = this.workerCallbacks.get(id);
                if (cb) {
                    if (success) cb.resolve(data); else cb.reject(new Error(error));
                    this.workerCallbacks.delete(id);
                }
            };
        } catch (e) {
            console.warn("[DB] Search Worker init failed:", e);
        }
    }

    async init() {
        if (this.dbInstance) return this.dbInstance;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (e) => reject(new Error("DB Error: " + e.target.errorCode));
            request.onsuccess = (e) => { 
                this.dbInstance = e.target.result; 
                resolve(this.dbInstance); 
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Legacy V1 Store
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }

                // V2 Stores: Flat Relational Structure
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('views')) {
                    const viewStore = db.createObjectStore('views', { keyPath: 'id' });
                    viewStore.createIndex('projectId', 'projectId', { unique: false });
                }
                if (!db.objectStoreNames.contains('items')) {
                    const itemStore = db.createObjectStore('items', { keyPath: 'id' });
                    itemStore.createIndex('projectId', 'projectId', { unique: false });
                    itemStore.createIndex('tags', '_tags', { multiEntry: true, unique: false }); 
                    itemStore.createIndex('updatedAt', 'modifiedAt', { unique: false });
                }
            };
        });
    }

    async save(state) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const request = store.put(JSON.stringify(state), STATE_KEY);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(new Error("DB Save failed"));
            });
        } catch (err) {
            console.error("Failed to save state to DB:", err);
            return false;
        }
    }

    async load() {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readonly");
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(STATE_KEY);
                request.onsuccess = () => {
                    if (request.result) {
                        try {
                            resolve(JSON.parse(request.result));
                        } catch (e) {
                            console.error("Error parsing DB state", e);
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = () => resolve(null);
            });
        } catch (err) {
            console.error("Failed to load state from DB:", err);
            return null;
        }
    }

    // ==========================================
    // PHASE 4: Flat Data CRUD Operations
    // ==========================================

    async getAllProjects() {
        const db = await this.init();
        return new Promise((resolve) => {
            const tx = db.transaction('projects', 'readonly');
            const req = tx.objectStore('projects').getAll();
            req.onsuccess = () => resolve(req.result || []);
        });
    }

    async putProject(project) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite');
            const req = tx.objectStore('projects').put(project);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async deleteProject(id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['projects', 'views', 'items'], 'readwrite');
            tx.objectStore('projects').delete(id);
            
            // Cascade delete related views and items securely within the transaction
            const viewsIdx = tx.objectStore('views').index('projectId');
            viewsIdx.openKeyCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { tx.objectStore('views').delete(cursor.primaryKey); cursor.continue(); }
            };
            
            const itemsIdx = tx.objectStore('items').index('projectId');
            itemsIdx.openKeyCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { tx.objectStore('items').delete(cursor.primaryKey); cursor.continue(); }
            };
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async getViewsByProject(projectId) {
        const db = await this.init();
        return new Promise((resolve) => {
            const tx = db.transaction('views', 'readonly');
            const idx = tx.objectStore('views').index('projectId');
            const req = idx.getAll(IDBKeyRange.only(projectId));
            req.onsuccess = () => resolve(req.result || []);
        });
    }

    async putView(view) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('views', 'readwrite');
            const req = tx.objectStore('views').put(view);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async deleteView(id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('views', 'readwrite');
            const req = tx.objectStore('views').delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async getItemsByProject(projectId) {
        const db = await this.init();
        return new Promise((resolve) => {
            const tx = db.transaction('items', 'readonly');
            const idx = tx.objectStore('items').index('projectId');
            const req = idx.getAll(IDBKeyRange.only(projectId));
            req.onsuccess = () => resolve(req.result || []);
        });
    }

    async getItemsByTab(tabId) {
        const db = await this.init();
        return new Promise((resolve) => {
            const tx = db.transaction('items', 'readonly');
            const idx = tx.objectStore('items').index('tags');
            
            // Query the MultiEntry index using the implicit linkage tag
            const req = idx.getAll(IDBKeyRange.only(`tabId:${tabId}`));
            req.onsuccess = () => resolve(req.result || []);
        });
    }

    async putItem(item) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('items', 'readwrite');
            const req = tx.objectStore('items').put(item);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async deleteItem(id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('items', 'readwrite');
            const req = tx.objectStore('items').delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // ==========================================
    // PHASE 2: Data Controllers & Omnisearch 
    // ==========================================
    
    async queryItems(queryStr, projectId = null) {
        if (!this.searchWorker) {
            console.warn("Search Worker not active. Falling back to empty array.");
            return [];
        }
        return new Promise((resolve, reject) => {
            const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            this.workerCallbacks.set(id, { resolve, reject });
            this.searchWorker.postMessage({ id, action: 'query', payload: { queryStr, projectId } });
        });
    }

    async linkItems(sourceId, targetId) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('items', 'readwrite');
            const store = tx.objectStore('items');
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);

            store.get(sourceId).onsuccess = (e) => {
                const sItem = e.target.result;
                if (!sItem) return;
                
                store.get(targetId).onsuccess = (e2) => {
                    const tItem = e2.target.result;
                    if (!tItem) return;
                    
                    if (!sItem.linkedTo) sItem.linkedTo = [];
                    if (!tItem.linkedFrom) tItem.linkedFrom = [];
                    
                    if (!sItem.linkedTo.includes(targetId)) sItem.linkedTo.push(targetId);
                    if (!tItem.linkedFrom.includes(sourceId)) tItem.linkedFrom.push(sourceId);
                    
                    sItem.modifiedAt = Date.now();
                    tItem.modifiedAt = Date.now();
                    
                    store.put(sItem); store.put(tItem);
                };
            };
        });
    }

    async unlinkItems(sourceId, targetId) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('items', 'readwrite');
            const store = tx.objectStore('items');
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);

            store.get(sourceId).onsuccess = (e) => {
                const sItem = e.target.result;
                if (sItem && sItem.linkedTo) { sItem.linkedTo = sItem.linkedTo.filter(id => id !== targetId); sItem.modifiedAt = Date.now(); store.put(sItem); }
            };
            
            store.get(targetId).onsuccess = (e) => {
                const tItem = e.target.result;
                if (tItem && tItem.linkedFrom) { tItem.linkedFrom = tItem.linkedFrom.filter(id => id !== sourceId); tItem.modifiedAt = Date.now(); store.put(tItem); }
            };
        });
    }

    // ==========================================
    // PHASE 1: Data Migration Script
    // ==========================================
    async migrateToFlatData() {
        const legacyState = await this.load();
        if (!legacyState || !legacyState.workspaces) return false;

        const db = await this.init();
        
        // Check if migration is already done
        const hasProjects = await new Promise(resolve => {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const req = store.count();
            req.onsuccess = () => resolve(req.result > 0);
            req.onerror = () => resolve(false);
        });

        if (hasProjects) {
            console.log("[DB] Data already flattened. Skipping migration.");
            return true;
        }

        console.log("[DB] Starting Phase 1 Migration: Flattening hierarchical data...");

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['projects', 'views', 'items'], 'readwrite');
            const projectStore = tx.objectStore('projects');
            const viewStore = tx.objectStore('views');
            const itemStore = tx.objectStore('items');

            legacyState.workspaces.forEach(ws => {
                projectStore.put({
                    id: ws.id,
                    title: ws.title || "Untitled Project",
                    activeTabId: ws.activeTabId, // Keep for backward compatibility during transition
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });

                ws.tabs.forEach(tab => {
                    viewStore.put({
                        id: tab.id,
                        projectId: ws.id,
                        name: tab.name || "Untitled View",
                        query: `tabId:${tab.id}`, // Implicit linkage to search items
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });

                    tab.scenarios.forEach((sc, idx) => {
                        // Extract properties into searchable tags for the DB Index
                        const tags = (sc.fields || []).map(f => (f.key || "").toLowerCase().trim()).filter(Boolean);
                        tags.push(`tabId:${tab.id}`); // System tag to retain backwards compatibility
                        
                        itemStore.put({
                            id: sc.id,
                            projectId: ws.id,
                            name: sc.name || `Note ${idx + 1}`,
                            fields: sc.fields || [],
                            evidenceHtml: sc.evidenceHtml || "",
                            isOpen: sc.isOpen !== false,
                            noteDate: sc.noteDate || null,
                            createdAt: sc.createdAt || Date.now(),
                            modifiedAt: sc.modifiedAt || Date.now(),
                            _tags: tags, // MultiEntry Index
                            linkedTo: [], // Prepared for Graph UI
                            linkedFrom: [] // Prepared for Graph UI
                        });
                    });
                });
            });

            tx.oncomplete = () => {
                console.log("[DB] Phase 1 Migration Complete! Data is now flat and relational.");
                resolve(true);
            };
            tx.onerror = (e) => reject(new Error("Migration failed: " + e.target.error));
        });
    }
}

export const dbService = new DatabaseService();