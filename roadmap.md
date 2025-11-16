# Roadmap for Sports Analytics Tool

## Current Project Alignment:

The application has a solid foundation with its core features: live camera capture, delayed playback, and a basic thumbnail-based seeking timeline. This aligns with the fundamental need for instant video feedback.

However, to evolve into a "sophisticated piece of analytics software," several areas need enhancement. The current implementation is more of a proof-of-concept for the delay mechanism rather than a persistent analysis tool. For example, recordings are not saved in distinct sessions and are cleared on restart.

## Roadmap for Enhancement:

Here is a proposed roadmap to better align the project with your goal:

1.  **Core Functionality and Performance:**
    *   **Robust Playback Controls:** Implement standard and advanced playback controls: play/pause, slow-motion, and frame-by-frame stepping.
    *   **Efficient Long-form Recording:** Optimize the recording and chunk-loading mechanism to handle long sessions without performance degradation.
    *   **High-Precision Seeking:** Replace the thumbnail-only seeking with a high-precision timeline scrubber for exact navigation within the video.

2.  **Session Management:**
    *   **Persistent Sessions:** Introduce a session management system where each recording is saved as a distinct, named session in IndexedDB.
    *   **Session Browser:** Create a user interface to list, load, rename, and delete saved sessions.

3.  **Analytical Tools:**
    *   **Video Annotation:** Add a drawing layer over the video to allow coaches and athletes to draw lines, angles, and other shapes for analysis.
    *   **Annotation Persistence:** Save annotations as part of a session, so they can be reviewed later.

4.  **Advanced Features:**
    *   **Data Export/Import:** Allow users to export sessions (video and annotations) to a file for backup or sharing, and import them back into the application.
    *   **Multi-Angle Support:** (Future) Extend the system to support capturing and synchronizing video from multiple camera sources.
