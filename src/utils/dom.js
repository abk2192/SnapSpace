/**
 * Core DOM Utilities
 */

export function escapeHtml(str) { 
    return String(str).replace(/[&<>"']/g, s => ({"&":"&","<":"<",">":">",'"':"&quot;","'":"&#39;"}[s])); 
}

export function escapeAttr(str) { 
    return escapeHtml(str).replace(/"/g, "&quot;"); 
}

export function uid() { 
    return Math.random().toString(36).slice(2) + Date.now().toString(36); 
}

export function moveCursorToEnd(el) { 
    el.focus(); 
    const range = document.createRange(); 
    range.selectNodeContents(el); 
    range.collapse(false); 
    const sel = window.getSelection(); 
    sel.removeAllRanges(); 
    sel.addRange(range); 
}