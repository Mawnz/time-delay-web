## 2024-05-15 - [O(N) vs O(1) query performance in setInterval]
**Learning:** Found an issue where the duration calculation was requesting the entire segments table via `Database.getSegments` every 2 seconds via `setInterval` in `src/hooks/useSessionData.ts`. This was causing an O(N) database operation and memory hit that grows linearly with the session duration.
**Action:** Always verify what is being queried inside loops or intervals. For duration calculations, only query the first and last segment instead of loading the entire collection into memory.

## 2024-10-15 - [Memoize O(N) UI operations on fast-updating props]
**Learning:** `Timeline.tsx` receives `currentTime` as a prop which updates ~10x/sec from `App.tsx`. Iterative rendering operations (like ruler generation) and mapping over large arrays (like thumbnails) were being recalculated on every frame update, causing JS thread starvation.
**Action:** Always wrap iterative rendering operations (O(N)) in `useMemo` when a component receives fast-changing props like `currentTime`, ensuring the expensive operations only run when their actual dependencies (like `duration`, `zoomLevel`, `thumbnails`) change.
