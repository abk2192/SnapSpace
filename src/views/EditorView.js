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
        document.addEventListener("mousedown", (e) => { 
            if (e.target.closest('[data-cmd]')) e.preventDefault(); 
            if (e.target.type === 'checkbox' && e.target.classList.contains('editor-checkbox')) {
                const activeEl = document.activeElement;
                if (activeEl && typeof activeEl.blur === 'function') activeEl.blur();
            }
        });

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
        document.addEventListener("click", async (e) => {
            if (document.body.classList.contains("readonly") || e.target.closest('.qn-read-mode')) {
                const block = e.target.closest('.evidence div, .evidence p, .evidence li');
                if (block && e.target.tagName !== 'INPUT' && e.target.tagName !== 'A' && e.target.tagName !== 'IMG' && !e.target.closest('summary') && !e.target.closest('.copy-att')) {
                    const cb = block.querySelector('.editor-checkbox');
                    if (cb && (block.firstElementChild === cb || block.firstChild === cb || cb.parentNode === block)) {
                        e.preventDefault();
                        cb.checked = !cb.checked;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                    }
                }
            }

            const cmdBtn = e.target.closest('[data-cmd]');
            if (cmdBtn) {
                e.preventDefault(); const cmd = cmdBtn.dataset.cmd; let val = cmdBtn.dataset.val || null;
                
                if (cmd === 'closeKeyboard') {
                    const activeEl = document.activeElement;
                    if (activeEl && typeof activeEl.blur === 'function') activeEl.blur();
                    return;
                }

                if (cmd === 'createLink') {
                    val = await window.appPrompt("Enter the URL:"); if (!val) return;
                    if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
                    
                    const ev = cmdBtn.closest('.evidence-wrap').querySelector('.evidence');
                    if (ev) ev.focus();
                    if (this.savedRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(this.savedRange); }
                } else if (cmd === 'insertCheckbox') {
                    const ev = cmdBtn.closest('.evidence-wrap').querySelector('.evidence');
                    if (ev) {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount && ev.contains(sel.anchorNode)) {
                            let node = sel.anchorNode;
                            if (node.nodeType === 3) node = node.parentNode;
                            let block = node;
                            while (block && block !== ev && !['DIV', 'P', 'LI', 'TD', 'TH'].includes(block.tagName)) {
                                block = block.parentNode;
                            }
                            if (block === ev) document.execCommand('formatBlock', false, 'div');
                        }
                    }
                    document.execCommand("insertHTML", false, '<input type="checkbox" class="editor-checkbox" style="width:14px;height:14px;margin-right:6px;vertical-align:middle;cursor:pointer;" contenteditable="false">&nbsp;');
                    if (ev) ev.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                } else if (cmd === 'insertTable') {
                    document.execCommand("insertHTML", false, this.vm.generateTableHtml());
                    return;
                } else if (cmd === 'indent' || cmd === 'outdent') {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const ev = cmdBtn.closest('.evidence-wrap').querySelector('.evidence');
                        if (ev && ev.contains(sel.anchorNode)) {
                            if (ev === sel.anchorNode || (sel.anchorNode.nodeType === 3 && sel.anchorNode.parentNode === ev)) {
                                document.execCommand('formatBlock', false, 'div');
                            }
                            
                            let blocks = new Set();
                            const range = sel.getRangeAt(0);
                            Array.from(ev.children).forEach(child => {
                                if (['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(child.tagName)) {
                                    if (range.intersectsNode(child) || child.contains(sel.anchorNode) || child.contains(sel.focusNode)) {
                                        blocks.add(child);
                                    }
                                }
                            });
                            
                            if (blocks.size > 0) {
                                blocks.forEach(b => {
                                    let currentMargin = parseInt(b.style.marginLeft || '0', 10);
                                    if (cmd === 'indent') currentMargin += 24;
                                    else currentMargin = Math.max(0, currentMargin - 24);
                                    if (currentMargin > 0) b.style.marginLeft = currentMargin + 'px';
                                    else b.style.marginLeft = '';
                                });
                                ev.dispatchEvent(new Event('input', { bubbles: true }));
                                this.updateToolbarState();
                                return;
                            }
                        }
                    }
                } else if (cmd.startsWith('table')) {
                    const sel = window.getSelection(); let node = sel.anchorNode; if (node?.nodeType === 3) node = node.parentNode;
                    const cell = node?.closest('td, th'); const row = cell?.closest('tr'); const table = row?.closest('table.evidence-table');
                    if (table && cell && row) {
                        const cellIndex = Array.from(row.children).indexOf(cell);
                        if (cmd === 'tableAddRow') {
                            const newRow = document.createElement('tr');
                            Array.from(row.children).forEach(() => { const td = document.createElement('td'); td.innerHTML = '<br>'; newRow.appendChild(td); });
                            row.after(newRow);
                        } else if (cmd === 'tableAddCol') {
                            Array.from(table.rows).forEach(r => { const isHeader = r.parentElement.tagName.toLowerCase() === 'thead'; const newCell = document.createElement(isHeader ? 'th' : 'td'); newCell.innerHTML = '<br>'; if(r.children[cellIndex]) r.children[cellIndex].after(newCell); else r.appendChild(newCell); });
                        } else if (cmd === 'tableDelRow') {
                            row.remove(); if(table.rows.length === 0) table.remove();
                        } else if (cmd === 'tableDelCol') {
                            Array.from(table.rows).forEach(r => { if(r.children[cellIndex]) r.children[cellIndex].remove(); });
                            if(table.rows.length === 0 || table.rows[0].children.length === 0) table.remove();
                        }
                        const ev = cmdBtn.closest('.evidence-wrap').querySelector('.evidence'); if (ev) ev.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => this.updateToolbarState(), 10);
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
                e.preventDefault(); 
                if (evidenceLink.hasAttribute("data-internal-link") || (evidenceLink.getAttribute("href") || "").startsWith("#note/")) {
                    const sid = evidenceLink.dataset.internalLink || evidenceLink.getAttribute("href").split("#note/")[1];
                    if (window.mainPanelVM) window.mainPanelVM.openScenario(sid);
                } else {
                    window.open(evidenceLink.href, '_blank');
                }
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

        let tapMoved = false;
        document.addEventListener("touchstart", () => { tapMoved = false; }, { passive: true });
        document.addEventListener("touchmove", () => { tapMoved = true; }, { passive: true });
        document.addEventListener("touchend", (e) => {
            if (tapMoved) return;
            
            if (e.target.type === 'checkbox' && e.target.classList.contains('editor-checkbox')) {
                if (e.cancelable) e.preventDefault();
                const activeEl = document.activeElement;
                if (activeEl && typeof activeEl.blur === 'function') activeEl.blur();
                e.target.checked = !e.target.checked;
                e.target.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }

            if (document.body.classList.contains("readonly") || e.target.closest('.qn-read-mode')) {
                const block = e.target.closest('.evidence div, .evidence p, .evidence li');
                if (block && e.target.tagName !== 'INPUT' && e.target.tagName !== 'A' && e.target.tagName !== 'IMG' && !e.target.closest('summary') && !e.target.closest('.copy-att')) {
                    const cb = block.querySelector('.editor-checkbox');
                    if (cb && (block.firstElementChild === cb || block.firstChild === cb || cb.parentNode === block)) {
                        if (e.cancelable) e.preventDefault();
                        cb.checked = !cb.checked;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        }, { passive: false });

        document.addEventListener("change", (e) => {
            if (e.target.type === 'checkbox' && e.target.classList.contains('editor-checkbox')) {
                if (e.target.checked) e.target.setAttribute('checked', 'checked');
                else e.target.removeAttribute('checked');
                const ev = e.target.closest('.evidence');
                if (ev) {
                    let block = e.target;
                    while (block && block.parentElement && block.parentElement !== ev && !['DIV', 'P', 'LI', 'TD', 'TH'].includes(block.tagName)) {
                        block = block.parentElement;
                    }

                    if (block && !['DIV', 'P', 'LI', 'TD', 'TH'].includes(block.tagName)) {
                        const wrapper = document.createElement('div');
                        block.parentNode.insertBefore(wrapper, block);
                        let current = block;
                        while (current && current.tagName !== 'BR' && !['DIV', 'P', 'LI', 'TD', 'TH', 'TR', 'TABLE', 'TBODY', 'THEAD', 'UL', 'OL'].includes(current.tagName)) {
                            let next = current.nextSibling;
                            wrapper.appendChild(current);
                            current = next;
                        }
                        if (current && current.tagName === 'BR') wrapper.appendChild(current);
                        block = wrapper;
                    }

                    const baseIndent = parseInt(block.style.marginLeft || '0', 10);
                    const isChecked = e.target.checked;

                    // Apply visual styling instantly with smooth transition
                    block.style.transition = 'all 0.3s ease';
                    if (isChecked) {
                        block.style.textDecoration = 'line-through';
                        block.style.opacity = '0.5';
                        block.style.transform = 'scale(0.98) translateX(4px)';
                    } else {
                        block.style.textDecoration = '';
                        block.style.opacity = '1';
                        block.style.transform = 'scale(1) translateX(0)';
                    }

                    // Cascade to children instantly
                    let child = block.nextElementSibling;
                    while (child && child.nodeType === 1 && child.querySelector && child.querySelector('.editor-checkbox')) {
                        let childInd = parseInt(child.style.marginLeft || '0', 10);
                        if (childInd <= baseIndent) break;
                        const childCb = child.querySelector('.editor-checkbox');
                        if (childCb) {
                            childCb.checked = isChecked;
                            if (isChecked) childCb.setAttribute('checked', 'checked'); else childCb.removeAttribute('checked');
                            child.style.transition = 'all 0.3s ease';
                            if (isChecked) {
                                child.style.textDecoration = 'line-through'; child.style.opacity = '0.5'; child.style.transform = 'scale(0.98) translateX(4px)';
                            } else {
                                child.style.textDecoration = ''; child.style.opacity = '1'; child.style.transform = 'scale(1) translateX(0)';
                            }
                        }
                        child = child.nextElementSibling;
                    }

                    // Delay the DOM reorder to allow the animation to play
                    setTimeout(() => {
                        let firstPeer = block;
                        let currNode = block;
                        while (currNode.previousElementSibling && currNode.previousElementSibling.nodeType === 1 && currNode.previousElementSibling.querySelector && currNode.previousElementSibling.querySelector('.editor-checkbox')) {
                            let ind = parseInt(currNode.previousElementSibling.style.marginLeft || '0', 10);
                            if (ind < baseIndent) break;
                            if (ind === baseIndent) firstPeer = currNode.previousElementSibling;
                            currNode = currNode.previousElementSibling;
                        }

                        let bundles = [];
                        let currentBundle = [];
                        let currentBundleChecked = false;
                        currNode = firstPeer;
                        let lastNodeInGroup = firstPeer;

                        while (currNode && currNode.nodeType === 1 && currNode.querySelector && currNode.querySelector('.editor-checkbox')) {
                            let ind = parseInt(currNode.style.marginLeft || '0', 10);
                            if (ind < baseIndent) break;
                            
                            const cb = currNode.querySelector('.editor-checkbox');
                            currNode.style.transition = 'all 0.3s ease';
                            if (cb && cb.checked) {
                                currNode.style.textDecoration = 'line-through'; currNode.style.opacity = '0.5'; currNode.style.transform = 'scale(0.98) translateX(4px)';
                            } else {
                                currNode.style.textDecoration = ''; currNode.style.opacity = '1'; currNode.style.transform = 'scale(1) translateX(0)';
                            }

                            if (ind === baseIndent) {
                                if (currentBundle.length > 0) bundles.push({ elements: currentBundle, checked: currentBundleChecked });
                                currentBundle = [currNode];
                                currentBundleChecked = cb ? cb.checked : false;
                            } else {
                                if (currentBundle.length > 0) currentBundle.push(currNode);
                            }
                            lastNodeInGroup = currNode;
                            currNode = currNode.nextElementSibling;
                        }
                        if (currentBundle.length > 0) bundles.push({ elements: currentBundle, checked: currentBundleChecked });

                        const uncheckedBundles = bundles.filter(b => !b.checked);
                        const checkedBundles = bundles.filter(b => b.checked);
                        const newOrderElements = [...uncheckedBundles.flatMap(b => b.elements), ...checkedBundles.flatMap(b => b.elements)];
                        const originalElements = bundles.flatMap(b => b.elements);

                        let needsReorder = false; 
                        for (let i = 0; i < originalElements.length; i++) { 
                            if (originalElements[i] !== newOrderElements[i]) { needsReorder = true; break; } 
                        }

                        if (needsReorder) { 
                            const savedScrollY = window.scrollY;
                            const savedEvScroll = ev.scrollTop;
                            
                            const activeEl = document.activeElement;
                            const needsBlur = activeEl && ev.contains(activeEl);
                            if (needsBlur && typeof activeEl.blur === 'function') activeEl.blur();

                            const anchor = document.createElement('span'); 
                            lastNodeInGroup.parentNode.insertBefore(anchor, lastNodeInGroup.nextSibling); 
                            newOrderElements.forEach(item => anchor.parentNode.insertBefore(item, anchor)); 
                            anchor.remove(); 
                            
                            ev.scrollTop = savedEvScroll; window.scrollTo(window.scrollX, savedScrollY);
                            
                            if (needsBlur && typeof e.target.focus === 'function') e.target.focus({ preventScroll: true });
                        }

                        ev.dispatchEvent(new Event('input', { bubbles: true }));
                    }, 300);
                }
            }
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    let node = sel.anchorNode;
                    if (node && node.nodeType === 3) node = node.parentNode;
                    if (node && typeof node.closest === 'function') {
                        const ev = node.closest('.evidence');
                        if (ev) {
                            e.preventDefault();
                            const wrap = ev.closest('.evidence-wrap');
                            if (wrap) {
                                const btn = wrap.querySelector(`[data-cmd="${e.shiftKey ? 'outdent' : 'indent'}"]`);
                                if (btn) btn.click();
                            }
                            return;
                        }
                    }
                }
            }

            if (e.key === 'Backspace') {
                const sel = window.getSelection();
                if (sel && sel.isCollapsed && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    let node = range.startContainer;
                    let offset = range.startOffset;

                    if (node.nodeType === 3 && offset === 0) {
                        let prev = node.previousSibling;
                        if (prev && prev.nodeName === 'INPUT' && prev.classList.contains('editor-checkbox')) {
                            prev.remove();
                            e.preventDefault();
                            const evidence = node.closest('.evidence');
                            let block = node;
                            while (block && block.parentElement && block.parentElement !== evidence && !['DIV', 'P', 'LI', 'TD', 'TH'].includes(block.tagName)) { block = block.parentElement; }
                            if (block && ['DIV', 'P', 'LI', 'TD', 'TH'].includes(block.tagName)) { block.style.textDecoration = ''; block.style.opacity = ''; }
                            if (evidence) evidence.dispatchEvent(new Event('input', { bubbles: true }));
                            return;
                        }
                    } else if (node.nodeType === 1) {
                        let prev = node.childNodes[offset - 1];
                        if (prev && prev.nodeName === 'INPUT' && prev.classList.contains('editor-checkbox')) {
                            prev.remove();
                            e.preventDefault();
                            const evidence = node.closest('.evidence');
                            let block = node;
                            while (block && block.parentElement && block.parentElement !== evidence && !['DIV', 'P', 'LI', 'TD', 'TH'].includes(block.tagName)) { block = block.parentElement; }
                            if (block && ['DIV', 'P', 'LI', 'TD', 'TH'].includes(block.tagName)) { block.style.textDecoration = ''; block.style.opacity = ''; }
                            if (evidence) evidence.dispatchEvent(new Event('input', { bubbles: true }));
                            return;
                        }
                    }
                }
            }

            if (e.key !== 'Enter' || e.shiftKey) return;
        
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            let container = range.startContainer;
        
            if (container.nodeType === 3) container = container.parentNode;
            const evidence = container.closest('.evidence');
            if (!evidence) return;
        
            let block = container;
            while (block && block.parentElement !== evidence && !['DIV', 'P', 'LI', 'BODY'].includes(block.tagName)) {
                block = block.parentElement;
            }
            if (!block || block === evidence) return;
        
            const firstChild = block.firstElementChild || block.firstChild;
            if (firstChild && firstChild.nodeName === 'INPUT' && firstChild.type === 'checkbox' && firstChild.classList.contains('editor-checkbox')) {
                e.preventDefault();
                if (block.textContent.trim() === '') {
                    block.innerHTML = '<br>';
                    evidence.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
                
                document.execCommand('insertParagraph');
                document.execCommand('insertHTML', false, '<input type="checkbox" class="editor-checkbox" style="width:14px;height:14px;margin-right:6px;vertical-align:middle;cursor:pointer;" contenteditable="false">&nbsp;');
                
                // Clear inherited inline styles from the checked block
                const newSel = window.getSelection();
                if (newSel && newSel.rangeCount > 0) {
                    let newContainer = newSel.getRangeAt(0).startContainer;
                    if (newContainer.nodeType === 3) newContainer = newContainer.parentNode;
                    let newBlock = newContainer;
                    while (newBlock && newBlock.parentElement !== evidence && !['DIV', 'P', 'LI', 'TD', 'TH'].includes(newBlock.tagName)) {
                        newBlock = newBlock.parentElement;
                    }
                    if (newBlock && newBlock !== evidence) {
                        newBlock.style.textDecoration = '';
                        newBlock.style.opacity = '1';
                        newBlock.style.transform = 'scale(1) translateX(0)';
                    }
                }

                evidence.dispatchEvent(new Event('input', { bubbles: true }));
            }
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
            if(!content) { window.appAlert("File content cannot be empty."); return; }
            const ev = document.querySelector(`.evidence[data-evidence="${this.targetScenarioForFile}"]`);
            if(ev) {
                const blob = new Blob([content], { type: 'text/plain' }); const reader = new FileReader();
                reader.onload = () => { this.restoreSelectionAndInsert(ev, `<span class="attachment" contenteditable="false"><a href="${reader.result}" download="${name}" data-name="${name}" data-dataurl="${reader.result}"><span class="material-symbols-outlined" style="font-size:16px;">attachment</span> ${name}</a><span class="copy-att material-symbols-outlined" title="Copy file" data-copy="${reader.result}" contenteditable="false">content_copy</span></span>&nbsp;`); }; 
                reader.readAsDataURL(blob);
            }
            document.getElementById('cfBackdrop').style.display = 'none'; this.targetScenarioForFile = null;
        });

        document.getElementById('fpCloseBtn')?.addEventListener('click', () => { document.getElementById('filePreviewBackdrop').style.display = 'none'; this.activeAttachmentNode = null; });
        
        document.getElementById('fpSaveBtn')?.addEventListener('click', () => {
            const backdrop = document.getElementById('filePreviewBackdrop');
            if (backdrop.classList.contains('qn-read-mode')) {
                backdrop.classList.remove('qn-read-mode');
                document.getElementById('fpContent').readOnly = false;
                document.getElementById('fpTitleInput').readOnly = false;
                document.getElementById('fpSaveBtn').innerHTML = '<span class="material-symbols-outlined">check</span>';
                setTimeout(() => document.getElementById('fpContent').focus(), 50);
            } else {
                backdrop.classList.add('qn-read-mode');
                document.getElementById('fpContent').readOnly = true;
                document.getElementById('fpTitleInput').readOnly = true;
                document.getElementById('fpSaveBtn').innerHTML = '<span class="material-symbols-outlined">edit</span>';

                const newContent = document.getElementById('fpContent')?.value || "";
                const newTitle = document.getElementById('fpTitleInput')?.value || "attachment";
                if (this.activeAttachmentNode) {
                    const blob = new Blob([newContent], { type: 'text/plain' });
                    const reader = new FileReader();
                    reader.onload = () => {
                        this.activeAttachmentNode.dataset.dataurl = reader.result;
                        this.activeAttachmentNode.href = reader.result;
                        this.activeAttachmentNode.dataset.name = newTitle;
                        this.activeAttachmentNode.download = newTitle;
                        const temp = document.createElement('div'); temp.textContent = newTitle;
                        this.activeAttachmentNode.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">attachment</span> ${temp.innerHTML}`;
                        
                        const copyBtn = this.activeAttachmentNode.parentElement.querySelector('.copy-att');
                        if (copyBtn) copyBtn.dataset.copy = reader.result;
                        const ev = this.activeAttachmentNode.closest('.evidence');
                        if (ev) ev.dispatchEvent(new Event('input', { bubbles: true }));
                    };
                    reader.readAsDataURL(blob);
                }
            }
        });

        document.getElementById('fpCopyBtn')?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(document.getElementById('fpContent')?.value || "");
                const btn = document.getElementById('fpCopyBtn');
                btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span>';
                setTimeout(() => { btn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>'; }, 1500);
            } catch(err) { window.appAlert("Failed to copy text."); }
        });
        
        document.getElementById('fpDownloadBtn')?.addEventListener('click', () => {
            if (this.activeAttachmentNode) {
                const a = document.createElement("a");
                a.href = this.activeAttachmentNode.href;
                a.download = this.activeAttachmentNode.dataset.name || "download";
                document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); }, 500);
            }
        });
    }

    updateToolbarState() {
        document.querySelectorAll('.wysiwyg-toolbar .btn').forEach(b => b.classList.remove('active-format'));
        document.querySelectorAll('.tbl-controls').forEach(b => b.style.display = 'none');
        
        const sel = window.getSelection(); if (!sel || !sel.rangeCount) return; 
        let node = sel.anchorNode; if (node?.nodeType === 3) node = node.parentNode || null; if (!node || typeof node.closest !== 'function') return;
        const ev = node.closest('.evidence');
        if (ev) {
            const toolbar = ev.previousElementSibling;
            if (toolbar && toolbar.classList.contains('wysiwyg-toolbar')) {
                ['bold', 'italic', 'insertUnorderedList', 'insertOrderedList', 'strikeThrough'].forEach(cmd => { if (document.queryCommandState(cmd)) { const btn = toolbar.querySelector(`[data-cmd="${cmd}"]`); if (btn) btn.classList.add('active-format'); } });
            }
            
            const cell = node.closest('td, th');
            const row = cell?.closest('tr');
            const table = row?.closest('table.evidence-table');
            const wrap = ev.closest('.evidence-wrap');
            
            if (table && cell && row && wrap) {
                const wrapRect = wrap.getBoundingClientRect();
                const cellRect = cell.getBoundingClientRect();
                const top = cellRect.top - wrapRect.top;
                const left = cellRect.left - wrapRect.left;
                
                const rCtrl = wrap.querySelector('.tbl-row-controls');
                const cCtrl = wrap.querySelector('.tbl-col-controls');
                
                if (rCtrl) { 
                    rCtrl.style.display = 'flex'; 
                    rCtrl.style.top = `${top + cellRect.height}px`; 
                    rCtrl.style.left = `${left + cellRect.width / 2}px`; 
                    rCtrl.style.transform = `translateX(-50%)`;
                }
                if (cCtrl) { 
                    cCtrl.style.display = 'flex'; 
                    cCtrl.style.top = `${top + cellRect.height / 2}px`; 
                    cCtrl.style.left = `${left + cellRect.width}px`; 
                    cCtrl.style.transform = `translateY(-50%)`;
                }
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
        try { const clone = span.cloneNode(true); const html = clone.outerHTML + "&nbsp;"; const text = clone.innerText || "Attachment"; await navigator.clipboard.write([new ClipboardItem({"text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" })})]); } catch(err) { window.appAlert("Copy failed. Try manual copy."); }
        const oldTxt = copyBtn.innerHTML; copyBtn.innerHTML = "check_circle"; setTimeout(() => copyBtn.innerHTML = oldTxt, 1500);
    }

    previewOrDownloadAttachment(a, e) {
        e.preventDefault(); const dataurl = a.dataset.dataurl; if (!dataurl) return; const name = a.dataset.name || a.getAttribute("download") || "attachment";
        const [meta, b64] = dataurl.split(","); const mime = (/data:(.*?);base64/.exec(meta) || [])[1] || "application/octet-stream";
        const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i); const blob = new Blob([arr], {type:mime});
        const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || ""; 
        
        const binaryExts = ["doc", "docx", "xls", "xlsx", "pdf", "zip", "tar", "gz", "exe", "dll", "png", "jpg", "jpeg", "gif", "bmp", "mp3", "mp4", "wav"];
        const isText = !binaryExts.includes(ext) && (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('sql') || mime.includes('javascript') || mime.includes('plain') || mime === 'application/x-www-form-urlencoded' || ["txt", "md", "csv", "log"].includes(ext));
        
        if (isText) { 
            const r = new FileReader(); 
            r.onload = (re) => { 
                this.activeAttachmentNode = a;
                document.getElementById('fpTitleInput').value = name; 
                document.getElementById('fpContent').value = re.target.result;
                
                const backdrop = document.getElementById('filePreviewBackdrop');
                backdrop.classList.add('qn-read-mode');
                document.getElementById('fpContent').readOnly = true;
                document.getElementById('fpTitleInput').readOnly = true;
                document.getElementById('fpSaveBtn').innerHTML = '<span class="material-symbols-outlined">edit</span>';

                backdrop.style.display = 'flex'; 
            }; 
            r.readAsText(blob); 
            return; 
        }
        const url = URL.createObjectURL(blob); const tmp = document.createElement("a"); tmp.href = url; tmp.download = name; document.body.appendChild(tmp); tmp.click(); setTimeout(() => { tmp.remove(); URL.revokeObjectURL(url); }, 500);
    }
}