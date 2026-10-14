## 2024-05-15 - [O(N) vs O(1) query performance in setInterval]
**Learning:** Found an issue where the duration calculation was requesting the entire segments table via `Database.getSegments` every 2 seconds via `setInterval` in `src/hooks/useSessionData.ts`. This was causing an O(N) database operation and memory hit that grows linearly with the session duration.
**Action:** Always verify what is being queried inside loops or intervals. For duration calculations, only query the first and last segment instead of loading the entire collection into memory.
