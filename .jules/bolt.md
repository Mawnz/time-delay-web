## 2024-05-18 - Avoid unnecessary O(n) rendering when global props frequently update

**Learning:**
The main `App.tsx` controls `currentTime` and updates roughly ~10x/sec during video playback to sync the UI timeline. When this fast-changing prop is passed to child components like `Timeline.tsx`, it forces a re-render. Previously, the `Timeline` component recalculated O(n) operations (mapping arrays for timeline ruler ticks and virtualized thumbnails) inline on every single frame tick. This caused substantial JS-thread bottlenecking on mobile.

**Action:**
Always wrap iterative UI generation blocks in `useMemo()` inside components that receive fast-updating props (like `currentTime`, `scrollOffset`, etc.). Define explicit dependencies (like `duration`, `zoomLevel`, `thumbnails`, `scrollX`) so that O(n) array mapping is completely bypassed unless the underlying content/scale changes, converting a per-frame O(n) cost to an O(1) cache read.
## 2024-05-15 - [O(N) vs O(1) query performance in setInterval]
**Learning:** Found an issue where the duration calculation was requesting the entire segments table via `Database.getSegments` every 2 seconds via `setInterval` in `src/hooks/useSessionData.ts`. This was causing an O(N) database operation and memory hit that grows linearly with the session duration.
**Action:** Always verify what is being queried inside loops or intervals. For duration calculations, only query the first and last segment instead of loading the entire collection into memory.

## 2024-10-15 - [Memoize O(N) UI operations on fast-updating props]
**Learning:** `Timeline.tsx` receives `currentTime` as a prop which updates ~10x/sec from `App.tsx`. Iterative rendering operations (like ruler generation) and mapping over large arrays (like thumbnails) were being recalculated on every frame update, causing JS thread starvation.
**Action:** Always wrap iterative rendering operations (O(N)) in `useMemo` when a component receives fast-changing props like `currentTime`, ensuring the expensive operations only run when their actual dependencies (like `duration`, `zoomLevel`, `thumbnails`) change.
