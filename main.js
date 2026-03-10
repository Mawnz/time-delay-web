// thumbnail.ts
var THUMB_MAX_WIDTH = 160;
var THUMB_MAX_HEIGHT = 90;
var THUMB_QUALITY = 0.7;
async function generateThumbnail(videoElement) {
  return new Promise((resolve, reject) => {
    try {
      const srcW = videoElement.videoWidth || THUMB_MAX_WIDTH;
      const srcH = videoElement.videoHeight || THUMB_MAX_HEIGHT;
      const scale = Math.min(THUMB_MAX_WIDTH / srcW, THUMB_MAX_HEIGHT / srcH);
      const w = Math.round(srcW * scale);
      const h = Math.round(srcH * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", THUMB_QUALITY);
        resolve(dataUrl);
      } else {
        reject("Could not get canvas context");
      }
    } catch (error) {
      reject(error);
    }
  });
}

// config.ts
var MIME_TYPE = 'video/webm; codecs="vp8"';

// camera.ts
class Camera {
  liveVideoElement;
  db;
  sessionId;
  stream = null;
  mediaRecorder = null;
  isFirstChunk = true;
  constructor(liveVideoElement, db, sessionId) {
    this.liveVideoElement = liveVideoElement;
    this.db = db;
    this.sessionId = sessionId;
  }
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });
      this.liveVideoElement.srcObject = this.stream;
      if (!MediaRecorder.isTypeSupported(MIME_TYPE)) {
        throw new Error(`Unsupported MIME type: ${MIME_TYPE}`);
      }
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: MIME_TYPE });
      this.mediaRecorder.ondataavailable = this.handleDataAvailable;
      this.mediaRecorder.start(1000);
      this.isFirstChunk = true;
    } catch (error) {
      console.error("Error starting camera:", error);
      alert("Could not start camera. Please ensure you have given permission and are using a supported browser.");
    }
  }
  handleDataAvailable = async (event) => {
    if (event.data.size > 0) {
      try {
        if (this.isFirstChunk) {
          await this.db.addInitializationSegment(this.sessionId, event.data);
          this.isFirstChunk = false;
        } else {
          await this.db.addChunk(this.sessionId, event.data);
          const thumbnail = await generateThumbnail(this.liveVideoElement);
          await this.db.addThumbnail(this.sessionId, thumbnail);
        }
      } catch (error) {
        console.error("Error handling data available:", error);
      }
    }
  };
  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    this.liveVideoElement.srcObject = null;
  }
}

// timeline-manager.ts
class TimelineManager {
  db;
  sessionId;
  onSeek;
  wrapper;
  spacer;
  thumbnailsContainer;
  indicator;
  rangeHighlight;
  _zoomLevel = 20;
  MIN_ZOOM = 1;
  MAX_ZOOM = 200;
  MIN_THUMB_WIDTH = 64;
  bufferSeconds = 5;
  totalDuration = 0;
  renderedThumbnails = new Map;
  sessionStartTime = 0;
  isUserInteracting = false;
  renderDebounceTimer = null;
  renderGeneration = 0;
  constructor(wrapperId, db, sessionId, onSeek) {
    this.db = db;
    this.sessionId = sessionId;
    this.onSeek = onSeek;
    this.wrapper = document.getElementById(wrapperId);
    this.spacer = document.getElementById("timeline-spacer");
    this.thumbnailsContainer = document.getElementById("thumbnails-container");
    this.indicator = document.getElementById("timeline-indicator");
    this.rangeHighlight = document.getElementById("timeline-range-highlight");
    this.setupEventListeners();
    this.updateLayout();
  }
  setSessionStartTime(startTime) {
    this.sessionStartTime = startTime;
    this.renderedThumbnails.clear();
    this.thumbnailsContainer.innerHTML = "";
    this.renderVisibleThumbnails();
  }
  setupEventListeners() {
    const setInteracting = (v) => {
      this.isUserInteracting = v;
    };
    this.wrapper.addEventListener("mousedown", () => setInteracting(true));
    this.wrapper.addEventListener("touchstart", () => setInteracting(true), { passive: true });
    window.addEventListener("mouseup", () => setInteracting(false));
    window.addEventListener("touchend", () => setInteracting(false));
    this.wrapper.addEventListener("scroll", () => {
      if (this.renderDebounceTimer !== null)
        clearTimeout(this.renderDebounceTimer);
      this.renderDebounceTimer = window.setTimeout(() => {
        this.renderDebounceTimer = null;
        this.renderVisibleThumbnails();
      }, 80);
    }, { passive: true });
    this.wrapper.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("resize-handle"))
        return;
      const rect = this.wrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const time = this.pixelToTime(this.wrapper.scrollLeft + clickX);
      this.onSeek(Math.max(0, Math.min(time, this.totalDuration)));
    });
    this.wrapper.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.handleZoom(e.deltaY, e.clientX);
      }
    }, { passive: false });
  }
  updateDuration(duration) {
    const safeDuration = Math.max(duration, 1);
    if (Math.abs(this.totalDuration - safeDuration) > 0.1) {
      this.totalDuration = safeDuration;
      this.updateLayout();
    }
  }
  updateIndicator(currentTime) {
    const pos = this.timeToPixel(currentTime);
    this.indicator.style.transform = `translateX(${pos}px)`;
    const visibleStart = this.wrapper.scrollLeft;
    const visibleEnd = visibleStart + this.wrapper.clientWidth;
    if (!this.isUserInteracting && pos > visibleEnd - 50) {
      this.wrapper.scrollLeft = pos - this.wrapper.clientWidth * 0.2;
    }
  }
  updateRangeHighlight(start, end) {
    if (start === null || end === null) {
      this.rangeHighlight.style.display = "none";
      return;
    }
    const startPx = this.timeToPixel(Math.min(start, end));
    const endPx = this.timeToPixel(Math.max(start, end));
    const width = endPx - startPx;
    this.rangeHighlight.style.display = "block";
    this.rangeHighlight.style.transform = `translateX(${startPx}px)`;
    this.rangeHighlight.style.width = `${width}px`;
  }
  updateLayout() {
    const totalWidth = this.totalDuration * this._zoomLevel;
    this.spacer.style.width = `${Math.max(totalWidth, this.wrapper.clientWidth)}px`;
    this.renderVisibleThumbnails();
  }
  handleZoom(delta, mouseX) {
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, this._zoomLevel * zoomFactor));
    if (newZoom === this._zoomLevel)
      return;
    const rect = this.wrapper.getBoundingClientRect();
    const mouseOffset = mouseX - rect.left;
    const timeUnderCursor = this.pixelToTime(this.wrapper.scrollLeft + mouseOffset);
    this._zoomLevel = newZoom;
    this.updateLayout();
    const newScrollLeft = this.timeToPixel(timeUnderCursor) - mouseOffset;
    this.wrapper.scrollLeft = newScrollLeft;
  }
  async renderVisibleThumbnails() {
    if (!this.sessionId || this.sessionStartTime === 0)
      return;
    const generation = ++this.renderGeneration;
    const rawStride = this.MIN_THUMB_WIDTH / this._zoomLevel;
    const stride = Math.max(1, Math.ceil(rawStride));
    const visibleStartPx = this.wrapper.scrollLeft;
    const visibleEndPx = visibleStartPx + this.wrapper.clientWidth;
    const startTimeRel = Math.max(0, this.pixelToTime(visibleStartPx) - this.bufferSeconds * stride);
    const endTimeRel = this.pixelToTime(visibleEndPx) + this.bufferSeconds * stride;
    const startAligned = Math.floor(startTimeRel / stride) * stride;
    const dbStart = this.sessionStartTime + startAligned * 1000;
    const dbEnd = this.sessionStartTime + endTimeRel * 1000;
    for (const [ts, img] of this.renderedThumbnails) {
      if (ts < dbStart || ts > dbEnd) {
        img.remove();
        this.renderedThumbnails.delete(ts);
      }
    }
    const thumbs = await this.db.getThumbnailsBetween(this.sessionId, dbStart, dbEnd);
    if (generation !== this.renderGeneration)
      return;
    thumbs.forEach((t) => {
      const relativeTime = (t.timestamp - this.sessionStartTime) / 1000;
      const strideIndex = Math.round(relativeTime / stride);
      const expectedTime = strideIndex * stride;
      if (Math.abs(relativeTime - expectedTime) < 0.5) {
        if (!this.renderedThumbnails.has(t.timestamp)) {
          const img = document.createElement("img");
          img.src = t.data;
          img.className = "absolute top-0 h-full object-cover select-none pointer-events-none border-r border-gray-800/50";
          const leftPos = this.timeToPixel(relativeTime);
          const width = stride * this._zoomLevel;
          img.style.transform = `translateX(${leftPos}px)`;
          img.style.width = `${width}px`;
          this.thumbnailsContainer.appendChild(img);
          this.renderedThumbnails.set(t.timestamp, img);
        } else {
          const img = this.renderedThumbnails.get(t.timestamp);
          const leftPos = this.timeToPixel(relativeTime);
          const width = stride * this._zoomLevel;
          img.style.transform = `translateX(${leftPos}px)`;
          img.style.width = `${width}px`;
        }
      }
    });
  }
  timeToPixel(time) {
    return time * this._zoomLevel;
  }
  pixelToTime(pixel) {
    return pixel / this._zoomLevel;
  }
  getZoomLevel() {
    return this._zoomLevel;
  }
  getWrapper() {
    return this.wrapper;
  }
}

// player.ts
class Player {
  videoElement;
  db;
  sessionId;
  mediaSource;
  sourceBuffer = null;
  chunkQueue = [];
  isAppending = false;
  lastChunkTimestamp = 0;
  initializationSegmentAppended = false;
  userPaused = false;
  pointA = null;
  pointB = null;
  _loopEnabled = false;
  _delaySeconds = 5;
  sessionStartTime = 0;
  fetchIntervalId = null;
  rafId = null;
  blobUrl = null;
  isDestroyed = false;
  timelineManager;
  constructor(videoElement, db, sessionId) {
    this.videoElement = videoElement;
    this.db = db;
    this.sessionId = sessionId;
    this.mediaSource = new MediaSource;
    this.blobUrl = URL.createObjectURL(this.mediaSource);
    this.videoElement.src = this.blobUrl;
    this.mediaSource.addEventListener("sourceopen", () => this.onSourceOpen());
    this.mediaSource.addEventListener("error", (e) => console.error("MediaSource Error:", e));
    this.videoElement.addEventListener("timeupdate", () => this.handleTimeUpdate());
    this.timelineManager = new TimelineManager("timeline-wrapper", db, sessionId, (seekTime) => {
      this.seekTo(seekTime);
    });
    this.initializationSegmentAppended = false;
  }
  onSourceOpen() {
    if (this.isDestroyed)
      return;
    if (MediaSource.isTypeSupported(MIME_TYPE)) {
      this.sourceBuffer = this.mediaSource.addSourceBuffer(MIME_TYPE);
      this.sourceBuffer.mode = "sequence";
      this.sourceBuffer.addEventListener("updateend", () => {
        this.isAppending = false;
        this.tryAppendingChunk();
      });
    } else {
      console.error(`Unsupported codec: ${MIME_TYPE}`);
    }
  }
  async fetchNewChunks() {
    if (this.isDestroyed || !this.sourceBuffer)
      return;
    if (!this.initializationSegmentAppended) {
      const initSegment = await this.db.getInitializationSegment(this.sessionId);
      if (initSegment) {
        this.initializationSegmentAppended = true;
        const buffer = await initSegment.arrayBuffer();
        this.chunkQueue.push(buffer);
        this.tryAppendingChunk();
      } else {
        return;
      }
    }
    if (this.isDestroyed)
      return;
    const delayThreshold = Date.now() - this._delaySeconds * 1000;
    this.db.getChunksAfter(this.sessionId, this.lastChunkTimestamp, async (chunk, timestamp) => {
      if (this.isDestroyed)
        return;
      if (timestamp > delayThreshold)
        return;
      this.lastChunkTimestamp = timestamp;
      const buffer = await chunk.arrayBuffer();
      this.chunkQueue.push(buffer);
      this.tryAppendingChunk();
    });
  }
  tryAppendingChunk() {
    if (this.isDestroyed)
      return;
    if (this.sourceBuffer && !this.isAppending && this.chunkQueue.length > 0) {
      this.isAppending = true;
      const buffer = this.chunkQueue.shift();
      try {
        this.sourceBuffer.appendBuffer(buffer);
        if (this.videoElement.paused && !this.userPaused) {
          this.videoElement.play();
        }
      } catch (e) {
        console.error("Error appending buffer:", e);
        this.isAppending = false;
      }
    }
  }
  async start() {
    console.log("Player started");
    const session = await this.db.getSession(this.sessionId);
    if (session) {
      this.sessionStartTime = session.createdAt;
      this.timelineManager.setSessionStartTime(session.createdAt);
    }
    this.lastChunkTimestamp = 0;
    this.userPaused = false;
    this.pointA = null;
    this.pointB = null;
    this._loopEnabled = false;
    this.timelineManager.updateRangeHighlight(null, null);
    this.fetchIntervalId = window.setInterval(() => this.fetchNewChunks(), 1000);
    const updateUI = () => {
      if (this.isDestroyed)
        return;
      if (this.videoElement) {
        const duration = this.getDuration();
        this.timelineManager.updateDuration(duration);
        this.timelineManager.updateIndicator(this.videoElement.currentTime);
      }
      this.rafId = requestAnimationFrame(updateUI);
    };
    this.rafId = requestAnimationFrame(updateUI);
  }
  destroy() {
    this.isDestroyed = true;
    if (this.fetchIntervalId !== null) {
      clearInterval(this.fetchIntervalId);
      this.fetchIntervalId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.videoElement.removeAttribute("src");
    this.videoElement.load();
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    try {
      if (this.mediaSource.readyState === "open") {
        this.mediaSource.endOfStream();
      }
    } catch (_) {}
    this.chunkQueue = [];
    this.sourceBuffer = null;
    console.log("Player destroyed.");
  }
  getDuration() {
    if (this.videoElement.seekable.length > 0) {
      return this.videoElement.seekable.end(this.videoElement.seekable.length - 1);
    }
    return 0;
  }
  handleTimeUpdate() {
    if (this._loopEnabled && this.pointA !== null && this.pointB !== null) {
      const startPoint = Math.min(this.pointA, this.pointB);
      const endPoint = Math.max(this.pointA, this.pointB);
      if (this.videoElement.currentTime >= endPoint || this.videoElement.currentTime < startPoint) {
        this.videoElement.currentTime = startPoint;
        if (this.videoElement.paused && !this.userPaused) {
          this.videoElement.play();
        }
      }
    }
  }
  get loopEnabled() {
    return this._loopEnabled;
  }
  setPointA(time) {
    this.pointA = time;
    this.timelineManager.updateRangeHighlight(this.pointA, this.pointB);
  }
  setPointB(time) {
    this.pointB = time;
    this.timelineManager.updateRangeHighlight(this.pointA, this.pointB);
  }
  clearPoints() {
    this.pointA = null;
    this.pointB = null;
    this._loopEnabled = false;
    this.timelineManager.updateRangeHighlight(null, null);
  }
  setLoop(state) {
    this._loopEnabled = state;
    if (this._loopEnabled && this.pointA !== null && this.pointB !== null) {
      const startPoint = Math.min(this.pointA, this.pointB);
      this.videoElement.currentTime = startPoint;
      this.bringLoopIntoView();
    }
  }
  toggleLoop() {
    this._loopEnabled = !this._loopEnabled;
    if (this._loopEnabled && this.pointA !== null && this.pointB !== null) {
      const startPoint = Math.min(this.pointA, this.pointB);
      this.videoElement.currentTime = startPoint;
      this.bringLoopIntoView();
    }
  }
  bringLoopIntoView() {
    if (this.pointA === null || this.pointB === null)
      return;
    const startPoint = Math.min(this.pointA, this.pointB);
    const endPoint = Math.max(this.pointA, this.pointB);
    const centerTime = (startPoint + endPoint) / 2;
    const centerPixel = this.timelineManager.timeToPixel(centerTime);
    const wrapper = this.timelineManager.getWrapper();
    const halfViewport = wrapper.clientWidth / 2;
    wrapper.scrollTo({
      left: centerPixel - halfViewport,
      behavior: "smooth"
    });
  }
  async getClipData(start, end) {
    if (!this.sessionId)
      throw new Error("No active session.");
    const clipStart = Math.min(start, end);
    const clipEnd = Math.max(start, end);
    const session = await this.db.getSession(this.sessionId);
    if (!session)
      throw new Error("Session not found");
    const dbStart = session.createdAt + clipStart * 1000;
    const dbEnd = session.createdAt + clipEnd * 1000;
    const [chunks, thumbnails, annotations] = await Promise.all([
      this.db.getChunksBetween(this.sessionId, dbStart, dbEnd),
      this.db.getThumbnailsBetween(this.sessionId, dbStart, dbEnd),
      this.db.getAnnotationsBetween(this.sessionId, clipStart, clipEnd)
    ]);
    return { chunks, thumbnails, annotations };
  }
  togglePlayPause() {
    if (this.videoElement.paused) {
      this.userPaused = false;
      this.videoElement.play();
    } else {
      this.userPaused = true;
      this.videoElement.pause();
    }
  }
  toggleSlowMotion() {
    if (this.videoElement.playbackRate === 1) {
      this.videoElement.playbackRate = 0.5;
    } else {
      this.videoElement.playbackRate = 1;
    }
  }
  get isSlowMotion() {
    return this.videoElement.playbackRate !== 1;
  }
  frameStep(direction) {
    this.userPaused = true;
    this.videoElement.pause();
    const step = 1 / 30;
    if (direction === "forward") {
      this.videoElement.currentTime += step;
    } else {
      this.videoElement.currentTime -= step;
    }
  }
  setDelay(seconds) {
    this._delaySeconds = Math.max(1, seconds);
  }
  get delaySeconds() {
    return this._delaySeconds;
  }
  async seekTo(timeSeconds) {
    if (this.isDestroyed || !this.sourceBuffer)
      return;
    this.userPaused = false;
    const buffered = this.videoElement.buffered;
    for (let i = 0;i < buffered.length; i++) {
      if (timeSeconds >= buffered.start(i) && timeSeconds <= buffered.end(i)) {
        this.videoElement.currentTime = timeSeconds;
        if (this.videoElement.paused)
          this.videoElement.play();
        return;
      }
    }
    try {
      if (this.sourceBuffer.updating) {
        this.sourceBuffer.abort();
      }
      if (this.sourceBuffer.buffered.length > 0) {
        this.sourceBuffer.remove(0, Infinity);
        await this.waitForUpdateEnd();
      }
      const initSegment = await this.db.getInitializationSegment(this.sessionId);
      if (!initSegment)
        return;
      this.sourceBuffer.appendBuffer(await initSegment.arrayBuffer());
      await this.waitForUpdateEnd();
      const dbTimestamp = this.sessionStartTime + timeSeconds * 1000;
      const delayThreshold = Date.now() - this._delaySeconds * 1000;
      this.chunkQueue = [];
      this.lastChunkTimestamp = dbTimestamp;
      this.db.getChunksAfter(this.sessionId, dbTimestamp, async (chunk, timestamp) => {
        if (this.isDestroyed || !this.sourceBuffer)
          return;
        if (timestamp > delayThreshold)
          return;
        this.lastChunkTimestamp = timestamp;
        const buffer = await chunk.arrayBuffer();
        this.chunkQueue.push(buffer);
        this.tryAppendingChunk();
      });
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.videoElement.currentTime = timeSeconds;
          if (this.videoElement.paused && !this.userPaused) {
            this.videoElement.play();
          }
        }
      }, 200);
    } catch (e) {
      console.error("Seek failed:", e);
    }
  }
  waitForUpdateEnd() {
    return new Promise((resolve) => {
      if (!this.sourceBuffer)
        return resolve();
      if (!this.sourceBuffer.updating)
        return resolve();
      this.sourceBuffer.addEventListener("updateend", () => resolve(), { once: true });
    });
  }
}

// db.ts
class DB {
  dbName;
  db = null;
  constructor(dbName) {
    this.dbName = dbName;
  }
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 8);
      request.onerror = (event) => {
        console.error("DB open error:", event);
        reject("Error opening db");
      };
      request.onsuccess = () => {
        this.db = request.result;
        console.log("DB opened successfully");
        resolve();
      };
      request.onupgradeneeded = (event) => {
        console.log("DB upgrade needed");
        const db = event.target.result;
        if (!db.objectStoreNames.contains("chunks")) {
          const chunkStore = db.createObjectStore("chunks", { keyPath: "id", autoIncrement: true });
          chunkStore.createIndex("session_ts", ["sessionId", "timestamp"], { unique: false });
        }
        if (!db.objectStoreNames.contains("thumbnails")) {
          const thumbnailStore = db.createObjectStore("thumbnails", { keyPath: "id", autoIncrement: true });
          thumbnailStore.createIndex("session_ts", ["sessionId", "timestamp"], { unique: false });
        }
        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("annotations")) {
          const annotationStore = db.createObjectStore("annotations", { keyPath: "id", autoIncrement: true });
          annotationStore.createIndex("session_timestamp", ["sessionId", "timestamp"], { unique: false });
        }
        if (!db.objectStoreNames.contains("initializationSegments")) {
          db.createObjectStore("initializationSegments", { keyPath: "sessionId" });
        }
      };
    });
  }
  async addChunk(sessionId, chunk) {
    return new Promise((resolve, reject) => {
      if (!this.db)
        return reject("DB not open");
      const transaction = this.db.transaction(["chunks"], "readwrite");
      const store = transaction.objectStore("chunks");
      const request = store.add({ sessionId, timestamp: Date.now(), data: chunk });
      request.onerror = () => reject("Error adding chunk");
      request.onsuccess = () => resolve();
    });
  }
  async addThumbnail(sessionId, thumbnail) {
    return new Promise((resolve, reject) => {
      if (!this.db)
        return reject("DB not open");
      const transaction = this.db.transaction(["thumbnails"], "readwrite");
      const store = transaction.objectStore("thumbnails");
      const request = store.add({ sessionId, timestamp: Date.now(), data: thumbnail });
      request.onerror = () => reject("Error adding thumbnail");
      request.onsuccess = () => resolve();
    });
  }
  async getChunksAfter(sessionId, timestamp, callback) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["chunks"], "readonly");
    const store = transaction.objectStore("chunks");
    const index = store.index("session_ts");
    const range = IDBKeyRange.lowerBound([sessionId, timestamp], true);
    const request = index.openCursor(range);
    request.onerror = () => console.error("Error opening cursor for chunks");
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.sessionId === sessionId) {
          callback(cursor.value.data, cursor.value.timestamp);
          cursor.continue();
        }
      }
    };
  }
  async getThumbnailsAfter(sessionId, timestamp, callback) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["thumbnails"], "readonly");
    const store = transaction.objectStore("thumbnails");
    const index = store.index("session_ts");
    const range = IDBKeyRange.lowerBound([sessionId, timestamp], true);
    const request = index.openCursor(range);
    request.onerror = () => console.error("Error opening cursor for thumbnails");
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.sessionId === sessionId) {
          callback(cursor.value.data, cursor.value.timestamp);
          cursor.continue();
        }
      }
    };
  }
  async addInitializationSegment(sessionId, chunk) {
    return new Promise((resolve, reject) => {
      if (!this.db)
        return reject("DB not open");
      const transaction = this.db.transaction(["initializationSegments"], "readwrite");
      const store = transaction.objectStore("initializationSegments");
      const request = store.put({ sessionId, data: chunk });
      request.onerror = () => reject("Error adding initialization segment");
      request.onsuccess = () => resolve();
    });
  }
  async getInitializationSegment(sessionId) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["initializationSegments"], "readonly");
    const store = transaction.objectStore("initializationSegments");
    const request = store.get(sessionId);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Error getting initialization segment");
      request.onsuccess = (event) => resolve(event.target.result?.data);
    });
  }
  async addAnnotation(sessionId, timestamp, data) {
    return new Promise((resolve, reject) => {
      if (!this.db)
        return reject("DB not open");
      const transaction = this.db.transaction(["annotations"], "readwrite");
      const store = transaction.objectStore("annotations");
      const request = store.add({ sessionId, timestamp, data });
      request.onerror = () => reject("Error adding annotation");
      request.onsuccess = () => resolve();
    });
  }
  async getAnnotationsForTimestamp(sessionId, timestamp, callback) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["annotations"], "readonly");
    const store = transaction.objectStore("annotations");
    const index = store.index("session_timestamp");
    const range = IDBKeyRange.bound([sessionId, timestamp - 0.5], [sessionId, timestamp + 0.5]);
    const request = index.getAll(range);
    request.onerror = () => console.error("Error getting annotations");
    request.onsuccess = (event) => callback(event.target.result);
  }
  async getSession(sessionId) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["sessions"], "readonly");
    const store = transaction.objectStore("sessions");
    const request = store.get(sessionId);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Error getting session");
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }
  async getAllChunksForSession(sessionId) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["chunks"], "readonly");
    const store = transaction.objectStore("chunks");
    const index = store.index("session_ts");
    const range = IDBKeyRange.only(sessionId);
    const request = index.getAll(range);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Error getting all chunks for session");
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }
  async getAllThumbnailsForSession(sessionId) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["thumbnails"], "readonly");
    const store = transaction.objectStore("thumbnails");
    const index = store.index("session_ts");
    const range = IDBKeyRange.only(sessionId);
    const request = index.getAll(range);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Error getting all thumbnails for session");
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }
  async getAllAnnotationsForSession(sessionId) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["annotations"], "readonly");
    const store = transaction.objectStore("annotations");
    const index = store.index("session_timestamp");
    const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Infinity]);
    const request = index.getAll(range);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Error getting all annotations for session");
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }
  async getChunksBetween(sessionId, start, end) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["chunks"], "readonly");
    const store = transaction.objectStore("chunks");
    const index = store.index("session_ts");
    const range = IDBKeyRange.bound([sessionId, start], [sessionId, end]);
    const request = index.getAll(range);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Error getting chunks between timestamps");
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }
  async getThumbnailsBetween(sessionId, start, end) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["thumbnails"], "readonly");
    const store = transaction.objectStore("thumbnails");
    const index = store.index("session_ts");
    const range = IDBKeyRange.bound([sessionId, start], [sessionId, end]);
    const request = index.getAll(range);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Error getting thumbnails between timestamps");
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }
  async getAnnotationsBetween(sessionId, start, end) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["annotations"], "readonly");
    const store = transaction.objectStore("annotations");
    const index = store.index("session_timestamp");
    const range = IDBKeyRange.bound([sessionId, start], [sessionId, end]);
    const request = index.getAll(range);
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Error getting annotations between timestamps");
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }
  async addSession(session) {
    return new Promise((resolve, reject) => {
      if (!this.db)
        return reject("DB not open");
      const transaction = this.db.transaction(["sessions"], "readwrite");
      const store = transaction.objectStore("sessions");
      const request = store.add(session);
      request.onerror = () => reject("Error adding session");
      request.onsuccess = () => resolve();
    });
  }
  async getAllSessions(callback) {
    if (!this.db)
      throw new Error("DB not open");
    const transaction = this.db.transaction(["sessions"], "readonly");
    const store = transaction.objectStore("sessions");
    const request = store.getAll();
    request.onerror = () => console.error("Error getting all sessions");
    request.onsuccess = (event) => callback(event.target.result);
  }
  async clear() {
    console.log("Clearing DB");
    return new Promise((resolve, reject) => {
      if (!this.db)
        return reject("DB not open");
      const stores = ["chunks", "thumbnails", "sessions", "annotations", "initializationSegments"];
      const transaction = this.db.transaction(stores, "readwrite");
      let successCount = 0;
      const checkSuccess = () => {
        successCount++;
        if (successCount === stores.length) {
          console.log("DB cleared");
          resolve();
        }
      };
      stores.forEach((storeName) => {
        const request = transaction.objectStore(storeName).clear();
        request.onerror = (event) => {
          console.error(`Error clearing ${storeName}:`, event);
          reject(`Error clearing ${storeName}`);
        };
        request.onsuccess = checkSuccess;
      });
    });
  }
}

// annotation.ts
class Annotation {
  canvas;
  ctx;
  isDrawing = false;
  drawingHistory = [];
  historyPointer = -1;
  currentColor = "red";
  currentWidth = 2;
  onDrawingEnd = () => {};
  resizeObserver;
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.syncCanvasSize();
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentWidth;
    this.resizeObserver = new ResizeObserver(() => {
      this.syncCanvasSize();
      this.redraw();
    });
    this.resizeObserver.observe(canvas);
  }
  syncCanvasSize() {
    const w = this.canvas.offsetWidth;
    const h = this.canvas.offsetHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.lineJoin = "round";
      this.ctx.lineCap = "round";
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.currentWidth;
    }
  }
  enableDrawing() {
    this.canvas.style.pointerEvents = "auto";
    this.canvas.addEventListener("mousedown", this.startDrawing);
    this.canvas.addEventListener("mousemove", this.draw);
    this.canvas.addEventListener("mouseup", this.stopDrawing);
    this.canvas.addEventListener("mouseout", this.stopDrawing);
    this.canvas.addEventListener("touchstart", this.startDrawingTouch, { passive: false });
    this.canvas.addEventListener("touchmove", this.drawTouch, { passive: false });
    this.canvas.addEventListener("touchend", this.stopDrawingTouch, { passive: false });
    this.canvas.addEventListener("touchcancel", this.stopDrawingTouch, { passive: false });
  }
  disableDrawing() {
    this.canvas.style.pointerEvents = "none";
    this.canvas.removeEventListener("mousedown", this.startDrawing);
    this.canvas.removeEventListener("mousemove", this.draw);
    this.canvas.removeEventListener("mouseup", this.stopDrawing);
    this.canvas.removeEventListener("mouseout", this.stopDrawing);
    this.canvas.removeEventListener("touchstart", this.startDrawingTouch);
    this.canvas.removeEventListener("touchmove", this.drawTouch);
    this.canvas.removeEventListener("touchend", this.stopDrawingTouch);
    this.canvas.removeEventListener("touchcancel", this.stopDrawingTouch);
  }
  startDrawing = (e) => {
    if (this.historyPointer < this.drawingHistory.length - 1) {
      this.drawingHistory = this.drawingHistory.slice(0, this.historyPointer + 1);
    }
    this.historyPointer++;
    this.drawingHistory.push({ path: [], color: this.currentColor, width: this.currentWidth });
    this.isDrawing = true;
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(e.offsetX, e.offsetY);
    this.drawingHistory[this.historyPointer].path.push({ x: e.offsetX, y: e.offsetY, type: "start" });
  };
  draw = (e) => {
    if (!this.isDrawing)
      return;
    this.ctx.lineTo(e.offsetX, e.offsetY);
    this.ctx.stroke();
    this.drawingHistory[this.historyPointer].path.push({ x: e.offsetX, y: e.offsetY, type: "draw" });
  };
  stopDrawing = () => {
    if (this.isDrawing) {
      this.ctx.closePath();
      this.isDrawing = false;
      this.onDrawingEnd(this.getDrawingData());
    }
  };
  startDrawingTouch = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    if (this.historyPointer < this.drawingHistory.length - 1) {
      this.drawingHistory = this.drawingHistory.slice(0, this.historyPointer + 1);
    }
    this.historyPointer++;
    this.drawingHistory.push({ path: [], color: this.currentColor, width: this.currentWidth });
    this.isDrawing = true;
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(offsetX, offsetY);
    this.drawingHistory[this.historyPointer].path.push({ x: offsetX, y: offsetY, type: "start" });
  };
  drawTouch = (e) => {
    e.preventDefault();
    if (!this.isDrawing)
      return;
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    this.ctx.lineTo(offsetX, offsetY);
    this.ctx.stroke();
    this.drawingHistory[this.historyPointer].path.push({ x: offsetX, y: offsetY, type: "draw" });
  };
  stopDrawingTouch = (e) => {
    e.preventDefault();
    if (this.isDrawing) {
      this.ctx.closePath();
      this.isDrawing = false;
      this.onDrawingEnd(this.getDrawingData());
    }
  };
  setLineColor(color) {
    this.currentColor = color;
    this.ctx.strokeStyle = this.currentColor;
  }
  setLineWidth(width) {
    this.currentWidth = width;
    this.ctx.lineWidth = this.currentWidth;
  }
  undo() {
    if (this.historyPointer > 0) {
      this.historyPointer--;
      this.redraw();
    } else if (this.historyPointer === 0) {
      this.historyPointer--;
      this.clearCanvas();
    }
  }
  redo() {
    if (this.historyPointer < this.drawingHistory.length - 1) {
      this.historyPointer++;
      this.redraw();
    }
  }
  clear() {
    this.clearCanvas();
    this.drawingHistory = [];
    this.historyPointer = -1;
  }
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  getDrawingData() {
    return this.drawingHistory.slice(0, this.historyPointer + 1);
  }
  loadDrawingData(data) {
    this.drawingHistory = data;
    this.historyPointer = data.length - 1;
    this.redraw();
  }
  redraw() {
    this.clearCanvas();
    if (this.historyPointer < 0)
      return;
    for (let i = 0;i <= this.historyPointer; i++) {
      const drawing = this.drawingHistory[i];
      if (drawing && drawing.path.length > 0) {
        this.ctx.strokeStyle = drawing.color;
        this.ctx.lineWidth = drawing.width;
        this.ctx.beginPath();
        drawing.path.forEach((point) => {
          if (point.type === "start") {
            this.ctx.moveTo(point.x, point.y);
          } else {
            this.ctx.lineTo(point.x, point.y);
          }
        });
        this.ctx.stroke();
        this.ctx.closePath();
      }
    }
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentWidth;
  }
  destroy() {
    this.resizeObserver.disconnect();
  }
}

// main.ts
var liveVideoElement = document.getElementById("video");
var delayedVideoElement = document.getElementById("delayed");
var toggleButton = document.getElementById("toggle");
var recordingIndicator = document.getElementById("recording-indicator");
var db = new DB("time-delay-db");
var camera;
var player;
var annotation;
var currentSessionId = null;
var annotationCanvas = document.getElementById("annotation-canvas");
var clearButton = document.getElementById("clear");
var playPauseButton = document.getElementById("play-pause");
var slowMotionButton = document.getElementById("slow-motion");
var frameBackwardButton = document.getElementById("frame-backward");
var frameForwardButton = document.getElementById("frame-forward");
var sessionsButton = document.getElementById("sessions");
var sessionsModal = document.getElementById("sessions-modal");
var sessionsList = document.getElementById("sessions-list");
var closeSessionsButton = document.getElementById("close-sessions");
var importSessionButton = document.getElementById("import-session");
var importFileInput = document.getElementById("import-file-input");
var toggleLoopButton = document.getElementById("toggle-loop");
var exportClipButton = document.getElementById("export-clip");
var lineColorInput = document.getElementById("line-color");
var lineWidthInput = document.getElementById("line-width");
var undoAnnotationButton = document.getElementById("undo-annotation");
var redoAnnotationButton = document.getElementById("redo-annotation");
var sessionNameModal = document.getElementById("session-name-modal");
var sessionNameInput = document.getElementById("session-name-input");
var sessionNameConfirm = document.getElementById("session-name-confirm");
var sessionNameCancel = document.getElementById("session-name-cancel");
var overflowBtn = document.getElementById("overflow-btn");
var overflowDropdown = document.getElementById("overflow-dropdown");
var annotationBar = document.getElementById("annotation-bar");
var delaySlider = document.getElementById("delay-slider");
var delayValueLabel = document.getElementById("delay-value");
var isCameraStarted = false;
var blobToUint8Array = async (blob) => {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
};
function promptSessionName(defaultName) {
  return new Promise((resolve) => {
    sessionNameInput.value = defaultName;
    sessionNameModal.classList.add("open");
    sessionNameInput.focus();
    sessionNameInput.select();
    const cleanup = () => {
      sessionNameModal.classList.remove("open");
      sessionNameConfirm.removeEventListener("click", onConfirm);
      sessionNameCancel.removeEventListener("click", onCancel);
      sessionNameInput.removeEventListener("keydown", onKey);
    };
    const onConfirm = () => {
      const val = sessionNameInput.value.trim();
      cleanup();
      resolve(val || defaultName);
    };
    const onCancel = () => {
      cleanup();
      resolve(null);
    };
    const onKey = (e) => {
      if (e.key === "Enter")
        onConfirm();
      if (e.key === "Escape")
        onCancel();
    };
    sessionNameConfirm.addEventListener("click", onConfirm);
    sessionNameCancel.addEventListener("click", onCancel);
    sessionNameInput.addEventListener("keydown", onKey);
  });
}
function destroyCurrentPlayer() {
  if (player) {
    player.destroy();
    player = null;
  }
}
function updateSlowMoButton() {
  slowMotionButton.classList.toggle("active", !!(player && player.isSlowMotion));
}
function updateAnnotationBar() {
  annotationBar.classList.toggle("visible", delayedVideoElement.paused);
}
window.addEventListener("load", async () => {
  await db.open();
  toggleButton.disabled = false;
  annotation = new Annotation(annotationCanvas);
  annotation.onDrawingEnd = (data) => {
    if (currentSessionId) {
      db.addAnnotation(currentSessionId, delayedVideoElement.currentTime, data);
    }
  };
  delayedVideoElement.addEventListener("seeked", () => {
    if (delayedVideoElement.paused && currentSessionId) {
      loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
    }
  });
  delayedVideoElement.addEventListener("play", () => {
    playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
    updateAnnotationBar();
    annotation.disableDrawing();
    annotation.clear();
  });
  delayedVideoElement.addEventListener("pause", () => {
    playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
    updateAnnotationBar();
    annotation.enableDrawing();
    if (currentSessionId) {
      loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
    }
  });
  overflowBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    overflowDropdown.classList.toggle("open");
  });
  document.addEventListener("click", () => overflowDropdown.classList.remove("open"));
  overflowDropdown.addEventListener("click", (e) => e.stopPropagation());
  delaySlider.addEventListener("input", () => {
    const val = parseInt(delaySlider.value);
    delayValueLabel.textContent = `${val}s`;
    if (player)
      player.setDelay(val);
  });
  let lastTap = 0;
  delayedVideoElement.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      if (player)
        player.togglePlayPause();
    }
    lastTap = now;
  });
  loadSessionsList();
  lineColorInput.addEventListener("input", (e) => {
    annotation.setLineColor(e.target.value);
  });
  lineWidthInput.addEventListener("input", (e) => {
    annotation.setLineWidth(parseInt(e.target.value));
  });
  undoAnnotationButton.addEventListener("click", () => annotation.undo());
  redoAnnotationButton.addEventListener("click", () => annotation.redo());
  const timelineWrapper = document.getElementById("timeline-wrapper");
  const timelineRangeHighlight = document.getElementById("timeline-range-highlight");
  let isDragging = false;
  let isResizing = false;
  let activeHandle = null;
  let startX = 0;
  let startLeft = 0;
  let startWidth = 0;
  function handleCreateLoop(event) {
    if (event instanceof MouseEvent)
      event.preventDefault();
    if (!player || delayedVideoElement.seekable.length === 0)
      return;
    const seekableEnd = delayedVideoElement.seekable.end(delayedVideoElement.seekable.length - 1);
    if (!isFinite(seekableEnd) || seekableEnd === 0)
      return;
    const timelineRect = timelineWrapper.getBoundingClientRect();
    const clientX = event.clientX;
    const clickX = clientX - timelineRect.left;
    const scrollX = timelineWrapper.scrollLeft;
    const centerTime = player.timelineManager.pixelToTime(clickX + scrollX);
    const loopDuration = 5;
    let pointA = centerTime - loopDuration / 2;
    let pointB = centerTime + loopDuration / 2;
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
    toggleLoopButton.classList.add("active");
    delayedVideoElement.currentTime = centerTime;
    if (delayedVideoElement.paused) {
      player.togglePlayPause();
    }
    timelineRangeHighlight.style.pointerEvents = "auto";
  }
  timelineWrapper.addEventListener("contextmenu", (e) => handleCreateLoop(e));
  let longPressTimer;
  timelineWrapper.addEventListener("touchstart", (e) => {
    longPressTimer = window.setTimeout(() => {
      if (e.touches.length === 1) {
        e.preventDefault();
        handleCreateLoop(e.touches[0]);
      }
    }, 500);
  }, { passive: false });
  timelineWrapper.addEventListener("touchend", () => clearTimeout(longPressTimer));
  timelineWrapper.addEventListener("touchmove", () => clearTimeout(longPressTimer));
  timelineRangeHighlight.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("resize-handle"))
      return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startLeft = timelineRangeHighlight.offsetLeft;
  });
  Array.from(timelineRangeHighlight.children).forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      activeHandle = e.target.classList.contains("left") ? "left" : "right";
      startX = e.clientX;
      startLeft = timelineRangeHighlight.offsetLeft;
      startWidth = timelineRangeHighlight.offsetWidth;
    });
  });
  timelineRangeHighlight.addEventListener("dblclick", () => {
    if (player) {
      player.clearPoints();
      toggleLoopButton.classList.remove("bg-sky-500");
      toggleLoopButton.classList.add("bg-teal-600", "hover:bg-teal-700");
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (!player || !isDragging && !isResizing)
      return;
    e.preventDefault();
    const spacer = document.getElementById("timeline-spacer");
    const scrollWidth = spacer.offsetWidth;
    const dx = e.clientX - startX;
    if (isDragging) {
      const newLeft = Math.max(0, Math.min(startLeft + dx, scrollWidth - timelineRangeHighlight.offsetWidth));
      const startTime = player.timelineManager.pixelToTime(newLeft);
      const duration = player.timelineManager.pixelToTime(timelineRangeHighlight.offsetWidth);
      player.setPointA(startTime);
      player.setPointB(startTime + duration);
    } else if (isResizing) {
      if (activeHandle === "left") {
        const newLeft = Math.max(0, startLeft + dx);
        const startTime = player.timelineManager.pixelToTime(newLeft);
        player.setPointA(startTime);
      } else if (activeHandle === "right") {
        const newWidth = Math.max(20, startWidth + dx);
        const newRight = startLeft + newWidth;
        const endTime = player.timelineManager.pixelToTime(newRight);
        player.setPointB(endTime);
      }
    }
  });
  window.addEventListener("mouseup", () => {
    isDragging = false;
    isResizing = false;
    activeHandle = null;
  });
});
async function loadAnnotations(sessionId, timestamp) {
  await db.getAnnotationsForTimestamp(sessionId, timestamp, (annotations) => {
    annotation.clear();
    if (annotations.length > 0) {
      annotation.loadDrawingData(annotations);
    }
  });
}
async function loadSessionsList() {
  await db.getAllSessions((sessions) => {
    sessionsList.innerHTML = "";
    if (sessions.length === 0) {
      const empty = document.createElement("li");
      empty.className = "sessions-empty";
      empty.textContent = "No sessions yet. Start Recording to create one.";
      sessionsList.appendChild(empty);
      return;
    }
    sessions.sort((a, b) => b.createdAt - a.createdAt);
    sessions.forEach((session) => {
      const li = document.createElement("li");
      const sessionInfo = document.createElement("span");
      sessionInfo.textContent = `${session.name} — ${new Date(session.createdAt).toLocaleString()}`;
      sessionInfo.dataset.sessionId = session.id;
      li.appendChild(sessionInfo);
      sessionsList.appendChild(li);
    });
  });
}
sessionsButton?.addEventListener("click", () => {
  sessionsModal.classList.add("open");
  loadSessionsList();
});
closeSessionsButton?.addEventListener("click", () => {
  sessionsModal.classList.remove("open");
});
importSessionButton?.addEventListener("click", () => {
  importFileInput.click();
});
importFileInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader;
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result);
        await importSession(data);
        sessionsModal.classList.remove("open");
      } catch (error) {
        console.error("Error importing session:", error);
        alert("Failed to import session. Invalid file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
});
async function importSession(data) {
  console.log("Importing session...");
  const newSessionId = Date.now().toString();
  const newSession = {
    id: newSessionId,
    name: `(Imported) ${data.session.name}`,
    createdAt: new Date().getTime()
  };
  await db.addSession(newSession);
  const base64ToBlob = (base64) => fetch(base64).then((res) => res.blob());
  await Promise.all(data.chunks.map(async (chunk) => {
    const blob = await base64ToBlob(chunk.data);
    await db.addChunk(newSessionId, blob);
  }));
  await Promise.all(data.thumbnails.map((thumbnail) => db.addThumbnail(newSessionId, thumbnail.data)));
  await Promise.all(data.annotations.map((annotationEntry) => Promise.all(annotationEntry.data.map((drawingHistoryEntry) => db.addAnnotation(newSessionId, annotationEntry.timestamp, drawingHistoryEntry)))));
  loadSessionsList();
  console.log("Import complete");
}
sessionsList.addEventListener("click", (e) => {
  const target = e.target;
  const sessionId = target.dataset.sessionId || target.closest("[data-session-id]")?.dataset.sessionId;
  if (sessionId) {
    currentSessionId = sessionId;
    if (isCameraStarted) {
      camera.stop();
      isCameraStarted = false;
      toggleButton.innerHTML = '<i class="fas fa-circle"></i><span class="btn-label">Record</span>';
      toggleButton.classList.remove("recording");
      recordingIndicator.classList.add("hidden");
    }
    destroyCurrentPlayer();
    player = new Player(delayedVideoElement, db, currentSessionId);
    player.setDelay(parseInt(delaySlider.value));
    player.start();
    sessionsModal.classList.remove("open");
  }
});
toggleButton?.addEventListener("click", async () => {
  if (isCameraStarted) {
    if (camera)
      camera.stop();
    toggleButton.innerHTML = '<i class="fas fa-circle"></i><span class="btn-label">Record</span>';
    toggleButton.classList.remove("recording");
    recordingIndicator.classList.add("hidden");
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
      toggleButton.classList.add("recording");
      recordingIndicator.classList.remove("hidden");
      isCameraStarted = true;
    }
  }
});
clearButton?.addEventListener("click", async () => {
  if (confirm("Are you sure you want to delete all data?")) {
    destroyCurrentPlayer();
    await db.clear();
    window.location.reload();
  }
});
playPauseButton?.addEventListener("click", () => {
  if (player)
    player.togglePlayPause();
});
slowMotionButton?.addEventListener("click", () => {
  if (player) {
    player.toggleSlowMotion();
    updateSlowMoButton();
  }
});
toggleLoopButton?.addEventListener("click", () => {
  if (player) {
    player.toggleLoop();
    toggleLoopButton.classList.toggle("active", player.loopEnabled);
  }
});
exportClipButton?.addEventListener("click", async () => {
  if (!player || player.pointA === null || player.pointB === null || !currentSessionId) {
    alert("Please set both A and B points to export a clip.");
    return;
  }
  const btn = exportClipButton;
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  const setProgress = (pct) => {
    if (pct === null) {
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Loading FFmpeg...';
    } else if (pct < 0) {
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Merging...';
    } else {
      btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Encoding ${pct}%`;
    }
  };
  let ffmpeg = null;
  console.log("Starting Video Export...");
  try {
    const initSegmentBlob = await db.getInitializationSegment(currentSessionId);
    if (!initSegmentBlob)
      throw new Error("Missing initialization segment.");
    const initData = await blobToUint8Array(initSegmentBlob);
    const clipData = await player.getClipData(player.pointA, player.pointB);
    if (clipData.chunks.length === 0)
      throw new Error("No video data found in selected range.");
    setProgress(-1);
    console.log("Merging chunks into single binary stream...");
    const chunkBuffers = await Promise.all(clipData.chunks.map((c) => blobToUint8Array(c.data)));
    const totalSize = initData.length + chunkBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const mergedBuffer = new Uint8Array(totalSize);
    mergedBuffer.set(initData, 0);
    let offset = initData.length;
    for (const buf of chunkBuffers) {
      mergedBuffer.set(buf, offset);
      offset += buf.length;
    }
    setProgress(null);
    const { FFmpeg } = window.FFmpegWASM;
    ffmpeg = new FFmpeg;
    ffmpeg.on("log", ({ message }) => console.log("FFmpeg:", message));
    ffmpeg.on("progress", ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });
    await ffmpeg.load({
      coreURL: "/cdn-proxy/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",
      wasmURL: "/cdn-proxy/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm"
    });
    await ffmpeg.writeFile("source.webm", mergedBuffer);
    console.log("Transcoding to MP4...");
    await ffmpeg.exec([
      "-fflags",
      "+genpts",
      "-i",
      "source.webm",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "output.mp4"
    ]);
    const data = await ffmpeg.readFile("output.mp4");
    const blob = new Blob([data], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clip-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Video Export complete");
  } catch (error) {
    console.error("Export failed:", error);
    alert("Failed to export video. See console for details.");
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
    btn.classList.remove("opacity-50");
    if (ffmpeg) {
      try {
        ffmpeg.terminate();
      } catch (e) {
        console.warn(e);
      }
    }
  }
});
frameBackwardButton?.addEventListener("click", () => {
  if (player) {
    player.userPaused = true;
    player.frameStep("backward");
    if (currentSessionId) {
      loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
    }
  }
});
frameForwardButton?.addEventListener("click", () => {
  if (player) {
    player.userPaused = true;
    player.frameStep("forward");
    if (currentSessionId) {
      loadAnnotations(currentSessionId, delayedVideoElement.currentTime);
    }
  }
});
