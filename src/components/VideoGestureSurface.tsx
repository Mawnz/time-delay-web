/**
 * VideoGestureSurface.tsx
 *
 * A transparent PanResponder layer that sits above the video but below the
 * annotation overlay. Handles three exclusive gesture modes:
 *  - SCRUB  : Single-finger horizontal swipe → seek in time
 *  - ZOOM   : Two-finger pinch changing distance → scale video viewport
 *  - PAN    : Two-finger pan (stable distance, centroid moving) → translate viewport
 *
 * All gesture state is stored in refs to avoid triggering re-renders in the
 * hot path. The parent receives clean callbacks:
 *   onSeek(time)          → debounced seek
 *   onGestureChange(t)    → { scale, translateX, translateY } transform update
 *   onScrubStart()        → show SeekIndicator
 *   onScrubEnd()          → hide SeekIndicator
 */

import React, { useRef, useCallback } from 'react';
import { PanResponder, View, StyleSheet, GestureResponderEvent, PanResponderGestureState } from 'react-native';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum pixels of horizontal movement before locking into scrub mode */
const SCRUB_THRESHOLD_PX = 5;
/** Minimum pixels of vertical movement before we decide this is NOT a scrub */
const VERTICAL_CANCEL_PX = 15;
/** Throttle seeks to avoid hammering the seek engine */
const SEEK_THROTTLE_MS = 80;
/** Sensitivity: px moved per second of video time. Derived from zoomLevel. */
const PINCH_MIN_DISTANCE_PX = 10;
/** Clamp scale between these bounds */
const MIN_SCALE = 1.0;
const MAX_SCALE = 5.0;

// ─── Types ───────────────────────────────────────────────────────────────────

type GestureMode = 'none' | 'scrub' | 'zoom' | 'pan';

export interface VideoTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

interface VideoGestureSurfaceProps {
  /** Current playback time in seconds */
  currentTime: number;
  /** Total session duration in seconds */
  duration: number;
  /**
   * Timeline zoom level (pixels per second). Used as the scrub sensitivity:
   * Δtime = -ΔxPx / zoomLevel
   */
  zoomLevel: number;
  /** Current video transform (controlled by parent) */
  transform: VideoTransform;
  /** Called when the user scrubs to a new time */
  onSeek: (time: number) => void;
  /** Called whenever the pinch/pan transform changes */
  onGestureChange: (t: VideoTransform) => void;
  /** Called when scrubbing begins (show SeekIndicator) */
  onScrubStart: () => void;
  /** Called when scrubbing ends (hide SeekIndicator) */
  onScrubEnd: () => void;
  /** When true (annotation mode active) pass all events through */
  passThrough?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTwoTouchDistance(e: GestureResponderEvent): number {
  const touches = e.nativeEvent.touches;
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTwoTouchCentroid(e: GestureResponderEvent): { x: number; y: number } {
  const touches = e.nativeEvent.touches;
  if (touches.length < 2) return { x: 0, y: 0 };
  return {
    x: (touches[0].pageX + touches[1].pageX) / 2,
    y: (touches[0].pageY + touches[1].pageY) / 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VideoGestureSurface: React.FC<VideoGestureSurfaceProps> = ({
  currentTime,
  duration,
  zoomLevel,
  transform,
  onSeek,
  onGestureChange,
  onScrubStart,
  onScrubEnd,
  passThrough = false,
}) => {
  // ── Gesture state refs (no re-renders in hot path) ──────────────────────

  const gestureModeRef = useRef<GestureMode>('none');
  const scrubStartTimeRef = useRef(0);
  const scrubStartXRef = useRef(0);
  const lastSeekTimestampRef = useRef(0);
  const isScrubbing = useRef(false);

  // Pinch / pan state
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const panStartCentroidRef = useRef({ x: 0, y: 0 });
  const panStartTranslateRef = useRef({ x: 0, y: 0 });

  // Mirror of parent transform in a ref so callbacks always have the latest value
  const transformRef = useRef<VideoTransform>(transform);
  transformRef.current = transform;

  // ── Throttled seek ──────────────────────────────────────────────────────

  const throttledSeek = useCallback(
    (time: number) => {
      const now = Date.now();
      if (now - lastSeekTimestampRef.current < SEEK_THROTTLE_MS) return;
      lastSeekTimestampRef.current = now;
      onSeek(clamp(time, 0, duration));
    },
    [onSeek, duration],
  );

  // ── PanResponder ────────────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      // ── Claim the responder ──────────────────────────────────────────
      onStartShouldSetPanResponder: (_e, _gs) => !passThrough,
      onMoveShouldSetPanResponder: (_e, gs) => {
        if (passThrough) return false;
        // Capture if there's meaningful movement
        return Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2;
      },
      onPanResponderTerminationRequest: () => false,

      // ── Grant ────────────────────────────────────────────────────────
      onPanResponderGrant: (e, _gs) => {
        gestureModeRef.current = 'none';
        isScrubbing.current = false;

        if (e.nativeEvent.touches.length >= 2) {
          // Pre-lock into multi-touch mode immediately
          pinchStartDistanceRef.current = getTwoTouchDistance(e);
          pinchStartScaleRef.current = transformRef.current.scale;
          const centroid = getTwoTouchCentroid(e);
          panStartCentroidRef.current = centroid;
          panStartTranslateRef.current = {
            x: transformRef.current.translateX,
            y: transformRef.current.translateY,
          };
          // Will be refined to 'zoom' or 'pan' on first move
          gestureModeRef.current = 'zoom';
        } else {
          scrubStartXRef.current = e.nativeEvent.pageX;
          scrubStartTimeRef.current = currentTime;
        }
      },

      // ── Move ─────────────────────────────────────────────────────────
      onPanResponderMove: (e, gs) => {
        const touchCount = e.nativeEvent.touches.length;

        // ── Multi-touch: zoom or pan ─────────────────────────────────
        if (touchCount >= 2) {
          // Cancel any pending scrub
          if (isScrubbing.current) {
            isScrubbing.current = false;
            onScrubEnd();
          }

          const currentDistance = getTwoTouchDistance(e);
          const centroid = getTwoTouchCentroid(e);

          if (gestureModeRef.current === 'none' || gestureModeRef.current === 'scrub') {
            // First multi-touch move — reset multi-touch anchors
            gestureModeRef.current = 'zoom';
            pinchStartDistanceRef.current = currentDistance;
            pinchStartScaleRef.current = transformRef.current.scale;
            panStartCentroidRef.current = centroid;
            panStartTranslateRef.current = {
              x: transformRef.current.translateX,
              y: transformRef.current.translateY,
            };
            return;
          }

          const distanceDelta = Math.abs(currentDistance - pinchStartDistanceRef.current);
          const centroidDelta = Math.sqrt(
            Math.pow(centroid.x - panStartCentroidRef.current.x, 2) +
              Math.pow(centroid.y - panStartCentroidRef.current.y, 2),
          );

          // Decide between zoom and pan based on which metric is larger
          if (distanceDelta > centroidDelta || gestureModeRef.current === 'zoom') {
            // ── ZOOM ──────────────────────────────────────────────────
            gestureModeRef.current = 'zoom';
            if (pinchStartDistanceRef.current < PINCH_MIN_DISTANCE_PX) return;
            const rawScale =
              (currentDistance / pinchStartDistanceRef.current) * pinchStartScaleRef.current;
            const newScale = clamp(rawScale, MIN_SCALE, MAX_SCALE);

            // When zooming back to 1, reset translation too
            const newTx = newScale === 1 ? 0 : transformRef.current.translateX;
            const newTy = newScale === 1 ? 0 : transformRef.current.translateY;

            onGestureChange({ scale: newScale, translateX: newTx, translateY: newTy });
          } else {
            // ── PAN ───────────────────────────────────────────────────
            gestureModeRef.current = 'pan';
            const newTx =
              panStartTranslateRef.current.x + (centroid.x - panStartCentroidRef.current.x);
            const newTy =
              panStartTranslateRef.current.y + (centroid.y - panStartCentroidRef.current.y);

            onGestureChange({
              scale: transformRef.current.scale,
              translateX: newTx,
              translateY: newTy,
            });
          }

          return;
        }

        // ── Single touch: maybe scrub ─────────────────────────────────
        if (gestureModeRef.current === 'zoom' || gestureModeRef.current === 'pan') {
          // Was a multi-touch gesture — ignore single finger follow-through
          return;
        }

        const absDx = Math.abs(gs.dx);
        const absDy = Math.abs(gs.dy);

        if (gestureModeRef.current === 'none') {
          if (absDy > VERTICAL_CANCEL_PX && absDy > absDx) {
            // Vertical swipe — release the responder so scroll can work
            return;
          }
          if (absDx > SCRUB_THRESHOLD_PX) {
            gestureModeRef.current = 'scrub';
            isScrubbing.current = true;
            onScrubStart();
          }
          return;
        }

        if (gestureModeRef.current === 'scrub') {
          // Sensitivity: zoomLevel px = 1 second
          const sensitivity = Math.max(zoomLevel, 5); // guard against 0
          const deltaTime = -gs.dx / sensitivity;
          const targetTime = scrubStartTimeRef.current + deltaTime;
          throttledSeek(targetTime);
        }
      },

      // ── Release ──────────────────────────────────────────────────────
      onPanResponderRelease: (_e, gs) => {
        if (isScrubbing.current) {
          isScrubbing.current = false;
          onScrubEnd();
          // Final precise seek on release
          const sensitivity = Math.max(zoomLevel, 5);
          const deltaTime = -gs.dx / sensitivity;
          onSeek(clamp(scrubStartTimeRef.current + deltaTime, 0, duration));
        }

        gestureModeRef.current = 'none';

        // Reset pan anchor for next gesture
        panStartTranslateRef.current = {
          x: transformRef.current.translateX,
          y: transformRef.current.translateY,
        };
      },

      onPanResponderTerminate: (_e, gs) => {
        if (isScrubbing.current) {
          isScrubbing.current = false;
          onScrubEnd();
        }
        gestureModeRef.current = 'none';
      },
    }),
  ).current;

  if (passThrough) {
    return null;
  }

  return (
    <View
      style={styles.surface}
      {...panResponder.panHandlers}
      collapsable={false}
    />
  );
};

const styles = StyleSheet.create({
  surface: {
    ...StyleSheet.absoluteFillObject,
    // Fully transparent — only intercepts touch, renders nothing
    backgroundColor: 'transparent',
    zIndex: 10,
  },
});
