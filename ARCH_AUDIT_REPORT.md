# Architectural Audit Report: Time-Delay Video Analysis

**Expert**: `code-reviewer`
**Target**: Prototype Phase 1 Implementation
**Status**: Pass with Major Changes Recommended

## 1. Executive Summary
The prototype successfully implements the core "Time Delay" functionality using a React Native architecture. However, the current implementation relies on a "God Component" pattern in `App.tsx` and un-virtualized UI elements that will cause the application to stutter or crash during long recording sessions (>10 minutes).

## 2. Key Findings

### A. The "God Component" (`App.tsx`)
- **Problem**: `App.tsx` manages ~25 state variables, 10+ `useEffect` hooks, and directly handles recording loops, playback synchronization, and UI layouts.
- **Impact**: Any minor state change (like the 100ms playhead update) triggers a full re-render of the entire UI tree, including the camera and video components.
- **Refactor Target**: Extract `useRecorderEngine` and `usePlayerSync` custom hooks.

### B. Logic Leaks in Singletons
- **Problem**: `RecorderEngine` and `PlayerEngine` are global singletons that hold session-specific state and references (like `cameraRef`).
- **Impact**: Potential memory leaks if sessions aren't cleaned up correctly, and high risk of "stale reference" bugs if the UI unmounts while the engine is still recording.
- **Refactor Target**: Move engine instantiation into a `SessionContext` or custom hooks tied to the component lifecycle.

### C. Database & Bridge Bottlenecks
- **Problem**: Every 2 seconds, the app fetches *all* thumbnails and *all* segments for the current session from SQLite.
- **Impact**: As the session grows, the bridge payload increases linearly. For a 30-minute session, the JS thread will be choked by processing large JSON arrays.
- **Refactor Target**: Implement `Database.getLatestThumbnails(sessionId, sinceTimestamp)` and index the `timestamp` column.

### D. Memory Exhaustion (Timeline)
- **Problem**: `Timeline.tsx` uses `thumbnails.map()` to render every captured frame in a horizontal `ScrollView`.
- **Impact**: 1000 thumbnails = 1000 heavy `Image` instances. This will lead to an "Out of Memory" (OOM) crash on most Android devices.
- **Refactor Target**: Virtualize the timeline using `FlashList` or a custom windowing logic.

## 3. Proposed Refactoring Plan (Step 2 & 3)

### Phase 2.1: Hook Extraction
1. Create `src/hooks/useRecorder.ts`: Handle permissions, segment loop, and `isRecording` state.
2. Create `src/hooks/usePlayer.ts`: Handle `SeamlessPlayer` coordination, `handleSeek`, and `currentTime` tracking.
3. Create `src/hooks/useSessionData.ts`: Manage incremental DB polling for thumbnails and segments.

### Phase 2.2: Component Decoupling
1. Move `TopHud`, `ControlBar`, and `ZoomControls` into dedicated memoized components.
2. Implement an imperative `seek` method for the `Timeline` to update the playhead without full re-renders.

## 4. Final Verdict
The codebase is functionally complete but architecturally fragile. Proceeding to **Step 2: Logic Decoupling** is critical before adding more features.
