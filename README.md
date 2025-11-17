# Time-Delay Video Playback for Sports Analysis

This project is a web-based application that allows users to record video from their camera and play it back with a time delay. It is designed as a tool for athletes and coaches to analyze performance in near-real-time.

## Features

This application provides a comprehensive suite of tools for near-real-time video analysis, all running locally in the browser.

*   **Time-Delayed Playback:** Record from your camera and watch a delayed feed, allowing for immediate performance review.
*   **Session Management:** Save recordings as named sessions. Export and import sessions as JSON files for backup or sharing.
*   **Interactive Timeline:** A thumbnail timeline allows for instant seeking to any point in the recording.
*   **Advanced Analysis Tools:**
    *   **Looping:** Create a draggable and resizable loop region on the timeline for focused, repetitive analysis.
    *   **Annotation:** Pause the video and draw on the screen with tools for color, line width, and undo/redo. Annotations are saved with the session.
    *   **Frame Control:** Play, pause, slow motion, and frame-by-frame stepping.
*   **Clip Export:** Export the data for a selected loop region (video, thumbnails, annotations) as a JSON file.
*   **Mobile Ready:** A responsive UI and guidance on using HTTPS (via ngrok) ensure full functionality on mobile devices.

## Future Development

The project is stable and feature-complete according to the initial roadmap. Future work is planned to introduce next-generation features, including advanced timeline controls (zooming), video clip exporting, and cross-platform deployment.

For a high-level overview of upcoming features, see the [Project Roadmap](roadmap.md).
For a detailed technical breakdown of the implementation strategy, see the [Implementation Plan](PLAN.md).

## Architecture

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
