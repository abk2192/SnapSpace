export class ShortcutService {
    constructor() {
        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener("keydown", (e) => {
            // 1. Contextual Fix for Inputs inside Summaries
            if (e.target.matches("summary .header-name-input")) {
                if (e.key === " " || e.code === "Space") {
                    e.preventDefault();
                    if (!document.execCommand("insertText", false, " ")) {
                        const start = e.target.selectionStart; const end = e.target.selectionEnd;
                        e.target.value = e.target.value.substring(0, start) + " " + e.target.value.substring(end);
                        e.target.selectionStart = e.target.selectionEnd = start + 1;
                        e.target.dispatchEvent(new Event("input", {bubbles:true}));
                    }
                    return;
                }
                if (e.key === "Enter") { e.preventDefault(); e.target.blur(); return; }
            }

            // 2. Escape Key Handlers for Modals
            const modalIds = ["dlgBackdrop", "themeBackdrop", "docsBackdrop", "cfBackdrop", "exportBackdrop", "importBackdrop", "compareBackdrop", "filePreviewBackdrop", "imgPreviewBackdrop", "tplBackdrop", "moveBackdrop", "restoreBackdrop", "searchBackdrop"];
            const isAnyModalOpen = modalIds.some(id => { const el = document.getElementById(id); return el && (el.style.display === "flex" || el.style.display === "block"); });
            
            if (isAnyModalOpen) {
                if (e.key === "Escape") {
                    document.getElementById("dlgCancel")?.click(); document.getElementById("themeClose")?.click();
                    document.getElementById("docsCloseBtn")?.click(); document.getElementById("cfCancel")?.click();
                    document.getElementById("exportCancelBtn")?.click(); document.getElementById("importCancelBtn")?.click();
                    document.getElementById("compCloseBtn")?.click(); document.getElementById("fpCloseBtn")?.click();
                    document.getElementById("tplCloseBtn")?.click(); document.getElementById("moveCancelBtn")?.click();
                    document.getElementById("restoreCancelBtn")?.click();
                    const imgPreview = document.getElementById("imgPreviewBackdrop"); if (imgPreview) imgPreview.style.display = "none";
                }
                return; 
            }

            // 3. Global Combinations
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

            if (cmdOrCtrl && e.key.toLowerCase() === 's') { e.preventDefault(); document.getElementById("exportHtmlBtn")?.click(); }
            else if (cmdOrCtrl && e.key.toLowerCase() === 'o') { e.preventDefault(); document.getElementById("importBtn")?.click(); }
            else if (e.altKey) {
                const key = e.key.toLowerCase();
                if (key === 'n') { e.preventDefault(); document.getElementById("addScenarioBtn")?.click(); }
            }
        });
    }
}