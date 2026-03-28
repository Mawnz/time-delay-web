# Roadmap — Time Delay Video Analysis (React Native)

> **Note**: This roadmap was originally written for the Capacitor/web prototype (now in \legacy/\).
> Phases 1–3 below reflect the **React Native rewrite** milestones. See \CHANGELOG.md\ for detailed history.

## Phase 1: React Native Migration (? DONE)
- Bare CLI project, \eact-native-vision-camera\, \eact-native-video\, SQLite persistence.
- 5-second segmented MP4 recording loop.

## Phase 2: Performance & Professional Timeline (? DONE)
- Seamless ping-pong seeking (dual \Video\ component swap, zero black-flash).
- Professional timeline: adaptive ruler, gapless filmstrip, A-B selection dimming.
- Hook extraction (\useRecorder\, \usePlayerSync\, \useSessionData\).
- Android layering fix (\	exture-view\ + \opacity: 0.99\).
- SQLite composite index + targeted queries (no full-table scans).

## Phase 3: Pro Analysis & Fluidity (? DONE)
- **Gesture Engine**: swipe-to-scrub, pinch-zoom (1×–5×), two-finger pan.
- **Frame Stepping**: ? / ? buttons, \1/30 s\ precision, auto-pause.
- **Seek Indicator**: animated \MM:SS.f\ overlay during scrubbing.
- **Focus Lock + Audio Mute**: toggles in \SettingsMenu\.
- **Clean UI**: \StatusPill\ + \MenuButton ?\ top bar; bottom-sheet settings menu.
- **Persistent Issues & Performance Regressions**:
    - [ ] **Segment Boundary Jump**: 1-2s gap in video during segment transitions.
    - [ ] **PIP Depth**: Live preview falls behind delayed video on certain Android hardware.
    - [ ] **Scrubbing Jank**: Significant lag when scrubbing while recording is active.

## Phase 4: Next-Generation Features (PLANNED)
- **Zero-Gap Recording**: Overlap segment capture to eliminate footage loss.
- **Native Layer Refactor**: Final solution for Android hardware layering conflicts.
- **Side-by-side comparison**: Split-screen analysis of two different sessions.
- **Video clip export**: High-speed MP4 trimming of A-B regions.
- **iOS Support**: Port native optimizations to the iOS platform.
