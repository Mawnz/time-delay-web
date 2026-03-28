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
          onScrubStart={() => setIsScrubbing(true)}
          onScrubEnd={() => setIsScrubbing(false)}
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

      {/* ── LAYER 2: INTERACTIVE UI (TOP) ── */}
      <View style={styles.uiOverlay} pointerEvents="box-none">

        {/* Seek indicator */}
        <SeekIndicator visible={isScrubbing} currentTime={currentTime} />

        {/* Drawing overlay */}
        <AnnotationOverlay
          enabled={isPaused}
          paths={currentPaths}
          onPathsChange={p => {
            setCurrentPaths(p);
            if (sessionId) Database.addAnnotation(sessionId, currentTime, JSON.stringify(p));
          }}
          color="red"
          strokeWidth={3}
        />

        {/* ── Top bar: StatusPill (left) + PiP (centre-right) + MenuButton (right) ── */}
        <View style={styles.topBar} pointerEvents="box-none">
          <StatusPill
            isRecording={isRecording}
            isTransition={isRecordingTransition}
            onToggle={handleToggleRecording}
          />

          {/* Camera PiP — now safely to the right of the status pill */}
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
              onTouchEnd={() => setIsPipMinimized(v => !v)}
            />
            {!isPipMinimized && (
              <View style={isRecording ? styles.recBadge : styles.liveBadge}>
                <Text style={styles.badgeText}>{isRecording ? '● REC' : 'LIVE'}</Text>
              </View>
            )}
          </View>

          <MenuButton onPress={() => setMenuVisible(true)} />
        </View>

        {/* Zoom controls */}
        <ZoomControls
          onZoomIn={() => setZoomLevel(prev => Math.min(100, prev + 5))}
          onZoomOut={() => setZoomLevel(prev => Math.max(5, prev - 5))}
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
              onLongPress={t => {
                setPointA(Math.max(0, t - 3));
                setPointB(Math.min(duration, t + 3));
                setLoopEnabled(true);
                handleSeek(Math.max(0, t - 3));
              }}
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
              onToggleLoop={() => setLoopEnabled(v => !v)}
              onClearPoints={handleClearPoints}
              isRecording={isRecording}
              isTransition={isRecordingTransition}
              onToggleRecording={handleToggleRecording}
              playbackRate={playbackRate}
              onToggleSlowMo={() => setPlaybackRate(playbackRate === 1.0 ? 0.5 : 1.0)}
              isPaused={isPaused}
              onTogglePlayback={() => setIsPaused(v => !v)}
              onStepBack={() => { setIsPaused(true); stepFrame(-1); }}
              onStepForward={() => { setIsPaused(true); stepFrame(1); }}
            />
          </View>
        </View>
      </View>

      {/* ── Settings menu sheet ── */}
      <SettingsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        delay={delay}
        onSetDelay={setDelay}
        onSync={() => { handleSyncToDelay(); setMenuVisible(false); }}
        followPlayhead={followPlayhead}
        onToggleFollow={() => setFollowPlayhead(v => !v)}
        cameraPosition={cameraPosition}
        onToggleCamera={() => setCameraPosition(p => p === 'back' ? 'front' : 'back')}
        isFocusLocked={isFocusLocked}
        onToggleFocusLock={() => setIsFocusLocked(v => !v)}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(v => !v)}
        onOpenSessions={() => { setSessionModalVisible(true); setMenuVisible(false); }}
      />

      {/* ── Session list ── */}
      <SessionManager
        visible={sessionModalVisible}
        onClose={() => setSessionModalVisible(false)}
        onSelectSession={() => setSessionModalVisible(false)}
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
  },

  // Camera PiP
  cameraPreview: {
    width: 90,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  cameraPreviewMinimized: {
    width: 52,
    height: 22,
    borderRadius: 8,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  hiddenCamera: { width: 1, height: 1, opacity: 0 },
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
