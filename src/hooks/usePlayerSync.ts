import { useState, useRef, useCallback, useEffect } from 'react';
import { playerEngine } from '../engines/PlayerEngine';
import { Segment } from '../types';

/** Duration of a single frame step (30fps default). */
const FRAME_DURATION_S = 1 / 30;
import { SeamlessPlayerRef } from '../components/SeamlessPlayer';

interface PlayerSyncOptions {
  sessionId: string | null;
  delay: number;
  isPaused: boolean;
  loopEnabled: boolean;
  pointA: number | null;
  pointB: number | null;
  sessionStartTime: number | null;
  /** Total session duration in seconds (from useSessionData), used by stepFrame clamping. */
  duration: number;
}

export const usePlayerSync = (options: PlayerSyncOptions) => {
  const { sessionId, delay, isPaused, loopEnabled, pointA, pointB, sessionStartTime, duration } = options;

  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [nextSegment, setNextSegment] = useState<Segment | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const playerRef = useRef<SeamlessPlayerRef>(null);
  const currentSegmentRef = useRef<Segment | null>(null);
  const isSeekingRef = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const seekFailSafeRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressUpdate = useRef(0);

  const clearSeekFailSafe = () => {
      if (seekFailSafeRef.current) {
          clearTimeout(seekFailSafeRef.current);
          seekFailSafeRef.current = null;
      }
  };

  const handleSeek = useCallback(async (time: number) => {
    if (isSeekingRef.current) return;
    
    setCurrentTime(time);
    isSeekingRef.current = true;

    clearSeekFailSafe();
    seekFailSafeRef.current = setTimeout(() => {
        console.warn('Seek fail-safe triggered');
        isSeekingRef.current = false;
    }, 3000) as unknown as NodeJS.Timeout; // 3s fail-safe for background load

    const result = await playerEngine.getSegmentForTime(time);
    if (result) {
      const isSameSegment = currentSegmentRef.current?.id === result.segment.id;
      if (isSameSegment) {
          playerRef.current?.seek(result.offsetMs / 1000);
          setTimeout(() => {
              isSeekingRef.current = false;
              clearSeekFailSafe();
          }, 150);
      } else {
          // SEAMLESS SEEK: Use background player
          playerRef.current?.prepareSeek(result.segment, result.offsetMs / 1000);
          // currentSegment state is NOT updated yet to keep current frame visible
      }
    } else {
        isSeekingRef.current = false;
        clearSeekFailSafe();
    }
  }, []);

  /**
   * Step exactly one frame forward (+1) or backward (-1).
   * Unlike handleSeek, this bypasses the isSeekingRef guard so it always
   * responds while paused. It forces a pause-friendly direct seek.
   */
  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const durationRef = duration; // capture from options
      setCurrentTime(prev => {
        const next = Math.max(0, Math.min(durationRef, prev + direction * FRAME_DURATION_S));
        // Fire seek on next tick to let state settle
        setTimeout(() => {
          isSeekingRef.current = false; // ensure guard is clear
          handleSeek(next);
        }, 0);
        return next;
      });
    },
    [duration, handleSeek],
  );

  const onVideoLoad = useCallback((loadedSegment: Segment) => {
    // Called when the SeamlessPlayer has finished the background swap
    currentSegmentRef.current = loadedSegment;
    setCurrentSegment({...loadedSegment});
    
    isSeekingRef.current = false;
    clearSeekFailSafe();
    
    // Refresh pre-fetch
    playerEngine.getNextSegment().then(n => { if (n) setNextSegment(n); });
  }, []);

  const onProgress = useCallback((data: { currentTime: number }) => {
    if (isSeekingRef.current) return;
    
    const now = Date.now();
    if (now - lastProgressUpdate.current < 100) return;
    lastProgressUpdate.current = now;

    if (currentSegment && sessionStartTime !== null) {
        const absoluteTime = ((currentSegment.timestamp - sessionStartTime) / 1000) + data.currentTime;
        setCurrentTime(absoluteTime);

        if (loopEnabled && pointA !== null && pointB !== null) {
            const start = Math.min(pointA, pointB);
            const end = Math.max(pointA, pointB);
            if (absoluteTime >= (end - 0.2) || absoluteTime < (start - 0.5)) {
                handleSeek(start);
            }
        }
    }
  }, [currentSegment, sessionStartTime, loopEnabled, pointA, pointB, handleSeek]);

  const onSegmentEnd = useCallback(() => {
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
  }, [isPaused]);

  useEffect(() => {
    if (!sessionId) return;
    
    playerEngine.setSession(sessionId);
    playerEngine.setDelay(delay);

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
    }, 1000) as unknown as NodeJS.Timeout;

    return () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        clearSeekFailSafe();
    };
  }, [sessionId, delay, isPaused]);

  return {
    playerRef,
    currentSegment,
    nextSegment,
    currentTime,
    setCurrentTime,
    playbackRate,
    setPlaybackRate,
    handleSeek,
    stepFrame,
    onVideoLoad,
    onProgress,
    onSegmentEnd
  };
};
