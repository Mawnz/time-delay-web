---
name: performance-optimizer
description: Specialized expert in React Native performance, memory management, and speed. Use when investigating UI stutter, memory leaks, high bridge traffic, or SQLite query delays.
---

# Performance Optimization Expert

Guidance for achieving smooth, 60FPS video analysis and efficient memory usage.

## Focus Areas

### 1. Memory & Virtualization
- **Thumbnail Management**: Never render huge arrays of `Image` components directly. Use `FlatList` or `FlashList` for the timeline to virtualize thumbnail rendering.
- **Image Caching**: Ensure thumbnails are cached and disposed of when the session ends or when they move out of view.
- **Leak Detection**: Look for persistent refs or uncleaned `setInterval` calls that keep data in memory.

### 2. SQLite & Data Speed
- **Incremental Loading**: Replace `SELECT *` with paginated queries or range-based fetches (e.g., fetch thumbnails only for the visible timeline window).
- **Indexing**: Ensure SQLite tables have indexes on `sessionId` and `timestamp` for fast lookups during seeking.
- **Bridge Batching**: Aggregate multiple small updates into a single JS bridge transaction.

### 3. UI Smoothness (Stutter Reduction)
- **High-Frequency Events**: Throttle or debounce `onProgress` and `onScroll` to avoid flooding the JS thread.
- **Hardware Acceleration**: Use `renderToHardwareTextureAndroid` for complex layers like the `Timeline` and `AnnotationOverlay`.
- **Worker/Background Delegation**: Ensure heavy tasks (thumbnail generation, database cleanup) happen outside the main UI loop.

## Optimization Workflow
1. **Identify Bottlenecks**: Use logs or profiling to find slow frames or large bridge payloads.
2. **Benchmark**: Measure current performance (e.g., memory usage after 10 minutes of recording).
3. **Apply Virtualization/Indexing**: Implement the most impactful changes first.
4. **Verify**: Confirm stutter is reduced and memory is stable.
