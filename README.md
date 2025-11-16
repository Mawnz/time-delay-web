# Time-Delay Video Playback for Sports Analysis

This project is a web-based application that allows users to record video from their camera and play it back with a time delay. It is designed as a tool for athletes and coaches to analyze performance in near-real-time.

## Features

*   **Camera Recording:** The application can access the user's camera and record video sessions.
*   **Time-Delayed Playback:** The recorded video is played back in a separate video element with a delay, allowing for immediate review.
*   **Interactive Timeline:** A timeline of thumbnails is generated from the recorded video. Users can click or drag on the timeline to instantly seek to any point in the recorded video. The timeline auto-scrolls as the video plays.
*   **Persistent Sessions:** Recordings are saved as sessions in the browser's IndexedDB. Users can name, save, load, and delete sessions.
*   **Data Management:** Full sessions can be exported to and imported from JSON files, allowing for backup and sharing.
*   **Advanced Playback Controls:** Includes Play/Pause, Slow Motion, and Frame-by-Frame stepping.
*   **Looping:** A draggable and resizable selector can be created on the timeline to define a specific segment. This segment can then be looped repeatedly for focused analysis.
*   **Clip Export:** The user-defined loop segment can be exported as a separate clip (in JSON format), containing only the video, thumbnails, and annotations for that specific time range.
*   **Video Annotation:** Users can draw on the video when it is paused. Annotation tools include a color picker, line width slider, and undo/redo functionality. Annotations are saved with the session.
*   **Responsive UI:** The user interface is designed to be mobile-first, with a full-screen video view and touch-friendly controls that appear on interaction.

## Architecture

The application is built with TypeScript and uses the following browser APIs:

*   **`MediaDevices.getUserMedia()`:** To access the user's camera.
*   **`MediaRecorder`:** To record the video from the camera into one-second chunks.
*   **`IndexedDB`:** To store video chunks, thumbnails, annotations, and session metadata.
*   **`MediaSource`:** To play back the recorded video in the `delayed` video element.

The application is divided into the following modules:

*   **`main.ts`:** The main entry point of the application. It initializes the other modules and handles all user interactions and UI logic.
*   **`camera.ts`:** Handles the camera recording, including selecting a supported codec and saving video data to the database.
*   **`player.ts`:** Handles the video playback, including the `MediaSource` setup, timeline management, seeking, and playback controls.
*   **`db.ts`:** A wrapper around the IndexedDB API that provides a simple interface for all data storage and retrieval.
*   **`annotation.ts`:** Manages the drawing canvas, including drawing history for undo/redo and tool settings.
*   **`config.ts`:** Contains shared configuration, such as the video `MIME_TYPE`.

## Current State

The application is stable and feature-complete according to the project roadmap. All core functionalities, including recording, playback, session management, and the advanced analysis tools (looping, clipping, annotations), are fully implemented and working.

## Running on Mobile Devices (HTTPS Requirement)

To use the camera recording functionality on mobile devices (e.g., Android Chrome/Firefox, iOS Safari/Chrome), your development server **must be served over HTTPS**. Browsers enforce this security measure for sensitive APIs like `getUserMedia()`.

Since `bun --hot server.ts` typically runs on `http://localhost:3000`, you'll need a way to expose this securely to your mobile device. A popular tool for this is **ngrok**.

### Using ngrok:

1.  **Install ngrok:** Follow the instructions on the [ngrok website](https://ngrok.com/download).
2.  **Start your Bun server:**
    ```bash
    bun --hot server.ts
    ```
    (This will usually run on `http://localhost:3000`)
3.  **Start ngrok:** In a new terminal, run:
    ```bash
    ngrok http 3000
    ```
4.  **Access from your phone:** ngrok will provide you with an `https://` forwarding URL (e.g., `https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app`). Open this URL in your mobile browser.
5.  **Grant Permissions:** Your mobile browser will now correctly prompt you for camera permissions.

This setup allows you to test the full functionality, including camera recording, on your mobile devices.
