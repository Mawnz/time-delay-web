/**
 * SeekIndicator.tsx
 *
 * A large, centered time-display overlay that appears while the user is
 * scrubbing the video. Animated in/out with opacity so it never causes layout
 * shifts. `pointerEvents="none"` ensures it never blocks gesture events.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface SeekIndicatorProps {
  visible: boolean;
  currentTime: number;
}

/** Format seconds → MM:SS.f (tenths for precision analysis) */
function formatTime(seconds: number): string {
  const totalMs = Math.max(0, Math.floor(seconds * 10));
  const tenths = totalMs % 10;
  const totalSecs = Math.floor(totalMs / 10);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const SeekIndicator: React.FC<SeekIndicatorProps> = ({ visible, currentTime }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const activeAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (activeAnimation.current) {
      activeAnimation.current.stop();
    }

    if (visible) {
      activeAnimation.current = Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      });
    } else {
      activeAnimation.current = Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      });
    }

    activeAnimation.current.start(() => {
      activeAnimation.current = null;
    });
  }, [visible, opacity]);

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      pointerEvents="none"
    >
      <View style={styles.pill}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Text style={styles.labelText}>SCRUBBING</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    // Sits above the gesture surface but below annotation overlay
    zIndex: 50,
  },
  pill: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    // Subtle blur-like feel via layered shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '200',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  labelText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: 4,
  },
});
