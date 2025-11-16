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
*   **`camera.ts`:** Handles the camera recording. It uses the `MediaRecorder` API to record the video into one-second chunks and stores them in IndexedDB. It also generates thumbnails from the video chunks.
*   **`player.ts`:** Handles the video playback. It uses the `MediaSource` API to play back the video chunks from IndexedDB. It also handles the seeking functionality.
*   **`db.ts`:** A wrapper around the IndexedDB API that provides a simple interface for storing and retrieving video chunks and thumbnails.
*   **`thumbnail.ts`:** A utility module for generating thumbnails from video chunks.

## Current State and Challenges

The application is in a partially working state. The camera recording and thumbnail generation are working correctly. The main challenge is with the video playback and seeking functionality.

*   **Seeking:** The seeking functionality is not working correctly. When the user clicks on a thumbnail, the video freezes and does not seek to the correct position. This is likely due to issues with how the `SourceBuffer` is being managed.
*   **Playback:** The video playback is not always smooth and can be laggy, especially when seeking.

The next step is to fix the seeking and playback functionality to provide a smooth and reliable user experience.
