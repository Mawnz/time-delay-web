# Project Context: Time Delay Video Playback (Phase 2 Optimized)

> [!IMPORTANT]
> **Status**: Phase 2 Optimization COMPLETE.
> The application has been transformed from a prototype into a high-performance, professional-grade analysis tool. Seamless seeking, rock-solid layering, and a pro-level timeline are now fully implemented.

## Core Stack
- **Framework**: React Native 0.84.1 (Bare CLI)
- **Camera**: `react-native-vision-camera` (v4+) - **CRITICAL**: Use `androidPreviewViewType="texture-view"` for layering.
- **Video Playback**: `react-native-video` - **CRITICAL**: Use `useTextureView={true}` and `opacity: 0.99` for stable z-index layering on Android.
- **Storage**: SQLite (`react-native-sqlite-storage`) with composite indexing on `(sessionId, timestamp)`.
- **UI**: Custom `PanResponder` components with logic decoupled into specialized hooks (`useRecorder`, `usePlayerSync`, `useSessionData`).

## Key Technical Solutions

### 1. Seamless Seeking (Ping-Pong Seek)
- **Problem**: Changing segments normally causes a black frame flash on Android.
- **Solution**: Implemented a background pre-load strategy. When seeking to a new segment, the target is loaded into the **hidden idle player**. The foreground player stays frozen on its last frame. The players are only swapped once the background player fires `onReadyForDisplay`.

### 2. Absolute UI Overlay Layering
- **Problem**: Android's video player often covers standard UI elements due to hardware layer prioritization.
- **Solution**: Restructured the entire app into two independent layers. Layer 1 (Bottom) contains only the video player. Layer 2 (Top) is an absolute-positioned `uiOverlay` with high `zIndex` and `elevation`, housing all HUDs, controls, and the timeline.

### 3. Professional Timeline
- **Adaptive Ruler**: A dynamic time-scale that adjusts label frequency based on `zoomLevel`.
- **Gapless Filmstrip**: Thumbnails are precisely sized (`width = segmentDuration * zoomLevel`) to create a continuous, side-by-side video strip.
- **Selection Dimming**: Regions outside the A-B loop points are dimmed to provide high-contrast visual feedback.

### 4. PIP Minimize Logic
- **Always-Active Capture**: The camera stays mounted and active even when the preview is hidden. 
- **Visual Toggle**: Minimizing shrinks the camera to a 1x1 pixel area, allowing recording to continue uninterrupted while freeing up screen space.

## Performance Optimization
- **Database**: Replaced full-table scans with targeted SQL queries (`getSegmentAtTime`, `getSessionStart`).
- **Rendering**: Extracted and memoized UI sub-sections (`TopHud`, `ControlBar`, `ZoomControls`) to prevent expensive re-renders during high-frequency playhead updates.
- **Timeline**: Virtualized rendering (manual windowing) ensures only thumbnails in the current viewport are active in memory.

## Environment & Build
- **JDK**: 17
- **NDK**: 27.1.12297006
- **Gradle**: 8.13
- **Build Optimization**: Requires unsetting `_JAVA_OPTIONS` and setting `org.gradle.jvmargs=-Xmx12288m`.
