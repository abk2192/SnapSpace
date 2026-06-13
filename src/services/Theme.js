/**
 * Theme Engine Service
 * Manages local storage persistency and DOM injections for App Theming
 */
class ThemeService {
    constructor() {
        this.currentTheme = localStorage.getItem('test_recorder_theme') || 'light';
        this.currentColor = localStorage.getItem('test_recorder_color') || 'blue';
        this.rootParams = document.documentElement;
    }

    applyTheme() {
        this.rootParams.setAttribute('data-theme', this.currentTheme);
        this.rootParams.setAttribute('data-color', this.currentColor);
        localStorage.setItem('test_recorder_theme', this.currentTheme);
        localStorage.setItem('test_recorder_color', this.currentColor);
        
        document.querySelectorAll('[data-set-theme]').forEach(el => { el.classList.toggle('active', el.dataset.setTheme === this.currentTheme); });
        document.querySelectorAll('[data-set-color]').forEach(el => { el.classList.toggle('active', el.dataset.setColor === this.currentColor); });
    }

    setTheme(theme) {
        this.currentTheme = theme; 
        this.applyTheme();
    }

    setColor(color) {
        this.currentColor = color;
        this.applyTheme();
    }
    
    getTheme() { return this.currentTheme; }
    getColor() { return this.currentColor; }
}

export const themeService = new ThemeService();