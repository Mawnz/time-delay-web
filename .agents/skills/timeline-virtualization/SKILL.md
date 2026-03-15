# Timeline: React Native Implementation (Time Delay)

Patterns for the custom, high-performance video timeline in React Native.

## Core Concepts
- **Absolute Session Positioning**: Thumbnails are positioned relative to the `sessionStartTime`.
- **PanResponder for Handles**: Custom draggable loop handles ('A' and 'B') with boundary validation.
- **Auto-Scroll Logic**: Optional "Follow Playhead" mode that smooth-scrolls the `ScrollView` using `scrollTo({x, animated})`.

## Critical Implementation Details
### 1. Stable Handle Dragging (The "Latest Props Ref" Pattern)
When using `PanResponder` in functional components, its closure captures stale prop values. Always use a `latestPropsRef` to ensure drag calculations are accurate:
```tsx
const latestPropsRef = useRef(props);
useEffect(() => { latestPropsRef.current = props; });

const pan = PanResponder.create({
  onPanResponderGrant: () => {
    dragStartPos = latestPropsRef.current.pointA; // Always accurate
  },
  // ...
});
```

### 2. Timeline Sizing
- `totalWidth = duration * zoomLevel`
- `playheadPos = currentTime * zoomLevel`

### 3. Loop Boundary Correction
Correction logic should be gated by an `isSeekingRef` to prevent "seek storms" when dragging handles past the current playhead.

## Optimization
- Use `renderToHardwareTextureAndroid={true}` on the timeline content to ensure smooth scrolling with thousands of thumbnails.
- Debounce timeline seeking to ~100ms for UI responsiveness.
