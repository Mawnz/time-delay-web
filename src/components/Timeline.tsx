import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, Image, TouchableOpacity, PanResponder, Text } from 'react-native';
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
  
  const latestPropsRef = useRef(props);
  useEffect(() => {
    latestPropsRef.current = props;
  });

  const totalWidth = duration * zoomLevel;
  const playheadPos = currentTime * zoomLevel;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
    onPanResponderRelease: () => { isInteracting.current = false; },
    onPanResponderTerminate: () => { isInteracting.current = false; }
  });

  const panA = useRef(createPanResponder('A')).current;
  const panB = useRef(createPanResponder('B')).current;

  const renderRuler = () => {
    const ticks = [];
    // Adjust intervals based on zoom
    let step = 5; // Label every 5s by default
    if (zoomLevel < 5) step = 10;
    if (zoomLevel > 30) step = 2;

    for (let i = 0; i <= duration; i += step) {
      ticks.push(
        <View key={`tick-${i}`} style={[styles.tickContainer, { left: i * zoomLevel }]}>
          <View style={styles.tickMark} />
          <Text style={styles.tickLabel}>{formatTime(i)}</Text>
        </View>
      );
    }
    return ticks;
  };

  const selectionStyle = useMemo(() => {
    if (pointA === null || pointB === null) return null;
    const start = Math.min(pointA, pointB) * zoomLevel;
    const end = Math.max(pointA, pointB) * zoomLevel;
    return {
      left: start,
      width: Math.max(2, end - start),
    };
  }, [pointA, pointB, zoomLevel]);

  return (
    <View style={styles.container}>
      {/* Time Display Header */}
      <View style={styles.header}>
          <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.durationText}> / {formatTime(duration)}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
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
            {/* 1. Ruler Layer */}
            <View style={styles.rulerLayer}>
                {renderRuler()}
            </View>

            {/* 2. Selection / Loop Layer */}
            {selectionStyle && (
                <>
                    {/* Dimming outside selection */}
                    <View style={[styles.dimOverlay, { left: 0, width: selectionStyle.left }]} pointerEvents="none" />
                    <View style={[styles.dimOverlay, { left: selectionStyle.left + selectionStyle.width, right: 0 }]} pointerEvents="none" />
                    
                    {/* Active region highlight */}
                    <View style={[styles.activeRegion, selectionStyle]} pointerEvents="none" />
                </>
            )}

            {/* 3. Thumbnails Layer (Filmstrip) */}
            <View pointerEvents="none" style={styles.thumbnailsLayer}>
              {thumbnails.map((t) => {
                const startTime = sessionStartTime || (thumbnails.length > 0 ? thumbnails[0].timestamp : 0);
                const pos = ((t.timestamp - startTime) / 1000) * zoomLevel;
                // Since segments are 5s, width should be 5 * zoomLevel
                const thumbWidth = 5 * zoomLevel;
                return (
                  <Image 
                    key={t.id}
                    source={{ uri: 'file://' + t.path }} 
                    style={[styles.thumbnail, { position: 'absolute', left: pos, width: thumbWidth }]} 
                  />
                );
              })}
            </View>

            {/* 4. Draggable Handles */}
            {pointA !== null && (
                <View {...panA.panHandlers} style={[styles.handle, { left: pointA * zoomLevel - 20 }]}>
                    <View style={[styles.handleBar, { backgroundColor: '#007AFF' }]} />
                    <View style={styles.handleCap} />
                </View>
            )}
            {pointB !== null && (
                <View {...panB.panHandlers} style={[styles.handle, { left: pointB * zoomLevel - 20 }]}>
                    <View style={[styles.handleBar, { backgroundColor: '#007AFF' }]} />
                    <View style={styles.handleCap} />
                </View>
            )}

            {/* 5. Playhead Indicator */}
            <View pointerEvents="none" style={[styles.playhead, { left: playheadPos }]}>
                <View style={styles.playheadLine} />
                <View style={styles.playheadCap} />
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 120, backgroundColor: '#111', borderTopWidth: 1, borderColor: '#333' },
  header: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#000', borderBottomWidth: 1, borderColor: '#222' },
  currentTimeText: { color: '#FF3B30', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  durationText: { color: '#888', fontSize: 10, fontFamily: 'monospace' },
  timelineContent: { height: 100, position: 'relative' },
  rulerLayer: { height: 20, borderBottomWidth: 1, borderColor: '#222' },
  tickContainer: { position: 'absolute', top: 0, bottom: 0, alignItems: 'flex-start' },
  tickMark: { width: 1, height: 8, backgroundColor: '#444' },
  tickLabel: { color: '#666', fontSize: 8, marginLeft: 2, marginTop: 2 },
  thumbnailsLayer: { height: 60, marginTop: 2 },
  thumbnail: { height: '100%', resizeMode: 'cover', opacity: 0.6 },
  dimOverlay: { position: 'absolute', top: 20, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 5 },
  activeRegion: { position: 'absolute', top: 20, bottom: 0, backgroundColor: 'rgba(0, 122, 255, 0.1)', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#007AFF', zIndex: 4 },
  handle: { position: 'absolute', top: 20, bottom: 0, width: 40, zIndex: 100, justifyContent: 'center', alignItems: 'center' },
  handleBar: { width: 2, height: '100%' },
  handleCap: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#007AFF', position: 'absolute', bottom: 0 },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2, zIndex: 150, alignItems: 'center' },
  playheadLine: { flex: 1, width: 2, backgroundColor: '#FF3B30' },
  playheadCap: { width: 10, height: 10, backgroundColor: '#FF3B30', transform: [{ rotate: '45deg' }], marginTop: -5 },
});
