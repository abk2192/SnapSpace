import { moveCursorToEnd } from '../utils/dom.js';

export class EditorView {
    constructor(vm) {
        this.vm = vm;
        this.savedRange = null;
        this.targetScenarioForFile = null;
        this.imgClickTimer = null;
        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener("mousedown", (e) => { if (e.target.closest('[data-cmd]')) e.preventDefault(); });

        document.addEventListener("selectionchange", () => {
            this.updateToolbarState();
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                let node = range?.commonAncestorContainer || null;
                if (node?.nodeType === 3) node = node.parentNode || null;
                if (node && typeof node.closest === 'function' && node.closest('.evidence')) { this.savedRange = range; }
            }
        });

        // Core Editor Command Executor
        document.addEventListener("click", (e) => {
            const cmdBtn = e.target.closest('[data-cmd]');
            if (cmdBtn) {
                e.preventDefault(); const cmd = cmdBtn.dataset.cmd; let val = cmdBtn.dataset.val || null;
                
                if (cmd === 'createLink') {
                    val = prompt("Enter the URL:"); if (!val) return;
                    if (!/^https?:\/\//i.test(val)) val = 'https://' + val; 
                } else if (cmd === 'insertTable') {
                    const dims = prompt("Enter dimensions (rows,cols) e.g., 3,3:", "3,3");
                    if(dims) {
                        const [r, c] = dims.split(',').map(n => parseInt(n.trim(), 10));
                        if (r > 0 && c > 0) document.execCommand("insertHTML", false, this.vm.generateTableHtml(r, c));
                    }
                    return;
                }
                document.execCommand(cmd, false, val); this.updateToolbarState();
                const ev = cmdBtn.closest('.evidence-wrap').querySelector('.evidence');
                if (ev) ev.dispatchEvent(new Event('input', { bubbles: true })); // Triggers Auto-Save
                return;
            }

            // Modals & Sub-systems
            const cfBtn = e.target.closest("[data-createfile]");
            if (cfBtn) this.openCreateFileDialog(cfBtn.dataset.createfile);
            
            const att = e.target.closest("[data-attach]");
            if (att) this.openFilePicker(att.dataset.attach);

            const copyBtn = e.target.closest(".copy-att");
            if (copyBtn) this.copyAttachment(copyBtn, e);

            const evidenceLink = e.target.closest(".evidence a");
            if (evidenceLink && !evidenceLink.closest(".attachment") && !evidenceLink.hasAttribute("data-dataurl")) {
                e.preventDefault(); window.open(evidenceLink.href, '_blank');
            }

            const a = e.target.closest("a[data-dataurl]");
            if (a) this.previewOrDownloadAttachment(a, e);

            const img = e.target.closest(".evidence img"); 
            if (img){
                if (e.detail > 1) return; 
                clearTimeout(this.imgClickTimer);
                this.imgClickTimer = setTimeout(() => {
                    let w = Number(img.dataset.w || 100); w = (w <= 40) ? 100 : (w - 20); img.dataset.w = String(w); img.style.width = w + "%";
                    const ev = img.closest('.evidence'); if (ev) ev.dispatchEvent(new Event('input', { bubbles: true }));
                }, 200);
            }
        });

        document.addEventListener("dblclick", (e) => {
            const img = e.target.closest(".evidence img");
            if (img) { clearTimeout(this.imgClickTimer); const el = document.getElementById("imgPreviewEl"); if(el) el.src = img.src; document.getElementById("imgPreviewBackdrop").style.display = "flex"; window.getSelection().removeAllRanges(); }
        });

        document.addEventListener("paste", (e) => {
            const ev = e.target.closest(".evidence[data-evidence]"); if (!ev) return;
            const dt = e.clipboardData; if (!dt) return;
            
            const files = [...dt.files || []]; const imgFile = files.find(f => f.type && f.type.startsWith("image/"));
            if (imgFile){ e.preventDefault(); const sel = window.getSelection(); if (sel.rangeCount > 0) this.savedRange = sel.getRangeAt(0); this.insertImage(imgFile, ev); return; }
           
            const text = dt.getData("text/plain"); const urlRegex = /^(https?:\/\/[^\s]+)$/i;
            if (text && urlRegex.test(text.trim())) { e.preventDefault(); const sel = window.getSelection(); if (sel.rangeCount > 0) this.savedRange = sel.getRangeAt(0); this.restoreSelectionAndInsert(ev, `<a href="${text.trim()}" target="_blank" style="color: var(--primary); text-decoration: underline; cursor: pointer;">${text.trim()}</a>&nbsp;`); }
        });

        // Dialog Triggers
        document.getElementById('cfCancel')?.addEventListener('click', () => { document.getElementById('cfBackdrop').style.display = 'none'; this.targetScenarioForFile = null; });
        document.getElementById('cfOk')?.addEventListener('click', () => {
            const name = document.getElementById('cfName')?.value.trim() || 'document.txt'; const content = document.getElementById('cfContent')?.value;
            if(!content) { alert("File content cannot be empty."); return; }
            const ev = document.querySelector(`.evidence[data-evidence="${this.targetScenarioForFile}"]`);
            if(ev) {
                const blob = new Blob([content], { type: 'text/plain' }); const reader = new FileReader();
                reader.onload = () => { this.restoreSelectionAndInsert(ev, `<span class="attachment" contenteditable="false"><a href="${reader.result}" download="${name}" data-name="${name}" data-dataurl="${reader.result}"><span class="material-symbols-outlined" style="font-size:16px;">attachment</span> ${name}</a><span class="copy-att material-symbols-outlined" title="Copy file" data-copy="${reader.result}" contenteditable="false">content_copy</span></span>&nbsp;`); }; 
                reader.readAsDataURL(blob);
            }
            document.getElementById('cfBackdrop').style.display = 'none'; this.targetScenarioForFile = null;
        });
    }

    updateToolbarState() {
        document.querySelectorAll('.wysiwyg-toolbar .btn').forEach(b => b.classList.remove('active-format'));
        const sel = window.getSelection(); if (!sel || !sel.rangeCount) return; 
        let node = sel.anchorNode; if (node?.nodeType === 3) node = node.parentNode || null; if (!node || typeof node.closest !== 'function') return;
        const ev = node.closest('.evidence');
        if (ev) {
            const toolbar = ev.previousElementSibling;
            if (toolbar && toolbar.classList.contains('wysiwyg-toolbar')) {
                ['bold', 'italic', 'insertUnorderedList', 'strikeThrough'].forEach(cmd => { if (document.queryCommandState(cmd)) { const btn = toolbar.querySelector(`[data-cmd="${cmd}"]`); if (btn) btn.classList.add('active-format'); } });
            }
        }
    }

    restoreSelectionAndInsert(ev, html) {
        ev.focus();
        if (this.savedRange && this.savedRange.commonAncestorContainer) {
            let node = this.savedRange?.commonAncestorContainer || null; if (node?.nodeType === 3) node = node.parentNode || null;
            if (node && typeof node.closest === 'function' && node.closest('.evidence') === ev) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(this.savedRange); } else { moveCursorToEnd(ev); }
        } else { moveCursorToEnd(ev); }
        document.execCommand("insertHTML", false, html);
        ev.dispatchEvent(new Event('input', { bubbles: true }));
    }

    openCreateFileDialog(sid) { this.targetScenarioForFile = sid; document.getElementById('cfName').value = ''; document.getElementById('cfContent').value = ''; document.getElementById('cfBackdrop').style.display = 'flex'; setTimeout(() => document.getElementById('cfName')?.focus(), 50); }
    
    openFilePicker(sid) {
        const input = document.querySelector(`input[type="file"][data-file="${sid}"]`); const ev = document.querySelector(`.evidence[data-evidence="${sid}"]`); if (!input || !ev) return;
        input.onchange = () => {
            const f = input.files && input.files[0]; if (!f) return;
            if (f.type && f.type.startsWith("image/")){ this.insertImage(f, ev, f.name); input.value = ""; return; }
            const r = new FileReader(); r.onload = () => { this.restoreSelectionAndInsert(ev, `<span class="attachment" contenteditable="false"><a href="${r.result}" download="${f.name}" data-name="${f.name}" data-dataurl="${r.result}"><span class="material-symbols-outlined" style="font-size:16px;">attachment</span> ${f.name}</a><span class="copy-att material-symbols-outlined" title="Copy file" data-copy="${r.result}" contenteditable="false">content_copy</span></span>&nbsp;`); input.value = ""; }; r.readAsDataURL(f);
        }; input.click();
    }
    
    insertImage(file, ev, altText) { const r = new FileReader(); r.onload = () => { this.restoreSelectionAndInsert(ev, `<img src="${r.result}" alt="${altText || 'attached image'}" style="width:100%;" data-w="100" contenteditable="false" />&nbsp;`); }; r.readAsDataURL(file); }

    async copyAttachment(copyBtn, e) {
        e.preventDefault(); e.stopPropagation(); const span = copyBtn.closest('.attachment'); if (!span) return;
        try { const clone = span.cloneNode(true); const html = clone.outerHTML + "&nbsp;"; const text = clone.innerText || "Attachment"; await navigator.clipboard.write([new ClipboardItem({"text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" })})]); } catch(err) { alert("Copy failed. Try manual copy."); }
        const oldTxt = copyBtn.innerHTML; copyBtn.innerHTML = "check_circle"; setTimeout(() => copyBtn.innerHTML = oldTxt, 1500);
    }

    previewOrDownloadAttachment(a, e) {
        e.preventDefault(); const dataurl = a.dataset.dataurl; if (!dataurl) return; const name = a.dataset.name || a.getAttribute("download") || "attachment";
        const [meta, b64] = dataurl.split(","); const mime = (/data:(.*?);base64/.exec(meta) || [])[1] || "application/octet-stream";
        const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i); const blob = new Blob([arr], {type:mime});
        const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || ""; const isText = !["doc", "docx", "xls", "xlsx", "pdf", "zip", "tar", "gz", "exe", "dll"].includes(ext) && (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('sql') || mime.includes('javascript') || mime.includes('plain'));
        if (isText) { const r = new FileReader(); r.onload = (re) => { document.getElementById('fpTitle').textContent = name; document.getElementById('fpContent').textContent = re.target.result; document.getElementById('filePreviewBackdrop').style.display = 'flex'; document.getElementById('fpDownloadBtn').onclick = () => { const u = URL.createObjectURL(blob); const t = document.createElement("a"); t.href = u; t.download = name; document.body.appendChild(t); t.click(); setTimeout(() => { t.remove(); URL.revokeObjectURL(u); }, 500); }; }; r.readAsText(blob); return; }
        const url = URL.createObjectURL(blob); const tmp = document.createElement("a"); tmp.href = url; tmp.download = name; document.body.appendChild(tmp); tmp.click(); setTimeout(() => { tmp.remove(); URL.revokeObjectURL(url); }, 500);
    }
}