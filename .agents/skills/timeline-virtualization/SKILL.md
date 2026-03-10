---
name: timeline-virtualization
description: Patterns for the virtualized, zoomable thumbnail timeline. Use this skill when working on timeline-manager.ts, the thumbnail section of player.ts, or zoom/pan interactions in main.ts.
---

# Skill: Timeline Virtualization & Zoom

## Why Virtualization Is Necessary

The current implementation appends one `<img>` per video chunk directly to the DOM. For a 60-minute session at 1 chunk/second, that is 3,600 DOM nodes — causing browser jank and eventual crashes. Virtualization fixes this by rendering **only visible thumbnails**.

## Architecture

### State (TimelineManager)
```typescript
interface TimelineState {
  zoomLevel: number;      // pixels per second (e.g., 100px/s = zoomed in, 10px/s = zoomed out)
  viewportStart: number;  // timestamp (ms) of the left edge of visible timeline
  viewportEnd: number;    // timestamp (ms) of the right edge of visible timeline
  totalDurationMs: number; // total recorded duration
}
```

### Spacer Pattern
Instead of appending images linearly, use a single fixed-width **spacer div** to represent the total timeline width:
```
[scrollable container]
  [spacer div: width = totalDurationMs / 1000 * zoomLevel px]
    [visible thumbnails only, positioned absolutely]
```

### Rendering Loop (on scroll/zoom)
```
1. Get container.scrollLeft and container.clientWidth
2. Compute viewportStart = scrollLeft / zoomLevel (in seconds)
3. Compute viewportEnd = (scrollLeft + clientWidth) / zoomLevel
4. Query visible thumbnails: timestamps in [viewportStart, viewportEnd]
5. Render only those <img> elements, positioned absolutely (left = timestamp * zoomLevel)
6. Remove <img> elements that have left the viewport
```

### IntersectionObserver (Alternative)
Use an `IntersectionObserver` on placeholder `<div>` elements (one per second slot) to trigger lazy image loading:
```typescript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) loadThumbnail(entry.target);
    else unloadThumbnail(entry.target);
  });
}, { root: timelineContainer, rootMargin: '100px' });
```

## Zoom Interactions

### Desktop (Scroll Wheel)
```typescript
timelineEl.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return; // only zoom with Ctrl/Cmd held
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1; // zoom in/out by 10%
  zoomLevel = clamp(zoomLevel * delta, MIN_ZOOM, MAX_ZOOM);
  rerender();
});
```

### Touch (Pinch)
```typescript
let initialPinchDistance = 0;
timelineEl.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    initialPinchDistance = getPinchDistance(e.touches);
  }
});
timelineEl.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const ratio = getPinchDistance(e.touches) / initialPinchDistance;
    zoomLevel = clamp(zoomLevel * ratio, MIN_ZOOM, MAX_ZOOM);
    initialPinchDistance = getPinchDistance(e.touches);
    rerender();
  }
});
```

## Thumbnail Density at Zoom Levels

| Zoom Level | Behavior |
|---|---|
| > 80 px/s | Show all thumbnails (1 per chunk) |
| 20–80 px/s | Show every 2nd thumbnail |
| 5–20 px/s | Show every 5th thumbnail — or switch to time-block representation |
| < 5 px/s | No thumbnails; render colored time blocks only |

## Integration Points

- `TimelineManager` owns all state and renders to the DOM.
- `player.ts` calls `TimelineManager.setDuration(ms)` as new chunks arrive.
- `player.ts` calls `TimelineManager.setIndicatorPosition(timeMs)` on each animation frame.
- `main.ts` wires zoom event listeners on the container element.
