import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Video from 'react-native-video';
import { Segment } from '../types';

const { width, height } = Dimensions.get('window');

interface SeamlessPlayerProps {
  currentSegment: Segment | null;
  nextSegment: Segment | null;
  onSegmentEnd: () => void;
  onProgress: (data: { currentTime: number }) => void;
  onLoad: () => void;
  paused: boolean;
  rate: number;
}

export interface SeamlessPlayerRef {
  seek: (time: number) => void;
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
  } = props;

  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  
  const playerARef = useRef<Video>(null);
  const playerBRef = useRef<Video>(null);

  React.useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      const activeRef = activePlayer === 'A' ? playerARef : playerBRef;
      activeRef.current?.seek(time);
    }
  }));

  useEffect(() => {
    if (currentSegment) {
        onLoad();
    }
  }, [currentSegment?.id]);

  const handleEnd = () => {
    setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
    onSegmentEnd();
  };

  const renderPlayer = (id: 'A' | 'B') => {
    const isPrimary = activePlayer === id;
    const segment = isPrimary ? currentSegment : nextSegment;
    const refForPlayer = id === 'A' ? playerARef : playerBRef;

    if (!segment) return <View style={styles.hidden} />;

    return (
      <Video
        ref={refForPlayer}
        key={`${id}-${segment.id}`}
        source={{ uri: segment.path }}
        style={[
            isPrimary ? styles.visibleVideo : styles.hiddenVideo,
            { opacity: 0.99 } // HACK: Force hardware layer composition to respect zIndex
        ]}
        resizeMode="contain"
        paused={isPrimary ? paused : true}
        rate={rate}
        onEnd={isPrimary ? handleEnd : undefined}
        onProgress={isPrimary ? onProgress : undefined}
        onLoad={onLoad}
        playInBackground={true}
        disableFocus={true}
        shutterColor="transparent"
        useTextureView={true} // Use TextureView instead of SurfaceView for z-index support
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
  visibleVideo: { width: width, height: height, position: 'absolute' },
  hiddenVideo: { width: 1, height: 1, position: 'absolute', opacity: 0 },
  hidden: { width: 0, height: 0 },
});
