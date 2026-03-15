# Project Context: Time Delay Video Playback (React Native Migration COMPLETE)

> [!IMPORTANT]
> **Status**: Successfully migrated from Capacitor to **React Native 0.84.1 (Bare CLI)**. 
> Seamless, high-performance video playback with live PIP is now fully functional on Android.

## Final Architecture: React Native

### Core Stack
- **Framework**: React Native 0.84.1
- **Camera**: `react-native-vision-camera` (v4+) - **CRITICAL**: Use `androidPreviewViewType="texture-view"` for layering.
- **Video Playback**: `react-native-video` - **CRITICAL**: Use `useTextureView={true}` and `opacity: 0.99` for stable z-index layering on Android.
- **Storage**: SQLite (`react-native-sqlite-storage`) for metadata; local FS for MP4 segments.
- **UI**: Custom custom PanResponder-based Timeline and Annotation engine.

### Key Technical Solutions
- **Gapless Playback**: "Ping-Pong" dual-player system (`SeamlessPlayer`) using 5s segmented MP4s.
- **PIP Layering (Android)**: Standard `SurfaceView` sits behind the UI. Forcing both Camera and Video to use `TextureView` allows them to participate in the standard `zIndex` stack.
- **Loop Stability**: Atomic seek gating using `isSeekingRef` prevents concurrent playback collisions.
- **Handle Precision**: Using "Latest Props Refs" in `Timeline.tsx` prevents closure-related handle jumps during high-speed dragging.

## Environment & Build
- **JDK**: 17
- **NDK**: 27.1.12297006 (for C++20 support)
- **Gradle**: 8.13
- **Build Optimization**: Builds require `_JAVA_OPTIONS` to be unset and `org.gradle.jvmargs=-Xmx12288m` in `gradle.properties`.

---
## Legacy Architecture (Capacitor - moved to `legacy/`)
The original web-based MSE implementation is preserved in the `legacy/` directory for reference.
