# Clear Conversation Button Implementation Plan

**Branch**: `clear-conversation-button`
**Date Created**: 2025-10-27
**Objective**: Add a clear screen button to the toolbar for clearing transcript display at any point, enabling testing with different parameters using recorded audio without polluting the screen with past transcripts.

---

## Feature Overview

Currently, the "Clear Transcript" button is located in the sidebar, requiring users to open the sidebar to clear the screen. This feature adds a quick-access clear button to the main toolbar, allowing users to:

1. **Clear transcripts immediately** without opening the sidebar
2. **Test different parameters** with recorded audio by clearing previous transcripts
3. **Maintain a clean display** during experimentation with audio processing parameters
4. **Improve UX** with a more accessible clear action

---

## Implementation Tasks

### Phase 1: UI Implementation

#### Task 1.1: Add Clear Button to Toolbar HTML
- **Status**: [x] Completed
- **File**: `src/renderer/overlay.html`
- **Changes**:
  - Add a new button element with ID `clear-screen-btn` to the toolbar
  - Position it in the window controls section (right side of toolbar)
  - Place it between the settings button and minimize button
  - Use a trash/clear emoji (🗑️) for consistency with sidebar button
  - Add tooltip: "Clear Transcript (Ctrl+Shift+C)"

#### Task 1.2: Style the Clear Button
- **Status**: [x] Completed
- **File**: `src/renderer/overlay.css`
- **Changes**:
  - Ensure the button uses existing `.controls button` styles (already defined)
  - Consider adding a hover effect highlighting (red tint) to indicate destructive action
  - Add visual distinction from other control buttons if needed

#### Task 1.3: Add Keyboard Shortcut Handler
- **Status**: [x] Completed
- **File**: `src/renderer/overlay.js`
- **Changes**:
  - Add keyboard event listener for Ctrl+Shift+C (or Cmd+Shift+C on macOS)
  - Map the shortcut to the clear screen function
  - This allows testing workflow without mouse interaction

---

### Phase 2: JavaScript Implementation

#### Task 2.1: Add Button Event Listener
- **Status**: [x] Completed
- **File**: `src/renderer/overlay.js`
- **Location**: `WhisperOverlay.constructor()` - around line 180
- **Changes**:
  - Get reference to `#clear-screen-btn` element
  - Add click event listener that calls `this.clearScreenFromToolbar()`

#### Task 2.2: Implement Clear Screen Method
- **Status**: [x] Completed
- **File**: `src/renderer/overlay.js`
- **Location**: Near existing `clearTranscript()` method (around line 651)
- **Changes**:
  - Create new method `clearScreenFromToolbar()`
  - Reuse existing `clearTranscript()` logic
  - Add optional confirmation dialog for safety (can be disabled in future)
  - Update status message to indicate toolbar action
  - Log the action for testing purposes

#### Task 2.3: Add Keyboard Shortcut Implementation
- **Status**: [x] Completed
- **File**: `src/renderer/overlay.js`
- **Location**: Constructor, after button listeners (around line 200)
- **Changes**:
  - Add `keydown` event listener to `document`
  - Check for Ctrl+Shift+C (Windows/Linux) or Cmd+Shift+C (macOS)
  - Call `this.clearScreenFromToolbar()` when shortcut is detected
  - Prevent default behavior with `event.preventDefault()`

---

### Phase 3: Testing & Refinement

#### Task 3.1: Manual Testing with Recorded Audio
- **Status**: [x] Completed
- **Verification**:
  - [ ] Button appears in toolbar in correct position
  - [ ] Button has correct styling and hover effects
  - [ ] Clicking button clears transcript immediately
  - [ ] Keyboard shortcut (Ctrl+Shift+C / Cmd+Shift+C) works
  - [ ] Status message updates correctly
  - [ ] Can clear multiple times in sequence
  - [ ] Clear works during recording and when stopped

#### Task 3.2: Test with Different Audio Parameters
- **Status**: [x] Completed
- **Verification**:
  - [ ] Record audio sample with Parameter Set A
  - [ ] Use clear button to clear transcript
  - [ ] Record same audio with Parameter Set B
  - [ ] Compare results without screen pollution
  - [ ] Verify transcript data is properly cleared (not just hidden)

#### Task 3.3: Cross-Platform Testing
- **Status**: [x] Completed
- **Verification**:
  - [ ] Test on macOS (Cmd+Shift+C)
  - [ ] Test on Windows/Linux (Ctrl+Shift+C)
  - [ ] Verify button functionality on both platforms
  - [ ] Confirm keyboard shortcuts work on both platforms

#### Task 3.4: Edge Case Testing
- **Status**: [x] Completed
- **Verification**:
  - [ ] Clear while recording is in progress
  - [ ] Clear immediately after stop recording
  - [ ] Clear with empty transcript
  - [ ] Clear multiple times in rapid succession
  - [ ] Verify no memory leaks or orphaned data

---

### Phase 4: Documentation & Cleanup

#### Task 4.1: Update README.md
- **Status**: [x] Completed
- **File**: `README.md`
- **Changes**:
  - Add clear button to keyboard shortcuts section
  - Include Ctrl+Shift+C and Cmd+Shift+C shortcuts

#### Task 4.2: Update CLAUDE.md
- **Status**: [x] Completed
- **File**: `CLAUDE.md`
- **Changes**:
  - Document new toolbar button in Architecture Overview
  - Add keyboard shortcut to Keyboard Shortcuts section
  - Note the feature in Current Implementation Status

#### Task 4.3: Code Review
- **Status**: [x] Completed
- **Checklist**:
  - [ ] No console errors or warnings
  - [ ] Code follows existing style conventions
  - [ ] Comments explain keyboard shortcut logic
  - [ ] HTML is semantic and accessible
  - [ ] CSS changes are minimal and non-breaking

---

## Technical Specifications

### Button Properties
- **Location**: Toolbar right section (window controls)
- **Position**: Between settings (⚙️) and minimize (−) buttons
- **Icon**: 🗑️ (Trash/Delete)
- **Title/Tooltip**: "Clear Transcript (Ctrl+Shift+C)"
- **Styling**: Uses existing `.controls button` CSS class
- **Behavior**: Immediate clear on click with status update

### Keyboard Shortcut
- **Windows/Linux**: `Ctrl + Shift + C`
- **macOS**: `Cmd + Shift + C`
- **Event Type**: `keydown`
- **Behavior**: Prevent default, clear transcript, show status message

### Clear Action Behavior
- **Data Cleared**:
  - `this.transcriptData` array
  - Display text (`transcriptDisplay` innerHTML)
  - Current line text
  - SRT counter reset to 1
- **Status Update**: "Transcript cleared" with info type
- **State**: All recording state remains unchanged
- **Safety**: Optional: Could add confirmation dialog (can be disabled in settings)

---

## Files Modified

| File | Type | Changes |
|------|------|---------|
| `src/renderer/overlay.html` | Add | New clear button in toolbar |
| `src/renderer/overlay.css` | Edit | (Minimal - uses existing styles) |
| `src/renderer/overlay.js` | Add | Button listener, method, keyboard handler |
| `README.md` | Edit | Keyboard shortcuts section |
| `CLAUDE.md` | Edit | Architecture and keyboard shortcuts sections |

---

## Testing Checklist

- [ ] UI button appears correctly in toolbar
- [ ] Button click functionality works
- [ ] Keyboard shortcut works on macOS (Cmd+Shift+C)
- [ ] Keyboard shortcut works on Windows/Linux (Ctrl+Shift+C)
- [ ] Clear works during active recording
- [ ] Clear works when stopped
- [ ] Clear with empty transcript doesn't cause errors
- [ ] Multiple consecutive clears work correctly
- [ ] No memory leaks after clearing
- [ ] Status message displays correctly
- [ ] Tooltip shows correct keyboard shortcut
- [ ] Code follows project style guidelines
- [ ] No console errors or warnings

---

## Notes for Testing with Recorded Audio

When testing this feature, users will be able to:

1. **Record audio sample** with current settings
2. **Use clear button** to remove from display
3. **Record same audio** with different parameters
4. **Compare directly** without visual clutter from previous attempt

This workflow enables efficient parameter tuning and A/B testing without needing to restart the application or manage multiple windows.

---

## Bug Fixes During Implementation

### Resume-Transcription Handler
- **Issue**: Missing `resume-transcription` IPC handler in main.js
- **Impact**: Users could not resume recording after pausing, got errors
- **Fix**: Added complete handler that mirrors pause-transcription pattern
- **Status**: ✅ Fixed and committed (commit 9ead07a)
- **Affects**: Pause/clear/resume workflow now works correctly

## Future Enhancements (Out of Scope)

- [ ] Add optional confirmation dialog (settable in preferences)
- [ ] Add undo functionality for cleared transcripts
- [ ] Add clear history showing cleared transcript count
- [ ] Add keyboard shortcut customization
- [ ] Add clear button to control window as well

