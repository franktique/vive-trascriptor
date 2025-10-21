# Menu Configuration & Theme Unification Plan
**Branch**: `menu-conf.theme`
**Date**: October 21, 2025

## Overview
This plan addresses two key UX improvements:
1. **Theme Mismatch**: Unify the purple-based control panel theme with the dark overlay theme
2. **Window Architecture**: Convert from dual-window to single-window with collapsible sidebar for settings

---

## Current State Analysis

### Theme Issues
- **Overlay (overlay.css)**: Uses dark transparent theme with white/gray text and system colors
  - Background: `rgba(0, 0, 0, 0.85)` (dark transparent)
  - Accent: System colors (green, orange, red)

- **Control Panel (controls.css)**: Uses purple gradient theme
  - Background gradient: `#667eea` to `#764ba2` (purple)
  - Accent: `#667eea` (blue-purple)
  - Styling: Light/bright with card-based layout

### Architecture Issues
- **Two separate windows**: Overlay (frameless, always-on-top) and Controls (traditional window)
- **Communication**: IPC-based message passing between windows
- **UX Problem**: Settings are hidden in separate window; need to switch context

---

## Implementation Plan

### Phase 1: Theme Unification
**Goal**: Make control panel visually consistent with overlay

#### Task 1.1: Create unified color palette
- [x] Define dark theme variables matching overlay aesthetics
- [x] Remove purple gradient (`--bg-gradient-start`, `--bg-gradient-end`)
- [x] Align all colors with overlay theme:
  - [x] Background: Dark semi-transparent to opaque black
  - [x] Text: White/light gray (matching overlay)
  - [x] Accents: System colors (blue, green, orange)
  - [x] Borders: Light gray/white with low opacity

#### Task 1.2: Update controls.css structure
- [x] Remove gradient backgrounds
- [x] Update section styling to match overlay aesthetic
- [x] Standardize spacing and typography with overlay
- [x] Apply dark theme variables consistently
- [x] Ensure high contrast and readability

#### Task 1.3: Test theme consistency
- [-] Verify both light and dark themes match
- [ ] Test high contrast mode compatibility
- [ ] Check accessibility compliance

---

### Phase 2: Single-Window Architecture with Sidebar
**Goal**: Merge overlay and control windows into one unified interface

#### Task 2.1: Redesign overlay.html structure
- [x] Create layout container with main content + sidebar
- [x] Implement flex-based layout:
  - [x] Main area: Transcript display (flex-grow)
  - [x] Sidebar: Settings panel (collapsible, fixed width when open)
- [x] Add hamburger menu / settings toggle button
- [x] Maintain current header controls (record, minimize, close)

#### Task 2.2: Merge controls.html into sidebar
- [x] Move all control panel sections into sidebar component
- [x] Maintain all functionality (transparency, font size, audio settings, etc.)
- [x] Create smooth open/close animations
- [x] Ensure sidebar is scrollable when content exceeds height

#### Task 2.3: Update window management (main.js)
- [x] Remove `createControlWindow()` function
- [x] Keep `createOverlayWindow()` as single window
- [x] Increase initial window width to accommodate sidebar
  - [x] New dimensions: 1000x600px (accommodates sidebar toggle)
- [x] Update window constraints and resizing logic (added minWidth/minHeight)
- [x] Remove control window IPC handlers
- [x] Update event listeners for unified window

#### Task 2.4: Consolidate renderer logic
- [x] Merge controls.js functionality into overlay.js
- [x] Update event handlers for sidebar toggle
- [x] Ensure state synchronization between main content and sidebar
- [x] Remove duplicate event listeners

#### Task 2.5: Update CSS for new layout
- [x] Create sidebar styles
- [x] Implement toggle animations (slide-in/out)
- [x] Responsive design for smaller screens
- [x] Ensure overlay transparency maintains integrity with sidebar content

#### Task 2.6: Update IPC communication
- [x] Keep preload.js secure IPC bridge
- [x] Remove window management IPC calls (removed 'show-controls' handler)
- [x] Consolidate all handlers into single window communication
- [x] Update overlay.js IPC event listeners (added setOpacity, setFontSize, setTheme)

#### Task 2.7: Test and refine
- [-] Verify all controls function in sidebar
- [ ] Test sidebar toggle functionality
- [ ] Check responsive design at various sizes
- [ ] Ensure transparency works correctly
- [ ] Test theme switching in unified interface
- [ ] Verify window state persistence

---

## Technical Details

### New Window Dimensions
```javascript
// Current
overlayWindow: 800x200
controlWindow: 400x300 (separate)

// After merge
unified: 1200x600 (approximate)
- Content area: 800px (transcript)
- Sidebar: 400px (when open)
- Collapsible to: 800px (when sidebar closed)
```

### CSS Architecture
```
overlay.css (expanded)
├── Layout variables
├── Theme variables (unified)
├── Main overlay styles
└── Sidebar styles
  ├── Sidebar container
  ├── Sidebar sections
  ├── Toggle animations
  └── Responsive breakpoints

controls.css (deprecated)
→ Functionality merged into overlay.css
```

### JavaScript Structure
```
overlay.js (expanded)
├── Overlay initialization
├── Transcript management
├── Sidebar toggle logic
├── Settings synchronization
├── IPC event handlers
└── State persistence

controls.js (deprecated)
→ Functionality merged into overlay.js
```

---

## Success Criteria

- [x] Plan documented and approved
- [ ] Control panel theme matches overlay (dark, consistent colors)
- [ ] Single window contains both transcript and settings
- [ ] Sidebar toggles smoothly with animation
- [ ] All settings functionality works in sidebar
- [ ] Theme switching works in unified interface
- [ ] Window state (position, size, sidebar state) persists
- [ ] Responsive design works at various screen sizes
- [ ] No functionality lost from original two-window setup
- [ ] Code is cleaner with reduced duplication

---

## Rollback Strategy

If issues arise:
1. Keep `createControlWindow()` code available in separate branch
2. Tag current working state before architecture changes
3. Can revert to dual-window if sidebar approach proves problematic

---

## Notes

- The transparent overlay effect should extend to the sidebar
- Consider whether sidebar should also be transparent or have slight opacity
- Settings button in header can toggle sidebar visibility
- May want to add a keyboard shortcut (e.g., `Ctrl+,` or `Cmd+,`) to toggle sidebar
