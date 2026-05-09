import { dbService } from '../services/Database.js';
import { globalEvents } from './PubSub.js';
import { uid } from '../utils/dom.js';

/**
 * Deep Proxy Factory
 * Recursively intercepts property changes on deeply nested objects and arrays.
 */
function createDeepProxy(target, onChange) {
    const handler = {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (typeof value === 'object' && value !== null) {
                return new Proxy(value, handler);
            }
            return value;
        },
        set(target, property, value, receiver) {
            const success = Reflect.set(target, property, value, receiver);
            if (success) onChange();
            return success;
        },
        deleteProperty(target, property) {
            const success = Reflect.deleteProperty(target, property);
            if (success) onChange();
            return success;
        }
    };
    return new Proxy(target, handler);
}

/**
 * Central Reactive State Management
 */
class Store {
    constructor() {
        this.state = null;
        this.saveTimeout = null;
    }

    async init() {
        let loadedState = await dbService.load();
        
        // Legacy local storage fallback
        if (!loadedState) {
            try { 
                const oldLocal = localStorage.getItem("test_recorder_tabs_v17");
                if (oldLocal) loadedState = JSON.parse(oldLocal); 
            } catch (e) {}
        }

        // Default empty structure if no DB exists
        if (loadedState && loadedState.workspaces) {
            // Valid state
        } else if (loadedState) {
            // Upgrade from V1 legacy structure
            loadedState = {
                activeWorkspaceId: "default",
                workspaces: [{
                    id: "default", title: loadedState.workspaceTitle || "Project 1", activeTabId: loadedState.activeTabId, tabs: loadedState.tabs || []
                }]
            };
        } else {
            // Brand new structure
            const defaultWsId = uid(); const defaultTabId = uid();
            loadedState = {
                activeWorkspaceId: defaultWsId,
                workspaces: [{
                    id: defaultWsId, title: "Project 1", activeTabId: defaultTabId,
                    tabs: [{ id: defaultTabId, name: "Tab 1", scenarios: [{ id: uid(), name:`Note ${new Date().toISOString().split('T')[0]} 1`, fields: [], evidenceHtml:"", isOpen: true }] }]
                }]
            };
        }

        // Wrap the raw state in our Proxy engine
        this.state = createDeepProxy(loadedState, () => this.scheduleSave());
        return this.state;
    }

    scheduleSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => { const success = await dbService.save(this.state); if (success) { globalEvents.publish('store:saved'); } }, 500);
    }
}

export const store = new Store();