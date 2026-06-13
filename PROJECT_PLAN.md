# SnapSpace - Project Plan & Status

## Current Focus: Database Migration (Hierarchical to Flat)
The primary ongoing effort is migrating the application from a legacy hierarchical state (`workspace -> tabs -> scenarios`) to a fully flattened, relational data structure stored in IndexedDB.

### Phase 1: Background Migration (Completed)
- [x] IndexedDB Schema V2 designed (`projects`, `views`, `items`).
- [x] `migrateToFlatData()` script written in `Database.js` to run in the background upon app boot.

### Phase 2: Dual-Write & ViewModels (Completed)
Currently updating ViewModels to write to the new flat IndexedDB while maintaining the legacy memory array to prevent breaking the existing UI.
- [x] **Add/Delete Scenario Dual-Write (`MainPanelVM.js`)** - Status: Completed.
- [x] **Legacy Method Migration (`MainPanelVM.js`)** - Status: Completed.
- [x] **Asynchronous DB Call Support (`app.js`)** - Status: Completed.

### Phase 3: UI & State Decoupling (In Development)
- [ ] **Decouple `Store.js` Monolith** - Status: Upcoming. Strip out the massive nested array structure, retaining only active pointers (e.g., `activeWorkspaceId`, `activeTabId`).
- [ ] **Dynamic Tab Loading (`MainPanelView.js`)** - Status: Upcoming. Update `MainPanelView.js` and `MainPanelVM.js` to dynamically load items per tab via `dbService.getItemsByTab(tabId)` instead of reading from `store.tabs[x].scenarios`.
- [ ] **Clean Up Legacy Fallbacks** - Status: Upcoming. Remove legacy local storage fallbacks.

## Feature Backlog
- **Internal Note Linking:** Add capabilities to cross-link notes internally.
    - Add "Copy Internal Link" button in `index.html`.
    - Add link parser and click interceptor in `EditorView.js`.
    - Build internal routing/navigation logic in `app.js` / `MainPanelVM.js`.
- **Theme Expansion:** Add more accent colors or UI modes.

## Last Active Files
- `/src/viewmodels/MainPanelVM.js`
- `/app.js`