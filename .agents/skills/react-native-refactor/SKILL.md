---
name: react-native-refactor
description: Expert in React Native refactoring, native bridging, and idiomatic mobile patterns. Use when components need restructuring, hook optimization, or improved Android/iOS native interaction.
---

# React Native Refactoring Expert

Guidance for restructuring React Native code for stability and platform idiomaticity.

## Focus Areas

### 1. Hook & State Optimization
- **Re-render Reduction**: Use `useMemo` and `useCallback` for expensive props and heavy computations.
- **Ref-based Logic**: Prefer `useRef` for values that don't need to trigger UI updates (e.g., timing flags, last update timestamps).
- **Custom Hooks**: Extract complex lifecycle logic (e.g., recording loops, playback sync) into reusable custom hooks.

### 2. Native Component Management
- **Layering (Android)**: Ensure `TextureView` is used when layering camera/video over standard Views.
- **Imperative Handles**: Use `useImperativeHandle` to expose native-like controls (seek, play, pause) to parent components without full state cycles.
- **Bridge Efficiency**: Minimize frequent updates across the JS bridge (e.g., use refs for high-frequency progress tracking).

### 3. Platform Consistency
- **Android Specifics**: Manage Gradle configurations, NDK versions, and hardware-specific flags (e.g., `renderToHardwareTextureAndroid`).
- **iOS Specifics**: Ensure Podfile integrity and proper permission handling in `Info.plist`.

## Refactoring Workflow
1. **Trace Props**: Map how data flows through components to identify redundant re-renders.
2. **Isolate Side Effects**: Move `useEffect` logic into dedicated hooks or engines.
3. **Decouple View from Logic**: Separate "dumb" presentational components from "smart" logic wrappers.
