# Time Delay Video Playback (React Native)

A high-performance video analysis tool for sports coaching. Capture a live camera feed and play it back with a configurable delay for instant feedback.

## Features
- **Configurable Delay**: Live delayed playback from 1s to 60s.
- **Gapless Playback**: "Ping-Pong" dual-player system for seamless segment transitions.
- **Stable Timeline**: Custom PanResponder-based timeline with absolute session positioning.
- **PIP Live Preview**: "Always-on-top" camera overlay using `texture-view` for perfect layering.
- **Looping & Slow-Mo**: +/- 3s auto-looping on thumbnails and 0.5x slow-motion playback.
- **Annotations**: Native touch-based drawing over delayed video for technical analysis.
- **Session Management**: Persistent SQLite storage for metadata and local MP4 segment management.

## Tech Stack
- **Framework**: React Native 0.84.1 (Bare CLI)
- **Camera**: `react-native-vision-camera` v4
- **Video**: `react-native-video` v6
- **Storage**: `react-native-sqlite-storage`
- **Annotations**: `react-native-svg`

## Getting Started

### Prerequisites
- Node.js (LTS)
- Android Studio / SDK (API 34+)
- **JDK 17**
- **NDK 27.1.12297006** (Required for C++20 support in vision-camera)

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure `android/gradle.properties`:
    ```properties
    org.gradle.jvmargs=-Xmx12288m
    ```
4.  **Important**: Unset the `_JAVA_OPTIONS` environment variable on your system if it limits memory (e.g., `-Xmx512M`).

### Build and Run (Android)
Generate the JS bundle and install the app on a connected device:
```bash
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android
./gradlew installDebug
```

## Architecture Notes
- **TextureView**: Both Camera and Video components use `TextureView` to enable standard `zIndex` and `elevation` layering on Android.
- **isSeekingRef**: Atomic gating is used during timeline seeking to prevent concurrent segment loading collisions.
- **Latest Props Ref**: Used in `Timeline.tsx` to prevent closure-related handle "jumps" during high-speed dragging.

---
*Note: The original Capacitor/Web implementation has been moved to the `legacy/` directory.*
