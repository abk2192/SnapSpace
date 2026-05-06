const DB_NAME = "SnapSpaceDB";
const STORE_NAME = "workspace";
const DB_VERSION = 1;
const STATE_KEY = "test_recorder_tabs_v18"; 

/**
 * DatabaseService
 * Abstracted storage layer. Currently implements IndexedDB.
 * Designed to be easily swappable with a dedicated SQLite implementation in the future.
 */
class DatabaseService {
    constructor() {
        this.dbInstance = null;
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
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
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
}

export const dbService = new DatabaseService();