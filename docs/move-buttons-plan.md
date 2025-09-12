# Move Recording Controls to Main Overlay Plan

## Overview
This document outlines the plan to move the recording controls (Start, Stop, Pause) from the configuration screen to the main overlay window, creating a more streamlined user experience where recording can be controlled directly from the primary interface.

## Current State Analysis

### Existing Implementation
- **Recording Controls Location**: Currently located in `src/renderer/controls.html` within the "Recording Controls" section
- **Control Buttons**: Start Recording, Stop Recording, and Pause buttons with text labels and emoji icons
- **Functionality**: Implemented in `src/renderer/controls.js` with proper state management and timer functionality
- **Overlay Interface**: Main overlay (`src/renderer/overlay.html`) only contains window management controls (settings, minimize, close)
- **User Flow**: Users must open the config screen to start/stop recording, then return to overlay to view transcription

### Current Button Implementation
```html
<!-- Current controls.html implementation -->
<button id="start-recording" class="primary-button">
    <span class="icon">🎙️</span>
    Start Recording
</button>
<button id="stop-recording" class="secondary-button" disabled>
    <span class="icon">⏹️</span>
    Stop Recording
</button>
<button id="pause-recording" class="secondary-button" disabled>
    <span class="icon">⏸️</span>
    Pause
</button>
```

## Proposed Changes

### 1. UI Design Modifications

#### Overlay Window Enhancement (`src/renderer/overlay.html`)
- **Location**: Add recording controls to the `drag-handle` section, positioned between the drag area and existing window controls
- **Button Design**: 
  - Use single icons only: ▶️ (play/start), ⏹️ (stop), ⏸️ (pause)
  - Remove text descriptions for minimal design
  - Maintain consistent styling with existing window controls
- **Layout**: Horizontal arrangement with adequate spacing for touch/click interaction

#### Controls Window Simplification (`src/renderer/controls.html`)
- **Section Removal**: Completely remove the "Recording Controls" section (lines 45-69)
- **Layout Adjustment**: Reflow remaining sections to maintain visual balance
- **Retained Sections**: Appearance, Audio Settings, Whisper Settings, Export, Statistics

### 2. Functionality Migration

#### Core Recording Logic Migration (`src/renderer/overlay.js`)
The following functionality needs to be moved from `controls.js` to `overlay.js`:

- **State Management**:
  - `isRecording` boolean state
  - `recordingStartTime` timestamp tracking
  - `recordingTimer` interval management
  
- **Recording Methods**:
  - `startRecording()` - Initiate recording process
  - `stopRecording()` - End recording process
  - `pauseRecording()` - Pause/resume recording
  - `updateRecordingTimer()` - Timer display updates

- **Button State Management**:
  - Enable/disable button states based on recording status
  - Visual feedback for active recording state

#### IPC Communication Updates
- Ensure proper communication between overlay and main process for recording commands
- Maintain existing transcription data flow
- Synchronize recording state between windows when both are open

### 3. Visual Design Implementation

#### Button Styling (`src/renderer/overlay.css`)
```css
.recording-controls {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-right: 8px;
}

.recording-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: var(--control-bg);
    color: var(--text-primary);
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    -webkit-app-region: no-drag;
}

.recording-btn:hover {
    background: var(--control-hover);
}

.recording-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.recording-btn.active {
    background: rgba(255, 59, 48, 0.8);
    animation: pulse 1.5s ease-in-out infinite;
}
```

#### State Indicators
- **Active Recording**: Red background with subtle pulsing animation
- **Disabled States**: Reduced opacity for unavailable actions
- **Hover Effects**: Consistent with existing window control buttons

### 4. Technical Implementation Details

#### Button State Logic
```javascript
// State transitions
idle -> recording (play button clicked)
recording -> paused (pause button clicked)  
recording -> stopped (stop button clicked)
paused -> recording (play button clicked)
paused -> stopped (stop button clicked)
```

#### Recording Control Integration
- **Auto-start Removal**: Remove existing auto-start transcription behavior
- **Explicit Start**: Recording only begins when user clicks play button
- **State Persistence**: Handle recording state across window minimize/restore operations
- **Cleanup**: Proper resource cleanup on window close or app termination

### 5. File Modification Plan

#### Files to Modify
1. **`src/renderer/overlay.html`**
   - Add recording controls to drag-handle section
   - Maintain existing window control structure

2. **`src/renderer/overlay.css`**  
   - Add recording control button styles
   - Implement state-based visual indicators
   - Ensure proper spacing and layout

3. **`src/renderer/overlay.js`**
   - Migrate recording functionality from controls.js
   - Implement button event listeners
   - Update initialization to prevent auto-start

4. **`src/renderer/controls.html`**
   - Remove "Recording Controls" section entirely
   - Adjust remaining layout spacing

5. **`src/renderer/controls.js`**
   - Remove recording-related methods and event listeners
   - Cleanup unused DOM element references
   - Maintain settings and appearance functionality

### 6. User Experience Flow

#### New Workflow
1. **Application Launch**: User sees overlay window with recording controls immediately visible
2. **Start Recording**: Click play (▶️) button to begin transcription
3. **Active Recording**: Visual feedback shows recording is active, stop and pause buttons become available
4. **Control Recording**: Use stop (⏹️) or pause (⏸️) buttons as needed
5. **Settings Access**: Click settings (⚙️) button only for configuration, not recording control

#### Benefits
- **Reduced Friction**: No need to open config screen to start recording
- **Visual Clarity**: Recording status immediately visible in main interface
- **Simplified Workflow**: Single-window operation for primary use case
- **Maintained Functionality**: All existing features preserved, just relocated

### 7. Testing Considerations

#### Functional Testing
- Verify all recording states (idle, recording, paused) work correctly
- Test button enable/disable logic
- Confirm keyboard shortcuts still function (Escape key toggle)
- Validate recording timer accuracy

#### Cross-Window Testing  
- Ensure proper state synchronization when both overlay and controls windows are open
- Test settings changes from controls window affect overlay behavior
- Verify IPC communication remains stable

#### Visual Testing
- Confirm button styling matches existing overlay aesthetic
- Test hover states and active recording visual feedback
- Validate layout responsiveness and spacing

### 8. Implementation Timeline

#### Phase 1: UI Structure
1. Create recording controls HTML structure in overlay
2. Implement basic CSS styling for buttons

#### Phase 2: Functionality Migration  
1. Move recording methods from controls.js to overlay.js
2. Update event listeners and state management

#### Phase 3: Cleanup
1. Remove recording controls from controls.html/controls.js  
2. Update overlay.js to prevent auto-start behavior

#### Phase 4: Testing & Refinement
1. Test all recording functionality
2. Verify visual design meets requirements
3. Validate cross-window behavior

## Conclusion

This plan creates a more intuitive user experience by placing recording controls where they're most needed - directly in the main overlay interface. Users can now start, stop, and pause recording without leaving the primary transcription view, while maintaining access to detailed configuration options through the settings panel when needed.

The implementation maintains all existing functionality while improving the overall workflow and reducing the cognitive load on users who primarily need recording control rather than configuration management.