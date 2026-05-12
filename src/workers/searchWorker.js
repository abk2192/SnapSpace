const DB_NAME = "SnapSpaceDB";
const DB_VERSION = 2; // Matches main app

function getDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
    });
}

self.onmessage = async (e) => {
    const { id, action, payload } = e.data;
    
    if (action === 'query') {
        try {
            const db = await getDB();
            const tx = db.transaction(['items', 'views', 'projects'], 'readonly');
            const itemStore = tx.objectStore('items');
            
            const results = [];
            const { queryStr, projectId } = payload;
            
            // PHASE 2 Query Engine Parsing
            // e.g., "tag:bug status:open login" becomes structured conditions
            const terms = (queryStr || "").toLowerCase().split(/\s+/).filter(Boolean);
            const conditions = terms.map(term => {
                if (term.includes(':')) {
                    const [key, val] = term.split(':');
                    return { type: 'kv', key, val };
                }
                return { type: 'text', val: term };
            });
            
            const req = itemStore.openCursor();
            req.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const item = cursor.value;
                    let matches = true;
                    
                    if (projectId && item.projectId !== projectId) matches = false;
                    
                    if (matches && conditions.length > 0) {
                        const itemTags = (item._tags || []).map(t => t.toLowerCase());
                        const itemText = [
                            item.name,
                            item.evidenceHtml,
                            ...(item.fields || []).map(f => `${f.key} ${f.val}`)
                        ].join(" ").toLowerCase();
                        
                        for (const cond of conditions) {
                            if (cond.type === 'kv') {
                                if (cond.key === 'tag') {
                                    if (!itemTags.some(t => t.includes(cond.val))) { matches = false; break; }
                                } else if (cond.key === 'tabid') { // For legacy fallback
                                    if (!itemTags.includes(`tabid:${cond.val}`)) { matches = false; break; }
                                } else {
                                    const fieldMatch = (item.fields || []).some(f => (f.key||"").toLowerCase().includes(cond.key) && (f.val||"").toLowerCase().includes(cond.val));
                                    if (!fieldMatch) { matches = false; break; }
                                }
                            } else {
                                if (!itemText.includes(cond.val)) { matches = false; break; }
                            }
                        }
                    }
                    
                    if (matches) results.push(item);
                    cursor.continue();
                } else {
                    results.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
                    self.postMessage({ id, success: true, data: results });
                }
            };
            req.onerror = () => { self.postMessage({ id, success: false, error: "Cursor failed" }); };
        } catch (err) {
            self.postMessage({ id, success: false, error: err.message });
        }
    }
};