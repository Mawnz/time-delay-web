# Gapless Playback: React Native Implementation (Time Delay)

Patterns for seamless segmented MP4 playback in React Native (replacing MediaSource API).

## Core Architecture: "Ping-Pong" Player
Seamless playback is achieved by alternating between two pre-buffered `Video` components.

### 1. Dual-Player Logic
- `activePlayer`: Tracks which component ('A' or 'B') is currently playing.
- `nextSegment`: Pre-loaded by the idle player while the active player is running.
- `onSegmentEnd`: Swaps the `activePlayer` instantly for gapless transition.

### 2. Android Layering (Critical)
Android `SurfaceView` layering is problematic. For correct `zIndex` and PIP visibility:
- **Main Video**: Set `useTextureView={true}` and `opacity: 0.99`.
- **PIP Camera**: Set `androidPreviewViewType="texture-view"` and high `zIndex/elevation`.

### 3. Seek Stability
Use an `isSeekingRef` gate to prevent concurrent seek commands. Reset the gate in `onLoad` or after a short `setTimeout`.
```tsx
const handleSeek = async (time) => {
  if (isSeekingRef.current) return;
  isSeekingRef.current = true;
  // ... perform seek ...
  // reset on video load
};
```

### 4. Continuous Recording
- Segments: 5-second durations balance encoder overhead and playback latency.
- Thumbnails: Background `ThumbnailQueue` processing prevents UI lag during recording.
