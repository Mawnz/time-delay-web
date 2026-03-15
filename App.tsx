import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, StatusBar, Alert } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { initDB, Database } from './src/storage/db';
import { DrawingPath, Session } from './src/types';
import { Timeline } from './src/components/Timeline';
import { AnnotationOverlay } from './src/components/AnnotationOverlay';
import { SessionManager } from './src/components/SessionManager';
import { SeamlessPlayer } from './src/components/SeamlessPlayer';

// Decoupled Hooks
import { useRecorder } from './src/hooks/useRecorder';
import { usePlayerSync } from './src/hooks/usePlayerSync';
import { useSessionData } from './src/hooks/useSessionData';

// Memoized UI Components
import { TopHud, ControlBar, ZoomControls } from './src/components/UIComponents';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#007AFF',
  secondary: '#FF3B30',
  background: '#000000',
  surface: 'rgba(28, 28, 30, 0.85)',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  border: 'rgba(255, 255, 255, 0.15)',
};

export default function App() {
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [delay, setDelay] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(10);
  const [followPlayhead, setFollowPlayhead] = useState(false);
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);
  const [isPipMinimized, setIsPipMinimized] = useState(false);
  
  // Logic Hooks
  const { hasPermission, isRecording, sessionId, cameraRef, startRecording, stopRecording, checkPermissions } = useRecorder();
  const { thumbnails, duration, sessionStartTime } = useSessionData(sessionId, isRecording);
  const { 
    playerRef, currentSegment, nextSegment, currentTime, playbackRate, setPlaybackRate,
    handleSeek, onVideoLoad, onProgress, onSegmentEnd 
  } = usePlayerSync({
    sessionId, delay, isPaused, loopEnabled, pointA, pointB, sessionStartTime
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

  // Decoupled Event Handlers
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) await stopRecording();
    else await startRecording(delay);
  }, [isRecording, delay, startRecording, stopRecording]);

  const handleUpdatePoint = useCallback((point: 'A' | 'B', time: number) => {
      // Use state updater to get latest values correctly
      if (point === 'A') setPointA(time);
      else setPointB(time);

      // Perform boundary check using the values we just received
      if (loopEnabled) {
          setPointA(currentA => {
              setPointB(currentB => {
                  const pA = point === 'A' ? time : currentA;
                  const pB = point === 'B' ? time : currentB;
                  if (pA !== null && pB !== null) {
                      const start = Math.min(pA, pB);
                      const end = Math.max(pA, pB);
                      if (currentTime < (start - 0.5) || currentTime > end) {
                          handleSeek(start);
                      }
                  }
                  return currentB;
              });
              return currentA;
          });
      }
  }, [loopEnabled, currentTime, handleSeek]);

  const handleClearPoints = useCallback(() => {
      setPointA(null);
      setPointB(null);
      setLoopEnabled(false);
  }, []);

  const handleSyncToDelay = useCallback(() => {
      handleSeek(Math.max(0, duration - delay));
      setFollowPlayhead(true);
  }, [duration, delay, handleSeek]);

  if (!hasPermission) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.text}>Permissions Required</Text>
        <TouchableOpacity style={styles.proButton} onPress={checkPermissions}>
          <Text style={styles.proButtonText}>GRANT ACCESS</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (device == null) return <View style={styles.container}><Text style={styles.text}>No Camera Device</Text></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* LAYER 1: VIDEO (BOTTOM) */}
      <View style={styles.playerContainer}>
        <SeamlessPlayer
            ref={playerRef}
            currentSegment={currentSegment}
            nextSegment={nextSegment}
            onSegmentEnd={onSegmentEnd}
            onProgress={onProgress}
            onLoad={onVideoLoad}
            paused={isPaused}
            rate={playbackRate}
        />

        {!currentSegment && (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>
              {isRecording ? `BUFFERING ${delay}s DELAY...` : 'READY TO ANALYZE'}
            </Text>
          </View>
        )}
      </View>

      {/* LAYER 2: INTERACTIVE UI (TOP) */}
      <View style={styles.uiOverlay} pointerEvents="box-none">
          <AnnotationOverlay
            enabled={isPaused}
            paths={currentPaths}
            onPathsChange={(p) => {
                setCurrentPaths(p);
                if (sessionId) Database.addAnnotation(sessionId, currentTime, JSON.stringify(p));
            }}
            color="red"
            strokeWidth={3}
          />

          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => setIsPipMinimized(!isPipMinimized)}
            style={[styles.cameraPreview, isPipMinimized && styles.cameraPreviewMinimized]} 
            collapsable={false} 
            renderToHardwareTextureAndroid={true}
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
              <View style={isRecording ? styles.recBadge : styles.liveBadge}>
                  <Text style={styles.badgeText}>{isRecording ? '● REC' : 'LIVE'}</Text>
              </View>
          </TouchableOpacity>

          <TopHud 
            onOpenSessions={() => setSessionModalVisible(true)}
            delay={delay}
            onSetDelay={setDelay}
            onSync={handleSyncToDelay}
            followPlayhead={followPlayhead}
            onToggleFollow={() => setFollowPlayhead(!followPlayhead)}
            cameraPosition={cameraPosition}
            onToggleCamera={() => setCameraPosition(p => p === 'back' ? 'front' : 'back')}
          />

          <ZoomControls 
            onZoomIn={() => setZoomLevel(prev => Math.min(100, prev + 5))}
            onZoomOut={() => setZoomLevel(prev => Math.max(5, prev - 5))}
          />

          {/* TIMELINE & CONTROLS SECTION */}
          <View style={styles.bottomArea}>
              <View style={{ height: 120, width: '100%' }}>
                  <Timeline

                    thumbnails={thumbnails}
                    currentTime={currentTime}
                    duration={duration}
                    zoomLevel={zoomLevel}
                    onSeek={handleSeek}
                    onLongPress={(t) => { setPointA(Math.max(0, t-3)); setPointB(Math.min(duration, t+3)); setLoopEnabled(true); handleSeek(Math.max(0, t-3)); }}
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
                    onToggleLoop={() => setLoopEnabled(!loopEnabled)}
                    onClearPoints={handleClearPoints}
                    isRecording={isRecording}
                    onToggleRecording={handleToggleRecording}
                    playbackRate={playbackRate}
                    onToggleSlowMo={() => setPlaybackRate(playbackRate === 1.0 ? 0.5 : 1.0)}
                    isPaused={isPaused}
                    onTogglePlayback={() => setIsPaused(!isPaused)}
                  />
              </View>
          </View>
      </View>

      <SessionManager visible={sessionModalVisible} onClose={() => setSessionModalVisible(false)} onSelectSession={(s) => setSessionModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  playerContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 1 },
  uiOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, elevation: 10, pointerEvents: 'box-none' },
  bottomArea: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.7)', paddingBottom: 20 },
  cameraPreview: { position: 'absolute', top: 110, right: 15, width: 110, height: 150, borderRadius: 12, borderWidth: 3, borderColor: COLORS.primary, zIndex: 9999, elevation: 1000, backgroundColor: '#111', overflow: 'hidden' },
  cameraPreviewMinimized: { width: 65, height: 28, borderRadius: 8, borderWidth: 0, backgroundColor: 'transparent' },
  hiddenCamera: { width: 1, height: 1, opacity: 0 },
  liveBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: COLORS.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: 'white', fontSize: 8, fontWeight: 'bold' },
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  waitingText: { color: COLORS.textSecondary, fontSize: 14, letterSpacing: 2, fontWeight: '300' },
  timelineWrapper: { position: 'absolute', bottom: 120, width: '100%' },
  proButton: { backgroundColor: COLORS.primary, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
  proButtonText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },
  text: { color: 'white', fontSize: 18, marginBottom: 20 },
});
