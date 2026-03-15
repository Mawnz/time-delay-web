# Phase 2: Audit & Optimization Plan

This phase focuses on transforming the stable React Native prototype into a professional-grade, high-performance application by leveraging specialized expert sub-agents.

## Expert Roles

1.  **Reviewer (`code-reviewer`)**: Conducts architectural sanity checks, ensures pattern consistency, and identifies technical debt.
2.  **Refactoring Expert (`react-native-refactor`)**: Restructures complex components (like `App.tsx`) and optimizes hooks/native bridge communication.
3.  **Optimization Expert (`performance-optimizer`)**: Implements virtualization for the timeline, optimizes SQLite queries, and eliminates UI stutter.

---

## Roadmap

### Step 1: Architectural Audit (Reviewer)
- **Objective**: Identify "God Components" and logic leaks.
- **Task**: Audit `App.tsx` and `src/engines/`. Propose a plan to move state into custom hooks or a lightweight store.
- **Output**: Review report with specific refactoring targets.

### Step 2: Logic Decoupling (Refactoring Expert)
- **Objective**: Reduce global re-renders and bridge traffic.
- **Task**: 
    - Extract recording and playback logic into custom hooks (`useRecorder`, `usePlayer`).
    - Use `useRef` for high-frequency values (playhead position) and expose them via imperative handles.
- **Verification**: UI responsiveness remains high while `App.tsx` re-renders significantly less.

### Step 3: Timeline & Data Optimization (Optimization Expert)
- **Objective**: Stabilize memory and speed up seeking.
- **Task**:
    - Implement `FlashList` or a custom virtualized grid for the `Timeline` thumbnails.
    - Add indexing to SQLite tables (`segments`, `thumbnails`).
    - Implement incremental loading for thumbnails (visible window only).
- **Verification**: App maintains stable memory usage during 30+ minute sessions.

### Step 4: Native Performance (Refactoring + Optimization)
- **Objective**: Achieve rock-solid segment transitions.
- **Task**:
    - Investigate moving the "Ping-Pong" segment switch logic closer to the native layer or optimizing the JS transition timing.
    - Fine-tune `TextureView` usage vs `SurfaceView` based on performance profiling.

---

## Verification Criteria
- [ ] **No UI Stutter**: Timeline scrolling and playhead movement must stay at ~60FPS.
- [ ] **Memory Stability**: No app crashes or slowdowns during long sessions.
- [ ] **Clean Code**: `App.tsx` should be reduced from ~500 lines to <150 lines by delegating to hooks/components.
- [ ] **Fast Seeking**: Jumps across the timeline should feel instantaneous.
