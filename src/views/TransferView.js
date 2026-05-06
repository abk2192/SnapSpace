export class TransferView {
    constructor(vm) {
        this.vm = vm;
        this.pendingImportData = null;
        this.injectBackupRestoreButtons();
        this.bindSystemEvents();
        this.bindImportEvents();
        this.bindExportEvents();
    }

    injectBackupRestoreButtons() {
        try {
            let sidebarInner = document.getElementById('sidebarMenu') || document.querySelector('.sidebar-inner') || document.querySelector('.sidebar');
            if (sidebarInner && !document.getElementById('backupBtn')) {
                const dataCat = document.createElement('div'); dataCat.className = 'menu-category'; dataCat.textContent = 'Data Management';
                const backupBtn = document.createElement('button'); backupBtn.className = 'menu-item'; backupBtn.id = 'backupBtn'; backupBtn.title = 'Backup Database (JSON)'; backupBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Backup Data';
                const restoreBtn = document.createElement('button'); restoreBtn.className = 'menu-item'; restoreBtn.id = 'restoreBtn'; restoreBtn.title = 'Restore Database (JSON)'; restoreBtn.innerHTML = '<span class="material-symbols-outlined">settings_backup_restore</span> Restore Data';
                
                const sysCat = document.createElement('div'); sysCat.className = 'menu-category'; sysCat.textContent = 'System Tools';
                const forceUpdateBtn = document.createElement('button'); forceUpdateBtn.className = 'menu-item'; forceUpdateBtn.id = 'forceUpdateBtn'; forceUpdateBtn.title = 'Clear Cache & Reload App'; forceUpdateBtn.innerHTML = '<span class="material-symbols-outlined">system_update_alt</span> Force Update';
                
                sidebarInner.appendChild(dataCat); sidebarInner.appendChild(backupBtn); sidebarInner.appendChild(restoreBtn);
                sidebarInner.appendChild(sysCat); sidebarInner.appendChild(forceUpdateBtn);
            }
        } catch(err) { console.error("Backup button injection failed:", err); }
    }

    bindSystemEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#forceUpdateBtn')) {
                if (confirm("This will clear the app's cache and fetch the latest version from the server. Your saved projects will NOT be deleted. Proceed?")) {
                    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
                    if ('caches' in window) caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => window.location.reload(true));
                    else window.location.reload(true);
                } return;
            }
            if (e.target.closest('#backupBtn')) {
                const blob = new Blob([JSON.stringify(this.vm.fullState, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
                a.download = `SnapSpace_Backup_${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return;
            }
            if (e.target.closest('#restoreBtn')) {
                let fileInput = document.getElementById('restoreFileInput');
                if (!fileInput) {
                    fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.id = 'restoreFileInput'; fileInput.accept = '.json'; fileInput.style.display = 'none';
                    document.body.appendChild(fileInput);
                    fileInput.addEventListener('change', (ev) => {
                        const file = ev.target.files[0]; if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const importedData = JSON.parse(event.target.result);
                                if (importedData && importedData.workspaces) {
                                    if (confirm("WARNING: This will replace ALL your current projects and data. Are you sure you want to proceed?")) {
                                        this.vm.restoreBackup(importedData); alert("Data restored successfully!");
                                    }
                                } else alert("Invalid backup file format.");
                            } catch (err) { alert("Error parsing backup file."); }
                            fileInput.value = ""; 
                        }; reader.readAsText(file);
                    });
                } fileInput.click(); return;
            }
        });
    }

    bindImportEvents() {
        const importBtn = document.getElementById("importBtn"); const importInput = document.getElementById("importInput");
        const importBackdrop = document.getElementById("importBackdrop"); const importCancelBtn = document.getElementById("importCancelBtn");
        const importConfirmBtn = document.getElementById("importConfirmBtn");

        importBtn?.addEventListener("click", () => importInput?.click());
        importInput?.addEventListener("change", (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const doc = new DOMParser().parseFromString(event.target.result, "text/html");
                    const payloadEl = doc.getElementById('data-payload');
                    if (payloadEl) {
                        this.pendingImportData = JSON.parse(payloadEl.textContent);
                        if (this.pendingImportData && this.pendingImportData.tabs) {
                            const tCount = this.pendingImportData.tabs.length;
                            const sCount = this.pendingImportData.tabs.reduce((sum, t) => sum + t.scenarios.length, 0);
                            const detailsEl = document.getElementById("importDetails"); 
                            if(detailsEl) detailsEl.textContent = `Found ${tCount} tab(s) and ${sCount} item(s). How would you like to load them?`;
                            if(importBackdrop) importBackdrop.style.display = "flex";
                        } else alert("Invalid export format.");
                    } else alert("No data found in this HTML file.");
                } catch (err) { alert("Error reading file."); }
                e.target.value = ""; 
            }; reader.readAsText(file);
        });

        importCancelBtn?.addEventListener("click", () => { if(importBackdrop) importBackdrop.style.display = "none"; this.pendingImportData = null; });
        if(importBackdrop) importBackdrop.addEventListener("click", (e) => { if(e.target === importBackdrop) importCancelBtn?.click(); });
        importConfirmBtn?.addEventListener("click", () => {
            if(!this.pendingImportData) return;
            const modeRadio = document.querySelector('input[name="importMode"]:checked');
            this.vm.importProject(modeRadio ? modeRadio.value : "append", this.pendingImportData);
            if(importBackdrop) importBackdrop.style.display = "none"; this.pendingImportData = null;
        });
    }

    bindExportEvents() {
        const exportHtmlBtn = document.getElementById("exportHtmlBtn"); const exportBackdrop = document.getElementById("exportBackdrop");
        const exportCancelBtn = document.getElementById("exportCancelBtn"); const exportConfirmBtn = document.getElementById("exportConfirmBtn");

        exportHtmlBtn?.addEventListener("click", () => {
            const project = this.vm.activeProject; if(!project) return;
            const expInput = document.getElementById("exportFilenameInput"); 
            if(expInput) expInput.value = `${(project.title || "Project").replace(/[^a-z0-9]/gi, '_')}_Export_${new Date().toISOString().slice(0,10)}.html`;
              
            const list = document.getElementById("exportChecklist"); if(!list) return; list.innerHTML = "";
            project.tabs.forEach((tab, tIdx) => {
                const group = document.createElement("div"); group.className = "export-tab-group";
                const tLabel = document.createElement("label"); tLabel.className = "export-tab-label";
                const tCheck = document.createElement("input"); tCheck.type = "checkbox"; tCheck.checked = true; tCheck.dataset.tabId = tab.id;
                tLabel.appendChild(tCheck); tLabel.appendChild(document.createTextNode(tab.name || `Tab ${tIdx+1}`)); group.appendChild(tLabel);

                const sList = document.createElement("div"); sList.className = "export-scen-list";
                tab.scenarios.forEach((sc, sIdx) => {
                    const sLabel = document.createElement("label"); sLabel.className = "export-scen-label";
                    const sCheck = document.createElement("input"); sCheck.type = "checkbox"; sCheck.checked = true; sCheck.dataset.tabId = tab.id; sCheck.dataset.scenId = sc.id;
                    sLabel.appendChild(sCheck); sLabel.appendChild(document.createTextNode((sc.name || "").trim() ? `${sIdx+1}. ${(sc.name || "").trim()}` : `Item ${sIdx+1}`)); sList.appendChild(sLabel);
                });

                tCheck.addEventListener("change", (e) => { sList.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = e.target.checked); });
                sList.addEventListener("change", () => {
                    const all = sList.querySelectorAll('input[type="checkbox"]').length;
                    const checked = sList.querySelectorAll('input[type="checkbox"]:checked').length;
                    tCheck.checked = (all === checked && all > 0); tCheck.indeterminate = (checked > 0 && checked < all);
                });
                group.appendChild(sList); list.appendChild(group);
            });
            if(exportBackdrop) exportBackdrop.style.display = "flex";
        });

        exportCancelBtn?.addEventListener("click", () => { if(exportBackdrop) exportBackdrop.style.display = "none"; });
        if(exportBackdrop) exportBackdrop.addEventListener("click", (e) => { if(e.target === exportBackdrop) exportCancelBtn?.click(); });

        exportConfirmBtn?.addEventListener("click", async () => {
            const project = this.vm.activeProject; if(!project) return;
            const filteredState = { activeTabId: null, title: project.title, tabs: [] };
            
            document.querySelectorAll('.export-tab-group').forEach(group => {
                const tCheck = group.querySelector('.export-tab-label input');
                if (tCheck && (tCheck.checked || tCheck.indeterminate)) {
                    const originalTab = project.tabs.find(t => t.id === tCheck.dataset.tabId);
                    if (originalTab) {
                        const newTab = { ...originalTab, scenarios: [] };
                        group.querySelectorAll('.export-scen-list input:checked').forEach(sCheck => {
                            const originalScen = originalTab.scenarios.find(s => s.id === sCheck.dataset.scenId);
                            if(originalScen) newTab.scenarios.push({...originalScen});
                        });
                        if (newTab.scenarios.length > 0 || tCheck.checked) filteredState.tabs.push(newTab);
                    }
                }
            });
            if (filteredState.tabs.length === 0) { alert("Please select at least one item to export."); return; }
            filteredState.activeTabId = filteredState.tabs[0].id;
            if(exportBackdrop) exportBackdrop.style.display = "none";
            
            const expInput = document.getElementById("exportFilenameInput");
            let customFilename = (expInput ? expInput.value.trim() : "") || "SnapSpace_Export.html";
            if (!customFilename.endsWith(".html")) customFilename += ".html";
            
            const prevText = exportConfirmBtn.innerHTML;
            exportConfirmBtn.innerHTML = "Exporting...";
            exportConfirmBtn.disabled = true;
            
            await this.exportHTML(filteredState, customFilename); 
            
            exportConfirmBtn.innerHTML = prevText;
            exportConfirmBtn.disabled = false;
        });
    }

    async exportHTML(exportData, filename) {
        let styles = "";
        try {
            for (let i = 0; i < document.styleSheets.length; i++) {
                try {
                    const sheet = document.styleSheets[i];
                    const rules = sheet.cssRules || sheet.rules;
                    for (let j = 0; j < rules.length; j++) styles += rules[j].cssText + "\n";
                } catch (e) {} // Ignore cross-origin rules like Google Fonts
            }
        } catch (err) {
        }
        const payloadStr = JSON.stringify(exportData).replace(/</g, '\\u003c');

        const exportTemplate = `<!DOCTYPE html>
<html lang="en" data-theme="${this.vm.theme}" data-color="${this.vm.color}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SnapSpace Export</title>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
<style>${styles}</style>
</head>
<body class="readonly">
  <header class="appbar"><div class="appbar-inner"><div class="title"><div class="badge"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M9 15l2 2 4-4"></path></svg></div> SnapSpace Export</div></div></header>
  <div class="tabsbar"><div class="tabs" id="tabs"></div></div>
  <main>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px; flex-wrap: wrap;">
      <input type="text" id="reportSearchInput" placeholder="Search report..." style="padding: 6px 12px; border-radius: 18px; border: 1px solid var(--outline); background: var(--surface); color: var(--text); outline: none; flex: 1; min-width: 200px; max-width: 400px; font-size: 13px;" />
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn secondary" id="expandAllBtn" style="padding: 6px 10px; font-size: 12px;"><span class="material-symbols-outlined" style="font-size: 16px;">unfold_more</span> Expand All</button>
        <button class="btn secondary" id="collapseAllBtn" style="padding: 6px 10px; font-size: 12px;"><span class="material-symbols-outlined" style="font-size: 16px;">unfold_less</span> Collapse All</button>
      </div>
    </div>
    <div id="panel"></div>
  </main>
  <script id="data-payload" type="application/json">${payloadStr}<\/script>
  <script>
    const state = JSON.parse(document.getElementById('data-payload').textContent);
    let activeTabId = state.activeTabId;
    function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s])); }
    function escapeAttr(str){ return escapeHtml(str).replace(/"/g, "&quot;"); }
    
    let searchQuery = "";
    document.addEventListener("input", (e) => {
      if(e.target.id === "reportSearchInput") {
        searchQuery = e.target.value.toLowerCase();
        renderView();
      }
    });

    function renderView() {
      const filteredTabs = state.tabs.map(t => {
          const matchingScenarios = t.scenarios.filter(sc => {
              if(!searchQuery) return true;
              const evText = (sc.evidenceHtml || "").replace(/<[^>]*>?/gm, ' ');
              const fieldText = (sc.fields || []).map(f => (f.key||"") + " " + (f.val||"")).join(" ");
              return ((sc.name||"") + " " + fieldText + " " + evText).toLowerCase().includes(searchQuery);
          });
          return { ...t, scenarios: matchingScenarios };
      });

      const tabsEl = document.getElementById("tabs");
      tabsEl.innerHTML = filteredTabs.map(tab => {
          const cnt = tab.scenarios.length;
          const op = (cnt === 0 && searchQuery) ? 'opacity:0.6;' : '';
          return \`<button class="tab \${tab.id === activeTabId ? 'active' : ''}" data-tab="\${tab.id}" style="\${op}"><span class="tab-name-wrapper"><span class="tab-label" title="\${escapeAttr(tab.name)}">\${escapeHtml(tab.name)}</span>\${searchQuery ? \`<span class="tab-count" style="position:static; margin-left: 4px; border-radius:12px; padding: 2px 6px;">\${cnt}</span>\` : ''}</span></button>\`;
      }).join("");
      const panelEl = document.getElementById("panel"); const activeTab = filteredTabs.find(t => t.id === activeTabId); 
      if(!activeTab) { panelEl.innerHTML = ""; return; }
      if(activeTab.scenarios.length === 0 && searchQuery) { panelEl.innerHTML = '<div style="padding: 32px; text-align: center; color: var(--muted);">No matching items in this tab.</div>'; return; }
      
      panelEl.innerHTML = activeTab.scenarios.map((sc, idx) => {
        const validFields = (sc.fields || []).filter(f => f.key.trim() || f.val.trim());
        const tagsHtml = validFields.map(f => \`<span class="tag"><b>\${escapeHtml(f.key || "Field")}:</b> \${escapeHtml(f.val || "-")}</span>\`).join("");
        const fieldsHtml = validFields.map(f => \`<div class="field-row" style="margin-bottom: 8px; display: flex; gap: 8px;"><input class="input" value="\${escapeAttr(f.key)}" readonly style="width: 30%; background: transparent; border-color: var(--outline-2); font-weight: 700; user-select: text;" /><input class="input" value="\${escapeAttr(f.val)}" readonly style="flex: 1; background: var(--surface-2); border-color: var(--outline-2); user-select: text;" /></div>\`).join("");
        const fieldsSection = fieldsHtml ? \`<div class="label" style="margin-bottom: 8px;"><span class="material-symbols-outlined" style="font-size: 14px;">tune</span> Properties</div><div class="field-list" style="margin-bottom: 16px;">\${fieldsHtml}</div>\` : '';
        const isOpenAttr = (searchQuery || sc.isOpen !== false) ? 'open' : '';
        return \`<details class="scenario" \${isOpenAttr}><summary><div class="summary-content"><div style="display:flex; align-items:center; gap:6px; width: 100%;"><input class="header-name-input" value="\${escapeAttr(sc.name||"")}" placeholder="Item \${idx+1}" readonly style="padding-left: 0;" /></div>\${tagsHtml ? \`<div class="summary-tags">\${tagsHtml}</div>\` : ''}</div><div class="summary-actions"><div class="chev"><span class="material-symbols-outlined">expand_more</span></div></div></summary><div class="card-body">\${fieldsSection}<div class="evidence-wrap" style="margin-top: 0;"><div class="label" style="margin-bottom: 6px;"><span class="material-symbols-outlined" style="font-size: 14px;">image</span> Notes & Media</div><div class="evidence">\${sc.evidenceHtml}</div></div></div></details>\`;
      }).join("");
    }
    let imgClickTimerExport = null;
    document.addEventListener("click", (e) => {
      if (e.target.closest("#expandAllBtn")) { document.querySelectorAll("details.scenario").forEach(d => d.open = true); return; }
      if (e.target.closest("#collapseAllBtn")) { document.querySelectorAll("details.scenario").forEach(d => d.open = false); return; }
      const img = e.target.closest(".evidence img"); 
      if (img){ if(e.detail > 1) return; clearTimeout(imgClickTimerExport); imgClickTimerExport = setTimeout(() => { let w = Number(img.dataset.w || 100); w = (w <= 40) ? 100 : (w - 20); img.dataset.w = String(w); img.style.width = w + "%"; }, 200); return; }
      const tabBtn = e.target.closest(".tab"); if(tabBtn) { activeTabId = tabBtn.dataset.tab; renderView(); return; }
      const copyBtn = e.target.closest(".copy-att");
      if (copyBtn) {
        e.preventDefault(); e.stopPropagation(); const attachmentSpan = copyBtn.closest('.attachment'); if (!attachmentSpan) return;
        try {
          const clone = attachmentSpan.cloneNode(true); const html = clone.outerHTML + "&nbsp;"; const plainText = clone.innerText || "Attachment";
          if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) { navigator.clipboard.write([new ClipboardItem({"text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plainText], { type: "text/plain" })})]); } else throw new Error("Fallback");
        } catch(err) {
          const temp = document.createElement("div"); temp.contentEditable = "true"; temp.innerHTML = attachmentSpan.outerHTML + "&nbsp;"; temp.style.position = "fixed"; temp.style.opacity = "0"; document.body.appendChild(temp); const range = document.createRange(); range.selectNodeContents(temp); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); document.execCommand("copy"); document.body.removeChild(temp);
        }
        const oldTxt = copyBtn.innerHTML; copyBtn.innerHTML = "check_circle"; setTimeout(() => copyBtn.innerHTML = oldTxt, 1500); return;
      }
      const a = e.target.closest("a[data-dataurl]"); if (!a) return; e.preventDefault(); const dataurl = a.dataset.dataurl; if (!dataurl) return;
      const name = a.dataset.name || a.getAttribute("download") || "attachment"; const parts = dataurl.split(","); const meta = parts[0] || ""; const b64 = parts[1] || ""; const m = /data:(.*?);base64/.exec(meta); const mime = (m && m[1]) ? m[1] : "application/octet-stream";
      const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], {type:mime}); const isText = mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('sql') || mime.includes('javascript') || mime.includes('plain');
      if (isText) {
        const reader = new FileReader();
        reader.onload = (re) => {
           let fpBackdrop = document.getElementById("fpBackdropExport");
           if (!fpBackdrop) {
              fpBackdrop = document.createElement("div"); fpBackdrop.id = "fpBackdropExport"; fpBackdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;"; fpBackdrop.innerHTML = '<div style="background:var(--surface);width:min(800px, 100%);max-height:90vh;display:flex;flex-direction:column;border-radius:18px;box-shadow:var(--shadow);overflow:hidden;"><div style="padding:14px 16px;border-bottom:1px solid var(--outline-2);display:flex;justify-content:space-between;align-items:center;font-weight:bold;color:var(--text);"><span id="fpTitleExport" style="word-break:break-all;"></span><div><button id="fpCopyExport" style="margin-right:8px;padding:6px 12px;cursor:pointer;border-radius:999px;border:1px solid var(--outline);background:var(--surface);color:var(--text);font-weight:600;"><span class="material-symbols-outlined">content_copy</span> Copy Text</button><button id="fpDlExport" style="margin-right:8px;padding:6px 12px;cursor:pointer;border-radius:999px;border:1px solid transparent;background:var(--primary);color:#fff;font-weight:600;"><span class="material-symbols-outlined">download</span> Download</button><button id="fpCloseExport" style="padding:6px 12px;cursor:pointer;border-radius:999px;border:1px solid var(--outline);background:var(--surface);color:var(--text);font-weight:600;">Close</button></div></div><div style="flex:1;overflow:auto;background:var(--input-bg);"><pre id="fpContentExport" style="margin:0;padding:16px;font-family:monospace;font-size:13px;white-space:pre-wrap;word-wrap:break-word;color:var(--text);"></pre></div></div>'; document.body.appendChild(fpBackdrop); document.getElementById("fpCloseExport").onclick = () => fpBackdrop.style.display = "none"; fpBackdrop.onclick = (ev) => { if(ev.target === fpBackdrop) fpBackdrop.style.display = "none"; };
              document.getElementById("fpCopyExport").onclick = async () => { try { await navigator.clipboard.writeText(document.getElementById("fpContentExport").textContent); const btn = document.getElementById("fpCopyExport"); const orig = btn.innerHTML; btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Copied!'; setTimeout(() => { btn.innerHTML = orig; }, 1500); } catch(err) { alert("Failed to copy text."); } };
           }
           document.getElementById("fpTitleExport").textContent = name; document.getElementById("fpContentExport").textContent = re.target.result;
           document.getElementById("fpDlExport").onclick = () => { const url = URL.createObjectURL(blob); const tmp = document.createElement("a"); tmp.href = url; tmp.download = name; document.body.appendChild(tmp); tmp.click(); setTimeout(() => { tmp.remove(); URL.revokeObjectURL(url); }, 500); }; fpBackdrop.style.display = "flex";
        }; reader.readAsText(blob); return;
      }
      const url = URL.createObjectURL(blob); const tmp = document.createElement("a"); tmp.href = url; tmp.download = name; document.body.appendChild(tmp); tmp.click(); setTimeout(() => { tmp.remove(); URL.revokeObjectURL(url); }, 500);
    });
    document.addEventListener("dblclick", (e) => {
      const img = e.target.closest(".evidence img");
      if (img){ let backdrop = document.getElementById("imgPreviewBackdropExport"); if (!backdrop) { backdrop = document.createElement("div"); backdrop.id = "imgPreviewBackdropExport"; backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;"; const imgEl = document.createElement("img"); imgEl.id = "imgPreviewElExport"; imgEl.style.cssText = "max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:var(--shadow);background:var(--surface);"; backdrop.appendChild(imgEl); document.body.appendChild(backdrop); backdrop.onclick = () => backdrop.style.display = "none"; } document.getElementById("imgPreviewElExport").src = img.src; backdrop.style.display = "flex"; window.getSelection().removeAllRanges(); }
    });
    renderView(); 
  <\/script>
</body>
</html>`;

        const blob = new Blob([exportTemplate], {type:"text/html"}); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = filename; 
        document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    }
}