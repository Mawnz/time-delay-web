# Implementation Plan: Phase 4 Features

This document outlines the proposed implementation strategy for the features detailed in Phase 4 of the project roadmap.

### Recommended Order of Implementation
1.  **Core Functionality Enhancements:** These are mostly self-contained and provide high value.
2.  **Advanced Timeline & Touch Experience:** These features are highly coupled and should be developed together.
3.  **Cross-Platform Deployment:** This is the final step to package the finished application.

---

### 1. Core Functionality Enhancements

#### A. Configurable Playback Delay
1.  **UI (`index.html`):** Add a slider or number input field to allow users to select a delay value between 5 and 120 seconds.
2.  **State Management (`main.ts`):** Store the selected delay value in a variable that can be passed to the Player.
3.  **Player Logic (`player.ts`):**
    *   Modify the `Player.start()` method to accept the delay value.
    *   The player should wait for the specified delay duration after recording begins before it starts fetching and playing video chunks from the database. This can be managed by comparing the timestamps of the earliest available chunk with the current time.

#### B. "Snap to Live" Mode
1.  **UI (`index.html`):** Add a new "Go Live" button.
2.  **Auto-Scroll Logic (`player.ts`):**
    *   In the `updateTimelineIndicator` method, modify the auto-scroll logic to only activate if the user is already scrolled to the far-right edge of the timeline.
3.  **Button Logic (`main.ts`):**
    *   The "Go Live" button's event listener will set `delayedVideoElement.currentTime` to the latest available seekable time.
    *   It will also set `thumbnailTimeline.scrollLeft` to its maximum value to instantly move the view to the "live" edge.

#### C. Video Clip Export
This feature will require a client-side WebAssembly library like **`ffmpeg.wasm`**.
1.  **Technology Integration:** Add the chosen library to the project.
2.  **Export Logic (`main.ts`):**
    *   Modify the "Export Clip" button's event listener.
    *   The handler will still use `player.getClipData()` to fetch the video and annotation data from IndexedDB.
    *   It will then pass the raw video chunks (Blobs) to the WebAssembly library.
3.  **Processing:** Use the library's functions to concatenate the individual WebM chunks into a single, coherent video file (e.g., WebM or MP4).
4.  **User Experience:**
    *   Because transcoding is resource-intensive, the UI must provide clear feedback (e.g., a "Processing..." indicator or progress bar).
    *   Once processing is complete, trigger a download of the finished video file.

---

### 2. Advanced Timeline & Touch Experience

These features should be developed concurrently.

#### A. Timeline Zoom & Touch Gestures
1.  **State Management (`main.ts`):** Introduce and manage state variables for `zoomLevel` and `panOffset` for the timeline.
2.  **Event Handling (`main.ts`):**
    *   **Desktop:** Add a `wheel` event listener to the timeline to adjust `zoomLevel`.
    *   **Touch:** Add `touchstart`, `touchmove`, and `touchend` listeners. The logic will need to differentiate between a one-finger drag (pan) and a two-finger pinch (zoom).
3.  **Rendering Logic (`player.ts`):**
    *   Refactor the methods that render thumbnails (`fetchThumbnails`) and position the indicator (`updateTimelineIndicator`).
    *   All position, width, and visibility calculations must now factor in the current `zoomLevel` and `panOffset`.

#### B. Thumbnail Virtualization
This is a critical performance optimization for the zoom feature.
1.  **Logic (`player.ts`):** The rendering logic must be enhanced to calculate which thumbnails are currently within the visible viewport.
2.  **Dynamic Rendering:** Only create `<img>` elements for visible thumbnails. As the user pans and zooms, dynamically add and remove elements from the DOM to keep the application responsive. When zoomed far out, the logic can be adapted to render only every Nth thumbnail.

---

### 3. Cross-Platform Deployment

This is a final packaging step after the web features are complete.

#### A. Capacitor Integration
1.  **Setup:** Install the Capacitor CLI and core libraries into the project.
2.  **Configuration:** Initialize Capacitor for the project (`npx cap init`), defining the app name and ID.
3.  **Add Platforms:** Add the native platforms required (`npx cap add android`, `npx cap add ios`). This requires having Android Studio and/or Xcode installed.
4.  **Sync Assets:** After running the web production build (`npm run build`), sync the generated web assets to the native projects using `npx cap sync`.
5.  **Native Configuration:** Open the projects in their native IDEs (Android Studio, Xcode) to configure essential device permissions, such as Camera and Microphone access, in the respective manifest files (`AndroidManifest.xml`, `Info.plist`).
6.  **Build & Deploy:** Build the final, signed `.apk` or `.ipa` for deployment to app stores.
