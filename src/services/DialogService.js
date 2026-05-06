export const dialogService = {
    init() {
        // 1. Documentation Dialog
        const docsBtn = document.getElementById("docsBtn");
        const docsBackdrop = document.getElementById("docsBackdrop");
        const docsCloseBtn = document.getElementById("docsCloseBtn");
        docsBtn?.addEventListener("click", () => { document.body.classList.remove("sidebar-show"); if(docsBackdrop) docsBackdrop.style.display = "flex"; });
        docsCloseBtn?.addEventListener("click", () => { if(docsBackdrop) docsBackdrop.style.display = "none"; });
        docsBackdrop?.addEventListener("click", (e) => { if(e.target === docsBackdrop) docsBackdrop.style.display = "none"; });

        // 2. Theme UI Dialog 
        const themeBtn = document.getElementById("themeBtn");
        const themeBackdrop = document.getElementById("themeBackdrop");
        const themeClose = document.getElementById("themeClose");
        themeBtn?.addEventListener("click", () => { document.body.classList.remove("sidebar-show"); if(themeBackdrop) themeBackdrop.style.display = "flex"; });
        themeClose?.addEventListener("click", () => { if(themeBackdrop) themeBackdrop.style.display = "none"; });
        themeBackdrop?.addEventListener("click", (e) => { if(e.target === themeBackdrop) themeBackdrop.style.display = "none"; });

        // 3. File Preview Dialog
        const fpBackdrop = document.getElementById("filePreviewBackdrop");
        const fpCloseBtn = document.getElementById("fpCloseBtn");
        const fpCopyBtn = document.getElementById("fpCopyBtn");
        fpCloseBtn?.addEventListener("click", () => { if(fpBackdrop) fpBackdrop.style.display = "none"; });
        if(fpBackdrop) fpBackdrop.addEventListener("click", (e) => { if(e.target === fpBackdrop) fpBackdrop.style.display = "none"; });
        
        fpCopyBtn?.addEventListener("click", async () => {
            const textToCopy = document.getElementById("fpContent")?.textContent || "";
            try {
                if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(textToCopy); } 
                else {
                    const textArea = document.createElement("textarea"); textArea.value = textToCopy; textArea.style.position = "fixed"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea);
                }
                const orig = fpCopyBtn.innerHTML; fpCopyBtn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Copied!`;
                setTimeout(() => { fpCopyBtn.innerHTML = orig; }, 1500);
            } catch(err) { alert("Failed to copy text."); }
        });

        // 4. Image Lightbox
        const imgBackdrop = document.getElementById("imgPreviewBackdrop");
        if(imgBackdrop) imgBackdrop.addEventListener("click", () => { imgBackdrop.style.display = "none"; });

        // 5. Global Prompt Dialog Handlers
        this.dlgBackdrop = document.getElementById("dlgBackdrop");
        this.dlgTitle = document.getElementById("dlgTitle");
        this.dlgInput = document.getElementById("dlgInput");
        this.dlgHint = document.getElementById("dlgHint");
        this.dlgCancel = document.getElementById("dlgCancel");
        this.dlgOk = document.getElementById("dlgOk");
        this.dlgCallback = null;

        this.dlgInput?.addEventListener("keydown", (e) => { if(e.key === "Enter" && this.dlgBackdrop?.style.display === "flex") { e.preventDefault(); this.dlgOk?.click(); } });
        this.dlgCancel?.addEventListener("click", () => { if(this.dlgBackdrop) this.dlgBackdrop.style.display = "none"; if(this.dlgCallback) { this.dlgCallback(null); this.dlgCallback = null; } });
        this.dlgOk?.addEventListener("click", () => { const val = this.dlgInput?.value; if(this.dlgBackdrop) this.dlgBackdrop.style.display = "none"; const cb = this.dlgCallback; this.dlgCallback = null; if (cb) cb(val); });
        if(this.dlgBackdrop) this.dlgBackdrop.addEventListener("click", (e) => { if (e.target === this.dlgBackdrop) this.dlgCancel?.click(); });
    },

    prompt(title, initial, hint) {
        return new Promise((resolve) => {
            if(this.dlgTitle) this.dlgTitle.textContent = title; if(this.dlgHint) this.dlgHint.textContent = hint || ""; if(this.dlgInput) this.dlgInput.value = initial || "";
            this.dlgCallback = resolve; if(this.dlgBackdrop) this.dlgBackdrop.style.display = "flex"; setTimeout(() => this.dlgInput?.focus(), 0);
        });
    }
};