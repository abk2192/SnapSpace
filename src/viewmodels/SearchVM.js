import { dbService } from '../services/Database.js';

export class SearchVM {
    async search(query) {
        const q = query.toLowerCase();
        const items = await dbService.queryItems(query);
        
        const projects = await dbService.getAllProjects();
        const views = [];
        for (const p of projects) {
            views.push(...(await dbService.getViewsByProject(p.id)));
        }

        return items.map(item => {
            const p = projects.find(pr => pr.id === item.projectId);
            const tabTag = (item._tags || []).find(t => t.startsWith('tabid:'));
            const tabId = tabTag ? tabTag.split(':')[1] : null;
            const v = views.find(vw => vw.id === tabId);
            
            const snippets = [];
            
            if (p && (p.title || "").toLowerCase().includes(q)) snippets.push({ type: 'Project', text: p.title });
            if (v && (v.name || "").toLowerCase().includes(q)) snippets.push({ type: 'Tab', text: v.name });
            if ((item.name || "").toLowerCase().includes(q)) snippets.push({ type: 'Title', text: item.name });
            
            (item.fields || []).forEach(f => {
                if ((f.key || "").toLowerCase().includes(q) || (f.val || "").toLowerCase().includes(q)) {
                    snippets.push({ type: 'Field', text: `${f.key} = ${f.val}` });
                }
            });

            const rawText = (item.evidenceHtml || "").replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
            if (rawText.toLowerCase().includes(q)) {
                const matchIdx = rawText.toLowerCase().indexOf(q);
                const start = Math.max(0, matchIdx - 30);
                const end = Math.min(rawText.length, matchIdx + q.length + 30);
                snippets.push({ type: 'Notes', text: (start > 0 ? "..." : "") + rawText.substring(start, end) + (end < rawText.length ? "..." : "") });
            }

            const allAttachments = [...(item.evidenceHtml || "").matchAll(/data-dataurl="data:(.*?);base64,([^"]+)"/g)];
            for (const match of allAttachments) {
                const mime = match[1];
                if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('javascript') || mime.includes('csv')) {
                    try {
                        const decoded = atob(match[2]);
                        if (decoded.toLowerCase().includes(q)) {
                            const matchIdx = decoded.toLowerCase().indexOf(q);
                            const start = Math.max(0, matchIdx - 30);
                            const end = Math.min(decoded.length, matchIdx + q.length + 30);
                            snippets.push({ type: 'File Content', text: (start > 0 ? "..." : "") + decoded.substring(start, end) + (end < decoded.length ? "..." : "") });
                        }
                    } catch(e) {}
                }
            }

            return {
                wsId: item.projectId, tabId: tabId, scId: item.id,
                wsTitle: p ? p.title : "Unknown", tabName: v ? v.name : "Unknown", scName: item.name || "Item",
                wsMatch: p && (p.title || "").toLowerCase().includes(q),
                tabMatch: v && (v.name || "").toLowerCase().includes(q),
                scMatch: (item.name || "").toLowerCase().includes(q),
                snippets
            };
        });
    }
}