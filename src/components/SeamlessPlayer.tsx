import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { Segment } from '../types';

const { width, height } = Dimensions.get('window');

interface SeamlessPlayerProps {
  currentSegment: Segment | null;
  nextSegment: Segment | null;
  onSegmentEnd: () => void;
  onProgress: (data: { currentTime: number }) => void;
  onLoad: (segment: Segment) => void;
  paused: boolean;
  rate: number;
  muted?: boolean;
}

export interface SeamlessPlayerRef {
  seek: (time: number) => void;
  prepareSeek: (segment: Segment, offset: number) => void;
}

export const SeamlessPlayer = React.forwardRef<SeamlessPlayerRef, SeamlessPlayerProps>((props, ref) => {
  const {
    currentSegment,
    nextSegment,
    onSegmentEnd,
    onProgress,
    onLoad,
    paused,
    rate,
    muted = false,
  } = props;

  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [seekingSegment, setSeekingSegment] = useState<Segment | null>(null);
  
  const playerARef = useRef<VideoRef>(null);
  const playerBRef = useRef<VideoRef>(null);
  const seekTargetRef = useRef<number | null>(null);
  const isSwappingRef = useRef(false);

  React.useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      const activeRef = activePlayer === 'A' ? playerARef : playerBRef;
      activeRef.current?.seek(time);
    },
    /**
     * Prepares a seek into a DIFFERENT segment using the background player.
     */
    prepareSeek: (segment: Segment, offset: number) => {
        isSwappingRef.current = true;
        seekTargetRef.current = offset;
        setSeekingSegment(segment);
    }
  }));

  const handleReadyForDisplay = (id: 'A' | 'B') => {
      // If the background player just loaded our seek target, SWAP NOW
      if (isSwappingRef.current && activePlayer !== id && seekingSegment) {
          const finishedSegment = seekingSegment;
          setActivePlayer(id);
          setSeekingSegment(null);
          isSwappingRef.current = false;
          
          // Apply initial offset if needed
          if (seekTargetRef.current !== null) {
              const targetRef = id === 'A' ? playerARef : playerBRef;
              targetRef.current?.seek(seekTargetRef.current);
              seekTargetRef.current = null;
          }
          
          onLoad(finishedSegment); // Notify parent that swap is complete
      }
  };

  const handleEnd = () => {
    if (isSwappingRef.current) return;
    setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
    onSegmentEnd();
  };

  const renderPlayer = (id: 'A' | 'B') => {
    const isPrimary = activePlayer === id;
    const isSeeking = !isPrimary && seekingSegment !== null;
    
    // 1. If primary, use currentSegment.
    // 2. If seeking (background), use seekingSegment.
    // 3. Otherwise, use nextSegment (pre-buffer).
    let segment = isPrimary ? currentSegment : (isSeeking ? seekingSegment : nextSegment);
    const refForPlayer = id === 'A' ? playerARef : playerBRef;

    if (!segment) return <View key={`empty-${id}`} style={styles.hidden} />;

    return (
      <Video
        ref={refForPlayer}
        key={`${id}-${segment.id}`}
        source={{ uri: segment.path }}
        style={[
            isPrimary ? styles.visibleVideo : styles.hiddenVideo,
            { opacity: 0.99 }
        ]}
        resizeMode="contain"
        paused={isPrimary ? paused : false} // Background must be unpaused to trigger 'Ready'
        rate={rate}
        muted={muted}
        onEnd={isPrimary ? handleEnd : undefined}
        onProgress={isPrimary ? onProgress : undefined}
        onReadyForDisplay={() => handleReadyForDisplay(id)}
        playInBackground={true}
        disableFocus={true}
        shutterColor="transparent"
        useTextureView={true}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderPlayer('A')}
      {renderPlayer('B')}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  visibleVideo: { width: width, height: height, position: 'absolute', zIndex: 10 },
  hiddenVideo: { width: 1, height: 1, position: 'absolute', opacity: 0, zIndex: 1 },
  hidden: { width: 0, height: 0 },
});
