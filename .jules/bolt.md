## 2024-05-18 - Avoid unnecessary O(n) rendering when global props frequently update

**Learning:**
The main `App.tsx` controls `currentTime` and updates roughly ~10x/sec during video playback to sync the UI timeline. When this fast-changing prop is passed to child components like `Timeline.tsx`, it forces a re-render. Previously, the `Timeline` component recalculated O(n) operations (mapping arrays for timeline ruler ticks and virtualized thumbnails) inline on every single frame tick. This caused substantial JS-thread bottlenecking on mobile.

**Action:**
Always wrap iterative UI generation blocks in `useMemo()` inside components that receive fast-updating props (like `currentTime`, `scrollOffset`, etc.). Define explicit dependencies (like `duration`, `zoomLevel`, `thumbnails`, `scrollX`) so that O(n) array mapping is completely bypassed unless the underlying content/scale changes, converting a per-frame O(n) cost to an O(1) cache read.
