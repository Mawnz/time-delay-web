import { Camera } from './camera';
import { Player } from './player';
import { DB } from './db';
import { Annotation } from './annotation';

// Define global FFmpeg types for TypeScript
declare const FFmpegWASM: {
    FFmpeg: any;
};

const liveVideoElement = document.getElementById('video') as HTMLVideoElement;
const delayedVideoElement = document.getElementById('delayed') as HTMLVideoElement;
const toggleButton = document.getElementById('toggle') as HTMLButtonElement;
const recordingIndicator = document.getElementById('recording-indicator') as HTMLDivElement;

const db = new DB('time-delay-db');
let camera: Camera;
let player: Player;
let annotation: Annotation;
let currentSessionId: string | null = null;

const annotationCanvas = document.getElementById('annotation-canvas') as HTMLCanvasElement;
const clearButton = document.getElementById('clear') as HTMLButtonElement;
const playPauseButton = document.getElementById('play-pause') as HTMLButtonElement;
const slowMotionButton = document.getElementById('slow-motion') as HTMLButtonElement;
const frameBackwardButton = document.getElementById('frame-backward') as HTMLButtonElement;
const frameForwardButton = document.getElementById('frame-forward') as HTMLButtonElement;
const sessionsButton = document.getElementById('sessions') as HTMLButtonElement;
const sessionsModal = document.getElementById('sessions-modal') as HTMLDivElement;
const sessionsList = document.getElementById('sessions-list') as HTMLUListElement;
const closeSessionsButton = document.getElementById('close-sessions') as HTMLButtonElement;
const importSessionButton = document.getElementById('import-session') as HTMLButtonElement;
const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;
const toggleLoopButton = document.getElementById('toggle-loop') as HTMLButtonElement;
const exportClipButton = document.getElementById('export-clip') as HTMLButtonElement;
const lineColorInput = document.getElementById('line-color') as HTMLInputElement;
const lineWidthInput = document.getElementById('line-width') as HTMLInputElement;
const undoAnnotationButton = document.getElementById('undo-annotation') as HTMLButtonElement;
const redoAnnotationButton = document.getElementById('redo-annotation') as HTMLButtonElement;

// Session name modal elements
const sessionNameModal = document.getElementById('session-name-modal') as HTMLDivElement;
const sessionNameInput = document.getElementById('session-name-input') as HTMLInputElement;
const sessionNameConfirm = document.getElementById('session-name-confirm') as HTMLButtonElement;
const sessionNameCancel = document.getElementById('session-name-cancel') as HTMLButtonElement;

// New responsive UI elements
const overflowBtn = document.getElementById('overflow-btn') as HTMLButtonElement;
const overflowDropdown = document.getElementById('overflow-dropdown') as HTMLDivElement;
const annotationBar = document.getElementById('annotation-bar') as HTMLDivElement;
const delaySlider = document.getElementById('delay-slider') as HTMLInputElement;
const delayValueLabel = document.getElementById('delay-value') as HTMLSpanElement;

let isCameraStarted = false;

// --- HELPER: Manually convert Blob to Uint8Array ---
const blobToUint8Array = async (blob: Blob): Promise<Uint8Array> => {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
};

/** Shows inline session-name modal. Resolves with the entered name or null if cancelled. */
function promptSessionName(defaultName: string): Promise<string | null> {
    return new Promise((resolve) => {
        sessionNameInput.value = defaultName;
        sessionNameModal.classList.add('open');
        sessionNameInput.focus();
        sessionNameInput.select();

        const cleanup = () => {
            sessionNameModal.classList.remove('open');
            sessionNameConfirm.removeEventListener('click', onConfirm);
            sessionNameCancel.removeEventListener('click', onCancel);
            sessionNameInput.removeEventListener('keydown', onKey);
        };

        const onConfirm = () => {
            const val = sessionNameInput.value.trim();
            cleanup();
            resolve(val || defaultName);
        };
        const onCancel = () => { cleanup(); resolve(null); };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
        };

        sessionNameConfirm.addEventListener('click', onConfirm);
        sessionNameCancel.addEventListener('click', onCancel);
        sessionNameInput.addEventListener('keydown', onKey);
    });
}

/** Destroys the current player if one exists. Always call before constructing a new Player. */
function destroyCurrentPlayer() {
    if (player) {
        player.destroy();
        (player as any) = null;
    }
}

/** Syncs the slow-motion button's visual active state with the player's current rate. */
function updateSlowMoButton() {
    slowMotionButton.classList.toggle('active', !!(player && player.isSlowMotion));
}

/** Shows/hides the annotation toolbar based on video pause state. */
function updateAnnotationBar() {
    annotationBar.classList.toggle('visible', delayedVideoElement.paused);
}

/** Updates the export button disabled state based on loop presence */
function updateExportButtonState() {
    if (player && player.pointA !== null && player.pointB !== null) {
        exportClipButton.disabled = false;
        exportClipButton.title = "Export Clip (MP4)";
    } else {
        exportClipButton.disabled = true;
        exportClipButton.title = "Export Clip (Create a loop to export)";
    }
}

window.addEventListener('load', async () => {
    await db.open();
    toggleButton.disabled = false;
    updateExportButtonState();

    annotation = new Annotation(annotationCanvas);
    annotation.onDrawingEnd = (data) => {
        if (currentSessionId) {
            db.addAnnotation(currentSessionId, delayedVideoElement.currentTime, data);
        }
    };
    delayedVideoElement.addEventListener('seeked', () => {
        if (delayedVideoElement.paused && currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    });

    delayedVideoElement.addEventListener('play', () => {
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
        updateAnnotationBar();
        annotation.disableDrawing();
        annotation.clear();
    });
    delayedVideoElement.addEventListener('pause', () => {
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
        updateAnnotationBar();
        annotation.enableDrawing();
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    });

    // --- Overflow menu toggle ---
    overflowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overflowDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => overflowDropdown.classList.remove('open'));
    overflowDropdown.addEventListener('click', (e) => e.stopPropagation());

    // --- Delay slider ---
    delaySlider.addEventListener('input', () => {
        const val = parseInt(delaySlider.value);
        delayValueLabel.textContent = `${val}s`;
        if (player) player.setDelay(val);
    });

    // --- Double-tap on video to play/pause ---
    let lastTap = 0;
    delayedVideoElement.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            e.preventDefault();
            if (player) player.togglePlayPause();
        }
        lastTap = now;
    });

    loadSessionsList();

    lineColorInput.addEventListener('input', (e) => {
        annotation.setLineColor((e.target as HTMLInputElement).value);
    });
    lineWidthInput.addEventListener('input', (e) => {
        annotation.setLineWidth(parseInt((e.target as HTMLInputElement).value));
    });
    undoAnnotationButton.addEventListener('click', () => annotation.undo());
    redoAnnotationButton.addEventListener('click', () => annotation.redo());

    // --- Loop / Timeline Logic ---
    const timelineWrapper = document.getElementById('timeline-wrapper') as HTMLDivElement;
    const timelineRangeHighlight = document.getElementById('timeline-range-highlight') as HTMLDivElement;

    let isDragging = false;
    let isResizing = false;
    let activeHandle: 'left' | 'right' | null = null;
    let startX = 0;
    let startPointA = 0;
    let startPointB = 0;

    function handleCreateLoop(event: MouseEvent | Touch) {
        if (event instanceof MouseEvent) event.preventDefault();

        if (!player || delayedVideoElement.seekable.length === 0) return;

        const seekableEnd = delayedVideoElement.seekable.end(delayedVideoElement.seekable.length - 1);
        if (!isFinite(seekableEnd) || seekableEnd === 0) return;

        const timelineRect = timelineWrapper.getBoundingClientRect();
        const clientX = (event as any).clientX;
        const clickX = clientX - timelineRect.left;
        const scrollX = timelineWrapper.scrollLeft;

        const centerTime = player.timelineManager.pixelToTime(clickX + scrollX);

        const loopDuration = 5;
        let pointA = centerTime - (loopDuration / 2);
        let pointB = centerTime + (loopDuration / 2);

        if (pointA < 0) {
            pointA = 0;
            pointB = Math.min(loopDuration, seekableEnd);
        }
        if (pointB > seekableEnd) {
            pointB = seekableEnd;
            pointA = Math.max(0, seekableEnd - loopDuration);
        }

        player.setPointA(pointA);
        player.setPointB(pointB);
        player.setLoop(true);

        toggleLoopButton.classList.add('active');

        delayedVideoElement.currentTime = centerTime;
        if (delayedVideoElement.paused) {
            player.togglePlayPause();
        }

        timelineRangeHighlight.style.pointerEvents = 'auto';
        updateExportButtonState();
    }

    timelineWrapper.addEventListener('contextmenu', (e) => handleCreateLoop(e));

    let longPressTimer: number;
    // FIX I4: Use passive: false so preventDefault() is honoured inside the long-press handler
    timelineWrapper.addEventListener('touchstart', (e) => {
        longPressTimer = window.setTimeout(() => {
            if (e.touches.length === 1) {
                e.preventDefault(); // now works — listener is non-passive
                handleCreateLoop(e.touches[0]);
            }
        }, 500);
    }, { passive: false });

    timelineWrapper.addEventListener('touchend', () => clearTimeout(longPressTimer));
    timelineWrapper.addEventListener('touchmove', () => clearTimeout(longPressTimer));

    timelineRangeHighlight.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
        e.preventDefault();
        if (!player || player.pointA === null || player.pointB === null) return;
        isDragging = true;
        startX = e.clientX;
        startPointA = player.pointA;
        startPointB = player.pointB;
    });

    Array.from(timelineRangeHighlight.children).forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!player || player.pointA === null || player.pointB === null) return;
            isResizing = true;
            activeHandle = (e.target as HTMLElement).classList.contains('left') ? 'left' : 'right';
            startX = (e as MouseEvent).clientX;
            startPointA = player.pointA;
            startPointB = player.pointB;
        });
    });

    timelineRangeHighlight.addEventListener('dblclick', () => {
        if (player) {
            player.clearPoints();
            toggleLoopButton.classList.remove('active');
            updateExportButtonState();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!player || (!isDragging && !isResizing)) return;
        e.preventDefault();

        const dxTime = player.timelineManager.pixelToTime(e.clientX - startX);
        const totalDuration = delayedVideoElement.seekable.length > 0 ? 
            delayedVideoElement.seekable.end(delayedVideoElement.seekable.length - 1) : 0;

        if (isDragging) {
            const loopLen = startPointB - startPointA;
            let newA = startPointA + dxTime;
            let newB = startPointB + dxTime;

            if (newA < 0) {
                newA = 0;
                newB = loopLen;
            } else if (newB > totalDuration && totalDuration > 0) {
                newB = totalDuration;
                newA = Math.max(0, totalDuration - loopLen);
            }

            player.setPointA(newA);
            player.setPointB(newB);
        } else if (isResizing) {
            if (activeHandle === 'left') {
                const newA = Math.max(0, startPointA + dxTime);
                if (newA <= startPointB - 0.5) { // min 0.5s loop
                    player.setPointA(newA);
                }
            } else if (activeHandle === 'right') {
                let newB = startPointB + dxTime;
                if (totalDuration > 0) newB = Math.min(newB, totalDuration);
                if (newB >= startPointA + 0.5) { // min 0.5s loop
                    player.setPointB(newB);
                }
            }
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        activeHandle = null;
    });
});

async function loadAnnotations(sessionId: string, timestamp: number) {
    await db.getAnnotationsForTimestamp(sessionId, timestamp, (annotations) => {
        annotation.clear();
        if (annotations.length > 0) {
            annotation.loadDrawingData(annotations);
        }
    });
}

async function loadSessionsList() {
    await db.getAllSessions(sessions => {
        sessionsList.innerHTML = '';
        if (sessions.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'sessions-empty';
            empty.textContent = 'No sessions yet. Start Recording to create one.';
            sessionsList.appendChild(empty);
            return;
        }
        sessions.sort((a, b) => b.createdAt - a.createdAt);
        sessions.forEach(session => {
            const li = document.createElement('li');
            const sessionInfo = document.createElement('span');
            sessionInfo.textContent = `${session.name} — ${new Date(session.createdAt).toLocaleString()}`;
            sessionInfo.dataset.sessionId = session.id;
            li.appendChild(sessionInfo);
            sessionsList.appendChild(li);
        });
    });
}

sessionsButton?.addEventListener('click', () => {
    sessionsModal.classList.add('open');
    loadSessionsList();
});

closeSessionsButton?.addEventListener('click', () => {
    sessionsModal.classList.remove('open');
});

importSessionButton?.addEventListener('click', () => {
    importFileInput.click();
});

importFileInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                await importSession(data);
                sessionsModal.classList.remove('open');
            } catch (error) {
                console.error('Error importing session:', error);
                alert('Failed to import session. Invalid file format.');
            }
        };
        reader.readAsText(file);
        // Reset so the same file can be re-selected
        (e.target as HTMLInputElement).value = '';
    }
});

async function importSession(data: any) {
    console.log('Importing session...');
    const newSessionId = Date.now().toString();
    const newSession = {
        id: newSessionId,
        name: `(Imported) ${data.session.name}`,
        createdAt: new Date().getTime()
    };
    await db.addSession(newSession);

    const base64ToBlob = (base64: string) => fetch(base64).then(res => res.blob());

    // Parallel import of chunks, thumbnails, and annotations for speed
    await Promise.all(data.chunks.map(async (chunk: any) => {
        const blob = await base64ToBlob(chunk.data);
        await db.addChunk(newSessionId, blob);
    }));

    await Promise.all(data.thumbnails.map((thumbnail: any) =>
        db.addThumbnail(newSessionId, thumbnail.data)
    ));

    await Promise.all(data.annotations.map((annotationEntry: any) =>
        Promise.all(annotationEntry.data.map((drawingHistoryEntry: any) =>
            db.addAnnotation(newSessionId, annotationEntry.timestamp, drawingHistoryEntry)
        ))
    ));

    loadSessionsList();
    console.log('Import complete');
}

sessionsList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const sessionId = target.dataset.sessionId || (target.closest('[data-session-id]') as HTMLElement | null)?.dataset.sessionId;
    if (sessionId) {
        currentSessionId = sessionId;
        if (isCameraStarted) {
            camera.stop();
            isCameraStarted = false;
            toggleButton.innerHTML = '<i class="fas fa-circle"></i><span class="btn-label">Record</span>';
            toggleButton.classList.remove('recording');
            recordingIndicator.classList.add('hidden');
        }
        destroyCurrentPlayer();
        player = new Player(delayedVideoElement, db, currentSessionId);
        player.setDelay(parseInt(delaySlider.value));
        player.start();
        sessionsModal.classList.remove('open');
        updateExportButtonState();
    }
});

toggleButton?.addEventListener('click', async () => {
    if (isCameraStarted) {
        if (camera) camera.stop();
        toggleButton.innerHTML = '<i class="fas fa-circle"></i><span class="btn-label">Record</span>';
        toggleButton.classList.remove('recording');
        recordingIndicator.classList.add('hidden');
        isCameraStarted = false;
    } else {
        const sessionName = await promptSessionName(`Session ${new Date().toLocaleString()}`);
        if (sessionName) {
            currentSessionId = Date.now().toString();
            await db.addSession({ id: currentSessionId, name: sessionName, createdAt: Date.now() });
            loadSessionsList();

            destroyCurrentPlayer();
            camera = new Camera(liveVideoElement, db, currentSessionId);
            player = new Player(delayedVideoElement, db, currentSessionId);
            player.setDelay(parseInt(delaySlider.value));

            await camera.start();
            player.start();

            toggleButton.innerHTML = '<i class="fas fa-stop"></i><span class="btn-label">Stop</span>';
            toggleButton.classList.add('recording');
            recordingIndicator.classList.remove('hidden');
            isCameraStarted = true;
            updateExportButtonState();
        }
    }
});

clearButton?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all data?')) {
        destroyCurrentPlayer();
        await db.clear();
        window.location.reload();
    }
});

playPauseButton?.addEventListener('click', () => {
    if (player) player.togglePlayPause();
});

slowMotionButton?.addEventListener('click', () => {
    if (player) {
        player.toggleSlowMotion();
        updateSlowMoButton();
    }
});

toggleLoopButton?.addEventListener('click', () => {
    if (player) {
        player.toggleLoop();
        toggleLoopButton.classList.toggle('active', player.loopEnabled);
    }
});

// --- VIDEO EXPORT LOGIC (MEMORY MERGE STRATEGY) ---
exportClipButton?.addEventListener('click', async () => {
    if (!player || player.pointA === null || player.pointB === null || !currentSessionId) {
        alert('Please set both A and B points to export a clip.');
        return;
    }

    const btn = exportClipButton;
    const originalHTML = btn.innerHTML;
    btn.disabled = true;

    const setProgress = (pct: number | null) => {
        if (pct === null) {
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Loading FFmpeg...';
        } else if (pct < 0) {
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Merging...';
        } else {
            btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Encoding ${pct}%`;
        }
    };

    let ffmpeg: any = null;

    console.log('Starting Video Export...');
    try {
        // 1. Fetch the header (Init Segment)
        const initSegmentBlob = await db.getInitializationSegment(currentSessionId);
        if (!initSegmentBlob) throw new Error("Missing initialization segment.");
        const initData = await blobToUint8Array(initSegmentBlob);

        // 2. Get Raw Chunks
        const clipData = await player.getClipData(player.pointA, player.pointB);
        if (clipData.chunks.length === 0) throw new Error("No video data found in selected range.");

        // 3. MERGE CHUNKS IN MEMORY
        setProgress(-1);
        console.log("Merging chunks into single binary stream...");

        const chunkBuffers = await Promise.all(clipData.chunks.map((c: any) => blobToUint8Array(c.data)));
        const totalSize = initData.length + chunkBuffers.reduce((acc: number, buf: Uint8Array) => acc + buf.length, 0);
        const mergedBuffer = new Uint8Array(totalSize);
        mergedBuffer.set(initData, 0);
        let offset = initData.length;
        for (const buf of chunkBuffers) {
            mergedBuffer.set(buf, offset);
            offset += buf.length;
        }

        // 4. Load FFmpeg
        setProgress(null);
        const { FFmpeg } = (window as any).FFmpegWASM;
        ffmpeg = new FFmpeg();

        ffmpeg.on('log', ({ message }: { message: string }) => console.log('FFmpeg:', message));

        // FIX R4: Wire up FFmpeg progress events for live % display
        ffmpeg.on('progress', ({ progress }: { progress: number }) => {
            setProgress(Math.round(progress * 100));
        });

        await ffmpeg.load({
            coreURL: '/cdn-proxy/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
            wasmURL: '/cdn-proxy/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
        });

        // 5. Write the Single Merged Source
        await ffmpeg.writeFile('source.webm', mergedBuffer);

        // 6. Run Transcode
        console.log("Transcoding to MP4 from " + player.pointA + " to " + player.pointB);
        
        const startPoint = Math.min(player.pointA, player.pointB);
        const endPoint = Math.max(player.pointA, player.pointB);
        
        await ffmpeg.exec([
            '-ss', startPoint.toString(),
            '-to', endPoint.toString(),
            '-i', 'source.webm',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            'output.mp4'
        ]);

        // 7. Read & Download
        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `clip-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Video Export complete');

    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export video. See console for details.');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('opacity-50');

        if (ffmpeg) {
            try { ffmpeg.terminate(); } catch (e) { console.warn(e); }
        }
    }
});

frameBackwardButton?.addEventListener('click', () => {
    if (player) {
        player.userPaused = true;
        player.frameStep('backward');
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    }
});

frameForwardButton?.addEventListener('click', () => {
    if (player) {
        player.userPaused = true;
        player.frameStep('forward');
        if (currentSessionId) {
            loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
        }
    }
});