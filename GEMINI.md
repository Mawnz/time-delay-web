# Project Context: Time Delay Video Playback (Phase 3 Complete)

> [!IMPORTANT]
> **Status**: Phase 3 Pro Analysis & Fluidity COMPLETE.
> The app now features a full gesture engine (swipe-to-scrub, pinch-zoom, two-finger pan), frame-precise stepping, a clean popover-based UI, and hardened recording/session management. Phase 4 begins next.

## Core Stack
- **Framework**: React Native 0.84.1 (Bare CLI)
- **Camera**: `react-native-vision-camera` (v4+) — **CRITICAL**: Use `androidPreviewViewType="texture-view"` for layering.
- **Video Playback**: `react-native-video` v6 — **CRITICAL**: Use `useTextureView={true}` and `opacity: 0.99` for stable z-index layering on Android. Video refs must be typed as `VideoRef` (not `typeof Video`).
- **Storage**: SQLite (`react-native-sqlite-storage`) with composite indexing on `(sessionId, timestamp)` **and** `id`-based next-segment lookups.
- **UI**: Custom `PanResponder` components. Logic decoupled into `useRecorder`, `usePlayerSync`, `useSessionData`. UI components split into `StatusPill`, `MenuButton`, `SettingsMenu`, `ControlBar`, `ZoomControls`.

## Key Technical Solutions

### 1. Seamless Seeking (Ping-Pong Seek)
- **Problem**: Changing segments normally causes a black frame flash on Android.
- **Solution**: Background pre-load strategy. Target segment is loaded into the hidden idle player; foreground player stays frozen until `onReadyForDisplay` fires, then players swap. Lives in `SeamlessPlayer.tsx`.

### 2. Absolute UI Overlay Layering
- **Problem**: Android's video player covers UI elements due to hardware layer prioritisation.
- **Solution**: Two independent layers. Layer 1 (Bottom) = video only. Layer 2 (Top) = absolute `uiOverlay` with high `zIndex`/`elevation`.

### 3. Professional Timeline
- **Adaptive Ruler**: Dynamic time-scale adjusting label frequency by `zoomLevel`.
- **Gapless Filmstrip**: Thumbnails sized `width = segmentDuration * zoomLevel`.
- **Selection Dimming**: Regions outside A-B loop are dimmed for contrast.

### 4. PIP Minimize Logic
- **Always-Active Capture**: Camera stays mounted even when preview is hidden.
- **Visual Toggle**: Tap PiP to shrink to a near-zero area; recording continues uninterrupted.

### 5. Gesture Engine (`VideoGestureSurface.tsx`)
- **Single-finger horizontal swipe** → scrub via `handleSeek`, throttled to 80ms.
- **Pinch** → scale video viewport up to 5×, applied via `transform` on the player wrapper View.
- **Two-finger pan** → translate zoomed viewport.
- Gesture mode is **locked on grant** (`'scrub' | 'zoom' | 'pan' | 'none'`) to prevent mid-gesture switching.
- `passThrough={true}` when annotation drawing is active — gesture surface renders `null`.

### 6. Frame Stepping (`usePlayerSync.stepFrame`)
- Steps by `1/30` s (configurable `FRAME_DURATION_S` constant).
- Bypasses `isSeekingRef` guard so it always responds while paused.
- Auto-pauses playback on first step tap.

### 7. Visual Seek Indicator (`SeekIndicator.tsx`)
- Animated `MM:SS.f` overlay; fades in 120ms, out 280ms.
- `pointerEvents="none"` — never blocks touches.

### 8. Thumbnail Flash Fix
- `ThumbnailQueue.ts` uses `InteractionManager.runAfterInteractions` + 2000ms idle buffer before calling `createThumbnail`.
- Prevents the heavy JPEG decode from coinciding with the camera segment surface switch.

### 9. Segment Continuity Fix
- `PlayerEngine.getNextSegment()` now queries `WHERE id > currentId` (not by timestamp offset).
- New `Database.getSegmentsAfterId()` method immune to timestamp drift between segments.

### 10. Graceful Recording Transitions
- `useRecorder` exposes `isRecordingTransition` (bool).
- Both `startRecording` and `stopRecording` use try/finally, preventing stuck state on error.
- `StatusPill` and `ControlBar` both reflect and disable interaction during transitions.

### 11. Session Protection
- `SessionManager` accepts `activeSessionId` prop.
- Active session is **filtered out** of the list — cannot be seen or deleted while recording.
- All delete actions require `Alert` confirmation.

### 12. Clean UI Architecture
- **Top bar**: `StatusPill` (left) + PiP camera (centre) + `MenuButton ⋯` (right) — exactly 3 elements.
- **`SettingsMenu`**: bottom-sheet `Modal` containing delay, sync, follow, camera flip, focus lock, mute, sessions.
- **`ControlBar`**: LOOP | CLEAR | ⏮ | ●REC | ⏭ | speed | play/pause — 7 buttons, no overflow.

## Performance Optimisation
- **Database**: Targeted SQL (`getSegmentAtTime`, `getSessionStart`, `getSegmentsAfterId`). No full-table scans.
- **Rendering**: Memoised `StatusPill`, `ControlBar`, `ZoomControls`, `SettingsMenu`. Seek indicator uses `useNativeDriver`.
- **Gestures**: All PanResponder state in refs — zero re-renders in the gesture hot path.
- **Timeline**: Manual viewport windowing for thumbnail virtualisation.

## Environment & Build
- **JDK**: 17
- **NDK**: 27.1.12297006
- **Gradle**: 8.13
- **Build Optimisation**: Unset `_JAVA_OPTIONS`; set `org.gradle.jvmargs=-Xmx12288m`.

## Current File Structure
```
App.tsx                          ← Main orchestrator (clean, 280 lines)
src/
  components/
    SeamlessPlayer.tsx           ← Ping-pong dual-player (muted prop added)
    VideoGestureSurface.tsx      ← [NEW P3] Scrub / zoom / pan gesture engine
    SeekIndicator.tsx            ← [NEW P3] Animated time overlay during scrub
    Timeline.tsx                 ← Filmstrip + A-B loop + ruler
    AnnotationOverlay.tsx        ← Touch drawing layer
    SessionManager.tsx           ← Session list (active session protected)
    UIComponents.tsx             ← StatusPill, MenuButton, SettingsMenu, ControlBar, ZoomControls
  engines/
    RecorderEngine.ts            ← Segment capture loop
    PlayerEngine.ts              ← Segment lookup (id-based, not timestamp-based)
    ThumbnailQueue.ts            ← Deferred background JPEG generation
    ExportEngine.ts              ← Clip export
  hooks/
    useRecorder.ts               ← Permissions + recording with transition states
    usePlayerSync.ts             ← Dual-player seek coordination + stepFrame()
    useSessionData.ts            ← Incremental SQLite polling
  storage/
    db.ts                        ← SQLite schema + queries (incl. getSegmentsAfterId)
  types/
    index.ts                     ← Session, Segment, Thumbnail, DrawingPath
```
