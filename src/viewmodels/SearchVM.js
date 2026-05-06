import { store } from '../core/Store.js';

export class SearchVM {
    get workspaces() {
        return store.state?.workspaces || [];
    }

    search(query) {
        const q = query.toLowerCase();
        let results = [];

        this.workspaces.forEach(ws => {
            const wsMatch = (ws.title || "").toLowerCase().includes(q);
            ws.tabs.forEach(tab => {
                const tabMatch = (tab.name || "").toLowerCase().includes(q);
                tab.scenarios.forEach((sc, idx) => {
                    let hasMatch = false;
                    let snippets = [];

                    if (wsMatch) { hasMatch = true; snippets.push({ type: 'Project', text: ws.title || "" }); }
                    if (tabMatch) { hasMatch = true; snippets.push({ type: 'Tab', text: tab.name || "" }); }
                    if ((sc.name || "").toLowerCase().includes(q)) { hasMatch = true; snippets.push({ type: 'Title', text: sc.name || "" }); }
                    
                    (sc.fields || []).forEach(f => {
                        const keyStr = f.key || ""; const valStr = f.val || "";
                        if (keyStr.toLowerCase().includes(q) || valStr.toLowerCase().includes(q)) {
                            hasMatch = true; snippets.push({ type: 'Field', text: `${keyStr} = ${valStr}` });
                        }
                    });

                    // Pure JS HTML Stripping (Keeps the Model separated from the DOM)
                    const rawText = (sc.evidenceHtml || "").replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                    
                    if (rawText.toLowerCase().includes(q)) {
                        hasMatch = true;
                        const matchIdx = rawText.toLowerCase().indexOf(q);
                        const start = Math.max(0, matchIdx - 30);
                        const end = Math.min(rawText.length, matchIdx + q.length + 30);
                        const snippetText = (start > 0 ? "..." : "") + rawText.substring(start, end) + (end < rawText.length ? "..." : "");
                        snippets.push({ type: 'Notes', text: snippetText });
                    }

                    if (hasMatch) {
                        results.push({
                            wsId: ws.id, tabId: tab.id, scId: sc.id,
                            wsTitle: ws.title, tabName: tab.name, scName: sc.name || `Item ${idx+1}`,
                            wsMatch, tabMatch, scMatch: (sc.name || "").toLowerCase().includes(q), snippets
                        });
                    }
                });
            });
        });
        return results;
    }
}