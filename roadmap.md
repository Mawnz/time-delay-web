# Roadmap — Time Delay Video Analysis (React Native)

> **Note**: This roadmap was originally written for the Capacitor/web prototype (now in `legacy/`).
> Phases 1–3 below reflect the **React Native rewrite** milestones. See `CHANGELOG.md` for detailed history.

## Phase 1: React Native Migration (`✅ DONE`)
- Bare CLI project, `react-native-vision-camera`, `react-native-video`, SQLite persistence.
- 5-second segmented MP4 recording loop.

## Phase 2: Performance & Professional Timeline (`✅ DONE`)
- Seamless ping-pong seeking (dual `Video` component swap, zero black-flash).
- Professional timeline: adaptive ruler, gapless filmstrip, A-B selection dimming.
- Hook extraction (`useRecorder`, `usePlayerSync`, `useSessionData`).
- Android layering fix (`texture-view` + `opacity: 0.99`).
- SQLite composite index + targeted queries (no full-table scans).

## Phase 3: Pro Analysis & Fluidity (`✅ DONE`)
- **Gesture Engine**: swipe-to-scrub, pinch-zoom (1×–5×), two-finger pan.
- **Frame Stepping**: ⏮ / ⏭ buttons, `1/30 s` precision, auto-pause.
- **Seek Indicator**: animated `MM:SS.f` overlay during scrubbing.
- **Focus Lock + Audio Mute**: toggles in `SettingsMenu`.
- **Clean UI**: `StatusPill` + `MenuButton ⋯` top bar; bottom-sheet settings menu.
- **Bug fixes**: thumbnail flash, choppy playback (id-based segment lookup), active-session delete protection, graceful recording transitions.

## Phase 4: Next-Generation Features (`PLANNED`)



### 1.1 Secure Environment Setup (Mobile Access) (`✅ DONE`)
*   **Objective:** Enable reliable camera access on mobile devices by ensuring the development environment supports HTTPS.
*   **Status:** The `README.md` has been updated with guidance on using `ngrok` to serve the application over HTTPS for mobile testing.

### 1.2 UI/UX Refinement (`✅ DONE`)
*   **Objective:** Enhance the user interface for clarity, intuitiveness, and ease of use, especially on touch devices.
*   **Status:** All text-based buttons have been replaced with icons, and visual indicators for recording have been added.

### 1.3 Production Build Process (`✅ DONE`)
*   **Objective:** Establish a robust process for building and deploying the application efficiently.
*   **Status:** A `build` script has been added to `package.json`.

## Phase 2: Advanced Analysis Tools (Looping & Clipping) (`✅ DONE`)

### 2.1 Timeline Range Selection (A/B Points) (`✅ DONE`)
*   **Objective:** Allow users to precisely select a specific segment of the video for focused analysis.
*   **Status:** The "Set A" / "Set B" buttons were replaced with a more intuitive draggable and resizable timeline highlight, created via a "Create Loop" button.

### 2.2 Loop Playback Functionality (`✅ DONE`)
*   **Objective:** Enable continuous, repetitive playback of a selected video segment.
*   **Status:** A "Loop" toggle button has been implemented to control looping within the selected A-B range.

### 2.3 Segment Export (`✅ DONE`)
*   **Objective:** Provide the ability to export only the relevant portions of a recording.
*   **Status:** An "Export Clip" button has been implemented to export the selected A-B range as a JSON file.

## Phase 3: Final Polish & Performance (`✅ DONE`)

### 3.1 Performance Optimization (`✅ DONE`)
*   **Objective:** Ensure smooth performance and responsiveness, especially for long recording sessions.
*   **Tasks:**
    *   **Virtualized Timeline:** This was attempted but introduced instability. The feature was deferred in favor of a simpler, more stable timeline implementation that works well for moderately sized sessions.
    *   **Database Query Optimization:** Queries were reviewed and deemed sufficiently optimized for the current implementation.

### 3.2 Annotation Enhancements (`✅ DONE`)
*   **Objective:** Expand the functionality and usability of the video annotation tools.
*   **Status:** The annotation tools now support changing line color and width, as well as undo/redo functionality.

## Phase 4: Next-Generation Features (`PLANNED`)

### 4.1 Advanced Timeline Control
*   **Objective:** Overhaul the timeline to support advanced navigation and viewing options for professional-grade analysis.
*   **Tasks:**
    *   **Timeline Zoom:** Implement pinch-to-zoom and scroll-wheel zoom functionality on the timeline.
    *   **Responsive Thumbnails:** Dynamically resize thumbnails based on the zoom level.
    *   **Thumbnail Virtualization:** To maintain performance on long recordings, implement a strategy to only render necessary thumbnails (e.g., showing every Nth thumbnail when zoomed out).

### 4.2 Enhanced Touch Experience
*   **Objective:** Improve usability on touch devices by moving beyond standard browser controls.
*   **Tasks:**
    *   **Touch-Based Navigation:** Implement intuitive touch gestures for timeline interaction, such as two-finger panning and pinch-to-zoom.
    *   **Refined Controls:** Review and adapt all controls for better ergonomics on touchscreens.

### 4.3 Core Functionality Enhancements
*   **Objective:** Add highly-requested features to improve the tool's utility and flexibility.
*   **Tasks:**
    *   **Video Clip Export:** Allow users to export the selected A-B loop area as a downloadable video file (e.g., MP4/WebM).
    *   **Configurable Playback Delay:** Add a user setting to adjust the live playback delay (range: 5-120 seconds).
    *   **"Snap to Live" Mode:**
        *   Modify auto-scrolling to only occur when the user is scrolled to the far-right of the timeline.
        *   Add a "Go Live" button to immediately jump playback to the live-delay point.

### 4.4 Cross-Platform Deployment
*   **Objective:** Package the web application for native mobile deployment, expanding its reach.
*   **Tasks:**
    *   **Capacitor Integration:** Integrate Capacitor to build and deploy the application as native iOS and Android apps from the existing web codebase.