import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, Image, TouchableOpacity, PanResponder } from 'react-native';
import { Thumbnail } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TimelineProps {
  thumbnails: Thumbnail[];
  currentTime: number;
  duration: number;
  zoomLevel: number;
  onSeek: (time: number) => void;
  onLongPress: (time: number) => void;
  pointA: number | null;
  pointB: number | null;
  onUpdatePoint: (point: 'A' | 'B', time: number) => void;
  sessionStartTime: number | null;
  followPlayhead: boolean;
}

export const Timeline: React.FC<TimelineProps> = (props) => {
  const {
    thumbnails,
    currentTime,
    duration,
    zoomLevel,
    onSeek,
    onLongPress,
    pointA,
    pointB,
    onUpdatePoint,
    sessionStartTime,
    followPlayhead,
  } = props;

  const scrollRef = useRef<ScrollView>(null);
  const isInteracting = useRef(false);
  const dragStartTimeRef = useRef(0);
  
  // Use a ref to capture latest props for the PanResponder closure
  const latestPropsRef = useRef(props);
  useEffect(() => {
    latestPropsRef.current = props;
  });

  const totalWidth = duration * zoomLevel;
  const playheadPos = currentTime * zoomLevel;

  // Auto-scroll logic
  useEffect(() => {
    if (followPlayhead && !isInteracting.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        x: Math.max(0, playheadPos - SCREEN_WIDTH * 0.5),
        animated: true,
      });
    }
  }, [playheadPos, followPlayhead]);

  const createPanResponder = (point: 'A' | 'B') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { 
        isInteracting.current = true; 
        const latest = latestPropsRef.current;
        dragStartTimeRef.current = point === 'A' ? (latest.pointA || 0) : (latest.pointB || 0);
    },
    onPanResponderMove: (evt, gestureState) => {
      const latest = latestPropsRef.current;
      const newTime = Math.max(0, Math.min(latest.duration, dragStartTimeRef.current + (gestureState.dx / latest.zoomLevel)));
      onUpdatePoint(point, newTime);
    },
    onPanResponderRelease: () => { 
        isInteracting.current = false; 
    },
    onPanResponderTerminate: () => {
        isInteracting.current = false;
    }
  });

  const panA = useRef(createPanResponder('A')).current;
  const panB = useRef(createPanResponder('B')).current;

  const highlightStyle = useMemo(() => {
    if (pointA === null || pointB === null) return { display: 'none' };
    const start = Math.min(pointA, pointB) * zoomLevel;
    const end = Math.max(pointA, pointB) * zoomLevel;
    return {
      left: start,
      width: Math.max(2, end - start),
      display: 'flex',
    } as const;
  }, [pointA, pointB, zoomLevel]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { isInteracting.current = true; }}
        onScrollEndDrag={() => { isInteracting.current = false; }}
        contentContainerStyle={{ minWidth: SCREEN_WIDTH }}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={(e) => onSeek(e.nativeEvent.locationX / zoomLevel)}
          onLongPress={(e) => onLongPress(e.nativeEvent.locationX / zoomLevel)}
        >
          <View style={[styles.timelineContent, { width: Math.max(totalWidth, SCREEN_WIDTH) }]}>
            {/* Range Highlight */}
            <View pointerEvents="none" style={[styles.rangeHighlight, highlightStyle]} />
            
            {/* Draggable Handles */}
            {pointA !== null && (
                <View 
                    {...panA.panHandlers}
                    style={[styles.handle, { left: pointA * zoomLevel - 20 }]} 
                >
                    <View style={[styles.handleBar, { borderColor: '#007AFF' }]} />
                </View>
            )}
            {pointB !== null && (
                <View 
                    {...panB.panHandlers}
                    style={[styles.handle, { left: pointB * zoomLevel - 20 }]} 
                >
                    <View style={[styles.handleBar, { borderColor: '#007AFF' }]} />
                </View>
            )}

            {/* Stable Thumbnails */}
            <View pointerEvents="none" style={styles.thumbnailsLayer}>
              {thumbnails.map((t, index) => {
                const startTime = sessionStartTime || (thumbnails.length > 0 ? thumbnails[0].timestamp : 0);
                const pos = ((t.timestamp - startTime) / 1000) * zoomLevel;
                return (
                  <Image 
                    key={`${t.id}-${index}`}
                    source={{ uri: 'file://' + t.path }} 
                    style={[
                      styles.thumbnail, 
                      { 
                        position: 'absolute', 
                        left: pos,
                        width: 64
                      }
                    ]} 
                  />
                );
              })}
            </View>

            {/* Playhead Indicator */}
            <View pointerEvents="none" style={[styles.playhead, { left: playheadPos }]} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 80, backgroundColor: '#000', borderTopWidth: 1, borderColor: '#333' },
  timelineContent: { height: '100%', position: 'relative' },
  thumbnailsLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  thumbnail: { height: '100%', resizeMode: 'cover', opacity: 0.4 },
  rangeHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#007AFF',
    zIndex: 5,
  },
  handle: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 40,
      zIndex: 100,
      justifyContent: 'center',
      alignItems: 'center'
  },
  handleBar: {
      width: 6,
      height: '70%',
      backgroundColor: 'white',
      borderRadius: 3,
      borderWidth: 1,
      elevation: 5
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FF3B30',
    zIndex: 40,
  },
});
