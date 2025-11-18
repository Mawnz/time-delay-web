Phase 1: The "High-Performance" Timeline (Critical Path)

The current timeline appends an infinite number of <img> tags to the DOM. For long sports sessions, this will crash the browser. We need to implement the Zoom and Virtualization logic you described.

1.1. Implement Timeline State Management

    Goal: Abstract timeline state out of player.ts into a dedicated manager.

    Tasks:

        Create TimelineManager class.

        Track zoomLevel (scale factor: e.g., 1px = 1sec vs 100px = 1sec).

        Track viewportStart and viewportEnd (timestamps).

1.2. Virtualization & Intersection Observers

    Goal: Only render DOM nodes for visible thumbnails.

    Current Code Analysis: player.ts -> fetchThumbnails currently blindly appends images.

    Implementation Strategy:

        Instead of a simple div with overflow: auto, use a "spacer" div to set the total hypothetical width (based on video duration * zoom level).

        Use IntersectionObserver on the scrolling container.

        Logic: When the user zooms out, calculate the new width of thumbnail slots. Update CSS grid/flex behavior.

        Performance: As the user scrolls, dynamically inject <img> tags only for the visible timestamp range. Remove <img> tags that exit the viewport to keep DOM node count low.

1.3. Zoom UI & Interaction

    Goal: Pinch-to-zoom and Scroll-to-zoom.

    Tasks:

        Add wheel listener (with Ctrl/Cmd key) and touchmove (2-finger pinch) to thumbnail-timeline container.

        Update zoomLevel state.

        Responsive Thumbnails: As zoomLevel decreases (zooming out), reduce the width of the <img> elements or switch to representing chunks as time-blocks instead of images if zoomed out too far.

Phase 2: Advanced Replay & Dual-View Architecture

Your description of "Side-by-Side" replay on large screens vs "In-Place" replay on small screens requires a UI refactor.

2.1. The Dual-Player Architecture

    Goal: Separate the "Live/Delayed" view from the "Loop/Replay" view.

    Current Code Analysis: Currently, player.ts forces the main videoElement to seek back to pointA when it hits pointB.

    Implementation:

        Introduce a second Player instance (e.g., ReplayPlayer).

        Desktop Mode (lg screens): The main video continues playing the Delayed feed. The ReplayPlayer (in a new DOM element to the side) loops the selected region.

        Mobile Mode: The ReplayPlayer takes over the main view (or an overlay modal).

2.2. Responsive Layout Refactor

    Tasks:

        Modify index.html. Use Tailwind grid: grid-cols-1 lg:grid-cols-2.

        Condition: When a loop region is active:

            Mobile: Show Replay Video in main area.

            Desktop: Shrink Main Video to Col 1, Show Replay Video in Col 2.

Phase 3: Core Configuration & Capture

Addressing the "Desired Frame Rate" and "Delay" customization.

3.1. Configurable Frame Rate

    Goal: Allow coaches to choose high FPS for slow-motion analysis.

    Current Code Analysis: camera.ts currently uses default constraints ({ video: true }).

    Implementation:

        Update Camera.start() to accept a frameRate parameter.

        Pass constraints: { video: { frameRate: { ideal: 60 } } }. Note: This depends heavily on the device camera's capabilities.

3.2. User-Configurable Delay

    Goal: Set the delay buffer.

    Implementation:

        Add a Slider UI (<input type="range">) for "Delay Seconds".

        In player.ts, modify fetchNewChunks. Instead of fetching everything after lastChunkTimestamp, calculate a playbackThreshold (CurrentTime - Delay).

        Only append chunks that meet the delay criteria.

Phase 4: Professional Export (WASM)

The current export produces a raw JSON file which is only useful for backup, not for sharing.

4.1. Integrate FFmpeg.wasm

    Goal: "Export clip" produces an .mp4 or .webm file.

    Current Code Analysis: exportClip in main.ts creates a JSON blob.

    Implementation:

        Install @ffmpeg/ffmpeg and @ffmpeg/core.

        Process:

            Retrieve Blobs from IndexedDB for the selected range (A to B).

            Load Blobs into FFmpeg's virtual filesystem.

            Run FFmpeg command to concatenate blobs.

            (Optional) Burn annotations into the video using FFmpeg filters (complex, but possible).

            Output binary video file for download.

Phase 5: Hybrid Deployment (Capacitor)

Making it a real app for iOS/Android.

5.1. Capacitor Integration

    Goal: Wrap the web app in a native shell.

    Steps:

        Run npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios.

        npx cap init.

5.2. Permission Handling

    Challenge: getUserMedia behaves differently in WebViews.

    Implementation:

        Modify index.html and server.ts to ensure CSP (Content Security Policy) allows media access.

        Add native permission requests in AndroidManifest.xml and Info.plist (Camera, Microphone).

5.3. File System Handling

    Challenge: Blob storage limits in IndexedDB on iOS/Safari are strict.

    Implementation:

        For the Native version, abstract the DB class.

        Instead of storing Blob in IndexedDB, write the Blob to the device's Filesystem (using @capacitor/filesystem) and store the path in IndexedDB.