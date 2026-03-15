# Time Delay Video Playback (React Native)

A professional-grade, high-performance video analysis tool for sports coaching. Capture live camera feed and playback with configurable delay, seamless transitions, and advanced technical analysis tools.

## Key Features
- **Seamless Seeking (Ping-Pong)**: Instant, black-flash-free seeking across the entire session using background player pre-loading.
- **Professional Video Timeline**: 
    - Adaptive time ruler with dynamic scale markers.
    - Gapless filmstrip thumbnails perfectly aligned to video segments.
    - High-contrast selection engine with background dimming for A-B loops.
- **Absolute UI Overlay**: Guaranteed visibility of all controls and indicators on top of the video layer on Android.
- **PIP Minimize Mode**: Toggle the live preview to a compact badge without interrupting the background recording.
- **Performance Engine**: Targeted SQLite lookups and memoized UI components ensure smooth 60FPS interaction even in sessions lasting hours.
- **Annotations**: Native touch-based drawing over delayed video for technical analysis.

## Tech Stack
- **Framework**: React Native 0.84.1 (Bare CLI)
- **Camera**: `react-native-vision-camera` v4 (`texture-view` enabled)
- **Video**: `react-native-video` v6 (`useTextureView` enabled)
- **Storage**: `react-native-sqlite-storage` (Composite Indexed)
- **UI Architecture**: Custom Hooks (`useRecorder`, `usePlayerSync`, `useSessionData`)

## Getting Started

### Prerequisites
- Node.js (LTS)
- Android Studio / SDK (API 34+)
- **JDK 17**
- **NDK 27.1.12297006** (Required for C++20 support)

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  **Memory Tuning**: Set `org.gradle.jvmargs=-Xmx12288m` in `android/gradle.properties` and ensure `_JAVA_OPTIONS` is unset in your environment.

### Build and Run (Android)
```bash
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android
./gradlew installDebug
```

---
*Note: The original Capacitor/Web implementation has been moved to the `legacy/` directory.*
