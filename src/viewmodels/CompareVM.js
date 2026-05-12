export class CompareVM {
    getTabs() {
        return window.mainPanelVM?.tabs || [];
    }

    getScenariosForTab(tabId) {
        const tab = this.getTabs().find(t => t.id === tabId);
        return tab ? tab.scenarios : [];
    }

    getEvidenceHtml(scenId) {
        for (let t of this.getTabs()) {
            let sc = t.scenarios.find(x => x.id === scenId);
            if (sc) return sc.evidenceHtml;
        }
        return null;
    }

    generateFingerprint() {
        let hash = "";
        for (let t of this.getTabs()) {
            hash += t.id + (t.name || "");
            for (let s of t.scenarios) hash += s.id + (s.name || "");
        }
        return hash;
    }
}