import { escapeHtml } from '../utils/dom.js';
import { store } from '../core/Store.js';
import { globalEvents } from '../core/PubSub.js';

export class SearchView {
    constructor(vm) {
        this.vm = vm;
        this.searchWrap = document.getElementById("searchWrap");
        this.searchInput = document.getElementById("searchInput");
        this.searchDropdown = document.getElementById("searchDropdown");
        this.searchBackdrop = document.getElementById("searchBackdrop");
        this.searchTriggerBtn = document.getElementById("searchTriggerBtn");
        this.searchTimeout = null;

        this.init();
    }

    init() {
        if (!this.searchBackdrop && this.searchDropdown) {
            this.searchBackdrop = document.createElement("div");
            this.searchBackdrop.id = "searchBackdrop";
            this.searchBackdrop.className = "search-backdrop";
            document.body.appendChild(this.searchBackdrop);
        }

        if (this.searchWrap && this.searchWrap.parentElement !== document.body) {
            if (this.searchDropdown && this.searchDropdown.parentElement !== this.searchWrap) {
                this.searchWrap.appendChild(this.searchDropdown);
            }
            document.body.appendChild(this.searchWrap);
            this.searchWrap.classList.add("command-palette");
        }

        if (!this.searchTriggerBtn && this.searchWrap) {
            this.searchTriggerBtn = document.createElement("button");
            this.searchTriggerBtn.id = "searchTriggerBtn";
            this.searchTriggerBtn.className = "search-trigger-btn";
            this.searchTriggerBtn.innerHTML = '<span class="material-symbols-outlined">search</span><span class="st-text">Search...</span><kbd>Ctrl+K</kbd>';
            const appbarInner = document.querySelector('.appbar-inner');
            const actions = document.querySelector('.appbar .actions');
            if (appbarInner && actions) appbarInner.insertBefore(this.searchTriggerBtn, actions);
        }

        this.bindEvents();
    }

    bindEvents() {
        this.searchTriggerBtn?.addEventListener("click", () => this.open());
        
        document.addEventListener("click", (e) => {
            const pillSearchBtn = document.getElementById("pillSearchBtn");
            if (pillSearchBtn && pillSearchBtn.contains(e.target)) return;
            if (this.searchTriggerBtn && this.searchTriggerBtn.contains(e.target)) return;
            if (this.searchWrap && !this.searchWrap.contains(e.target) && this.searchWrap.classList.contains("active-search")) {
                this.close();
            }
        });

        this.searchInput?.addEventListener("input", (e) => {
            clearTimeout(this.searchTimeout);
            const q = e.target.value.trim();
            if (q.length < 3) { 
                if(this.searchDropdown) { this.searchDropdown.style.display = "none"; this.searchDropdown.innerHTML = ""; }
                if(this.searchBackdrop) this.searchBackdrop.style.display = "none";
                return; 
            }
            if(this.searchDropdown) this.searchDropdown.style.display = "flex";
            if(this.searchBackdrop) this.searchBackdrop.style.display = "block";
            this.searchTimeout = setTimeout(() => { this.performSearch(q); }, 200);
        });

        this.searchDropdown?.addEventListener("click", (e) => {
            const res = e.target.closest('.search-result');
            if (res) this.selectResult(res.dataset.ws, res.dataset.tab, res.dataset.sc);
        });

        document.addEventListener("keydown", (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
            if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.open();
            }
            if (e.key === "Escape" && this.searchBackdrop?.style.display === "block") {
                this.close();
            }
            
            if (this.searchWrap && this.searchWrap.classList.contains("active-search")) {
                const results = Array.from(this.searchDropdown?.querySelectorAll('.search-result') || []);
                if (results.length > 0) {
                    const currentIndex = results.findIndex(r => r.classList.contains('focused'));
                    
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        let nextIndex = currentIndex + 1;
                        if (nextIndex >= results.length) nextIndex = 0;
                        results.forEach(r => r.classList.remove('focused'));
                        results[nextIndex].classList.add('focused');
                        results[nextIndex].scrollIntoView({ block: 'nearest' });
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        let prevIndex = currentIndex - 1;
                        if (prevIndex < 0) prevIndex = results.length - 1;
                        results.forEach(r => r.classList.remove('focused'));
                        results[prevIndex].classList.add('focused');
                        results[prevIndex].scrollIntoView({ block: 'nearest' });
                    } else if (e.key === "Enter") {
                        e.preventDefault();
                        const selected = currentIndex >= 0 ? results[currentIndex] : results[0];
                        if (selected) this.selectResult(selected.dataset.ws, selected.dataset.tab, selected.dataset.sc);
                    }
                }
            }
        });
        
        document.getElementById("pillSearchBtn")?.addEventListener("click", () => this.open());
    }

    open() {
        if(this.searchWrap) this.searchWrap.classList.add("active-search");
        if(this.searchBackdrop) this.searchBackdrop.style.display = "block";
        setTimeout(() => this.searchInput?.focus(), 50);
        const q = this.searchInput?.value.trim() || "";
        if(q.length >= 3) {
            if(this.searchDropdown) this.searchDropdown.style.display = "flex";
            this.performSearch(q);
        }
    }

    close() {
        if(this.searchWrap) this.searchWrap.classList.remove("active-search");
        if(this.searchBackdrop) this.searchBackdrop.style.display = "none";
        if(this.searchDropdown) this.searchDropdown.style.display = "none";
        if(this.searchInput) this.searchInput.value = "";
        const appbar = document.querySelector('.appbar');
        if(appbar) appbar.classList.remove("search-active");
    }

    highlightText(text, query) {
        if (!query) return escapeHtml(text);
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})`, 'gi');
        return escapeHtml(text).replace(regex, '<span class="search-hl">$1</span>');
    }

    performSearch(query) {
        const results = this.vm.search(query);
        if (results.length === 0) {
            this.searchDropdown.innerHTML = `<div style="text-align:center; padding: 12px; color: var(--muted); font-size: 13px;">No results found for "${escapeHtml(query)}".</div>`;
            return;
        }

        let resultsHtml = "";
        results.forEach(res => {
            const snippetsHtml = res.snippets.map(snip => `<b>${snip.type}:</b> ${this.highlightText(snip.text, query)}`).join("<br>");
            resultsHtml += `<div class="search-result" data-ws="${res.wsId}" data-tab="${res.tabId}" data-sc="${res.scId}"><div class="res-title"><span class="res-tab">${res.wsMatch ? this.highlightText(res.wsTitle || "", query) : escapeHtml(res.wsTitle || "")} > ${res.tabMatch ? this.highlightText(res.tabName || "", query) : escapeHtml(res.tabName || "")}</span>${res.scMatch ? this.highlightText(res.scName || "", query) : escapeHtml(res.scName)}</div><div class="res-snip">${snippetsHtml}</div></div>`;
        });

        this.searchDropdown.innerHTML = `<div style="padding: 4px 8px; font-weight:bold; font-size:12px; color:var(--muted);">Found ${results.length} matches:</div>` + resultsHtml;
    }

    selectResult(wsId, tabId, scId) {
        store.state.activeWorkspaceId = wsId;
        const ws = store.state.workspaces.find(w => w.id === wsId);
        if(ws) ws.activeTabId = tabId;
        
        globalEvents.publish('workspaces:changed'); globalEvents.publish('workspace:selected'); globalEvents.publish('tabs:changed'); globalEvents.publish('scenarios:changed');
        this.close();
        
        setTimeout(() => {
            const scCard = document.querySelector(`details[data-sid="${scId}"]`);
            if (scCard) { scCard.open = true; scCard.scrollIntoView({ behavior: "smooth", block: "center" }); scCard.style.boxShadow = "0 0 0 3px var(--primary)"; setTimeout(() => scCard.style.boxShadow = "var(--shadow)", 2000); }
        }, 100);
    }
}