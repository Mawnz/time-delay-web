import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, StatusBar, Alert } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { initDB, Database } from './src/storage/db';
import { recorderEngine } from './src/engines/RecorderEngine';
import { playerEngine } from './src/engines/PlayerEngine';
import { exportEngine } from './src/engines/ExportEngine';
import { Segment, Thumbnail, DrawingPath, Session } from './src/types';
import { Timeline } from './src/components/Timeline';
import { AnnotationOverlay } from './src/components/AnnotationOverlay';
import { SessionManager } from './src/components/SessionManager';
import { SeamlessPlayer, SeamlessPlayerRef } from './src/components/SeamlessPlayer';

const { width, height } = Dimensions.get('window');

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
  const device = useCameraDevice(cameraPosition);
  const camera = useRef<Camera>(null);
  const playerRef = useRef<SeamlessPlayerRef>(null);
  
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [nextSegment, setNextSegment] = useState<Segment | null>(null);
  const currentSegmentRef = useRef<Segment | null>(null);
  
  const [delay, setDelay] = useState(5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(10);
  const [followPlayhead, setFollowPlayhead] = useState(false);

  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);
  const [annotationColor, setAnnotationColor] = useState('red');

  const seekTargetRef = useRef<number | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressUpdate = useRef(0);
  
  const isSeekingRef = useRef(false);
  const latestPointARef = useRef<number | null>(null);
  const latestPointBRef = useRef<number | null>(null);

  const checkPermissions = useCallback(async () => {
    const cameraStatus = Camera.getCameraPermissionStatus();
    const micStatus = Camera.getMicrophonePermissionStatus();
    if (cameraStatus === 'granted' && micStatus === 'granted') {
      setHasPermission(true);
    } else {
      const status = await Camera.requestCameraPermission();
      const micStatusReq = await Camera.requestMicrophonePermission();
      setHasPermission(status === 'granted' && micStatusReq === 'granted');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await initDB();
      await checkPermissions();
    })();
  }, [checkPermissions]);

  useEffect(() => {
    if (camera.current) {
      recorderEngine.setCameraRef(camera);
    }
  }, [camera.current]);

  useEffect(() => {
    if (!currentSessionId) return;
    const interval = setInterval(async () => {
      const thumbs = await Database.getThumbnails(currentSessionId, 0, Date.now());
      setThumbnails(thumbs);
      
      if (thumbs.length > 0 && isRecording) {
          setSessionStartTime(prev => {
              if (!prev || Math.abs(prev - thumbs[0].timestamp) > 10000) return thumbs[0].timestamp;
              return prev;
          });
      }

      const segments = await Database.getSegments(currentSessionId);
      if (segments.length > 0) {
        const firstTs = segments[0].timestamp;
        const lastTs = segments[segments.length - 1].timestamp + (segments[segments.length - 1].duration * 1000);
        setDuration((lastTs - firstTs) / 1000);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentSessionId, isRecording]);

  useEffect(() => {
    if (!currentSessionId || !isPaused) return;
    const load = async () => {
        const data = await Database.getAnnotations(currentSessionId, currentTime);
        if (data.length > 0) setCurrentPaths(JSON.parse(data[0].data));
        else setCurrentPaths([]);
    };
    load();
  }, [currentSessionId, currentTime, isPaused]);

  const startRecording = async () => {
    const sessionId = Date.now().toString();
    setSessionStartTime(Date.now());
    setCurrentSessionId(sessionId);
    await Database.createSession(sessionId, `Session ${new Date().toLocaleTimeString()}`);
    playerEngine.setSession(sessionId);
    playerEngine.setDelay(delay);
    await recorderEngine.start({ sessionId, segmentDurationMs: 5000 });
    setIsRecording(true);
    setIsPaused(false);
    startPlayerSync();
  };

  const stopRecording = async () => {
    await recorderEngine.stop();
    setIsRecording(false);
  };

  const startPlayerSync = () => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    syncIntervalRef.current = setInterval(async () => {
      if (isPaused || isSeekingRef.current) return;
      if (!currentSegmentRef.current) {
        const initial = await playerEngine.getInitialSegment();
        if (initial) {
            currentSegmentRef.current = initial;
            setCurrentSegment(initial);
        }
      } else {
        const next = await playerEngine.getNextSegment();
        if (next) setNextSegment(next);
      }
    }, 1000);
  };

  const handleSeek = async (time: number) => {
    if (isSeekingRef.current) return;
    setCurrentTime(time);
    isSeekingRef.current = true;
    const result = await playerEngine.getSegmentForTime(time);
    if (result) {
      setIsPaused(true);
      const isSameSegment = currentSegmentRef.current?.id === result.segment.id;
      if (isSameSegment) {
          playerRef.current?.seek(result.offsetMs / 1000);
          setTimeout(() => {
              setIsPaused(false);
              isSeekingRef.current = false;
          }, 100);
      } else {
          seekTargetRef.current = result.offsetMs / 1000;
          setCurrentSegment({...result.segment});
          currentSegmentRef.current = result.segment;
          playerEngine.getNextSegment().then(n => { if (n) setNextSegment(n); });
      }
    } else {
        isSeekingRef.current = false;
    }
  };

  const onVideoLoad = () => {
    if (seekTargetRef.current !== null) {
        playerRef.current?.seek(seekTargetRef.current);
        seekTargetRef.current = null;
        setIsPaused(false);
    }
    isSeekingRef.current = false;
  };

  const onProgress = (data: { currentTime: number }) => {
    if (isSeekingRef.current) return;
    const now = Date.now();
    if (now - lastProgressUpdate.current < 100) return;
    lastProgressUpdate.current = now;

    if (currentSegment && sessionStartTime !== null) {
        const absoluteTime = ((currentSegment.timestamp - sessionStartTime) / 1000) + data.currentTime;
        setCurrentTime(absoluteTime);
        const pA = latestPointARef.current;
        const pB = latestPointBRef.current;
        if (loopEnabled && pA !== null && pB !== null) {
            const start = Math.min(pA, pB);
            const end = Math.max(pA, pB);
            if (absoluteTime >= (end - 0.2) || absoluteTime < (start - 0.5)) {
                handleSeek(start);
            }
        }
    }
  };

  const onSegmentEnd = () => {
    if (isSeekingRef.current) return;
    const next = playerEngine.onSegmentEnd();
    if (next) {
      currentSegmentRef.current = next;
      setCurrentSegment({...next}); 
      playerEngine.getNextSegment().then(n => { if (n) setNextSegment(n); });
    } else if (!isPaused) {
      currentSegmentRef.current = null;
      setCurrentSegment(null);
      setNextSegment(null);
    }
  };

  const handleLongPressTimeline = (time: number) => {
    const start = Math.max(0, time - 3);
    const end = Math.min(duration, time + 3);
    setPointA(start);
    latestPointARef.current = start;
    setPointB(end);
    latestPointBRef.current = end;
    setLoopEnabled(true);
    handleSeek(start);
  };

  const updatePoint = (point: 'A' | 'B', time: number) => {
      if (point === 'A') {
          setPointA(time);
          latestPointARef.current = time;
      } else {
          setPointB(time);
          latestPointBRef.current = time;
      }
      if (loopEnabled && latestPointARef.current !== null && latestPointBRef.current !== null) {
          const start = Math.min(latestPointARef.current, latestPointBRef.current);
          const end = Math.max(latestPointARef.current, latestPointBRef.current);
          if (currentTime < (start - 0.5) || currentTime > end) {
              handleSeek(start);
          }
      }
  };

  const togglePlayback = () => setIsPaused(!isPaused);
  const toggleSlowMo = () => setPlaybackRate(playbackRate === 1.0 ? 0.5 : 1.0);
  const toggleLoop = () => setLoopEnabled(!loopEnabled);
  const toggleCamera = () => setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
  const toggleFollow = () => setFollowPlayhead(!followPlayhead);
  const handleSyncToDelay = () => {
      const targetTime = Math.max(0, duration - delay);
      handleSeek(targetTime);
      setFollowPlayhead(true);
  };

  const saveAnnotations = async (paths: DrawingPath[]) => {
    setCurrentPaths(paths);
    if (currentSessionId) {
        await Database.addAnnotation(currentSessionId, currentTime, JSON.stringify(paths));
    }
  };

  const handleSelectSession = async (session: Session) => {
    setCurrentSessionId(session.id);
    const segments = await Database.getSegments(session.id);
    if (segments.length > 0) setSessionStartTime(segments[0].timestamp);
    playerEngine.setSession(session.id);
    setSessionModalVisible(false);
    setIsRecording(false);
    currentSegmentRef.current = null;
    setCurrentSegment(null);
    setNextSegment(null);
    startPlayerSync();
  };

  const handleExport = async () => {
    if (!currentSessionId || pointA === null || pointB === null) {
        Alert.alert('Export Error', 'Please set loop Points first.');
        return;
    }
    setIsExporting(true);
    try {
        await exportEngine.exportClip(currentSessionId, Math.min(pointA, pointB), Math.max(pointA, pointB));
    } catch (e: any) {
        Alert.alert('Export Failed', e.message);
    } finally {
        setIsExporting(false);
    }
  };

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

        <AnnotationOverlay
          enabled={isPaused}
          paths={currentPaths}
          onPathsChange={saveAnnotations}
          color={annotationColor}
          strokeWidth={3}
        />

        <View style={styles.cameraPreview} collapsable={false} renderToHardwareTextureAndroid={true}>
            <Camera
            key={cameraPosition}
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            video={true}
            audio={true}
            androidPreviewViewType="texture-view"
            />
            <View style={isRecording ? styles.recBadge : styles.liveBadge}>
                <Text style={styles.badgeText}>{isRecording ? '● REC' : 'LIVE'}</Text>
            </View>
        </View>
      </View>

      <View style={styles.topHud}>
        <TouchableOpacity style={styles.glassButton} onPress={() => setSessionModalVisible(true)}>
          <Text style={styles.hudText}>SESSIONS</Text>
        </TouchableOpacity>
        <View style={styles.hudGroup}>
            <TouchableOpacity style={styles.hudControl} onPress={() => setDelay(Math.max(1, delay - 1))}>
                <Text style={styles.hudControlText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.hudValue}>{delay}s</Text>
            <TouchableOpacity style={styles.hudControl} onPress={() => setDelay(Math.min(60, delay + 1))}>
                <Text style={styles.hudControlText}>+</Text>
            </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.glassButton, { backgroundColor: COLORS.primary }]} onPress={handleSyncToDelay}>
          <Text style={styles.hudText}>SYNC</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.glassButton, followPlayhead && styles.activeGlassButton]} onPress={toggleFollow}>
          <Text style={styles.hudText}>{followPlayhead ? 'FOLLOWING' : 'FOLLOW'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.glassButton} onPress={toggleCamera}>
          <Text style={styles.hudText}>{cameraPosition.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.zoomHud}>
          <TouchableOpacity style={styles.zoomButton} onPress={() => setZoomLevel(prev => Math.min(100, prev + 5))}>
              <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={() => setZoomLevel(prev => Math.max(5, prev - 5))}>
              <Text style={styles.zoomText}>-</Text>
          </TouchableOpacity>
      </View>

      <View style={styles.timelineWrapper}>
        <Timeline
          thumbnails={thumbnails}
          currentTime={currentTime}
          duration={duration}
          zoomLevel={zoomLevel}
          onSeek={handleSeek}
          onLongPress={handleLongPressTimeline}
          pointA={pointA}
          pointB={pointB}
          onUpdatePoint={updatePoint}
          sessionStartTime={sessionStartTime}
          followPlayhead={followPlayhead}
        />
      </View>

      <View style={styles.controls}>
        <View style={styles.mainButtonRow}>
          <TouchableOpacity style={[styles.roundButton, loopEnabled && styles.activeRoundButton]} onPress={toggleLoop}>
            <Text style={styles.buttonLabel}>LOOP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roundButton} onPress={() => { setPointA(null); setPointB(null); setLoopEnabled(false); latestPointARef.current = null; latestPointBRef.current = null; }}>
            <Text style={styles.buttonLabel}>CLEAR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.recordOuter, isRecording && styles.recordOuterActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
              <View style={[styles.recordInner, isRecording && styles.recordInnerActive]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.roundButton} onPress={toggleSlowMo}>
            <Text style={styles.buttonLabel}>{playbackRate === 1.0 ? '1.0x' : '0.5x'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roundButton} onPress={togglePlayback}>
            <Text style={styles.buttonLabel}>{isPaused ? 'PLAY' : 'PAUSE'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SessionManager visible={sessionModalVisible} onClose={() => setSessionModalVisible(false)} onSelectSession={handleSelectSession} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  playerContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  topHud: { position: 'absolute', top: 50, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, zIndex: 100 },
  glassButton: { backgroundColor: COLORS.surface, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, minWidth: 60, alignItems: 'center' },
  activeGlassButton: { backgroundColor: COLORS.primary, borderColor: 'white' },
  hudGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: COLORS.border },
  hudControl: { padding: 8 },
  hudControlText: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  hudValue: { color: COLORS.text, fontWeight: 'bold', fontSize: 12, marginHorizontal: 4 },
  hudText: { color: COLORS.text, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  cameraPreview: { 
    position: 'absolute', 
    top: 110, 
    right: 15, 
    width: 110, 
    height: 150, 
    borderRadius: 12, 
    borderWidth: 3, 
    borderColor: COLORS.primary, 
    zIndex: 9999, // TOP Z-INDEX
    elevation: 1000, 
    backgroundColor: '#111', 
    overflow: 'hidden' 
  },
  liveBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: COLORS.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: 'white', fontSize: 8, fontWeight: 'bold' },
  zoomHud: { position: 'absolute', right: 15, bottom: 240, backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, zIndex: 100 },
  zoomButton: { padding: 12, alignItems: 'center' },
  zoomText: { color: 'white', fontSize: 20, fontWeight: '300' },
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  waitingText: { color: COLORS.textSecondary, fontSize: 14, letterSpacing: 2, fontWeight: '300' },
  timelineWrapper: { position: 'absolute', bottom: 120, width: '100%' },
  controls: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  mainButtonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '90%' },
  roundButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  activeRoundButton: { backgroundColor: COLORS.primary, borderColor: 'white' },
  buttonLabel: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  recordOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: 'white', justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  recordOuterActive: { borderColor: COLORS.secondary },
  recordInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white' },
  recordInnerActive: { backgroundColor: COLORS.secondary, borderRadius: 8, width: 30, height: 30 },
  proButton: { backgroundColor: COLORS.primary, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
  proButtonText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },
  text: { color: 'white', fontSize: 18, marginBottom: 20 },
});
