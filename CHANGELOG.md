# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.1.0] — 2026-03-28 · Bug Fixes & UX Hardening

### Fixed
- **Thumbnail flash**: `ThumbnailQueue` now uses `InteractionManager.runAfterInteractions` + a 2 000 ms idle buffer before decoding thumbnails. The flash was caused by the JPEG decode coinciding with the camera segment surface switch.
- **Choppy / jumpy playback**: `PlayerEngine.getNextSegment` previously queried by `timestamp + 100 ms` offset, which was sensitive to clock drift between segments. It now queries `WHERE id > currentSegmentId` via a new `Database.getSegmentsAfterId()` method — fully immune to timing gaps.
- **Active session deletion**: `SessionManager` now accepts an `activeSessionId` prop. The recording session is filtered out of the list entirely — it cannot be seen or deleted while recording is in progress.
- **No confirmation on delete**: All session deletions now require an `Alert` confirmation dialog.

### Changed
- **UI declutter — top bar**: Replaced the 7-button `TopHud` with a minimal two-element bar: `StatusPill` (record toggle, left) and `MenuButton ⋯` (right). The PiP camera sits cleanly between them with no overlap.
- **Settings moved to bottom-sheet**: A new `SettingsMenu` modal (bottom-sheet style) houses: delay stepper, sync-to-live, follow playhead, camera flip, focus lock, mute audio, and sessions — accessible via the `⋯` button.
- **Graceful recording transitions**: `useRecorder` now exposes `isRecordingTransition`. Both `startRecording` and `stopRecording` use try/finally so the transition state always clears, even on error. The `StatusPill` shows `STARTING…` / `STOPPING…` and is non-interactive during transitions.
- **`SessionManager` redesign**: Bottom-sheet layout, glassmorphism styling, tap-row-to-load UX.
- **`ControlBar`** trimmed to: LOOP | CLEAR | ⏮ | ● REC | ⏭ | speed | play/pause. Focus Lock and Mute moved to `SettingsMenu`.
- **`ZoomControls`**: Separator line added between + and − buttons.

### Added
- `Database.getSegmentsAfterId(sessionId, afterId)` — id-based next-segment lookup.
- `isRecordingTransition` exported from `useRecorder`.

---

## [3.0.0] — 2026-03-28 · Phase 3: Pro Analysis & Fluidity

### Added
- **`VideoGestureSurface.tsx`** — Transparent `PanResponder` layer above the video:
  - Single-finger horizontal swipe → scrub timeline (`Δtime = -Δx / zoomLevel`, throttled to 80 ms).
  - Pinch → scale video viewport (1×–5×, applied as CSS `transform` on the player wrapper, safe for Android).
  - Two-finger pan → translate zoomed viewport.
  - Gesture mode is locked on grant (`scrub | zoom | pan`) preventing mid-gesture conflicts.
  - `passThrough={true}` when annotation drawing is active; gesture surface renders `null`.
- **`SeekIndicator.tsx`** — Animated `MM:SS.f` time overlay that appears during scrubbing. Fades in 120 ms / out 280 ms. `pointerEvents="none"`.
- **`stepFrame(direction: 1 | -1)`** in `usePlayerSync` — Steps exactly `1/30 s` per tap, bypasses seek guard so it works while paused, clamps to `[0, duration]`.
- **Step buttons** (⏮ / ⏭) added to `ControlBar`; auto-pause playback on first tap.
- **Focus lock toggle** in `SettingsMenu` (amber highlight when active).
- **Audio mute toggle** in `SettingsMenu` (default: muted to prevent mic feedback loop).
- **`muted` prop** on `SeamlessPlayer` — forwarded to both `react-native-video` instances.
- **`duration` option** in `usePlayerSync` options — used by `stepFrame` clamping.
- **Video viewport transform** — `App.tsx` wraps `SeamlessPlayer` in a `View` with `scale / translateX / translateY` driven by gesture state.
- `VideoRef` (from `react-native-video`) used as the correct ref type for Video player refs.

### Changed
- `SeamlessPlayer`: `muted` prop added; player refs typed as `VideoRef` (was `Video`).
- `usePlayerSync`: accepts `duration` in options object.
- `UIComponents`: full glassmorphism pass — `borderRadius: 12` across all HUD surfaces, consistent `border` tokens.

### Fixed
- Pre-existing TypeScript errors: `setTimeout`/`setInterval` returns cast to `NodeJS.Timeout`; `Video` ref type corrected to `VideoRef`; `collapsable` prop on `TouchableOpacity` suppressed via spread cast.

---

## [2.0.0] · Phase 2: Optimisation

### Added
- Seamless ping-pong seeking via dual `Video` component swap in `SeamlessPlayer`.
- Professional timeline: adaptive ruler, gapless filmstrip, A-B selection dimming.
- `useRecorder`, `usePlayerSync`, `useSessionData` hook extraction.
- SQLite composite index on `(sessionId, timestamp)`.
- Memoised `TopHud`, `ControlBar`, `ZoomControls` to prevent re-renders.
- `getSegmentAtTime` and `getSessionStart` targeted SQL queries (no full scans).
- Timeline manual viewport windowing (thumbnail virtualisation).
- PiP minimize: camera shrinks to 1×1px; recording continues uninterrupted.

### Fixed
- Android layering: `androidPreviewViewType="texture-view"` on Camera; `useTextureView={true}` + `opacity: 0.99` on Video.

---

## [1.0.0] · Phase 1: React Native Migration

### Added
- React Native 0.84.1 Bare CLI project replacing Capacitor web prototype.
- `react-native-vision-camera` for live capture.
- `react-native-video` for delayed playback.
- `react-native-sqlite-storage` for segmented session persistence.
- `react-native-create-thumbnail` for filmstrip generation.
- 5-second MP4 segment recording loop.
- Basic A-B loop, annotations, session list.

*Original Capacitor implementation preserved in `legacy/`.*
