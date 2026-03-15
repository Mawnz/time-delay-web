import { useState, useEffect, useCallback, useRef } from 'react';
import { Database } from '../storage/db';
import { Thumbnail } from '../types';

export const useSessionData = (sessionId: string | null, isRecording: boolean) => {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [duration, setDuration] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  
  const lastUpdateTs = useRef(0);
  const isFetchingRef = useRef(false);

  const fetchIncrementalData = useCallback(async () => {
    if (!sessionId || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // 1. Fetch only NEW thumbnails since last update
      // We use a large number for end range to catch everything
      const newThumbs = await Database.getThumbnails(sessionId, lastUpdateTs.current + 1, Date.now() + 100000);
      
      if (newThumbs.length > 0) {
        setThumbnails(prev => {
            // Prevent duplicates if interval fires twice
            const existingIds = new Set(prev.map(t => t.id));
            const filtered = newThumbs.filter(t => !existingIds.has(t.id));
            return [...prev, ...filtered];
        });
        lastUpdateTs.current = Math.max(lastUpdateTs.current, ...newThumbs.map(t => t.timestamp));
      }

      // 2. Fetch first segment to ensure sessionStartTime is locked
      if (sessionStartTime === null) {
          const startTs = await Database.getSessionStart(sessionId);
          if (startTs) setSessionStartTime(startTs);
      }

      // 3. Update duration
      const segments = await Database.getSegments(sessionId);
      if (segments.length > 0) {
        const firstTs = segments[0].timestamp;
        const lastTs = segments[segments.length - 1].timestamp + (segments[segments.length - 1].duration * 1000);
        setDuration((lastTs - firstTs) / 1000);
      }
    } catch (e) {
      console.error('Session data fetch error:', e);
    } finally {
      isFetchingRef.current = false;
    }
  }, [sessionId, sessionStartTime]);

  useEffect(() => {
    if (!sessionId) {
        setThumbnails([]);
        setDuration(0);
        setSessionStartTime(null);
        lastUpdateTs.current = 0;
        return;
    }

    // Reset for new session
    setThumbnails([]);
    lastUpdateTs.current = 0;

    const interval = setInterval(fetchIncrementalData, 2000);
    fetchIncrementalData();

    return () => clearInterval(interval);
  }, [sessionId]); // Only re-run if sessionId changes

  return {
    thumbnails,
    duration,
    sessionStartTime,
    setSessionStartTime
  };
};
