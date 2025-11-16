# Project Context: Time Delay Video Playback

This project implements a time-delayed video playback system in the browser. It captures a live camera feed, buffers it, and allows the user to play it back with a delay, including seeking functionality.

## Technologies Used:
- **Bun:** JavaScript runtime and toolkit.
- **TypeScript:** Superset of JavaScript for type safety.
- **HTML5:** For the web page structure.
- **Tailwind CSS:** For styling and responsive UI.
- **Web APIs:**
    - **`MediaDevices.getUserMedia()`:** To access the user's camera.
    - **`MediaRecorder`:** To record the camera stream into chunks.
    - **`IndexedDB`:** To store the video chunks persistently in the browser's local storage.
    - **`MediaSource API`:** To enable dynamic streaming of video content, allowing for seamless playback of buffered chunks and seeking.

## Main Features:
- **Live Camera Preview:** Displays the live camera feed (hidden in the current UI).
- **Delayed Playback:** Plays the camera feed with a configurable delay.
- **Persistent Storage:** Video chunks are stored in `IndexedDB` for later retrieval and seeking.
- **Dynamic Timeline:** A seek bar (`<input type="range">`) that expands as new video chunks are recorded.
- **Seeking Functionality:** Users can drag the timeline to seek to any point in the buffered video. The far right of the timeline always represents the "live" feed.
- **Responsive UI:** Styled with Tailwind CSS for compatibility with various device sizes and touch controls.

## Current State & Challenges:
- The core functionality of capturing, buffering, storing in `IndexedDB`, and playing back with `MediaSource` is working.
- The UI is styled with Tailwind CSS and includes a dynamic timeline for seeking.
- **Seeking Implementation:** The seeking logic involves clearing and re-appending buffers to the `MediaSource`, which can be a complex operation. The current implementation attempts to remove buffered ranges and then re-fetch and append chunks from the seek point.
- **Performance and Smoothness:** Ensuring smooth playback and efficient buffering, especially during seeking, remains an ongoing challenge. The `MediaSource` API requires careful management of `SourceBuffer` updates and appending operations.
- **Error Handling:** Robust error handling for `MediaSource` and `IndexedDB` operations is crucial for a stable application.
