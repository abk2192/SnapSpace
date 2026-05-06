import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';

export class MoveItemVM {
    get workspaces() { return store.state?.workspaces || []; }
    
    getTreeHash() {
        let hash = "";
        for(let w of this.workspaces) {
           hash += w.id + w.title;
           for(let t of w.tabs) hash += t.id + t.name;
        }
        return hash;
    }

    moveItem(scenarioId, destWsId, destTabId) {
        let srcTab = null; let srcScenIdx = -1;
        for (const ws of this.workspaces) {
            for (const t of ws.tabs) {
                const idx = t.scenarios.findIndex(s => s.id === scenarioId);
                if (idx >= 0) { srcTab = t; srcScenIdx = idx; break; }
            }
            if (srcTab) break;
        }

        if (!srcTab || srcScenIdx < 0) return;
        const destWs = this.workspaces.find(w => w.id === destWsId);
        const destTab = destWs ? destWs.tabs.find(t => t.id === destTabId) : null;

        if (srcTab && destTab) {
            const sc = srcTab.scenarios.splice(srcScenIdx, 1)[0];
            destTab.scenarios.push(sc); globalEvents.publish('scenarios:changed');
        }
    }
}