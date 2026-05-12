import { dbService } from '../services/Database.js';
import { globalEvents } from './PubSub.js';

/**
 * Central Reactive State Management
 * Refactored for Phase 4: Now only tracks lightweight UI state instead of the entire data tree.
 */
class Store {
    constructor() {
        this._state = {
            activeWorkspaceId: null,
            activeTabId: null,
            workspaces: [] // TEMPORARY FALLBACK to prevent crashes in other VMs during migration
        };

        // Shallow proxy just to track top-level UI state changes
        this.state = new Proxy(this._state, {
            set: (target, property, value) => {
                const changed = target[property] !== value;
                target[property] = value;
                if (changed) {
                    if (property === 'activeWorkspaceId') globalEvents.publish('workspace:selected');
                    if (property === 'activeTabId') globalEvents.publish('tabs:changed');
                }
                return true;
            }
        });
    }

    async init() {
        // Return the lightweight UI state. Actual data is fetched natively by ViewModels via IndexedDB.
        return this.state;
    }
}

export const store = new Store();