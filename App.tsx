import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions, StatusBar } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { initDB, Database } from './src/storage/db';
import { DrawingPath } from './src/types';
import { Timeline } from './src/components/Timeline';
import { AnnotationOverlay } from './src/components/AnnotationOverlay';
import { SessionManager } from './src/components/SessionManager';
import { SeamlessPlayer } from './src/components/SeamlessPlayer';
import { VideoGestureSurface, VideoTransform } from './src/components/VideoGestureSurface';
import { SeekIndicator } from './src/components/SeekIndicator';

// Decoupled Hooks
import { useRecorder } from './src/hooks/useRecorder';
import { usePlayerSync } from './src/hooks/usePlayerSync';
import { useSessionData } from './src/hooks/useSessionData';

// UI Components
import {
  StatusPill,
  MenuButton,
  SettingsMenu,
  ControlBar,
  ZoomControls,
} from './src/components/UIComponents';

const { width } = Dimensions.get('window');

export default function App() {
  // ── Recording state ──────────────────────────────────────────────────────
  const {
    hasPermission,
    isRecording,
    isRecordingTransition,
    sessionId,
    cameraRef,
    startRecording,
    stopRecording,
    checkPermissions,
  } = useRecorder();

  // ── Playback state ───────────────────────────────────────────────────────
  const [delay, setDelay] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(10);
  const [followPlayhead, setFollowPlayhead] = useState(false);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);

  // ── Camera / PiP state ───────────────────────────────────────────────────
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [isPipMinimized, setIsPipMinimized] = useState(false);

  // ── UI overlay state ─────────────────────────────────────────────────────
  const [menuVisible, setMenuVisible] = useState(false);
  const [sessionModalVisible, setSessionModalVisible] = useState(false);

  // ── Phase 3 state ────────────────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState(true); // muted by default to prevent mic feedback
  const [isFocusLocked, setIsFocusLocked] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [videoTransform, setVideoTransform] = useState<VideoTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // ── Data hooks ───────────────────────────────────────────────────────────
  const { thumbnails, duration, sessionStartTime } = useSessionData(sessionId, isRecording);
  const {
    playerRef,
    currentSegment,
    nextSegment,
    currentTime,
    playbackRate,
    setPlaybackRate,
    handleSeek,
    stepFrame,
    onVideoLoad,
    onProgress,
    onSegmentEnd,
  } = usePlayerSync({
    sessionId,
    delay,
    isPaused,
    loopEnabled,
    pointA,
    pointB,
    sessionStartTime,
    duration,
  });

  const device = useCameraDevice(cameraPosition);

  useEffect(() => { initDB(); }, []);

  useEffect(() => {
    if (!sessionId || !isPaused) return;
    Database.getAnnotations(sessionId, currentTime).then(data => {
      if (data.length > 0) setCurrentPaths(JSON.parse(data[0].data));
      else setCurrentPaths([]);
    });
  }, [sessionId, currentTime, isPaused]);

  // ── Event handlers ───────────────────────────────────────────────────────

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) await stopRecording();
    else await startRecording(delay);
  }, [isRecording, delay, startRecording, stopRecording]);

  const handleUpdatePoint = useCallback(
    (point: 'A' | 'B', time: number) => {
      if (point === 'A') setPointA(time);
      else setPointB(time);

      if (loopEnabled) {
        setPointA(currentA => {
          setPointB(currentB => {
            const pA = point === 'A' ? time : currentA;
            const pB = point === 'B' ? time : currentB;
            if (pA !== null && pB !== null) {
              const start = Math.min(pA, pB);
              const end = Math.max(pA, pB);
              if (currentTime < start - 0.5 || currentTime > end) {
                handleSeek(start);
              }
            }
            return currentB;
          });
          return currentA;
        });
      }
    },
    [loopEnabled, currentTime, handleSeek],
  );

  const handleClearPoints = useCallback(() => {
    setPointA(null);
    setPointB(null);
    setLoopEnabled(false);
  }, []);

  const handleSyncToDelay = useCallback(() => {
    handleSeek(Math.max(0, duration - delay));
    setFollowPlayhead(true);
  }, [duration, delay, handleSeek]);

  // ⚡ BOLT OPTIMIZATION: Memoize callbacks to prevent breaking child React.memo()
  // during high-frequency parent updates (currentTime changes ~10x/sec)
  const handleMenuVisibleTrue = useCallback(() => setMenuVisible(true), []);
  const handleMenuVisibleFalse = useCallback(() => setMenuVisible(false), []);

  const handleSessionModalVisibleTrue = useCallback(() => {
    setSessionModalVisible(true);
    setMenuVisible(false);
  }, []);
  const handleSessionModalVisibleFalse = useCallback(() => setSessionModalVisible(false), []);

  const handleZoomIn = useCallback(() => setZoomLevel(prev => Math.min(100, prev + 5)), []);
  const handleZoomOut = useCallback(() => setZoomLevel(prev => Math.max(5, prev - 5)), []);

  const handleToggleLoop = useCallback(() => setLoopEnabled(v => !v), []);

  const handleToggleSlowMo = useCallback(() => setPlaybackRate(prev => prev === 1.0 ? 0.5 : 1.0), []);

  const handleTogglePlayback = useCallback(() => setIsPaused(v => !v), []);

  const handleStepBack = useCallback(() => {
    setIsPaused(true);
    stepFrame(-1);
  }, [stepFrame]);

  const handleStepForward = useCallback(() => {
    setIsPaused(true);
    stepFrame(1);
  }, [stepFrame]);

  const handleSync = useCallback(() => {
    handleSyncToDelay();
    setMenuVisible(false);
  }, [handleSyncToDelay]);

  const handleToggleFollow = useCallback(() => setFollowPlayhead(v => !v), []);

  const handleToggleCamera = useCallback(() => setCameraPosition(p => p === 'back' ? 'front' : 'back'), []);

  const handleToggleFocusLock = useCallback(() => setIsFocusLocked(v => !v), []);

  const handleToggleMute = useCallback(() => setIsMuted(v => !v), []);

  const handleScrubStart = useCallback(() => setIsScrubbing(true), []);
  const handleScrubEnd = useCallback(() => setIsScrubbing(false), []);
  const handlePipToggle = useCallback(() => setIsPipMinimized(v => !v), []);

  const handlePathsChange = useCallback((p: DrawingPath[]) => {
    setCurrentPaths(p);
    if (sessionId) Database.addAnnotation(sessionId, currentTime, JSON.stringify(p));
  }, [sessionId, currentTime]);

  const handleTimelineLongPress = useCallback((t: number) => {
    setPointA(Math.max(0, t - 3));
    setPointB(Math.min(duration, t + 3));
    setLoopEnabled(true);
    handleSeek(Math.max(0, t - 3));
  }, [duration, handleSeek]);

  // ── Permission / device guards ────────────────────────────────────────────

  if (!hasPermission) {
    return (
      <View style={[styles.container, styles.centred]}>
        <Text style={styles.msgText}>Camera & Microphone access required</Text>
        <StatusPill
          isRecording={false}
          isTransition={false}
          onToggle={checkPermissions}
        />
      </View>
    );
  }
  if (device == null) {
    return (
      <View style={[styles.container, styles.centred]}>
        <Text style={styles.msgText}>No Camera Device</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── LAYER 1: VIDEO (BOTTOM) ── */}
      <View style={styles.playerContainer}>
        {/* Video viewport with gesture transform */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { scale: videoTransform.scale },
                { translateX: videoTransform.translateX },
                { translateY: videoTransform.translateY },
              ],
            },
          ]}
        >
          <SeamlessPlayer
            ref={playerRef}
            currentSegment={currentSegment}
            nextSegment={nextSegment}
            onSegmentEnd={onSegmentEnd}
            onProgress={onProgress}
            onLoad={onVideoLoad}
            paused={isPaused}
            rate={playbackRate}
            muted={isMuted}
          />
        </View>

        {/* Gesture surface — passes through when annotation drawing is active */}
        <VideoGestureSurface
          currentTime={currentTime}
          duration={duration}
          zoomLevel={zoomLevel}
          transform={videoTransform}
          onSeek={handleSeek}
          onGestureChange={setVideoTransform}
          onScrubStart={handleScrubStart}
          onScrubEnd={handleScrubEnd}
          passThrough={isPaused && currentPaths.length > 0}
        />

        {!currentSegment && (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>
              {isRecording ? `BUFFERING ${delay}s…` : 'READY TO ANALYZE'}
            </Text>
          </View>
        )}
      </View>

      {/* ── LAYER 1.5: CAMERA PIP (MIDDLE) ── */}
      <View
        style={[styles.pipContainer, isPipMinimized && styles.pipContainerMinimized]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.cameraPreview,
            isPipMinimized && styles.cameraPreviewMinimized,
          ]}
        >
          <Camera
            key={cameraPosition}
            ref={cameraRef}
            style={isPipMinimized ? styles.hiddenCamera : StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            video={true}
            audio={true}
            androidPreviewViewType="texture-view"
          />
          {/* Tap whole PiP to toggle minimise */}
          <View
            style={StyleSheet.absoluteFill}
            onTouchEnd={handlePipToggle}
          />
          {!isPipMinimized && (
            <View style={isRecording ? styles.recBadge : styles.liveBadge}>
              <Text style={styles.badgeText}>{isRecording ? '● REC' : 'LIVE'}</Text>
            </View>
          )}
          {isPipMinimized && (
            <View style={styles.minimizedBadge} pointerEvents="none">
              <Text style={styles.minimizedBadgeText}>CAM</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── LAYER 2: INTERACTIVE UI (TOP) ── */}
      <View style={styles.uiOverlay} pointerEvents="box-none">

        {/* Seek indicator */}
        <SeekIndicator visible={isScrubbing} currentTime={currentTime} />

        {/* Drawing overlay */}
        <AnnotationOverlay
          enabled={isPaused}
          paths={currentPaths}
          onPathsChange={handlePathsChange}
          color="red"
          strokeWidth={3}
        />

        {/* ── Top bar: StatusPill (left) + MenuButton (right) ── */}
        <View style={styles.topBar} pointerEvents="box-none">
          <StatusPill
            isRecording={isRecording}
            isTransition={isRecordingTransition}
            onToggle={handleToggleRecording}
          />
          <MenuButton onPress={handleMenuVisibleTrue} />
        </View>

        {/* Zoom controls */}
        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />

        {/* Bottom: timeline + control bar */}
        <View style={styles.bottomArea}>
          <View style={{ height: 120, width: '100%' }}>
            <Timeline
              thumbnails={thumbnails}
              currentTime={currentTime}
              duration={duration}
              zoomLevel={zoomLevel}
              onSeek={handleSeek}
              onLongPress={handleTimelineLongPress}
              pointA={pointA}
              pointB={pointB}
              onUpdatePoint={handleUpdatePoint}
              sessionStartTime={sessionStartTime}
              followPlayhead={followPlayhead}
            />
          </View>

          <View style={{ height: 100, width: '100%', justifyContent: 'center' }}>
            <ControlBar
              loopEnabled={loopEnabled}
              onToggleLoop={handleToggleLoop}
              onClearPoints={handleClearPoints}
              isRecording={isRecording}
              isTransition={isRecordingTransition}
              onToggleRecording={handleToggleRecording}
              playbackRate={playbackRate}
              onToggleSlowMo={handleToggleSlowMo}
              isPaused={isPaused}
              onTogglePlayback={handleTogglePlayback}
              onStepBack={handleStepBack}
              onStepForward={handleStepForward}
            />
          </View>
        </View>
      </View>

      {/* ── Settings menu sheet ── */}
      <SettingsMenu
        visible={menuVisible}
        onClose={handleMenuVisibleFalse}
        delay={delay}
        onSetDelay={setDelay}
        onSync={handleSync}
        followPlayhead={followPlayhead}
        onToggleFollow={handleToggleFollow}
        cameraPosition={cameraPosition}
        onToggleCamera={handleToggleCamera}
        isFocusLocked={isFocusLocked}
        onToggleFocusLock={handleToggleFocusLock}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenSessions={handleSessionModalVisibleTrue}
      />

      {/* ── Session list ── */}
      <SessionManager
        visible={sessionModalVisible}
        onClose={handleSessionModalVisibleFalse}
        onSelectSession={handleSessionModalVisibleFalse}
        activeSessionId={sessionId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centred: { justifyContent: 'center', alignItems: 'center' },
  msgText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginBottom: 24, textAlign: 'center' },

  // Layer 1
  playerContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 1 },

  // Layer 2
  uiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 10,
    borderWidth: 0,
    pointerEvents: 'box-none',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 52,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 200,
    elevation: 20,
  },

  // Camera PiP Container
  pipContainer: {
    position: 'absolute',
    top: 52,
    right: 60, // Positioned between StatusPill and MenuButton
    zIndex: 50, // Between video (1) and UI (100)
    elevation: 5,
  },
  pipContainerMinimized: {
    right: 60,
  },

  // Camera PiP
  cameraPreview: {
    width: 90,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#111',
    elevation: 20,
    overflow: 'hidden',
  },
  cameraPreviewMinimized: {
    width: 52,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenCamera: { width: 1, height: 1, opacity: 0, position: 'absolute' },
  minimizedBadge: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  minimizedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  liveBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { color: 'white', fontSize: 7, fontWeight: 'bold' },

  // Bottom area
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingBottom: 20,
  },

  // Waiting overlay (before first segment)
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  waitingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '300',
  },
});
