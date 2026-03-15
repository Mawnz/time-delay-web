# Phase 3: Pro Analysis & Fluidity

This phase upgrades the "stable prototype" into a professional technical analysis tool with fluid gestures, frame-by-frame precision, and a "Pro Dark" design language.

## 1. Video Surface Gestures
- **Single-Finger Scrubbing**: Swipe left/right on the main video to scrub forward/backward.
- **Pinch-to-Zoom**: Multi-touch zoom on the video feed to inspect details (e.g., grip, posture).
- **Two-Finger Pan**: Move the zoomed-in video viewport.

## 2. Frame-by-Frame Precision
- **Precision Toggles**: Add micro-stepping buttons (+/- 1 frame) to the control bar.
- **Visual Seek Indicator**: Show a large, translucent time overlay in the center of the video during gesture-based scrubbing.

## 3. Native Polish & Controls
- **Exposure/Focus Lock**: Add a toggle to lock the camera's focus and exposure for consistent technical capture.
- **Audio Mute Toggle**: Dedicated button to mute/unmute delayed audio.
- **Glassmorphism UI**: Refine HUD backgrounds with modern translucent blurring and premium iconography.

## Implementation Roadmap

### Step 1: Gesture Engine
- Create `src/components/VideoGestureSurface.tsx`.
- Implement `PanResponder` for dual-mode detection (scrub vs zoom).
- Hook up `handleSeek` to the scrubbing gesture.

### Step 2: Precision Controls
- Implement `step(frames)` logic in `usePlayerSync`.
- Update `ControlBar` with modern iconography and micro-stepping buttons.

### Step 3: Pro Styling
- Standardize on a "Pro Sports" design system (High contrast, transparent overlays, consistent padding).
- Implement Exposure/Focus lock logic in `RecorderEngine`.

---

## Success Criteria
- [ ] **Fluid Scrubbing**: Users can seek the timeline by swiping anywhere on the video.
- [ ] **Zoom Analysis**: Users can pinch into the video to see technical details.
- [ ] **Pro Look**: The app feels like a premium technical analysis suite.
