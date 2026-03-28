# Time Delay Video Playback

A professional-grade video analysis tool for sports coaching. Record a live camera feed and play it back with a configurable delay — watch what happened 1–60 seconds ago, in real time, with frame-precise control.

Built with React Native for Android.

---

## Features

### Core Engine
- **Configurable Delay** — 1 s to 60 s, adjustable live
- **Seamless Seeking** — Ping-pong dual-player eliminates black-flash between segments
- **Segmented Recording** — 5-second MP4 segments written continuously to SQLite

### Analysis Tools
- **Swipe to Scrub** — Horizontal swipe anywhere on the video seeks the timeline
- **Pinch-to-Zoom** — Up to 5× zoom to inspect technique details
- **Two-Finger Pan** — Move the zoomed viewport freely
- **Frame Stepping** — ⏮ / ⏭ buttons step exactly 1/30 s per tap (auto-pauses)
- **A-B Loop** — Long-press timeline to create a loop region; drag handles to refine
- **Playback Speed** — Toggle between 1× and 0.5× slow motion
- **Annotations** — Draw directly over the delayed video frame

### Timeline
- Adaptive time ruler (scale adjusts with zoom level)
- Gapless filmstrip thumbnails aligned to segment boundaries
- High-contrast A-B selection dimming

### Camera & Recording
- Front / rear camera swap (no recording interruption)
- PiP live preview — tap to minimise to a status badge
- Focus & exposure lock toggle
- Audio mute (default on, to prevent microphone feedback)
- Graceful start/stop with STARTING… / STOPPING… transition states

### Sessions
- Named sessions stored in SQLite with full segment and annotation history
- Active session is protected — cannot be deleted while recording
- Confirmation dialog before any session deletion

### UI
- Two-element top bar: `● REC / ○ READY` status pill + `⋯` settings menu
- Glassmorphism bottom-sheet settings panel (delay, sync, camera, focus, mute, sessions)
- Large seek-time overlay during scrubbing (fades automatically)

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React Native 0.84.1 (Bare CLI) |
| Camera | `react-native-vision-camera` v4 (`texture-view`) |
| Video | `react-native-video` v6 (`useTextureView`, `opacity: 0.99`) |
| Storage | `react-native-sqlite-storage` (composite + id indexes) |
| Thumbnails | `react-native-create-thumbnail` |

---

## Getting Started

### Prerequisites
- Node.js LTS
- Android Studio + SDK (API 34+)
- **JDK 17**
- **NDK 27.1.12297006**

### Install
```bash
npm install
```

### Android Build Tuning
In `android/gradle.properties`:
```
org.gradle.jvmargs=-Xmx12288m
```
Ensure `_JAVA_OPTIONS` is **unset** in your shell environment before building.

### Run (dev)
```bash
npx react-native start
# in another terminal:
npx react-native run-android
```

### Build (release bundle)
```bash
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

cd android && ./gradlew installDebug
```

---

## Architecture Notes

The app runs as two absolute-positioned layers to guarantee UI visibility over hardware video surfaces:

- **Layer 1 (bottom)**: `SeamlessPlayer` + `VideoGestureSurface`
- **Layer 2 (top)**: All HUDs, timeline, annotations, overlays

Logic is fully decoupled into three hooks:

| Hook | Responsibility |
|---|---|
| `useRecorder` | Permissions, segment recording, transition states |
| `usePlayerSync` | Dual-player coordination, seek, frame stepping |
| `useSessionData` | Incremental SQLite polling for thumbnails & duration |

See [`GEMINI.md`](./GEMINI.md) for the full technical context used during AI-assisted development.

---

*Original Capacitor/web prototype is preserved in `legacy/`.*
