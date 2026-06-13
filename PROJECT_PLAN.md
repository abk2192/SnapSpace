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
- [x] **Decouple `Store.js` Monolith** - Status: Completed. Stripped out the massive nested array structure from being saved natively. `Store.js` now dynamically rebuilds memory state from the flat IndexedDB on boot.
- [x] **Backward Compatibility Check** - Status: Completed. Restored `localStorage` v17 fallback in `Store.js` to ensure users skipping Phase 1/2 don't lose data.
- [x] **Project & Tab Dual-Writes (`MainPanelVM.js`)** - Status: Completed. Added explicit IndexedDB dual-writes for View and Project modifications.
- [x] **Project Dual-Writes (`SidebarVM.js`)** - Status: Completed. Updated `SidebarVM` to dual-write new and deleted projects to IndexedDB.
- [x] **Dynamic Tab Loading (`MainPanelView.js`)** - Status: Completed. Eliminated view reliance on the legacy memory structure. `MainPanelView` now asynchronously fetches directly from IndexedDB without visual flickering.
- [x] **Fix View Render Crash (`MainPanelView.js`)** - Status: Completed. Restored missing variables `daysWithNotes` and `tabCounts` by performing an asynchronous IndexedDB fetch within `renderTabs()`, fixing the broken dashboard and calendar UI.
- [x] **Fix Data Loss on Initial Boot (`Store.js`)** - Status: Completed. The default empty memory project wasn't being saved to the flat IndexedDB, causing newly created notes to orphan and vanish on page reload. Fixed by saving default bootstrap structure directly to IndexedDB.

## Feature Backlog
- [x] **Internal Note Linking:** Status: Completed. Added a "Copy Link" action to the Note Menu. Internal links are copied as clickable HTML blocks. Clicking these inside the editor routes the user to the target note, automatically switching workspaces and tabs if necessary.
- [x] **Inline Note Creation & Layout Fixes:** Status: Completed. "Add Note" now creates and focuses notes inline natively in the list view rather than launching the Quick Note modal. Added an expand icon to notes for launching the modal on demand. Fixed a desktop grid layout bug that caused a huge gap between the tabs and the note list.
- [x] **Note UI Refinement:** Status: Completed. Fixed a choppy layout glitch caused by the sticky summary header detaching and overlapping the note contents during inline creation. Refocused inline creation to immediately drop the user's cursor inside the WYSIWYG editor instead of the note title.
- [x] **Note Interaction UX Overhaul:** Status: Completed. Removed restrictive click interceptors. The WYSIWYG editor is now completely inline editable. Tapping the title directly modifies it, and tapping the background of an expanded title opens it in full view mode. Removed the obsolete expand/edit icons for a cleaner UI.
- [x] **Note UX Polish & Bug Fixes:** Status: Completed. Fixed click event bubbling where tapping the title text accidentally launched full view mode. Disabled pointer events on collapsed titles so users can click anywhere to expand. Fixed sticky toolbar overlapping text area upon note creation.
- [x] **UI Glitch Fixes:** Status: Completed. Restored scroll chaining so scrolling at the end of the Notes area naturally flows to the rest of the page. Bound the inline title input exactly to the character width so clicks to the side of the text perfectly register as background note expansion clicks.
- **Theme Expansion:** Add more accent colors or UI modes.

## Last Active Files
- `/src/views/MainPanelView.js`
- `/PROJECT_PLAN.md`