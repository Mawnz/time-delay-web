# Time-Delay Video Playback

This project is a web-based application that allows users to record video from their camera and play it back with a time delay. It features a timeline with thumbnails that allows users to seek to different points in the recorded video.

## Features

*   **Camera Recording:** The application can access the user's camera and record video.
*   **Time-Delayed Playback:** The recorded video is played back in a separate video element with a delay.
*   **Thumbnail Timeline:** A timeline of thumbnails is generated from the recorded video, allowing the user to see a preview of the video over time.
*   **Seeking:** The user can click on a thumbnail to seek to that point in the video.
*   **Persistent Storage:** The recorded video chunks and thumbnails are stored in IndexedDB, allowing the data to persist between sessions.
*   **Session Reset:** The user can clear the recorded data and start a new session.

## Architecture

The application is built with TypeScript and uses the following browser APIs:

*   **`MediaDevices.getUserMedia()`:** To access the user's camera.
*   **`MediaRecorder`:** To record the video from the camera into one-second chunks.
*   **`IndexedDB`:** To store the video chunks and thumbnails.
*   **`MediaSource`:** To play back the recorded video in the `delayed` video element.

The application is divided into the following modules:

*   **`main.ts`:** The main entry point of the application. It initializes the other modules and handles user interactions.
*   **`camera.ts`:** Handles the camera recording. It uses the `MediaRecorder` API to record the video into one-second chunks and stores them in IndexedDB. It also generates thumbnails from the video.
*   **`player.ts`:** Handles the video playback. It uses the `MediaSource` API to play back the video chunks from IndexedDB. It also handles the seeking functionality.
*   **`db.ts`:** A wrapper around the IndexedDB API that provides a simple interface for storing and retrieving video chunks and thumbnails.
*   **`thumbnail.ts`:** A utility module for generating thumbnails from video frames.
*   **`annotation.ts`:** Handles drawing annotations on the video canvas.

## Current State

The application is now in a fully functional state.

*   **Camera Recording:** Works correctly.
*   **Time-Delayed Playback:** Video plays automatically with a delay and continues indefinitely unless paused.
*   **Thumbnail Timeline:** Thumbnails are generated and displayed in an interactive timeline.
*   **Seeking:** Seeking by clicking or dragging on the timeline works accurately.
*   **Playback Controls:** Play/Pause, Slow Motion, and Frame-by-Frame stepping work as expected.
*   **Persistent Storage:** Recorded sessions (video, thumbnails, annotations) are stored in IndexedDB.
*   **Session Management:** Users can start new recording sessions, view a list of saved sessions, and load them for playback.
*   **Annotations:** Users can draw on the video when paused, and annotations are saved with the session.
*   **Data Export/Import:** Sessions can be exported to and imported from JSON files.
*   **Responsive UI:** The user interface is designed to be mobile-friendly, with controls overlaying the video.

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
